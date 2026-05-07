-- Repair: legacy survey_amu_reviews used campaign_id; app expects survey_id → public.surveys.
-- Same pattern as 20260802120003_survey_action_plans_enterprise_shape.sql.

do $repair$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'survey_amu_reviews'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'survey_amu_reviews'
      and column_name = 'survey_id'
  ) then
    execute 'drop table public.survey_amu_reviews cascade';
  end if;
end;
$repair$;

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

drop policy if exists survey_amu_reviews_select on public.survey_amu_reviews;
create policy survey_amu_reviews_select
  on public.survey_amu_reviews for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists survey_amu_reviews_insert on public.survey_amu_reviews;
create policy survey_amu_reviews_insert
  on public.survey_amu_reviews for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists survey_amu_reviews_update on public.survey_amu_reviews;
create policy survey_amu_reviews_update
  on public.survey_amu_reviews for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (amu_chair_signed_at is null or vo_signed_at is null)
  );

drop policy if exists survey_amu_reviews_delete on public.survey_amu_reviews;
create policy survey_amu_reviews_delete
  on public.survey_amu_reviews for delete to authenticated
  using (organization_id = public.current_org_id());

grant select, insert, update, delete on public.survey_amu_reviews to authenticated;

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

do $trig$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
      and pg_function_is_visible(p.oid)
  ) then
    execute 'drop trigger if exists survey_amu_reviews_set_updated_at on public.survey_amu_reviews';
    execute '
      create trigger survey_amu_reviews_set_updated_at
        before update on public.survey_amu_reviews
        for each row execute function public.set_updated_at()';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'audit_log_change'
      and pg_function_is_visible(p.oid)
  ) then
    execute 'drop trigger if exists survey_amu_reviews_audit on public.survey_amu_reviews';
    execute '
      create trigger survey_amu_reviews_audit
        after insert or update or delete on public.survey_amu_reviews
        for each row execute function public.audit_log_change()';
  end if;
end;
$trig$;

notify pgrst, 'reload schema';
