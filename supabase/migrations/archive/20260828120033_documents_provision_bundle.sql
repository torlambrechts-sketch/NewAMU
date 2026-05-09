-- Documents provision bundle — recovery (documents-parity §T7).
--
-- Documents layer differently from compliance/survey:
--   - `document_system_templates` is the global catalog (no org_id);
--     visible to every org without per-org mirroring.
--   - `document_org_template_settings (organization_id, template_id)` is
--     a per-org toggle on a system template (enabled/disabled).
--   - `document_org_templates` is the per-org *custom* template table —
--     entirely admin-authored, no system-mirror layer.
--
-- That means the survey-style "mirror catalog → org rows with
-- nav_pinned=true" pattern doesn't 1:1 apply. What does need backfilling
-- is the `document_org_template_settings` rows: an org with no row is
-- treated as "implicitly enabled" by the admin UI, but admins reading
-- the settings page expect to see an explicit row per system template.
--
-- This migration:
--   1. Creates `provision_documents_baseline_for_org(p_org_id)` which
--      ensures one settings row per (org, system template). Idempotent
--      via the composite PK on `document_org_template_settings`.
--   2. Wires a trigger on `organizations` insert so new tenants get the
--      baseline automatically.
--   3. Backfills every existing org. Safe to re-run.

set local search_path = public, pg_catalog;

-- ── 1. Provision function ─────────────────────────────────────────────────

create or replace function public.provision_documents_baseline_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.document_org_template_settings (organization_id, template_id, enabled)
  select p_org_id, t.id, true
  from public.document_system_templates t
  on conflict (organization_id, template_id) do nothing;
end;
$$;

revoke all on function public.provision_documents_baseline_for_org(uuid) from public, anon;
grant execute on function public.provision_documents_baseline_for_org(uuid) to authenticated, service_role;

-- ── 2. Trigger: new-org auto-baseline ─────────────────────────────────────

create or replace function public.documents_provision_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.provision_documents_baseline_for_org(new.id);
  return new;
end;
$$;

drop trigger if exists documents_provision_on_org_insert_tg on public.organizations;
create trigger documents_provision_on_org_insert_tg
  after insert on public.organizations
  for each row execute function public.documents_provision_on_org_insert();

-- ── 3. Backfill every existing org ────────────────────────────────────────

do $$
declare
  v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.provision_documents_baseline_for_org(v_org.id);
  end loop;
end $$;
