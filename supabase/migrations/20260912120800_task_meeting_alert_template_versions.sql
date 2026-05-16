-- Snapshot tables + triggers + restore RPCs for the three remaining
-- template-bearing modules surfaced on /admin/templates. Mirrors the
-- existing compliance / survey / documents / learning / registers
-- pattern (see migrations 20260912120000 … 20260912120700).
--
-- Tasks: override-style (joins task_template_catalog for name).
-- Meetings: self-contained per-org row.
-- Alerts: self-contained per-org row.
-- Workflow: skipped — workflow_template_catalog is catalog-only with
--   no per-org override surface today; system-row changes go via
--   plattform-admin migrations, not org-admin edits.

-- ── Tasks ─────────────────────────────────────────────────────────────────

create table if not exists public.task_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.task_org_templates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists task_template_versions_tpl_idx on public.task_template_versions (template_id, created_at desc);
create index if not exists task_template_versions_org_idx on public.task_template_versions (organization_id, created_at desc);
alter table public.task_template_versions enable row level security;
drop policy if exists task_template_versions_select on public.task_template_versions;
create policy task_template_versions_select on public.task_template_versions for select
  using (organization_id = public.current_org_id());

create or replace function public.task_template_snapshot_fn()
returns trigger language plpgsql security definer set search_path = public
as $fn$
begin
  if old.is_active is not distinct from new.is_active
     and old.nav_pinned is not distinct from new.nav_pinned
     and old.catalog_id is not distinct from new.catalog_id
  then return new; end if;
  insert into public.task_template_versions (template_id, organization_id, snapshot, changed_by)
  values (new.id, new.organization_id, jsonb_build_object(
    'catalog_id', new.catalog_id, 'is_active', new.is_active,
    'nav_pinned', new.nav_pinned, 'updated_at', new.updated_at
  ), auth.uid());
  return new;
end $fn$;
drop trigger if exists task_template_snapshot on public.task_org_templates;
create trigger task_template_snapshot after update on public.task_org_templates
  for each row execute function public.task_template_snapshot_fn();

create or replace function public.restore_task_template_version(p_version_id uuid)
returns uuid language plpgsql as $$
declare v_snapshot jsonb; v_template_id uuid;
begin
  select snapshot, template_id into v_snapshot, v_template_id
  from public.task_template_versions where id = p_version_id;
  if v_template_id is null then
    raise exception 'Version % not found or access denied', p_version_id using errcode='P0002';
  end if;
  update public.task_org_templates set
    is_active = coalesce((v_snapshot->>'is_active')::boolean, true),
    nav_pinned = coalesce((v_snapshot->>'nav_pinned')::boolean, false)
  where id = v_template_id;
  return v_template_id;
end $$;
grant execute on function public.restore_task_template_version(uuid) to authenticated;

-- ── Meetings ──────────────────────────────────────────────────────────────

create table if not exists public.meeting_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.meeting_org_templates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists meeting_template_versions_tpl_idx on public.meeting_template_versions (template_id, created_at desc);
create index if not exists meeting_template_versions_org_idx on public.meeting_template_versions (organization_id, created_at desc);
alter table public.meeting_template_versions enable row level security;
drop policy if exists meeting_template_versions_select on public.meeting_template_versions;
create policy meeting_template_versions_select on public.meeting_template_versions for select
  using (organization_id = public.current_org_id());

create or replace function public.meeting_template_snapshot_fn()
returns trigger language plpgsql security definer set search_path = public
as $fn$
begin
  if old.name is not distinct from new.name
     and coalesce(old.description, '') is not distinct from coalesce(new.description, '')
     and old.definition::text is not distinct from new.definition::text
     and coalesce(old.metadata_schema::text, '') is not distinct from coalesce(new.metadata_schema::text, '')
     and old.is_active is not distinct from new.is_active
     and old.nav_pinned is not distinct from new.nav_pinned
     and old.framework is not distinct from new.framework
     and old.law_refs is not distinct from new.law_refs
  then return new; end if;
  insert into public.meeting_template_versions (template_id, organization_id, snapshot, changed_by)
  values (new.id, new.organization_id, jsonb_build_object(
    'name', new.name, 'description', new.description, 'slug', new.slug,
    'framework', new.framework, 'frameworks', new.frameworks, 'law_refs', new.law_refs,
    'cadence_hint', new.cadence_hint, 'default_duration_minutes', new.default_duration_minutes,
    'definition', new.definition, 'metadata_schema', new.metadata_schema,
    'is_active', new.is_active, 'nav_pinned', new.nav_pinned,
    'updated_at', new.updated_at
  ), auth.uid());
  return new;
end $fn$;
drop trigger if exists meeting_template_snapshot on public.meeting_org_templates;
create trigger meeting_template_snapshot after update on public.meeting_org_templates
  for each row execute function public.meeting_template_snapshot_fn();

