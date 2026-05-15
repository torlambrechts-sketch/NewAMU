-- Alerts (Varslinger) module — core schema, RLS, lock trigger, provisioning.
--
-- New top-level module. Unifies AML kap. 2A varsling + GDPR Art. 33 brudd +
-- HMS-avvik + sikkerhets-hendelser + etiske bekymringer as a single template-
-- driven engine. Replaces the legacy whistleblowing_cases + gdpr_breach_incidents
-- tables (data migration in 20260911120010..12; legacy table drops in 20260911120012).
--
-- Tables:
--   * alert_template_categories       — per-org grouping for templates
--   * alert_system_templates          — global catalog (no org_id)
--   * alert_org_template_settings     — per-org toggle / override / pin
--   * alert_org_templates             — per-org custom templates
--   * alert_cases                     — actual incident rows (kind discriminator)
--   * alert_case_notes                — append-only case journal
--   * alert_case_attachments          — pointer rows to private storage bucket
--   * alert_case_timeline_events      — append-only audit trail
--
-- Self-audit (Arbeidstilsynet + Datatilsynet POV — pålegg-grunner addressed):
--   * AML § 2A-7 (5) taushetsplikt om varslerens identitet — lock trigger
--     makes reporter_user_id / reporter_contact / reporter_display_name /
--     is_anonymous IMMUTABLE FROM INSERT (not just post-close). title +
--     description likewise post-close to prevent identity laundering.
--   * AML § 2A-3 aktivitetsplikt — acknowledgement_due_at set at insert from
--     template's acknowledgement_due_days (interpreted as business days via
--     20260911120004_alerts_business_days_helper.sql).
--   * AML § 2A-2 (3) escape-hatch — aml-varsel-mot-leder template routes via
--     alerts.committee_escalated permission (RLS predicate below).
--   * GDPR Art. 33 (1) 72-timersfrist — alert_cases.investigation_due_at
--     computed at insert from template's externalReporting.deadlineHours.
--   * GDPR Art. 33 (5) dokumentasjonsplikt — alert_case_timeline_events is
--     append-only; every state transition leaves a row.
--   * GDPR Art. 5 (1) (e) lagringsbegrensning — retention_until set at
--     close_at; 20260911120005_alerts_retention_purge.sql does the purge.
--   * GDPR Art. 5 (1) (f) konfidensialitet — storage bucket private
--     (20260911120001); RLS gates reads; notes append-only.
--   * IK-f § 5 nr. 7 systematisk gjennomgang — analyse page reads from
--     alert_cases.
--
-- Idempotent + additive. Re-applying this migration is a no-op.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. Categories — per-org grouping for templates                          │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.alert_template_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug            text not null,
  name            text not null,
  description     text,
  position        integer not null default 100,
  is_active       boolean not null default true,
  is_system       boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists alert_template_categories_org_pos_idx
  on public.alert_template_categories (organization_id, position)
  where deleted_at is null and is_active = true;

alter table public.alert_template_categories enable row level security;

drop policy if exists alert_template_categories_select on public.alert_template_categories;
create policy alert_template_categories_select
  on public.alert_template_categories for select
  using (organization_id = public.current_org_id());

drop policy if exists alert_template_categories_write on public.alert_template_categories;
create policy alert_template_categories_write
  on public.alert_template_categories for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.alert_template_categories_before_insert_defaults()
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

drop trigger if exists alert_template_categories_before_insert_defaults_tg
  on public.alert_template_categories;
create trigger alert_template_categories_before_insert_defaults_tg
  before insert on public.alert_template_categories
  for each row execute function public.alert_template_categories_before_insert_defaults();

