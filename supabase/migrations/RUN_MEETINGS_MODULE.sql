-- ============================================================================
-- MEETINGS MODULE — CONSOLIDATED MIGRATION BUNDLE
-- ============================================================================
--
-- Paste this entire file into the Supabase SQL editor → Run.
--
-- Bundles every meetings-module migration in basename order. Each section
-- is individually idempotent (CREATE … IF NOT EXISTS, INSERT … ON CONFLICT,
-- WHERE-guarded UPDATE / DELETE). Re-applying the bundle is a no-op.
--
-- Sections (in apply order):
--   20260901120000  meetings_module_core (10 tables + RLS + triggers + provision fn)
--   20260901120001  meetings_seed_system_templates (18 system templates)
--   20260901120010  survey_elections_placeholder (amu-valg-system catalog row)
--   20260901120020  drop_legacy_amu_council_tables
--   20260901120030  meetings_default_role_seed (org-create RPC + backfill)
--   20260901120040  meetings_template_citation_fixes (H1)
--   20260901120041  meetings_template_topic_completions (H2)
--   20260901120042  meetings_template_mandatory_honesty (H2b)
--   20260901120043  meetings_template_iso_gdpr_completeness (H3)
--   20260901120044  meetings_extend_attendee_roles (H4)
--   20260901120045  meetings_likestilling_cadence (H5)
--   20260901120046  meetings_template_default_confidentiality (H7)
--   20260901120047  meetings_template_min_employee_count (H8)
--   20260901120048  meetings_agenda_binding_snapshot (H9a)
--   20260901120049  meetings_amu_arsmote_v2 (H10)
--
-- ============================================================================


-- ============================================================================
-- FROM: 20260901120000_meetings_module_core.sql
-- ============================================================================

