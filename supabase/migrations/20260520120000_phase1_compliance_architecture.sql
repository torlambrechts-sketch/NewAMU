-- Phase 1: Compliance connective tissue (database-first)
-- 1) RBAC tables + strict RLS (roles, permissions, role_permissions with resource/action/scope)
-- 2) Event-driven workflow processing into tasks/deviations
-- 3) Module registration table

-- ---------------------------------------------------------------------------
-- RBAC helpers
-- ---------------------------------------------------------------------------

create or replace function public.permission_parts_from_key(p_key text)
returns table (resource text, action text, scope text)
language plpgsql
immutable
as $$
declare
  parts text[];
  parts_len int;
begin
  parts := string_to_array(coalesce(trim(p_key), ''), '.');
  parts_len := coalesce(array_length(parts, 1), 0);

  resource := case
    when parts_len >= 1 and coalesce(parts[1], '') <> '' then parts[1]
    else 'general'
  end;

  action := case
    when parts_len >= 2 and coalesce(parts[2], '') <> '' then parts[2]
    else 'use'
  end;

  scope := case
    when parts_len >= 3 then array_to_string(parts[3:parts_len], '.')
    else 'org'
  end;

  scope := coalesce(nullif(scope, ''), 'org');
  return next;
end;
$$;

create or replace function public.permission_key_from_parts(
  p_resource text,
  p_action text,
  p_scope text
)
returns text
language sql
immutable
as $$
  select
    coalesce(nullif(trim(p_resource), ''), 'general')
    || '.'
    || coalesce(nullif(trim(p_action), ''), 'use')
    || '.'
    || coalesce(nullif(trim(p_scope), ''), 'org');
$$;

create or replace function public.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return p_value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.user_has_all_permission_keys(
  p_permission_keys text[],
  p_user uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(bool_and(public.user_has_permission(k, p_user)), true)
  from unnest(coalesce(p_permission_keys, '{}'::text[])) as t(k);
$$;

-- ---------------------------------------------------------------------------
-- Roles + permissions catalog
-- ---------------------------------------------------------------------------

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null,
  display_name text not null,
  description text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_org_slug_unique unique (organization_id, slug)
);

create index if not exists roles_org_idx on public.roles (organization_id);

drop trigger if exists roles_set_updated_at on public.roles;
create trigger roles_set_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  resource text not null,
  action text not null,
  scope text not null default 'org',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permissions_unique unique (organization_id, resource, action, scope),
  constraint permissions_scope_not_blank check (btrim(scope) <> '')
);

create index if not exists permissions_org_idx on public.permissions (organization_id);
create index if not exists permissions_org_resource_action_idx
  on public.permissions (organization_id, resource, action);

drop trigger if exists permissions_set_updated_at on public.permissions;
create trigger permissions_set_updated_at
  before update on public.permissions
  for each row execute function public.set_updated_at();

-- Mirror legacy role_definitions into public.roles so the new table can be consumed
-- without breaking existing application paths.
insert into public.roles (id, organization_id, slug, display_name, description, is_system, created_at, updated_at)
select
  rd.id,
  rd.organization_id,
  rd.slug,
  rd.name,
  coalesce(rd.description, ''),
  rd.is_system,
  rd.created_at,
  coalesce(rd.created_at, now())
from public.role_definitions rd
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  slug = excluded.slug,
  display_name = excluded.display_name,
  description = excluded.description,
  is_system = excluded.is_system,
  updated_at = now();

