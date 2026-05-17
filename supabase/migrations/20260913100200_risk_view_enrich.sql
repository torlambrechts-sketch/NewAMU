-- Risk register — view enrichment (P2 follow-up)
--
-- Closes two visibility gaps surfaced in the post-P2 review:
--
--   1. Recurrence-based likelihood for compliance findings
--      The P1 client-side aggregation bucketed findings by template
--      recurrence count → likelihood 1..5 (the Norwegian convention:
--      "skjer dette ofte?"). The P2 view hard-coded likelihood=3,
--      losing that signal. We restore it via a window function so a
--      chronic checklist item that fires every week is correctly
--      separated from a one-off finding.
--
--   2. Law-refs propagated from the template definition
--      Compliance findings inherit their law_refs from the parent
--      template's jsonb definition (`items[].law_ref` keyed by
--      `item_key`). The original view set `law_refs = []` so the
--      psychosocial detection, the `lawRef` filter chip, and any
--      future law-ref-based grouping were blind. We lift the law_ref
--      into the unified column via a correlated subquery.
--
-- Self-audit (Arbeidstilsynet POV):
--   Pålegg-grunner addressed:
--   - AML § 4-3 detection improves: psykososial-tagged items in
--     templates (law_ref='AML §4-3') now classify their findings
--     correctly without relying on template-slug heuristics.
--   - IK-f § 5 nr. 6 — repeat-finding likelihood is the inspector's
--     core question ("hvor ofte skjer dette?"). Restoring it makes
--     the heatmap honest.
--   Restrisiko:
--   - Law-ref lookup is a correlated subquery — fine on the SMB
--     scale we target. If row counts grow past a few thousand
--     findings/org, consider a materialised view.
--   - `compliance_checklist_templates.definition` is jsonb; if a
--     template uses `law_refs` (plural array) instead of `law_ref`
--     (singular), we currently miss it. The view checks both shapes.

set local search_path = public, pg_catalog;

-- Helper: extract law_refs[] for a finding from its template
-- definition. Returns [] when no match. Lives in SQL so the view's
-- correlated subquery stays declarative.
create or replace function public.risk_finding_law_refs(p_org uuid, p_template_slug text, p_item_key text)
returns text[]
language sql stable as $$
  with hit as (
    select t.definition
    from public.compliance_checklist_templates t
    where t.organization_id = p_org
      and t.slug = p_template_slug
      and t.deleted_at is null
    limit 1
  ),
  item as (
    select value as item
    from hit, jsonb_array_elements(hit.definition->'items') as value
    where value->>'key' = p_item_key
    limit 1
  )
  select coalesce(
    -- Plural form: law_refs is a jsonb array of strings.
    (select array_agg(x::text)
     from item, jsonb_array_elements_text(item.item->'law_refs') as x
     where item.item ? 'law_refs'),
    -- Singular form: law_ref is a text scalar. Split on comma so
    -- entries like 'AML §4-1, §4-4' surface as two refs.
    (select array(
       select trim(unnest(string_to_array(item.item->>'law_ref', ',')))
     )
     from item
     where item.item ? 'law_ref'),
    array[]::text[]
  )
$$;

comment on function public.risk_finding_law_refs(uuid, text, text) is
  'Resolve law_refs[] for a checklist response by looking up the item '
  'in the parent template definition. Supports both plural law_refs[] '
  'and legacy singular law_ref scalar (comma-split).';

-- Re-create the view with recurrence-based likelihood and law-ref
-- enrichment. `create or replace view` is the idempotent path; we
-- have to repeat every UNION branch because PostgreSQL doesn't
-- support partial view edits.
create or replace view public.risk_register_unified_v as
-- 1. Compliance checklist findings
select
  'checklist'::text                                  as source,
  r.id                                               as source_id,
  r.organization_id,
  coalesce(nullif(r.item_key, ''), '(uten tittel)') as title,
  public.risk_hazard_slug(e.template_slug)           as hazard_category,
  -- Recurrence-based likelihood: count this template's findings org-
  -- wide, bucket into 1..5. Window over (org, template_slug) so each
  -- finding sees the same per-template population. Mirrors
  -- mapRecurrenceToLikelihood in modules/risk/dashboards/hazardCategories.ts.
  case
    when count(*) over (partition by r.organization_id, e.template_slug) >= 13 then 5
    when count(*) over (partition by r.organization_id, e.template_slug) >= 7  then 4
    when count(*) over (partition by r.organization_id, e.template_slug) >= 4  then 3
    when count(*) over (partition by r.organization_id, e.template_slug) >= 2  then 2
    else 1
  end                                                as likelihood,
  public.risk_severity_to_consequence(r.severity::text) as consequence,
  null::int                                          as residual_likelihood,
  null::int                                          as residual_consequence,
  null::text                                         as residual_justification,
  r.severity::text                                   as severity_tier,
  'open'::text                                       as status_tier,
  true                                               as is_open,
  exists (
    select 1 from public.action_plan_items a
    where a.source_table = 'compliance_checklist_responses'
      and a.source_id    = r.id
      and a.status in ('open','in_progress')
  )                                                  as has_open_action,
  -- Law-refs from the parent template definition (replaces the
  -- hard-coded empty array in the original view).
  public.risk_finding_law_refs(r.organization_id, e.template_slug, r.item_key) as law_refs,
  e.department_id,
  e.location_id,
  null::uuid                                         as owner_user_id,
  r.created_at,
  coalesce(r.updated_at, r.created_at)               as last_reviewed_at,
  null::timestamptz                                  as closed_at,
  e.template_slug                                    as origin_slug