-- Meetings (Møter) module — core schema, RLS, lock trigger, provisioning.
--
-- New top-level module. Generalises AMU + bedriftsutvalg + verneombud + drøfting
-- + ISO management reviews + GDPR DPIA/ROPA reviews as a single template-driven
-- engine. Mirrors the compliance + documents architecture:
--   * `meeting_system_templates`            — global catalog (no org_id)
--   * `meeting_org_template_settings`       — per-org toggle / override / pin
--   * `meeting_org_templates`               — per-org custom templates
--   * `meeting_template_categories`         — per-org grouping
--   * `meetings`                            — actual instances (one row per meeting)
--   * `meeting_agenda_items`                — structured agenda + per-item minutes
--   * `meeting_attendees`                   — invitation + attendance roster
--   * `meeting_decisions`                   — global Vedtaksregister (queryable)
--   * `meeting_action_items`                — link to tasks module
--   * `meeting_signatures`                  — protocol confirmation (eSign-ready)
--
-- Self-audit (Arbeidstilsynet POV — pålegg-grunner addressed):
--   * AML § 7-2 (2) mandatory annual topics — encoded via `definition.agendaItems[].isMandatory`
--     on system templates; surfaced as "Manglende obligatoriske saker"-badge in UI.
--   * AML § 7-2 (6) annual report — `meeting_decisions` materialised globally so
--     the AMU årsrapport can be auto-populated from meeting data.
--   * AML § 6-2 verneombud meeting cadence — `cadence_hint = quarterly` on the
--     verneombud-mote system template.
--   * Forskrift om org. ledelse § 3-2 — 7-day invitation rule encoded as
--     `definition.invitationLeadDays = 7`; the UI flags `invitation_sent_at` -
--     `scheduled_at` < lead days as a red badge.
--   * AML § 8-2 / § 15-1 drøftingsplikt — `drofting-omstilling` template forces
--     mandatory "Begrunnelse / Alternativer / Konsekvenser / Ansattes synspunkter".
--   * Likestillingsloven § 26a aktivitetsplikt — `drofting-likestilling` template
--     enforces annual cadence + lønnskartlegging agenda item.
--   * AML § 2A-7 (5) varslingsutvalg — separate template with COI + confidentiality
--     enforced at RLS level via `confidentiality_level`.
--   * ORG_ACCESS_CONTROL_ANALYSIS gap on drøftelsessamtaler — closed via
--     `confidentiality_level` column + RLS predicate (participants + creator +
--     `meetings.manage_confidential` permission).
--
-- Idempotent + additive. Re-applying this migration is a no-op.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. Categories — per-org grouping for templates                          │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.meeting_template_categories (
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

create index if not exists meeting_template_categories_org_pos_idx
  on public.meeting_template_categories (organization_id, position)
  where deleted_at is null and is_active = true;

alter table public.meeting_template_categories enable row level security;

drop policy if exists meeting_template_categories_select on public.meeting_template_categories;
create policy meeting_template_categories_select
  on public.meeting_template_categories for select
  using (organization_id = public.current_org_id());

drop policy if exists meeting_template_categories_write on public.meeting_template_categories;
create policy meeting_template_categories_write
  on public.meeting_template_categories for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.meeting_template_categories_before_insert_defaults()
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

drop trigger if exists meeting_template_categories_before_insert_defaults_tg
  on public.meeting_template_categories;
create trigger meeting_template_categories_before_insert_defaults_tg
  before insert on public.meeting_template_categories
  for each row execute function public.meeting_template_categories_before_insert_defaults();

drop trigger if exists meeting_template_categories_set_updated_at on public.meeting_template_categories;
create trigger meeting_template_categories_set_updated_at
  before update on public.meeting_template_categories
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. System templates — global catalog, shipped by platform               │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.meeting_system_templates (
  id              text primary key,             -- stable slug ('amu-arsrapport-q4')
  slug            text not null unique,
  label           text not null,
  description     text,
  framework       text not null default 'INTERNAL',   -- primary framework
  frameworks      text[] not null default '{}',       -- ['AML','IK-f'] etc
  law_refs        text[] not null default '{}',       -- ['AML § 7-2','IK-f § 5 nr. 7']
  cadence_hint    text,                               -- 'monthly'|'quarterly'|'semiannual'|'annual'|'ad_hoc'
  default_duration_minutes integer,
  default_category_slug    text,                      -- seeds map to a category
  definition      jsonb not null default '{}'::jsonb,
  metadata_schema jsonb not null default '{"fields":[]}'::jsonb,
  is_active       boolean not null default true,
  sort_order      integer not null default 100,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.meeting_system_templates.definition is
  'Frozen template body. Shape: { preparationChecklist:[{key,label,isMandatory,lawRef?}], '
  'agendaItems:[{key,title,description?,lawRef?,isMandatory,voteRequired?,conflictCheck?,defaultPosition}], '
  'requiredAttendees:[{role,count?}], minimumQuorum?:{kind:"percent"|"count",value:number}, '
  'invitationLeadDays?:number, protocolRoles:["chair","secretary","management"], '
  'defaultActionTaskModule?:string }';

comment on column public.meeting_system_templates.metadata_schema is
  'TemplateMetadataSchema — shape {fields:[{key,kind,label?,help?,required?,options?}]}. '
  'Kinds: location|department|team|participants|text|number|select|date. '
  'kind=location/department/team/participants bind to FK columns on meetings; '
  'kind=text/number/select/date bind to meetings.metadata[key].';

create index if not exists meeting_system_templates_framework_idx
  on public.meeting_system_templates (framework)
  where is_active;

create index if not exists meeting_system_templates_sort_idx
  on public.meeting_system_templates (sort_order, slug)
  where is_active;

alter table public.meeting_system_templates enable row level security;

drop policy if exists meeting_system_templates_read_all on public.meeting_system_templates;
create policy meeting_system_templates_read_all
  on public.meeting_system_templates for select
  to authenticated
  using (true);

-- writes restricted to service_role (no public.* policy allowing writes)

drop trigger if exists meeting_system_templates_set_updated_at on public.meeting_system_templates;
create trigger meeting_system_templates_set_updated_at
  before update on public.meeting_system_templates
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. Org template settings — toggle / override / pin / category per org   │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.meeting_org_template_settings (
  organization_id           uuid not null references public.organizations (id) on delete cascade,
  system_template_id        text not null references public.meeting_system_templates (id) on delete cascade,
  enabled                   boolean not null default true,
  nav_pinned                boolean not null default false,
  position                  integer not null default 100,
  category_id               uuid references public.meeting_template_categories (id) on delete set null,
  override_name             text,
  override_description      text,
  override_definition       jsonb,                  -- if non-null, merged onto system definition at read time
  override_metadata_schema  jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  primary key (organization_id, system_template_id)
);

create index if not exists meeting_org_template_settings_pinned_idx
  on public.meeting_org_template_settings (organization_id, position)
  where enabled = true and nav_pinned = true;

create index if not exists meeting_org_template_settings_category_idx
  on public.meeting_org_template_settings (category_id)
  where category_id is not null;

alter table public.meeting_org_template_settings enable row level security;

drop policy if exists meeting_org_template_settings_select on public.meeting_org_template_settings;
create policy meeting_org_template_settings_select
  on public.meeting_org_template_settings for select
  using (organization_id = public.current_org_id());

drop policy if exists meeting_org_template_settings_write on public.meeting_org_template_settings;
create policy meeting_org_template_settings_write
  on public.meeting_org_template_settings for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop trigger if exists meeting_org_template_settings_set_updated_at on public.meeting_org_template_settings;
create trigger meeting_org_template_settings_set_updated_at
  before update on public.meeting_org_template_settings
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. Org custom templates — entirely admin-authored                       │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.meeting_org_templates (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  slug                     text not null,
  name                     text not null,
  description              text,
  category_id              uuid references public.meeting_template_categories (id) on delete set null,
  framework                text not null default 'INTERNAL',
  frameworks               text[] not null default '{}',
  law_refs                 text[] not null default '{}',
  cadence_hint             text,
  default_duration_minutes integer,
  definition               jsonb not null default '{}'::jsonb,
  metadata_schema          jsonb not null default '{"fields":[]}'::jsonb,
  nav_pinned               boolean not null default false,
  is_active                boolean not null default true,
  deleted_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid,
  unique (organization_id, slug)
);

create index if not exists meeting_org_templates_org_idx
  on public.meeting_org_templates (organization_id)
  where deleted_at is null and is_active = true;

alter table public.meeting_org_templates enable row level security;

drop policy if exists meeting_org_templates_select on public.meeting_org_templates;
create policy meeting_org_templates_select
  on public.meeting_org_templates for select
  using (organization_id = public.current_org_id());

drop policy if exists meeting_org_templates_write on public.meeting_org_templates;
create policy meeting_org_templates_write
  on public.meeting_org_templates for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.meeting_org_templates_before_insert_defaults()
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

drop trigger if exists meeting_org_templates_before_insert_defaults_tg on public.meeting_org_templates;
create trigger meeting_org_templates_before_insert_defaults_tg
  before insert on public.meeting_org_templates
  for each row execute function public.meeting_org_templates_before_insert_defaults();

drop trigger if exists meeting_org_templates_set_updated_at on public.meeting_org_templates;
create trigger meeting_org_templates_set_updated_at
  before update on public.meeting_org_templates
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. Meetings — actual instances                                           │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.meetings (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  source_kind              text not null check (source_kind in ('system','org')),
  system_template_id       text references public.meeting_system_templates (id) on delete restrict,
  org_template_id          uuid references public.meeting_org_templates (id) on delete restrict,
  title                    text not null,
  description              text,
  status                   text not null default 'planned'
                             check (status in ('planned','in_progress','completed','cancelled')),
  confidentiality_level    text not null default 'standard'
                             check (confidentiality_level in ('standard','restricted','confidential')),
  scheduled_at             timestamptz,
  ends_at                  timestamptz,
  completed_at             timestamptz,
  location_label           text,
  location_id              uuid references public.locations (id) on delete set null,
  department_id            uuid references public.departments (id) on delete set null,
  team_id                  uuid references public.teams (id) on delete set null,
  participant_member_ids   uuid[] not null default '{}',
  metadata                 jsonb not null default '{}'::jsonb,
  definition_snapshot      jsonb,
  metadata_schema_snapshot jsonb,
  invitation_sent_at       timestamptz,
  invitation_recipients    uuid[] not null default '{}',
  quorum_met               boolean,
  minutes_summary          text,
  next_meeting_proposed_at timestamptz,
  protocol_signed_at       timestamptz,
  protocol_signed_by       uuid,
  sign_checksum            text,
  archived_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid,
  -- discriminator: exactly one template ref is set
  constraint meetings_template_xor check (
    (source_kind = 'system' and system_template_id is not null and org_template_id is null)
    or (source_kind = 'org' and org_template_id is not null and system_template_id is null)
  )
);

create index if not exists meetings_org_scheduled_idx
  on public.meetings (organization_id, scheduled_at desc nulls last)
  where archived_at is null;

create index if not exists meetings_org_status_idx
  on public.meetings (organization_id, status)
  where archived_at is null;

create index if not exists meetings_system_template_idx
  on public.meetings (system_template_id)
  where system_template_id is not null;

create index if not exists meetings_org_template_idx
  on public.meetings (org_template_id)
  where org_template_id is not null;

create index if not exists meetings_participants_gin_idx
  on public.meetings using gin (participant_member_ids);

create index if not exists meetings_confidentiality_idx
  on public.meetings (organization_id, confidentiality_level);

alter table public.meetings enable row level security;

-- Helper: is the current authenticated user a member of `p_org` whose
-- organization_members row id matches one of the provided uuids? We resolve
-- via email because organization_members is decoupled from profiles in this
-- codebase (see survey_distributions.audience_team_ids comment).
create or replace function public.meetings_user_is_in_member_set(
  p_org_id uuid,
  p_member_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.profiles p on lower(p.email) = lower(om.email)
    where p.id = auth.uid()
      and om.organization_id = p_org_id
      and om.id = any(coalesce(p_member_ids, '{}'::uuid[]))
  );
$$;

revoke all on function public.meetings_user_is_in_member_set(uuid, uuid[]) from public, anon;
grant execute on function public.meetings_user_is_in_member_set(uuid, uuid[]) to authenticated;

drop policy if exists meetings_select on public.meetings;
create policy meetings_select
  on public.meetings for select
  using (
    organization_id = public.current_org_id()
    and (
      confidentiality_level = 'standard'
      or created_by = auth.uid()
      or public.user_has_permission('meetings.manage_confidential')
      or public.meetings_user_is_in_member_set(organization_id, participant_member_ids)
    )
  );

drop policy if exists meetings_write on public.meetings;
create policy meetings_write
  on public.meetings for all
  using (
    organization_id = public.current_org_id()
    and (
      confidentiality_level = 'standard'
      or created_by = auth.uid()
      or public.user_has_permission('meetings.manage_confidential')
      or public.meetings_user_is_in_member_set(organization_id, participant_member_ids)
    )
  )
  with check (organization_id = public.current_org_id());

create or replace function public.meetings_before_insert_defaults()
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

drop trigger if exists meetings_before_insert_defaults_tg on public.meetings;
create trigger meetings_before_insert_defaults_tg
  before insert on public.meetings
  for each row execute function public.meetings_before_insert_defaults();

-- Lock trigger — mirror of `compliance_checklist_executions_before_update_defaults`.
-- Protects identity-bearing columns after protocol is signed, but allows the
-- "soft" metadata cluster to keep flowing (title, location, participants,
-- summary, invitation tracking, archive flag).
create or replace function public.meetings_before_update_defaults()
returns trigger
language plpgsql
as $$
begin
  -- Always immutable
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is immutable on meetings';
  end if;
  if new.source_kind is distinct from old.source_kind then
    raise exception 'source_kind is immutable on meetings';
  end if;
  if new.system_template_id is distinct from old.system_template_id then
    raise exception 'system_template_id is immutable on meetings';
  end if;
  if new.org_template_id is distinct from old.org_template_id then
    raise exception 'org_template_id is immutable on meetings';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable on meetings';
  end if;

  -- Confidentiality may be lowered/raised only while still planned/in_progress;
  -- once signed, it locks together with the rest of the identity bundle.
  if old.protocol_signed_at is not null
     and new.confidentiality_level is distinct from old.confidentiality_level then
    raise exception 'Meeting % is signed; confidentiality_level is locked', old.id
      using errcode = 'check_violation';
  end if;

  -- Post-sign lock — only canonical sign-state fields are protected.
  if old.protocol_signed_at is not null then
    if new.protocol_signed_at is null then
      raise exception 'Meeting % is signed; protocol_signed_at cannot revert', old.id
        using errcode = 'check_violation';
    end if;
    if new.protocol_signed_by is distinct from old.protocol_signed_by then
      raise exception 'Meeting % is signed; protocol_signed_by is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.sign_checksum is distinct from old.sign_checksum then
      raise exception 'Meeting % is signed; sign_checksum is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.definition_snapshot is distinct from old.definition_snapshot then
      raise exception 'Meeting % is signed; definition_snapshot is locked', old.id
        using errcode = 'check_violation';
    end if;
    if new.metadata_schema_snapshot is distinct from old.metadata_schema_snapshot then
      raise exception 'Meeting % is signed; metadata_schema_snapshot is locked', old.id
        using errcode = 'check_violation';
    end if;
    -- Status may not revert to planned/in_progress once signed.
    if new.status not in ('completed','cancelled') then
      raise exception 'Meeting % is signed; status cannot revert to %', old.id, new.status
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists meetings_before_update_defaults_tg on public.meetings;
create trigger meetings_before_update_defaults_tg
  before update on public.meetings
  for each row execute function public.meetings_before_update_defaults();

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 6. Agenda items — structured agenda + per-item minutes                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.meeting_agenda_items (
  id                    uuid primary key default gen_random_uuid(),
  meeting_id            uuid not null references public.meetings (id) on delete cascade,
  position              integer not null default 0,
  template_item_key     text,
  title                 text not null,
  description           text,
  law_ref               text,
  prepared_by_member_id uuid references public.organization_members (id) on delete set null,
  is_mandatory          boolean not null default false,
  minutes_summary       text,
  decision_text         text,
  decision_status       text check (decision_status in ('open','implemented','dropped')),
  vote_for              integer,
  vote_against          integer,
  vote_abstain          integer,
  conflict_of_interest  jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists meeting_agenda_items_meeting_idx
  on public.meeting_agenda_items (meeting_id, position);

alter table public.meeting_agenda_items enable row level security;

-- Visibility inherits from parent meeting (so confidential meetings hide their
-- agenda items too). The exists() correlates against the policy on meetings.
drop policy if exists meeting_agenda_items_select on public.meeting_agenda_items;
create policy meeting_agenda_items_select
  on public.meeting_agenda_items for select
  using (
    exists (select 1 from public.meetings m where m.id = meeting_id)
  );

drop policy if exists meeting_agenda_items_write on public.meeting_agenda_items;
create policy meeting_agenda_items_write
  on public.meeting_agenda_items for all
  using (
    exists (select 1 from public.meetings m where m.id = meeting_id)
  )
  with check (
    exists (select 1 from public.meetings m where m.id = meeting_id)
  );

drop trigger if exists meeting_agenda_items_set_updated_at on public.meeting_agenda_items;
create trigger meeting_agenda_items_set_updated_at
  before update on public.meeting_agenda_items
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 7. Attendees — invitation + attendance roster                           │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.meeting_attendees (
  meeting_id  uuid not null references public.meetings (id) on delete cascade,
  member_id   uuid not null references public.organization_members (id) on delete cascade,
  role        text not null default 'member'
                check (role in ('chair','secretary','member','observer','guest','verneombud','employer_rep','employee_rep')),
  invited     boolean not null default true,
  present     boolean,
  excused     boolean not null default false,
  digital     boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (meeting_id, member_id)
);

create index if not exists meeting_attendees_member_idx
  on public.meeting_attendees (member_id);

alter table public.meeting_attendees enable row level security;

drop policy if exists meeting_attendees_select on public.meeting_attendees;
create policy meeting_attendees_select
  on public.meeting_attendees for select
  using (exists (select 1 from public.meetings m where m.id = meeting_id));

drop policy if exists meeting_attendees_write on public.meeting_attendees;
create policy meeting_attendees_write
  on public.meeting_attendees for all
  using (exists (select 1 from public.meetings m where m.id = meeting_id))
  with check (exists (select 1 from public.meetings m where m.id = meeting_id));

drop trigger if exists meeting_attendees_set_updated_at on public.meeting_attendees;
create trigger meeting_attendees_set_updated_at
  before update on public.meeting_attendees
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 8. Decisions — global Vedtaksregister                                   │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.meeting_decisions (
  id                  uuid primary key default gen_random_uuid(),
  meeting_id          uuid not null references public.meetings (id) on delete cascade,
  agenda_item_id      uuid references public.meeting_agenda_items (id) on delete set null,
  decision_text       text not null,
  decision_at         timestamptz not null default now(),
  status              text not null default 'open' check (status in ('open','implemented','dropped')),
  follow_up_task_id   uuid,                       -- references tasks (jsonb-backed; no FK constraint)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists meeting_decisions_meeting_idx
  on public.meeting_decisions (meeting_id, decision_at desc);

create index if not exists meeting_decisions_status_idx
  on public.meeting_decisions (status, decision_at desc);

alter table public.meeting_decisions enable row level security;

drop policy if exists meeting_decisions_select on public.meeting_decisions;
create policy meeting_decisions_select
  on public.meeting_decisions for select
  using (exists (select 1 from public.meetings m where m.id = meeting_id));

drop policy if exists meeting_decisions_write on public.meeting_decisions;
create policy meeting_decisions_write
  on public.meeting_decisions for all
  using (exists (select 1 from public.meetings m where m.id = meeting_id))
  with check (exists (select 1 from public.meetings m where m.id = meeting_id));

drop trigger if exists meeting_decisions_set_updated_at on public.meeting_decisions;
create trigger meeting_decisions_set_updated_at
  before update on public.meeting_decisions
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 9. Action items — link to tasks module                                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.meeting_action_items (
  id                       uuid primary key default gen_random_uuid(),
  meeting_id               uuid not null references public.meetings (id) on delete cascade,
  agenda_item_id           uuid references public.meeting_agenda_items (id) on delete set null,
  description              text not null,
  responsible_member_id    uuid references public.organization_members (id) on delete set null,
  due_date                 date,
  task_id                  uuid,                  -- tasks live in org_module_payload (jsonb); no FK
  task_module              text,                  -- module the spawned task lives in
  status                   text not null default 'open' check (status in ('open','in_progress','done','dropped')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists meeting_action_items_meeting_idx
  on public.meeting_action_items (meeting_id);

create index if not exists meeting_action_items_status_idx
  on public.meeting_action_items (status)
  where status <> 'done';

alter table public.meeting_action_items enable row level security;

drop policy if exists meeting_action_items_select on public.meeting_action_items;
create policy meeting_action_items_select
  on public.meeting_action_items for select
  using (exists (select 1 from public.meetings m where m.id = meeting_id));

drop policy if exists meeting_action_items_write on public.meeting_action_items;
create policy meeting_action_items_write
  on public.meeting_action_items for all
  using (exists (select 1 from public.meetings m where m.id = meeting_id))
  with check (exists (select 1 from public.meetings m where m.id = meeting_id));

drop trigger if exists meeting_action_items_set_updated_at on public.meeting_action_items;
create trigger meeting_action_items_set_updated_at
  before update on public.meeting_action_items
  for each row execute function public.set_updated_at();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 10. Signatures — protocol confirmation (eSign-ready)                    │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create table if not exists public.meeting_signatures (
  id                  uuid primary key default gen_random_uuid(),
  meeting_id          uuid not null references public.meetings (id) on delete cascade,
  signer_member_id    uuid references public.organization_members (id) on delete set null,
  signer_name         text not null,
  signer_role         text not null check (signer_role in ('chair','secretary','management','member','other')),
  signed_at           timestamptz not null default now(),
  level1_event_id     uuid,                       -- references system_signature_events.id when integrated
  is_legally_binding  boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists meeting_signatures_meeting_idx
  on public.meeting_signatures (meeting_id, signed_at);

alter table public.meeting_signatures enable row level security;

drop policy if exists meeting_signatures_select on public.meeting_signatures;
create policy meeting_signatures_select
  on public.meeting_signatures for select
  using (exists (select 1 from public.meetings m where m.id = meeting_id));

drop policy if exists meeting_signatures_write on public.meeting_signatures;
create policy meeting_signatures_write
  on public.meeting_signatures for all
  using (exists (select 1 from public.meetings m where m.id = meeting_id))
  with check (exists (select 1 from public.meetings m where m.id = meeting_id));

-- Signatures are immutable once inserted — the only legitimate "edit" is to
-- delete and re-sign. Audit guarantee.
create or replace function public.meeting_signatures_reject_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'meeting_signatures rows are immutable (delete + re-insert instead)';
end;
$$;

drop trigger if exists meeting_signatures_reject_update_tg on public.meeting_signatures;
create trigger meeting_signatures_reject_update_tg
  before update on public.meeting_signatures
  for each row execute function public.meeting_signatures_reject_update();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 11. Provision function — baseline settings + categories per org         │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.provision_meetings_baseline_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat_aml_amu          uuid;
  v_cat_aml_drofting     uuid;
  v_cat_iso_styring      uuid;
  v_cat_personvern       uuid;
  v_cat_personal         uuid;
  v_cat_intern           uuid;
begin
  -- 1. Default categories (idempotent via unique (org, slug))
  insert into public.meeting_template_categories
    (organization_id, slug, name, description, position, is_system)
  values
    (p_org_id, 'aml-amu',
     'AML — AMU og verneombud',
     'Møter etter Arbeidsmiljøloven kap. 6 og 7.', 10, true),
    (p_org_id, 'aml-drofting',
     'AML — Drøfting og medvirkning',
     'Drøftingsmøter, allmøter, personalmøter (§ 4-2, § 8-2, § 15-1).', 20, true),
    (p_org_id, 'iso-styring',
     'ISO — Styringssystem',
     'Ledelsens gjennomgang og ISMS-revisjon (§ 9.3).', 30, true),
    (p_org_id, 'personvern',
     'Personvern (GDPR)',
     'DPIA og ROPA-gjennomgang etter GDPR art. 30 og 35.', 40, true),
    (p_org_id, 'personal',
     'Personalsamtaler',
     'MUS og individuell oppfølging.', 50, true),
    (p_org_id, 'intern',
     'Interne møter',
     'Organisasjons-spesifikke møtetyper.', 60, true)
  on conflict (organization_id, slug) do nothing;

  -- Look up the category ids (some may pre-date this call)
  select id into v_cat_aml_amu
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'aml-amu';
  select id into v_cat_aml_drofting
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'aml-drofting';
  select id into v_cat_iso_styring
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'iso-styring';
  select id into v_cat_personvern
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'personvern';
  select id into v_cat_personal
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'personal';
  select id into v_cat_intern
    from public.meeting_template_categories
    where organization_id = p_org_id and slug = 'intern';

  -- 2. Settings row per system template (enabled+pinned-by-default for system templates;
  --    admin can disable later). Idempotent via composite PK.
  insert into public.meeting_org_template_settings
    (organization_id, system_template_id, enabled, nav_pinned, position, category_id)
  select
    p_org_id,
    t.id,
    true as enabled,
    true as nav_pinned,
    t.sort_order,
    case t.default_category_slug
      when 'aml-amu'       then v_cat_aml_amu
      when 'aml-drofting'  then v_cat_aml_drofting
      when 'iso-styring'   then v_cat_iso_styring
      when 'personvern'    then v_cat_personvern
      when 'personal'      then v_cat_personal
      when 'intern'        then v_cat_intern
      else null
    end as category_id
  from public.meeting_system_templates t
  where t.is_active = true
  on conflict (organization_id, system_template_id) do nothing;
end;
$$;

revoke all on function public.provision_meetings_baseline_for_org(uuid) from public, anon;
grant execute on function public.provision_meetings_baseline_for_org(uuid) to authenticated, service_role;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 12. Trigger: new-org auto-baseline                                      │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.meetings_provision_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.provision_meetings_baseline_for_org(new.id);
  return new;
end;
$$;

drop trigger if exists meetings_provision_on_org_insert_tg on public.organizations;
create trigger meetings_provision_on_org_insert_tg
  after insert on public.organizations
  for each row execute function public.meetings_provision_on_org_insert();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 13. Backfill — every existing org (idempotent; safe to re-run)          │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Note: this runs *before* seed migration 20260901120001. At first apply, the
-- system-templates table is empty, so the settings-loop is a no-op. The seed
-- migration re-runs `provision_meetings_baseline_for_org` for every org after
-- inserting the templates, which then fills in the settings rows. Both paths
-- are idempotent.

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.provision_meetings_baseline_for_org(v_org.id);
  end loop;
end $$;

-- ============================================================================
-- FROM: 20260901120001_meetings_seed_system_templates.sql
-- ============================================================================

-- Meetings — seed system templates.
--
-- 18 system templates spanning the legally mandated meeting types in Norway
-- plus ISO and GDPR management reviews. Every template encodes:
--   * `frameworks[]` and `law_refs[]` for dashboard drill-down + compliance
--     gap-and-audit planner.
--   * `cadence_hint` for the Årshjul integration.
--   * `definition.agendaItems[]` with `isMandatory: true` where the law forces
--     a specific topic — the UI surfaces these as a "Manglende obligatoriske
--     saker" check.
--   * `definition.requiredAttendees[]` for quorum + composition validation.
--   * `definition.invitationLeadDays` where law specifies notice (7 days for
--     AMU per Forskrift om org. ledelse § 3-2).
--
-- Self-audit (Arbeidstilsynet POV):
--   * AML § 7-2 (2) — 4 AMU templates cover quarterly + annual cycle.
--   * AML § 7-2 (6) — Q4 årsmøte template forces annual report sign-off as
--     mandatory agenda item.
--   * AML § 6-2 / § 6-5 — verneombud-mote with quarterly cadence.
--   * AML § 8-2 / § 15-1 — drøftingsmøte med begrunnelse / alternativer /
--     konsekvenser / ansattes synspunkter som obligatoriske saker.
--   * Likestillingsloven § 26 / § 26a — drofting-likestilling med
--     lønnskartlegging og kjønnsbalanse som obligatoriske saker.
--   * Hovedavtalen § 9-3 — bedriftsutvalg for orgs med tariffavtale.
--   * AML § 2A-7 (5) — varslingsutvalg som eget templat med COI-prompt.
--   * ISO 9001/27001/45001/14001 § 9.3 — ledelsens gjennomgang etter
--     klausul-spesifikke obligatoriske input/output-saker.
--   * GDPR art. 30 / art. 35 — ROPA og DPIA-gjennomgangsmaler.
--   * Restrisiko: secret-ballot elections forblir i modules/amu (egen modul);
--     legally binding eSignature deferred — protokollsignaturer ligger på
--     "Bekreftelse (forhåndsregistrering — ikke juridisk signatur)" inntil
--     BankID-integrasjon er på plass.
--
-- Idempotent. Re-applying upserts only the columns we own; admin-side
-- override fields on `meeting_org_template_settings` are untouched.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ AML — AMU-syklus                                                         │
-- ╰─────────────────────────────────────────────────────────────────────────╯

insert into public.meeting_system_templates
  (id, slug, label, description, framework, frameworks, law_refs, cadence_hint,
   default_duration_minutes, default_category_slug, sort_order, definition, metadata_schema)
values
('amu-kvartalsmote-q1', 'amu-kvartalsmote-q1',
 'AMU kvartalsmøte Q1',
 'Første kvartalsmøte i AMU. Standard agenda: vernerunde-status, sykefraværsutvikling, opplæringsplan HMS.',
 'AML',
 array['AML','IK-f'],
 array['AML § 7-2', 'AML § 7-2 (2)', 'IK-f § 5 nr. 7'],
 'quarterly', 120, 'aml-amu', 110,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling og saksliste sendt minst 7 dager før møtet","isMandatory":true,"lawRef":"Forskrift om org. ledelse § 3-2"},
     {"key":"prev_minutes","label":"Protokoll fra forrige møte vedlagt","isMandatory":true},
     {"key":"open_actions","label":"Status på åpne tiltak fra forrige møte","isMandatory":false}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10},
     {"key":"vernerunder","title":"Vernerunder — status og funn","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav b","defaultPosition":20},
     {"key":"sykefravar","title":"Sykefraværsutvikling","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav c","defaultPosition":30},
     {"key":"opplaering","title":"Opplæringsplan HMS","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav e","defaultPosition":40},
     {"key":"avvik","title":"Avvik og hendelser","isMandatory":true,"lawRef":"IK-f § 5 nr. 7","defaultPosition":50},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},
     {"role":"secretary","count":1},
     {"role":"employer_rep"},
     {"role":"employee_rep"},
     {"role":"verneombud"}
   ],
   "minimumQuorum": {"kind":"percent","value":50},
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon","required":false},
   {"key":"participants","kind":"participants","label":"AMU-medlemmer som deltar","required":true}
 ]}
 $ms$::jsonb),

('amu-kvartalsmote-q2', 'amu-kvartalsmote-q2',
 'AMU kvartalsmøte Q2',
 'Andre kvartalsmøte. Fokus på arbeidsmiljøundersøkelse, ROS-status og fysisk arbeidsmiljø.',
 'AML',
 array['AML','IK-f'],
 array['AML § 7-2', 'AML § 4-1', 'AML § 4-4'],
 'quarterly', 120, 'aml-amu', 120,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling og saksliste sendt minst 7 dager før møtet","isMandatory":true,"lawRef":"Forskrift om org. ledelse § 3-2"},
     {"key":"prev_minutes","label":"Protokoll fra forrige møte vedlagt","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10},
     {"key":"arbeidsmiljoundersokelse","title":"Arbeidsmiljøundersøkelse — gjennomgang og oppfølging","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav d","defaultPosition":20},
     {"key":"ros","title":"ROS-status","isMandatory":true,"lawRef":"AML § 3-1","defaultPosition":30},
     {"key":"fysisk_miljo","title":"Fysisk arbeidsmiljø (ergonomi, støy, klima)","isMandatory":true,"lawRef":"AML § 4-4","defaultPosition":40},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},
     {"role":"employer_rep"},{"role":"employee_rep"},{"role":"verneombud"}
   ],
   "minimumQuorum": {"kind":"percent","value":50},
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"AMU-medlemmer som deltar","required":true}
 ]}
 $ms$::jsonb),

