-- ════════════════════════════════════════════════════════════════════════
-- compliance_layer · M2 — internal_controls (Tier 2 core)
-- ════════════════════════════════════════════════════════════════════════
--
-- Coverage gap closed:
--   This is the first-class entity the user explicitly asked for: "what
--   the company actually does" to satisfy a paragraph. A row here is a
--   named control like "Årlig ledelses-gjennomgang" or "Kvartalsvis
--   brannøvelse" — distinct from the law (Tier 1) and from the proof
--   artefact (Tier 3 / module executions).
--
-- Self-audit (Arbeidstilsynet POV):
--   - IK-f § 5 nr. 5 krever systematisk overvåking av at HMS-systemet
--     fungerer. Et internal_control er den minste navngitte enheten av
--     overvåking — uten den er det umulig å svare "har vi gjort årlig
--     gjennomgang?". `frequency_hint` + status_view gjør cadence
--     håndhevbar uten å sette opp en separat scheduler.
--   - AML § 3-1 (2) c krever fordeling av ansvar og myndighet. `owner_
--     role` + `owner_user_id` dokumenterer dette på kontroll-nivå.
--   - ISO 9001/14001/27001/45001 § 5.3 krever roller, ansvar, myndighet
--     for å sikre styringssystemets samsvar. Samme `owner_role` /
--     `owner_user_id` brukes på tvers av frameworks via en enkelt
--     control som peker på flere klausuler (M3-junction).
--   - Restrisiko: system-rader (`is_system=true`) er kun bestilbare via
--     migrations. En org-admin kan klone og deaktivere; ikke endre i
--     stedet for. Phase 2-spec dekker org-overstyringer av system-
--     kontroller via ny tabell `internal_control_org_overrides`.
--
-- Notes:
--   - Enums opprettes med do-block + duplicate_object handling så
--     migrasjonen er idempotent (et eksisterende enum gjenbrukes).
--   - `nav_pinned` mirrors the existing pattern from
--     `compliance_checklist_templates` slik at sidebaren kan pinpoint
--     viktige kontroller uten egen tabell.

set local search_path = public, pg_catalog;

-- ── 1. Enums ─────────────────────────────────────────────────────────────

do $$ begin
  create type public.control_family as enum (
    'preventive',
    'detective',
    'corrective',
    'directive'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.control_status as enum (
    'draft',
    'active',
    'retired'
  );
exception when duplicate_object then null; end $$;

-- ── 2. Table ─────────────────────────────────────────────────────────────

create table if not exists public.internal_controls (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  slug              text not null,
  name              text not null,
  name_i18n         jsonb not null default '{}'::jsonb,
  purpose           text not null default '',
  purpose_i18n      jsonb not null default '{}'::jsonb,
  control_family    public.control_family not null default 'preventive',
  frequency_hint    text,
  owner_role        text,
  owner_user_id     uuid references auth.users (id) on delete set null,
  status            public.control_status not null default 'draft',
  is_system         boolean not null default false,
  is_active         boolean not null default true,
  nav_pinned        boolean not null default false,
  metadata          jsonb not null default '{}'::jsonb,
  deleted_at        timestamptz,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, slug),
  check (char_length(slug) > 0),
  check (char_length(name) > 0),
  check (jsonb_typeof(name_i18n) = 'object'),
  check (jsonb_typeof(purpose_i18n) = 'object'),
  check (jsonb_typeof(metadata) = 'object'),
  check (
    frequency_hint is null
    or frequency_hint in ('arlig','halvarlig','kvartalsvis','manedlig','ukentlig','daglig','ad_hoc')
  )
);

comment on table public.internal_controls is
  $c$Per-org named control — Tier 2 of the 3-tier compliance architecture.
  Decouples rule (regulation_clauses) from proof (module execution
  artefacts). One control satisfies N clauses (via internal_control_
  clauses) and is evidenced by N artefacts (via internal_control_
  bindings + internal_control_executions).$c$;

comment on column public.internal_controls.frequency_hint is
  $c$Cadence convention shared with `compliance_checklist_templates.
  cadence_hint` and `meeting_system_templates.cadence_hint`. Drives
  `internal_control_status_v.next_due_at` computation. NULL = ad hoc,
  no cadence enforcement.$c$;

comment on column public.internal_controls.owner_role is
  $c$Functional role slug (e.g. 'hms_leder', 'amu_leder',
  'verneombud_hoved', 'dpo'). Not a hard FK — roles are dynamic and
  org-defined. UI resolves via the org's functional-roles table.$c$;

comment on column public.internal_controls.is_system is
  $c$Platform-shipped baseline (managed via migrations). RLS write
  policy denies app-side mutation when true. Org admins can clone +
  retire; not modify in place.$c$;

create index if not exists internal_controls_org_status_idx
  on public.internal_controls (organization_id, status, is_active)
  where deleted_at is null;

create index if not exists internal_controls_org_owner_idx
  on public.internal_controls (organization_id, owner_user_id)
  where deleted_at is null and owner_user_id is not null;

create index if not exists internal_controls_org_family_idx
  on public.internal_controls (organization_id, control_family)
  where deleted_at is null;

-- ── 3. RLS ───────────────────────────────────────────────────────────────

alter table public.internal_controls enable row level security;

drop policy if exists internal_controls_select_org on public.internal_controls;
create policy internal_controls_select_org
  on public.internal_controls for select
  using (organization_id = public.current_org_id());

drop policy if exists internal_controls_insert_org on public.internal_controls;
create policy internal_controls_insert_org
  on public.internal_controls for insert
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('compliance_layer.manage')
    )
    -- System rows can only be inserted by migrations (security definer).
    and is_system = false
  );

drop policy if exists internal_controls_update_org on public.internal_controls;
create policy internal_controls_update_org
  on public.internal_controls for update
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('compliance_layer.manage')
    )
    and is_system = false
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('compliance_layer.manage')
    )
    and is_system = false
  );

drop policy if exists internal_controls_delete_org on public.internal_controls;
create policy internal_controls_delete_org
  on public.internal_controls for delete
  using (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('compliance_layer.manage')
    )
    and is_system = false
  );

-- ── 4. Triggers ──────────────────────────────────────────────────────────

create or replace function public.internal_controls_before_insert_defaults()
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

drop trigger if exists internal_controls_before_insert_defaults_tg on public.internal_controls;
create trigger internal_controls_before_insert_defaults_tg
  before insert on public.internal_controls
  for each row execute function public.internal_controls_before_insert_defaults();

drop trigger if exists internal_controls_set_updated_at on public.internal_controls;
create trigger internal_controls_set_updated_at
  before update on public.internal_controls
  for each row execute function public.set_updated_at();

-- Block retire→active flips without explicit reactivation by admins
-- (defence-in-depth so a script can't silently un-retire deprecated
-- controls). Phase 2 may add `retired_at` + `retired_reason` columns.
create or replace function public.internal_controls_before_update_retire()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'retired' and new.status <> 'retired' then
    if not (public.is_org_admin() or public.user_has_permission('compliance_layer.manage')) then
      raise exception 'Reactivating a retired control requires compliance_layer.manage';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists internal_controls_before_update_retire_tg on public.internal_controls;
create trigger internal_controls_before_update_retire_tg
  before update on public.internal_controls
  for each row execute function public.internal_controls_before_update_retire();
