// Tasks analytics scope registration.
//
// Registers `tasks` with the dashboard registry. Datasets are computed by
// TasksAnalysePage from useTasksDatasets. This file is pure metadata —
// import it as a side effect to trigger registration.
//
// Accent: #c2410c (kanban amber — matches the module accent in CLAUDE.md).

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
  { key: 'tasks_priority_distribution', label: 'Prioritet', shape: 'segments' },
  { key: 'tasks_kind_distribution', label: 'Maltype', shape: 'segments' },
  { key: 'tasks_template_distribution', label: 'Per mal', shape: 'segments' },
  { key: 'tasks_capa_funnel', label: 'CAPA-trakt', shape: 'segments' },
  { key: 'tasks_created_over_time', label: 'Opprettet over tid', shape: 'series' },
  { key: 'tasks_closed_over_time', label: 'Lukket over tid', shape: 'series' },
  { key: 'tasks_sla_compliance', label: 'SLA-etterlevelse', shape: 'segments' },
  { key: 'tasks_overdue_by_priority', label: 'Forfalt per prioritet', shape: 'segments' },
  { key: 'tasks_by_assignee', label: 'Belastning per person', shape: 'segments' },
]

// ── KPI widgets ──────────────────────────────────────────────────────────

const KPI_TOTAL: ReportModuleKpi = {
  id: 'kpi-total', kind: 'kpi',
  datasetKey: 'tasks_kpi_summary', title: 'Totalt antall oppgaver',
  valuePath: 'total', subtitle: 'Alle aktive oppgaver', colSpan: 'sm',
}
const KPI_OPEN: ReportModuleKpi = {
  id: 'kpi-open', kind: 'kpi',
  datasetKey: 'tasks_kpi_summary', title: 'Åpne oppgaver',
  valuePath: 'open', subtitle: 'Status åpen eller under behandling', colSpan: 'sm',
}
const KPI_OVERDUE: ReportModuleKpi = {
  id: 'kpi-overdue', kind: 'kpi',
  datasetKey: 'tasks_kpi_summary', title: 'Forfalt',
  valuePath: 'overdue', subtitle: 'Passert frist, ikke lukket', colSpan: 'sm',
}
const KPI_CLOSED_YTD: ReportModuleKpi = {
  id: 'kpi-closed-ytd', kind: 'kpi',
  datasetKey: 'tasks_kpi_summary', title: 'Lukket i år',
  valuePath: 'closedYtd', subtitle: 'YTD', colSpan: 'sm',
}
const KPI_AVVIK_OPEN: ReportModuleKpi = {
  id: 'kpi-avvik-open', kind: 'kpi',
  datasetKey: 'tasks_kpi_summary', title: 'Åpne avvik',
  valuePath: 'avvikOpen', subtitle: 'Åpne avvik og hendelser', colSpan: 'sm',
}
const KPI_CRITICAL: ReportModuleKpi = {
  id: 'kpi-critical', kind: 'kpi',
  datasetKey: 'tasks_kpi_summary', title: 'Kritiske (åpne)',
  valuePath: 'criticalOpen', subtitle: 'Kritisk prioritet, ikke lukket', colSpan: 'sm',
}

// ── Distribution widgets ─────────────────────────────────────────────────

const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status', kind: 'donut',
  datasetKey: 'tasks_status_distribution', title: 'Fordeling per status',
  segmentsPath: '', colSpan: 'md',
}
const DONUT_PRIORITY: ReportModuleDonut = {
  id: 'donut-priority', kind: 'donut',
  datasetKey: 'tasks_priority_distribution', title: 'Fordeling per prioritet',
  segmentsPath: '', colSpan: 'md',
}
const DONUT_KIND: ReportModuleDonut = {
  id: 'donut-kind', kind: 'donut',
  datasetKey: 'tasks_kind_distribution', title: 'Fordeling per maltype',
  segmentsPath: '', colSpan: 'md',
}
const BAR_TEMPLATE: ReportModuleBar = {
  id: 'bar-template', kind: 'bar',
  datasetKey: 'tasks_template_distribution', title: 'Topp brukte maler',
  seriesKeys: [], colSpan: 'md',
}
const TABLE_TEMPLATE: ReportModuleTable = {
  id: 'table-template', kind: 'table',
  datasetKey: 'tasks_template_distribution', title: 'Maler — tabell',
  rowKeys: [], colSpan: 'full',
}

// ── CAPA / SLA widgets ───────────────────────────────────────────────────

