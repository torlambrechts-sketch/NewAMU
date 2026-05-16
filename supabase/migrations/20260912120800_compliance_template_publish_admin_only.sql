-- Phase 13 security hotfix: publish RPC is platform_admin only.
--
-- Supervisor pass on Phase 13 caught: compliance_template_publish_version
-- is security definer AND granted to 'authenticated' — meaning any
-- authenticated user could call it and bump current_version on every
-- per-org row (including other orgs'). Restrict to platform admins,
-- who already control the version cycle.
--
-- Note: this file mirrors the same change baked into the Phase 13 source
-- file (_120700) by the same supervisor pass. Keeping it as a separate
-- migration so the audit trail shows "we caught + patched in two minutes",
-- and so fresh-DB bootstraps from current source apply the gate before
-- the function is ever exposed.

set local search_path = public, pg_catalog;

create or replace function public.compliance_template_publish_version(
  p_slug          text,
  p_pack_slug     public.compliance_pack,
  p_version_major int,
  p_version_minor int,
  p_changelog     text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_src compliance_checklist_templates%rowtype;
  v_version_id uuid;
begin
  if not public.platform_is_admin() then
    raise exception 'Only platform admins can publish template versions'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_src
  from public.compliance_checklist_templates
  where slug = p_slug and pack = p_pack_slug
    and is_system = true and deleted_at is null
  limit 1;

  if v_src.id is null then
    raise exception 'No template found for slug=% pack=%', p_slug, p_pack_slug;
  end if;

  insert into public.compliance_template_versions (
    slug, pack, version_major, version_minor,
    name, description, definition, metadata_schema, law_refs,
    changelog, published_by
  ) values (
    p_slug, p_pack_slug, p_version_major, p_version_minor,
    v_src.name, v_src.description, v_src.definition, v_src.metadata_schema, v_src.law_refs,
    p_changelog, auth.uid()
  )
  on conflict (slug, pack, version_major, version_minor) do update set
    name            = excluded.name,
    description     = excluded.description,
    definition      = excluded.definition,
    metadata_schema = excluded.metadata_schema,
    law_refs        = excluded.law_refs,
    changelog       = excluded.changelog
  returning id into v_version_id;

  update public.compliance_checklist_templates
  set current_version_major = p_version_major,
      current_version_minor = p_version_minor,
      updated_at = now()
  where slug = p_slug and pack = p_pack_slug;

  return v_version_id;
end;
$$;

comment on function public.compliance_template_publish_version(text, public.compliance_pack, int, int, text) is
  'Publish a new version of a compliance walkthrough template. PLATFORM ADMIN ONLY (security definer + platform_is_admin gate).';

grant execute on function public.compliance_template_publish_version(text, public.compliance_pack, int, int, text) to authenticated;