('amu-kvartalsmote-q3', 'amu-kvartalsmote-q3',
 'AMU kvartalsmøte Q3',
 'Tredje kvartalsmøte. Fokus på psykososialt arbeidsmiljø, varslingssaker og mobbing/trakassering.',
 'AML',
 array['AML','IK-f'],
 array['AML § 7-2', 'AML § 4-3', 'AML § 2A-7 (5)'],
 'quarterly', 120, 'aml-amu', 130,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling og saksliste sendt minst 7 dager før møtet","isMandatory":true,"lawRef":"Forskrift om org. ledelse § 3-2"},
     {"key":"prev_minutes","label":"Protokoll fra forrige møte vedlagt","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10},
     {"key":"psykososial","title":"Psykososialt arbeidsmiljø","isMandatory":true,"lawRef":"AML § 4-3","defaultPosition":20},
     {"key":"varsling","title":"Varslingssaker — anonymisert oversikt","isMandatory":true,"lawRef":"AML § 2A-7 (5)","defaultPosition":30,"conflictCheck":true},
     {"key":"mobbing","title":"Mobbing og trakassering — rutiner og saker","isMandatory":true,"lawRef":"AML § 4-3","defaultPosition":40},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},
     {"role":"employer_rep"},{"role":"employee_rep"},{"role":"verneombud"}
   ],
   "minimumQuorum": {"kind":"percent","value":50},
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"AMU-medlemmer som deltar","required":true}
 ]}
 $ms$::jsonb),

('amu-arsrapport-q4', 'amu-arsrapport-q4',
 'AMU årsmøte og årsrapport (Q4)',
 'Årsmøte med behandling av AMU-årsrapport per AML § 7-2 (6) og neste års arbeidsmiljøplan.',
 'AML',
 array['AML','IK-f'],
 array['AML § 7-2 (6)', 'Forskrift om org. ledelse § 3-4'],
 'annual', 180, 'aml-amu', 140,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling og saksliste sendt minst 7 dager før møtet","isMandatory":true,"lawRef":"Forskrift om org. ledelse § 3-2"},
     {"key":"draft_report","label":"Utkast til AMU-årsrapport distribuert til medlemmene","isMandatory":true,"lawRef":"AML § 7-2 (6)"},
     {"key":"plan_draft","label":"Utkast til arbeidsmiljøplan for kommende år","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10},
     {"key":"arsrapport","title":"AMU-årsrapport — gjennomgang og vedtak","isMandatory":true,"lawRef":"AML § 7-2 (6)","voteRequired":true,"defaultPosition":20},
     {"key":"composition","title":"AMU-sammensetning og verv neste år","isMandatory":true,"lawRef":"AML § 7-1","defaultPosition":30},
     {"key":"arbeidsmiljoplan","title":"Arbeidsmiljøplan for neste år","isMandatory":true,"voteRequired":true,"defaultPosition":40},
     {"key":"sykefravar_arsstats","title":"Sykefraværsstatistikk — årsoversikt","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav c","defaultPosition":50},
     {"key":"hendelser","title":"Yrkesskader og hendelser — årsoversikt","isMandatory":true,"lawRef":"AML § 5-1","defaultPosition":60},
     {"key":"opplaering","title":"Opplæring — gjennomført vs. planlagt","isMandatory":true,"defaultPosition":70},
     {"key":"evaluation","title":"Evaluering av AMUs arbeid","isMandatory":true,"defaultPosition":80},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},
     {"role":"employer_rep"},{"role":"employee_rep"},{"role":"verneombud"}
   ],
   "minimumQuorum": {"kind":"percent","value":50},
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"AMU-medlemmer som deltar","required":true},
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true}
 ]}
 $ms$::jsonb),

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ AML — verneombud, bedriftsutvalg, varsling                              │
-- ╰─────────────────────────────────────────────────────────────────────────╯

('verneombud-mote', 'verneombud-mote',
 'Verneombudsmøte',
 'Møte for alle verneombud + hovedverneombud. Gjennomgang av vernerunder, avvik og opplæringsbehov.',
 'AML',
 array['AML','IK-f'],
 array['AML § 6-2', 'AML § 6-5'],
 'quarterly', 90, 'aml-amu', 210,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling sendt til verneområdene","isMandatory":true},
     {"key":"vernerunde_rapporter","label":"Siste vernerunde-rapporter samlet inn","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10},
     {"key":"vernerunder","title":"Vernerunder per verneområde","isMandatory":true,"lawRef":"AML § 6-2","defaultPosition":20},
     {"key":"avvik","title":"Avvik fra verneombudene","isMandatory":true,"lawRef":"IK-f § 5 nr. 7","defaultPosition":30},
     {"key":"opplaering","title":"Opplæring og 40-timerskurs","isMandatory":true,"lawRef":"AML § 6-5","defaultPosition":40},
     {"key":"saker_amu","title":"Saker til neste AMU","isMandatory":false,"defaultPosition":50},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},
     {"role":"verneombud"}
   ],
   "invitationLeadDays": 5,
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"Verneombud som deltar","required":true}
 ]}
 $ms$::jsonb),

('bedriftsutvalg', 'bedriftsutvalg',
 'Bedriftsutvalgsmøte',
 'Bedriftsutvalg for virksomheter med tariffavtale (Hovedavtalen § 9-3). Drøfting av drift, økonomi og organisasjonsspørsmål.',
 'AML',
 array['AML','Hovedavtalen'],
 array['Hovedavtalen § 9-3', 'AML § 4-2'],
 'quarterly', 120, 'aml-drofting', 220,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling sendt minst 1 uke før møtet","isMandatory":true},
     {"key":"drift_rapport","label":"Driftsrapport vedlagt","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll","isMandatory":true,"defaultPosition":10},
     {"key":"drift","title":"Driftsstatus","isMandatory":true,"defaultPosition":20},
     {"key":"okonomi","title":"Økonomisk status og budsjettoppfølging","isMandatory":true,"lawRef":"Hovedavtalen § 9-3","defaultPosition":30},
     {"key":"organisasjon","title":"Organisasjonsendringer og ansettelser","isMandatory":false,"defaultPosition":40},
     {"key":"medvirkning","title":"Medvirkning og medbestemmelse","isMandatory":true,"lawRef":"AML § 4-2","defaultPosition":50},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"employer_rep"},{"role":"employee_rep"}
   ],
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"Utvalgsmedlemmer","required":true}
 ]}
 $ms$::jsonb),

('varslingsutvalg', 'varslingsutvalg',
 'Varslingsutvalgsmøte',
 'Behandling av varslingssaker. Konfidensielt møte med taushetsplikt og COI-prompt.',
 'AML',
 array['AML'],
 array['AML § 2A-7', 'AML § 2A-7 (5)'],
 'ad_hoc', 90, 'aml-amu', 230,
 $def$
 {
   "preparationChecklist": [
     {"key":"confidentiality","label":"Taushetsplikt bekreftet av alle deltakere","isMandatory":true,"lawRef":"AML § 2A-7 (5)"},
     {"key":"coi_check","label":"Interessekonflikt-sjekk gjennomført","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og taushetserklæring","isMandatory":true,"defaultPosition":10},
     {"key":"sak","title":"Saksgjennomgang (anonymisert ved behov)","isMandatory":true,"conflictCheck":true,"defaultPosition":20},
     {"key":"tiltak","title":"Tiltak og oppfølging","isMandatory":true,"voteRequired":true,"defaultPosition":30},
     {"key":"oversikt","title":"Oversikt over åpne saker","isMandatory":true,"defaultPosition":40}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1}
   ],
   "protocolRoles": ["chair","secretary"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"participants","kind":"participants","label":"Utvalgsmedlemmer","required":true}
 ]}
 $ms$::jsonb),

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ AML — drøfting og medvirkning                                            │
-- ╰─────────────────────────────────────────────────────────────────────────╯

('drofting-omstilling', 'drofting-omstilling',
 'Drøftingsmøte — omstilling / nedbemanning',
 'Drøftingsplikten ved omstilling, oppsigelser eller masseoppsigelser. Obligatoriske saker per AML § 8-2 og § 15-1.',
 'AML',
 array['AML'],
 array['AML § 8-2', 'AML § 15-1', 'AML § 15-2'],
 'ad_hoc', 120, 'aml-drofting', 310,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling med begrunnelse sendt i god tid før møtet","isMandatory":true,"lawRef":"AML § 8-2"},
     {"key":"alternativer","label":"Alternativer utredet","isMandatory":true},
     {"key":"konsekvenser","label":"Konsekvensanalyse vedlagt","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"begrunnelse","title":"Begrunnelse for tiltaket","isMandatory":true,"lawRef":"AML § 15-1","defaultPosition":10},
     {"key":"alternativer","title":"Alternative løsninger som er vurdert","isMandatory":true,"lawRef":"AML § 15-1","defaultPosition":20},
     {"key":"konsekvenser","title":"Konsekvenser for arbeidstakerne","isMandatory":true,"lawRef":"AML § 15-1","defaultPosition":30},
     {"key":"synspunkter","title":"Ansattes synspunkter","isMandatory":true,"lawRef":"AML § 15-1","defaultPosition":40},
     {"key":"oppfolging","title":"Avtale om videre prosess","isMandatory":true,"defaultPosition":50}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},
     {"role":"employer_rep"},{"role":"employee_rep"}
   ],
   "protocolRoles": ["chair","secretary","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"department","kind":"department","label":"Avdeling berørt","required":true},
   {"key":"participants","kind":"participants","label":"Deltakere","required":true}
 ]}
 $ms$::jsonb),

('drofting-likestilling', 'drofting-likestilling',
 'Drøftingsmøte — aktivitetsplikt likestilling',
 'Årlig drøfting av lønnskartlegging og likestillingsarbeid per Likestillings- og diskrimineringsloven § 26 og § 26a.',
 'AML',
 array['Likestillingsloven'],
 array['Likestillings- og diskrimineringsloven § 26', 'Likestillings- og diskrimineringsloven § 26a'],
 'annual', 120, 'aml-drofting', 320,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Innkalling med utkast til redegjørelse vedlagt","isMandatory":true},
     {"key":"lonnskartlegging","label":"Lønnskartlegging gjennomført","isMandatory":true,"lawRef":"Likestillings- og diskrimineringsloven § 26a"}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling","isMandatory":true,"defaultPosition":10},
     {"key":"lonnskartlegging","title":"Lønnskartlegging — kjønnsforskjeller","isMandatory":true,"lawRef":"Likestillings- og diskrimineringsloven § 26a","defaultPosition":20},
     {"key":"kjonnsbalanse","title":"Kjønnsbalanse på alle nivåer","isMandatory":true,"lawRef":"Likestillings- og diskrimineringsloven § 26","defaultPosition":30},
     {"key":"tilrettelegging","title":"Tilretteleggingsbehov og fravær","isMandatory":true,"defaultPosition":40},
     {"key":"diskriminering","title":"Risiko for diskriminering — kartlegging og tiltak","isMandatory":true,"defaultPosition":50},
     {"key":"redegjorelse","title":"Vedtak — redegjørelse til årsberetningen","isMandatory":true,"voteRequired":true,"defaultPosition":60}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},
     {"role":"employer_rep"},{"role":"employee_rep"}
   ],
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"participants","kind":"participants","label":"Deltakere","required":true},
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true}
 ]}
 $ms$::jsonb),

('allmote', 'allmote',
 'Allmøte',
 'Halvårlig allmøte. Informasjon, høring og medvirkning per AML § 4-2.',
 'AML',
 array['AML'],
 array['AML § 4-2'],
 'semiannual', 60, 'aml-drofting', 330,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Agenda kommunisert minst 3 dager før","isMandatory":false}
   ],
   "agendaItems": [
     {"key":"strategi","title":"Strategisk status","isMandatory":false,"defaultPosition":10},
     {"key":"drift","title":"Driftsstatus","isMandatory":false,"defaultPosition":20},
     {"key":"hms","title":"HMS-tema","isMandatory":true,"lawRef":"AML § 4-2","defaultPosition":30},
     {"key":"sporsmal","title":"Spørsmål fra ansatte","isMandatory":true,"defaultPosition":40}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1}
   ],
   "protocolRoles": ["chair"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"}
 ]}
 $ms$::jsonb),

('personalmote', 'personalmote',
 'Personalmøte',
 'Månedlig personalmøte i enheten. Informasjon, høring og HMS-tema.',
 'AML',
 array['AML'],
 array['AML § 4-2'],
 'monthly', 45, 'aml-drofting', 340,
 $def$
 {
   "preparationChecklist": [
     {"key":"agenda_sent","label":"Saksliste sendt til enheten","isMandatory":false}
   ],
   "agendaItems": [
     {"key":"info","title":"Informasjon","isMandatory":false,"defaultPosition":10},
     {"key":"hms","title":"HMS-tema","isMandatory":true,"lawRef":"AML § 4-2","defaultPosition":20},
     {"key":"sporsmal","title":"Spørsmål og innspill fra ansatte","isMandatory":false,"defaultPosition":30}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1}
   ],
   "protocolRoles": ["chair"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"department","kind":"department","label":"Avdeling","required":true},
   {"key":"team","kind":"team","label":"Team"}
 ]}
 $ms$::jsonb),

('mus', 'mus',
 'Medarbeidersamtale (MUS)',
 'Årlig medarbeidersamtale mellom leder og ansatt. Mål, utvikling, trivsel og HMS.',
 'AML',
 array['AML'],
 array['AML § 4-2', 'AML § 4-3'],
 'annual', 60, 'personal', 410,
 $def$
 {
   "preparationChecklist": [
     {"key":"prep_form","label":"Forberedelsesskjema delt med ansatt","isMandatory":true},
     {"key":"prev_mus","label":"Forrige MUS-notater tilgjengelig","isMandatory":false}
   ],
   "agendaItems": [
     {"key":"trivsel","title":"Trivsel og arbeidsmiljø","isMandatory":true,"lawRef":"AML § 4-3","defaultPosition":10},
     {"key":"mal","title":"Mål og oppgaver","isMandatory":true,"defaultPosition":20},
     {"key":"utvikling","title":"Utvikling og kompetanse","isMandatory":true,"defaultPosition":30},
     {"key":"hms","title":"HMS — fysisk og psykososialt","isMandatory":true,"lawRef":"AML § 4-3","defaultPosition":40},
     {"key":"varsling","title":"Kjennskap til varslingsrutiner","isMandatory":true,"lawRef":"AML § 2A-7","defaultPosition":50}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"member","count":1}
   ],
   "protocolRoles": ["chair","member"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"participants","kind":"participants","label":"Leder og ansatt","required":true}
 ]}
 $ms$::jsonb),

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ ISO — ledelsens gjennomgang (klausul 9.3)                                │
-- ╰─────────────────────────────────────────────────────────────────────────╯

