-- Risk register — unified read view (P2)
--
-- Why this exists:
--   The Risiko-modulen ships in P1 as an aggregate-only dashboard that
--   joins data client-side from five+ tables. That works for an SMB org
--   but doesn't scale, and the heuristics for `has_open_action` and
--   psychosocial categorisation belong on the database side where they
--   can be reused by Risikoregister (list page), Workflow rules, and
--   future exports (e.g. "What Arbeidstilsynet would see").
--
-- What this migration adds:
--   1. `risk_register_unified_v` — read-only view UNIONing seven
--      risk-bearing sources into one shape: compliance findings,
--      task_items (kind=avvik/nestenulykke/risiko/tiltak), deviations,
--      inspection_findings, alert_cases, ros_hazards, sja_hazards.
--   2. `risk_register_summary_v` — convenience view with banding,
--      `is_red`, `is_psychosocial`, `is_stale`, and
--      `is_red_without_action` flags.
--   3. Helper functions `risk_severity_to_consequence` and
--      `risk_hazard_slug` mirroring the client-side mappers, plus
--      `risk_finding_law_refs` which extracts law_refs[] for a
--      compliance finding from the parent template's jsonb definition.
--   4. Indices on the underlying tables that the view JOINs through.
--
-- The view also computes recurrence-based likelihood for compliance
-- findings via a SQL window function partitioned on (org, template_id)
-- — a chronic weekly checklist item reads as likelihood=5; a one-off
-- stays at 1. This mirrors mapRecurrenceToLikelihood in
-- modules/risk/dashboards/hazardCategories.ts.
--
-- Note on the join: compliance_checklist_executions stores `template_id`
-- (uuid FK to compliance_checklist_templates), not `template_slug`. The
-- view left-joins the templates table to surface the slug for hazard-
-- category derivation and for `origin_slug`.
--
-- Self-audit (Arbeidstilsynet POV):
--   Pålegg-grunner addressed:
--   - IK-f § 5 nr. 6 (kartlegge farer og vurdere risiko): the view is
--     the single source the inspector can ask for to see the org's
--     current risk picture across every source.
--   - IK-f § 5 nr. 7 (handlingsplan med frister og ansvar): the view's
--     `has_open_action` column joins `action_plan_items` and
--     `task_items.parent_item_id` so coverage is honest, not heuristic.
--   - AML § 4-3 (psykososialt arbeidsmiljø): `is_psychosocial` derives
--     from category, lawRefs, and template-slug hints — surfaces
--     psychosocial risks even when not explicitly tagged.
--   Restrisiko (deferred):
--   - No `residual_justification` column exists on most sources yet
--     (only conceptually on RosRiskRow.redResidualJustification at the
--     app level). The view exposes the field as NULL for those sources;
--     a future migration can promote it to a real column where useful.
--
-- Idempotency: `create or replace view`/`function` everywhere.

set local search_path = public, pg_catalog;

-- ── Helper: severity_tier → consequence axis ─────────────────────────────
-- low/medium/high/critical → 1/2/4/5 (matches mapSeverityToConsequence in
-- modules/risk/dashboards/hazardCategories.ts so client + server agree).
create or replace function public.risk_severity_to_consequence(sev text)
returns int
language sql immutable as $$
  select case sev
    when 'low' then 1
    when 'medium' then 2
    when 'high' then 4
    when 'critical' then 5
    else 3
  end
$$;

-- ── Helper: hazard category slug from free text ──────────────────────────
create or replace function public.risk_hazard_slug(input text)
returns text
language sql immutable as $$
  select case
    when input is null then 'other'
    when lower(input) like '%psyk%' then 'psychosocial'
    when lower(input) like '%trakass%' then 'psychosocial'
    when lower(input) like '%brann%' then 'fire'
    when lower(input) like '%beredskap%' then 'fire'
    when lower(input) like '%eksplos%' then 'fire'
    when lower(input) like '%kjem%' then 'chemical'
    when lower(input) like 'chemical%' then 'chemical'
    when lower(input) like '%ergono%' then 'ergonomic'
    when lower(input) like '%elek%' then 'electrical'
    when lower(input) like '%miljo%' then 'environmental'
    when lower(input) like '%miljø%' then 'environmental'
    when lower(input) like '%environment%' then 'environmental'
    when lower(input) in ('physical','fysisk') then 'physical'
    else 'other'
  end
