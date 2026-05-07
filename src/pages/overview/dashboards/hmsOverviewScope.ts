// HMS Overview — composite dashboard (3.3.1).
//
// Pulls KPIs and trend widgets from four member scopes
// (compliance_checklist, survey, tasks, learning) into one curated
// layout. The composite is a normal registered scope — saved layouts
// persist in `dashboard_layouts` just like any per-module dashboard.
//
// The host page (HmsOverviewPage) imports each member's `useXxxDatasets`
// hook, computes its dataset map, and merges them all into one map keyed
// by the scope-namespaced dataset keys these widgets reference. Per-scope
// hooks pick up filter chips they understand and ignore the rest, so a
// composite-level "department" filter narrows compliance, survey,
// tasks, and learning consistently in one go.
//
// We intentionally keep the catalog tight — composite dashboards are for
// at-a-glance org overviews, not deep drill-downs. Users who need
// everything jump into the per-module analyse page.

import type {
  ReportModule,
  ReportModuleKpi,
  ReportModuleLine,
  ReportModuleDonut,
} from '../../../types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'

export const HMS_OVERVIEW_SCOPE_ID = 'hms_overview'

const MEMBERS = ['compliance_checklist', 'survey', 'tasks', 'learning'] as const

// ── Dataset catalogue ─────────────────────────────────────────────────────
// Re-declared from the member scopes so the widget editor's "Datakilde"
// picker shows them. Shapes mirror what the per-scope hooks publish.
const DATASETS: DatasetMeta[] = [
  // Compliance
  { key: 'checklist_kpi_summary', label: 'Sjekklister — KPI-sammendrag', shape: 'kpi-record' },
  { key: 'checklist_executions_over_time', label: 'Sjekklister — kjøringer over tid', shape: 'series' },
  { key: 'checklist_executions_by_status', label: 'Sjekklister — status', shape: 'segments' },
  // Survey
  { key: 'survey_kpi_summary', label: 'Undersøkelser — KPI-sammendrag', shape: 'kpi-record' },
  { key: 'survey_status_distribution', label: 'Undersøkelser — status', shape: 'segments' },
  { key: 'survey_responses_over_time', label: 'Undersøkelser — svar over tid', shape: 'series' },
  // Tasks
  { key: 'tasks_kpi_summary', label: 'Oppgaver — KPI-sammendrag', shape: 'kpi-record' },
  { key: 'tasks_status_distribution', label: 'Oppgaver — status', shape: 'segments' },
  { key: 'tasks_completed_over_time', label: 'Oppgaver — fullført over tid', shape: 'series' },
  // Learning
  { key: 'learning_kpi_summary', label: 'Læring — KPI-sammendrag', shape: 'kpi-record' },
  { key: 'learning_completions_over_time', label: 'Læring — fullføringer over tid', shape: 'series' },
  { key: 'learning_status_distribution', label: 'Læring — status', shape: 'segments' },
]

// ── KPI strip — one per member scope ──────────────────────────────────────
const KPI_COMPLIANCE_YTD: ReportModuleKpi = {
  id: 'kpi-compliance-ytd',
  kind: 'kpi',
  datasetKey: 'checklist_kpi_summary',
  title: 'Signerte sjekklister i år',
  valuePath: 'ytd',
  subtitle: 'Compliance · YTD',
  colSpan: 'sm',
}
const KPI_SURVEY_RESPONSES: ReportModuleKpi = {
  id: 'kpi-survey-responses',
  kind: 'kpi',
  datasetKey: 'survey_kpi_summary',
  title: 'Svar mottatt',
  valuePath: 'responses',
  subtitle: 'Undersøkelser · totalt',
  colSpan: 'sm',
}
const KPI_TASKS_OPEN: ReportModuleKpi = {
  id: 'kpi-tasks-open',
  kind: 'kpi',
  datasetKey: 'tasks_kpi_summary',
  title: 'Åpne oppgaver',
  valuePath: 'open',
  subtitle: 'Oppgavestyring · todo + pågående',
  colSpan: 'sm',
}
const KPI_LEARNING_COMPLETED_YTD: ReportModuleKpi = {
  id: 'kpi-learning-completed-ytd',
  kind: 'kpi',
  datasetKey: 'learning_kpi_summary',
  title: 'Fullførte kurs i år',
  valuePath: 'completedYtd',
  subtitle: 'Læring · YTD',
  colSpan: 'sm',
}

// ── Trends ────────────────────────────────────────────────────────────────
const LINE_CHECKLIST_OVER_TIME: ReportModuleLine = {
  id: 'line-compliance-execs',
  kind: 'line',
  datasetKey: 'checklist_executions_over_time',
  title: 'Sjekklister — kjøringer over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'md',
}
const LINE_LEARNING_OVER_TIME: ReportModuleLine = {
  id: 'line-learning-completions',
  kind: 'line',
  datasetKey: 'learning_completions_over_time',
  title: 'Læring — fullføringer over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'md',
}

// ── Status donuts ─────────────────────────────────────────────────────────
const DONUT_TASKS_STATUS: ReportModuleDonut = {
  id: 'donut-tasks-status',
  kind: 'donut',
  datasetKey: 'tasks_status_distribution',
  title: 'Oppgaver — status',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_SURVEY_STATUS: ReportModuleDonut = {
  id: 'donut-survey-status',
  kind: 'donut',
  datasetKey: 'survey_status_distribution',
  title: 'Undersøkelser — status',
  segmentsPath: '',
  colSpan: 'md',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_COMPLIANCE_YTD,
  KPI_SURVEY_RESPONSES,
  KPI_TASKS_OPEN,
  KPI_LEARNING_COMPLETED_YTD,
  LINE_CHECKLIST_OVER_TIME,
  LINE_LEARNING_OVER_TIME,
  DONUT_TASKS_STATUS,
  DONUT_SURVEY_STATUS,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-compliance-ytd', category: 'Compliance', label: 'Signerte sjekklister i år', template: KPI_COMPLIANCE_YTD },
  { catalogId: 'kpi-survey-responses', category: 'Undersøkelser', label: 'Svar mottatt', template: KPI_SURVEY_RESPONSES },
  { catalogId: 'kpi-tasks-open', category: 'Oppgaver', label: 'Åpne oppgaver', template: KPI_TASKS_OPEN },
  { catalogId: 'kpi-learning-completed-ytd', category: 'Læring', label: 'Fullførte kurs i år', template: KPI_LEARNING_COMPLETED_YTD },
  { catalogId: 'line-compliance-execs', category: 'Trender', label: 'Sjekklister over tid', template: LINE_CHECKLIST_OVER_TIME },
  { catalogId: 'line-learning-completions', category: 'Trender', label: 'Læring over tid', template: LINE_LEARNING_OVER_TIME },
  { catalogId: 'donut-tasks-status', category: 'Diagrammer', label: 'Oppgaver — status', template: DONUT_TASKS_STATUS },
  { catalogId: 'donut-survey-status', category: 'Diagrammer', label: 'Undersøkelser — status', template: DONUT_SURVEY_STATUS },
]

registerDashboardScope({
  scopeId: HMS_OVERVIEW_SCOPE_ID,
  label: 'HMS-oversikt',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  // Indigo — distinct from each member scope's accent so the composite
  // visibly reads as "different layer" rather than "same as one member".
  accent: '#4338ca',
  compositeMembers: [...MEMBERS],
})