create or replace function public.sync_role_definitions_to_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.roles where id = old.id;
    return old;
  end if;

  insert into public.roles (id, organization_id, slug, display_name, description, is_system, created_at, updated_at)
  values (
    new.id,
    new.organization_id,
    new.slug,
    new.name,
    coalesce(new.description, ''),
    new.is_system,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
  set
    organization_id = excluded.organization_id,
    slug = excluded.slug,
    display_name = excluded.display_name,
    description = excluded.description,
    is_system = excluded.is_system,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists role_definitions_sync_roles on public.role_definitions;
create trigger role_definitions_sync_roles
  after insert or update or delete on public.role_definitions
  for each row execute function public.sync_role_definitions_to_roles();

-- ---------------------------------------------------------------------------
-- role_permissions upgrade: add resource/action/scope + permission catalog link
-- ---------------------------------------------------------------------------

alter table public.role_permissions
  add column if not exists permission_id uuid references public.permissions (id) on delete cascade,
  add column if not exists resource text,
  add column if not exists action text,
  add column if not exists scope text;

-- Parse legacy permission_key values into structured tuples.
with parsed as (
  select
    rp.role_id,
    rp.permission_key,
    pp.resource,
    pp.action,
    pp.scope
  from public.role_permissions rp
  cross join lateral public.permission_parts_from_key(rp.permission_key) pp
  where coalesce(rp.permission_key, '') <> ''
)
update public.role_permissions rp
set
  resource = coalesce(rp.resource, parsed.resource),
  action = coalesce(rp.action, parsed.action),
  scope = coalesce(rp.scope, parsed.scope)
from parsed
where rp.role_id = parsed.role_id
  and rp.permission_key = parsed.permission_key;

update public.role_permissions
set
  resource = coalesce(resource, 'legacy'),
  action = coalesce(action, 'use'),
  scope = coalesce(nullif(scope, ''), 'org');

-- Seed permissions table from role_permissions tuples.
insert into public.permissions (organization_id, resource, action, scope, description)
select distinct
  rd.organization_id,
  rp.resource,
  rp.action,
  rp.scope,
  ''
from public.role_permissions rp
join public.role_definitions rd on rd.id = rp.role_id
on conflict (organization_id, resource, action, scope) do nothing;

-- Link each role_permission row to a permissions row.
update public.role_permissions rp
set permission_id = p.id
from public.role_definitions rd
join public.permissions p
  on p.organization_id = rd.organization_id
where rd.id = rp.role_id
  and p.resource = rp.resource
  and p.action = rp.action
  and p.scope = rp.scope
  and rp.permission_id is distinct from p.id;

alter table public.role_permissions
  alter column resource set not null,
  alter column action set not null,
  alter column scope set not null,
  alter column permission_id set not null;

create index if not exists role_permissions_permission_id_idx
  on public.role_permissions (permission_id);

create unique index if not exists role_permissions_role_tuple_unique
  on public.role_permissions (role_id, resource, action, scope);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'role_permissions_role_fk_roles'
      and conrelid = 'public.role_permissions'::regclass
  ) then
    alter table public.role_permissions
      add constraint role_permissions_role_fk_roles
      foreign key (role_id) references public.roles (id) on delete cascade
      not valid;
    alter table public.role_permissions
      validate constraint role_permissions_role_fk_roles;
  end if;
end
$$;

create or replace function public.role_permissions_normalize()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_resource text;
  v_action text;
  v_scope text;
begin
  select organization_id
  into v_org_id
  from public.role_definitions
  where id = new.role_id;

  if v_org_id is null then
    raise exception 'role_permissions.role_id % does not belong to a known role', new.role_id;
  end if;

  if new.permission_id is not null then
    select p.resource, p.action, p.scope
    into v_resource, v_action, v_scope
    from public.permissions p
    where p.id = new.permission_id
      and p.organization_id = v_org_id;

    if v_resource is null then
      raise exception 'permission_id % is invalid for organization %', new.permission_id, v_org_id;
    end if;

    new.resource := v_resource;
    new.action := v_action;
    new.scope := v_scope;

    if coalesce(new.permission_key, '') = '' then
      new.permission_key := public.permission_key_from_parts(new.resource, new.action, new.scope);
    end if;

    return new;
  end if;

  if coalesce(new.resource, '') = '' or coalesce(new.action, '') = '' then
    select pp.resource, pp.action, pp.scope
    into v_resource, v_action, v_scope
    from public.permission_parts_from_key(new.permission_key) pp;

    new.resource := v_resource;
    new.action := v_action;
    new.scope := v_scope;
  else
    new.scope := coalesce(nullif(new.scope, ''), 'org');
  end if;

  insert into public.permissions (organization_id, resource, action, scope, description)
  values (v_org_id, new.resource, new.action, new.scope, '')
  on conflict (organization_id, resource, action, scope) do nothing;

  select id
  into new.permission_id
  from public.permissions
  where organization_id = v_org_id
    and resource = new.resource
    and action = new.action
    and scope = new.scope
  limit 1;

  if coalesce(new.permission_key, '') = '' then
    new.permission_key := public.permission_key_from_parts(new.resource, new.action, new.scope);
  end if;

  return new;
