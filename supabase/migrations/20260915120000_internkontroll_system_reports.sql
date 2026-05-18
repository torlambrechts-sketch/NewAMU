-- Seed system reports for the new Internkontroll module.
--
-- Two locked, code-owned dashboard layouts under the 'internkontroll'
-- scope:
--   1. Compliance Dashboard (slug: 'internkontroll-compliance-dashboard')
--      KPI strip + framework coverage bar + recent-evidence table.
--   2. Gap Analysis (slug: 'internkontroll-gap-analysis')
--      Compact KPI strip + paragraphs × 5 modules heatmap with cell
--      drill-down (drillDimensionId='gap_cell').
--
-- The dataset keys these layouts reference are published by
-- `useInternkontrollDatasets.ts`, which composes `useRegelverkCoverage`
-- (5 of 6 module columns) with a small register_types query
-- (registers column).
--
-- Self-revisjon (Arbeidstilsynet POV):
--  - AML § 3-1 systematisk HMS-arbeid: krever oversikt over hvilke krav
--    som er dekket og hvilke som mangler — denne dashbord-layouten gir
--    den oversikten.
--  - IK-f § 5 nr. 6: dokumentert oppfølging — gap-analysen viser hvilke
--    paragrafer som ikke har dekkende ressurser, slik at oppfølging kan
--    prioriteres.
--  - IK-f § 5 nr. 7: sammenlignbart tilsynsbevis — lokket layout =
--    samme rapport på tvers av virksomheter.
-- Restrisiko (deferred):
--  - Plan-items (compliance_plan_items) som binder § til konkret
--    lukke-tiltak. Phase 3 av sprinten.
--  - Auditor-token-URL (revisor-visning). Phase 4 (deferred per
--    spec §5 og founder-direktiv).

set local search_path = public, pg_catalog;

-- 1) Compliance Dashboard
insert into public.dashboard_layouts (
  id,
  organization_id,
  scope_id,
  slug,
  name,
  description,
  kind,
  is_system,
  is_default,
  layout,
  filters,
  owner_user_id,
  version,
  created_by
)
values (
  '00000000-0000-0000-0000-000000010001'::uuid,
  null,
  'internkontroll',
  'internkontroll-compliance-dashboard',
  'Internkontroll — oversikt',
  'Lokket, systemdefinert dashbord som viser dekningsstatus per regelverk. KPI-er, dekning per regelverk og siste aktivitet — sammenlignbar på tvers av virksomheter for tilsynsbevis.',
  'report_template',
  true,
  false,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'kpi-internkontroll-coverage-pct',
      'kind', 'kpi',
      'datasetKey', 'internkontroll_kpi_summary',
      'title', 'Dekning %',
      'valuePath', 'pctCoverage',
      'subtitle', 'Paragrafer med ≥ 1 dekkende ressurs',
      'colSpan', 'sm'
    ),
    jsonb_build_object(
      'id', 'kpi-internkontroll-covered',
      'kind', 'kpi',
      'datasetKey', 'internkontroll_kpi_summary',
      'title', 'Dekket',
      'valuePath', 'paragraphsCovered',
      'subtitle', 'Antall paragrafer med dekning',
      'colSpan', 'sm'
    ),
    jsonb_build_object(
      'id', 'kpi-internkontroll-uncovered',
      'kind', 'kpi',
      'datasetKey', 'internkontroll_kpi_summary',
      'title', 'Udekket',
      'valuePath', 'paragraphsUncovered',
      'subtitle', 'Paragrafer uten dekkende ressurs',
      'comparisonGoal', 'decrease',
      'colSpan', 'sm'
    ),
    jsonb_build_object(
      'id', 'kpi-internkontroll-open-palegg',
      'kind', 'kpi',
      'datasetKey', 'internkontroll_kpi_summary',
      'title', 'Åpne pålegg',
      'valuePath', 'openPalegg',
      'subtitle', 'Tilsynssaker uten lukking (Phase 2)',
      'comparisonGoal', 'decrease',
      'colSpan', 'sm'
    ),
    jsonb_build_object(
      'id', 'bar-internkontroll-framework-coverage',
      'kind', 'bar',
      'datasetKey', 'internkontroll_framework_coverage',
      'title', 'Dekning per regelverk',
      'subtitle', '% paragrafer med ≥ 1 dekkende ressurs',
      'seriesKeys', jsonb_build_array('AML', 'IK-f', 'GDPR', 'Åpenhetsloven', 'ISO 45001'),
      'drillDimensionId', 'framework',
      'colSpan', 'full',
      'rowBreak', true
    ),
    jsonb_build_object(
      'id', 'table-internkontroll-recent-evidence',
      'kind', 'table',
      'datasetKey', 'internkontroll_recent_evidence',
      'title', 'Siste aktivitet',
      'subtitle', 'Maler og publiserte ressurser per paragraf',
      'rowKeys', jsonb_build_array('Paragraf', 'Modul', 'Type', 'Tittel'),
      'colSpan', 'full',
      'rowBreak', true
    )
  )::jsonb,
  '[]'::jsonb,
  null,
  1,
  null
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  layout = excluded.layout,
  filters = excluded.filters,
  updated_at = now();

