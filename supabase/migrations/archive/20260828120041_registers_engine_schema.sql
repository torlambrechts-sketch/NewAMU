-- Registers engine — generic record-list module across compliance packs.
-- See specs/registers-engine.md for the full design rationale.
--
-- Five tables:
--   1. register_types          — catalogue of register kinds (system + per-org).
--                                Carries the metadata_schema, regulation links,
--                                and pack-membership. organization_id IS NULL
--                                for platform-shipped types; NOT NULL for org-
--                                authored ones.
--   2. register_categories     — per-org grouping of register types in the
--                                sidebar + hub. Mirrors compliance_checklist_
--                                categories / survey_template_categories.
--   3. register_org_settings   — per-(org, type) enable/disable + name override
--                                + nav_pinned + category assignment. Mirrors
--                                document_org_template_settings.
--   4. register_records        — the actual records authored against a type.
--                                values jsonb is keyed by the type's
--                                metadata_schema field keys.
--   5. register_record_revisions — audit log of value changes. Always-on
--                                  (cheap; compliance-relevant for half the
--                                  types we ship).
--
-- Idempotent: every step uses `if not exists` / `on conflict do nothing` /
-- `do $$ ... end $$` guards. Safe to re-apply.

set local search_path = public, pg_catalog;

-- ── 1. register_types ─────────────────────────────────────────────────────

create table if not exists public.register_types (
  id              text primary key,
  organization_id uuid null references public.organizations (id) on delete cascade,
  name            text not null,
  description     text,
  metadata_schema jsonb not null default '{"fields":[]}'::jsonb,
  regulation_ids  text[] not null default '{}'::text[],
  pack_slugs      text[] not null default '{}'::text[],
  default_review_cadence_months integer,
  is_active       boolean not null default true,
  is_system       boolean not null default false,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.register_types.metadata_schema is
  $c$Field declarations driving the record-edit form for instances of this
  type. Same shape as compliance_checklist_templates.metadata_schema /
  document_org_templates.metadata_schema. Field kinds: text, number, date,
  boolean, select, select_multi, doc_ref, location_ref. Records' `values`
  jsonb is keyed by these field keys.$c$;

comment on column public.register_types.regulation_ids is
  $c$Multi: a single register type can serve multiple regulations
  (chemicals → AML §4-5 + ISO 14001 + REACH). Drives the regulation
  filter chip on the registers page.$c$;

comment on column public.register_types.pack_slugs is
  $c$Multi: which compliance packs this type ships with. Provisioning
  enables the type for an org when any of these packs is licensed.$c$;

comment on column public.register_types.organization_id is
  $c$NULL = platform-shipped system type. NOT NULL = per-org custom type
  authored via the admin schema-builder UI.$c$;

create index if not exists register_types_org_active_idx
  on public.register_types (organization_id, is_active)
  where is_active = true;

drop trigger if exists register_types_set_updated_at on public.register_types;
create trigger register_types_set_updated_at
  before update on public.register_types
  for each row execute function public.set_updated_at();

alter table public.register_types enable row level security;

-- RLS uses the established helpers — current_org_id() / is_org_admin() /
-- user_has_permission(). organization_members in this codebase is an HR
-- directory table without a user_id column, so we route access through
-- profiles.organization_id (the auth-linked org id) instead.

drop policy if exists register_types_select on public.register_types;
create policy register_types_select on public.register_types
  for select to authenticated
  using (
    -- system types visible to anyone with a current org
    (organization_id is null and public.current_org_id() is not null)
    or
    -- org types visible to members of that org
    organization_id = public.current_org_id()
  );

drop policy if exists register_types_write on public.register_types;
create policy register_types_write on public.register_types
  for all to authenticated
  using (
    organization_id is not null
    and organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  )
  with check (
    organization_id is not null
    and organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  );

-- ── 2. register_categories ────────────────────────────────────────────────

create table if not exists public.register_categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug            text not null,
  name            text not null,
  description     text,
  regulation_id   text,  -- soft-FK; coherence enforced by `regulation_id_must_match_org` trigger below.
                          -- `public.regulations` has a composite PK (organization_id, id), so a
                          -- single-column FK won't bind. Same pattern as compliance / survey /
                          -- learning / wiki_spaces category tables (see _120036).
  position        integer not null default 0,
  is_active       boolean not null default true,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  unique (organization_id, slug)
);

create index if not exists register_categories_org_active_idx
  on public.register_categories (organization_id, is_active, position)
  where is_active = true and deleted_at is null;

drop trigger if exists register_categories_set_updated_at on public.register_categories;
create trigger register_categories_set_updated_at
  before update on public.register_categories
  for each row execute function public.set_updated_at();

