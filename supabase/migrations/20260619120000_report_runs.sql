-- Durable report run log (standard + custom) for audit and UI history.

create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  run_at timestamptz not null default now(),
  kind text not null check (kind in ('standard', 'custom')),
  standard_report_id text,
  custom_template_id text,
  title text not null,
  report_year int,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists report_runs_org_run_at_idx
  on public.report_runs (organization_id, run_at desc);

create index if not exists report_runs_org_user_idx
  on public.report_runs (organization_id, user_id, run_at desc);

comment on table public.report_runs is
  'Append-only log of report executions (who ran what, when). Filled from the app after successful runs.';

alter table public.report_runs enable row level security;

drop policy if exists report_runs_select_org on public.report_runs;
create policy report_runs_select_org
  on public.report_runs
  for select
  to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists report_runs_insert_self on public.report_runs;
create policy report_runs_insert_self
  on public.report_runs
  for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  );

grant select, insert on public.report_runs to authenticated;

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'reports.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;
