-- Survey module additions: compliance columns, AMU review + action plans, anon RLS,
-- org auto-fill, updated_at, audit (audit_log_change, aligned with hse_audit_log).
-- Additive only — requires prior migration 20260730130000_enterprise_survey_module.sql
-- (archived copy also kept under migrations/archive/ for reference).

-- ── 0a. surveys — compliance columns + status 'archived' ----------------------------

alter table public.surveys
  add column if not exists anonymity_threshold int not null default 5
    check (anonymity_threshold > 0),
  add column if not exists amu_review_required boolean not null default true,
  add column if not exists action_threshold int not null default 60
    check (action_threshold between 0 and 100),
  add column if not exists recurrence_months int
    check (recurrence_months is null or recurrence_months between 1 and 120),
  add column if not exists next_scheduled_at timestamptz;

alter table public.surveys
  drop constraint if exists surveys_status_check;

alter table public.surveys
  add constraint surveys_status_check
  check (status in ('draft', 'active', 'closed', 'archived'));

-- Replace broad write-all policy: DELETE only for drafts; split insert/update
drop policy if exists surveys_write_org on public.surveys;
drop policy if exists surveys_delete_org on public.surveys;
drop policy if exists surveys_insert_org on public.surveys;
drop policy if exists surveys_update_org on public.surveys;

create policy surveys_insert_org
  on public.surveys for insert to authenticated
  with check (organization_id = public.current_org_id());

create policy surveys_update_org
  on public.surveys for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create policy surveys_delete_org
  on public.surveys for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and status = 'draft'
  );

-- 0b. org_survey_questions — mandatory question tracking
alter table public.org_survey_questions
  add column if not exists is_mandatory boolean not null default false,
  add column if not exists mandatory_law text
    check (mandatory_law is null or mandatory_law in ('AML_4_3', 'AML_4_4', 'AML_6_2'));

-- 0c. Unique: one response per user per survey when identified
create unique index if not exists org_survey_responses_user_survey_uidx
  on public.org_survey_responses (survey_id, user_id)
  where user_id is not null;

-- 0d. Anon (public) respondent access
drop policy if exists surveys_select_anon on public.surveys;
create policy surveys_select_anon
  on public.surveys for select to anon
  using (
    status = 'active'
    and organization_id is not null
  );

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

drop policy if exists org_survey_answers_insert_anon on public.org_survey_answers;
create policy org_survey_answers_insert_anon
  on public.org_survey_answers for insert to anon
  with check (
    exists (
      select 1
      from public.org_survey_responses r
        join public.surveys s on s.id = r.survey_id
      where r.id = response_id
        and s.status = 'active'
        and r.organization_id = org_survey_answers.organization_id
    )
  );

grant usage on schema public to anon;
grant select on public.surveys to anon;
grant select on public.org_survey_questions to anon;
grant insert on public.org_survey_responses to anon;
grant insert on public.org_survey_answers to anon;

-- ── 1. survey_amu_reviews ---------------------------------------------------------
create table if not exists public.survey_amu_reviews (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  survey_id             uuid not null references public.surveys (id) on delete cascade,
  meeting_date          date,
  agenda_item           text,
  protocol_text         text,
  amu_chair_name        text,
  amu_chair_signed_at   timestamptz,
  vo_name               text,
  vo_signed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id),
  unique (survey_id)
);

create index if not exists survey_amu_reviews_org_idx
  on public.survey_amu_reviews (organization_id, survey_id);

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
    and (amu_chair_signed_at is null or vo_signed_at is null)
  );

grant select, insert, update, delete on public.survey_amu_reviews to authenticated;

-- ── 2. survey_action_plans ----------------------------------------------------------
create table if not exists public.survey_action_plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  survey_id       uuid not null references public.surveys (id) on delete cascade,
  category        text not null,
  pillar          text not null
    check (pillar in ('psychosocial', 'physical', 'organization', 'safety_culture', 'custom')),
  title           text not null,
  description     text,
  score           numeric,
  status          text not null default 'open'
    check (status in ('open', 'in_progress', 'closed')),
  responsible     text,
  due_date        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id)
);

create index if not exists survey_action_plans_survey_status_idx
  on public.survey_action_plans (survey_id, status);

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

grant select, insert, update, delete on public.survey_action_plans to authenticated;

-- ── 3. audit_log_change (append-only hse_audit_log; body aligned with hse_audit_trigger)
create or replace function public.audit_log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed_fields text[];
  v_old jsonb := null;
  v_new jsonb := null;
begin
  if TG_OP = 'INSERT' then
    v_new := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    select coalesce(array_agg(key order by key), '{}'::text[]) into v_changed_fields
    from jsonb_each(v_old) o
    join jsonb_each(v_new) n using (key)
    where o.value is distinct from n.value;
  elsif TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
  end if;

  insert into public.hse_audit_log
    (organization_id, table_name, record_id, action, changed_by,
     old_data, new_data, changed_fields)
  values (
    coalesce(
      (v_new->>'organization_id')::uuid,
      (v_old->>'organization_id')::uuid
    ),
    TG_TABLE_NAME,
    coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid),
    TG_OP,
    auth.uid(),
    v_old,
    v_new,
    v_changed_fields
  );

  return coalesce(NEW, OLD);
