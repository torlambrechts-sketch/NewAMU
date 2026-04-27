# Step 1 — DB Migration: Additions & Audit Wiring

Create file: `supabase/migrations/20260801100000_survey_additions.sql`

## Context

The core survey tables already exist in `supabase/migrations/archive/20260730130000_enterprise_survey_module.sql`:
- `surveys` — campaign header
- `org_survey_questions` — per-survey questions
- `org_survey_responses` — respondent submissions
- `org_survey_answers` — per-question answers within a response
- `survey_question_bank` — reusable question library

This migration is **additive only**. Do NOT recreate existing tables.

What is missing and must be added:
1. `survey_amu_reviews` — protocol + dual sign-off for AMU review (AML § 7-2)
2. `survey_action_plans` — auto-generated action items for low-scoring categories
3. Audit triggers on every survey table (reuse `public.audit_log_change()`)
4. Org-id auto-fill BEFORE INSERT triggers on every survey table
5. `updated_at` BEFORE UPDATE triggers on every survey table that has `updated_at`

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
- [ ] `survey_amu_reviews` created with `unique(survey_id)` constraint
- [ ] `survey_action_plans` created with correct `pillar` check constraint
- [ ] RLS enabled on both new tables
- [ ] Org-id triggers written for all 7 tables (verify count = 7)
- [ ] Updated-at triggers written for all 7 tables with `updated_at` column
- [ ] Audit triggers written for 4 tables (surveys, responses, amu_reviews, action_plans)
- [ ] No existing table is dropped or modified
- [ ] Migration file is in `supabase/migrations/` (not `archive/`)

## Commit

```
feat(survey): migration — amu_reviews, action_plans, audit triggers
```
