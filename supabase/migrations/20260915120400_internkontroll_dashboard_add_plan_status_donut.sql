-- Append "Tiltak per status" donut widget to the Compliance Dashboard
-- system-report layout. The widget reads
-- internkontroll_plan_items_by_status (segments shape) and surfaces the
-- closure-backlog distribution at a glance — recommended follow-up from
-- the Phase 2/3 review.
--
-- Idempotent: if the widget id is already present, leave the layout
-- alone (avoids duplicating the donut on re-apply).
--
-- Self-revisjon: dashboard nå viser BÅDE «hvor mange tiltak pågår» (KPI)
-- og «hvordan er fordelingen på status» (donut), så ledelsen ser om
-- backloggen er sunn (mest fullført) eller stagnert (mest planlagt /
-- blokkert).

set local search_path = public, pg_catalog;

update public.dashboard_layouts
set
  layout = layout || jsonb_build_array(
    jsonb_build_object(
      'id', 'donut-internkontroll-plan-status',
      'kind', 'donut',
      'datasetKey', 'internkontroll_plan_items_by_status',
      'title', 'Tiltak per status',
      'subtitle', 'Plan-tiltak fordelt på planlagt / pågår / blokkert / fullført',
      'segmentsPath', '',
      'drillDimensionId', 'plan_status',
      'colSpan', 'md'
    )
  ),
  updated_at = now()
where id = '00000000-0000-0000-0000-000000010001'::uuid
  and is_system = true
  -- Skip if the widget id is already there (re-running this migration
  -- after a manual layout edit shouldn't double-append).
  and not exists (
    select 1
    from jsonb_array_elements(layout) as w
    where w->>'id' = 'donut-internkontroll-plan-status'
  );