('iso-9001-ledelsens-gjennomgang', 'iso-9001-ledelsens-gjennomgang',
 'ISO 9001 — Ledelsens gjennomgang',
 'Årlig ledelsens gjennomgang av kvalitetsstyringssystemet per ISO 9001:2015 § 9.3.',
 'ISO_9001',
 array['ISO 9001:2015'],
 array['ISO 9001:2015 § 9.3', 'ISO 9001:2015 § 9.3.2', 'ISO 9001:2015 § 9.3.3'],
 'annual', 180, 'iso-styring', 510,
 $def$
 {
   "preparationChecklist": [
     {"key":"input_collected","label":"Input til ledelsens gjennomgang samlet (§ 9.3.2)","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2"},
     {"key":"agenda_sent","label":"Innkalling og agenda sendt","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"prev_actions","title":"Status fra forrige ledelsens gjennomgang","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 a","defaultPosition":10},
     {"key":"context","title":"Endringer i eksterne og interne forhold","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 b","defaultPosition":20},
     {"key":"performance","title":"Informasjon om ytelsen til kvalitetsstyringssystemet","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 c","defaultPosition":30},
     {"key":"customer","title":"Tilbakemelding fra kunder","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 c.1","defaultPosition":40},
     {"key":"quality_objectives","title":"Status for kvalitetsmål","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 c.2","defaultPosition":50},
     {"key":"audit_results","title":"Revisjonsresultater","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 c.5","defaultPosition":60},
     {"key":"resources","title":"Tilstrekkelighet av ressurser","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 e","defaultPosition":70},
     {"key":"opportunities","title":"Muligheter for forbedring","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.2 g","defaultPosition":80},
     {"key":"decisions","title":"Beslutninger om forbedring og ressursbehov","isMandatory":true,"lawRef":"ISO 9001:2015 § 9.3.3","voteRequired":true,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},
     {"role":"management"}
   ],
   "protocolRoles": ["chair","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true},
   {"key":"location","kind":"location","label":"Lokasjon"}
 ]}
 $ms$::jsonb),

('iso-27001-isms-gjennomgang', 'iso-27001-isms-gjennomgang',
 'ISO 27001 — ISMS-gjennomgang',
 'Årlig ledelsens gjennomgang av informasjonssikkerhetsstyringssystemet per ISO/IEC 27001:2022 § 9.3.',
 'ISO_27001',
 array['ISO 27001:2022'],
 array['ISO/IEC 27001:2022 § 9.3', 'ISO/IEC 27001:2022 § 9.3.2', 'ISO/IEC 27001:2022 § 9.3.3'],
 'annual', 180, 'iso-styring', 520,
 $def$
 {
   "preparationChecklist": [
     {"key":"input_collected","label":"ISMS-input samlet (incidents, audits, KRIs)","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.2"},
     {"key":"risk_register","label":"Oppdatert risikoregister tilgjengelig","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"prev_actions","title":"Status fra forrige gjennomgang","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.2 a","defaultPosition":10},
     {"key":"context","title":"Endringer i interessenter og krav","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.2 b","defaultPosition":20},
     {"key":"info_security","title":"Informasjonssikkerhetsytelse","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.2 c","defaultPosition":30},
     {"key":"incidents","title":"Sikkerhetshendelser og responsstatus","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.2 c.4","defaultPosition":40},
     {"key":"risk_assessment","title":"Risikovurdering og restrisiko","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 8.2","defaultPosition":50},
     {"key":"controls","title":"Effektivitet av kontrollene (Annex A)","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 Annex A","defaultPosition":60},
     {"key":"resources","title":"Ressurser og kompetanse","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.2 e","defaultPosition":70},
     {"key":"decisions","title":"Beslutninger om forbedring og kontrolljustering","isMandatory":true,"lawRef":"ISO/IEC 27001:2022 § 9.3.3","voteRequired":true,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},{"role":"management"}
   ],
   "protocolRoles": ["chair","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true},
   {"key":"isms_scope","kind":"text","label":"ISMS-omfang"}
 ]}
 $ms$::jsonb),

('iso-45001-ledelsens-gjennomgang', 'iso-45001-ledelsens-gjennomgang',
 'ISO 45001 — Ledelsens gjennomgang',
 'Årlig ledelsens gjennomgang av HMS-styringssystemet per ISO 45001:2018 § 9.3.',
 'ISO_45001',
 array['ISO 45001:2018'],
 array['ISO 45001:2018 § 9.3'],
 'annual', 180, 'iso-styring', 530,
 $def$
 {
   "preparationChecklist": [
     {"key":"input_collected","label":"HMS-input samlet (hendelser, ROS, audit, opplæring)","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"prev_actions","title":"Status fra forrige gjennomgang","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 a","defaultPosition":10},
     {"key":"context","title":"Endringer i eksterne og interne forhold","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 b","defaultPosition":20},
     {"key":"policy","title":"HMS-policy og HMS-mål","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 c","defaultPosition":30},
     {"key":"performance","title":"HMS-ytelse","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 c.1","defaultPosition":40},
     {"key":"consultation","title":"Høring og medvirkning fra ansatte","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 c.5","defaultPosition":50},
     {"key":"risks","title":"Risiko og muligheter","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 c.6","defaultPosition":60},
     {"key":"resources","title":"Ressurser og kompetanse","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3 e","defaultPosition":70},
     {"key":"decisions","title":"Beslutninger om forbedring og ressursbehov","isMandatory":true,"lawRef":"ISO 45001:2018 § 9.3","voteRequired":true,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},{"role":"management"},{"role":"verneombud"}
   ],
   "protocolRoles": ["chair","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true}
 ]}
 $ms$::jsonb),

('iso-14001-miljogjennomgang', 'iso-14001-miljogjennomgang',
 'ISO 14001 — Miljøgjennomgang',
 'Årlig ledelsens gjennomgang av miljøstyringssystemet per ISO 14001:2015 § 9.3.',
 'ISO_14001',
 array['ISO 14001:2015'],
 array['ISO 14001:2015 § 9.3'],
 'annual', 150, 'iso-styring', 540,
 $def$
 {
   "preparationChecklist": [
     {"key":"input_collected","label":"Miljøytelse-input samlet","isMandatory":true}
   ],
   "agendaItems": [
     {"key":"prev_actions","title":"Status fra forrige gjennomgang","isMandatory":true,"defaultPosition":10},
     {"key":"context","title":"Endringer i interessenter og lovkrav","isMandatory":true,"lawRef":"ISO 14001:2015 § 4","defaultPosition":20},
     {"key":"performance","title":"Miljøytelse mot miljømål","isMandatory":true,"defaultPosition":30},
     {"key":"compliance","title":"Etterlevelse av lovkrav","isMandatory":true,"lawRef":"ISO 14001:2015 § 9.1.2","defaultPosition":40},
     {"key":"incidents","title":"Avvik og hendelser","isMandatory":true,"defaultPosition":50},
     {"key":"resources","title":"Ressursbehov","isMandatory":true,"defaultPosition":60},
     {"key":"decisions","title":"Beslutninger","isMandatory":true,"voteRequired":true,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},{"role":"management"}
   ],
   "protocolRoles": ["chair","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true}
 ]}
 $ms$::jsonb),

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ GDPR — DPIA + ROPA                                                      │
-- ╰─────────────────────────────────────────────────────────────────────────╯

('gdpr-dpia-gjennomgang', 'gdpr-dpia-gjennomgang',
 'GDPR — DPIA-gjennomgang',
 'Behandling og godkjenning av personvernkonsekvensvurdering (DPIA) per GDPR art. 35.',
 'GDPR',
 array['GDPR'],
 array['GDPR Art. 35', 'GDPR Art. 36'],
 'ad_hoc', 90, 'personvern', 610,
 $def$
 {
   "preparationChecklist": [
     {"key":"dpia_draft","label":"DPIA-utkast vedlagt","isMandatory":true,"lawRef":"GDPR Art. 35"},
     {"key":"dpo_review","label":"Personvernombud (DPO) har gjennomgått utkastet","isMandatory":true,"lawRef":"GDPR Art. 35 (2)"}
   ],
   "agendaItems": [
     {"key":"purpose","title":"Behandlingsformål og kontekst","isMandatory":true,"lawRef":"GDPR Art. 35 (7) a","defaultPosition":10},
     {"key":"necessity","title":"Nødvendighet og proporsjonalitet","isMandatory":true,"lawRef":"GDPR Art. 35 (7) b","defaultPosition":20},
     {"key":"risks","title":"Risiko for de registrerte","isMandatory":true,"lawRef":"GDPR Art. 35 (7) c","defaultPosition":30},
     {"key":"measures","title":"Risikoreduserende tiltak","isMandatory":true,"lawRef":"GDPR Art. 35 (7) d","defaultPosition":40},
     {"key":"residual","title":"Restrisiko og krav om forhåndsdrøfting (Art. 36)","isMandatory":true,"lawRef":"GDPR Art. 36","defaultPosition":50},
     {"key":"decision","title":"Beslutning: godkjent / avvist / krever forhåndsdrøfting","isMandatory":true,"voteRequired":true,"defaultPosition":60}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},{"role":"management"}
   ],
   "protocolRoles": ["chair","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"processing_activity","kind":"text","label":"Behandlingsaktivitet","required":true},
   {"key":"data_categories","kind":"text","label":"Datakategorier"}
 ]}
 $ms$::jsonb),

('gdpr-ropa-arsgjennomgang', 'gdpr-ropa-arsgjennomgang',
 'GDPR — ROPA årlig gjennomgang',
 'Årlig gjennomgang av protokoll over behandlingsaktiviteter per GDPR art. 30.',
 'GDPR',
 array['GDPR'],
 array['GDPR Art. 30'],
 'annual', 120, 'personvern', 620,
 $def$
 {
   "preparationChecklist": [
     {"key":"ropa_export","label":"ROPA-eksport vedlagt","isMandatory":true,"lawRef":"GDPR Art. 30"}
   ],
   "agendaItems": [
     {"key":"new_activities","title":"Nye behandlingsaktiviteter siden sist","isMandatory":true,"lawRef":"GDPR Art. 30 (1)","defaultPosition":10},
     {"key":"updated_activities","title":"Endringer i eksisterende aktiviteter","isMandatory":true,"defaultPosition":20},
     {"key":"retention","title":"Slettefrister — overholdelse","isMandatory":true,"lawRef":"GDPR Art. 5 (1) e","defaultPosition":30},
     {"key":"processors","title":"Databehandleravtaler — status","isMandatory":true,"lawRef":"GDPR Art. 28","defaultPosition":40},
     {"key":"transfers","title":"Tredjelandsoverføringer","isMandatory":true,"lawRef":"GDPR Art. 44-49","defaultPosition":50},
     {"key":"decisions","title":"Beslutninger og oppfølging","isMandatory":true,"voteRequired":true,"defaultPosition":90}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},{"role":"secretary","count":1},{"role":"management"}
   ],
   "protocolRoles": ["chair","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true}
 ]}
 $ms$::jsonb)

on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  cadence_hint = excluded.cadence_hint,
  default_duration_minutes = excluded.default_duration_minutes,
  default_category_slug = excluded.default_category_slug,
  sort_order = excluded.sort_order,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  is_active = true,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Re-provision settings for every org now that templates exist            │
-- ╰─────────────────────────────────────────────────────────────────────────╯

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.provision_meetings_baseline_for_org(v_org.id);
  end loop;
end $$;

-- ============================================================================
-- FROM: 20260901120010_survey_elections_placeholder.sql
-- ============================================================================

-- Survey-as-election placeholder for verneombud + AMU-medlemsvalg.
--
-- Why
--   Replaces the demo-grade `modules/amu_election/` workflow (deleted in
--   the same PR) with a single system survey template in the
--   `survey_template_catalog`. The senior-dev + compliance-officer review
--   concluded:
--     - AML § 6-3 requires hemmelig valg of verneombud — the survey module
--       already supports `is_anonymous = true`, the platform's only
--       anonymous-collection primitive.
--     - AML § 7-3 requires equal employer/employee representation in
--       AMU — recorded as composition metadata on the elected meeting,
--       which the new meetings module handles via
--       `meeting_attendees.role`.
--   This row is a *placeholder*: it surfaces the legal obligation in the
--   compliance planner (`law_refs[]` populated), reserves the catalog
--   id `amu-valg-system`, and embeds eligibility/sealing requirements in
--   the body for the follow-up implementation to consume.
--
-- Restrisiko (intentional v1 gap)
--   - Eligibility gating: only employees in the relevant verneområde
--     should be able to vote. Surveys today have no per-survey role
--     constraint; need either a per-survey `eligible_group_id` column or
--     an `election_eligibility` jsonb. Tracked under
--     specs/meetings-amu-merger.md (deferred).
--   - One-vote-per-voter while preserving anonymity: needs a
--     `survey_ballots_cast(survey_id, voter_user_id)` lookup table
--     separate from `survey_responses` (double-envelope pattern).
--   - Result sealing: once an election closes, results must be
--     immutable. Needs a `sealed_at timestamptz` + trigger on
--     `survey_responses`.
--   - AMU konstitueringsmøte handoff: result certification creates a
--     meeting with the elected members pre-populated as
--     `meeting_attendees`.
--
-- The placeholder is `is_active = true` so admins can see it in the hub
-- and grasp where elections live; manual `is_anonymous = true` toggle is
-- a stopgap until the eligibility/sealing/handoff work ships.
--
-- Idempotent: composite ON CONFLICT on the primary key.

insert into public.survey_template_catalog
  (id, is_system, name, short_name, description, source, use_case,
   category, audience, estimated_minutes, recommend_anonymous,
   law_ref, body, pack, law_refs)
values
  (
    'amu-valg-system',
    true,
    'AMU- og verneombudsvalg',
    'AMU-valg',
    'Anonym avstemning til arbeidsmiljøutvalg og verneombud. Bruker undersøkelsesmodulens anonymitetsmekanisme. Stemmeberettigede begrenses manuelt i v1 — kommer som strukturert valgmodul.',
    'AML § 6-3, AML § 7-3, Forskrift om verneombud',
    'AMU- og verneombudsvalg — hemmelig valg per AML § 6-3.',
    'elections',
    'internal',
    10,
    true,
    'AML § 6-3',
    jsonb_build_object(
      'kind', 'election',
      'requires_eligibility_gating', true,
      'requires_one_vote_per_voter', true,
      'requires_result_sealing', true,
      'eligibility', jsonb_build_object(
        'voter_role_hint', 'employee',
        'office_term_months', 24
      ),
      'notes', 'Krever full implementasjon: stemmeberettigede-liste, double-envelope og forsegling. Resultatet skal materialisere et AMU-konstitueringsmøte (mal seedes senere).'
    ),
    'arbeidsmiljo',
    array['AML § 6-3', 'AML § 7-3', 'Forskrift om verneombud']
  )
on conflict (id) do update
set name = excluded.name,
    short_name = excluded.short_name,
    description = excluded.description,
    source = excluded.source,
    use_case = excluded.use_case,
    category = excluded.category,
    audience = excluded.audience,
    estimated_minutes = excluded.estimated_minutes,
    recommend_anonymous = excluded.recommend_anonymous,
    law_ref = excluded.law_ref,
    body = excluded.body,
    pack = excluded.pack,
    law_refs = excluded.law_refs,
    is_system = excluded.is_system,
    is_active = true,
    updated_at = now();

-- ============================================================================
-- FROM: 20260901120020_drop_legacy_amu_council_tables.sql
-- ============================================================================

-- Drop legacy AMU + Working Council tables.
--
-- Why
--   The new `modules/meetings` module supersedes the AMU-specific
--   council/meetings data shape. Phase F2 deleted the application code
--   that read these tables; this migration removes the tables themselves
--   along with their triggers, indexes, policies, and helper functions.
--
--   Survey-specific AMU sign-off (survey_amu_reviews, survey_amu_review_*
--   functions) STAYS — that table powers the survey module's AMU review
--   feature, which is a separate concern from this meetings module.
--
-- Cleanup scope
--   - AMU meetings + agenda + decisions + attendance + annual reports
--   - AMU committees + members + topic proposals
--   - AMU election candidates, voters, votes, elections themselves
--   - Council board, elections, meetings, compliance items
--   - Associated triggers, indexes, RLS policies (dropped via CASCADE)
--   - Helper functions specific to these tables
--   - role_permissions rows for module.view.council, amu.manage,
--     amu.chair, amu_election.manage so role surfaces stop offering
--     the keys
--   - workflow_event_subscriptions targeting `amu` or `amu_election`
--     source modules (data only — schema preserved)
--
-- Self-audit (Arbeidstilsynet POV)
--   - AML § 7-2 obligations are now satisfied by the new `meetings`
--     table + `meeting_system_templates` seed (template
--     `amu-arsrapport-q4` carries the § 7-2 (6) annual-report
--     obligation).
--   - AML § 6-3 verneombud-valg is reserved as a placeholder under
--     survey_template_catalog id `amu-valg-system` (seeded in
--     20260901120010_survey_elections_placeholder.sql). Eligibility
--     gating + sealed ballots are restrisiko, tracked in the deferred
--     spec.
--
-- Forward-only: this migration is destructive. The legacy archive
-- migrations remain in `supabase/migrations/archive/` for historical
-- reference but no longer create live tables once this runs.

-- ── AMU meetings + decision pipeline ──────────────────────────────────────

drop table if exists public.amu_decisions cascade;
drop table if exists public.amu_attendance cascade;
drop table if exists public.amu_agenda_items cascade;
drop table if exists public.amu_topic_proposals cascade;
drop table if exists public.amu_default_agenda_items cascade;
drop table if exists public.amu_participants cascade;
drop table if exists public.amu_meetings cascade;
drop table if exists public.amu_annual_reports cascade;
drop table if exists public.amu_members cascade;
drop table if exists public.amu_committees cascade;

-- ── AMU elections ─────────────────────────────────────────────────────────

drop table if exists public.amu_election_votes cascade;
drop table if exists public.amu_election_voters cascade;
drop table if exists public.amu_election_candidates cascade;
drop table if exists public.amu_elections cascade;

-- ── Working Council tables ────────────────────────────────────────────────

drop table if exists public.council_compliance_items cascade;
drop table if exists public.council_meetings cascade;
drop table if exists public.council_elections cascade;
drop table if exists public.council_board_members cascade;

-- ── Helper functions ──────────────────────────────────────────────────────
-- Most policies/triggers are gone after CASCADE; explicitly drop the
-- helpers that lived outside the tables.

drop function if exists public.amu_meeting_is_signed(uuid) cascade;
drop function if exists public.amu_privacy_whistleblowing_stats() cascade;
drop function if exists public.amu_privacy_sick_leave_stats() cascade;
drop function if exists public.amu_draft_annual_report(uuid, int) cascade;
drop function if exists public.amu_generate_auto_agenda(uuid) cascade;
drop function if exists public.cast_amu_vote(uuid, uuid) cascade;
drop function if exists public.get_amu_election_vote_totals(uuid) cascade;
drop function if exists public.trg_amu_elections_workflow_on_status() cascade;
drop function if exists public.trg_amu_meetings_workflow() cascade;
drop function if exists public.council_ensure_org_defaults() cascade;

-- ── role_permissions cleanup ──────────────────────────────────────────────
-- The TypeScript PermissionKey union no longer lists these. Drop the rows
-- so the role-management UI doesn't display orphaned keys. (Schema for
-- role_permissions is untouched — only data rows referencing the removed
-- keys are deleted.)

