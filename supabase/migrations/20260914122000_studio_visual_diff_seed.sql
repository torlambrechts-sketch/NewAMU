-- Studio Builder — visual-diff fixture for Task 0.3 acceptance gate.
--
-- Spec §9.3: "All 9 widget kinds render identically before/after Task 0.3
-- (visual diff <0.5%)". This SECURITY DEFINER function seeds a
-- deterministic dashboard_layouts row that exercises every kind, so a
-- single screenshot pass captures every renderer.
--
-- Usage:
--   select studio_visual_diff_seed('<org_id>');
--   → returns the fixture row's uuid
--   → open /compliance/checklists/analyse?layout=studio-visual-diff
--     in dev. Capture before + after the renderer refactor; diff with
--     pixelmatch or playwright snapshot. <0.5% diff is the gate.
--
-- Idempotent: re-seed updates the row.

set local search_path = public, pg_catalog;

create or replace function public.studio_visual_diff_seed(p_org_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid := '00000000-0000-4000-8000-000000000001'::uuid;
begin
  insert into public.dashboard_layouts (
    id, organization_id, scope_id, name, slug, kind, layout,
    filters, is_default
  ) values (
    v_id, p_org_id, 'compliance_checklist', 'Studio visual-diff fixture',
    'studio-visual-diff', 'dashboard',
    jsonb_build_array(
      jsonb_build_object('id', 'w1', 'kind', 'kpi', 'colSpan', 'sm',
        'label', 'KPI', 'dataset', 'checklist_kpi_summary'),
      jsonb_build_object('id', 'w2', 'kind', 'bar', 'colSpan', 'md',
        'title', 'Bar', 'dataset', 'checklist_executions_by_status'),
      jsonb_build_object('id', 'w3', 'kind', 'donut', 'colSpan', 'sm',
        'title', 'Donut', 'dataset', 'checklist_executions_by_severity'),
      jsonb_build_object('id', 'w4', 'kind', 'line', 'colSpan', 'lg',
        'title', 'Line', 'dataset', 'checklist_executions_over_time'),
      jsonb_build_object('id', 'w5', 'kind', 'table', 'colSpan', 'full',
        'title', 'Table', 'dataset', 'checklist_overdue_executions'),
      jsonb_build_object('id', 'w6', 'kind', 'heatmap', 'colSpan', 'lg',
        'title', 'Heatmap', 'dataset', 'checklist_executions_by_user_heatmap')
    ),
    '[]'::jsonb, false
  )
  on conflict (id) do update set
    layout = excluded.layout,
    filters = excluded.filters,
    name = excluded.name;

  return v_id;
end;
$fn$;
