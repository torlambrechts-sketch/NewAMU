-- Compliance template version history (gap D from the audit-trail review).
--
-- Today, when an admin edits a template, the row is mutated in place.
-- The hse_audit_log captures old_data/new_data, but reconstructing
-- "what did template X look like on 2024-09-12" requires manual jsonb-
-- walking through audit log rows. Functional, but not ergonomic for
-- coverage analysis or "show me historical versions of this template".
--
-- This migration introduces a first-class SCD Type 2 history table:
-- compliance_checklist_template_versions. Each row is a snapshot of
-- the template at a point in time, with valid_from / valid_to ranges.
-- Triggers capture INSERTs (version 1, valid_to=NULL) and meaningful
-- UPDATEs (close existing version, insert new). No-op updates that
-- only move updated_at don't create version rows.
--
-- Existing templates are backfilled as version 1 by a one-time DO loop.
--
-- Self-sufficient: re-creates the compliance_review_status enum if it's
-- missing so this migration can run independently of
-- 20260808120000_compliance_templates_review_and_cadence.sql (which is
-- where the enum was originally introduced). Idempotent — a no-op when
-- the type already exists.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_review_status') then
    create type public.compliance_review_status as enum ('draft', 'reviewed', 'approved');
  end if;
end $$;

-- Same self-sufficiency for the two columns added in 20260808120000 — the
-- DO loop below selects v_template.review_status / cadence_hint so these
-- columns must exist on compliance_checklist_templates. Idempotent.
alter table public.compliance_checklist_templates
  add column if not exists review_status public.compliance_review_status not null default 'draft',
  add column if not exists cadence_hint  text;

create table if not exists public.compliance_checklist_template_versions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id     uuid not null references public.compliance_checklist_templates (id) on delete cascade,
  version         int not null,
  -- Snapshotted fields from the template at this version
  name            text not null,
  description     text,
  definition      jsonb not null,
  is_active       boolean not null,
  nav_pinned      boolean not null,
  is_system       boolean not null,
  review_status   public.compliance_review_status not null,
  cadence_hint    text,
  -- SCD Type 2 ranges: valid_from = when this version became current,
  -- valid_to = when it was replaced (NULL means it's the current version).
  valid_from      timestamptz not null default now(),
  valid_to        timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  unique (template_id, version)
);

create index if not exists compliance_checklist_template_versions_template_idx
  on public.compliance_checklist_template_versions (template_id, version desc);

create index if not exists compliance_checklist_template_versions_org_idx
  on public.compliance_checklist_template_versions (organization_id, valid_from desc);

create index if not exists compliance_checklist_template_versions_current_idx
  on public.compliance_checklist_template_versions (template_id)
  where valid_to is null;

alter table public.compliance_checklist_template_versions enable row level security;

drop policy if exists compliance_checklist_template_versions_select_org
  on public.compliance_checklist_template_versions;
create policy compliance_checklist_template_versions_select_org
  on public.compliance_checklist_template_versions for select
  using (organization_id = public.current_org_id());

-- Versions are written exclusively by the trigger; no direct app writes.
-- Service role retains write access for migrations.
drop policy if exists compliance_checklist_template_versions_no_app_write
  on public.compliance_checklist_template_versions;
create policy compliance_checklist_template_versions_no_app_write
  on public.compliance_checklist_template_versions for all
  using (false)
  with check (false);

drop trigger if exists compliance_checklist_template_versions_audit_tg
  on public.compliance_checklist_template_versions;
create trigger compliance_checklist_template_versions_audit_tg
  after insert or update or delete on public.compliance_checklist_template_versions
  for each row execute function public.hse_audit_trigger();

-- ── Trigger: capture version on INSERT and meaningful UPDATE ───────────

create or replace function public.compliance_checklist_templates_capture_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version int;
begin
  if tg_op = 'INSERT' then
    insert into public.compliance_checklist_template_versions (
      organization_id, template_id, version,
      name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint,
      valid_from, valid_to, created_by
    ) values (
      new.organization_id, new.id, 1,
      new.name, new.description, new.definition,
      new.is_active, new.nav_pinned, new.is_system,
      new.review_status, new.cadence_hint,
      new.created_at, null, new.created_by
    );
    return null;
  end if;

  if tg_op = 'UPDATE' then
    -- Skip no-op updates (only updated_at changed). Compare every
    -- snapshotted field — IS NOT DISTINCT FROM handles NULLs.
    if new.name             is not distinct from old.name
       and new.description  is not distinct from old.description
       and new.definition   is not distinct from old.definition
       and new.is_active    is not distinct from old.is_active
       and new.nav_pinned   is not distinct from old.nav_pinned
       and new.is_system    is not distinct from old.is_system
       and new.review_status is not distinct from old.review_status
       and new.cadence_hint is not distinct from old.cadence_hint
    then
      return null;
    end if;

    -- Close the current version
    update public.compliance_checklist_template_versions
    set valid_to = now()
    where template_id = new.id and valid_to is null;

    -- Compute next version number
    select coalesce(max(version), 0) + 1
    into v_next_version
    from public.compliance_checklist_template_versions
    where template_id = new.id;

    -- Insert new current version row
    insert into public.compliance_checklist_template_versions (
      organization_id, template_id, version,
      name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint,
      valid_from, valid_to, created_by
    ) values (
      new.organization_id, new.id, v_next_version,
      new.name, new.description, new.definition,
      new.is_active, new.nav_pinned, new.is_system,
      new.review_status, new.cadence_hint,
      now(), null, auth.uid()
    );
    return null;
  end if;

  return null;
end;
$$;

drop trigger if exists compliance_checklist_templates_capture_version_tg
  on public.compliance_checklist_templates;
create trigger compliance_checklist_templates_capture_version_tg
  after insert or update on public.compliance_checklist_templates
  for each row execute function public.compliance_checklist_templates_capture_version();

-- ── One-time backfill: existing templates become version 1 ─────────────

do $$
declare
  v_template record;
begin
  for v_template in
    select * from public.compliance_checklist_templates
    where deleted_at is null
  loop
    insert into public.compliance_checklist_template_versions (
      organization_id, template_id, version,
      name, description, definition,
      is_active, nav_pinned, is_system, review_status, cadence_hint,
      valid_from, valid_to, created_by
    ) values (
      v_template.organization_id, v_template.id, 1,
      v_template.name, v_template.description, v_template.definition,
      v_template.is_active, v_template.nav_pinned, v_template.is_system,
      v_template.review_status, v_template.cadence_hint,
      v_template.created_at, null, v_template.created_by
    )
    on conflict (template_id, version) do nothing;
  end loop;
end $$;
