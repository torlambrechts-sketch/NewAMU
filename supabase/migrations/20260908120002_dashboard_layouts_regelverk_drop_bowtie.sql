-- Drop the «Bowtie — risiko per krav» widget from the system Regelverk
-- coverage layout.
--
-- The bowtie widget added in 20260908120001 was deemed too crowded for
-- the tilsynsbevis-context. The system row stays addressable at the
-- same slug; only the layout JSON is patched. Layout writes on a
-- system row bypass the org-write policy because this migration runs
-- as the migrator role (RLS off for superusers).
--
-- Self-revisjon: en widget mindre endrer ikke tilsynsbevis-fortellingen
-- (KPI + status + scorecard + top-gaps står igjen); restrisiko = 0.

set local search_path = public, pg_catalog;

update public.dashboard_layouts
set layout = (
  select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
  from jsonb_array_elements(layout) with ordinality as t(elem, ord)
  where elem->>'id' <> 'bowtie-regelverk-requirements'
)
where is_system = true
  and scope_id = 'regelverk_coverage'
  and slug = 'regelverk-coverage-overview';
