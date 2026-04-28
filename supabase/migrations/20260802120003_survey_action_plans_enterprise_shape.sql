-- Repair: legacy `survey_action_plans` used `campaign_id` (old QPS-style module).
-- Enterprise UI expects `survey_id` → public.surveys. `CREATE TABLE IF NOT EXISTS` in
-- 20260801100000 skipped creation when the legacy table already existed.
-- Drops only when `survey_id` is missing; then ensures enterprise table + RLS exist.

do $repair$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'survey_action_plans'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'survey_action_plans'
      and column_name = 'survey_id'
  ) then
    execute 'drop table public.survey_action_plans cascade';
  end if;
end;
$repair$;

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

drop policy if exists survey_action_plans_select on public.survey_action_plans;
create policy survey_action_plans_select
  on public.survey_action_plans for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists survey_action_plans_insert on public.survey_action_plans;
create policy survey_action_plans_insert
  on public.survey_action_plans for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists survey_action_plans_update on public.survey_action_plans;
create policy survey_action_plans_update
  on public.survey_action_plans for update to authenticated
  using (
    organization_id = public.current_org_id()
    and status != 'closed'
  );

drop policy if exists survey_action_plans_delete on public.survey_action_plans;
create policy survey_action_plans_delete
  on public.survey_action_plans for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and status = 'open'
  );

grant select, insert, update, delete on public.survey_action_plans to authenticated;

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

drop trigger if exists survey_action_plans_set_updated_at on public.survey_action_plans;
create trigger survey_action_plans_set_updated_at
  before update on public.survey_action_plans
  for each row execute function public.set_updated_at();

drop trigger if exists survey_action_plans_audit on public.survey_action_plans;
create trigger survey_action_plans_audit
  after insert or update or delete on public.survey_action_plans
  for each row execute function public.audit_log_change();

notify pgrst, 'reload schema';