end;
$$;

drop trigger if exists role_permissions_normalize_biu on public.role_permissions;
create trigger role_permissions_normalize_biu
  before insert or update on public.role_permissions
  for each row execute function public.role_permissions_normalize();

-- ---------------------------------------------------------------------------
-- Module registration (database-driven)
-- ---------------------------------------------------------------------------

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  required_permissions text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modules_slug_chk check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index if not exists modules_active_idx on public.modules (is_active);

drop trigger if exists modules_set_updated_at on public.modules;
create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Workflow rules extension + task/deviation execution targets
-- ---------------------------------------------------------------------------

alter table public.workflow_rules
  add column if not exists trigger_event text not null default 'legacy.payload_change',
  add column if not exists action_type text not null default 'noop',
  add column if not exists action_config jsonb not null default '{}'::jsonb,
  add column if not exists module_id uuid references public.modules (id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workflow_rules_action_type_chk'
      and conrelid = 'public.workflow_rules'::regclass
  ) then
    alter table public.workflow_rules
      add constraint workflow_rules_action_type_chk
      check (action_type in ('assign_task', 'create_deviation', 'noop'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workflow_rules_trigger_event_not_blank_chk'
      and conrelid = 'public.workflow_rules'::regclass
  ) then
    alter table public.workflow_rules
      add constraint workflow_rules_trigger_event_not_blank_chk
      check (btrim(trigger_event) <> '');
  end if;
end
$$;

create index if not exists workflow_rules_trigger_event_idx
  on public.workflow_rules (organization_id, trigger_event, is_active);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  module_id uuid references public.modules (id) on delete set null,
  workflow_rule_id uuid references public.workflow_rules (id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  due_at timestamptz,
  source_event text not null default 'manual',
  source_ref text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_org_status_idx on public.tasks (organization_id, status);
create index if not exists tasks_org_assignee_idx on public.tasks (organization_id, assigned_to);
create index if not exists tasks_org_source_event_idx on public.tasks (organization_id, source_event);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create table if not exists public.deviations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  module_id uuid references public.modules (id) on delete set null,
  workflow_rule_id uuid references public.workflow_rules (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  title text not null,
  description text not null default '',
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'closed')),
  detected_at timestamptz not null default now(),
  detected_by uuid references auth.users (id) on delete set null default auth.uid(),
  source_event text not null default 'manual',
  source_ref text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deviations_org_status_idx on public.deviations (organization_id, status);
create index if not exists deviations_org_severity_idx on public.deviations (organization_id, severity);
create index if not exists deviations_org_source_event_idx on public.deviations (organization_id, source_event);

drop trigger if exists deviations_set_updated_at on public.deviations;
create trigger deviations_set_updated_at
  before update on public.deviations
  for each row execute function public.set_updated_at();

create table if not exists public.workflow_event_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workflow_rule_id uuid not null references public.workflow_rules (id) on delete cascade,
  trigger_event text not null,
  event_key text not null,
  created_at timestamptz not null default now(),
  constraint workflow_event_receipts_unique unique (organization_id, workflow_rule_id, event_key)
);

