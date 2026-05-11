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