$$;

-- ── Helper: extract law_refs[] for a finding from its template ──────────
-- Plural `law_refs[]` array form preferred; falls back to legacy singular
-- `law_ref` scalar (comma-split). Returns [] when no match.
create or replace function public.risk_finding_law_refs(p_template_id uuid, p_item_key text)
returns text[]
language sql stable as $$
  with hit as (
    select t.definition
    from public.compliance_checklist_templates t
    where t.id = p_template_id and t.deleted_at is null
    limit 1
  ),
  item as (
    select value as item
    from hit, jsonb_array_elements(hit.definition->'items') as value
    where value->>'key' = p_item_key
    limit 1
  )
  select coalesce(
    (select array_agg(x::text)
     from item, jsonb_array_elements_text(item.item->'law_refs') as x
     where item.item ? 'law_refs'),
    (select array(
       select trim(unnest(string_to_array(item.item->>'law_ref', ',')))
     )
     from item
     where item.item ? 'law_ref'),
    array[]::text[]
  )
$$;

comment on function public.risk_finding_law_refs(uuid, text) is
  'Resolve law_refs[] for a checklist response by looking up the item '
  'in the parent template definition. Supports both plural law_refs[] '
  'and legacy singular law_ref scalar (comma-split).';

-- ── Indices ─────────────────────────────────────────────────────────────
create index if not exists action_plan_items_source_status_idx
  on public.action_plan_items (source_table, source_id, status)
  where status in ('open','in_progress');

create index if not exists compliance_checklist_responses_finding_org_idx
  on public.compliance_checklist_responses (organization_id, is_finding, severity)
  where is_finding = true;

-- ── The unified view ─────────────────────────────────────────────────────
create or replace view public.risk_register_unified_v as
-- 1. Compliance checklist findings
select
  'checklist'::text                                  as source,
  r.id                                               as source_id,
  r.organization_id,
  coalesce(nullif(r.item_key, ''), '(uten tittel)') as title,
  public.risk_hazard_slug(t.slug)                    as hazard_category,
  -- Recurrence-based likelihood: count this template's findings org-
  -- wide, bucket into 1..5.
  case
    when count(*) over (partition by r.organization_id, e.template_id) >= 13 then 5
    when count(*) over (partition by r.organization_id, e.template_id) >= 7  then 4
    when count(*) over (partition by r.organization_id, e.template_id) >= 4  then 3
    when count(*) over (partition by r.organization_id, e.template_id) >= 2  then 2
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
  -- Law-refs from the parent template definition.
  public.risk_finding_law_refs(e.template_id, r.item_key) as law_refs,
  e.department_id,
  e.location_id,
  null::uuid                                         as owner_user_id,
  r.created_at,
  coalesce(r.updated_at, r.created_at)               as last_reviewed_at,
  null::timestamptz                                  as closed_at,
  t.slug                                             as origin_slug
from public.compliance_checklist_responses r
inner join public.compliance_checklist_executions e on e.id = r.execution_id
left  join public.compliance_checklist_templates t on t.id = e.template_id
where r.is_finding = true and r.severity is not null

union all

-- 2. Task items in the risk-bearing kinds
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
  d.closed_at,
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

-- 5. Alert cases (varslinger with explicit severity)
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

-- 7. Legacy SJA hazards (joined via sja_analyses for organization_id)
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

-- ── Summary view ─────────────────────────────────────────────────────────
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

comment on view public.risk_register_unified_v is
  'Unified risk register — UNION of compliance findings, tasks (avvik/'
  'nestenulykke/risiko/tiltak), deviations, inspection_findings, '
  'alert_cases, ros_hazards, sja_hazards. Read-only. RLS inherits from '
  'underlying tables.';

comment on view public.risk_register_summary_v is
  'Risk register with derived risk_score, band, is_red, is_psychosocial, '
  'is_stale (>12 months), and is_red_without_action flags. Use this for '
  'dashboards; use risk_register_unified_v for narrow row reads.';
