-- Phase 3: Relational inspection module + workflow handoff.
-- Adds inspection tables, strict sign-off invariants, and workflow processing for critical findings.

alter table public.org_module_payloads drop constraint if exists org_module_payloads_key_chk;

alter table public.org_module_payloads add constraint org_module_payloads_key_chk check (
  module_key in (
    'internal_control',
    'hse',
    'org_health',
    'representatives',
    'tasks',
    'organisation',
    'cost_settings',
    'workspace',
    'report_builder',
    'workplace_reporting',
    'workplace_dashboard',
    'inspection'
  )
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inspection_round_status') then
    create type public.inspection_round_status as enum ('draft', 'active', 'signed');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inspection_finding_severity') then
    create type public.inspection_finding_severity as enum ('low', 'medium', 'high', 'critical');
  end if;
end $$;

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null,
  display_name text not null,
  is_active boolean not null default true,
  required_permissions jsonb not null default '[]'::jsonb,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

-- Compatibility: if a legacy `modules` table exists without tenant scoping,
-- progressively add missing columns so this migration can still run.
alter table public.modules add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.modules add column if not exists slug text;
alter table public.modules add column if not exists display_name text;
alter table public.modules add column if not exists is_active boolean default true;
alter table public.modules add column if not exists required_permissions jsonb default '[]'::jsonb;
alter table public.modules add column if not exists config jsonb default '{}'::jsonb;
alter table public.modules add column if not exists created_at timestamptz default now();
alter table public.modules add column if not exists updated_at timestamptz default now();

-- Legacy deployments may have old policies referencing `required_permissions`.
-- Drop defensively before type coercion to avoid dependency errors.
drop policy if exists "modules_select_active_permitted" on public.modules;
drop policy if exists "modules_select_org" on public.modules;
drop policy if exists "modules_write_org_admin" on public.modules;

do $$
declare
  v_required_permissions_type text;
begin
  select a.udt_name
  into v_required_permissions_type
  from information_schema.columns a
  where a.table_schema = 'public'
    and a.table_name = 'modules'
    and a.column_name = 'required_permissions';

  if v_required_permissions_type = '_text' then
    execute $sql$
      alter table public.modules
      alter column required_permissions drop default
    $sql$;
    execute $sql$
      alter table public.modules
      alter column required_permissions
      type jsonb
      using to_jsonb(required_permissions)
    $sql$;
    execute $sql$
      alter table public.modules
      alter column required_permissions set default '[]'::jsonb
    $sql$;
  elsif v_required_permissions_type = 'text' then
    execute $sql$
      alter table public.modules
      alter column required_permissions drop default
    $sql$;
    execute $sql$
      alter table public.modules
      alter column required_permissions
      type jsonb
      using (
        case
          when required_permissions is null or btrim(required_permissions) = '' then '[]'::jsonb
          when left(btrim(required_permissions), 1) = '[' then required_permissions::jsonb
          else to_jsonb(string_to_array(required_permissions, ','))
        end
      )
    $sql$;
    execute $sql$
      alter table public.modules
      alter column required_permissions set default '[]'::jsonb
    $sql$;
  end if;
end $$;

update public.modules
set
  display_name = coalesce(nullif(display_name, ''), initcap(replace(coalesce(slug, 'module'), '-', ' '))),
  is_active = coalesce(is_active, true),
  required_permissions = coalesce(required_permissions, '[]'::jsonb),
  config = coalesce(config, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where
  display_name is null
  or is_active is null
  or required_permissions is null
  or config is null
  or created_at is null
  or updated_at is null;

do $$
declare
  v_org_id uuid;
begin
  -- If modules are global/legacy and there is exactly one org, bind rows to it.
  if exists (select 1 from public.modules where organization_id is null) then
    if (select count(*) from public.organizations) = 1 then
      select id into v_org_id from public.organizations limit 1;
      update public.modules
      set organization_id = v_org_id
      where organization_id is null;
    end if;
  end if;
end $$;

-- Keep one row per (organization_id, slug) before enforcing uniqueness.
delete from public.modules m
using (
  select ctid
  from (
    select
      ctid,
      row_number() over (
        partition by organization_id, slug
        order by updated_at desc nulls last, created_at desc nulls last
      ) as rn
    from public.modules
    where organization_id is not null and slug is not null
  ) ranked
  where ranked.rn > 1
) d
where m.ctid = d.ctid;

create unique index if not exists modules_org_slug_unique_idx on public.modules (organization_id, slug);

create index if not exists modules_org_slug_idx on public.modules (organization_id, slug);
create index if not exists modules_org_active_idx on public.modules (organization_id, is_active);

drop trigger if exists modules_set_updated_at on public.modules;
create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();

create table if not exists public.deviations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source text not null default 'inspection',
  source_id uuid,
  title text not null,
  description text not null default '',
  severity public.inspection_finding_severity not null default 'medium',
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  due_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility for legacy deviations table variants.
alter table public.deviations add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.deviations add column if not exists source text default 'inspection';
alter table public.deviations add column if not exists source_id uuid;
alter table public.deviations add column if not exists title text;
alter table public.deviations add column if not exists description text default '';
alter table public.deviations add column if not exists severity public.inspection_finding_severity default 'medium';
alter table public.deviations add column if not exists status text default 'open';
alter table public.deviations add column if not exists due_at timestamptz;
alter table public.deviations add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.deviations add column if not exists created_at timestamptz default now();
alter table public.deviations add column if not exists updated_at timestamptz default now();

update public.deviations
set
  source = coalesce(nullif(source, ''), 'inspection'),
  description = coalesce(description, ''),
  status = coalesce(nullif(status, ''), 'open'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where
  source is null
  or description is null
  or status is null
  or created_at is null
  or updated_at is null;

create index if not exists deviations_org_status_idx on public.deviations (organization_id, status, created_at desc);
create index if not exists deviations_org_source_idx on public.deviations (organization_id, source, source_id);

drop trigger if exists deviations_set_updated_at on public.deviations;
create trigger deviations_set_updated_at
  before update on public.deviations
  for each row execute function public.set_updated_at();

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source text not null default 'inspection',
  source_id uuid,
  title text not null,
  description text not null default '',
  assigned_to uuid references auth.users (id) on delete set null,
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility for legacy tasks table variants.
alter table public.tasks add column if not exists organization_id uuid references public.organizations (id) on delete cascade;
alter table public.tasks add column if not exists source text default 'inspection';
alter table public.tasks add column if not exists source_id uuid;
alter table public.tasks add column if not exists title text;
alter table public.tasks add column if not exists description text default '';
alter table public.tasks add column if not exists assigned_to uuid references auth.users (id) on delete set null;
alter table public.tasks add column if not exists due_at timestamptz;
alter table public.tasks add column if not exists status text default 'todo';
alter table public.tasks add column if not exists priority text default 'normal';
alter table public.tasks add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.tasks add column if not exists created_at timestamptz default now();
alter table public.tasks add column if not exists updated_at timestamptz default now();

update public.tasks
set
  source = coalesce(nullif(source, ''), 'inspection'),
  description = coalesce(description, ''),
  status = coalesce(nullif(status, ''), 'todo'),
  priority = coalesce(nullif(priority, ''), 'normal'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where
  source is null
  or description is null
  or status is null
  or priority is null
  or created_at is null
  or updated_at is null;

create index if not exists tasks_org_status_idx on public.tasks (organization_id, status, due_at);
create index if not exists tasks_org_source_idx on public.tasks (organization_id, source, source_id);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create table if not exists public.inspection_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  checklist_definition jsonb not null default '{"items":[]}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inspection_templates_org_active_idx
  on public.inspection_templates (organization_id, is_active, updated_at desc);

drop trigger if exists inspection_templates_set_updated_at on public.inspection_templates;
create trigger inspection_templates_set_updated_at
  before update on public.inspection_templates
  for each row execute function public.set_updated_at();

create table if not exists public.inspection_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_code text,
  name text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inspection_locations_org_active_idx
  on public.inspection_locations (organization_id, is_active, name);

drop trigger if exists inspection_locations_set_updated_at on public.inspection_locations;
create trigger inspection_locations_set_updated_at
  before update on public.inspection_locations
  for each row execute function public.set_updated_at();

create table if not exists public.inspection_rounds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid not null references public.inspection_templates (id) on delete restrict,
  location_id uuid references public.inspection_locations (id) on delete set null,
  title text not null,
  scheduled_for timestamptz,
  cron_expression text,
  assigned_to uuid references auth.users (id) on delete set null,
  status public.inspection_round_status not null default 'draft',
  completed_at timestamptz,
  signed_off_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'signed' and completed_at is not null and signed_off_by is not null)
    or (status <> 'signed')
  )
);

create index if not exists inspection_rounds_org_status_idx
  on public.inspection_rounds (organization_id, status, scheduled_for desc);
create index if not exists inspection_rounds_org_template_idx
  on public.inspection_rounds (organization_id, template_id, created_at desc);
create index if not exists inspection_rounds_org_assigned_idx
  on public.inspection_rounds (organization_id, assigned_to, status);

drop trigger if exists inspection_rounds_set_updated_at on public.inspection_rounds;
create trigger inspection_rounds_set_updated_at
  before update on public.inspection_rounds
  for each row execute function public.set_updated_at();

create or replace function public.inspection_rounds_status_guard()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'signed' and new.status <> 'signed' then
    raise exception 'Signed rounds are immutable and cannot transition away from signed status';
  end if;
  if old.status = 'signed' then
    if new.title is distinct from old.title
      or new.template_id is distinct from old.template_id
      or new.location_id is distinct from old.location_id
      or new.scheduled_for is distinct from old.scheduled_for
      or new.cron_expression is distinct from old.cron_expression
      or new.assigned_to is distinct from old.assigned_to
      or new.completed_at is distinct from old.completed_at
      or new.signed_off_by is distinct from old.signed_off_by
    then
      raise exception 'Signed rounds are immutable';
    end if;
  end if;
  if new.status = 'signed' and (new.completed_at is null or new.signed_off_by is null) then
    raise exception 'Signed rounds require completed_at and signed_off_by';
  end if;
  return new;
end;
$$;

drop trigger if exists inspection_rounds_status_guard_tg on public.inspection_rounds;
create trigger inspection_rounds_status_guard_tg
  before update on public.inspection_rounds
  for each row execute function public.inspection_rounds_status_guard();

create or replace function public.inspection_rounds_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists inspection_rounds_before_insert_defaults_tg on public.inspection_rounds;
create trigger inspection_rounds_before_insert_defaults_tg
  before insert on public.inspection_rounds
  for each row execute function public.inspection_rounds_before_insert_defaults();

create or replace function public.inspection_rounds_before_update_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'signed' and old.status <> 'signed' then
    if new.completed_at is null then
      new.completed_at := now();
    end if;
    if new.signed_off_by is null then
      new.signed_off_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists inspection_rounds_before_update_defaults_tg on public.inspection_rounds;
create trigger inspection_rounds_before_update_defaults_tg
  before update on public.inspection_rounds
  for each row execute function public.inspection_rounds_before_update_defaults();

create table if not exists public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  round_id uuid not null references public.inspection_rounds (id) on delete cascade,
  checklist_item_key text not null,
  checklist_item_label text not null,
  position int not null default 0,
  response jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  notes text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, checklist_item_key)
);

