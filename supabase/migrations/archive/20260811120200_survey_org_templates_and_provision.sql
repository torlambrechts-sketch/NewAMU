-- Per-org survey template overrides + license-grant provisioning.
--
-- Adds survey_org_templates: one row per (org, catalog_template) where the
-- org has any per-org state — pinning to sidebar, custom name, custom body,
-- review status. Linking to survey_template_catalog by catalog_id (text PK)
-- means both system catalog templates AND the org's own org-authored
-- templates can have survey_org_templates rows; the data model is uniform.
--
-- The override fields (name_override, description_override, body_override)
-- are NULL by default — the consuming hook merges catalog row + override row
-- with COALESCE so unmodified system rows render as their catalog content.
--
-- provision_survey_baseline_for_org(p_org_id, p_pack_slug):
--   For every system catalog template (organization_id IS NULL,
--   is_system=true, is_active=true) whose pack matches, idempotently
--   insert a survey_org_templates row with nav_pinned=true so new tenants
--   discover the templates immediately. Customer toggles individual
--   templates off via the Maler admin tab without affecting other tenants.
--
-- AFTER INSERT/UPDATE trigger on survey_packs calls the function whenever a
-- pack license is granted (insert with is_active=true OR re-activation
-- false→true). Mirrors the compliance_pack provisioning pattern from
-- 20260808120100.

-- ── Table: survey_org_templates ────────────────────────────────────────────

create table if not exists public.survey_org_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  catalog_id      text not null references public.survey_template_catalog (id) on delete cascade,
  pack            public.survey_pack not null,
  -- Override fields. NULL = inherit from the linked catalog row.
  name_override        text,
  description_override text,
  body_override        jsonb,
  -- Per-org operational state (cannot be inherited).
  nav_pinned     boolean not null default false,
  is_active      boolean not null default true,
  review_status  public.compliance_review_status not null default 'draft',
  cadence_hint   text,
  deleted_at     timestamptz,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (organization_id, catalog_id),
  check (body_override is null or jsonb_typeof(body_override) = 'object')
);

create index if not exists survey_org_templates_org_pack_idx
  on public.survey_org_templates (organization_id, pack, is_active, nav_pinned);

create index if not exists survey_org_templates_pinned_idx
  on public.survey_org_templates (organization_id, pack)
  where nav_pinned = true and is_active = true and deleted_at is null;

alter table public.survey_org_templates enable row level security;

drop policy if exists survey_org_templates_select_org on public.survey_org_templates;
create policy survey_org_templates_select_org
  on public.survey_org_templates for select
  using (organization_id = public.current_org_id());

drop policy if exists survey_org_templates_write_org on public.survey_org_templates;
create policy survey_org_templates_write_org
  on public.survey_org_templates for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.survey_org_templates_before_insert_defaults()
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

drop trigger if exists survey_org_templates_before_insert_defaults_tg on public.survey_org_templates;
create trigger survey_org_templates_before_insert_defaults_tg
  before insert on public.survey_org_templates
  for each row execute function public.survey_org_templates_before_insert_defaults();

drop trigger if exists survey_org_templates_set_updated_at on public.survey_org_templates;
create trigger survey_org_templates_set_updated_at
  before update on public.survey_org_templates
  for each row execute function public.set_updated_at();

drop trigger if exists survey_org_templates_audit_tg on public.survey_org_templates;
create trigger survey_org_templates_audit_tg
  after insert or update or delete on public.survey_org_templates
  for each row execute function public.hse_audit_trigger();

-- ── Provision function ────────────────────────────────────────────────────

create or replace function public.provision_survey_baseline_for_org(
  p_org_id    uuid,
  p_pack_slug public.survey_pack
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Mirror every system catalog template that matches the pack into a
  -- per-org override row, with overrides NULL so the consuming hook
  -- inherits all content from the catalog. nav_pinned defaults to true
  -- on provisioning so new tenants discover the templates in their
  -- sidebar from day one. Customer admins toggle individual templates
  -- off via the Maler admin tab.
  insert into public.survey_org_templates (
    organization_id, catalog_id, pack, nav_pinned, is_active
  )
  select
    p_org_id, c.id, c.pack, true, true
  from public.survey_template_catalog c
  where c.organization_id is null
    and c.is_system = true
    and c.is_active = true
    and c.pack = p_pack_slug
  on conflict (organization_id, catalog_id) do nothing;
end;
$$;

revoke all on function public.provision_survey_baseline_for_org(uuid, public.survey_pack)
  from public, anon;
grant execute on function public.provision_survey_baseline_for_org(uuid, public.survey_pack)
  to authenticated, service_role;

-- ── Trigger: license-grant fires provisioning ─────────────────────────────

create or replace function public.survey_pack_provision_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active = true then
    if (tg_op = 'INSERT')
       or (tg_op = 'UPDATE' and old.is_active = false)
    then
      perform public.provision_survey_baseline_for_org(
        new.organization_id, new.slug
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists survey_pack_provision_tg on public.survey_packs;
create trigger survey_pack_provision_tg
  after insert or update on public.survey_packs
  for each row execute function public.survey_pack_provision_on_change();

-- ── Backfill: provision for every existing active (org, pack) ─────────────

do $$
declare
  v_pack record;
begin
  for v_pack in
    select organization_id, slug
    from public.survey_packs
    where is_active = true
      and deleted_at is null
  loop
    perform public.provision_survey_baseline_for_org(
      v_pack.organization_id, v_pack.slug
    );
  end loop;
end $$;