from public.compliance_checklist_responses r
inner join public.compliance_checklist_executions e on e.id = r.execution_id
where r.is_finding = true and r.severity is not null

union all

-- 2. Task items (unchanged from original view, repeated for the
--    create-or-replace).
select
  'task'::text                                       as source,
  t.id                                               as source_id,
  t.organization_id,
  t.title,
  public.risk_hazard_slug(t.template_slug)           as hazard_category,
  case t.template_kind
    when 'nestenulykke' then 4
    when 'avvik'        then 3
    when 'tiltak'       then 2
    when 'risiko'       then 3
    else 3
  end                                                as likelihood,
  public.risk_severity_to_consequence(t.priority::text) as consequence,
  null::int                                          as residual_likelihood,
  null::int                                          as residual_consequence,
  null::text                                         as residual_justification,
  t.priority::text                                   as severity_tier,
  case
    when t.status in ('closed','cancelled','done')         then 'closed'
    when t.status = 'effectiveness_verified'                then 'mitigated'
    when t.status in ('in_progress','root_cause_identified','action_defined','action_implemented','effectiveness_pending') then 'in_progress'
    else 'open'
  end                                                as status_tier,
  (t.status not in ('closed','cancelled','done'))    as is_open,
  exists (
    select 1 from public.task_items child
    where child.parent_item_id = t.id
      and child.deleted_at is null
      and child.status not in ('closed','cancelled','done')
  )                                                  as has_open_action,
  coalesce(t.law_refs, '{}'::text[])                 as law_refs,
  null::uuid                                         as department_id,
  null::uuid                                         as location_id,
  t.assignee_user_id                                 as owner_user_id,
  t.created_at,
  t.created_at                                       as last_reviewed_at,
  t.closed_at,
  t.template_slug                                    as origin_slug
from public.task_items t
where t.template_kind in ('avvik','nestenulykke','risiko','tiltak')
  and t.deleted_at is null

union all

-- 3. Deviations
select
  'deviation'::text                                  as source,
  d.id                                               as source_id,
  d.organization_id,
  d.title,
  'other'::text                                      as hazard_category,
  3                                                  as likelihood,
  public.risk_severity_to_consequence(d.severity::text) as consequence,
  null::int                                          as residual_likelihood,
  null::int                                          as residual_consequence,
  null::text                                         as residual_justification,
  d.severity::text                                   as severity_tier,
  case d.status
    when 'closed'      then 'closed'
    when 'in_progress' then 'in_progress'
    else 'open'
  end                                                as status_tier,
  (d.status <> 'closed')                             as is_open,
  exists (
    select 1 from public.action_plan_items a
    where a.source_table = 'deviations'
      and a.source_id    = d.id
      and a.status in ('open','in_progress')
  )                                                  as has_open_action,
  array[]::text[]                                    as law_refs,
  null::uuid                                         as department_id,
  null::uuid                                         as location_id,
  null::uuid                                         as owner_user_id,
  d.created_at,
  coalesce(d.updated_at, d.created_at)               as last_reviewed_at,
  null::timestamptz                                  as closed_at,
  d.source                                           as origin_slug
from public.deviations d

union all

-- 4. Inspection findings
select
  'inspection'::text                                 as source,
  f.id                                               as source_id,
  f.organization_id,
  coalesce(nullif(f.description, ''), '(uten beskrivelse)') as title,
  'other'::text                                      as hazard_category,
  2                                                  as likelihood,
  public.risk_severity_to_consequence(f.severity::text) as consequence,
  null::int                                          as residual_likelihood,
  null::int                                          as residual_consequence,
  null::text                                         as residual_justification,
  f.severity::text                                   as severity_tier,
  case when f.deviation_id is not null then 'in_progress' else 'open' end as status_tier,
  true                                               as is_open,
  (f.deviation_id is not null)                       as has_open_action,
  array[]::text[]                                    as law_refs,
  null::uuid                                         as department_id,
  null::uuid                                         as location_id,
  null::uuid                                         as owner_user_id,
  f.created_at,
  f.created_at                                       as last_reviewed_at,
  null::timestamptz                                  as closed_at,
  null::text                                         as origin_slug
from public.inspection_findings f

union all

