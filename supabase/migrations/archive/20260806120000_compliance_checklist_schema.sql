-- Compliance Checklist primitive — schema, RLS, triggers, audit.
--
-- Introduces three regulation-agnostic tables:
--   compliance_checklist_templates   — reusable checklist definitions, tagged by pack
--   compliance_checklist_executions  — one filled-out checklist instance
--   compliance_checklist_responses   — one row per answered checklist item
--
-- Reuses existing types: public.inspection_finding_severity (matches deviations FK)
--                       public.inspection_round_status      ('draft','active','signed')
-- Introduces:           public.compliance_pack              ('aml-amu','iso-45001')
--
-- Lives alongside inspection_*, vernerunder_*, sja_* — does not modify them.
-- All tables: organization-scoped via RLS, audit-logged via hse_audit_trigger,
--             updated_at maintained via shared set_updated_at().
-- Executions: pack frozen from template at insert; signed status freezes the row
--             and snapshots definition into definition_snapshot.
-- Responses:  blocked from writing to a signed execution; severity NOT NULL flags a finding.

-- ── Enum: compliance_pack ───────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_pack') then
    create type public.compliance_pack as enum ('aml-amu', 'iso-45001');
  end if;
end $$;

-- ── 1. compliance_checklist_templates ───────────────────────────────────────

create table if not exists public.compliance_checklist_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pack            public.compliance_pack not null,
  slug            text not null,
  name            text not null,
  description     text,
  definition      jsonb not null default '{"items":[]}'::jsonb,
  is_active       boolean not null default true,
  deleted_at      timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug),
  check (jsonb_typeof(definition->'items') = 'array')
);

create index if not exists compliance_checklist_templates_org_pack_idx
  on public.compliance_checklist_templates (organization_id, pack, is_active);

alter table public.compliance_checklist_templates enable row level security;

drop policy if exists compliance_checklist_templates_select_org on public.compliance_checklist_templates;
create policy compliance_checklist_templates_select_org
  on public.compliance_checklist_templates for select
  using (organization_id = public.current_org_id());

drop policy if exists compliance_checklist_templates_write_org on public.compliance_checklist_templates;
create policy compliance_checklist_templates_write_org
  on public.compliance_checklist_templates for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.compliance_checklist_templates_before_insert_defaults()
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

drop trigger if exists compliance_checklist_templates_before_insert_defaults_tg on public.compliance_checklist_templates;
create trigger compliance_checklist_templates_before_insert_defaults_tg
  before insert on public.compliance_checklist_templates
  for each row execute function public.compliance_checklist_templates_before_insert_defaults();

drop trigger if exists compliance_checklist_templates_set_updated_at on public.compliance_checklist_templates;
create trigger compliance_checklist_templates_set_updated_at
  before update on public.compliance_checklist_templates
  for each row execute function public.set_updated_at();

drop trigger if exists compliance_checklist_templates_audit_tg on public.compliance_checklist_templates;
create trigger compliance_checklist_templates_audit_tg
  after insert or update or delete on public.compliance_checklist_templates
  for each row execute function public.hse_audit_trigger();

-- ── 2. compliance_checklist_executions ──────────────────────────────────────

create table if not exists public.compliance_checklist_executions (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  template_id         uuid not null references public.compliance_checklist_templates (id) on delete restrict,
  pack                public.compliance_pack not null,
  title               text not null,
  status              public.inspection_round_status not null default 'draft',
  assigned_to         uuid references auth.users (id) on delete set null,
  scheduled_for       timestamptz,
  signed_at           timestamptz,
  signed_by           uuid references auth.users (id) on delete set null,
  definition_snapshot jsonb,
  summary             text,
  deleted_at          timestamptz,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Sign integrity: the three sign-time fields are populated together or not at all.
  check (
    (status = 'signed') = (signed_at is not null and definition_snapshot is not null)
  )
);

create index if not exists compliance_checklist_executions_org_pack_status_idx
  on public.compliance_checklist_executions (organization_id, pack, status, scheduled_for desc);
create index if not exists compliance_checklist_executions_template_idx
  on public.compliance_checklist_executions (template_id, created_at desc);

alter table public.compliance_checklist_executions enable row level security;

drop policy if exists compliance_checklist_executions_select_org on public.compliance_checklist_executions;
create policy compliance_checklist_executions_select_org
  on public.compliance_checklist_executions for select
  using (organization_id = public.current_org_id());

drop policy if exists compliance_checklist_executions_write_org on public.compliance_checklist_executions;
create policy compliance_checklist_executions_write_org
  on public.compliance_checklist_executions for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- BEFORE INSERT: org/created_by defaults + pack frozen from template.
create or replace function public.compliance_checklist_executions_before_insert_defaults()
returns trigger
language plpgsql
as $$
declare
  v_pack public.compliance_pack;
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  select pack into v_pack
  from public.compliance_checklist_templates
  where id = new.template_id;

  if v_pack is null then
    raise exception 'Template % not found for compliance_checklist_executions insert', new.template_id;
  end if;

  -- Always derive pack from template, ignoring caller value.
  new.pack := v_pack;
  return new;
end;
$$;

