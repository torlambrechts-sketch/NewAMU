-- Survey distributions: target audiences + per-recipient invitation rows for tracking.

create table if not exists public.survey_distributions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  survey_id        uuid not null references public.surveys (id) on delete cascade,
  label            text,
  audience_type    text not null default 'all'
    check (audience_type in ('all', 'departments')),
  audience_department_ids uuid[] default '{}'::uuid[],
  status           text not null default 'draft'
    check (status in ('draft', 'generated', 'completed', 'cancelled')),
  invite_count     int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id)
);

create index if not exists survey_distributions_survey_idx
  on public.survey_distributions (survey_id, created_at desc);

alter table public.survey_distributions enable row level security;

drop policy if exists survey_distributions_select on public.survey_distributions;
create policy survey_distributions_select
  on public.survey_distributions for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists survey_distributions_insert on public.survey_distributions;
create policy survey_distributions_insert
  on public.survey_distributions for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists survey_distributions_update on public.survey_distributions;
create policy survey_distributions_update
  on public.survey_distributions for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists survey_distributions_delete on public.survey_distributions;
create policy survey_distributions_delete
  on public.survey_distributions for delete to authenticated
  using (organization_id = public.current_org_id());

grant select, insert, update, delete on public.survey_distributions to authenticated;

create table if not exists public.survey_invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  survey_id        uuid not null references public.surveys (id) on delete cascade,
  distribution_id  uuid not null references public.survey_distributions (id) on delete cascade,
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  department_id    uuid references public.departments (id) on delete set null,
  email_snapshot   text,
  status           text not null default 'pending'
    check (status in ('pending', 'completed')),
  response_id      uuid references public.org_survey_responses (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (distribution_id, profile_id)
);

create index if not exists survey_invitations_distribution_idx
  on public.survey_invitations (distribution_id);

create index if not exists survey_invitations_survey_idx
  on public.survey_invitations (survey_id, status);

alter table public.survey_invitations enable row level security;

drop policy if exists survey_invitations_select on public.survey_invitations;
create policy survey_invitations_select
  on public.survey_invitations for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists survey_invitations_insert on public.survey_invitations;
create policy survey_invitations_insert
  on public.survey_invitations for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists survey_invitations_update on public.survey_invitations;
create policy survey_invitations_update
  on public.survey_invitations for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists survey_invitations_delete on public.survey_invitations;
create policy survey_invitations_delete
  on public.survey_invitations for delete to authenticated
  using (organization_id = public.current_org_id());

grant select, insert, update, delete on public.survey_invitations to authenticated;

-- set_updated_at (from core migrations) — skip if not deployed
do $u$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    execute 'drop trigger if exists survey_distributions_set_updated_at on public.survey_distributions';
    execute $t$
      create trigger survey_distributions_set_updated_at
        before update on public.survey_distributions
        for each row execute function public.set_updated_at()
    $t$;
    execute 'drop trigger if exists survey_invitations_set_updated_at on public.survey_invitations';
    execute $t$
      create trigger survey_invitations_set_updated_at
        before update on public.survey_invitations
        for each row execute function public.set_updated_at()
    $t$;
  end if;
end
$u$;

select pg_notify('pgrst', 'reload schema');
