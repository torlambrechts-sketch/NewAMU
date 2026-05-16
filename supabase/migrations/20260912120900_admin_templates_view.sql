-- v_admin_templates — unified, RLS-aware view of every template-bearing
-- module so /admin/templates can query ONE source instead of branching
-- per module. Each `union all` clause normalises one module's row
-- shape into a common projection:
--
--   row_id          stable id of form '<source>:<source_id>'
--   source          enum-ish text: compliance, survey, documents,
--                   learning, registers, tasks, meetings, alerts,
--                   workflow
--   source_id       the per-source primary key (cast to text)
--   name            human-readable label
--   category_name   joined category name when the source has one,
--                   null otherwise
--   status          'active' | 'inactive' | 'draft' | 'archived' | 'system'
--   is_system       true for catalog-only / platform-defined rows
--   updated_at      most-recent edit timestamp
--   organization_id row's org; null for system-only catalog
--   pack            optional pack/category hint
--   hint            optional free-form context the UI can render
--
-- Adding a new template-bearing module = adding one `union all` block
-- here. Per-source TS bridges still exist for the editor forms (each
-- module's data shape is too different to genericise), but the LIST
-- is now driven entirely from this view.
--
-- RLS: each underlying table's RLS policies are enforced through the
-- view (Postgres respects them on SELECT). No bypass.

create or replace view public.v_admin_templates as
  -- 1. Compliance
  select
    'compliance:' || t.id::text as row_id,
    'compliance'::text as source,
    t.id::text as source_id,
    t.name,
    cat.name as category_name,
    case when t.is_active then 'active' else 'inactive' end as status,
    false as is_system,
    t.updated_at,
    t.organization_id,
    t.pack::text as pack,
    null::text as hint
  from public.compliance_checklist_templates t
  left join public.compliance_categories cat on cat.id = t.category_id
  where t.deleted_at is null

  union all

  -- 2. Survey (override + catalog join)
  select
    'survey:' || ot.id::text as row_id,
    'survey'::text as source,
    ot.id::text as source_id,
    coalesce(ot.name_override, cat.name) as name,
    sc.name as category_name,
    case when ot.is_active then 'active' else 'inactive' end as status,
    coalesce(cat.is_system, false) as is_system,
    ot.updated_at,
    ot.organization_id,
    ot.pack::text as pack,
    null::text as hint
  from public.survey_org_templates ot
  join public.survey_template_catalog cat on cat.id = ot.catalog_id
  left join public.survey_template_categories sc on sc.id = ot.category_id
  where ot.deleted_at is null

  union all

  -- 3. Documents (self-contained)
  select
    'documents:' || d.id as row_id,
    'documents'::text as source,
    d.id as source_id,
    d.label as name,
    null::text as category_name,
    'active'::text as status,
    false as is_system,
    d.updated_at,
    d.organization_id,
    d.category as pack,
    null::text as hint
  from public.document_org_templates d
  where d.deleted_at is null

  union all

  -- 4. Learning (course = template)
  select
    'learning:' || lc.id::text as row_id,
    'learning'::text as source,
    lc.id::text as source_id,
    lc.title as name,
    lcat.name as category_name,
    case lc.status
      when 'published' then 'active'
      when 'draft' then 'draft'
      when 'archived' then 'archived'
      else 'inactive'
    end as status,
    false as is_system,
    lc.updated_at,
    lc.organization_id,
    null::text as pack,
    null::text as hint
  from public.learning_courses lc
  left join public.learning_categories lcat on lcat.id = lc.category_id

  union all

  -- 5. Registers (org + system)
  select
    'registers:' || rt.id as row_id,
    'registers'::text as source,
    rt.id as source_id,
    rt.name,
    null::text as category_name,
    case
      when not rt.is_active then 'inactive'
      when rt.is_system then 'system'
      else 'active'
    end as status,
    rt.is_system,
    rt.updated_at,
    coalesce(rt.organization_id, public.current_org_id()) as organization_id,
    null::text as pack,
    case when array_length(rt.regulation_ids, 1) > 0 then 'regelverk: ' || array_to_string(rt.regulation_ids, ', ') end as hint
  from public.register_types rt
  where rt.deleted_at is null
    and (rt.organization_id is null or rt.organization_id = public.current_org_id())

  union all

  -- 6. Tasks (override + catalog join, like survey)
  select
    'tasks:' || ot.id::text as row_id,
    'tasks'::text as source,
    ot.id::text as source_id,
    cat.name as name,
    null::text as category_name,
    case when ot.is_active then 'active' else 'inactive' end as status,
    coalesce(cat.is_system, false) as is_system,
    ot.updated_at,
    ot.organization_id,
    cat.pack::text as pack,
    null::text as hint
  from public.task_org_templates ot
  join public.task_template_catalog cat on cat.id = ot.catalog_id
  where ot.deleted_at is null

  union all

  -- 7. Meetings (self-contained)
  select
    'meetings:' || m.id::text as row_id,
    'meetings'::text as source,
    m.id::text as source_id,
    m.name,
    mc.name as category_name,
    case when m.is_active then 'active' else 'inactive' end as status,
    false as is_system,
    m.updated_at,
    m.organization_id,
    m.framework as pack,
    null::text as hint
  from public.meeting_org_templates m
  left join public.meeting_template_categories mc on mc.id = m.category_id
  where m.deleted_at is null

  union all

  -- 8. Alerts (self-contained)
  select
    'alerts:' || a.id::text as row_id,
    'alerts'::text as source,
    a.id::text as source_id,
    a.name,
    ac.name as category_name,
    'active'::text as status,
    false as is_system,
    a.updated_at,
    a.organization_id,
    a.kind as pack,
    null::text as hint
  from public.alert_org_templates a
  left join public.alert_template_categories ac on ac.id = a.category_id

  union all

  -- 9. Workflow (catalog only — system rows; read-only in /admin/templates)
  select
    'workflow:' || w.id::text as row_id,
    'workflow'::text as source,
    w.id::text as source_id,
    w.name,
    null::text as category_name,
    'system'::text as status,
    true as is_system,
    w.created_at as updated_at,
    public.current_org_id() as organization_id,
    w.category as pack,
    w.source_module as hint
  from public.workflow_template_catalog w
  where w.is_system = true;

comment on view public.v_admin_templates is
  'Unified read-only view of every template-bearing module surfaced on /admin/templates. Append a new union-all block to register a new source.';

grant select on public.v_admin_templates to authenticated;