do $$
begin
  if to_regclass('public.role_permissions') is not null then
    delete from public.role_permissions
    where permission_key in ('module.view.council', 'amu.manage', 'amu.chair', 'amu_election.manage');
  end if;
end $$;

-- ── workflow event subscriptions cleanup ──────────────────────────────────
-- Drop org-level workflow rules that targeted the deleted source modules
-- so they don't sit as dead rows in workflow_event_subscriptions.

do $$
begin
  if to_regclass('public.workflow_event_subscriptions') is not null then
    delete from public.workflow_event_subscriptions
    where source_module in ('amu', 'amu_election');
  end if;
  if to_regclass('public.workflow_rules') is not null then
    -- workflow_rules uses `source_module text` (not `module`). Verified
    -- 2026-05 against live schema via information_schema.columns.
    delete from public.workflow_rules
    where source_module in ('amu', 'amu_election');
  end if;
end $$;

-- ── org_module_payloads cleanup ───────────────────────────────────────────
-- The 'amu_election' + 'amu_settings' module payload keys were dropped
-- from the TypeScript union (orgModulePayload.ts). Clean up data rows.

do $$
begin
  if to_regclass('public.org_module_payloads') is not null then
    delete from public.org_module_payloads
    where module_key in ('amu_election', 'amu_settings');
  end if;
end $$;

-- ============================================================================
-- FROM: 20260901120030_meetings_default_role_seed.sql
-- ============================================================================

-- Wire `module.view.meetings` into new-org role provisioning.
--
-- Why
--   Phase F (PR #237) dropped `module.view.council` from the typed
--   PermissionKey allowlist + cleaned the existing rows. But two RPCs
--   that run on every new org creation still hardcoded the legacy
--   permission and didn't insert the new one:
--
--     - public.seed_default_roles_for_org(p_org_id uuid)
--         redefined in archive/20260619120200_seed_roles_reports_manage.sql
--     - public.create_organization_with_brreg(text, text, jsonb)
--         redefined in archive/20260402120100_org_creation_admin_roles.sql
--
--   Without this migration, new orgs after the meetings module shipped
--   would (a) get `module.view.council` inserted as an orphan text key,
--   and (b) NOT get `module.view.meetings`, so users couldn't reach
--   /meetings.
--
-- What this migration does
--   - Re-creates both functions, dropping `module.view.council` from
--     both admin and member role permission sets, and inserting
--     `module.view.meetings` into both.
--   - Backfills `module.view.meetings` for every existing role that
--     used to hold `module.view.council` so existing orgs see the
--     new module without an admin having to grant the permission
--     manually. We grant via inference (admin / member roles in
--     role_definitions) rather than touching auth.users directly.
--
-- Acceptance
--   - select * from role_permissions where permission_key = 'module.view.council';
--     -> 0 rows on a fresh DB (the F3 cleanup already deletes them, but
--        re-running create_organization_with_brreg would re-insert.
--        After this migration it doesn't.)
--   - select count(*) from role_permissions where permission_key = 'module.view.meetings';
--     -> matches the count of admin + member role definitions.

-- ── 1. seed_default_roles_for_org ─────────────────────────────────────────

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
      (r_admin, 'module.view.meetings'),
      (r_admin, 'module.view.members'),
      (r_admin, 'module.view.org_health'),
      (r_admin, 'module.view.hse'),
      (r_admin, 'module.view.internal_control'),
      (r_admin, 'module.view.tasks'),
      (r_admin, 'module.view.learning'),
      (r_admin, 'module.view.reports'),
      (r_admin, 'reports.manage'),
      (r_admin, 'module.view.admin')
    on conflict do nothing;
  end if;

  if r_member is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_member, 'module.view.dashboard'),
      (r_member, 'module.view.meetings'),
      (r_member, 'module.view.members'),
      (r_member, 'module.view.org_health'),
      (r_member, 'module.view.hse'),
      (r_member, 'module.view.internal_control'),
      (r_member, 'module.view.tasks'),
      (r_member, 'module.view.learning'),
      (r_member, 'module.view.reports')
    on conflict do nothing;
  end if;
end;
$$;

-- ── 2. create_organization_with_brreg ─────────────────────────────────────

create or replace function public.create_organization_with_brreg(
  p_orgnr text,
  p_name text,
  p_brreg jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  r_admin uuid;
  r_member uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and organization_id is not null) then
    raise exception 'Profile already linked to an organization';
  end if;
  if p_orgnr is null or p_orgnr !~ '^\d{9}$' then
    raise exception 'Invalid organization number (9 digits)';
  end if;
  insert into public.organizations (organization_number, name, brreg_snapshot)
  values (p_orgnr, trim(p_name), p_brreg)
  returning id into v_org_id;

  update public.profiles
  set organization_id = v_org_id, is_org_admin = true
  where id = auth.uid();

  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values
    (v_org_id, 'admin', 'Administrator', 'Full tilgang til brukere, roller og invitasjoner', true),
    (v_org_id, 'member', 'Medlem', 'Standard tilgang til moduler', true)
  on conflict (organization_id, slug) do nothing;

  select id into r_admin from public.role_definitions where organization_id = v_org_id and slug = 'admin';
  select id into r_member from public.role_definitions where organization_id = v_org_id and slug = 'member';

  if r_admin is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_admin, 'users.invite'),
      (r_admin, 'users.manage'),
      (r_admin, 'roles.manage'),
      (r_admin, 'delegation.manage'),
      (r_admin, 'module.view.dashboard'),
      (r_admin, 'module.view.meetings'),
      (r_admin, 'module.view.members'),
      (r_admin, 'module.view.org_health'),
      (r_admin, 'module.view.hse'),
      (r_admin, 'module.view.internal_control'),
      (r_admin, 'module.view.tasks'),
      (r_admin, 'module.view.learning'),
      (r_admin, 'module.view.admin')
    on conflict do nothing;
    insert into public.user_roles (user_id, role_id, assigned_by)
    values (auth.uid(), r_admin, auth.uid())
    on conflict do nothing;
  end if;

  if r_member is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_member, 'module.view.dashboard'),
      (r_member, 'module.view.meetings'),
      (r_member, 'module.view.members'),
      (r_member, 'module.view.org_health'),
      (r_member, 'module.view.hse'),
      (r_member, 'module.view.internal_control'),
      (r_member, 'module.view.tasks'),
      (r_member, 'module.view.learning')
    on conflict do nothing;
  end if;

  return v_org_id;
end;
$$;

-- ── 3. Backfill existing orgs ─────────────────────────────────────────────
-- Grant module.view.meetings to every admin + member role that exists.
-- Idempotent: ON CONFLICT DO NOTHING.

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'module.view.meetings'
from public.role_definitions rd
where rd.slug in ('admin', 'member')
on conflict do nothing;

-- ============================================================================
-- FROM: 20260901120040_meetings_template_citation_fixes.sql
-- ============================================================================

-- Meetings — citation-only template fixes (H1).
--
-- Why
--   The lovdata verification log (specs/meetings-lovdata-verification.md)
--   confirmed five sub-letter citation errors plus two factually wrong
--   forskrift references in the seed templates:
--     * AML § 7-2 (2) bokstav-mappings: vernerunder/sykefravar/opplaering
--       in Q1, arbeidsmiljoundersokelse in Q2, sykefravar_arsstats in Q4
--       all cited the wrong bokstav.
--     * Forskrift om org. ledelse § 3-4 was cited as the source of
--       AMU-årsrapport content — verified false; § 3-4 is about
--       verneombudets funksjonstid.
--     * Forskrift om org. ledelse § 3-2 was cited as the source of the
--       7-day innkallingsfrist — verified false; § 3-2 covers valg av
--       verneombud, and no 7-day rule appears anywhere in lov or
--       forskrift. The rule remains as a best-practice default but the
--       legal citation is dropped.
--     * ISO 9001:2015 § 9.3.2 audit_results was labelled c.5 — should
--       be c.6.
--
-- Strategy
--   Surgical UPDATE + jsonb_set per affected agenda item / checklist row.
--   Idempotent: re-running on already-corrected rows is a no-op.
--   Definitions are otherwise untouched so org-side override JSONs in
--   meeting_org_template_settings stay valid.
--
-- Self-audit (Arbeidstilsynet POV)
--   * Correct citations matter for AMU pålegg-grunner. A meeting whose
--     protokoll cites § 7-2 (2) bokstav c for sykefravær would invite an
--     inspector to ask "where is your § 18-9-sak?" — confusing and weak.
--   * Removing the bogus forskrift § 3-2 / § 3-4 references protects the
--     org from misleading inspector dialogue ("show me where this 7-day
--     rule comes from"). Best-practice notice remains by default.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. AML § 7-2 (2) sub-letter corrections                                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Q1 fixes: vernerunder → AML § 6-2; sykefravar → AML § 7-2 første ledd;
--           opplaering → AML § 7-2 (2) bokstav b.
update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(
        jsonb_set(
          definition,
          '{agendaItems,1,lawRef}',
          '"AML § 6-2"'::jsonb
        ),
        '{agendaItems,2,lawRef}',
        '"AML § 7-2 første ledd"'::jsonb
      ),
      '{agendaItems,3,lawRef}',
      '"AML § 7-2 (2) bokstav b"'::jsonb
    ),
    updated_at = now()
where id = 'amu-kvartalsmote-q1';

-- Q2 fix: arbeidsmiljoundersokelse → AML § 7-2 (2) bokstav e (HMS-system),
--         not bokstav d (planer).
update public.meeting_system_templates
set definition =
    jsonb_set(
      definition,
      '{agendaItems,1,lawRef}',
      '"AML § 7-2 (2) bokstav e"'::jsonb
    ),
    updated_at = now()
where id = 'amu-kvartalsmote-q2';

-- Q4 fix: sykefravar_arsstats → AML § 7-2 første ledd
--         (same correction as Q1 sykefravar).
update public.meeting_system_templates
set definition =
    jsonb_set(
      definition,
      '{agendaItems,4,lawRef}',
      '"AML § 7-2 første ledd"'::jsonb
    ),
    updated_at = now()
where id = 'amu-arsrapport-q4';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. Drop "Forskrift om org. ledelse § 3-4" from amu-arsrapport-q4        │
-- │    (the § 3-4 cited is about verneombudets funksjonstid, not årsrapport)│
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set law_refs = array_remove(law_refs, 'Forskrift om org. ledelse § 3-4'),
    updated_at = now()
where id = 'amu-arsrapport-q4'
  and 'Forskrift om org. ledelse § 3-4' = any(law_refs);

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. Re-label "Forskrift om org. ledelse § 3-2" innkallings-references     │
-- │    The 7-day rule is best-practice, not lov-grunnet. Keep the 7-day      │
-- │    default (invitationLeadDays remains in definition) but drop the       │
-- │    bogus forskrift citation from the preparationChecklist label + lawRef.│
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Templates that have the wrong § 3-2 reference in preparationChecklist[0].
-- Each is the standard "Innkalling og saksliste sendt minst 7 dager før møtet"
-- item. Re-label + drop the lawRef field via jsonb_set + minus-operator.
do $$
declare
  v_template_id text;
  v_template_ids text[] := array[
    'amu-kvartalsmote-q1',
    'amu-kvartalsmote-q2',
    'amu-kvartalsmote-q3',
    'amu-arsrapport-q4'
  ];
begin
  foreach v_template_id in array v_template_ids loop
    update public.meeting_system_templates
    set definition =
        jsonb_set(
          definition,
          '{preparationChecklist,0}',
          (definition->'preparationChecklist'->0)
            - 'lawRef'
            || jsonb_build_object(
              'label',
              'Innkalling og saksliste sendt minst 7 dager før møtet (anbefalt for god medvirkning)'
            )
        ),
        updated_at = now()
    where id = v_template_id
      and (definition->'preparationChecklist'->0->>'lawRef') = 'Forskrift om org. ledelse § 3-2';
  end loop;
end $$;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. ISO 9001:2015 § 9.3.2 — audit_results was labelled c.5; should be c.6 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      definition,
      '{agendaItems,5,lawRef}',
      '"ISO 9001:2015 § 9.3.2 c.6"'::jsonb
    ),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and (definition->'agendaItems'->5->>'key') = 'audit_results';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. Verification queries — run by hand after applying to confirm.         │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- expected: 'AML § 6-2'
-- select definition->'agendaItems'->1->>'lawRef' from public.meeting_system_templates where id = 'amu-kvartalsmote-q1';

-- expected: 'AML § 7-2 første ledd'
-- select definition->'agendaItems'->2->>'lawRef' from public.meeting_system_templates where id = 'amu-kvartalsmote-q1';

-- expected: 'AML § 7-2 (2) bokstav b'
-- select definition->'agendaItems'->3->>'lawRef' from public.meeting_system_templates where id = 'amu-kvartalsmote-q1';

-- expected: 'AML § 7-2 (2) bokstav e'
-- select definition->'agendaItems'->1->>'lawRef' from public.meeting_system_templates where id = 'amu-kvartalsmote-q2';

-- expected: 'AML § 7-2 første ledd'
-- select definition->'agendaItems'->4->>'lawRef' from public.meeting_system_templates where id = 'amu-arsrapport-q4';

-- expected: array without 'Forskrift om org. ledelse § 3-4'
-- select law_refs from public.meeting_system_templates where id = 'amu-arsrapport-q4';

-- expected: label without "iht. Forskrift" and lawRef is NULL
-- select definition->'preparationChecklist'->0 from public.meeting_system_templates where id = 'amu-kvartalsmote-q1';

-- expected: 'ISO 9001:2015 § 9.3.2 c.6'
-- select definition->'agendaItems'->5->>'lawRef' from public.meeting_system_templates where id = 'iso-9001-ledelsens-gjennomgang';

-- ============================================================================
-- FROM: 20260901120041_meetings_template_topic_completions.sql
-- ============================================================================