drop trigger if exists compliance_checklist_executions_before_insert_defaults_tg on public.compliance_checklist_executions;
create trigger compliance_checklist_executions_before_insert_defaults_tg
  before insert on public.compliance_checklist_executions
  for each row execute function public.compliance_checklist_executions_before_insert_defaults();

-- BEFORE UPDATE: signed-immutability + sign-snapshot.
create or replace function public.compliance_checklist_executions_before_update_defaults()
returns trigger
language plpgsql
as $$
declare
  v_def jsonb;
begin
  -- Once signed, the row is permanently locked.
  if old.status = 'signed' then
    raise exception 'Execution % is signed; updates not permitted', old.id
      using errcode = 'check_violation';
  end if;

  -- pack and template_id are frozen for the lifetime of the execution.
  if new.pack <> old.pack then
    raise exception 'pack is immutable on compliance_checklist_executions';
  end if;
  if new.template_id <> old.template_id then
    raise exception 'template_id is immutable on compliance_checklist_executions';
  end if;

  -- Sign transition: snapshot definition + stamp signer.
  if new.status = 'signed' and old.status <> 'signed' then
    if new.signed_at is null then
      new.signed_at := now();
    end if;
    if new.signed_by is null then
      new.signed_by := auth.uid();
    end if;
    if new.definition_snapshot is null then
      select definition into v_def
      from public.compliance_checklist_templates
      where id = new.template_id;
      new.definition_snapshot := v_def;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists compliance_checklist_executions_before_update_defaults_tg on public.compliance_checklist_executions;
create trigger compliance_checklist_executions_before_update_defaults_tg
  before update on public.compliance_checklist_executions
  for each row execute function public.compliance_checklist_executions_before_update_defaults();

drop trigger if exists compliance_checklist_executions_set_updated_at on public.compliance_checklist_executions;
create trigger compliance_checklist_executions_set_updated_at
  before update on public.compliance_checklist_executions
  for each row execute function public.set_updated_at();

drop trigger if exists compliance_checklist_executions_audit_tg on public.compliance_checklist_executions;
create trigger compliance_checklist_executions_audit_tg
  after insert or update or delete on public.compliance_checklist_executions
  for each row execute function public.hse_audit_trigger();

-- ── 3. compliance_checklist_responses ───────────────────────────────────────

create table if not exists public.compliance_checklist_responses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  execution_id    uuid not null references public.compliance_checklist_executions (id) on delete cascade,
  item_key        text not null,
  value           jsonb not null,
  comment         text,
  severity        public.inspection_finding_severity,
  is_finding      boolean generated always as (severity is not null) stored,
  deviation_id    uuid references public.deviations (id) on delete set null,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (execution_id, item_key)
);

create index if not exists compliance_checklist_responses_exec_idx
  on public.compliance_checklist_responses (execution_id);
create index if not exists compliance_checklist_responses_org_finding_idx
  on public.compliance_checklist_responses (organization_id, is_finding, severity, created_at desc);

alter table public.compliance_checklist_responses enable row level security;

drop policy if exists compliance_checklist_responses_select_org on public.compliance_checklist_responses;
create policy compliance_checklist_responses_select_org
  on public.compliance_checklist_responses for select
  using (organization_id = public.current_org_id());

drop policy if exists compliance_checklist_responses_write_org on public.compliance_checklist_responses;
create policy compliance_checklist_responses_write_org
  on public.compliance_checklist_responses for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- BEFORE INSERT/UPDATE: derive org_id from parent execution + reject writes to signed executions.
create or replace function public.compliance_checklist_responses_before_write()
returns trigger
language plpgsql
as $$
declare
  v_exec record;
begin
  select e.organization_id, e.status
  into v_exec
  from public.compliance_checklist_executions e
  where e.id = new.execution_id;

  if v_exec.organization_id is null then
    raise exception 'Execution % not found for compliance_checklist_responses write', new.execution_id;
  end if;

  if v_exec.status = 'signed' then
    raise exception 'Execution % is signed; responses are immutable', new.execution_id
      using errcode = 'check_violation';
  end if;

  if new.organization_id is null then
    new.organization_id := v_exec.organization_id;
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists compliance_checklist_responses_before_insert_tg on public.compliance_checklist_responses;
create trigger compliance_checklist_responses_before_insert_tg
  before insert on public.compliance_checklist_responses
  for each row execute function public.compliance_checklist_responses_before_write();

drop trigger if exists compliance_checklist_responses_before_update_tg on public.compliance_checklist_responses;
create trigger compliance_checklist_responses_before_update_tg
  before update on public.compliance_checklist_responses
  for each row execute function public.compliance_checklist_responses_before_write();

drop trigger if exists compliance_checklist_responses_set_updated_at on public.compliance_checklist_responses;
create trigger compliance_checklist_responses_set_updated_at
  before update on public.compliance_checklist_responses
  for each row execute function public.set_updated_at();

drop trigger if exists compliance_checklist_responses_audit_tg on public.compliance_checklist_responses;
create trigger compliance_checklist_responses_audit_tg
  after insert or update or delete on public.compliance_checklist_responses
  for each row execute function public.hse_audit_trigger();
