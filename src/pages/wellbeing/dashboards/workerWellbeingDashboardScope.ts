// Arbeidsmiljøstrategi — utfalls-orientert dashboard (worker wellbeing).
//
// Snur compliance-fortellingen: i stedet for å spørre «hvor mange
// paragrafer dekker vi?» spør vi «klarer vi det loven faktisk vil
// — at folk er trygge, trives, blir hørt og vokser?». Aksene er
// hentet rett ut av AML § 1-1 og kap. 4:
//
//   1. Trygghet     — § 4-1, § 4-4. Drives av vernerunder, avvik, ROS.
//   2. Trivsel      — § 4-3. Drives av psykososial survey + AMU.
//   3. Medvirkning  — § 2-3, § 4-2, kap. 6 (verneombud), kap. 7 (AMU).
//   4. Mestring     — § 3-2 opplæring + § 4-2 utvikling.
//
// Wellbeing-indeksen er et vektet snitt av de fire akse-skårene
// (vektet via `org_wellbeing_strategy.index_weights`). Beregnes klient-
// side i useWorkerWellbeingDatasets fra medlems-datasetene.
//
// Accent: #d97706 (amber-600) — varm, distinkt fra compliance-rødt og
// learning-teal. Signaliserer «mennesker, ikke paragrafer».

import type {
  ReportModule,
  ReportModuleBar,
  ReportModuleKpi,
  ReportModuleLine,
  ReportModuleTable,
} from '../../../types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'

export const WORKER_WELLBEING_SCOPE_ID = 'worker_wellbeing'

const DATASETS: DatasetMeta[] = [
  { key: 'wellbeing_index_summary', label: 'Arbeidsmiljø-indeks', shape: 'kpi-record' },
  { key: 'wellbeing_axis_scores', label: 'Akse-skår', shape: 'segments' },
  { key: 'wellbeing_axis_overview', label: 'Akser med signaler', shape: 'rows' },
  { key: 'wellbeing_tool_coverage', label: 'Verktøy per akse', shape: 'rows' },
  { key: 'wellbeing_action_queue', label: 'Neste steg', shape: 'rows' },
  { key: 'wellbeing_index_over_time', label: 'Indeks over tid', shape: 'series' },
  { key: 'wellbeing_snapshot_history', label: 'Snapshot-historikk', shape: 'rows' },
]

const KPI_INDEX: ReportModuleKpi = {
  id: 'kpi-wb-index', kind: 'kpi', datasetKey: 'wellbeing_index_summary',
  title: 'Arbeidsmiljø-indeks', valuePath: 'indexLabel',
  subtitle: 'Vektet snitt av fire akser (0–100)', colSpan: 'md',
}
const KPI_TRYGGHET: ReportModuleKpi = {
  id: 'kpi-wb-trygghet', kind: 'kpi', datasetKey: 'wellbeing_index_summary',
  title: 'Trygghet', valuePath: 'trygghet',
  subtitle: 'AML § 4-1, § 4-4 · vernerunde + avvik', colSpan: 'sm',
}
const KPI_TRIVSEL: ReportModuleKpi = {
  id: 'kpi-wb-trivsel', kind: 'kpi', datasetKey: 'wellbeing_index_summary',
  title: 'Trivsel', valuePath: 'trivsel',
  subtitle: 'AML § 4-3 · psykososial survey', colSpan: 'sm',
}
const KPI_MEDVIRKNING: ReportModuleKpi = {
  id: 'kpi-wb-medvirkning', kind: 'kpi', datasetKey: 'wellbeing_index_summary',
  title: 'Medvirkning', valuePath: 'medvirkning',
  subtitle: 'AML § 2-3, kap. 6-7 · AMU + svarprosent', colSpan: 'sm',
}
const KPI_MESTRING: ReportModuleKpi = {
  id: 'kpi-wb-mestring', kind: 'kpi', datasetKey: 'wellbeing_index_summary',
  title: 'Mestring & utvikling', valuePath: 'mestring',
  subtitle: 'AML § 3-2 · læring + sertifiseringer', colSpan: 'sm',
}

const BAR_AXIS_SCORES: ReportModuleBar = {
  id: 'bar-wb-axis-scores', kind: 'bar', datasetKey: 'wellbeing_axis_scores',
  title: 'Akse-skår', seriesKeys: [], colSpan: 'md',
}