-- Meetings — additive agenda + checklist items per H0 verification (H2).
--
-- Why
--   The H0 lovdata verification log identified legally-required topics
--   that the current seed templates do not surface as agenda items. This
--   migration adds those items where the law mandates them.
--
--   Skipped here (gated on reviewer confirmation per H0 §10):
--    * Hovedavtalen § 9-3 bedriftsutvalg additions (ny teknologi,
--      personalpolitikk) — Hovedavtalen text is paywalled.
--    * ISO/IEC 27001:2022 § 9.3.2 sub-letter relabelings — ISO is paywalled.
--
-- Strategy
--   Idempotent UPDATE + jsonb concat. Each addition is guarded by a
--   "key does not already exist" check so re-running is a no-op. New
--   defaultPosition values use round numbers between existing items
--   (e.g. 25 between 20 and 30) so the position-sort stays stable
--   without renumbering the existing items.
--
-- Self-audit (Arbeidstilsynet POV)
--   * AML § 7-2 (2) bokstav a (bedriftshelsetjeneste) — not surfaced
--     anywhere across the 4-meeting AMU cycle today. Adding it to
--     Q4 årsmøte as an annual BHT-årsoversikt closes the gap.
--   * AML § 7-2 (2) bokstav c (planer som krever Arbeidstilsynets
--     samtykke via § 18-9) — adding to Q1 as an "on demand"
--     non-mandatory item; relevant only when the org has bygg- /
--     prosessplaner som § 18-9 dekker.
--   * AML § 7-2 (2) bokstav f (arbeidstidsordninger) — added to
--     Q4 årsmøte as annual review of working-hours arrangements.
--   * AML § 7-2 (6) "rapport til styrende organer og arbeidstakernes
--     organisasjoner" — distribution to ansattes organisasjoner is a
--     statutory step that wasn't surfaced; added to Q4.
--   * AML § 8-2 informasjon-plikt — drofting-omstilling currently
--     conflates this with § 15-1 individual-related items. Adding
--     § 8-2-style "virksomhetens aktuelle og forventede utvikling"
--     as a distinct topic.
--   * AML § 15-2 masseoppsigelse + NAV-meldeplikt — currently missing;
--     added to drofting-omstilling.
--   * AML § 2A-3 + § 2A-4 — varslingsutvalg preparation must confirm
--     that varslingsrutiner exist and fremgangsmåte is followed.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. amu-kvartalsmote-q1 — add § 18-9 major-plans item                     │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'major_plans_at_samtykke',
          'title', 'Planer som krever Arbeidstilsynets samtykke (§ 18-9) — ved behov',
          'description', 'Behandle eventuelle planer for byggearbeider eller prosesser som krever Arbeidstilsynets forhåndssamtykke. Bare aktuelt når slike planer foreligger.',
          'isMandatory', false,
          'lawRef', 'AML § 7-2 (2) bokstavene c og d',
          'defaultPosition', 45
        )
      )
    ),
    updated_at = now()
where id = 'amu-kvartalsmote-q1'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "major_plans_at_samtykke")');

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. amu-arsrapport-q4 — add bokstav a/f + distribution                    │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- a) Bedriftshelsetjeneste — årsoversikt og bidrag (§ 7-2 (2) bokstav a)
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'bht_annual_status',
          'title', 'Bedriftshelsetjeneste — årsoversikt og bidrag',
          'description', 'Gjennomgang av BHTs aktiviteter, rapporter og bidrag til arbeidsmiljøet det siste året.',
          'isMandatory', true,
          'lawRef', 'AML § 7-2 (2) bokstav a',
          'defaultPosition', 25
        )
      )
    ),
    updated_at = now()
where id = 'amu-arsrapport-q4'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "bht_annual_status")');

-- f) Arbeidstidsordninger — helse og velferd (§ 7-2 (2) bokstav f)
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'arbeidstidsordninger_annual',
          'title', 'Arbeidstidsordninger — helse- og velferdsmessige spørsmål',
          'description', 'Gjennomgang av virksomhetens arbeidstidsordninger og deres innvirkning på arbeidstakernes helse og velferd.',
          'isMandatory', true,
          'lawRef', 'AML § 7-2 (2) bokstav f',
          'defaultPosition', 75
        )
      )
    ),
    updated_at = now()
where id = 'amu-arsrapport-q4'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "arbeidstidsordninger_annual")');

-- Distribusjon til ansattes organisasjoner (§ 7-2 (6) statutory step)
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'distribution_to_organisations',
          'title', 'Distribusjon — styrende organer og ansattes organisasjoner',
          'description', 'Bekreft at AMU-årsrapporten distribueres til både styrende organer og arbeidstakernes organisasjoner per AML § 7-2 (6).',
          'isMandatory', true,
          'lawRef', 'AML § 7-2 (6)',
          'defaultPosition', 85
        )
      )
    ),
    updated_at = now()
where id = 'amu-arsrapport-q4'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "distribution_to_organisations")');

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. drofting-omstilling — § 8-2 informasjon + § 15-2 NAV-meldeplikt       │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- § 8-2 informasjon-topic: "virksomhetens aktuelle og forventede utvikling"
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'org_informasjon',
          'title', 'Informasjon om virksomhetens aktuelle og forventede utvikling',
          'description', 'AML § 8-2 (2) — gi informasjon om virksomhetens drift, sysselsetting og vesentlige endringer i arbeidsorganiseringen, før eller samtidig med drøfting av tiltaket.',
          'isMandatory', true,
          'lawRef', 'AML § 8-2',
          'defaultPosition', 5
        )
      )
    ),
    updated_at = now()
where id = 'drofting-omstilling'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "org_informasjon")');

-- § 15-2 masseoppsigelse — NAV-meldeplikt (only when applicable)
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'masseoppsigelse_nav',
          'title', 'Masseoppsigelse — meldeplikt til NAV',
          'description', 'AML § 15-2 — ved 10+ oppsigelser innen 30 dager skal melding sendes NAV samtidig som drøfting starter. Bare aktuelt ved masseoppsigelse.',
          'isMandatory', false,
          'lawRef', 'AML § 15-2',
          'defaultPosition', 35
        )
      )
    ),
    updated_at = now()
where id = 'drofting-omstilling'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "masseoppsigelse_nav")');

-- Individuell drøftelsessamtale-spor (når kollektiv drøfting følges av oppsigelser)
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'individuell_droftelse',
          'title', 'Plan for individuell drøftelsessamtale per ansatt',
          'description', 'AML § 15-1 første ledd — bekreft at individuell drøftelsessamtale gjennomføres med hver berørt ansatt før oppsigelse. Kollektiv drøfting erstatter ikke individuell.',
          'isMandatory', true,
          'lawRef', 'AML § 15-1',
          'defaultPosition', 45
        )
      )
    ),
    updated_at = now()
where id = 'drofting-omstilling'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "individuell_droftelse")');

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. varslingsutvalg — fix "ved behov" wording + add § 2A-3/-4 checklist   │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Re-label agendaItems[1] sak — anonymization is mandatory, not optional
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems,1,title}',
      '"Saksgjennomgang (anonymisert oversikt — lovpålagt)"'::jsonb
    ),
    updated_at = now()
where id = 'varslingsutvalg'
  and (definition->'agendaItems'->1->>'key') = 'sak'
  and (definition->'agendaItems'->1->>'title') = 'Saksgjennomgang (anonymisert ved behov)';

-- Add § 2A-3 / § 2A-4 confirmation to preparationChecklist
update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{preparationChecklist}',
      (definition->'preparationChecklist') || jsonb_build_array(
        jsonb_build_object(
          'key', 'varslingsrutiner_exists',
          'label', 'Varslingsrutiner finnes og er oppdatert (gjelder § 2A-3 og § 2A-4)',
          'isMandatory', true,
          'lawRef', 'AML § 2A-3'
        )
      )
    ),
    updated_at = now()
where id = 'varslingsutvalg'
  and not (definition->'preparationChecklist' @? '$[*] ? (@.key == "varslingsrutiner_exists")');

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. Update law_refs[] arrays to include the newly-cited paragraphs        │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Q1: add § 18-9 to top-level law_refs
update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array['AML § 18-9'])),
    updated_at = now()
where id = 'amu-kvartalsmote-q1'
  and not ('AML § 18-9' = any(law_refs));

-- Q4: add bokstav a/f references to top-level
update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'AML § 7-2 (2) bokstav a',
      'AML § 7-2 (2) bokstav f'
    ])),
    updated_at = now()
where id = 'amu-arsrapport-q4'
  and not ('AML § 7-2 (2) bokstav a' = any(law_refs));

-- drofting-omstilling already lists § 8-2 + § 15-2; no top-level changes needed.

-- varslingsutvalg: add § 2A-3 + § 2A-4 (in addition to existing § 2A-7)
update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'AML § 2A-3',
      'AML § 2A-4'
    ])),
    updated_at = now()
where id = 'varslingsutvalg'
  and not ('AML § 2A-3' = any(law_refs));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 6. Verification queries                                                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- expected: array contains major_plans_at_samtykke
-- select jsonb_path_query(definition, '$.agendaItems[*].key') from public.meeting_system_templates where id = 'amu-kvartalsmote-q1';

-- expected: 3 new keys (bht_annual_status, arbeidstidsordninger_annual, distribution_to_organisations)
-- select jsonb_path_query(definition, '$.agendaItems[*].key') from public.meeting_system_templates where id = 'amu-arsrapport-q4';

-- expected: 3 new keys (org_informasjon, masseoppsigelse_nav, individuell_droftelse)
-- select jsonb_path_query(definition, '$.agendaItems[*].key') from public.meeting_system_templates where id = 'drofting-omstilling';

-- expected: sak.title contains "anonymisert oversikt — lovpålagt"; preparationChecklist contains varslingsrutiner_exists
-- select definition from public.meeting_system_templates where id = 'varslingsutvalg';

-- ============================================================================
-- FROM: 20260901120042_meetings_template_mandatory_honesty.sql
-- ============================================================================

-- Meetings — mandatory-flag honesty pass (H2b).
--
-- Why
--   The H0 verification log called out that several agenda items in
--   `allmote`, `personalmote`, and `mus` carry `isMandatory: true` with
--   a generic AML § 4-2 / § 4-3 citation, but AML does not legally
--   mandate the *form* of these meetings — only the underlying
--   medvirkning / psykososialt arbeidsmiljø obligations at workplace
--   level. Marking items as mandatory when they aren't lov-grunnet
--   misleads auditors and inflates the mandatory-topics gap detector.
--
--   This migration flips those flags to `isMandatory: false` and adds
--   a `recommended: true` field so the UI can still surface them as
--   "anbefalt" without claiming legal force.
--
--   `mus.varsling` is kept mandatory but its lawRef corrected from
--   § 2A-7 (taushetsplikt) to § 2A-3 (rutiner finnes — kjennskap)
--   which is the actual legal hook for "ansatte skal kjenne
--   varslingsrutinene".
--
-- Strategy
--   Idempotent jsonb_set with WHERE guard on current isMandatory state.
--   The `recommended` field is added regardless of prior state.
--
-- Self-audit (Arbeidstilsynet POV)
--   * Honest framing protects the org during inspection — inspectors
--     don't see false "lov-pålagte" claims they can challenge.
--   * The mandatory-topics gap detector in MeetingsDetailView now only
--     warns on items that are truly lov-grunnet, so the warning means
--     something.

set local search_path = public, pg_catalog;

-- Helper: flip isMandatory false + add recommended true at a given path.
-- (Inlined per-item for readability; SQL is repetitive but reviewable.)

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ allmote — items at index 2 (hms) + 3 (sporsmal)                          │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,2,isMandatory}', 'false'::jsonb),
      '{agendaItems,2,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'allmote'
  and (definition->'agendaItems'->2->>'key') = 'hms';

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,3,isMandatory}', 'false'::jsonb),
      '{agendaItems,3,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'allmote'
  and (definition->'agendaItems'->3->>'key') = 'sporsmal';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ personalmote — item at index 1 (hms)                                     │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,1,isMandatory}', 'false'::jsonb),
      '{agendaItems,1,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'personalmote'
  and (definition->'agendaItems'->1->>'key') = 'hms';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ mus — items 0 (trivsel), 1 (mal), 2 (utvikling), 3 (hms)                 │
-- │  + lawRef correction on item 4 (varsling): § 2A-7 → § 2A-3                │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,0,isMandatory}', 'false'::jsonb),
      '{agendaItems,0,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'mus'
  and (definition->'agendaItems'->0->>'key') = 'trivsel';

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,1,isMandatory}', 'false'::jsonb),
      '{agendaItems,1,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'mus'
  and (definition->'agendaItems'->1->>'key') = 'mal';

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,2,isMandatory}', 'false'::jsonb),
      '{agendaItems,2,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'mus'
  and (definition->'agendaItems'->2->>'key') = 'utvikling';

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(definition, '{agendaItems,3,isMandatory}', 'false'::jsonb),
      '{agendaItems,3,recommended}', 'true'::jsonb
    ),
    updated_at = now()
where id = 'mus'
  and (definition->'agendaItems'->3->>'key') = 'hms';

-- mus.varsling stays mandatory, but lawRef is corrected:
-- § 2A-7 is taushetsplikt (about case-handling); the obligation that
-- ansatte SKAL kjenne varslingsrutinene is § 2A-3 + § 2A-4. Use § 2A-3.
update public.meeting_system_templates
set definition =
    jsonb_set(
      definition,
      '{agendaItems,4,lawRef}',
      '"AML § 2A-3"'::jsonb
    ),
    updated_at = now()
where id = 'mus'
  and (definition->'agendaItems'->4->>'key') = 'varsling'
  and (definition->'agendaItems'->4->>'lawRef') = 'AML § 2A-7';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Update mus.law_refs: drop § 2A-7, add § 2A-3                             │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set law_refs =
    array(
      select distinct unnest(
        array_remove(law_refs, 'AML § 2A-7') || array['AML § 2A-3']
      )
    ),
    updated_at = now()
where id = 'mus'
  and ('AML § 2A-7' = any(law_refs) or not ('AML § 2A-3' = any(law_refs)));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Verification queries                                                     │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- expected: allmote.hms.isMandatory=false, recommended=true
-- select definition->'agendaItems'->2 from public.meeting_system_templates where id = 'allmote';

-- expected: personalmote.hms.isMandatory=false, recommended=true
-- select definition->'agendaItems'->1 from public.meeting_system_templates where id = 'personalmote';

-- expected: mus.trivsel/mal/utvikling/hms.isMandatory=false, recommended=true
-- expected: mus.varsling.lawRef='AML § 2A-3' (still mandatory)
-- select definition->'agendaItems' from public.meeting_system_templates where id = 'mus';

-- ============================================================================
-- FROM: 20260901120043_meetings_template_iso_gdpr_completeness.sql
-- ============================================================================

-- Meetings — ISO + GDPR template completeness (H3).
--
-- Why
--   Supervisor review identified missing mandatory inputs in the ISO
--   management-review templates and the GDPR DPIA/ROPA templates. This
--   migration adds them so a customer using these templates would meet
--   the certification audit baseline by replacing only their company
--   name. Idempotent additive UPDATEs.
--
-- Scope
--   ISO 9001:2015 § 9.3.2 — add missing c.3, c.4, c.5, c.7, e
--   ISO 45001:2018 § 9.3 — add missing d.1, d.2, d.3, d.4, f
--   ISO 14001:2015 § 9.3 — add missing audits, monitoring,
--                          communications, improvements
--   GDPR DPIA (Art. 35) — add Art. 35 (2), (8), (9)
--   GDPR ROPA (Art. 30) — add Art. 30 (1) f, Art. 26, Art. 32
--
-- Out-of-scope (gated per H0 §10)
--   ISO/IEC 27001:2022 § 9.3.2 sub-letter relabels — paywalled
--   standard, training-knowledge only. Will ship in a follow-up H3b
--   once a reviewer confirms the 2022 clause structure.
--
-- Strategy
--   Idempotent INSERT-via-concat with `jsonb_path_exists` guards on
--   the agendaItems' key. New defaultPosition values use gaps between
--   existing positions so the sort order stays predictable without
--   renumbering existing items.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. ISO 9001:2015 § 9.3.2 — add missing c.3, c.4, c.5, c.7, e             │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- c.3 process performance and conformity of products/services
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'process_performance',
          'title', 'Prosessytelse og produktkonformitet',
          'isMandatory', true,
          'lawRef', 'ISO 9001:2015 § 9.3.2 c.3',
          'defaultPosition', 35
        )
      )
    ),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "process_performance")');

-- c.4 nonconformities and corrective actions
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'nonconformities',
          'title', 'Avvik og korrigerende tiltak',
          'isMandatory', true,
          'lawRef', 'ISO 9001:2015 § 9.3.2 c.4',
          'defaultPosition', 45
        )
      )
    ),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "nonconformities")');

-- c.5 monitoring and measurement results
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'monitoring_measurement',
          'title', 'Overvåkings- og måleresultater',
          'isMandatory', true,
          'lawRef', 'ISO 9001:2015 § 9.3.2 c.5',
          'defaultPosition', 55
        )
      )
    ),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "monitoring_measurement")');

-- c.7 performance of external providers (suppliers)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'external_providers',
          'title', 'Eksterne leverandørers ytelse',
          'isMandatory', true,
          'lawRef', 'ISO 9001:2015 § 9.3.2 c.7',
          'defaultPosition', 65
        )
      )
    ),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "external_providers")');

-- e effectiveness of actions to address risks and opportunities
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'risk_opportunity_actions',
          'title', 'Effektiviteten av tiltak mot risiko og muligheter (§ 6.1)',
          'isMandatory', true,
          'lawRef', 'ISO 9001:2015 § 9.3.2 e',
          'defaultPosition', 75
        )
      )
    ),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "risk_opportunity_actions")');

-- Refresh law_refs[]
update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'ISO 9001:2015 § 9.3.2 c.3',
      'ISO 9001:2015 § 9.3.2 c.4',
      'ISO 9001:2015 § 9.3.2 c.5',
      'ISO 9001:2015 § 9.3.2 c.7',
      'ISO 9001:2015 § 9.3.2 e'
    ])),
    updated_at = now()