create index if not exists workflow_event_receipts_org_idx
  on public.workflow_event_receipts (organization_id, created_at desc);

create or replace function public.workflow_process_event(
  p_organization_id uuid,
  p_trigger_event text,
  p_event_payload jsonb default '{}'::jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_processed int := 0;
  v_event_key text;
  v_priority text;
  v_severity text;
  v_assigned_to uuid;
  v_due_at timestamptz;
  v_module_id uuid;
  v_created_task_id uuid;
  v_created_deviation_id uuid;
  v_due_days int;
  v_actor_org uuid;
begin
  if p_organization_id is null or p_trigger_event is null or btrim(p_trigger_event) = '' then
    return 0;
  end if;

  if auth.uid() is not null then
    select organization_id
    into v_actor_org
    from public.profiles
    where id = auth.uid();

    if v_actor_org is distinct from p_organization_id then
      raise exception 'Not allowed to process workflow events outside your organization';
    end if;
  end if;

  v_event_key := coalesce(nullif(p_event_payload->>'event_key', ''), md5(coalesce(p_event_payload::text, '')));
  v_module_id := public.try_uuid(p_event_payload->>'module_id');

  for r in
    select wr.*
    from public.workflow_rules wr
    where wr.organization_id = p_organization_id
      and wr.is_active = true
      and wr.trigger_event = p_trigger_event
      and (wr.module_id is null or wr.module_id = v_module_id)
    order by wr.priority desc, wr.created_at asc
  loop
    insert into public.workflow_event_receipts (organization_id, workflow_rule_id, trigger_event, event_key)
    values (p_organization_id, r.id, p_trigger_event, v_event_key)
    on conflict (organization_id, workflow_rule_id, event_key) do nothing;

    if not found then
      continue;
    end if;

    if r.action_type = 'assign_task' then
      v_assigned_to := public.try_uuid(r.action_config->>'assigned_to');
      v_priority := case
        when lower(coalesce(r.action_config->>'priority', '')) in ('low', 'normal', 'high', 'critical')
          then lower(r.action_config->>'priority')
        else 'normal'
      end;
      v_severity := case
        when lower(coalesce(r.action_config->>'severity', '')) in ('low', 'medium', 'high', 'critical')
          then lower(r.action_config->>'severity')
        else 'critical'
      end;
      v_due_days := case
        when coalesce(r.action_config->>'due_in_days', '') ~ '^\d+$' then (r.action_config->>'due_in_days')::int
        else null
      end;
      v_due_at := case
        when v_due_days is null then null
        else now() + make_interval(days => v_due_days)
      end;

      insert into public.tasks (
        organization_id,
        module_id,
        workflow_rule_id,
        title,
        description,
        status,
        priority,
        assigned_to,
        due_at,
        source_event,
        source_ref,
        source_payload
      )
      values (
        p_organization_id,
        coalesce(r.module_id, v_module_id),
        r.id,
        coalesce(nullif(r.action_config->>'title', ''), 'Workflow task'),
        coalesce(r.action_config->>'description', ''),
        'open',
        v_priority,
        v_assigned_to,
        v_due_at,
        p_trigger_event,
        nullif(p_event_payload->>'source_id', ''),
        p_event_payload
      )
      returning id into v_created_task_id;

      if lower(coalesce(r.action_config->>'create_deviation', 'false')) in ('true', '1', 'yes') then
        insert into public.deviations (
          organization_id,
          module_id,
          workflow_rule_id,
          task_id,
          title,
          description,
          severity,
          status,
          source_event,
          source_ref,
          source_payload
        )
        values (
          p_organization_id,
          coalesce(r.module_id, v_module_id),
          r.id,
          v_created_task_id,
          coalesce(nullif(r.action_config->>'deviation_title', ''), coalesce(nullif(r.action_config->>'title', ''), 'Workflow deviation')),
          coalesce(r.action_config->>'deviation_description', r.action_config->>'description', ''),
          v_severity,
          'open',
          p_trigger_event,
          nullif(p_event_payload->>'source_id', ''),
          p_event_payload
        );
      end if;

      v_processed := v_processed + 1;
    elsif r.action_type = 'create_deviation' then
      insert into public.deviations (
        organization_id,
        module_id,
        workflow_rule_id,
        title,
        description,
        severity,
        status,
        source_event,
        source_ref,
        source_payload
      )
      values (
        p_organization_id,
        coalesce(r.module_id, v_module_id),
        r.id,
        coalesce(nullif(r.action_config->>'title', ''), 'Workflow deviation'),
        coalesce(r.action_config->>'description', ''),
        case
          when lower(coalesce(r.action_config->>'severity', '')) in ('low', 'medium', 'high', 'critical')
            then lower(r.action_config->>'severity')
          else 'critical'
        end,
        'open',
        p_trigger_event,
        nullif(p_event_payload->>'source_id', ''),
        p_event_payload
      )
      returning id into v_created_deviation_id;

      if lower(coalesce(r.action_config->>'create_task', 'false')) in ('true', '1', 'yes') then
        v_assigned_to := public.try_uuid(r.action_config->>'assigned_to');
        v_priority := case
          when lower(coalesce(r.action_config->>'priority', '')) in ('low', 'normal', 'high', 'critical')
            then lower(r.action_config->>'priority')
          else 'normal'
        end;
        v_due_days := case
          when coalesce(r.action_config->>'due_in_days', '') ~ '^\d+$' then (r.action_config->>'due_in_days')::int
          else null
        end;
        v_due_at := case
          when v_due_days is null then null
          else now() + make_interval(days => v_due_days)
        end;

        insert into public.tasks (
          organization_id,
          module_id,
          workflow_rule_id,
          title,
          description,
          status,
          priority,
          assigned_to,
          due_at,
          source_event,
          source_ref,
          source_payload
        )
        values (
          p_organization_id,
          coalesce(r.module_id, v_module_id),
          r.id,
          coalesce(nullif(r.action_config->>'task_title', ''), coalesce(nullif(r.action_config->>'title', ''), 'Follow-up task')),
          coalesce(r.action_config->>'task_description', r.action_config->>'description', ''),
          'open',
          v_priority,
          v_assigned_to,
          v_due_at,
          p_trigger_event,
          nullif(p_event_payload->>'source_id', ''),
          p_event_payload
        )
        returning id into v_created_task_id;

        update public.deviations
        set task_id = v_created_task_id
        where id = v_created_deviation_id;
      end if;

      v_processed := v_processed + 1;
    end if;
  end loop;

  return v_processed;
end;
$$;

revoke all on function public.workflow_process_event(uuid, text, jsonb) from public;
revoke all on function public.workflow_process_event(uuid, text, jsonb) from anon;
revoke all on function public.workflow_process_event(uuid, text, jsonb) from authenticated;
grant execute on function public.workflow_process_event(uuid, text, jsonb) to service_role;

create or replace function public.workflow_on_hse_payload_critical()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_has_critical boolean := false;
  v_old_has_critical boolean := false;
begin
  if coalesce(new.module_key, '') <> 'hse' then
    return new;
  end if;

  v_new_has_critical := jsonb_path_exists(coalesce(new.payload, '{}'::jsonb), '$.** ? (@.severity == "critical")');

  if tg_op = 'UPDATE' then
    v_old_has_critical := jsonb_path_exists(coalesce(old.payload, '{}'::jsonb), '$.** ? (@.severity == "critical")');
  end if;

  if v_new_has_critical and not v_old_has_critical then
    perform public.workflow_process_event(
      new.organization_id,
      'critical_finding_detected',
      jsonb_build_object(
        'event_key', md5(new.organization_id::text || ':' || new.module_key || ':' || coalesce(new.payload::text, '')),
        'source_table', 'org_module_payloads',
        'source_id', new.organization_id::text || ':' || new.module_key,
        'module_key', new.module_key,
        'severity', 'critical',
        'payload', new.payload
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists workflow_hse_payload_critical_aiu on public.org_module_payloads;
create trigger workflow_hse_payload_critical_aiu
  after insert or update on public.org_module_payloads
  for each row execute function public.workflow_on_hse_payload_critical();

-- Optional ready-made trigger function for future inspection_findings table (Phase 3).
create or replace function public.workflow_on_inspection_finding_critical()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.severity = 'critical' and (tg_op = 'INSERT' or old.severity is distinct from 'critical') then
    perform public.workflow_process_event(
      new.organization_id,
      'critical_finding_detected',
      jsonb_build_object(
        'event_key', 'inspection-finding:' || new.id::text,
        'source_table', tg_table_name,
        'source_id', new.id::text,
        'module_id', coalesce(new.module_id::text, ''),
        'severity', new.severity
      )
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.inspection_findings') is not null then
    execute 'drop trigger if exists workflow_inspection_finding_critical_aiu on public.inspection_findings';
    execute 'create trigger workflow_inspection_finding_critical_aiu after insert or update on public.inspection_findings for each row execute function public.workflow_on_inspection_finding_critical()';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.modules enable row level security;
alter table public.tasks enable row level security;
alter table public.deviations enable row level security;
alter table public.workflow_event_receipts enable row level security;

drop policy if exists "roles_select" on public.roles;
create policy "roles_select"
  on public.roles for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('roles.read')
      or public.user_has_permission('roles.manage')
    )
  );

drop policy if exists "roles_service_manage" on public.roles;
create policy "roles_service_manage"
  on public.roles for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "permissions_select" on public.permissions;
create policy "permissions_select"
  on public.permissions for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('roles.read')
      or public.user_has_permission('roles.manage')
      or public.user_has_permission('permissions.read')
      or public.user_has_permission('permissions.manage')
    )
  );

