// HMS Overview — composite dashboard (3.3.1).
//
// Pulls KPIs and trend widgets from five member scopes
// (compliance_checklist, survey, tasks, learning, documents) into one
// curated layout. The composite is a normal registered scope — saved
// layouts persist in `dashboard_layouts` just like any per-module
// dashboard.
//
// The host page (HmsOverviewPage) imports each member's `useXxxDatasets`
// hook, computes its dataset map, and merges them all into one map keyed
// by the scope-namespaced dataset keys these widgets reference. Per-scope
// hooks pick up filter chips they understand and ignore the rest, so a
// composite-level "department" filter narrows compliance, survey, tasks,
// learning and documents consistently in one go.
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

const MEMBERS = [
  'compliance_checklist',
  'survey',
  'tasks',
  'learning',
  'documents',
  'risk',
  'alerts',
] as const

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
  // Documents
  { key: 'documents_kpi_summary', label: 'Dokumenter — KPI-sammendrag', shape: 'kpi-record' },
  { key: 'documents_status_distribution', label: 'Dokumenter — status', shape: 'segments' },
  { key: 'documents_published_over_time', label: 'Dokumenter — publisert over tid', shape: 'series' },
  // Risk — exec leak: red band + unjustified residual
  { key: 'risk_kpi_summary', label: 'Risiko — KPI-sammendrag', shape: 'kpi-record' },
  // Alerts (Varslinger)
  { key: 'alerts_kpi_summary', label: 'Varslinger — KPI-sammendrag', shape: 'kpi-record' },
  { key: 'alerts_received_over_time', label: 'Varslinger — mottatt over tid', shape: 'series' },
  { key: 'alerts_kind_distribution', label: 'Varslinger — type', shape: 'segments' },
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
const KPI_DOCUMENTS_PUBLISHED: ReportModuleKpi = {
  id: 'kpi-documents-published',
  kind: 'kpi',
  datasetKey: 'documents_kpi_summary',
  title: 'Publiserte sider',
  valuePath: 'published',
  subtitle: 'Dokumenter · totalt',
  colSpan: 'sm',
}
const KPI_DOCUMENTS_RETENTION_OVERDUE: ReportModuleKpi = {
  id: 'kpi-documents-retention-overdue',
  kind: 'kpi',
  datasetKey: 'documents_kpi_summary',
  title: 'Forfalt revisjon',
  valuePath: 'retentionOverdue',
  subtitle: 'Dokumenter · krever oppfølging',
  colSpan: 'sm',
}
// Risk leak — two KPIs that surface in the executive overview. The
// risk scope publishes the full `risk_kpi_summary` record; we pull two
// fields. `comparisonGoal: 'decrease'` flips the delta colouring so
// growth reads as a warning, not a win.
//
// In P1 we surface `redBand` and `staleOver12m` — both measurable from
// existing sources without ambiguity. The `residualUnjustified` field
// becomes meaningful in P2 when ROS hazards land (red rows then carry a
// real `residual_justification` text column); the widget catalog still
// exposes it so customers can opt in.
const KPI_RISK_RED_BAND: ReportModuleKpi = {
  id: 'kpi-risk-red-band',
  kind: 'kpi',
  datasetKey: 'risk_kpi_summary',
  title: 'Røde risikoer',
  valuePath: 'redBand',
  subtitle: 'Risiko · 13–25 (uakseptabel)',
  comparisonGoal: 'decrease',
  colSpan: 'sm',
}
const KPI_RISK_AGEING_STALE: ReportModuleKpi = {
  id: 'kpi-risk-ageing-stale',
  kind: 'kpi',
  datasetKey: 'risk_kpi_summary',
  title: 'Ikke vurdert siste 12 mnd',
  valuePath: 'staleOver12m',
  subtitle: 'Risiko · statisk register-varsel',
  comparisonGoal: 'decrease',
  colSpan: 'sm',
}
const KPI_ALERTS_OPEN: ReportModuleKpi = {
  id: 'kpi-alerts-open',
  kind: 'kpi',
  datasetKey: 'alerts_kpi_summary',
  title: 'Åpne varslinger',
  valuePath: 'openCases',
  subtitle: 'Varslinger · ikke lukket',
  colSpan: 'sm',
}
const KPI_ALERTS_OVERDUE_ACK: ReportModuleKpi = {
  id: 'kpi-alerts-overdue-ack',
  kind: 'kpi',
  datasetKey: 'alerts_kpi_summary',
  title: 'Forsinket kvittering',
  valuePath: 'overdueAcknowledgement',
  subtitle: 'Varslinger · AML § 2A-3 frist',
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
const LINE_DOCUMENTS_OVER_TIME: ReportModuleLine = {
  id: 'line-documents-published',
  kind: 'line',
  datasetKey: 'documents_published_over_time',
  title: 'Dokumenter — publisert over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'md',
}
const LINE_ALERTS_OVER_TIME: ReportModuleLine = {
  id: 'line-alerts-received',
  kind: 'line',
  datasetKey: 'alerts_received_over_time',
  title: 'Varslinger — mottatt over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'md',
}
const DONUT_ALERTS_KIND: ReportModuleDonut = {
  id: 'donut-alerts-kind',
  kind: 'donut',
  datasetKey: 'alerts_kind_distribution',
  title: 'Varslinger — type',
  segmentsPath: '',
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
const DONUT_DOCUMENTS_STATUS: ReportModuleDonut = {
  id: 'donut-documents-status',
  kind: 'donut',
  datasetKey: 'documents_status_distribution',
  title: 'Dokumenter — status',
  segmentsPath: '',
  colSpan: 'md',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_COMPLIANCE_YTD,
  KPI_SURVEY_RESPONSES,
  KPI_TASKS_OPEN,
  KPI_RISK_RED_BAND,
  KPI_RISK_AGEING_STALE,
  KPI_LEARNING_COMPLETED_YTD,
  KPI_ALERTS_OPEN,
  KPI_ALERTS_OVERDUE_ACK,
  LINE_CHECKLIST_OVER_TIME,
  LINE_LEARNING_OVER_TIME,
  LINE_ALERTS_OVER_TIME,
  DONUT_TASKS_STATUS,
  DONUT_SURVEY_STATUS,
  DONUT_ALERTS_KIND,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-compliance-ytd', category: 'Compliance', label: 'Signerte sjekklister i år', template: KPI_COMPLIANCE_YTD },
  { catalogId: 'kpi-survey-responses', category: 'Undersøkelser', label: 'Svar mottatt', template: KPI_SURVEY_RESPONSES },
  { catalogId: 'kpi-tasks-open', category: 'Oppgaver', label: 'Åpne oppgaver', template: KPI_TASKS_OPEN },
  { catalogId: 'kpi-learning-completed-ytd', category: 'Læring', label: 'Fullførte kurs i år', template: KPI_LEARNING_COMPLETED_YTD },
  { catalogId: 'kpi-documents-published', category: 'Dokumenter', label: 'Publiserte sider', template: KPI_DOCUMENTS_PUBLISHED },
  { catalogId: 'kpi-documents-retention-overdue', category: 'Dokumenter', label: 'Forfalt revisjon', template: KPI_DOCUMENTS_RETENTION_OVERDUE },
  { catalogId: 'kpi-risk-red-band', category: 'Risiko', label: 'Røde risikoer (13–25)', description: 'Antall aktive risikoer i uakseptabelt bånd.', template: KPI_RISK_RED_BAND },
  { catalogId: 'kpi-risk-ageing-stale', category: 'Risiko', label: 'Ikke vurdert siste 12 mnd', description: 'Statisk register-varsel — risikoer som ikke er vurdert på et år.', template: KPI_RISK_AGEING_STALE },
  { catalogId: 'line-compliance-execs', category: 'Trender', label: 'Sjekklister over tid', template: LINE_CHECKLIST_OVER_TIME },
  { catalogId: 'line-learning-completions', category: 'Trender', label: 'Læring over tid', template: LINE_LEARNING_OVER_TIME },
  { catalogId: 'line-documents-published', category: 'Trender', label: 'Dokumenter over tid', template: LINE_DOCUMENTS_OVER_TIME },
  { catalogId: 'donut-tasks-status', category: 'Diagrammer', label: 'Oppgaver — status', template: DONUT_TASKS_STATUS },
  { catalogId: 'donut-survey-status', category: 'Diagrammer', label: 'Undersøkelser — status', template: DONUT_SURVEY_STATUS },
  { catalogId: 'donut-documents-status', category: 'Diagrammer', label: 'Dokumenter — status', template: DONUT_DOCUMENTS_STATUS },
  { catalogId: 'kpi-alerts-open', category: 'Varslinger', label: 'Åpne varslinger', template: KPI_ALERTS_OPEN },
  { catalogId: 'kpi-alerts-overdue-ack', category: 'Varslinger', label: 'Forsinket kvittering (AML § 2A-3)', template: KPI_ALERTS_OVERDUE_ACK },
  { catalogId: 'line-alerts-received', category: 'Trender', label: 'Varslinger over tid', template: LINE_ALERTS_OVER_TIME },
  { catalogId: 'donut-alerts-kind', category: 'Diagrammer', label: 'Varslinger — type', template: DONUT_ALERTS_KIND },
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