create index if not exists inspection_items_round_idx
  on public.inspection_items (round_id, position);
create index if not exists inspection_items_org_round_idx
  on public.inspection_items (organization_id, round_id);

drop trigger if exists inspection_items_set_updated_at on public.inspection_items;
create trigger inspection_items_set_updated_at
  before update on public.inspection_items
  for each row execute function public.set_updated_at();

create table if not exists public.inspection_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  round_id uuid not null references public.inspection_rounds (id) on delete cascade,
  item_id uuid references public.inspection_items (id) on delete set null,
  description text not null,
  severity public.inspection_finding_severity not null,
  photo_path text,
  created_by uuid references auth.users (id) on delete set null,
  deviation_id uuid references public.deviations (id) on delete set null,
  workflow_processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inspection_findings_round_idx
  on public.inspection_findings (round_id, created_at desc);
create index if not exists inspection_findings_org_severity_idx
  on public.inspection_findings (organization_id, severity, created_at desc);
create index if not exists inspection_findings_org_critical_idx
  on public.inspection_findings (organization_id, created_at desc)
  where severity = 'critical' and deviation_id is null;

drop trigger if exists inspection_findings_set_updated_at on public.inspection_findings;
create trigger inspection_findings_set_updated_at
  before update on public.inspection_findings
  for each row execute function public.set_updated_at();

