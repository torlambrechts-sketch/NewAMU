-- Studio Builder — clone_studio_template v2 — extend to all 8 scopes.
--
-- _122400 shipped the RPC with 4 branches (compliance/documents/
-- meetings/survey). This re-creates it with branches for the
-- remaining 4: learning / registers / dashboards / workflows. Same
-- contract: returns the new row id as text.
--
-- Per-scope source tables:
--   learning   → learning_system_courses + learning_system_course_locales
--                → learning_courses with source_system_course_id set
--   registers  → register_types where organization_id is null + is_system
--                → register_types with org row
--   dashboards → dashboard_layouts where is_system=true
--                → dashboard_layouts copy, owner_user_id = auth.uid()
--   workflows  → workflow_template_catalog
--                → workflow_rules with catalog_slug/version set
--
-- Idempotent: create or replace.

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
  v_title text;
  v_modules jsonb;
  v_description text;
begin
  select organization_id into v_org_id from public.profiles where id = auth.uid();
  if v_org_id is null then
    raise exception 'No active organization for caller.' using errcode = 'P0001';
  end if;

  -- compliance
  if p_scope_id = 'compliance' then
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      is_active, is_system, review_status, cadence_hint, category_id,
      law_refs, metadata_schema, nav_pinned
    )
    select v_org_id, t.pack, t.slug || '-klon-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      t.name || ' (klon)', t.description, t.definition,
      true, false, 'draft', t.cadence_hint, null,
      t.law_refs, t.metadata_schema, false
    from public.compliance_checklist_templates t
    where t.id = p_system_id::uuid and t.is_system = true
    returning id into v_new_id;
    if v_new_id is null then raise exception 'System template % not found', p_system_id; end if;
    return v_new_id::text;

  -- documents
  elsif p_scope_id = 'documents' then
    insert into public.document_org_templates (
      organization_id, label, description, category, legal_basis, page_payload, review_status
    )
    select v_org_id, s.label || ' (klon)', s.description, s.category, s.legal_basis, s.page_payload, 'draft'
    from public.document_system_templates s where s.id = p_system_id
    returning id into v_new_id;
    if v_new_id is null then raise exception 'System template % not found', p_system_id; end if;
    return v_new_id::text;

  -- meetings
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
    from public.meeting_system_templates s where s.id = p_system_id::uuid
    returning id into v_new_id;
    if v_new_id is null then raise exception 'System template % not found', p_system_id; end if;
    return v_new_id::text;

  -- survey
  elsif p_scope_id = 'survey' then
    insert into public.survey_org_templates (
      organization_id, catalog_id, pack, name_override, description_override,
      body_override, law_refs, cadence_hint, is_active, nav_pinned, review_status
    )
    select v_org_id, s.id, s.pack, s.name || ' (klon)', s.description,
      s.body, s.law_refs, 'arlig', true, false, 'draft'
    from public.survey_template_catalog s where s.id = p_system_id::uuid
    returning id into v_new_id;
    if v_new_id is null then raise exception 'System template % not found', p_system_id; end if;
    return v_new_id::text;

  -- learning: pull title + modules from the system course's NB locale
  -- (fall back to en or any). Wires source_system_course_id so the
  -- forked course retains its lineage for diffing later.
  elsif p_scope_id = 'learning' then
    select coalesce(l.title, 'Kurs') into v_title
      from public.learning_system_course_locales l
      where l.system_course_id = p_system_id::uuid
      order by case when l.locale = 'nb' then 0 when l.locale = 'en' then 1 else 2 end
      limit 1;
    select l.description into v_description
      from public.learning_system_course_locales l
      where l.system_course_id = p_system_id::uuid
      order by case when l.locale = 'nb' then 0 when l.locale = 'en' then 1 else 2 end
      limit 1;
    select l.modules into v_modules
      from public.learning_system_course_locales l
      where l.system_course_id = p_system_id::uuid
      order by case when l.locale = 'nb' then 0 when l.locale = 'en' then 1 else 2 end
      limit 1;

    insert into public.learning_courses (
      organization_id, source_system_course_id, title, description, status,
      law_refs, required_for_roles, recertification_months, catalog_locale,
      tags, review_status
    )
    select v_org_id, s.id, v_title || ' (klon)', v_description, 'draft',
      s.law_refs, s.required_for_roles, null, s.default_locale,
      array[]::text[], 'draft'
    from public.learning_system_courses s where s.id = p_system_id::uuid
    returning id into v_new_id;
    if v_new_id is null then raise exception 'System course % not found', p_system_id; end if;
    return v_new_id::text;

  -- registers
  elsif p_scope_id = 'registers' then
    insert into public.register_types (
      organization_id, name, description, metadata_schema,
      is_active, is_system, regulation_ids, pack_slugs, aml_paragraphs,
      default_review_cadence_months, position, review_status
    )
    select v_org_id, s.name || ' (klon)', s.description, s.metadata_schema,
      true, false, s.regulation_ids, s.pack_slugs, s.aml_paragraphs,
      s.default_review_cadence_months, coalesce(s.position, 0) + 100, 'draft'
    from public.register_types s
    where s.id = p_system_id::uuid and (s.organization_id is null or s.is_system = true)
    returning id into v_new_id;
    if v_new_id is null then raise exception 'System register-type % not found', p_system_id; end if;
    return v_new_id::text;

  -- dashboards
  elsif p_scope_id = 'dashboards' then
    insert into public.dashboard_layouts (
      organization_id, scope_id, name, slug, kind, layout, filters,
      is_default, is_system, owner_user_id, description
    )
    select v_org_id, s.scope_id, s.name || ' (klon)',
      coalesce(s.slug, 'layout') || '-klon-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      'dashboard', s.layout, s.filters, false, false, auth.uid(), s.description
    from public.dashboard_layouts s
    where s.id = p_system_id::uuid and s.is_system = true
    returning id into v_new_id;
    if v_new_id is null then raise exception 'System dashboard % not found', p_system_id; end if;
    return v_new_id::text;

  -- workflows
  elsif p_scope_id = 'workflows' then
    insert into public.workflow_rules (
      organization_id, slug, name, description, source_module, module_id,
      trigger_event, trigger_event_name, condition_json, actions_json,
      is_active, is_template, catalog_slug, law_refs, frameworks
    )
    select v_org_id,
      s.slug || '-klon-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      s.name || ' (klon)', s.description, s.source_module,
      null, s.trigger_event_name, s.trigger_event_name,
      s.condition_json, s.actions_json,
      false, false, s.slug, s.law_refs, array[]::text[]
    from public.workflow_template_catalog s where s.id = p_system_id::uuid
    returning id into v_new_id;
    if v_new_id is null then raise exception 'System workflow template % not found', p_system_id; end if;
    return v_new_id::text;

  else
    raise exception 'Scope % not supported by clone_studio_template', p_scope_id using errcode = 'P0001';
  end if;
end;
$fn$;

grant execute on function public.clone_studio_template(text, text) to authenticated;