-- 2) Gap Analysis
insert into public.dashboard_layouts (
  id,
  organization_id,
  scope_id,
  slug,
  name,
  description,
  kind,
  is_system,
  is_default,
  layout,
  filters,
  owner_user_id,
  version,
  created_by
)
values (
  '00000000-0000-0000-0000-000000010002'::uuid,
  null,
  'internkontroll',
  'internkontroll-gap-analysis',
  'Internkontroll — gap-analyse',
  'Lokket, systemdefinert visning av gap mellom regelverk-paragrafer og dekkende ressurser per modul. Klikk en celle for å åpne modulens analyse-side filtrert på paragrafen.',
  'report_template',
  true,
  false,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'kpi-internkontroll-gap-pct',
      'kind', 'kpi',
      'datasetKey', 'internkontroll_kpi_summary',
      'title', 'Dekning %',
      'valuePath', 'pctCoverage',
      'subtitle', 'For valgt regelverk',
      'colSpan', 'sm'
    ),
    jsonb_build_object(
      'id', 'kpi-internkontroll-gap-covered',
      'kind', 'kpi',
      'datasetKey', 'internkontroll_kpi_summary',
      'title', 'Dekket',
      'valuePath', 'paragraphsCovered',
      'subtitle', 'Antall paragrafer med dekning',
      'colSpan', 'sm'
    ),
    jsonb_build_object(
      'id', 'kpi-internkontroll-gap-uncovered',
      'kind', 'kpi',
      'datasetKey', 'internkontroll_kpi_summary',
      'title', 'Udekket',
      'valuePath', 'paragraphsUncovered',
      'subtitle', 'Krever oppfølging',
      'comparisonGoal', 'decrease',
      'colSpan', 'sm'
    ),
    jsonb_build_object(
      'id', 'kpi-internkontroll-gap-total',
      'kind', 'kpi',
      'datasetKey', 'internkontroll_kpi_summary',
      'title', 'Totalt antall §',
      'valuePath', 'paragraphsTotal',
      'subtitle', 'Paragrafer i regelverket',
      'colSpan', 'sm'
    ),
    jsonb_build_object(
      'id', 'heatmap-internkontroll-gap-matrix',
      'kind', 'heatmap',
      'datasetKey', 'internkontroll_gap_matrix',
      'title', 'Gap-matrise — paragrafer × moduler',
      'subtitle', 'Antall dekkende ressurser per § × modul. Klikk en celle for å åpne modulen filtrert på §.',
      'rowsPath', 'rows',
      'columnsPath', 'columns',
      'cellsPath', 'cells',
      'valueLabel', 'ressurser',
      'drillDimensionId', 'gap_cell',
      'colSpan', 'full',
      'rowBreak', true
    )
  )::jsonb,
  '[]'::jsonb,
  null,
  1,
  null
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  layout = excluded.layout,
  filters = excluded.filters,
  updated_at = now();