create or replace function public.set_org_id_from_round()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id
  from public.inspection_rounds
  where id = new.round_id;
  if v_org_id is null then
    raise exception 'Inspection round not found for id %', new.round_id;
  end if;
  new.organization_id := v_org_id;
  return new;
end;
$$;

drop trigger if exists inspection_items_set_org_id_tg on public.inspection_items;
create trigger inspection_items_set_org_id_tg
  before insert or update on public.inspection_items
  for each row execute function public.set_org_id_from_round();

drop trigger if exists inspection_findings_set_org_id_tg on public.inspection_findings;
create trigger inspection_findings_set_org_id_tg
  before insert or update on public.inspection_findings
  for each row execute function public.set_org_id_from_round();

create or replace function public.inspection_templates_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists inspection_templates_before_insert_defaults_tg on public.inspection_templates;
create trigger inspection_templates_before_insert_defaults_tg
  before insert on public.inspection_templates
  for each row execute function public.inspection_templates_before_insert_defaults();

create or replace function public.inspection_locations_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists inspection_locations_before_insert_defaults_tg on public.inspection_locations;
create trigger inspection_locations_before_insert_defaults_tg
  before insert on public.inspection_locations
  for each row execute function public.inspection_locations_before_insert_defaults();

create or replace function public.modules_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists modules_before_insert_defaults_tg on public.modules;
create trigger modules_before_insert_defaults_tg
  before insert on public.modules
  for each row execute function public.modules_before_insert_defaults();