end;
$$;

-- ── 3b. set_updated_at (idempotent; matches ros / inspection)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── 3c. before insert: new tables (simple org id auto-fill) --------------------------
create or replace function public.survey_amu_reviews_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists survey_amu_reviews_before_insert on public.survey_amu_reviews;
create trigger survey_amu_reviews_before_insert
  before insert on public.survey_amu_reviews
  for each row execute function public.survey_amu_reviews_before_insert();

create or replace function public.survey_action_plans_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists survey_action_plans_before_insert on public.survey_action_plans;
create trigger survey_action_plans_before_insert
  before insert on public.survey_action_plans
  for each row execute function public.survey_action_plans_before_insert();

-- Standardize trigger names for existing five tables (functions unchanged for org_*)
drop trigger if exists surveys_before_insert_tg on public.surveys;
create trigger surveys_before_insert
  before insert on public.surveys
  for each row execute function public.surveys_before_insert();

drop trigger if exists org_survey_questions_before_insert_tg on public.org_survey_questions;
create trigger org_survey_questions_before_insert
  before insert on public.org_survey_questions
  for each row execute function public.org_survey_questions_before_insert();

drop trigger if exists org_survey_responses_before_insert_tg on public.org_survey_responses;
create trigger org_survey_responses_before_insert
  before insert on public.org_survey_responses
  for each row execute function public.org_survey_responses_before_insert();

drop trigger if exists org_survey_answers_before_insert_tg on public.org_survey_answers;
create trigger org_survey_answers_before_insert
  before insert on public.org_survey_answers
  for each row execute function public.org_survey_answers_before_insert();

drop trigger if exists survey_question_bank_before_insert_tg on public.survey_question_bank;
create trigger survey_question_bank_before_insert
  before insert on public.survey_question_bank
  for each row execute function public.survey_question_bank_before_insert();

-- ── 4. updated_at: set_updated_at on all seven tables -----------------------------
drop trigger if exists survey_amu_reviews_set_updated_at on public.survey_amu_reviews;
drop trigger if exists survey_action_plans_set_updated_at on public.survey_action_plans;
drop trigger if exists surveys_set_updated_at on public.surveys;
drop trigger if exists org_survey_questions_set_updated_at on public.org_survey_questions;
drop trigger if exists org_survey_responses_set_updated_at on public.org_survey_responses;
drop trigger if exists org_survey_answers_set_updated_at on public.org_survey_answers;
drop trigger if exists survey_question_bank_set_updated_at on public.survey_question_bank;
drop trigger if exists surveys_touch_updated_at on public.surveys;
create trigger surveys_set_updated_at
  before update on public.surveys
  for each row execute function public.set_updated_at();

drop trigger if exists org_survey_questions_touch_updated_at on public.org_survey_questions;
create trigger org_survey_questions_set_updated_at
  before update on public.org_survey_questions
  for each row execute function public.set_updated_at();

drop trigger if exists org_survey_responses_touch_updated_at on public.org_survey_responses;
create trigger org_survey_responses_set_updated_at
  before update on public.org_survey_responses
  for each row execute function public.set_updated_at();

drop trigger if exists org_survey_answers_touch_updated_at on public.org_survey_answers;
create trigger org_survey_answers_set_updated_at
  before update on public.org_survey_answers
  for each row execute function public.set_updated_at();

drop trigger if exists survey_question_bank_touch_updated_at on public.survey_question_bank;
create trigger survey_question_bank_set_updated_at
  before update on public.survey_question_bank
  for each row execute function public.set_updated_at();

create trigger survey_amu_reviews_set_updated_at
  before update on public.survey_amu_reviews
  for each row execute function public.set_updated_at();

create trigger survey_action_plans_set_updated_at
  before update on public.survey_action_plans
  for each row execute function public.set_updated_at();

-- ── 5. audit triggers (core survey tables; questions/answers skipped) ------------
drop trigger if exists surveys_audit on public.surveys;
create trigger surveys_audit
  after insert or update or delete on public.surveys
  for each row execute function public.audit_log_change();

drop trigger if exists org_survey_responses_audit on public.org_survey_responses;
create trigger org_survey_responses_audit
  after insert or update or delete on public.org_survey_responses
  for each row execute function public.audit_log_change();

drop trigger if exists survey_amu_reviews_audit on public.survey_amu_reviews;
create trigger survey_amu_reviews_audit
  after insert or update or delete on public.survey_amu_reviews
  for each row execute function public.audit_log_change();

drop trigger if exists survey_action_plans_audit on public.survey_action_plans;
create trigger survey_action_plans_audit
  after insert or update or delete on public.survey_action_plans
  for each row execute function public.audit_log_change();