drop policy if exists "permissions_manage" on public.permissions;
create policy "permissions_manage"
  on public.permissions for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('permissions.manage')
      or public.user_has_permission('roles.manage')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('permissions.manage')
      or public.user_has_permission('roles.manage')
    )
  );

drop policy if exists "role_permissions_select_org" on public.role_permissions;
drop policy if exists "role_permissions_select_demo_public" on public.role_permissions;
drop policy if exists "role_permissions_manage_admin" on public.role_permissions;
drop policy if exists "role_permissions_select_strict" on public.role_permissions;
drop policy if exists "role_permissions_manage_strict" on public.role_permissions;

create policy "role_permissions_select_strict"
  on public.role_permissions for select
  to authenticated
  using (
    exists (
      select 1
      from public.role_definitions rd
      where rd.id = role_permissions.role_id
        and rd.organization_id = public.current_org_id()
    )
    and (
      public.is_org_admin()
      or public.user_has_permission('roles.read')
      or public.user_has_permission('roles.manage')
    )
  );

create policy "role_permissions_manage_strict"
  on public.role_permissions for all
  to authenticated
  using (
    exists (
      select 1
      from public.role_definitions rd
      where rd.id = role_permissions.role_id
        and rd.organization_id = public.current_org_id()
    )
    and (
      public.is_org_admin()
      or public.user_has_permission('roles.manage')
    )
  )
  with check (
    exists (
      select 1
      from public.role_definitions rd
      where rd.id = role_permissions.role_id
        and rd.organization_id = public.current_org_id()
    )
    and (
      public.is_org_admin()
      or public.user_has_permission('roles.manage')
    )
  );