create or replace function public.process_inspection_finding_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round record;
  v_item record;
  v_dev_id uuid;
  v_task_id uuid;
begin
  if new.severity <> 'critical' then
    return new;
  end if;
  if new.deviation_id is not null then
    return new;
  end if;

  select r.* into v_round from public.inspection_rounds r where r.id = new.round_id;
  select i.* into v_item from public.inspection_items i where i.id = new.item_id;

  insert into public.deviations (
    organization_id,
    source,
    source_id,
    title,
    description,
    severity,
    status,
    due_at,
    created_by
  )
  values (
    new.organization_id,
    'inspection_finding',
    new.id,
    coalesce(v_round.title, 'Inspection round') || ' - critical finding',
    new.description,
    new.severity,
    'open',
    now() + interval '1 day',
    new.created_by
  )
  returning id into v_dev_id;

  insert into public.tasks (
    organization_id,
    source,
    source_id,
    title,
    description,
    assigned_to,
    due_at,
    status,
    priority,
    created_by
  )
  values (
    new.organization_id,
    'inspection_finding',
    new.id,
    'Resolve critical inspection finding',
    coalesce(v_round.title, 'Inspection') || E'\n\nFinding: ' || new.description ||
      case
        when v_item.id is not null then E'\nChecklist item: ' || v_item.checklist_item_label
        else ''
      end,
    v_round.assigned_to,
    now() + interval '1 day',
    'todo',
    'high',
    new.created_by
  )
  returning id into v_task_id;

  update public.inspection_findings
  set deviation_id = v_dev_id,
      workflow_processed_at = now(),
      updated_at = now()
  where id = new.id;

  insert into public.workflow_runs (
    organization_id,
    rule_id,
    source_module,
    event,
    status,
    detail
  )
  values (
    new.organization_id,
    null,
    'inspection',
    'payload_change',
    'completed',
    jsonb_build_object(
      'finding_id', new.id,
      'round_id', new.round_id,
      'severity', new.severity,
      'deviation_id', v_dev_id,
      'task_id', v_task_id
    )
  );

  return new;
exception when others then
  insert into public.workflow_runs (
    organization_id,
    rule_id,
    source_module,
    event,
    status,
    detail
  )
  values (
    new.organization_id,
    null,
    'inspection',
    'payload_change',
    'failed',
    jsonb_build_object('finding_id', new.id, 'error', sqlerrm)
  );
  return new;
end;
$$;

drop trigger if exists inspection_findings_workflow_tg on public.inspection_findings;
create trigger inspection_findings_workflow_tg
  after insert on public.inspection_findings
  for each row execute function public.process_inspection_finding_workflow();

alter table public.modules enable row level security;
alter table public.deviations enable row level security;
alter table public.tasks enable row level security;
alter table public.inspection_templates enable row level security;
alter table public.inspection_locations enable row level security;
alter table public.inspection_rounds enable row level security;
alter table public.inspection_items enable row level security;
alter table public.inspection_findings enable row level security;

drop policy if exists "modules_select_org" on public.modules;
create policy "modules_select_org"
  on public.modules for select
  using (organization_id = public.current_org_id());

drop policy if exists "modules_write_org_admin" on public.modules;
create policy "modules_write_org_admin"
  on public.modules for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('workflows.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('workflows.manage'))
  );

drop policy if exists "deviations_select_org" on public.deviations;
create policy "deviations_select_org"
  on public.deviations for select
  using (organization_id = public.current_org_id());

drop policy if exists "deviations_write_org" on public.deviations;
create policy "deviations_write_org"
  on public.deviations for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists "tasks_select_org" on public.tasks;
create policy "tasks_select_org"
  on public.tasks for select
  using (organization_id = public.current_org_id());