-- Same-org regulation_id coherence — mirrors the trigger that already
-- guards compliance / survey / learning / wiki_spaces categories.
drop trigger if exists register_categories_reg_check on public.register_categories;
create trigger register_categories_reg_check
  before insert or update of regulation_id on public.register_categories
  for each row execute function public.regulation_id_must_match_org();

alter table public.register_categories enable row level security;

drop policy if exists register_categories_member_select on public.register_categories;
create policy register_categories_member_select on public.register_categories
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists register_categories_admin_write on public.register_categories;
create policy register_categories_admin_write on public.register_categories
  for all to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  );

-- ── 3. register_org_settings ──────────────────────────────────────────────

create table if not exists public.register_org_settings (
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  register_type_id  text not null references public.register_types (id) on delete cascade,
  enabled           boolean not null default true,
  name_override     text,
  category_id       uuid references public.register_categories (id) on delete set null,
  nav_pinned        boolean not null default true,
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (organization_id, register_type_id)
);

create index if not exists register_org_settings_nav_pinned_idx
  on public.register_org_settings (organization_id, register_type_id)
  where enabled = true and nav_pinned = true;

drop trigger if exists register_org_settings_set_updated_at on public.register_org_settings;
create trigger register_org_settings_set_updated_at
  before update on public.register_org_settings
  for each row execute function public.set_updated_at();

alter table public.register_org_settings enable row level security;

drop policy if exists register_org_settings_member_select on public.register_org_settings;
create policy register_org_settings_member_select on public.register_org_settings
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists register_org_settings_admin_write on public.register_org_settings;
create policy register_org_settings_admin_write on public.register_org_settings
  for all to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('internkontroll.manage'))
  );

-- ── 4. register_records ───────────────────────────────────────────────────

create table if not exists public.register_records (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  register_type_id  text not null references public.register_types (id) on delete restrict,
  values            jsonb not null default '{}'::jsonb,
  status            text not null default 'active'
                    check (status in ('draft', 'active', 'archived')),
  review_due_at     date,
  owner_user_id     uuid references auth.users (id) on delete set null,
  evidence_doc_refs text[] not null default '{}'::text[],
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on column public.register_records.values is
  $c$Free-form per-record bag, keyed by the register_type's
  metadata_schema field keys. App-side validation via Zod; DB stays
  permissive so a schema migration on the type doesn't invalidate
  historical rows.$c$;

create index if not exists register_records_org_type_idx
  on public.register_records (organization_id, register_type_id)
  where deleted_at is null;
create index if not exists register_records_review_due_idx
  on public.register_records (organization_id, review_due_at)
  where deleted_at is null and review_due_at is not null;
create index if not exists register_records_owner_idx
  on public.register_records (organization_id, owner_user_id)
  where deleted_at is null and owner_user_id is not null;

drop trigger if exists register_records_set_updated_at on public.register_records;
create trigger register_records_set_updated_at
  before update on public.register_records
  for each row execute function public.set_updated_at();

alter table public.register_records enable row level security;

drop policy if exists register_records_member_select on public.register_records;
create policy register_records_member_select on public.register_records
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists register_records_member_write on public.register_records;
create policy register_records_member_write on public.register_records
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- ── 5. register_record_revisions ──────────────────────────────────────────
-- Always-on audit trail. The table is cheap (jsonb diffs only fire on
-- meaningful mutations) and at least half the register types we ship
-- have compliance-mandated audit requirements.

create table if not exists public.register_record_revisions (
  id            uuid primary key default gen_random_uuid(),
  record_id     uuid not null references public.register_records (id) on delete cascade,
  values_before jsonb not null,
  values_after  jsonb not null,
  status_before text,
  status_after  text,
  changed_by    uuid references auth.users (id) on delete set null,
  changed_at    timestamptz not null default now()
);

create index if not exists register_record_revisions_record_idx
  on public.register_record_revisions (record_id, changed_at desc);

create or replace function public.log_register_record_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.values is distinct from old.values
     or new.status is distinct from old.status then
    insert into public.register_record_revisions
      (record_id, values_before, values_after, status_before, status_after, changed_by)
    values
      (new.id, old.values, new.values, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists register_records_log_revision on public.register_records;
create trigger register_records_log_revision
  after update on public.register_records
  for each row execute function public.log_register_record_revision();

alter table public.register_record_revisions enable row level security;

drop policy if exists register_record_revisions_member_select on public.register_record_revisions;
create policy register_record_revisions_member_select on public.register_record_revisions
  for select to authenticated
  using (exists (
    select 1
      from public.register_records rr
     where rr.id = register_record_revisions.record_id
       and rr.organization_id = public.current_org_id()
  ));
