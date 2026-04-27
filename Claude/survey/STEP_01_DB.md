# Step 1 — DB Migration: Additions & Audit Wiring

Create file: `supabase/migrations/20260801100000_survey_additions.sql`

**Read `Claude/survey/COMPLIANCE.md` before writing any SQL in this step.**

## Context

The core survey tables already exist in `supabase/migrations/archive/20260730130000_enterprise_survey_module.sql`:
- `surveys` — campaign header
- `org_survey_questions` — per-survey questions
- `org_survey_responses` — respondent submissions
- `org_survey_answers` — per-question answers within a response
- `survey_question_bank` — reusable question library

This migration is **additive only**. Do NOT recreate existing tables.

What is missing and must be added:
1. **Column additions to `surveys`** — compliance-critical fields missing from the original migration (AML § 7-2, IK-forskriften § 5, GDPR)
2. **Column additions to `org_survey_questions`** — legally mandatory question tracking (AML § 4-3)
3. **Constraint update on `surveys.status`** — add `'archived'` status for IK-f § 5 retention
4. **Unique constraint on `org_survey_responses`** — prevent double-responses
5. **Anon RLS policies** — allow public (unauthenticated) respondents to read active surveys and submit answers
6. `survey_amu_reviews` — protocol + dual sign-off for AMU review (AML § 7-2)
7. `survey_action_plans` — auto-generated action items for low-scoring categories (IK-f § 5)
8. Audit triggers on every survey table (reuse `public.audit_log_change()`)
9. Org-id auto-fill BEFORE INSERT triggers on every survey table
5. `updated_at` BEFORE UPDATE triggers on every survey table that has `updated_at`

---

## 0. Column additions to existing tables (run BEFORE creating new tables)

### 0a. `surveys` — compliance-critical columns

These columns are missing from the original `20260730130000_enterprise_survey_module.sql` migration.
Each is wrapped in `add column if not exists` to be safe:

```sql
alter table public.surveys
  -- GDPR Art. 25: k-anonymity threshold (default 5 per SURVEY_K_ANONYMITY_MIN)
  add column if not exists anonymity_threshold int not null default 5
    check (anonymity_threshold > 0),
  -- AML § 7-2 (2)e: must present results to AMU before survey is fully compliant
  add column if not exists amu_review_required boolean not null default true,
  -- IK-f § 5 nr. 7: auto-generate action plans below this score (0–100)
  add column if not exists action_threshold int not null default 60
    check (action_threshold between 0 and 100),
  -- AML § 3-1: recommended cartilage cycle in months (null = no cycle set)
  add column if not exists recurrence_months int
    check (recurrence_months is null or recurrence_months between 1 and 120),
  -- IK-f § 5: track next scheduled run date
  add column if not exists next_scheduled_at timestamptz;

-- Add 'archived' to status — IK-f § 5 retention: archived surveys cannot be deleted by users
alter table public.surveys
  drop constraint if exists surveys_status_check;
alter table public.surveys
  add constraint surveys_status_check
  check (status in ('draft', 'active', 'closed', 'archived'));

-- Update DELETE policy to also block archived surveys
drop policy if exists surveys_delete_org on public.surveys;
create policy surveys_delete_org
  on public.surveys for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and status = 'draft'   -- only drafts can be deleted; closed/archived are immutable
  );
```

### 0b. `org_survey_questions` — mandatory question tracking (AML § 4-3)

```sql
alter table public.org_survey_questions
  -- Whether this question is legally required (cannot be deleted when survey is active)
  add column if not exists is_mandatory boolean not null default false,
  -- Which law mandates this question
  add column if not exists mandatory_law text
    check (mandatory_law is null or mandatory_law in ('AML_4_3', 'AML_4_4', 'AML_6_2'));
```

### 0c. `org_survey_responses` — prevent double-responses for identified surveys

```sql
-- For identified (non-anonymous) surveys: one response per user per survey
-- Anonymous surveys (user_id IS NULL) are exempt from this constraint
create unique index if not exists org_survey_responses_user_survey_uidx
  on public.org_survey_responses (survey_id, user_id)
  where user_id is not null;
```

