-- Seed system report — «Regelverk-dekning — oversikt».
--
-- A locked, code-owned layout for embedding the full Regelverk-dekning
-- view on arbitrary pages (eg. lederrapport, AMU-side, oversiktsdash).
-- Renders via <SystemReport id="regelverk-coverage-overview" />.
--
-- The layout is a hand-rolled snapshot of regelverkCoverageDashboardScope's
-- DEFAULT_LAYOUT — KPI tiles + status donut + obligation bar + scorecard
-- + bowtie + top-gaps table. Widget ids match the catalog ids so the
-- runtime can resolve them.
--
-- Self-revisjon (Arbeidstilsynet POV): locked layout = consistent rapport
-- på tvers av virksomheter (IK-f § 5 nr. 7 — sammenlignbart tilsynsbevis).
-- Restrisiko: enkelte krav kan ha endret § siden seeding — løses ved
-- ny migrasjon når regelverkRequirements.ts oppdateres.

set local search_path = public, pg_catalog;

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
  '00000000-0000-0000-0000-000000000001'::uuid,
  null,
  'regelverk_coverage',
  'regelverk-coverage-overview',
  'Regelverk-dekning — oversikt',
  'Lokket, system­definert visning av regelverk-dekning. KPI-er, status, scorecard, bowtie og største mangler — sammenlignbar på tvers av virksomheter for tilsynsbevis.',
  'report_template',
  true,
  false,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'kpi-regelverk-pct',
      'kind', 'kpi',
      'datasetKey', 'regelverk_kpi_summary',
      'title', 'Dekket %',
      'valuePath', 'pct',
      'subtitle', 'Av aktive krav',
      'colSpan', 'sm'
    ),
    jsonb_build_object(
      'id', 'kpi-regelverk-covered',
      'kind', 'kpi',
      'datasetKey', 'regelverk_kpi_summary',
      'title', 'Dekket',
      'valuePath', 'covered',
      'subtitle', 'Fersk publisert bevis < 12 mnd',
      'colSpan', 'sm'
    ),
    jsonb_build_object(
      'id', 'kpi-regelverk-partial',
      'kind', 'kpi',
      'datasetKey', 'regelverk_kpi_summary',
      'title', 'Mangler bevis',
      'valuePath', 'partial',
      'subtitle', 'Kun mal eller foreldet instans',
      'colSpan', 'sm'
    ),
    jsonb_build_object(
      'id', 'kpi-regelverk-needs-attention',
      'kind', 'kpi',
      'datasetKey', 'regelverk_kpi_summary',
      'title', 'Trenger oppmerksomhet',
      'valuePath', 'needsAttention',
      'subtitle', 'Pliktige + anbefalte udekket/mangler',
      'colSpan', 'sm'
    ),
    jsonb_build_object(
      'id', 'donut-regelverk-status',
      'kind', 'donut',
      'datasetKey', 'regelverk_status_distribution',
      'title', 'Status-fordeling',
      'segmentsPath', '',
      'colSpan', 'md',
      'drillDimensionId', 'status'
    ),
    jsonb_build_object(
      'id', 'bar-regelverk-obligation',
      'kind', 'bar',
      'datasetKey', 'regelverk_obligation_distribution',
      'title', 'Krav etter plikt',
      'seriesKeys', jsonb_build_array(),
      'colSpan', 'md'
    ),
    jsonb_build_object(
      'id', 'table-regelverk-top-gaps',
      'kind', 'table',
      'datasetKey', 'regelverk_top_gaps',
      'title', 'Største mangler — udekket eller mangler bevis',
      'rowKeys', jsonb_build_array('lawRef','title','category','obligation','status'),
      'colSpan', 'full',
      'rowBreak', true
    ),
    jsonb_build_object(
      'id', 'scorecard-regelverk-categories',
      'kind', 'scorecard',
      'datasetKey', 'regelverk_scorecard_groups',
      'title', 'Krav per kategori',
      'subtitle', 'Klikk en § for å åpne detaljpanel',
      'groupsPath', '',
      'drillDimensionId', 'requirement',
      'colSpan', 'full',
      'rowBreak', true
    ),
    jsonb_build_object(
      'id', 'bowtie-regelverk-requirements',
      'kind', 'bowtie',
      'datasetKey', 'regelverk_scorecard_groups',
      'title', 'Bowtie — risiko per krav',
      'subtitle', 'Preventive barrierer → topphendelse → mitigerende barrierer + konsekvenser etter AML kap. 18–19',
      'groupsPath', '',
      'drillDimensionId', 'requirement',
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
