-- Replace the placeholder "Åpne pålegg" KPI on the Internkontroll
-- system-report layouts with an honest, computable "Tiltak i arbeid"
-- KPI that reads compliance_plan_items where status='in_progress'.
--
-- Why: the original seed (20260915120000) shipped openPalegg hardcoded
-- to 0 with subtitle "Phase 2". Leaders shouldn't see a fake metric on
-- the audit dashboard — replace it with the actual closure-backlog
-- count now that compliance_plan_items (20260915120100) exists.
--
-- Self-revisjon: dashboard speiler reell tilstand → IK-f § 5 nr. 7
-- (sammenlignbart tilsynsbevis) faktisk holder vann. Restrisiko: ingen.

set local search_path = public, pg_catalog;

-- Helper — replace one widget in a layout array by id, preserving order.
create or replace function pg_temp.replace_widget(layout jsonb, target_id text, replacement jsonb)
returns jsonb
language sql
as $$
  select coalesce(
    jsonb_agg(case when (w->>'id') = target_id then replacement else w end order by ord),
    '[]'::jsonb
  )
  from jsonb_array_elements(layout) with ordinality as t(w, ord);
$$;

update public.dashboard_layouts
set
  layout = pg_temp.replace_widget(
    layout,
    'kpi-internkontroll-open-palegg',
    jsonb_build_object(
      'id', 'kpi-internkontroll-open-plan-items',
      'kind', 'kpi',
      'datasetKey', 'internkontroll_kpi_summary',
      'title', 'Tiltak i arbeid',
      'valuePath', 'openPlanItems',
      'subtitle', 'Plan-tiltak med status pågående',
      'colSpan', 'sm'
    )
  ),
  updated_at = now()
where id = '00000000-0000-0000-0000-000000010001'::uuid
  and is_system = true;