drop trigger if exists alert_template_categories_set_updated_at on public.alert_template_categories;
create trigger alert_template_categories_set_updated_at
  before update on public.alert_template_categories
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. System templates — global catalog, shipped by platform               │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.alert_system_templates (
  id                          text primary key,            -- stable slug ('aml-varsel-generell')
  slug                        text not null unique,
  label                       text not null,
  description                 text,
  kind                        text not null check (kind in (
                                'whistleblowing','gdpr_breach','hms_incident',
                                'security_incident','ethical_concern')),
  frameworks                  text[] not null default '{}',
  law_refs                    text[] not null default '{}',
  default_category_slug       text,
  default_confidentiality_level text not null default 'restricted'
                                check (default_confidentiality_level in (
                                  'standard','restricted','confidential')),
  default_retention_years     integer not null default 5,
  acknowledgement_due_days    integer not null default 7,
  investigation_due_days      integer,
  requires_dpo                boolean not null default false,
  allows_anonymous            boolean not null default true,
  definition                  jsonb not null default '{}'::jsonb,
  metadata_schema             jsonb not null default '{"fields":[]}'::jsonb,
  is_active                   boolean not null default true,
  sort_order                  integer not null default 100,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

comment on column public.alert_system_templates.definition is
  'Frozen template body. Shape: { preparationGuidance:string, '
  'publicFormFields:[{key,label,kind,required,options?,helpText?,piiHint?}], '
  'defaultCategorySlug?:string, defaultSeverity?:string, '
  'committeeChecklistItems:[{key,label,isMandatory,lawRef?}], '
  'workflowStages:[{status,slaHours?,requiresRoles?}], '
  'escalation:{onAcknowledgementOverdue?:object,onInvestigationOverdue?:object}, '
  'externalReporting:null|{target,deadlineHours,lawRef}, '
  'retaliationProtection:null|{enabled,lawRefs} }';

comment on column public.alert_system_templates.metadata_schema is
  'TemplateMetadataSchema — shape {fields:[{key,kind,label?,help?,required?,options?}]}. '
  'Kinds: location|department|team|text|longtext|number|select|date|severity|breach_type|'
  'affected_categories|boolean.';

create index if not exists alert_system_templates_kind_idx
  on public.alert_system_templates (kind)
  where is_active;

create index if not exists alert_system_templates_sort_idx
  on public.alert_system_templates (sort_order, slug)
  where is_active;

alter table public.alert_system_templates enable row level security;

drop policy if exists alert_system_templates_read_all on public.alert_system_templates;
create policy alert_system_templates_read_all
  on public.alert_system_templates for select
  to authenticated
  using (true);

-- writes restricted to service_role (no policy allowing writes from authenticated)

drop trigger if exists alert_system_templates_set_updated_at on public.alert_system_templates;
create trigger alert_system_templates_set_updated_at
  before update on public.alert_system_templates
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. Org template settings — toggle / override / pin / category per org   │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.alert_org_template_settings (
  organization_id           uuid not null references public.organizations (id) on delete cascade,
  system_template_id        text not null references public.alert_system_templates (id) on delete cascade,
  enabled                   boolean not null default true,
  nav_pinned                boolean not null default false,
  position                  integer not null default 100,
  category_id               uuid references public.alert_template_categories (id) on delete set null,
  override_name             text,
  override_description      text,
  override_definition       jsonb,
  override_metadata_schema  jsonb,
  override_retention_years  integer,                       -- may EXTEND only; trigger below enforces
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  primary key (organization_id, system_template_id)
);

create index if not exists alert_org_template_settings_pinned_idx
  on public.alert_org_template_settings (organization_id, position)
  where enabled = true and nav_pinned = true;

create index if not exists alert_org_template_settings_category_idx
  on public.alert_org_template_settings (category_id)
  where category_id is not null;

alter table public.alert_org_template_settings enable row level security;

drop policy if exists alert_org_template_settings_select on public.alert_org_template_settings;
create policy alert_org_template_settings_select
  on public.alert_org_template_settings for select
  using (organization_id = public.current_org_id());

drop policy if exists alert_org_template_settings_write on public.alert_org_template_settings;
create policy alert_org_template_settings_write
  on public.alert_org_template_settings for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- Retention floor enforcement: override_retention_years cannot be SHORTER than
-- the system template's default. Trigger fires on both insert and update.
create or replace function public.alert_org_template_settings_validate_retention()
returns trigger
language plpgsql
as $$
declare
  v_floor integer;
begin
  if new.override_retention_years is null then
    return new;
  end if;
  select default_retention_years into v_floor
    from public.alert_system_templates
    where id = new.system_template_id;
  if v_floor is null then
    return new;
  end if;
  if new.override_retention_years < v_floor then
    raise exception 'override_retention_years (%) cannot be less than template default (%) — legal-defensibility floor',
      new.override_retention_years, v_floor
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_org_template_settings_validate_retention_tg
  on public.alert_org_template_settings;
create trigger alert_org_template_settings_validate_retention_tg
  before insert or update on public.alert_org_template_settings
  for each row execute function public.alert_org_template_settings_validate_retention();

drop trigger if exists alert_org_template_settings_set_updated_at on public.alert_org_template_settings;
create trigger alert_org_template_settings_set_updated_at
  before update on public.alert_org_template_settings
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. Org custom templates — per-org forks                                 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.alert_org_templates (
  id                          uuid primary key default gen_random_uuid(),
  organization_id             uuid not null references public.organizations (id) on delete cascade,
  slug                        text not null,
  name                        text not null,
  description                 text,
  kind                        text not null check (kind in (
                                'whistleblowing','gdpr_breach','hms_incident',
                                'security_incident','ethical_concern')),
  category_id                 uuid references public.alert_template_categories (id) on delete set null,
  frameworks                  text[] not null default '{}',
  law_refs                    text[] not null default '{}',
  default_confidentiality_level text not null default 'restricted'
                                check (default_confidentiality_level in (
                                  'standard','restricted','confidential')),
  default_retention_years     integer not null default 5,
  acknowledgement_due_days    integer not null default 7,
  investigation_due_days      integer,
  requires_dpo                boolean not null default false,
  allows_anonymous            boolean not null default true,
  definition                  jsonb not null default '{}'::jsonb,
  metadata_schema             jsonb not null default '{"fields":[]}'::jsonb,
  nav_pinned                  boolean not null default false,
  is_active                   boolean not null default true,
  deleted_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists alert_org_templates_org_kind_idx
  on public.alert_org_templates (organization_id, kind)
  where is_active = true and deleted_at is null;

alter table public.alert_org_templates enable row level security;

drop policy if exists alert_org_templates_select on public.alert_org_templates;
create policy alert_org_templates_select
  on public.alert_org_templates for select
  using (organization_id = public.current_org_id());

drop policy if exists alert_org_templates_write on public.alert_org_templates;
create policy alert_org_templates_write
  on public.alert_org_templates for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.alert_org_templates_before_insert_defaults()
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

drop trigger if exists alert_org_templates_before_insert_defaults_tg on public.alert_org_templates;
create trigger alert_org_templates_before_insert_defaults_tg
  before insert on public.alert_org_templates
  for each row execute function public.alert_org_templates_before_insert_defaults();

drop trigger if exists alert_org_templates_set_updated_at on public.alert_org_templates;
create trigger alert_org_templates_set_updated_at
  before update on public.alert_org_templates
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. alert_cases — incident rows (kind discriminator + lock trigger)      │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.alert_cases (
  id                            uuid primary key default gen_random_uuid(),
  organization_id               uuid not null references public.organizations (id) on delete cascade,
  access_key                    uuid not null unique default gen_random_uuid(),
  kind                          text not null check (kind in (
                                  'whistleblowing','gdpr_breach','hms_incident',
                                  'security_incident','ethical_concern')),
  source_kind                   text not null default 'system' check (source_kind in ('system','org')),
  system_template_id            text references public.alert_system_templates (id) on delete set null,
  org_template_id               uuid references public.alert_org_templates (id) on delete set null,
  -- Public-supplied content (whitelisted via §4.3 RPC contract)
  title                         text not null,
  description                   text not null default '',
  category                      text,                       -- legacy free-text snapshot
  category_id                   uuid references public.alert_template_categories (id) on delete set null,
  occurred_at_text              text,
  -- Reporter identity (immutable from insert via lock trigger)
  is_anonymous                  boolean not null default true,
  reporter_contact              text,
  reporter_user_id              uuid references auth.users (id) on delete set null,
  reporter_display_name         text,
  -- Org context (set by committee, mutable post-close per §3.4)
  location_id                   uuid references public.locations (id) on delete set null,
  department_id                 uuid references public.departments (id) on delete set null,
  team_id                       uuid references public.teams (id) on delete set null,
  assigned_committee_member_ids uuid[] not null default '{}',
  metadata                      jsonb not null default '{}'::jsonb,
  -- Workflow
  status                        text not null default 'received'
                                check (status in ('received','triage','investigation',
                                  'internal_review','closed','dismissed')),
  confidentiality_level         text not null default 'restricted'
                                check (confidentiality_level in (
                                  'standard','restricted','confidential')),
  severity                      text check (severity in ('low','medium','high','critical')),
  -- Timeline (acknowledgement_due_at set at insert by trigger from template)
  received_at                   timestamptz not null default now(),
  acknowledgement_due_at        timestamptz not null,
  investigation_due_at          timestamptz,                -- e.g. GDPR 72h
  acknowledged_at               timestamptz,
  closed_at                     timestamptz,                -- LOCK MARKER
  closing_summary               text,
  closing_outcome               text check (closing_outcome in (
                                  'substantiated','unsubstantiated','inconclusive','referred')),
  -- GDPR-breach specific (nullable when kind <> 'gdpr_breach')
  breach_type                   text check (breach_type in (
                                  'confidentiality','integrity','availability','combined')),
  affected_categories           text[],
  affected_subjects_estimate    integer,
  affected_subjects_actual      integer,
  risk_assessment               text,
  mitigation_actions            text,
  datatilsynet_reported_at      timestamptz,
  datatilsynet_reference        text,
  data_subjects_notified_at     timestamptz,
  -- Retention
  retention_until               timestamptz,                -- set at close_at
  redacted_at                   timestamptz,                -- set by purge fn
  -- Snapshots
  definition_snapshot           jsonb,
  metadata_schema_snapshot      jsonb,
  -- Audit
  submission_user_agent         text,                       -- never set for anonymous
  submission_locale             text,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index if not exists alert_cases_org_status_idx
  on public.alert_cases (organization_id, status, received_at desc);

create index if not exists alert_cases_org_kind_idx
  on public.alert_cases (organization_id, kind);

create index if not exists alert_cases_acknowledgement_due_idx
  on public.alert_cases (organization_id, acknowledgement_due_at)
  where status in ('received','triage');

create index if not exists alert_cases_investigation_due_idx
  on public.alert_cases (organization_id, investigation_due_at)
  where investigation_due_at is not null and status not in ('closed','dismissed');

create index if not exists alert_cases_retention_idx
  on public.alert_cases (retention_until)
  where retention_until is not null and redacted_at is null;

create index if not exists alert_cases_committee_idx
  on public.alert_cases using gin (assigned_committee_member_ids);

alter table public.alert_cases enable row level security;

-- RLS: reads gated by confidentiality_level + alerts.* permissions.
-- Authenticated employees can read their own submission (reporter_user_id = auth.uid()).
drop policy if exists alert_cases_select on public.alert_cases;
create policy alert_cases_select
  on public.alert_cases for select
  using (
    organization_id = public.current_org_id()
    and (
      reporter_user_id = auth.uid()
      or (
        confidentiality_level = 'standard'
        and (public.is_org_admin() or public.user_has_permission('alerts.committee'))
      )
      or (
        confidentiality_level = 'restricted'
        and (public.is_org_admin() or public.user_has_permission('alerts.committee'))
      )
      or (
        confidentiality_level = 'confidential'
        and public.user_has_permission('alerts.committee_confidential')
      )
      or (
        kind = 'whistleblowing'
        and system_template_id = 'aml-varsel-mot-leder'
        and public.user_has_permission('alerts.committee_escalated')
      )
    )
  );

drop policy if exists alert_cases_insert_committee on public.alert_cases;
create policy alert_cases_insert_committee
  on public.alert_cases for insert
  with check (
    organization_id = public.current_org_id()
    and (
      -- authenticated reporter (employee submits via UI)
      reporter_user_id = auth.uid()
      -- or committee creating a case manually
      or (public.is_org_admin() or public.user_has_permission('alerts.committee'))
    )
  );

drop policy if exists alert_cases_update_committee on public.alert_cases;
create policy alert_cases_update_committee
  on public.alert_cases for update
  using (
    organization_id = public.current_org_id()
    and (
      (confidentiality_level <> 'confidential'
        and (public.is_org_admin() or public.user_has_permission('alerts.committee')))
      or (confidentiality_level = 'confidential'
        and public.user_has_permission('alerts.committee_confidential'))
      or (kind = 'whistleblowing' and system_template_id = 'aml-varsel-mot-leder'
        and public.user_has_permission('alerts.committee_escalated'))
    )
  )
  with check (organization_id = public.current_org_id());

-- BEFORE INSERT: set org_id from session if absent; set acknowledgement_due_at + investigation_due_at
-- + retention defaults from template.
create or replace function public.alert_cases_before_insert_defaults()
returns trigger
language plpgsql
as $$
declare
  v_tpl record;
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;

  -- Resolve template (system or org) and pull defaults.
  if new.source_kind = 'system' and new.system_template_id is not null then
    select acknowledgement_due_days, investigation_due_days, default_confidentiality_level,
           default_retention_years, definition, metadata_schema, kind
      into v_tpl
      from public.alert_system_templates
      where id = new.system_template_id;
  elsif new.source_kind = 'org' and new.org_template_id is not null then
    select acknowledgement_due_days, investigation_due_days, default_confidentiality_level,
           default_retention_years, definition, metadata_schema, kind
      into v_tpl
      from public.alert_org_templates
      where id = new.org_template_id;
  end if;

  -- Acknowledgement deadline (business days helper if available, else calendar)
  if new.acknowledgement_due_at is null then
    if v_tpl.acknowledgement_due_days is not null then
      begin
        new.acknowledgement_due_at := public.add_business_days(
          coalesce(new.received_at, now()), v_tpl.acknowledgement_due_days);
      exception when undefined_function then
        new.acknowledgement_due_at := coalesce(new.received_at, now())
          + (v_tpl.acknowledgement_due_days || ' days')::interval;
      end;
    else
      new.acknowledgement_due_at := coalesce(new.received_at, now()) + interval '7 days';
    end if;
  end if;

  -- Investigation deadline (GDPR 72h, etc) — pulled from definition.externalReporting.deadlineHours
  if new.investigation_due_at is null and v_tpl.definition is not null then
    if v_tpl.definition ? 'externalReporting'
       and v_tpl.definition->'externalReporting' is not null
       and v_tpl.definition->'externalReporting' ? 'deadlineHours' then
      new.investigation_due_at := coalesce(new.received_at, now())
        + ((v_tpl.definition->'externalReporting'->>'deadlineHours')::int || ' hours')::interval;
    elsif v_tpl.investigation_due_days is not null then
      new.investigation_due_at := coalesce(new.received_at, now())
        + (v_tpl.investigation_due_days || ' days')::interval;
    end if;
  end if;

  -- Confidentiality level from template default if not provided
  if new.confidentiality_level is null then
    new.confidentiality_level := coalesce(v_tpl.default_confidentiality_level, 'restricted');
  end if;

  -- Snapshot the template definition + schema for forensic integrity
  if new.definition_snapshot is null and v_tpl.definition is not null then
    new.definition_snapshot := v_tpl.definition;
  end if;
  if new.metadata_schema_snapshot is null and v_tpl.metadata_schema is not null then
    new.metadata_schema_snapshot := v_tpl.metadata_schema;
  end if;

  -- Kind discriminator must match template's declared kind
  if v_tpl.kind is not null and new.kind is distinct from v_tpl.kind then
    new.kind := v_tpl.kind;
  end if;

  return new;
end;
$$;

drop trigger if exists alert_cases_before_insert_defaults_tg on public.alert_cases;
create trigger alert_cases_before_insert_defaults_tg
  before insert on public.alert_cases
  for each row execute function public.alert_cases_before_insert_defaults();

-- BEFORE UPDATE lock trigger — enforces §3.4 contract.
-- Identity-bearing columns immutable FROM INSERT (not just post-close).
-- title + description immutable post-close (identity-laundering prevention).
create or replace function public.alert_cases_before_update_defaults()
returns trigger
language plpgsql
as $$
begin
  -- Always immutable (from insert through purge)
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is immutable on alert_cases';
  end if;
  if new.access_key is distinct from old.access_key then
    raise exception 'access_key is immutable on alert_cases';
  end if;
  if new.kind is distinct from old.kind then
    raise exception 'kind is immutable on alert_cases';
  end if;
  if new.source_kind is distinct from old.source_kind then
    raise exception 'source_kind is immutable on alert_cases';
  end if;
  if new.system_template_id is distinct from old.system_template_id then
    raise exception 'system_template_id is immutable on alert_cases';
  end if;
  if new.org_template_id is distinct from old.org_template_id then
    raise exception 'org_template_id is immutable on alert_cases';
  end if;
  if new.received_at is distinct from old.received_at then
    raise exception 'received_at is immutable on alert_cases';
  end if;
  -- Reporter identity — IMMUTABLE FROM INSERT to prevent post-hoc de-anonymisation
  -- (§3.4 §4.1 T2). Purge function bypasses via app.alerts_purge_active flag.
  if (coalesce(current_setting('app.alerts_purge_active', true), 'false') <> 'true') then
    if new.is_anonymous is distinct from old.is_anonymous then
      raise exception 'is_anonymous is immutable on alert_cases'
        using errcode = 'check_violation';
    end if;
    if new.reporter_user_id is distinct from old.reporter_user_id then
      raise exception 'reporter_user_id is immutable on alert_cases'
        using errcode = 'check_violation';
    end if;
    if new.reporter_contact is distinct from old.reporter_contact then
      raise exception 'reporter_contact is immutable on alert_cases'
        using errcode = 'check_violation';
    end if;
    if new.reporter_display_name is distinct from old.reporter_display_name then
      raise exception 'reporter_display_name is immutable on alert_cases'
        using errcode = 'check_violation';
    end if;
    if new.confidentiality_level is distinct from old.confidentiality_level then
      raise exception 'confidentiality_level is immutable on alert_cases (clone case at new level if needed)'
        using errcode = 'check_violation';
    end if;
    if new.acknowledgement_due_at is distinct from old.acknowledgement_due_at then
      raise exception 'acknowledgement_due_at is immutable on alert_cases'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Post-close lock — reporter-supplied free-text + canonical close fields
  if old.closed_at is not null
     and coalesce(current_setting('app.alerts_purge_active', true), 'false') <> 'true' then
    if new.title is distinct from old.title then
      raise exception 'alert_cases.title is immutable post-close (corrections via note)'
        using errcode = 'check_violation';
    end if;
    if new.description is distinct from old.description then
      raise exception 'alert_cases.description is immutable post-close (corrections via note)'
        using errcode = 'check_violation';
    end if;
    if new.closed_at is null then
      raise exception 'closed_at cannot revert to null on alert_cases'
        using errcode = 'check_violation';
    end if;
    if new.closing_summary is distinct from old.closing_summary then
      raise exception 'closing_summary is immutable post-close on alert_cases'
        using errcode = 'check_violation';
    end if;
    if new.closing_outcome is distinct from old.closing_outcome then
      raise exception 'closing_outcome is immutable post-close on alert_cases'
        using errcode = 'check_violation';
    end if;
    if new.status not in ('closed','dismissed') then
      raise exception 'status cannot revert from closed state on alert_cases'
        using errcode = 'check_violation';
    end if;
    if new.severity is distinct from old.severity then
      raise exception 'severity is immutable post-close on alert_cases'
        using errcode = 'check_violation';
    end if;
    if new.breach_type is distinct from old.breach_type then
      raise exception 'breach_type is immutable post-close on alert_cases'
        using errcode = 'check_violation';
    end if;
    if new.affected_subjects_actual is distinct from old.affected_subjects_actual then
      raise exception 'affected_subjects_actual is immutable post-close on alert_cases'
        using errcode = 'check_violation';
    end if;
    if new.datatilsynet_reported_at is distinct from old.datatilsynet_reported_at then
      raise exception 'datatilsynet_reported_at is immutable post-close on alert_cases'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Auto-compute retention_until on first close (open → closed transition)
  if old.closed_at is null and new.closed_at is not null and new.retention_until is null then
    new.retention_until := new.closed_at
      + ((coalesce(
            (select coalesce(s.override_retention_years, t.default_retention_years)
               from public.alert_system_templates t
               left join public.alert_org_template_settings s
                 on s.organization_id = new.organization_id
                and s.system_template_id = t.id
               where t.id = new.system_template_id),
            5))::text || ' years')::interval;
  end if;

  return new;
end;
$$;

drop trigger if exists alert_cases_before_update_defaults_tg on public.alert_cases;
create trigger alert_cases_before_update_defaults_tg
  before update on public.alert_cases
  for each row execute function public.alert_cases_before_update_defaults();

drop trigger if exists alert_cases_set_updated_at on public.alert_cases;
create trigger alert_cases_set_updated_at
  before update on public.alert_cases
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 6. alert_case_notes — append-only case journal                          │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.alert_case_notes (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references public.alert_cases (id) on delete cascade,
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  author_id           uuid references auth.users (id) on delete set null,
  body                text not null,
  note_kind           text not null default 'internal'
                        check (note_kind in (
                          'internal','communication_to_reporter',
                          'communication_from_reporter','system')),
  visible_to_reporter boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists alert_case_notes_case_idx
  on public.alert_case_notes (case_id, created_at);

alter table public.alert_case_notes enable row level security;

drop policy if exists alert_case_notes_select on public.alert_case_notes;
create policy alert_case_notes_select
  on public.alert_case_notes for select
  using (exists (select 1 from public.alert_cases c where c.id = case_id));

drop policy if exists alert_case_notes_insert on public.alert_case_notes;
create policy alert_case_notes_insert
  on public.alert_case_notes for insert
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.committee_escalated')
    )
  );

-- Append-only: reject UPDATE + DELETE. Purge function bypasses via app.alerts_purge_active flag.
create or replace function public.alert_case_notes_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return coalesce(new, old);
  end if;
  raise exception 'alert_case_notes is append-only (TG_OP=%)', TG_OP
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists alert_case_notes_no_upd on public.alert_case_notes;
create trigger alert_case_notes_no_upd
  before update on public.alert_case_notes
  for each row execute function public.alert_case_notes_reject_mutation();

drop trigger if exists alert_case_notes_no_del on public.alert_case_notes;
create trigger alert_case_notes_no_del
  before delete on public.alert_case_notes
  for each row execute function public.alert_case_notes_reject_mutation();

-- Post-close gate (§3.5 T11 retroactive-leak): inserts with
-- visible_to_reporter=true on a closed case require committee_confidential.
create or replace function public.alert_case_notes_validate_post_close_visibility()
returns trigger
language plpgsql
as $$
declare
  v_closed_at timestamptz;
begin
  if new.visible_to_reporter = false then
    return new;
  end if;
  select closed_at into v_closed_at
    from public.alert_cases
    where id = new.case_id;
  if v_closed_at is null then
    return new;
  end if;
  if not public.user_has_permission('alerts.committee_confidential') then
    raise exception 'visible_to_reporter=true on a closed case requires alerts.committee_confidential (T11 leak gate)'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_case_notes_validate_post_close_visibility_tg
  on public.alert_case_notes;
create trigger alert_case_notes_validate_post_close_visibility_tg
  before insert on public.alert_case_notes
  for each row execute function public.alert_case_notes_validate_post_close_visibility();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 7. alert_case_attachments — pointer rows to private storage bucket      │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.alert_case_attachments (
  id                   uuid primary key default gen_random_uuid(),
  case_id              uuid not null references public.alert_cases (id) on delete cascade,
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  storage_bucket       text not null default 'alert-attachments',
  storage_path         text,                                  -- nullable so retention purge can null
  uploaded_by_user_id  uuid references auth.users (id) on delete set null,
  filename             text not null,
  content_type         text,
  size_bytes           bigint,
  sha256_hex           text,
  is_redacted          boolean not null default false,
  created_at           timestamptz not null default now()
);

create index if not exists alert_case_attachments_case_idx
  on public.alert_case_attachments (case_id, created_at)
  where is_redacted = false;

-- Path is unique within a case while not redacted
create unique index if not exists alert_case_attachments_path_uidx
  on public.alert_case_attachments (case_id, storage_path)
  where storage_path is not null;

alter table public.alert_case_attachments enable row level security;

drop policy if exists alert_case_attachments_select on public.alert_case_attachments;
create policy alert_case_attachments_select
  on public.alert_case_attachments for select
  using (exists (select 1 from public.alert_cases c where c.id = case_id));

drop policy if exists alert_case_attachments_write on public.alert_case_attachments;
create policy alert_case_attachments_write
  on public.alert_case_attachments for all
  using (exists (select 1 from public.alert_cases c where c.id = case_id))
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('alerts.committee')
      or public.user_has_permission('alerts.committee_confidential')
    )
  );

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 8. alert_case_timeline_events — append-only audit trail                 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.alert_case_timeline_events (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.alert_cases (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_kind      text not null check (event_kind in (
                    'submitted','acknowledged','assigned','escalated',
                    'status_changed','severity_set','attachment_added',
                    'note_added_public','note_added_internal',
                    'closed','reopened','retention_purged','erased')),
  actor_kind      text check (actor_kind in ('reporter','committee','system')),
  actor_user_id   uuid references auth.users (id) on delete set null,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists alert_case_timeline_events_case_idx
  on public.alert_case_timeline_events (case_id, created_at);

alter table public.alert_case_timeline_events enable row level security;

drop policy if exists alert_case_timeline_events_select on public.alert_case_timeline_events;
create policy alert_case_timeline_events_select
  on public.alert_case_timeline_events for select
  using (exists (select 1 from public.alert_cases c where c.id = case_id));

drop policy if exists alert_case_timeline_events_insert on public.alert_case_timeline_events;
create policy alert_case_timeline_events_insert
  on public.alert_case_timeline_events for insert
  with check (organization_id = public.current_org_id());

-- Append-only on timeline events too
create or replace function public.alert_case_timeline_events_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.alerts_purge_active', true), 'false') = 'true' then
    return coalesce(new, old);
  end if;
  raise exception 'alert_case_timeline_events is append-only (TG_OP=%)', TG_OP
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists alert_case_timeline_events_no_upd on public.alert_case_timeline_events;
create trigger alert_case_timeline_events_no_upd
  before update on public.alert_case_timeline_events
  for each row execute function public.alert_case_timeline_events_reject_mutation();

drop trigger if exists alert_case_timeline_events_no_del on public.alert_case_timeline_events;
create trigger alert_case_timeline_events_no_del
  before delete on public.alert_case_timeline_events
  for each row execute function public.alert_case_timeline_events_reject_mutation();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 9. Provision function — baseline categories + settings per org          │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.provision_alerts_baseline_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat_aml_varsling  uuid;
  v_cat_gdpr_brudd    uuid;
  v_cat_hms_avvik     uuid;
  v_cat_sikkerhet     uuid;
  v_cat_etisk         uuid;
begin
  -- 1. Default categories (idempotent via unique (org, slug))
  insert into public.alert_template_categories
    (organization_id, slug, name, description, position, is_system)
  values
    (p_org_id, 'aml-varsling',
     'AML — varsling kap. 2A',
     'Kritikkverdige forhold etter arbeidsmiljøloven.', 10, true),
    (p_org_id, 'gdpr-brudd',
     'GDPR — brudd på personvern',
     'Art. 33/34 hendelsesregister med 72-timersfrist.', 20, true),
    (p_org_id, 'hms-avvik',
     'HMS-avvik',
     'Personskader, nestenulykker og yrkeshygieniske forhold.', 30, true),
    (p_org_id, 'sikkerhet',
     'Sikkerhet',
     'Fysiske + IT-sikkerhetshendelser utenfor GDPR.', 40, true),
    (p_org_id, 'etisk',
     'Etiske bekymringer',
     'Forhold uten klart lovbrudd men i strid med etikk.', 50, true)
  on conflict (organization_id, slug) do nothing;

  select id into v_cat_aml_varsling from public.alert_template_categories
    where organization_id = p_org_id and slug = 'aml-varsling';
  select id into v_cat_gdpr_brudd from public.alert_template_categories
    where organization_id = p_org_id and slug = 'gdpr-brudd';
  select id into v_cat_hms_avvik from public.alert_template_categories
    where organization_id = p_org_id and slug = 'hms-avvik';
  select id into v_cat_sikkerhet from public.alert_template_categories
    where organization_id = p_org_id and slug = 'sikkerhet';
  select id into v_cat_etisk from public.alert_template_categories
    where organization_id = p_org_id and slug = 'etisk';

  -- 2. Settings row per system template (idempotent via composite PK).
  -- All templates enabled + pinned by default; admin can disable later.
  insert into public.alert_org_template_settings
    (organization_id, system_template_id, enabled, nav_pinned, position, category_id)
  select
    p_org_id,
    t.id,
    true,
    true,
    t.sort_order,
    case t.default_category_slug
      when 'aml-varsling' then v_cat_aml_varsling
      when 'gdpr-brudd'   then v_cat_gdpr_brudd
      when 'hms-avvik'    then v_cat_hms_avvik
      when 'sikkerhet'    then v_cat_sikkerhet
      when 'etisk'        then v_cat_etisk
      else null
    end
  from public.alert_system_templates t
  where t.is_active = true
  on conflict (organization_id, system_template_id) do nothing;
end;
$$;

revoke all on function public.provision_alerts_baseline_for_org(uuid) from public, anon;
grant execute on function public.provision_alerts_baseline_for_org(uuid) to authenticated, service_role;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 10. Trigger: new-org auto-baseline                                      │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.alerts_provision_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.provision_alerts_baseline_for_org(new.id);
  return new;
end;
$$;

drop trigger if exists alerts_provision_on_org_insert_tg on public.organizations;
create trigger alerts_provision_on_org_insert_tg
  after insert on public.organizations
  for each row execute function public.alerts_provision_on_org_insert();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 11. Backfill — every existing org (idempotent; safe to re-run)          │
-- ╰─────────────────────────────────────────────────────────────────────────╯
--
-- Runs *before* seed migration 20260911120006. At first apply, the
-- system-templates table is empty, so the settings-loop is a no-op. The
-- seed migration re-runs provision_alerts_baseline_for_org for every org
-- after inserting the templates, which then fills in the settings rows.

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.provision_alerts_baseline_for_org(v_org.id);
  end loop;
end $$;
