-- Enterprise survey module (AML Kap. 4 — kartlegging / psykososialt arbeidsmiljø).
-- Tables: surveys, org_survey_questions, org_survey_responses, org_survey_answers, survey_question_bank
-- (org_* avoids collision with legacy survey_questions / survey_responses used by QPS-modulen.)

-- ── 1) Tables ───────────────────────────────────────────────────────────────

create table if not exists public.surveys (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  title            text not null,
  description      text,
  status           text not null default 'draft'
    check (status in ('draft', 'active', 'closed')),
  is_anonymous     boolean not null default false,
  published_at     timestamptz,
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists surveys_org_status_idx
  on public.surveys (organization_id, status, updated_at desc);

create table if not exists public.org_survey_questions (
  id               uuid primary key default gen_random_uuid(),
  survey_id        uuid not null references public.surveys (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  question_text    text not null,
  question_type    text not null
    check (question_type in ('rating_1_to_5', 'text', 'multiple_choice')),
  order_index      int not null default 0,
  is_required      boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists org_survey_questions_survey_order_idx
  on public.org_survey_questions (survey_id, order_index);

create table if not exists public.org_survey_responses (
  id               uuid primary key default gen_random_uuid(),
  survey_id        uuid not null references public.surveys (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid references auth.users (id) on delete set null,
  submitted_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists org_survey_responses_survey_idx
  on public.org_survey_responses (survey_id, submitted_at desc);

create table if not exists public.org_survey_answers (
  id               uuid primary key default gen_random_uuid(),
  response_id      uuid not null references public.org_survey_responses (id) on delete cascade,
  question_id      uuid not null references public.org_survey_questions (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  answer_value     numeric,
  answer_text      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (response_id, question_id)
);

create index if not exists org_survey_answers_org_idx
  on public.org_survey_answers (organization_id, question_id);

create table if not exists public.survey_question_bank (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  category         text not null,
  question_text    text not null,
  question_type    text not null
    check (question_type in ('rating_1_to_5', 'text', 'multiple_choice')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists survey_question_bank_org_cat_idx
  on public.survey_question_bank (organization_id, category);

-- ── 2) RLS enable ───────────────────────────────────────────────────────────

alter table public.surveys enable row level security;
alter table public.org_survey_questions enable row level security;
alter table public.org_survey_responses enable row level security;
alter table public.org_survey_answers enable row level security;
alter table public.survey_question_bank enable row level security;

-- Policies: org isolation via current_org_id() (same pattern as action_plan_items)
drop policy if exists surveys_select_org on public.surveys;
create policy surveys_select_org
  on public.surveys for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists surveys_write_org on public.surveys;
create policy surveys_write_org
  on public.surveys for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists org_survey_questions_select_org on public.org_survey_questions;
create policy org_survey_questions_select_org
  on public.org_survey_questions for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists org_survey_questions_write_org on public.org_survey_questions;
create policy org_survey_questions_write_org
  on public.org_survey_questions for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists org_survey_responses_select_org on public.org_survey_responses;
create policy org_survey_responses_select_org
  on public.org_survey_responses for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists org_survey_responses_write_org on public.org_survey_responses;
create policy org_survey_responses_write_org
  on public.org_survey_responses for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists org_survey_answers_select_org on public.org_survey_answers;
create policy org_survey_answers_select_org
  on public.org_survey_answers for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists org_survey_answers_write_org on public.org_survey_answers;
create policy org_survey_answers_write_org
  on public.org_survey_answers for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists survey_question_bank_select_org on public.survey_question_bank;
create policy survey_question_bank_select_org
  on public.survey_question_bank for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists survey_question_bank_write_org on public.survey_question_bank;
create policy survey_question_bank_write_org
  on public.survey_question_bank for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

grant select, insert, update, delete on public.surveys to authenticated;
grant select, insert, update, delete on public.org_survey_questions to authenticated;
grant select, insert, update, delete on public.org_survey_responses to authenticated;
grant select, insert, update, delete on public.org_survey_answers to authenticated;
grant select, insert, update, delete on public.survey_question_bank to authenticated;

-- ── 3) before insert: set organization_id ───────────────────────────────────

create or replace function public.surveys_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists surveys_before_insert_tg on public.surveys;
create trigger surveys_before_insert_tg
  before insert on public.surveys
  for each row execute function public.surveys_before_insert();

create or replace function public.org_survey_questions_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_status text;
begin
  select s.organization_id, s.status into v_org, v_status
  from public.surveys s
  where s.id = new.survey_id;

  if v_org is null then
    raise exception 'survey not found';
  end if;

  if new.organization_id is null then
    new.organization_id := v_org;
  elsif new.organization_id <> v_org then
    raise exception 'organization mismatch for survey question';
  end if;

  if v_status in ('active', 'closed') then
    raise exception 'cannot add questions: survey is published or closed';
  end if;

  return new;
end;
$$;

drop trigger if exists org_survey_questions_before_insert_tg on public.org_survey_questions;
create trigger org_survey_questions_before_insert_tg
  before insert on public.org_survey_questions
  for each row execute function public.org_survey_questions_before_insert();

create or replace function public.org_survey_responses_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_anon boolean;
begin
  select s.organization_id, s.is_anonymous into v_org, v_anon
  from public.surveys s
  where s.id = new.survey_id;

  if v_org is null then
    raise exception 'survey not found';
  end if;

  if new.organization_id is null then
    new.organization_id := v_org;
  elsif new.organization_id <> v_org then
    raise exception 'organization mismatch for survey response';
  end if;

  if v_anon = true then
    new.user_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists org_survey_responses_before_insert_tg on public.org_survey_responses;
create trigger org_survey_responses_before_insert_tg
  before insert on public.org_survey_responses
  for each row execute function public.org_survey_responses_before_insert();

create or replace function public.org_survey_responses_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_anon boolean;
begin
  select s.is_anonymous into v_anon
  from public.surveys s
  where s.id = new.survey_id;

  if v_anon = true then
    new.user_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists org_survey_responses_before_update_tg on public.org_survey_responses;
create trigger org_survey_responses_before_update_tg
  before update on public.org_survey_responses
  for each row execute function public.org_survey_responses_before_update();

create or replace function public.org_survey_answers_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  select r.organization_id into v_org
  from public.org_survey_responses r
  where r.id = new.response_id;

  if v_org is null then
    raise exception 'response not found';
  end if;

  if new.organization_id is null then
    new.organization_id := v_org;
  elsif new.organization_id <> v_org then
    raise exception 'organization mismatch for survey answer';
  end if;

  return new;
end;
$$;

drop trigger if exists org_survey_answers_before_insert_tg on public.org_survey_answers;
create trigger org_survey_answers_before_insert_tg
  before insert on public.org_survey_answers
  for each row execute function public.org_survey_answers_before_insert();

create or replace function public.survey_question_bank_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists survey_question_bank_before_insert_tg on public.survey_question_bank;
create trigger survey_question_bank_before_insert_tg
  before insert on public.survey_question_bank
  for each row execute function public.survey_question_bank_before_insert();

-- ── 4) Immutability: block question mutation when survey is active/closed ───

create or replace function public.org_survey_questions_block_locked()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_survey uuid;
begin
  v_survey := coalesce(new.survey_id, old.survey_id);
  select s.status into v_status from public.surveys s where s.id = v_survey;
  if v_status in ('active', 'closed') then
    raise exception 'cannot modify survey questions: survey is active or closed';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists org_survey_questions_block_locked_tg on public.org_survey_questions;
create trigger org_survey_questions_block_locked_tg
  before update or delete on public.org_survey_questions
  for each row execute function public.org_survey_questions_block_locked();

-- updated_at touch
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists surveys_touch_updated_at on public.surveys;
create trigger surveys_touch_updated_at
  before update on public.surveys
  for each row execute function public.touch_updated_at();

drop trigger if exists org_survey_questions_touch_updated_at on public.org_survey_questions;
create trigger org_survey_questions_touch_updated_at
  before update on public.org_survey_questions
  for each row execute function public.touch_updated_at();

drop trigger if exists org_survey_responses_touch_updated_at on public.org_survey_responses;
create trigger org_survey_responses_touch_updated_at
  before update on public.org_survey_responses
  for each row execute function public.touch_updated_at();

drop trigger if exists org_survey_answers_touch_updated_at on public.org_survey_answers;
create trigger org_survey_answers_touch_updated_at
  before update on public.org_survey_answers
  for each row execute function public.touch_updated_at();

drop trigger if exists survey_question_bank_touch_updated_at on public.survey_question_bank;
create trigger survey_question_bank_touch_updated_at
  before update on public.survey_question_bank
  for each row execute function public.touch_updated_at();

-- ── 5) Workflow: DB events (module survey) ───────────────────────────────────

create or replace function public.trg_surveys_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'UPDATE' then
    if new.status = 'active' and old.status is distinct from 'active' then
      perform public.workflow_dispatch_db_event(
        new.organization_id, 'survey', 'ON_SURVEY_PUBLISHED', to_jsonb(new)
      );
    end if;
    if new.status = 'closed' and old.status is distinct from 'closed' then
      perform public.workflow_dispatch_db_event(
        new.organization_id, 'survey', 'ON_SURVEY_CLOSED', to_jsonb(new)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists surveys_workflow_tg on public.surveys;
create trigger surveys_workflow_tg
  after update of status on public.surveys
  for each row execute function public.trg_surveys_workflow();

create or replace function public.trg_org_survey_responses_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.surveys where id = new.survey_id;
  if v_org is not null then
    perform public.workflow_dispatch_db_event(
      v_org, 'survey', 'ON_SURVEY_RESPONSE_SUBMITTED', to_jsonb(new)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists org_survey_responses_workflow_tg on public.org_survey_responses;
create trigger org_survey_responses_workflow_tg
  after insert on public.org_survey_responses
  for each row execute function public.trg_org_survey_responses_workflow();

-- Optional: client-side replay / tests — same dispatcher as triggers
create or replace function public.workflow_dispatch_survey_event(
  p_organization_id uuid,
  p_event text,
  p_survey_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  if p_organization_id is distinct from public.current_org_id() then
    raise exception 'organization mismatch';
  end if;

  if not (public.is_org_admin() or public.user_has_permission('survey.manage')) then
    raise exception 'permission denied';
  end if;

  select * into v_row from public.surveys
  where id = p_survey_id and organization_id = p_organization_id;

  if v_row.id is null then
    raise exception 'survey not found';
  end if;

  perform public.workflow_dispatch_db_event(
    p_organization_id, 'survey', p_event, to_jsonb(v_row)
  );
end;
$$;

grant execute on function public.workflow_dispatch_survey_event(uuid, text, uuid) to authenticated;

-- ── 6) App permission: survey.manage ────────────────────────────────────────

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'survey.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;