-- 5. Alert cases
select
  'alert'::text                                      as source,
  c.id                                               as source_id,
  c.organization_id,
  coalesce(nullif(c.title, ''), c.kind)              as title,
  public.risk_hazard_slug(coalesce(c.category, c.kind)) as hazard_category,
  2                                                  as likelihood,
  public.risk_severity_to_consequence(c.severity)    as consequence,
  null::int                                          as residual_likelihood,
  null::int                                          as residual_consequence,
  null::text                                         as residual_justification,
  c.severity                                         as severity_tier,
  case c.status
    when 'closed'    then 'closed'
    when 'dismissed' then 'closed'
    when 'received'  then 'open'
    else 'in_progress'
  end                                                as status_tier,
  (c.closed_at is null)                              as is_open,
  (c.status in ('triage','investigation','internal_review')) as has_open_action,
  array[]::text[]                                    as law_refs,
  c.department_id,
  c.location_id,
  null::uuid                                         as owner_user_id,
  c.created_at,
  coalesce(c.updated_at, c.created_at)               as last_reviewed_at,
  c.closed_at,
  c.kind                                             as origin_slug
from public.alert_cases c
where c.severity is not null

union all

-- 6. Legacy ROS hazards
select
  'ros'::text                                        as source,
  h.id                                               as source_id,
  h.organization_id,
  coalesce(nullif(h.description, ''), '(uten beskrivelse)') as title,
  public.risk_hazard_slug(h.category)                as hazard_category,
  coalesce(h.initial_probability, 3)                 as likelihood,
  coalesce(h.initial_consequence, 3)                 as consequence,
  h.residual_probability                             as residual_likelihood,
  h.residual_consequence                             as residual_consequence,
  null::text                                         as residual_justification,
  case coalesce(h.initial_consequence, 3)
    when 1 then 'low'
    when 2 then 'medium'
    when 3 then 'medium'
    when 4 then 'high'
    when 5 then 'critical'
    else 'medium'
  end                                                as severity_tier,
  case
    when h.action_plan_id is null and (h.residual_probability is null or h.residual_consequence is null) then 'open'
    when h.action_plan_id is not null then 'in_progress'
    else 'open'
  end                                                as status_tier,
  true                                               as is_open,
  (h.action_plan_id is not null)                     as has_open_action,
  array[]::text[]                                    as law_refs,
  null::uuid                                         as department_id,
  null::uuid                                         as location_id,
  null::uuid                                         as owner_user_id,
  h.created_at,
  coalesce(h.updated_at, h.created_at)               as last_reviewed_at,
  null::timestamptz                                  as closed_at,
  h.law_domain                                       as origin_slug
from public.ros_hazards h

union all

-- 7. Legacy SJA hazards
select
  'sja'::text                                        as source,
  h.id                                               as source_id,
  a.organization_id,
  coalesce(nullif(h.description, ''), '(uten beskrivelse)') as title,
  public.risk_hazard_slug(h.category)                as hazard_category,
  coalesce(h.initial_probability, 3)                 as likelihood,
  coalesce(h.initial_consequence, 3)                 as consequence,
  h.residual_probability                             as residual_likelihood,
  h.residual_consequence                             as residual_consequence,
  null::text                                         as residual_justification,
  case coalesce(h.initial_consequence, 3)
    when 1 then 'low'
    when 2 then 'medium'
    when 3 then 'medium'
    when 4 then 'high'
    when 5 then 'critical'
    else 'medium'
  end                                                as severity_tier,
  'open'::text                                       as status_tier,
  true                                               as is_open,
  false                                              as has_open_action,
  array[]::text[]                                    as law_refs,
  null::uuid                                         as department_id,
  null::uuid                                         as location_id,
  null::uuid                                         as owner_user_id,
  h.created_at,
  h.created_at                                       as last_reviewed_at,
  null::timestamptz                                  as closed_at,
  null::text                                         as origin_slug
from public.sja_hazards h
inner join public.sja_analyses a on a.id = h.sja_id;

-- The summary view consumes the unified view so it doesn't need to
-- change. PostgreSQL re-resolves dependent views automatically on
-- `create or replace view`, but we re-emit it explicitly so the file
-- is self-contained and a partial rollback restores both halves.
create or replace view public.risk_register_summary_v as
select
  v.*,
  (v.likelihood * v.consequence)                                 as risk_score,
  case
    when (v.likelihood * v.consequence) >= 13 then 'red'
    when (v.likelihood * v.consequence) >= 7  then 'yellow'
    else                                            'green'
  end                                                            as band,
  ((v.likelihood * v.consequence) >= 13)                         as is_red,
  (v.hazard_category = 'psychosocial')                           as is_psychosocial,
  (
    v.is_open
    and v.last_reviewed_at < (now() - interval '12 months')
  )                                                              as is_stale,
  (
    v.is_open
    and (v.likelihood * v.consequence) >= 13
    and not v.has_open_action
  )                                                              as is_red_without_action
from public.risk_register_unified_v v;

grant select on public.risk_register_unified_v to authenticated;
grant select on public.risk_register_summary_v to authenticated;
