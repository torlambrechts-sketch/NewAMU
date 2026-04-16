-- First-class custom report definitions (CRUD + optimistic version) and schedule stubs.

create table if not exists public.report_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  definition jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_definitions_org_updated_idx
  on public.report_definitions (organization_id, updated_at desc);

comment on table public.report_definitions is
  'Custom report templates (modules JSON). `version` increments on each successful save for optimistic locking.';

drop trigger if exists report_definitions_set_updated_at on public.report_definitions;
create trigger report_definitions_set_updated_at
  before update on public.report_definitions
  for each row execute function public.set_updated_at();

alter table public.report_definitions enable row level security;

drop policy if exists report_definitions_select_org on public.report_definitions;
create policy report_definitions_select_org
  on public.report_definitions for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists report_definitions_insert_org on public.report_definitions;
create policy report_definitions_insert_org
  on public.report_definitions for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists report_definitions_update_org on public.report_definitions;
create policy report_definitions_update_org
  on public.report_definitions for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists report_definitions_delete_org on public.report_definitions;
create policy report_definitions_delete_org
  on public.report_definitions for delete to authenticated
  using (organization_id = public.current_org_id());

grant select, insert, update, delete on public.report_definitions to authenticated;

-- Atomic save: bump version only when expected_version matches (prevents lost updates).

create or replace function public.report_definition_save(
  p_id uuid,
  p_org_id uuid,
  p_name text,
  p_definition jsonb,
  p_expected_version int
)
returns table (ok boolean, new_version int, err text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_next int;
begin
  if v_uid is null then
    return query select false, null::int, 'Not authenticated'::text;
    return;
  end if;
  if (select organization_id from public.profiles where id = v_uid) is distinct from p_org_id then
    return query select false, null::int, 'Not allowed'::text;
    return;
  end if;

  if p_expected_version is null or p_expected_version < 1 then
    return query select false, null::int, 'Invalid version'::text;
    return;
  end if;

  update public.report_definitions d
  set
    name = p_name,
    definition = p_definition,
    version = d.version + 1,
    updated_at = now()
  where d.id = p_id
    and d.organization_id = p_org_id
    and d.version = p_expected_version
  returning d.version into v_next;

  if v_next is null then
    return query select false, null::int, 'stale_version'::text;
    return;
  end if;

  return query select true, v_next, null::text;
end;
$$;

grant execute on function public.report_definition_save(uuid, uuid, text, jsonb, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Schedule stubs (no worker yet): CRUD only.
-- ---------------------------------------------------------------------------

create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  report_definition_id uuid not null references public.report_definitions (id) on delete cascade,
  title text not null default '',
  cron_expr text not null default '0 8 1 * *',
  timezone text not null default 'Europe/Oslo',
  enabled boolean not null default false,
  channel text not null default 'email' check (channel in ('email', 'webhook')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_schedules_org_idx
  on public.report_schedules (organization_id, enabled, updated_at desc);

comment on table public.report_schedules is
  'Saved report delivery schedules (stub). Execution/dispatch is not implemented yet.';

drop trigger if exists report_schedules_set_updated_at on public.report_schedules;
create trigger report_schedules_set_updated_at
  before update on public.report_schedules
  for each row execute function public.set_updated_at();

alter table public.report_schedules enable row level security;

drop policy if exists report_schedules_select_org on public.report_schedules;
create policy report_schedules_select_org
  on public.report_schedules for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists report_schedules_insert_org on public.report_schedules;
create policy report_schedules_insert_org
  on public.report_schedules for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists report_schedules_update_org on public.report_schedules;
create policy report_schedules_update_org
  on public.report_schedules for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists report_schedules_delete_org on public.report_schedules;
create policy report_schedules_delete_org
  on public.report_schedules for delete to authenticated
  using (organization_id = public.current_org_id());

grant select, insert, update, delete on public.report_schedules to authenticated;

-- One-time import from legacy `org_module_payloads.report_builder` when the org has no rows yet.

insert into public.report_definitions (organization_id, name, definition, version, created_by)
select
  p.organization_id,
  coalesce(nullif(trim(elem->>'name'), ''), 'Uten navn'),
  jsonb_build_object('modules', coalesce(elem->'modules', '[]'::jsonb)),
  1,
  null
from public.org_module_payloads p,
  lateral jsonb_array_elements(coalesce(p.payload->'templates', '[]'::jsonb)) as elem
where p.module_key = 'report_builder'
  and jsonb_typeof(coalesce(p.payload->'templates', '[]'::jsonb)) = 'array'
  and not exists (
    select 1 from public.report_definitions d where d.organization_id = p.organization_id
  );