create or replace function public.restore_meeting_template_version(p_version_id uuid)
returns uuid language plpgsql as $$
declare v_snapshot jsonb; v_template_id uuid;
begin
  select snapshot, template_id into v_snapshot, v_template_id
  from public.meeting_template_versions where id = p_version_id;
  if v_template_id is null then
    raise exception 'Version % not found or access denied', p_version_id using errcode='P0002';
  end if;
  update public.meeting_org_templates set
    name = v_snapshot->>'name',
    description = v_snapshot->>'description',
    framework = coalesce(v_snapshot->>'framework', 'INTERNAL'),
    frameworks = coalesce(array(select jsonb_array_elements_text(v_snapshot->'frameworks')), '{}'::text[]),
    law_refs = coalesce(array(select jsonb_array_elements_text(v_snapshot->'law_refs')), '{}'::text[]),
    cadence_hint = v_snapshot->>'cadence_hint',
    default_duration_minutes = nullif(v_snapshot->>'default_duration_minutes', '')::integer,
    definition = coalesce(v_snapshot->'definition', '{}'::jsonb),
    metadata_schema = coalesce(v_snapshot->'metadata_schema', '{"fields":[]}'::jsonb),
    is_active = coalesce((v_snapshot->>'is_active')::boolean, true),
    nav_pinned = coalesce((v_snapshot->>'nav_pinned')::boolean, false)
  where id = v_template_id;
  return v_template_id;
end $$;
grant execute on function public.restore_meeting_template_version(uuid) to authenticated;

-- ── Alerts ────────────────────────────────────────────────────────────────

create table if not exists public.alert_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.alert_org_templates(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists alert_template_versions_tpl_idx on public.alert_template_versions (template_id, created_at desc);
create index if not exists alert_template_versions_org_idx on public.alert_template_versions (organization_id, created_at desc);
alter table public.alert_template_versions enable row level security;
drop policy if exists alert_template_versions_select on public.alert_template_versions;
create policy alert_template_versions_select on public.alert_template_versions for select
  using (organization_id = public.current_org_id());

create or replace function public.alert_template_snapshot_fn()
returns trigger language plpgsql security definer set search_path = public
as $fn$
begin
  if old.name is not distinct from new.name
     and coalesce(old.description, '') is not distinct from coalesce(new.description, '')
     and old.definition::text is not distinct from new.definition::text
     and old.kind is not distinct from new.kind
     and old.frameworks is not distinct from new.frameworks
     and old.law_refs is not distinct from new.law_refs
     and old.default_confidentiality_level is not distinct from new.default_confidentiality_level
  then return new; end if;
  insert into public.alert_template_versions (template_id, organization_id, snapshot, changed_by)
  values (new.id, new.organization_id, jsonb_build_object(
    'name', new.name, 'description', new.description, 'slug', new.slug, 'kind', new.kind,
    'frameworks', new.frameworks, 'law_refs', new.law_refs,
    'default_confidentiality_level', new.default_confidentiality_level,
    'default_retention_years', new.default_retention_years,
    'acknowledgement_due_days', new.acknowledgement_due_days,
    'investigation_due_days', new.investigation_due_days,
    'requires_dpo', new.requires_dpo, 'allows_anonymous', new.allows_anonymous,
    'definition', new.definition, 'updated_at', new.updated_at
  ), auth.uid());
  return new;
end $fn$;
drop trigger if exists alert_template_snapshot on public.alert_org_templates;
create trigger alert_template_snapshot after update on public.alert_org_templates
  for each row execute function public.alert_template_snapshot_fn();

create or replace function public.restore_alert_template_version(p_version_id uuid)
returns uuid language plpgsql as $$
declare v_snapshot jsonb; v_template_id uuid;
begin
  select snapshot, template_id into v_snapshot, v_template_id
  from public.alert_template_versions where id = p_version_id;
  if v_template_id is null then
    raise exception 'Version % not found or access denied', p_version_id using errcode='P0002';
  end if;
  update public.alert_org_templates set
    name = v_snapshot->>'name',
    description = v_snapshot->>'description',
    kind = coalesce(v_snapshot->>'kind', 'hms_incident'),
    frameworks = coalesce(array(select jsonb_array_elements_text(v_snapshot->'frameworks')), '{}'::text[]),
    law_refs = coalesce(array(select jsonb_array_elements_text(v_snapshot->'law_refs')), '{}'::text[]),
    default_confidentiality_level = coalesce(v_snapshot->>'default_confidentiality_level', 'restricted'),
    default_retention_years = coalesce((v_snapshot->>'default_retention_years')::integer, 5),
    acknowledgement_due_days = coalesce((v_snapshot->>'acknowledgement_due_days')::integer, 7),
    investigation_due_days = nullif(v_snapshot->>'investigation_due_days', '')::integer,
    requires_dpo = coalesce((v_snapshot->>'requires_dpo')::boolean, false),
    allows_anonymous = coalesce((v_snapshot->>'allows_anonymous')::boolean, true),
    definition = coalesce(v_snapshot->'definition', '{}'::jsonb)
  where id = v_template_id;
  return v_template_id;
end $$;
grant execute on function public.restore_alert_template_version(uuid) to authenticated;

comment on table public.task_template_versions is
  'Append-only snapshot of task template override state on each meaningful update.';
comment on table public.meeting_template_versions is
  'Append-only snapshot of meeting template state on each meaningful update.';
comment on table public.alert_template_versions is
  'Append-only snapshot of alert template state on each meaningful update.';
