-- Internal packs — first-class containers for org-built mal-pakker.
-- Each pack groups one or more per-org template rows across the six
-- module tables (compliance / survey / document / meeting / register /
-- learning). The Tilpass-wizard creates one of these and tags every
-- copied template with internal_pack_id so the Mal-pakker-listen can
-- render org-built packs alongside system packs.
--
-- Schema rationale:
--   - One internal_packs row per pack
--   - internal_pack_id FK column on each per-org template table
--     instead of a separate linking table — simpler queries, native
--     ON DELETE SET NULL, and the per-table rows already know their
--     module.
--
-- Also: adds profiles.location_id so the Brukere section can render
-- the Lokasjon column with real data instead of a "—" placeholder.

create table if not exists public.internal_packs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug            text not null,
  name            text not null,
  description     text not null default '',
  source_pack_slug text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug),
  check (length(slug) between 1 and 80),
  check (length(name) between 1 and 200)
);

create index if not exists internal_packs_org_idx
  on public.internal_packs (organization_id, created_at desc);

alter table public.internal_packs enable row level security;

drop policy if exists internal_packs_select_org on public.internal_packs;
create policy internal_packs_select_org
  on public.internal_packs for select
  using (organization_id = public.current_org_id());

drop policy if exists internal_packs_write_admin on public.internal_packs;
create policy internal_packs_write_admin
  on public.internal_packs for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('checklist.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('checklist.manage'))
  );

create or replace function public.internal_packs_before_insert_defaults()
returns trigger language plpgsql as $$
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

drop trigger if exists internal_packs_before_insert_defaults_tg on public.internal_packs;
create trigger internal_packs_before_insert_defaults_tg
  before insert on public.internal_packs
  for each row execute function public.internal_packs_before_insert_defaults();

drop trigger if exists internal_packs_set_updated_at on public.internal_packs;
create trigger internal_packs_set_updated_at
  before update on public.internal_packs
  for each row execute function public.set_updated_at();

-- Linking column on the six per-org template tables. Nullable: a
-- template can exist without a pack (baseline provisioning, hand-built,
-- or orphaned). ON DELETE SET NULL keeps the template alive.

alter table public.compliance_checklist_templates
  add column if not exists internal_pack_id uuid references public.internal_packs(id) on delete set null;

alter table public.survey_org_templates
  add column if not exists internal_pack_id uuid references public.internal_packs(id) on delete set null;

alter table public.document_org_templates
  add column if not exists internal_pack_id uuid references public.internal_packs(id) on delete set null;

alter table public.meeting_org_templates
  add column if not exists internal_pack_id uuid references public.internal_packs(id) on delete set null;

alter table public.register_types
  add column if not exists internal_pack_id uuid references public.internal_packs(id) on delete set null;

alter table public.learning_courses
  add column if not exists internal_pack_id uuid references public.internal_packs(id) on delete set null;

create index if not exists compliance_checklist_templates_internal_pack_idx
  on public.compliance_checklist_templates (internal_pack_id) where internal_pack_id is not null;
create index if not exists survey_org_templates_internal_pack_idx
  on public.survey_org_templates (internal_pack_id) where internal_pack_id is not null;
create index if not exists document_org_templates_internal_pack_idx
  on public.document_org_templates (internal_pack_id) where internal_pack_id is not null;
create index if not exists meeting_org_templates_internal_pack_idx
  on public.meeting_org_templates (internal_pack_id) where internal_pack_id is not null;
create index if not exists register_types_internal_pack_idx
  on public.register_types (internal_pack_id) where internal_pack_id is not null;
create index if not exists learning_courses_internal_pack_idx
  on public.learning_courses (internal_pack_id) where internal_pack_id is not null;

-- Profile location FK — needed for SecUsers' Lokasjon-kolonne and
-- per-location compliance computations elsewhere in the admin shell.

alter table public.profiles
  add column if not exists location_id uuid references public.locations(id) on delete set null;

create index if not exists profiles_location_idx
  on public.profiles (location_id) where location_id is not null;

comment on table public.internal_packs is
  'Per-org container for hand-built or tilpasset template packs. Linked via internal_pack_id FK on the six per-org template tables (compliance / survey / document / meeting / register / learning).';

comment on column public.profiles.location_id is
  'FK to the location the user is primarily based at. Surfaced in Klarert Admin → Brukere; nullable for HQ-only orgs.';