drop policy if exists "modules_select_active_permitted" on public.modules;
create policy "modules_select_active_permitted"
  on public.modules for select
  to authenticated
  using (
    is_active = true
    and public.user_has_all_permission_keys(required_permissions)
  );

drop policy if exists "modules_manage_service" on public.modules;
create policy "modules_manage_service"
  on public.modules for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "workflow_rules_select_org" on public.workflow_rules;
drop policy if exists "workflow_rules_write_manage" on public.workflow_rules;

create policy "workflow_rules_select_org"
  on public.workflow_rules for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('workflows.read')
      or public.user_has_permission('workflows.manage')
    )
  );

create policy "workflow_rules_write_manage"
  on public.workflow_rules for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('workflows.manage')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('workflows.manage')
    )
  );

drop policy if exists "tasks_select_org" on public.tasks;
drop policy if exists "tasks_insert_manage" on public.tasks;
drop policy if exists "tasks_update_manage" on public.tasks;
drop policy if exists "tasks_delete_manage" on public.tasks;

create policy "tasks_select_org"
  on public.tasks for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('tasks.read')
      or public.user_has_permission('tasks.manage')
      or assigned_to = auth.uid()
      or created_by = auth.uid()
    )
  );

create policy "tasks_insert_manage"
  on public.tasks for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('tasks.manage')
      or public.user_has_permission('workflows.manage')
    )
  );