where id = 'iso-9001-ledelsens-gjennomgang'
  and not ('ISO 9001:2015 § 9.3.2 c.4' = any(law_refs));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. ISO 45001:2018 § 9.3 — add d.1, d.2, d.3, d.4, f                      │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- d.1 incidents and corrective actions
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'oh_incidents',
          'title', 'Hendelser og avvik — HMS-ytelse',
          'isMandatory', true,
          'lawRef', 'ISO 45001:2018 § 9.3 d.1',
          'defaultPosition', 42
        )
      )
    ),
    updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "oh_incidents")');

-- d.2 monitoring and measurement
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'oh_monitoring',
          'title', 'Overvåking og målinger',
          'isMandatory', true,
          'lawRef', 'ISO 45001:2018 § 9.3 d.2',
          'defaultPosition', 44
        )
      )
    ),
    updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "oh_monitoring")');

-- d.3 evaluation of compliance with legal requirements
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'oh_compliance_eval',
          'title', 'Evaluering av etterlevelse mot lovkrav',
          'isMandatory', true,
          'lawRef', 'ISO 45001:2018 § 9.3 d.3',
          'defaultPosition', 46
        )
      )
    ),
    updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "oh_compliance_eval")');

-- d.4 audit results
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'oh_audit_results',
          'title', 'Revisjonsresultater',
          'isMandatory', true,
          'lawRef', 'ISO 45001:2018 § 9.3 d.4',
          'defaultPosition', 48
        )
      )
    ),
    updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "oh_audit_results")');

-- f relevant communications with interested parties
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'oh_communications',
          'title', 'Relevant kommunikasjon med interessenter',
          'isMandatory', true,
          'lawRef', 'ISO 45001:2018 § 9.3 f',
          'defaultPosition', 72
        )
      )
    ),
    updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "oh_communications")');

update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'ISO 45001:2018 § 9.3 d.1',
      'ISO 45001:2018 § 9.3 d.2',
      'ISO 45001:2018 § 9.3 d.3',
      'ISO 45001:2018 § 9.3 d.4',
      'ISO 45001:2018 § 9.3 f'
    ])),
    updated_at = now()
where id = 'iso-45001-ledelsens-gjennomgang'
  and not ('ISO 45001:2018 § 9.3 d.1' = any(law_refs));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. ISO 14001:2015 § 9.3 — add audits, monitoring, communications,        │
-- │                            improvements                                  │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'env_audits',
          'title', 'Revisjonsresultater',
          'isMandatory', true,
          'lawRef', 'ISO 14001:2015 § 9.3 d',
          'defaultPosition', 45
        )
      )
    ),
    updated_at = now()
where id = 'iso-14001-miljogjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "env_audits")');

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'env_monitoring',
          'title', 'Overvåking og målinger — miljø',
          'isMandatory', true,
          'lawRef', 'ISO 14001:2015 § 9.3 d',
          'defaultPosition', 55
        )
      )
    ),
    updated_at = now()
where id = 'iso-14001-miljogjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "env_monitoring")');

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'env_communications',
          'title', 'Relevant kommunikasjon med interessenter, inkl. klager',
          'isMandatory', true,
          'lawRef', 'ISO 14001:2015 § 9.3 f',
          'defaultPosition', 65
        )
      )
    ),
    updated_at = now()
where id = 'iso-14001-miljogjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "env_communications")');

update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'env_improvement',
          'title', 'Forbedringsmuligheter',
          'isMandatory', true,
          'lawRef', 'ISO 14001:2015 § 9.3 g',
          'defaultPosition', 80
        )
      )
    ),
    updated_at = now()
where id = 'iso-14001-miljogjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "env_improvement")');

update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'ISO 14001:2015 § 9.3 d',
      'ISO 14001:2015 § 9.3 f',
      'ISO 14001:2015 § 9.3 g'
    ])),
    updated_at = now()
where id = 'iso-14001-miljogjennomgang'
  and not ('ISO 14001:2015 § 9.3 d' = any(law_refs));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. GDPR DPIA — add Art. 35 (2), (8), (9)                                 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Art. 35 (2) — DPO involvement as agenda item (currently only checklist)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'dpo_advice',
          'title', 'Personvernombudets råd — gjennomgang og bekreftelse',
          'description', 'Bekreft og protokollfør DPOs vurdering. GDPR Art. 35 (2) krever at DPO blir konsultert ved DPIA.',
          'isMandatory', true,
          'lawRef', 'GDPR Art. 35 (2)',
          'defaultPosition', 15
        )
      )
    ),
    updated_at = now()
where id = 'gdpr-dpia-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "dpo_advice")');

-- Art. 35 (9) — views of data subjects sought "where appropriate"
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'data_subject_views',
          'title', 'Synspunkter fra de registrerte (der det er hensiktsmessig)',
          'description', 'GDPR Art. 35 (9) — innhent og dokumenter synspunkter fra registrerte eller deres representanter.',
          'isMandatory', false,
          'lawRef', 'GDPR Art. 35 (9)',
          'defaultPosition', 25
        )
      )
    ),
    updated_at = now()
where id = 'gdpr-dpia-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "data_subject_views")');

-- Art. 35 (8) — code of conduct compliance review (where applicable)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'code_of_conduct',
          'title', 'Etterlevelse av godkjente atferdsnormer (Art. 40)',
          'description', 'GDPR Art. 35 (8) — der virksomheten har sluttet seg til en godkjent atferdsnorm, skal etterlevelse vurderes.',
          'isMandatory', false,
          'lawRef', 'GDPR Art. 35 (8)',
          'defaultPosition', 35
        )
      )
    ),
    updated_at = now()
where id = 'gdpr-dpia-gjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "code_of_conduct")');

update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'GDPR Art. 35 (2)',
      'GDPR Art. 35 (8)',
      'GDPR Art. 35 (9)'
    ])),
    updated_at = now()
where id = 'gdpr-dpia-gjennomgang'
  and not ('GDPR Art. 35 (2)' = any(law_refs));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 5. GDPR ROPA — add Art. 30 (1) f, Art. 26, Art. 32                       │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- Art. 30 (1) f — categories of personal data
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'data_categories',
          'title', 'Personopplysningskategorier — oversikt og endringer',
          'description', 'GDPR Art. 30 (1) f — listen over kategorier registrerte og personopplysninger som behandles.',
          'isMandatory', true,
          'lawRef', 'GDPR Art. 30 (1) f',
          'defaultPosition', 15
        )
      )
    ),
    updated_at = now()
where id = 'gdpr-ropa-arsgjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "data_categories")');

-- Art. 26 — joint controllers
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'joint_controllers',
          'title', 'Felles behandlingsansvarlige — avtaler og oversikt (Art. 26)',
          'isMandatory', true,
          'lawRef', 'GDPR Art. 26',
          'defaultPosition', 45
        )
      )
    ),
    updated_at = now()
where id = 'gdpr-ropa-arsgjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "joint_controllers")');

-- Art. 32 — security measures review (cross-ref from ROPA)
update public.meeting_system_templates
set definition = jsonb_set(definition, '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'security_measures',
          'title', 'Tekniske og organisatoriske sikkerhetstiltak (Art. 32)',
          'description', 'GDPR Art. 30 (1) g + Art. 32 — generell beskrivelse av sikkerhetstiltak, samt vurdering av effektivitet.',
          'isMandatory', true,
          'lawRef', 'GDPR Art. 32',
          'defaultPosition', 55
        )
      )
    ),
    updated_at = now()
where id = 'gdpr-ropa-arsgjennomgang'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "security_measures")');

update public.meeting_system_templates
set law_refs = array(select distinct unnest(law_refs || array[
      'GDPR Art. 26',
      'GDPR Art. 30 (1) f',
      'GDPR Art. 32'
    ])),
    updated_at = now()
where id = 'gdpr-ropa-arsgjennomgang'
  and not ('GDPR Art. 32' = any(law_refs));

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Verification queries (run by hand)                                       │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- expected: 14 agendaItems (was 9, +5 new) for ISO 9001
-- select jsonb_array_length(definition->'agendaItems') from public.meeting_system_templates where id = 'iso-9001-ledelsens-gjennomgang';

-- expected: 13 agendaItems (was 8, +5 new) for ISO 45001
-- select jsonb_array_length(definition->'agendaItems') from public.meeting_system_templates where id = 'iso-45001-ledelsens-gjennomgang';

-- expected: 11 agendaItems (was 7, +4 new) for ISO 14001
-- select jsonb_array_length(definition->'agendaItems') from public.meeting_system_templates where id = 'iso-14001-miljogjennomgang';

-- expected: 9 agendaItems (was 6, +3 new) for GDPR DPIA
-- select jsonb_array_length(definition->'agendaItems') from public.meeting_system_templates where id = 'gdpr-dpia-gjennomgang';

-- expected: 9 agendaItems (was 6, +3 new) for GDPR ROPA
-- select jsonb_array_length(definition->'agendaItems') from public.meeting_system_templates where id = 'gdpr-ropa-arsgjennomgang';

-- ============================================================================
-- FROM: 20260901120044_meetings_extend_attendee_roles.sql
-- ============================================================================

-- Meetings — extend meeting_attendees.role enum (H4).
--
-- Why
--   The H0 verification log noted that AML repeatedly references
--   `tillitsvalgte` (chapter 8, 15) and `hovedverneombud` (§ 6-1 fjerde
--   ledd) as distinct roles. The current CHECK constraint on
--   meeting_attendees.role only allows the generic `employee_rep` /
--   `verneombud` values, conflating these legally-distinct roles.
--
--   Drofting templates (per H2) and Q4 årsmøte (per H10) need
--   `tillitsvalgt` as a named role; large-org AMU + verneombud-møter
--   need `hovedverneombud` as a named role.
--
-- Strategy
--   Drop the inline CHECK constraint (auto-named
--   meeting_attendees_role_check) and add a new one with the extended
--   set. Existing rows are unaffected — every existing value still
--   passes.
--
-- Self-audit
--   * The TS PermissionKey union added equivalents in types.ts in the
--     same PR; together the DB + TS surfaces accept the new roles.
--   * No data migration needed — old enum values remain valid; new
--     ones are additive.

set local search_path = public, pg_catalog;

alter table public.meeting_attendees
  drop constraint if exists meeting_attendees_role_check;

alter table public.meeting_attendees
  add constraint meeting_attendees_role_check
  check (role in (
    'chair',
    'secretary',
    'member',
    'observer',
    'guest',
    'verneombud',
    'hovedverneombud',
    'employer_rep',
    'employee_rep',
    'tillitsvalgt'
  ));

-- Verification:
-- expected: constraint exists with the new value list
-- select pg_get_constraintdef(oid)
-- from pg_constraint
-- where conname = 'meeting_attendees_role_check';

-- ============================================================================
-- FROM: 20260901120045_meetings_likestilling_cadence.sql
-- ============================================================================

-- Meetings — likestilling cadence content fix (H5).
--
-- Why
--   H0 verification confirmed Likestillings- og diskrimineringsloven
--   § 26 mandates lønnskartlegging "annethvert år" (every other year),
--   not annually. The current `drofting-likestilling` template's
--   cadence_hint='annual' is correct for the møte (most orgs hold a
--   yearly drøftingsmøte), but the lønnskartlegging-related agenda
--   items needed to surface the biennial nature explicitly. Otherwise
--   organisations risk:
--    * Over-reporting: thinking they need fresh lønnskartlegging-data
--      every year (wasted effort).
--    * Under-reporting: thinking the entire redegjørelse is biennial
--      (failing the annual redegjørelsesplikt).
--
--   The annual redegjørelse (§ 26 a) stays mandatory; the
--   lønnskartlegging *kartlegging* step in § 26 second paragraph
--   bokstav a is the only piece that is biennial.
--
-- Strategy
--   Content-level UPDATEs to title + description on the affected
--   items. No schema additions; no new fields.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ drofting-likestilling.preparationChecklist[1] lonnskartlegging           │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      definition,
      '{preparationChecklist,1,label}',
      '"Lønnskartlegging gjennomført (annethvert år iht. § 26 andre ledd bokstav a)"'::jsonb
    ),
    updated_at = now()
where id = 'drofting-likestilling'
  and (definition->'preparationChecklist'->1->>'key') = 'lonnskartlegging';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ drofting-likestilling.agendaItems[1] lonnskartlegging — title + desc     │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      jsonb_set(
        definition,
        '{agendaItems,1,title}',
        '"Lønnskartlegging — kjønnsforskjeller (annethvert år)"'::jsonb
      ),
      '{agendaItems,1,description}',
      '"Behandling av siste lønnskartlegging. Likestillings- og diskrimineringsloven § 26 andre ledd bokstav a krever ny kartlegging annethvert år. Bekreft i protokollen om dette er kartleggingsår eller ikke-kartleggingsår."'::jsonb
    ),
    updated_at = now()
where id = 'drofting-likestilling'
  and (definition->'agendaItems'->1->>'key') = 'lonnskartlegging';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Add an explicit annual-redegjørelse marker on agendaItems[5] redegjorelse│
-- │ (description clarifies the redegjørelsesplikt IS annual, distinct from    │
-- │ the biennial kartlegging-step).                                          │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition =
    jsonb_set(
      definition,
      '{agendaItems,5,description}',
      '"Vedtak om endelig redegjørelse til årsberetning. Redegjørelsesplikten (§ 26a) er årlig — uavhengig av om lønnskartleggingen er gjennomført i år eller ikke."'::jsonb
    ),
    updated_at = now()
where id = 'drofting-likestilling'
  and (definition->'agendaItems'->5->>'key') = 'redegjorelse';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Add ufrivillig deltidsarbeid kartlegging                                  │
-- │ (also part of § 26 andre ledd bokstav a, often forgotten)                │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set definition = jsonb_set(
      definition,
      '{agendaItems}',
      (definition->'agendaItems') || jsonb_build_array(
        jsonb_build_object(
          'key', 'ufrivillig_deltid',
          'title', 'Ufrivillig deltidsarbeid — kartlegging (annethvert år)',
          'description', 'Likestillings- og diskrimineringsloven § 26 andre ledd bokstav a krever også kartlegging av ufrivillig deltidsarbeid annethvert år, sammen med lønnskartleggingen.',
          'isMandatory', true,
          'lawRef', 'Likestillings- og diskrimineringsloven § 26 andre ledd bokstav a',
          'defaultPosition', 25
        )
      )
    ),
    updated_at = now()
where id = 'drofting-likestilling'
  and not (definition->'agendaItems' @? '$[*] ? (@.key == "ufrivillig_deltid")');

-- Verification:
-- select definition->'agendaItems' from public.meeting_system_templates where id = 'drofting-likestilling';

-- ============================================================================
-- FROM: 20260901120046_meetings_template_default_confidentiality.sql
-- ============================================================================

-- Meetings — default_confidentiality_level template-level field (H7).
--
-- Why
--   The MeetingsHubView currently uses a slug-regex heuristic to pick
--   the default confidentiality level for drøfting/varsling/MUS
--   templates. Slug-coupling is fragile — promoting it to a real
--   template-level column lets admins control the default per template
--   (system + org-custom) without renaming slugs.
--
-- Strategy
--   Additive column on both meeting_system_templates and
--   meeting_org_templates. CHECK constraint matches the existing
--   meetings.confidentiality_level enum. Backfill the four affected
--   system templates to 'restricted'. All other rows keep 'standard'
--   default.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. Add column to meeting_system_templates                                │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.meeting_system_templates
  add column if not exists default_confidentiality_level text not null
    default 'standard';

alter table public.meeting_system_templates
  drop constraint if exists meeting_system_templates_default_conf_check;

alter table public.meeting_system_templates
  add constraint meeting_system_templates_default_conf_check
  check (default_confidentiality_level in ('standard', 'restricted', 'confidential'));

comment on column public.meeting_system_templates.default_confidentiality_level is
  'Default confidentiality_level set on meetings created from this template. '
  'Auditor-facing privacy default — admin can still override at meeting creation.';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. Add column to meeting_org_templates                                   │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.meeting_org_templates
  add column if not exists default_confidentiality_level text not null
    default 'standard';

alter table public.meeting_org_templates
  drop constraint if exists meeting_org_templates_default_conf_check;

alter table public.meeting_org_templates
  add constraint meeting_org_templates_default_conf_check
  check (default_confidentiality_level in ('standard', 'restricted', 'confidential'));

comment on column public.meeting_org_templates.default_confidentiality_level is
  'Default confidentiality_level set on meetings created from this template.';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. Backfill the four sensitive system templates → 'restricted'           │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set default_confidentiality_level = 'restricted',
    updated_at = now()
where id in (
        'drofting-omstilling',
        'drofting-likestilling',
        'varslingsutvalg',
        'mus'
      )
  and default_confidentiality_level <> 'restricted';