const BAR_CAPA: ReportModuleBar = {
  id: 'bar-capa-funnel', kind: 'bar',
  datasetKey: 'tasks_capa_funnel', title: 'CAPA-trakt — antall per fase',
  seriesKeys: [], colSpan: 'md',
}
const DONUT_SLA: ReportModuleDonut = {
  id: 'donut-sla', kind: 'donut',
  datasetKey: 'tasks_sla_compliance', title: 'SLA-etterlevelse',
  segmentsPath: '', colSpan: 'md',
}
const BAR_OVERDUE: ReportModuleBar = {
  id: 'bar-overdue', kind: 'bar',
  datasetKey: 'tasks_overdue_by_priority', title: 'Forfalt per prioritet',
  seriesKeys: [], colSpan: 'md',
}

// ── Workload (H2.6) ─────────────────────────────────────────────────────

const BAR_ASSIGNEE: ReportModuleBar = {
  id: 'bar-assignee', kind: 'bar',
  datasetKey: 'tasks_by_assignee', title: 'Belastning per person',
  seriesKeys: [], colSpan: 'md',
}
const TABLE_ASSIGNEE: ReportModuleTable = {
  id: 'table-assignee', kind: 'table',
  datasetKey: 'tasks_by_assignee', title: 'Belastning per person — tabell',
  rowKeys: [], colSpan: 'full',
}

// ── Trend widgets ────────────────────────────────────────────────────────

const LINE_CREATED: ReportModuleLine = {
  id: 'line-created', kind: 'line',
  datasetKey: 'tasks_created_over_time', title: 'Opprettet over tid',
  pointsPath: '', xLabel: 'Måned', yLabel: 'Antall', colSpan: 'md',
}
const LINE_CLOSED: ReportModuleLine = {
  id: 'line-closed', kind: 'line',
  datasetKey: 'tasks_closed_over_time', title: 'Lukket over tid',
  pointsPath: '', xLabel: 'Måned', yLabel: 'Antall', colSpan: 'md',
}

// ── Default layout ───────────────────────────────────────────────────────

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_TOTAL, KPI_OPEN, KPI_OVERDUE, KPI_AVVIK_OPEN,
  LINE_CREATED, DONUT_STATUS,
  BAR_ASSIGNEE, BAR_CAPA,
  DONUT_PRIORITY, BAR_TEMPLATE, DONUT_SLA,
]

// ── Widget catalog ───────────────────────────────────────────────────────

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-total', category: 'Volum', label: 'Totalt antall oppgaver', template: KPI_TOTAL },
  { catalogId: 'kpi-open', category: 'Volum', label: 'Åpne oppgaver', template: KPI_OPEN },
  { catalogId: 'kpi-overdue', category: 'Volum', label: 'Forfalt', template: KPI_OVERDUE },
  { catalogId: 'kpi-closed-ytd', category: 'Volum', label: 'Lukket i år (YTD)', template: KPI_CLOSED_YTD },
  { catalogId: 'kpi-avvik-open', category: 'Avvik', label: 'Åpne avvik', template: KPI_AVVIK_OPEN },
  { catalogId: 'kpi-critical', category: 'Avvik', label: 'Kritiske (åpne)', template: KPI_CRITICAL },
  { catalogId: 'donut-status', category: 'Diagrammer', label: 'Status — kakediagram', template: DONUT_STATUS },
  { catalogId: 'donut-priority', category: 'Diagrammer', label: 'Prioritet — kakediagram', template: DONUT_PRIORITY },
  { catalogId: 'donut-kind', category: 'Diagrammer', label: 'Maltype — kakediagram', template: DONUT_KIND },
  { catalogId: 'bar-template', category: 'Diagrammer', label: 'Topp brukte maler', template: BAR_TEMPLATE },
  { catalogId: 'table-template', category: 'Tabeller', label: 'Maler — tabell', template: TABLE_TEMPLATE },
  { catalogId: 'bar-capa-funnel', category: 'CAPA', label: 'CAPA-trakt', description: 'Antall oppgaver per CAPA-fase for avvik/risiko.', template: BAR_CAPA },
  { catalogId: 'donut-sla', category: 'CAPA', label: 'SLA-etterlevelse', template: DONUT_SLA },
  { catalogId: 'bar-overdue', category: 'CAPA', label: 'Forfalt per prioritet', template: BAR_OVERDUE },
  { catalogId: 'bar-assignee', category: 'Belastning', label: 'Belastning per person', description: 'Åpne oppgaver per person; forfalte flagges i etiketten.', template: BAR_ASSIGNEE },
  { catalogId: 'table-assignee', category: 'Belastning', label: 'Belastning per person — tabell', template: TABLE_ASSIGNEE },
  { catalogId: 'line-created', category: 'Trend', label: 'Opprettet over tid', template: LINE_CREATED },
  { catalogId: 'line-closed', category: 'Trend', label: 'Lukket over tid', template: LINE_CLOSED },
]

registerDashboardScope({
  scopeId: TASKS_DASHBOARD_SCOPE_ID,
  label: 'Oppgaver',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  accent: '#c2410c',
})
