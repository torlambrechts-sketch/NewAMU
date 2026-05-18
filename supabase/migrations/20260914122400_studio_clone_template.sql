-- Studio Builder — clone-from-system-template RPC.
--
-- The actual user job: pick a system template, copy it into my org's
-- editable space, return the new row id so the studio shell can open
-- it for edit.
--
-- This migration ships ONE entry-point function with a scope_id
-- discriminator. Each branch handles the specific system→org table pair
-- per scope, with the right column mapping. Adding a new scope = add a
-- branch here.
--
-- Returns the new row's uuid as text (uuid for compliance/documents/
-- meetings, text id for some legacy tables).
--
-- Security: caller must be authenticated + the resolved target org
-- must be the caller's profile.organization_id (no cross-org clone).
--
-- Idempotent at the function level; each clone produces a fresh row.

set local search_path = public, pg_catalog;

create or replace function public.clone_studio_template(
  p_scope_id text,
  p_system_id text
) returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org_id uuid;
  v_new_id uuid;
  v_new_id_text text;
begin
  select organization_id into v_org_id
    from public.profiles where id = auth.uid();
  if v_org_id is null then
    raise exception 'No active organization for caller.' using errcode = 'P0001';
  end if;

  -- ────────────────────────────────────────────────────────────────────
  -- compliance: compliance_checklist_templates → same table, is_system=false
  -- ────────────────────────────────────────────────────────────────────
  if p_scope_id = 'compliance' then
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, is_system, review_status, cadence_hint, category_id,
      law_refs, metadata_schema, nav_pinned
    )
    select
      v_org_id, t.pack, t.slug || '-klon-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      t.name || ' (klon)', t.description, t.definition,
      true, false, 'draft', t.cadence_hint, null,
      t.law_refs, t.metadata_schema, false
    from public.compliance_checklist_templates t
    where t.id = p_system_id::uuid and t.is_system = true
    returning id into v_new_id;
    if v_new_id is null then
      raise exception 'System template % not found in compliance_checklist_templates', p_system_id;
    end if;
    return v_new_id::text;

  -- ────────────────────────────────────────────────────────────────────
  -- documents: document_system_templates → document_org_templates
  -- ────────────────────────────────────────────────────────────────────
  elsif p_scope_id = 'documents' then
    insert into public.document_org_templates (
      organization_id, label, description, category, legal_basis, page_payload, review_status
    )
    select v_org_id,
      s.label || ' (klon)', s.description, s.category, s.legal_basis,
      s.page_payload, 'draft'
    from public.document_system_templates s
    where s.id = p_system_id
    returning id into v_new_id;
    if v_new_id is null then
      raise exception 'System template % not found in document_system_templates', p_system_id;
    end if;
    return v_new_id::text;

  -- ────────────────────────────────────────────────────────────────────
  -- meetings: meeting_system_templates → meeting_org_templates
  -- ────────────────────────────────────────────────────────────────────
  elsif p_scope_id = 'meetings' then
    insert into public.meeting_org_templates (
      organization_id, slug, name, description, framework, frameworks,
      cadence_hint, definition, law_refs, metadata_schema, is_active,
      default_confidentiality_level, default_duration_minutes,
      minimum_employee_count, nav_pinned, review_status
    )
    select v_org_id,
      s.slug || '-klon-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      s.label || ' (klon)', s.description, s.framework, s.frameworks,
      s.cadence_hint, s.definition, s.law_refs, s.metadata_schema, true,
      s.default_confidentiality_level, s.default_duration_minutes,
      s.minimum_employee_count, false, 'draft'
    from public.meeting_system_templates s
    where s.id = p_system_id::uuid
    returning id into v_new_id;
    if v_new_id is null then
      raise exception 'System template % not found in meeting_system_templates', p_system_id;
    end if;
    return v_new_id::text;

  -- ────────────────────────────────────────────────────────────────────
  -- survey: survey_template_catalog → survey_org_templates
  -- ────────────────────────────────────────────────────────────────────
  elsif p_scope_id = 'survey' then
    insert into public.survey_org_templates (
      organization_id, catalog_id, pack, name_override, description_override,
      body_override, law_refs, cadence_hint, is_active, nav_pinned, review_status
    )
    select v_org_id, s.id, s.pack, s.name || ' (klon)', s.description,
      s.body, s.law_refs, ('arlig')::text, true, false, 'draft'
    from public.survey_template_catalog s
    where s.id = p_system_id::uuid
    returning id into v_new_id;
    if v_new_id is null then
      raise exception 'System template % not found in survey_template_catalog', p_system_id;
    end if;
    return v_new_id::text;
  else
    raise exception 'Scope % not supported by clone_studio_template (compliance / documents / meetings / survey only)', p_scope_id
      using errcode = 'P0001';
  end if;
end;
$fn$;

comment on function public.clone_studio_template(text, text) is
  'Studio Builder — clone a system template into the caller''s org-editable space. Returns the new row id. Scope id discriminator: compliance / documents / meetings / survey.';

grant execute on function public.clone_studio_template(text, text) to authenticated;