### 0d. Anon (public) RLS policies for respondent access

Respondents may be unauthenticated (anonymous surveys accessed via direct link).
Grant read access to active surveys and write access for responses.

```sql
-- Allow anon role to read active survey metadata
drop policy if exists surveys_select_anon on public.surveys;
create policy surveys_select_anon
  on public.surveys for select to anon
  using (
    status = 'active'
    and organization_id is not null
  );

-- Allow anon role to read questions of active surveys
drop policy if exists org_survey_questions_select_anon on public.org_survey_questions;
create policy org_survey_questions_select_anon
  on public.org_survey_questions for select to anon
  using (
    exists (
      select 1 from public.surveys s
      where s.id = survey_id
        and s.status = 'active'
    )
  );

-- Allow anon role to insert responses for active surveys
drop policy if exists org_survey_responses_insert_anon on public.org_survey_responses;
create policy org_survey_responses_insert_anon
  on public.org_survey_responses for insert to anon
  with check (
    exists (
      select 1 from public.surveys s
      where s.id = survey_id
        and s.status = 'active'
        and s.organization_id = org_survey_responses.organization_id
    )
  );

-- Allow anon role to insert answers linked to an existing response
drop policy if exists org_survey_answers_insert_anon on public.org_survey_answers;
create policy org_survey_answers_insert_anon
  on public.org_survey_answers for insert to anon
  with check (
    exists (
      select 1 from public.org_survey_responses r
        join public.surveys s on s.id = r.survey_id
      where r.id = response_id
        and s.status = 'active'
        and r.organization_id = org_survey_answers.organization_id
    )
  );

-- Grant schema/table access to anon role
grant usage on schema public to anon;
grant select on public.surveys to anon;
grant select on public.org_survey_questions to anon;
grant insert on public.org_survey_responses to anon;
grant insert on public.org_survey_answers to anon;
```

---

## 1. New table: `survey_amu_reviews`

One row per survey (created on demand when admin starts AMU review flow).

```sql
create table if not exists public.survey_amu_reviews (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  survey_id             uuid not null references public.surveys(id) on delete cascade,
  meeting_date          date,
  agenda_item           text,
  protocol_text         text,
  amu_chair_name        text,
  amu_chair_signed_at   timestamptz,
  vo_name               text,
  vo_signed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id),
  unique (survey_id)
);

create index if not exists survey_amu_reviews_org_idx
  on public.survey_amu_reviews (organization_id, survey_id);
```

RLS:
```sql
alter table public.survey_amu_reviews enable row level security;

create policy survey_amu_reviews_select
  on public.survey_amu_reviews for select to authenticated
  using (organization_id = public.current_org_id());

create policy survey_amu_reviews_insert
  on public.survey_amu_reviews for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy survey_amu_reviews_update
  on public.survey_amu_reviews for update to authenticated
  using (
    organization_id = public.current_org_id()
    -- once both parties have signed, block further edits
    and (amu_chair_signed_at is null or vo_signed_at is null)
  );
```

---

## 2. New table: `survey_action_plans`

Auto-generated when results are computed and a category score is below the action threshold.

```sql
create table if not exists public.survey_action_plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  survey_id       uuid not null references public.surveys(id) on delete cascade,
  category        text not null,
  pillar          text not null
    check (pillar in ('psychosocial','physical','organization','safety_culture','custom')),
  title           text not null,
  description     text,
  score           numeric,
  status          text not null default 'open'
    check (status in ('open','in_progress','closed')),
  responsible     text,
  due_date        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create index if not exists survey_action_plans_survey_status_idx
  on public.survey_action_plans (survey_id, status);
```

RLS:
```sql
alter table public.survey_action_plans enable row level security;

create policy survey_action_plans_select
  on public.survey_action_plans for select to authenticated
  using (organization_id = public.current_org_id());

create policy survey_action_plans_insert
  on public.survey_action_plans for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy survey_action_plans_update
  on public.survey_action_plans for update to authenticated
  using (
    organization_id = public.current_org_id()
    and status != 'closed'
  );

create policy survey_action_plans_delete
  on public.survey_action_plans for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and status = 'open'
  );
```

