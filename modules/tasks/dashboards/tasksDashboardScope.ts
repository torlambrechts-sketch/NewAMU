// Tasks analytics scope registration.
//
// Registers `tasks` with the dashboard registry on module load. Datasets
// are computed by TasksAnalysePage from useTasks data; this file is pure
// metadata.
//
// Per /specs/tasks-parity.md: tasks are aggregated work items (jsonb
// store, no normalised table). The scope intentionally has fewer
// catalog widgets than survey/checklist — categories don't apply, so
// the "Org-kontekst" picker category isn't surfaced beyond department.

import type {
  ReportModule,
  ReportModuleBar,
  ReportModuleDonut,
  ReportModuleKpi,
  ReportModuleLine,
  ReportModuleTable,
} from '../../../src/types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../src/lib/dashboards/dashboardRegistry'

export const TASKS_DASHBOARD_SCOPE_ID = 'tasks'

const DATASETS: DatasetMeta[] = [
  { key: 'tasks_kpi_summary', label: 'KPI-sammendrag', shape: 'kpi-record' },
  { key: 'tasks_status_distribution', label: 'Status', shape: 'segments' },
  { key: 'tasks_module_distribution', label: 'Per modul', shape: 'segments' },
  { key: 'tasks_source_distribution', label: 'Per kilde', shape: 'segments' },
  { key: 'tasks_priority_distribution', label: 'Per prioritet', shape: 'segments' },
  { key: 'tasks_completed_over_time', label: 'Fullført over tid', shape: 'series' },
  { key: 'tasks_overdue_over_time', label: 'Forfalt over tid', shape: 'series' },
  { key: 'tasks_distribution_by_assignee', label: 'Per ansvarlig', shape: 'segments' },
  { key: 'tasks_distribution_by_department', label: 'Per avdeling', shape: 'segments' },
  // Pack-architecture datasets (task_items table)
  { key: 'tasks_pdca_distribution', label: 'PDCA-fordeling', shape: 'segments' },
  { key: 'tasks_source_category_breakdown', label: 'Kategori (avvik/risiko/tiltak)', shape: 'segments' },
  { key: 'tasks_law_ref_coverage', label: 'Paragrafdekning', shape: 'segments' },
]

// ── Default widgets ───────────────────────────────────────────────────────

const KPI_TOTAL: ReportModuleKpi = {
  id: 'kpi-total',
  kind: 'kpi',
  datasetKey: 'tasks_kpi_summary',
  title: 'Totalt antall oppgaver',
  valuePath: 'total',
  subtitle: 'Alle ikke-arkiverte oppgaver',
  colSpan: 'sm',
}
const KPI_OPEN: ReportModuleKpi = {
  id: 'kpi-open',
  kind: 'kpi',
  datasetKey: 'tasks_kpi_summary',
  title: 'Åpne / pågående',
  valuePath: 'open',
  subtitle: 'Status todo eller in_progress',
  colSpan: 'sm',
}
const KPI_OVERDUE: ReportModuleKpi = {
  id: 'kpi-overdue',
  kind: 'kpi',
  datasetKey: 'tasks_kpi_summary',
  title: 'Forfalt',
  valuePath: 'overdue',
  subtitle: 'Frist passert, ikke fullført',
  colSpan: 'sm',
}
const KPI_COMPLETED_YTD: ReportModuleKpi = {
  id: 'kpi-completed-ytd',
  kind: 'kpi',
  datasetKey: 'tasks_kpi_summary',
  title: 'Fullført i år',
  valuePath: 'completedYtd',
  subtitle: 'YTD',
  colSpan: 'sm',
}
const KPI_REQUIRING_SIGNOFF: ReportModuleKpi = {
  id: 'kpi-requiring-signoff',
  kind: 'kpi',
  datasetKey: 'tasks_kpi_summary',
  title: 'Krever ledersignatur',
  valuePath: 'requiringSignOff',
  subtitle: 'Venter på godkjenning',
  colSpan: 'sm',
}
const LINE_COMPLETED: ReportModuleLine = {
  id: 'line-completed-over-time',
  kind: 'line',
  datasetKey: 'tasks_completed_over_time',
  title: 'Oppgaver fullført over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'md',
}
const LINE_OVERDUE: ReportModuleLine = {
  id: 'line-overdue-over-time',
  kind: 'line',
  datasetKey: 'tasks_overdue_over_time',
  title: 'Forfalt over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'md',
}
const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status',
  kind: 'donut',
  datasetKey: 'tasks_status_distribution',
  title: 'Fordeling per status',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_MODULE: ReportModuleDonut = {
  id: 'donut-module',
  kind: 'donut',
  datasetKey: 'tasks_module_distribution',
  title: 'Fordeling per modul',
  segmentsPath: '',
  colSpan: 'md',
}
const BAR_SOURCE: ReportModuleBar = {
  id: 'bar-source',
  kind: 'bar',
  datasetKey: 'tasks_source_distribution',
  title: 'Mest brukte kilder',
  seriesKeys: [],
  colSpan: 'md',
}
const BAR_PRIORITY: ReportModuleBar = {
  id: 'bar-priority',
  kind: 'bar',
  datasetKey: 'tasks_priority_distribution',
  title: 'Per prioritet',
  seriesKeys: ['Lav', 'Middels', 'Høy', 'Kritisk'],
  colSpan: 'md',
}
const BAR_ASSIGNEE: ReportModuleBar = {
  id: 'bar-assignee',
  kind: 'bar',
  datasetKey: 'tasks_distribution_by_assignee',
  title: 'Topp ansvarlige',
  seriesKeys: [],
  colSpan: 'md',
}
const BAR_DEPARTMENT: ReportModuleBar = {
  id: 'bar-department',
  kind: 'bar',
  datasetKey: 'tasks_distribution_by_department',
  title: 'Per avdeling',
  seriesKeys: [],
  colSpan: 'md',
}
const TABLE_OVERDUE: ReportModuleTable = {
  id: 'table-overdue',
  kind: 'table',
  datasetKey: 'tasks_distribution_by_assignee',
  title: 'Topp ansvarlige — tabell',
  rowKeys: [],
  colSpan: 'full',
}