-- Verification:
-- expected: 4 rows with 'restricted'; all others 'standard'
-- select id, default_confidentiality_level
-- from public.meeting_system_templates
-- order by default_confidentiality_level desc, sort_order;

-- ============================================================================
-- FROM: 20260901120047_meetings_template_min_employee_count.sql
-- ============================================================================

-- Meetings — minimum_employee_count template-level field (H8).
--
-- Why
--   Several lov-grunnede meeting types only kick in above an employee-
--   count threshold:
--    * AML § 7-1 (post-2024 lov 17 mars 2023 nr. 3): AMU mandatory at
--      30+ ansatte. Verified live on lovdata in H0.
--    * Hovedavtalen LO-NHO § 9-3: bedriftsutvalg at 100+ ansatte.
--      Marked 🟡 in H0 — training-knowledge only, paywall blocked
--      WebFetch. Apply tentatively; reviewer task remains open.
--   Surfacing the threshold lets new orgs see at a glance whether a
--   given template applies to them.
--
-- Strategy
--   Additive integer column on both meeting_system_templates and
--   meeting_org_templates. null = no threshold; integer = required
--   minimum headcount. UI reads org.members.length and shows a
--   warning badge on tiles where below threshold.

set local search_path = public, pg_catalog;

alter table public.meeting_system_templates
  add column if not exists minimum_employee_count integer;

alter table public.meeting_org_templates
  add column if not exists minimum_employee_count integer;

comment on column public.meeting_system_templates.minimum_employee_count is
  'Minimum employee count for this meeting type to be lov-mandated. '
  'null = no threshold (e.g. internal/ISO templates). UI surfaces a warning '
  'badge when current org headcount falls below this number.';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Backfill — known thresholds                                              │
-- ╰─────────────────────────────────────────────────────────────────────────╯

-- AMU cycle (mandatory at 30+ per AML § 7-1, post-2024-01-01).
update public.meeting_system_templates
set minimum_employee_count = 30,
    updated_at = now()
where id in (
        'amu-kvartalsmote-q1',
        'amu-kvartalsmote-q2',
        'amu-kvartalsmote-q3',
        'amu-arsrapport-q4'
      )
  and minimum_employee_count is distinct from 30;

-- Bedriftsutvalg (Hovedavtalen § 9-3 — 100+ ansatte per training-knowledge,
-- H0 yellow-flagged; reviewer to confirm).
update public.meeting_system_templates
set minimum_employee_count = 100,
    updated_at = now()
where id = 'bedriftsutvalg'
  and minimum_employee_count is distinct from 100;

-- Likestillingsloven § 26a — lønnskartlegging at 50+ private + on-request
-- 20-50. Surface 50 as the threshold; the «20-50 etter forespørsel»
-- nuance lives in the description text.
update public.meeting_system_templates
set minimum_employee_count = 50,
    updated_at = now()
where id = 'drofting-likestilling'
  and minimum_employee_count is distinct from 50;

-- Verification:
-- expected: 4 AMU rows = 30; bedriftsutvalg = 100; drofting-likestilling = 50
-- select id, minimum_employee_count
-- from public.meeting_system_templates
-- where minimum_employee_count is not null
-- order by minimum_employee_count desc;

-- ============================================================================
-- FROM: 20260901120048_meetings_agenda_binding_snapshot.sql
-- ============================================================================

-- Meetings — agenda binding_snapshot jsonb column (H9a).
--
-- Why
--   Møteforberedelse-pakke. Each agenda item can carry an optional
--   `dataBinding` declaration in the template definition (e.g. {source:
--   'sick_leave_stats', window: 'last_quarter'}). When a meeting is
--   created from such a template, the resolver hook fans out to the
--   relevant module hooks (useHse, useInternalControl, etc.) and
--   renders a summary that is stored in `meeting_agenda_items.binding_
--   snapshot`. The snapshot becomes part of the protocol — frozen at
--   the moment of meeting prep, defensible at audit.
--
-- Strategy
--   Additive nullable jsonb column. No data migration. The resolver
--   hook + UI consumer follow in H9b/H9c; this commit only opens the
--   storage slot.
--
-- Shape (informally — Zod-validated client-side; passthrough at DB)
--   {
--     "source": "sick_leave_stats",
--     "window": "last_quarter",
--     "resolvedAt": "2026-05-11T10:00:00Z",
--     "summaryMarkdown": "...",
--     "dataRows": [ ... ]
--   }
--
-- Self-audit
--   Storing the resolved snapshot on the protocol artifact (not just
--   the template definition) means auditors can verify the numbers
--   were "true at the time the meeting prepared" — a defensible
--   compliance posture under Forskrift om org. ledelse documentation
--   expectations.

set local search_path = public, pg_catalog;

alter table public.meeting_agenda_items
  add column if not exists binding_snapshot jsonb;

comment on column public.meeting_agenda_items.binding_snapshot is
  'Resolved data binding payload for this agenda item — { source, '
  'window, resolvedAt, summaryMarkdown, dataRows? }. Populated by the '
  'useMeetingDataBindings resolver hook (H9b). Null when the template '
  'item has no dataBinding declaration.';

-- No index needed; binding_snapshot is read per-agenda-item alongside
-- the row, never queried across rows.

-- ============================================================================
-- FROM: 20260901120049_meetings_amu_arsmote_v2.sql
-- ============================================================================

-- Meetings — optimised AMU årsmøte template (H10).
--
-- Why
--   The H0 verification log + supervisor review identified the existing
--   `amu-arsrapport-q4` template as the highest-stakes, most often
--   audited meeting type. H1-H9 layered fixes onto it but the template
--   still carries the old slug ("q4") and was structured for citation-
--   correctness rather than for the new schema fields
--   (default_confidentiality_level, minimum_employee_count, dataBinding,
--   attendee role enum including tillitsvalgt + hovedverneombud).
--
--   This migration inserts a NEW template `amu-arsmote-arsrapport`
--   built from the ground up against the H0-verified law refs,
--   schema additions, and binding-aware agenda. The legacy
--   `amu-arsrapport-q4` is marked is_active = false so it disappears
--   from new-meeting gallery while preserving historical meeting
--   references (existing meetings.system_template_id stays valid).
--
-- Compliance posture
--   * AML § 7-1 — 30 ansatte threshold surfaced via
--     minimum_employee_count.
--   * AML § 7-2 (2) bokstavene a-f — all six surfaced as discrete
--     mandatory agenda items with correct sub-letter citations
--     (verified live on lovdata).
--   * AML § 7-2 (6) — årsrapport vedtak + distribution-step
--     ("til styrende organer og arbeidstakernes organisasjoner")
--     as two separate items.
--   * Forskrift om org. ledelse § 3-16 — minority-dissent (mindretall)
--     registration surfaced as a checklist note.
--   * Attendee roles include the newly added `tillitsvalgt` +
--     `hovedverneombud` from H4.
--   * dataBinding declarations on every input-driven item so the
--     Møteforberedelse-pakke (H9) can pre-fill the protocol.

set local search_path = public, pg_catalog;

insert into public.meeting_system_templates
  (id, slug, label, description, framework, frameworks, law_refs, cadence_hint,
   default_duration_minutes, default_category_slug, sort_order,
   default_confidentiality_level, minimum_employee_count,
   definition, metadata_schema)
values
('amu-arsmote-arsrapport', 'amu-arsmote-arsrapport',
 'AMU årsmøte og årsrapport (v2)',
 'Årlig sammenfattende AMU-møte med behandling og vedtak av AMU-årsrapport (AML § 7-2 (6)), neste års arbeidsmiljøplan og evaluering. Møtet er strukturert rundt § 7-2 (2) bokstavene a-f for full audit-dekning.',
 'AML',
 array['AML', 'IK-f'],
 array[
   'AML § 7-1',
   'AML § 7-2 første ledd',
   'AML § 7-2 (2)',
   'AML § 7-2 (2) bokstav a',
   'AML § 7-2 (2) bokstav b',
   'AML § 7-2 (2) bokstav c',
   'AML § 7-2 (2) bokstav d',
   'AML § 7-2 (2) bokstav e',
   'AML § 7-2 (2) bokstav f',
   'AML § 7-2 (6)',
   'AML § 3-1',
   'AML § 5-1',
   'AML § 18-9',
   'IK-f § 5 nr. 7',
   'Forskrift om org. ledelse § 3-16'
 ],
 'annual', 180, 'aml-amu', 150,
 'standard', 30,
 $def$
 {
   "preparationChecklist": [
     {"key":"invitation_sent","label":"Innkalling og saksliste distribuert til alle AMU-medlemmer (anbefalt 7 dager før)","isMandatory":true},
     {"key":"annual_report_draft","label":"Utkast til AMU-årsrapport distribuert til medlemmene","isMandatory":true,"lawRef":"AML § 7-2 (6)"},
     {"key":"workplan_draft","label":"Utkast til arbeidsmiljøplan for kommende år vedlagt","isMandatory":true},
     {"key":"bht_input","label":"Bedriftshelsetjenestens årsrapport mottatt og distribuert","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav a"},
     {"key":"ia_data","label":"Sykefraværsdata og IA-status ferdigstilt","isMandatory":false},
     {"key":"minority_dissent_aware","label":"Sekretær har klargjort registrering av flertall/mindretall ved avstemning","isMandatory":true,"lawRef":"Forskrift om org. ledelse § 3-16"}
   ],
   "agendaItems": [
     {"key":"approval","title":"Godkjenning av innkalling og protokoll fra forrige møte","isMandatory":true,"defaultPosition":10},
     {"key":"amu_composition","title":"AMU-sammensetning, verv og terskelvurdering (≥ 30 ansatte)","description":"Bekreft at AMU er sammensatt med likt antall arbeidsgiver- og arbeidstakerrepresentanter, og at organisasjonen overskrider terskelen på 30 ansatte iht. AML § 7-1.","isMandatory":true,"lawRef":"AML § 7-1","defaultPosition":20,"dataBinding":{"source":"headcount_and_amu_composition","window":"current","presentation":"summary"}},
     {"key":"bht_status","title":"Bedriftshelsetjeneste — årsoversikt og bidrag","description":"Behandle BHT-årsrapport og bidrag til arbeidsmiljøet, jf. § 7-2 (2) bokstav a.","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav a","defaultPosition":30,"dataBinding":{"source":"bht_annual_report","window":"last_year","presentation":"summary"}},
     {"key":"training_plan","title":"Opplæring HMS — gjennomført vs. planlagt + neste års plan","description":"Bokstav b — opplæring, instruksjon og opplysningsvirksomhet med betydning for arbeidsmiljøet.","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav b","defaultPosition":40,"dataBinding":{"source":"training_completion","window":"last_year","presentation":"table"}},
     {"key":"major_plans_samtykke","title":"Planer som krever Arbeidstilsynets samtykke (§ 18-9)","description":"Bokstav c — § 18-9-saker. Ikke-mandatory dersom ingen slike planer foreligger året.","isMandatory":false,"lawRef":"AML § 7-2 (2) bokstav c","defaultPosition":50},
     {"key":"other_plans","title":"Andre planer med vesentlig betydning for arbeidsmiljøet","description":"Bokstav d — bygg, ny teknologi, rasjonalisering, arbeidsprosesser, forebyggende vernetiltak.","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav d","defaultPosition":60},
     {"key":"hms_system","title":"Etablering og vedlikehold av HMS-systemet (IK)","description":"Bokstav e — virksomhetens systematiske HMS-arbeid.","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav e","defaultPosition":70,"dataBinding":{"source":"ik_annual_review_status","window":"current","presentation":"summary"}},
     {"key":"working_hours","title":"Helse- og velferdsspørsmål knyttet til arbeidstidsordninger","description":"Bokstav f — arbeidstidsordningens påvirkning på arbeidstakernes helse og velferd.","isMandatory":true,"lawRef":"AML § 7-2 (2) bokstav f","defaultPosition":80},
     {"key":"sick_leave_year","title":"Sykefraværsutvikling — året","description":"Korttid / langtid / IA-status, fordelt på enhet. Sammenligning med fjoråret.","isMandatory":true,"lawRef":"AML § 7-2 første ledd","defaultPosition":90,"dataBinding":{"source":"sick_leave_stats","window":"last_year","presentation":"trend"}},
     {"key":"incidents_year","title":"Hendelser og yrkesskader — årsoversikt","description":"Hendelses- og skadeoversikt med fordeling per kategori og status.","isMandatory":true,"lawRef":"AML § 5-1","defaultPosition":100,"dataBinding":{"source":"incidents","window":"last_year","presentation":"table"}},
     {"key":"ros_year","title":"ROS-status og åpne høyrisiko-vurderinger","description":"Åpne ROS-risikoer med risikoskår ≥ 12 prioriteres for behandling.","isMandatory":true,"lawRef":"AML § 3-1","defaultPosition":110,"dataBinding":{"source":"open_ros_high","window":"current","presentation":"table"}},
     {"key":"vernerunder_year","title":"Vernerunder — årsoversikt og signaturstatus","isMandatory":true,"lawRef":"AML § 6-2","defaultPosition":120,"dataBinding":{"source":"vernerunde_findings","window":"last_year","presentation":"summary"}},
     {"key":"whistleblowing_overview","title":"Varslingssaker — anonymisert årsoversikt","description":"Anonymisering er obligatorisk per AML § 2A-7 (5), ikke valgfri.","isMandatory":true,"lawRef":"AML § 2A-7 (5)","conflictCheck":true,"defaultPosition":130,"dataBinding":{"source":"whistleblowing_anonymized","window":"last_year","presentation":"summary"}},
     {"key":"annual_report_vote","title":"Vedtak — AMU-årsrapport","description":"Vedta endelig AMU-årsrapport. Anbefalt innhold: AMU-sammensetning, antall møter, oversikt over saker, vurdering av arbeidsmiljøsituasjonen, forslag og tiltak. (Direktoratet har per nå ikke fastsatt forskriftskrav til innhold; dette er beste praksis.)","isMandatory":true,"lawRef":"AML § 7-2 (6)","voteRequired":true,"defaultPosition":200},
     {"key":"annual_report_distribution","title":"Distribusjon — styrende organer og ansattes organisasjoner","description":"Bekreft at rapporten distribueres til både styrende organer og arbeidstakernes organisasjoner. § 7-2 (6) krever begge.","isMandatory":true,"lawRef":"AML § 7-2 (6)","defaultPosition":210},
     {"key":"next_year_plan_vote","title":"Vedtak — arbeidsmiljøplan for kommende år","isMandatory":true,"voteRequired":true,"defaultPosition":220},
     {"key":"evaluation","title":"Evaluering av AMUs arbeid","isMandatory":true,"defaultPosition":230},
     {"key":"eventuelt","title":"Eventuelt","isMandatory":false,"defaultPosition":300}
   ],
   "requiredAttendees": [
     {"role":"chair","count":1},
     {"role":"secretary","count":1},
     {"role":"employer_rep"},
     {"role":"employee_rep"},
     {"role":"tillitsvalgt"},
     {"role":"verneombud"},
     {"role":"hovedverneombud","count":1}
   ],
   "minimumQuorum": {"kind":"percent","value":50},
   "invitationLeadDays": 7,
   "protocolRoles": ["chair","secretary","management"]
 }
 $def$::jsonb,
 $ms$
 {"fields":[
   {"key":"location","kind":"location","label":"Lokasjon"},
   {"key":"participants","kind":"participants","label":"AMU-medlemmer som deltar","required":true},
   {"key":"reportYear","kind":"number","label":"Rapportår","required":true},
   {"key":"employeeCount","kind":"number","label":"Antall ansatte ved rapporttidspunkt","required":true}
 ]}
 $ms$::jsonb)

on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  framework = excluded.framework,
  frameworks = excluded.frameworks,
  law_refs = excluded.law_refs,
  cadence_hint = excluded.cadence_hint,
  default_duration_minutes = excluded.default_duration_minutes,
  default_category_slug = excluded.default_category_slug,
  sort_order = excluded.sort_order,
  default_confidentiality_level = excluded.default_confidentiality_level,
  minimum_employee_count = excluded.minimum_employee_count,
  definition = excluded.definition,
  metadata_schema = excluded.metadata_schema,
  is_active = true,
  updated_at = now();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ Deprecate legacy `amu-arsrapport-q4`                                     │
-- │   - hide from new-meeting gallery (is_active = false)                    │
-- │   - existing meetings using its system_template_id stay valid           │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set is_active = false,
    updated_at = now()
where id = 'amu-arsrapport-q4'
  and is_active = true;

-- Verification:
-- expected: amu-arsmote-arsrapport active, amu-arsrapport-q4 inactive
-- select id, is_active, sort_order, default_confidentiality_level, minimum_employee_count
-- from public.meeting_system_templates
-- where id like 'amu-ars%';