create policy "tasks_update_manage"
  on public.tasks for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('tasks.manage')
      or public.user_has_permission('workflows.manage')
      or assigned_to = auth.uid()
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('tasks.manage')
      or public.user_has_permission('workflows.manage')
      or assigned_to = auth.uid()
    )
  );

create policy "tasks_delete_manage"
  on public.tasks for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('tasks.manage')
      or public.user_has_permission('workflows.manage')
    )
  );

drop policy if exists "deviations_select_org" on public.deviations;
drop policy if exists "deviations_insert_manage" on public.deviations;
drop policy if exists "deviations_update_manage" on public.deviations;
drop policy if exists "deviations_delete_manage" on public.deviations;

create policy "deviations_select_org"
  on public.deviations for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('deviations.read')
      or public.user_has_permission('deviations.manage')
      or public.user_has_permission('workflows.read')
      or public.user_has_permission('workflows.manage')
    )
  );

create policy "deviations_insert_manage"
  on public.deviations for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('deviations.manage')
      or public.user_has_permission('workflows.manage')
    )
  );

create policy "deviations_update_manage"
  on public.deviations for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('deviations.manage')
      or public.user_has_permission('workflows.manage')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('deviations.manage')
      or public.user_has_permission('workflows.manage')
    )
  );

create policy "deviations_delete_manage"
  on public.deviations for delete
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('deviations.manage')
      or public.user_has_permission('workflows.manage')
    )
  );

drop policy if exists "workflow_event_receipts_select_org" on public.workflow_event_receipts;
drop policy if exists "workflow_event_receipts_manage" on public.workflow_event_receipts;
drop policy if exists "workflow_event_receipts_service_manage" on public.workflow_event_receipts;

create policy "workflow_event_receipts_select_org"
  on public.workflow_event_receipts for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('workflows.read')
      or public.user_has_permission('workflows.manage')
    )
  );

create policy "workflow_event_receipts_manage"
  on public.workflow_event_receipts for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('workflows.manage')
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('workflows.manage')
    )
  );

create policy "workflow_event_receipts_service_manage"
  on public.workflow_event_receipts for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Permission seed for existing admin/member roles
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role_id, permission_key)
select rd.id, v.permission_key
from public.role_definitions rd
cross join (
  values
    ('roles.read'),
    ('roles.manage'),
    ('permissions.read'),
    ('permissions.manage'),
    ('modules.read'),
    ('workflows.read'),
    ('workflows.manage'),
    ('tasks.read'),
    ('tasks.manage'),
    ('deviations.read'),
    ('deviations.manage')
) as v(permission_key)
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select rd.id, v.permission_key
from public.role_definitions rd
cross join (
  values
    ('modules.read'),
    ('workflows.read'),
    ('tasks.read'),
    ('deviations.read')
) as v(permission_key)
where rd.slug = 'member'
on conflict (role_id, permission_key) do nothing;