drop policy if exists "tasks_write_org" on public.tasks;
create policy "tasks_write_org"
  on public.tasks for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists "inspection_templates_select_org" on public.inspection_templates;
create policy "inspection_templates_select_org"
  on public.inspection_templates for select
  using (organization_id = public.current_org_id());

drop policy if exists "inspection_templates_write_org" on public.inspection_templates;
create policy "inspection_templates_write_org"
  on public.inspection_templates for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists "inspection_locations_select_org" on public.inspection_locations;
create policy "inspection_locations_select_org"
  on public.inspection_locations for select
  using (organization_id = public.current_org_id());

drop policy if exists "inspection_locations_write_org" on public.inspection_locations;
create policy "inspection_locations_write_org"
  on public.inspection_locations for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists "inspection_rounds_select_org" on public.inspection_rounds;
create policy "inspection_rounds_select_org"
  on public.inspection_rounds for select
  using (organization_id = public.current_org_id());

drop policy if exists "inspection_rounds_write_org" on public.inspection_rounds;
create policy "inspection_rounds_write_org"
  on public.inspection_rounds for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists "inspection_items_select_org" on public.inspection_items;
create policy "inspection_items_select_org"
  on public.inspection_items for select
  using (organization_id = public.current_org_id());

drop policy if exists "inspection_items_write_org" on public.inspection_items;
create policy "inspection_items_write_org"
  on public.inspection_items for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists "inspection_findings_select_org" on public.inspection_findings;
create policy "inspection_findings_select_org"
  on public.inspection_findings for select
  using (organization_id = public.current_org_id());

drop policy if exists "inspection_findings_write_org" on public.inspection_findings;
create policy "inspection_findings_write_org"
  on public.inspection_findings for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.seed_default_roles_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_admin uuid;
  r_member uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id and is_org_admin)
    or (
      exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id)
      and not exists (select 1 from public.role_definitions where organization_id = p_org_id)
    )
  ) then
    raise exception 'Only org admin can seed roles (or first-time seed when no roles exist)';
  end if;

  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values
    (p_org_id, 'admin', 'Administrator', 'Full tilgang til brukere, roller og invitasjoner', true),
    (p_org_id, 'member', 'Medlem', 'Standard tilgang til moduler', true)
  on conflict (organization_id, slug) do nothing;

  select id into r_admin from public.role_definitions where organization_id = p_org_id and slug = 'admin';
  select id into r_member from public.role_definitions where organization_id = p_org_id and slug = 'member';

  if r_admin is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_admin, 'users.invite'),
      (r_admin, 'users.manage'),
      (r_admin, 'roles.manage'),
      (r_admin, 'delegation.manage'),
      (r_admin, 'module.view.dashboard'),
      (r_admin, 'module.view.council'),
      (r_admin, 'module.view.members'),
      (r_admin, 'module.view.org_health'),
      (r_admin, 'module.view.hse'),
      (r_admin, 'module.view.inspection'),
      (r_admin, 'module.view.internal_control'),
      (r_admin, 'module.view.tasks'),
      (r_admin, 'module.view.learning'),
      (r_admin, 'module.view.reports'),
      (r_admin, 'module.view.workflow'),
      (r_admin, 'workflows.manage'),
      (r_admin, 'module.view.admin')
    on conflict do nothing;
  end if;

  if r_member is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_member, 'module.view.dashboard'),
      (r_member, 'module.view.council'),
      (r_member, 'module.view.members'),
      (r_member, 'module.view.org_health'),
      (r_member, 'module.view.hse'),
      (r_member, 'module.view.inspection'),
      (r_member, 'module.view.internal_control'),
      (r_member, 'module.view.tasks'),
      (r_member, 'module.view.learning'),
      (r_member, 'module.view.reports'),
      (r_member, 'module.view.workflow')
    on conflict do nothing;
  end if;
end;
$$;

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'module.view.inspection'
from public.role_definitions rd
where rd.slug in ('admin', 'member')
on conflict (role_id, permission_key) do nothing;

insert into public.modules (organization_id, slug, display_name, is_active, required_permissions, config)
select
  rd.organization_id,
  'inspection-module',
  'Inspection Module',
  true,
  '["module.view.hse","module.view.inspection"]'::jsonb,
  '{"enablePhotos":true,"defaultCronExpression":"0 7 * * 1"}'::jsonb
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (organization_id, slug) do update
set
  display_name = excluded.display_name,
  is_active = excluded.is_active,
  required_permissions = excluded.required_permissions,
  config = excluded.config,
  updated_at = now();