const TABLE_AXIS_OVERVIEW: ReportModuleTable = {
  id: 'table-wb-axis-overview', kind: 'table', datasetKey: 'wellbeing_axis_overview',
  title: 'Akser — signal og neste steg',
  rowKeys: ['axis', 'score', 'signal', 'nextMove'],
  colSpan: 'full',
}

const TABLE_TOOL_COVERAGE: ReportModuleTable = {
  id: 'table-wb-tool-coverage', kind: 'table', datasetKey: 'wellbeing_tool_coverage',
  title: 'Verktøyene som driver hver akse',
  rowKeys: ['axis', 'tool', 'lastUsed', 'status'],
  colSpan: 'lg',
}

const TABLE_ACTION_QUEUE: ReportModuleTable = {
  id: 'table-wb-action-queue', kind: 'table', datasetKey: 'wellbeing_action_queue',
  title: 'Neste steg — det som krever oppmerksomhet',
  rowKeys: ['axis', 'item', 'severity', 'origin'],
  colSpan: 'full',
}

const LINE_INDEX_TREND: ReportModuleLine = {
  id: 'line-wb-index-trend', kind: 'line', datasetKey: 'wellbeing_index_over_time',
  title: 'Arbeidsmiljø-indeks over tid',
  pointsPath: '', xLabel: 'Måned', yLabel: 'Indeks (0–100)',
  colSpan: 'lg',
}

const TABLE_SNAPSHOT_HISTORY: ReportModuleTable = {
  id: 'table-wb-snapshot-history', kind: 'table', datasetKey: 'wellbeing_snapshot_history',
  title: 'Snapshot-historikk',
  rowKeys: ['period', 'index', 'trygghet', 'trivsel', 'medvirkning', 'mestring', 'capturedAt'],
  colSpan: 'full',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_INDEX,
  KPI_TRYGGHET, KPI_TRIVSEL, KPI_MEDVIRKNING, KPI_MESTRING,
  LINE_INDEX_TREND,
  BAR_AXIS_SCORES,
  TABLE_AXIS_OVERVIEW,
  TABLE_TOOL_COVERAGE,
  TABLE_ACTION_QUEUE,
  TABLE_SNAPSHOT_HISTORY,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-wb-index', category: 'Indeks', label: 'Arbeidsmiljø-indeks', template: KPI_INDEX },
  { catalogId: 'kpi-wb-trygghet', category: 'Akser', label: 'Trygghet', template: KPI_TRYGGHET },
  { catalogId: 'kpi-wb-trivsel', category: 'Akser', label: 'Trivsel', template: KPI_TRIVSEL },
  { catalogId: 'kpi-wb-medvirkning', category: 'Akser', label: 'Medvirkning', template: KPI_MEDVIRKNING },
  { catalogId: 'kpi-wb-mestring', category: 'Akser', label: 'Mestring & utvikling', template: KPI_MESTRING },
  { catalogId: 'bar-wb-axis-scores', category: 'Diagrammer', label: 'Akse-skår', template: BAR_AXIS_SCORES },
  { catalogId: 'table-wb-axis-overview', category: 'Tabeller', label: 'Akse-oversikt', template: TABLE_AXIS_OVERVIEW },
  { catalogId: 'table-wb-tool-coverage', category: 'Tabeller', label: 'Verktøy per akse', template: TABLE_TOOL_COVERAGE },
  { catalogId: 'table-wb-action-queue', category: 'Tabeller', label: 'Neste steg', template: TABLE_ACTION_QUEUE },
  { catalogId: 'line-wb-index-trend', category: 'Trender', label: 'Indeks over tid', template: LINE_INDEX_TREND },
  { catalogId: 'table-wb-snapshot-history', category: 'Tabeller', label: 'Snapshot-historikk', template: TABLE_SNAPSHOT_HISTORY },
]

registerDashboardScope({
  scopeId: WORKER_WELLBEING_SCOPE_ID,
  label: 'Arbeidsmiljøstrategi',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  // Amber-600 — varmt og menneske-sentrert, distinkt fra
  // compliance-rødene og læring-teal.
  accent: '#d97706',
})