// ── Pack-architecture widgets ────────────────────────────────────────────

const BAR_PDCA: ReportModuleBar = {
  id: 'bar-pdca-distribution',
  kind: 'bar',
  datasetKey: 'tasks_pdca_distribution',
  title: 'PDCA-fordeling',
  seriesKeys: ['Plan', 'Do', 'Check', 'Act'],
  colSpan: 'md',
}
const DONUT_CATEGORY: ReportModuleDonut = {
  id: 'donut-source-category',
  kind: 'donut',
  datasetKey: 'tasks_source_category_breakdown',
  title: 'Kategori (Avvik / Risiko / Tiltak)',
  segmentsPath: '',
  colSpan: 'md',
}
const TABLE_LAW_REF_COVERAGE: ReportModuleTable = {
  id: 'table-law-ref-coverage',
  kind: 'table',
  datasetKey: 'tasks_law_ref_coverage',
  title: 'Paragrafdekning — åpne vs. fullført',
  rowKeys: ['paragraph', 'open', 'done', 'total'],
  colSpan: 'full',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_TOTAL,
  KPI_OPEN,
  KPI_OVERDUE,
  KPI_COMPLETED_YTD,
  LINE_COMPLETED,
  DONUT_STATUS,
  BAR_SOURCE,
  DONUT_MODULE,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  // Pack-architecture widgets — shown first so they surface in the default catalog view
  { catalogId: 'bar-pdca-distribution', category: 'Pakke', label: 'PDCA-fordeling', template: BAR_PDCA },
  { catalogId: 'donut-source-category', category: 'Pakke', label: 'Kategori (Avvik / Risiko / Tiltak)', template: DONUT_CATEGORY },
  { catalogId: 'table-law-ref-coverage', category: 'Pakke', label: 'Paragrafdekning', template: TABLE_LAW_REF_COVERAGE },
  { catalogId: 'kpi-total', category: 'Volum', label: 'Totalt antall oppgaver', template: KPI_TOTAL },
  { catalogId: 'kpi-open', category: 'Volum', label: 'Åpne / pågående', template: KPI_OPEN },
  { catalogId: 'kpi-overdue', category: 'Volum', label: 'Forfalt', template: KPI_OVERDUE },
  { catalogId: 'kpi-completed-ytd', category: 'Volum', label: 'Fullført i år', template: KPI_COMPLETED_YTD },
  { catalogId: 'kpi-requiring-signoff', category: 'Volum', label: 'Krever ledersignatur', template: KPI_REQUIRING_SIGNOFF },
  { catalogId: 'line-completed-over-time', category: 'Trend', label: 'Fullført over tid', template: LINE_COMPLETED },
  { catalogId: 'line-overdue-over-time', category: 'Trend', label: 'Forfalt over tid', template: LINE_OVERDUE },
  { catalogId: 'donut-status', category: 'Diagrammer', label: 'Status — kakediagram', template: DONUT_STATUS },
  { catalogId: 'donut-module', category: 'Diagrammer', label: 'Modul — kakediagram', template: DONUT_MODULE },
  { catalogId: 'bar-source', category: 'Diagrammer', label: 'Kilde — søylediagram', template: BAR_SOURCE },
  { catalogId: 'bar-priority', category: 'Diagrammer', label: 'Prioritet — søylediagram', template: BAR_PRIORITY },
  { catalogId: 'bar-assignee', category: 'Org-kontekst', label: 'Topp ansvarlige', template: BAR_ASSIGNEE },
  { catalogId: 'bar-department', category: 'Org-kontekst', label: 'Per avdeling', template: BAR_DEPARTMENT },
  { catalogId: 'table-overdue', category: 'Tabeller', label: 'Topp ansvarlige — tabell', template: TABLE_OVERDUE },
  { catalogId: 'table-law-ref-coverage-2', category: 'Tabeller', label: 'Paragrafdekning — tabell', template: TABLE_LAW_REF_COVERAGE },
]

registerDashboardScope({
  scopeId: TASKS_DASHBOARD_SCOPE_ID,
  label: 'Oppgavestyring',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  accent: '#c2410c', // amber — pairs with the Kanban "todo" feel
})