---

## 3. Org-id auto-fill triggers (BEFORE INSERT)

Apply to: `surveys`, `org_survey_questions`, `org_survey_responses`, `org_survey_answers`, `survey_question_bank`, `survey_amu_reviews`, `survey_action_plans`.

Pattern (replace `[table]` for each):

```sql
create or replace function public.[table]_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

create trigger [table]_before_insert
  before insert on public.[table]
  for each row execute function public.[table]_before_insert();
```

Write out all seven triggers explicitly — do not use a loop or dynamic SQL.

---

## 4. Updated-at triggers (BEFORE UPDATE)

Apply to tables that have `updated_at`: `surveys`, `org_survey_questions`, `org_survey_responses`, `org_survey_answers`, `survey_question_bank`, `survey_amu_reviews`, `survey_action_plans`.

Pattern:
```sql
create trigger [table]_set_updated_at
  before update on public.[table]
  for each row execute function public.set_updated_at();
```

Verify `public.set_updated_at()` exists (it is used by `ros` and `inspection` tables). If it does not exist, create it:
```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
```

---

## 5. Audit triggers (AFTER INSERT OR UPDATE OR DELETE)

Apply to: `surveys`, `org_survey_responses`, `survey_amu_reviews`, `survey_action_plans`.  
(Questions and answers are high-volume; skip audit on those for performance.)

Pattern:
```sql
create trigger [table]_audit
  after insert or update or delete on public.[table]
  for each row execute function public.audit_log_change();
```

Verify `public.audit_log_change()` exists (used by AMU and ros tables). Never redefine it.

---

## Validation checklist

Before reporting done:

**Section 0 — Column additions:**
- [ ] `surveys.anonymity_threshold` added (`int not null default 5`, check > 0)
- [ ] `surveys.amu_review_required` added (`boolean not null default true`)
- [ ] `surveys.action_threshold` added (`int not null default 60`, check 0–100)
- [ ] `surveys.recurrence_months` added (nullable int, check 1–120)
- [ ] `surveys.next_scheduled_at` added (nullable timestamptz)
- [ ] `surveys.status` constraint updated to include `'archived'`
- [ ] `surveys` DELETE policy updated to allow only `status = 'draft'`
- [ ] `org_survey_questions.is_mandatory` added (boolean not null default false)
- [ ] `org_survey_questions.mandatory_law` added (nullable text with check constraint)
- [ ] Unique index on `org_survey_responses(survey_id, user_id) where user_id is not null`
- [ ] Anon SELECT policy on `surveys`
- [ ] Anon SELECT policy on `org_survey_questions`
- [ ] Anon INSERT policy on `org_survey_responses`
- [ ] Anon INSERT policy on `org_survey_answers`
- [ ] `grant` statements for anon role on all 4 tables

**Section 1–2 — New tables:**
- [ ] `survey_amu_reviews` created with `unique(survey_id)` constraint
- [ ] `survey_action_plans` created with correct `pillar` check constraint
- [ ] RLS enabled on both new tables
- [ ] UPDATE policy on `survey_amu_reviews` blocks edits when both parties signed

**Section 3–5 — Triggers:**
- [ ] Org-id triggers written for all 7 tables (verify count = 7: surveys, org_survey_questions, org_survey_responses, org_survey_answers, survey_question_bank, survey_amu_reviews, survey_action_plans)
- [ ] Updated-at triggers written for all 7 tables with `updated_at` column
- [ ] Audit triggers written for 4 tables (surveys, responses, amu_reviews, action_plans)

**General:**
- [ ] No existing table is dropped or modified in a breaking way
- [ ] Migration file is in `supabase/migrations/` (not `archive/`)
- [ ] `COMPLIANCE.md` was read before writing this migration

## Commit

```
feat(survey): migration — amu_reviews, action_plans, audit triggers
```
