// Regelverk-dekning dashboard scope.
//
// Tiende registrerte scope. Bygger på et nytt 'scorecard'-widget-kind
// som rendrer kategori-grupperte kort med per-§-rader — tilsvarer den
// gamle bespoke RegelverkScorecardView, men nå som flyttbar widget.
//
// Drill-down: klikk på rad sender { dimensionId: 'requirement',
// segmentLabel: lawRef } slik at vertssiden kan åpne RegelverkCoverageSlideOver.

import type {
  ReportModule,
  ReportModuleBar,
  ReportModuleBowtie,
  ReportModuleDonut,
  ReportModuleKpi,
  ReportModuleScorecard,
  ReportModuleTable,
} from '../../../types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'

export const REGELVERK_COVERAGE_DASHBOARD_SCOPE_ID = 'regelverk_coverage'

const DATASETS: DatasetMeta[] = [
  { key: 'regelverk_kpi_summary', label: 'KPI-sammendrag', shape: 'kpi-record' },
  { key: 'regelverk_status_distribution', label: 'Status-fordeling', shape: 'segments' },
  { key: 'regelverk_obligation_distribution', label: 'Plikt-fordeling', shape: 'segments' },
  { key: 'regelverk_scorecard_groups', label: 'Scorecard-grupper', shape: 'rows' },
  { key: 'regelverk_top_gaps', label: 'Største mangler', shape: 'rows' },
]

const KPI_PCT: ReportModuleKpi = {
  id: 'kpi-regelverk-pct',
  kind: 'kpi',
  datasetKey: 'regelverk_kpi_summary',
  title: 'Dekket %',
  valuePath: 'pct',
  subtitle: 'Av aktive krav',
  colSpan: 'sm',
}

const KPI_COVERED: ReportModuleKpi = {
  id: 'kpi-regelverk-covered',
  kind: 'kpi',
  datasetKey: 'regelverk_kpi_summary',
  title: 'Dekket',
  valuePath: 'covered',
  subtitle: 'Fersk publisert bevis < 12 mnd',
  colSpan: 'sm',
}

const KPI_PARTIAL: ReportModuleKpi = {
  id: 'kpi-regelverk-partial',
  kind: 'kpi',
  datasetKey: 'regelverk_kpi_summary',
  title: 'Mangler bevis',
  valuePath: 'partial',
  subtitle: 'Kun mal eller foreldet instans',
  colSpan: 'sm',
}

const KPI_NEEDS_ATTENTION: ReportModuleKpi = {
  id: 'kpi-regelverk-needs-attention',
  kind: 'kpi',
  datasetKey: 'regelverk_kpi_summary',
  title: 'Trenger oppmerksomhet',
  valuePath: 'needsAttention',
  subtitle: 'Pliktige + anbefalte udekket/mangler',
  colSpan: 'sm',
}

const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-regelverk-status',
  kind: 'donut',
  datasetKey: 'regelverk_status_distribution',
  title: 'Status-fordeling',
  segmentsPath: '',
  colSpan: 'md',
  drillDimensionId: 'status',
}

const BAR_OBLIGATION: ReportModuleBar = {
  id: 'bar-regelverk-obligation',
  kind: 'bar',
  datasetKey: 'regelverk_obligation_distribution',
  title: 'Krav etter plikt',
  seriesKeys: [],
  colSpan: 'md',
}

const SCORECARD_BY_CATEGORY: ReportModuleScorecard = {
  id: 'scorecard-regelverk-categories',
  kind: 'scorecard',
  datasetKey: 'regelverk_scorecard_groups',
  title: 'Krav per kategori',
  subtitle: 'Klikk en § for å åpne detaljpanel',
  groupsPath: '',
  drillDimensionId: 'requirement',
  colSpan: 'full',
  rowBreak: true,
}

const BOWTIE_BY_REQUIREMENT: ReportModuleBowtie = {
  id: 'bowtie-regelverk-requirements',
  kind: 'bowtie',
  datasetKey: 'regelverk_scorecard_groups',
  title: 'Bowtie — risiko per krav',
  subtitle:
    'Preventive barrierer (kurs/dokument/sjekkliste/undersøkelse/møte) ' +
    '→ topphendelse (brudd på §) → mitigerende barrierer (avvik) + ' +
    'konsekvenser etter AML kap. 18–19',
  groupsPath: '',
  drillDimensionId: 'requirement',
  colSpan: 'full',
  rowBreak: true,
}

const TABLE_TOP_GAPS: ReportModuleTable = {
  id: 'table-regelverk-top-gaps',
  kind: 'table',
  datasetKey: 'regelverk_top_gaps',
  title: 'Største mangler — udekket eller mangler bevis',
  rowKeys: ['lawRef', 'title', 'category', 'obligation', 'status'],
  colSpan: 'full',
  rowBreak: true,
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_PCT,
  KPI_COVERED,
  KPI_PARTIAL,
  KPI_NEEDS_ATTENTION,
  DONUT_STATUS,
  BAR_OBLIGATION,
  // Tre rad-visninger på samme dataset — speiler den gamle Liste/Scorecard/
  // Bowtie-toggle som siden hadde før dashboard-engine-konverteringen.
  // Brukeren kan fjerne dem hen ikke trenger via widget-menyen.
  TABLE_TOP_GAPS,
  SCORECARD_BY_CATEGORY,
  BOWTIE_BY_REQUIREMENT,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-regelverk-pct', category: 'Volum', label: 'Dekket %', template: KPI_PCT },
  { catalogId: 'kpi-regelverk-covered', category: 'Volum', label: 'Dekket', template: KPI_COVERED },
  { catalogId: 'kpi-regelverk-partial', category: 'Risiko', label: 'Mangler bevis', template: KPI_PARTIAL },
  {
    catalogId: 'kpi-regelverk-needs-attention',
    category: 'Risiko',
    label: 'Trenger oppmerksomhet',
    template: KPI_NEEDS_ATTENTION,
  },
  { catalogId: 'donut-regelverk-status', category: 'Diagrammer', label: 'Status-fordeling', template: DONUT_STATUS },
  { catalogId: 'bar-regelverk-obligation', category: 'Diagrammer', label: 'Krav etter plikt', template: BAR_OBLIGATION },
  {
    catalogId: 'scorecard-regelverk-categories',
    category: 'Scorecard',
    label: 'Krav per kategori — scorecard',
    description: 'Ett kort per kategori med per-§-rader og status-pill.',
    template: SCORECARD_BY_CATEGORY,
  },
  {
    catalogId: 'bowtie-regelverk-requirements',
    category: 'Scorecard',
    label: 'Bowtie — risiko per krav',
    description:
      'Per-krav bowtie-diagram: preventive barrierer (Kurs · Dokument · Sjekkliste · ' +
      'Undersøkelse · Møte) → brudd på § → mitigerende barrierer (Avvik · ROS) + ' +
      'konsekvenser (Pålegg · Gebyr · Straff).',
    template: BOWTIE_BY_REQUIREMENT,
  },
  {
    catalogId: 'table-regelverk-top-gaps',
    category: 'Tabeller',
    label: 'Største mangler',
    template: TABLE_TOP_GAPS,
  },
]

registerDashboardScope({
  scopeId: REGELVERK_COVERAGE_DASHBOARD_SCOPE_ID,
  label: 'Regelverk-dekning',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  // Brand-grønn — speiler compliance_checklist (AML-pakke). Pakke-flipp
  // for ISO osv. kan legges til senere etter samme mønster som
  // compliance/packAccents.ts.
  accent: '#1a3d32',
})
