// Meeting-briefing dashboard scope.
//
// Templates declare a dashboard block (`definition.dashboard`) whose
// widgets reference the dataset keys this scope publishes. The hook
// `useMeetingBriefingDatasets` fans out to existing module data
// (HSE, internal control, decisions, whistleblowing, training) and
// shapes the results into the dataset map this scope expects.
//
// Distinct from the existing `meetings` scope (analytics across all
// meetings) — the briefing scope is per-meeting and period-aware.

import type {
  ReportModule,
  ReportModuleDonut,
  ReportModuleKpi,
  ReportModuleTable,
} from '../../../src/types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../src/lib/dashboards/dashboardRegistry'

export const MEETING_BRIEFING_SCOPE_ID = 'meeting_briefing'

const DATASETS: DatasetMeta[] = [
  { key: 'briefing_kpi_summary', label: 'Nøkkeltall', shape: 'kpi-record' },
  { key: 'briefing_incidents_by_status', label: 'Avvik per status', shape: 'segments' },
  { key: 'briefing_sick_leave_by_dept', label: 'Sykefravær per avdeling', shape: 'segments' },
  { key: 'briefing_vernerunder_by_status', label: 'Vernerunder per status', shape: 'segments' },
  { key: 'briefing_open_ros_high', label: 'Åpne høyrisiko-ROS', shape: 'rows' },
  { key: 'briefing_open_decisions', label: 'Åpne vedtak', shape: 'rows' },
  { key: 'briefing_whistleblowing_status', label: 'Varslingssaker per status', shape: 'segments' },
  { key: 'briefing_training_by_kind', label: 'Opplæring per type', shape: 'segments' },
]

// ── KPI tiles ─────────────────────────────────────────────────────────────

const KPI_INCIDENTS_TOTAL: ReportModuleKpi = {
  id: 'briefing-kpi-incidents-total',
  kind: 'kpi',
  datasetKey: 'briefing_kpi_summary',
  title: 'Avvik i perioden',
  valuePath: 'incidentsTotal',
  subtitle: 'Hendelser registrert i rapporteringsperioden',
  colSpan: 'sm',
}
const KPI_INCIDENTS_CRITICAL: ReportModuleKpi = {
  id: 'briefing-kpi-incidents-critical',
  kind: 'kpi',
  datasetKey: 'briefing_kpi_summary',
  title: 'Kritiske avvik',
  valuePath: 'incidentsCritical',
  subtitle: 'Klassifisert som kritisk',
  colSpan: 'sm',
}
const KPI_SICK_LEAVE_CASES: ReportModuleKpi = {
  id: 'briefing-kpi-sick-leave-cases',
  kind: 'kpi',
  datasetKey: 'briefing_kpi_summary',
  title: 'Sykefraværssaker',
  valuePath: 'sickLeaveCases',
  subtitle: 'Påbegynt i perioden',
  colSpan: 'sm',
}
const KPI_OPEN_ROS_HIGH: ReportModuleKpi = {
  id: 'briefing-kpi-open-ros-high',
  kind: 'kpi',
  datasetKey: 'briefing_kpi_summary',
  title: 'Åpne høyrisiko-ROS',
  valuePath: 'openHighRos',
  subtitle: 'Risikoskår ≥ 12',
  colSpan: 'sm',
}
const KPI_OPEN_DECISIONS: ReportModuleKpi = {
  id: 'briefing-kpi-open-decisions',
  kind: 'kpi',
  datasetKey: 'briefing_kpi_summary',
  title: 'Åpne vedtak',
  valuePath: 'openDecisions',
  subtitle: 'Fra tidligere møter',
  colSpan: 'sm',
}
const KPI_VERNERUNDER: ReportModuleKpi = {
  id: 'briefing-kpi-vernerunder',
  kind: 'kpi',
  datasetKey: 'briefing_kpi_summary',
  title: 'Vernerunder',
  valuePath: 'vernerunderInPeriod',
  subtitle: 'Gjennomført i perioden',
  colSpan: 'sm',
}

// ── Distribution widgets ──────────────────────────────────────────────────

const DONUT_INCIDENTS: ReportModuleDonut = {
  id: 'briefing-donut-incidents',
  kind: 'donut',
  datasetKey: 'briefing_incidents_by_status',
  title: 'Avvik per status',
  segmentsPath: 'segments',
  colSpan: 'md',
}
const DONUT_VERNERUNDER: ReportModuleDonut = {
  id: 'briefing-donut-vernerunder',
  kind: 'donut',
  datasetKey: 'briefing_vernerunder_by_status',
  title: 'Vernerunder per status',
  segmentsPath: 'segments',
  colSpan: 'md',
}
const DONUT_WHISTLEBLOWING: ReportModuleDonut = {
  id: 'briefing-donut-whistleblowing',
  kind: 'donut',
  datasetKey: 'briefing_whistleblowing_status',
  title: 'Varslingssaker per status',
  segmentsPath: 'segments',
  colSpan: 'md',
}
const DONUT_SICK_LEAVE_DEPT: ReportModuleDonut = {
  id: 'briefing-donut-sick-leave-dept',
  kind: 'donut',
  datasetKey: 'briefing_sick_leave_by_dept',
  title: 'Sykefravær per avdeling',
  segmentsPath: 'segments',
  colSpan: 'md',
}
const DONUT_TRAINING_KIND: ReportModuleDonut = {
  id: 'briefing-donut-training-kind',
  kind: 'donut',
  datasetKey: 'briefing_training_by_kind',
  title: 'Opplæring per type',
  segmentsPath: 'segments',
  colSpan: 'md',
}
const TABLE_OPEN_ROS: ReportModuleTable = {
  id: 'briefing-table-open-ros',
  kind: 'table',
  datasetKey: 'briefing_open_ros_high',
  title: 'Åpne høyrisiko-ROS — topp 5',
  rowKeys: ['assessment', 'riskScore', 'hazard'],
  colSpan: 'full',
}
const TABLE_OPEN_DECISIONS: ReportModuleTable = {
  id: 'briefing-table-open-decisions',
  kind: 'table',
  datasetKey: 'briefing_open_decisions',
  title: 'Åpne vedtak fra tidligere møter',
  rowKeys: ['decisionText', 'decisionAt'],
  colSpan: 'full',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_INCIDENTS_TOTAL,
  KPI_INCIDENTS_CRITICAL,
  KPI_SICK_LEAVE_CASES,
  KPI_OPEN_ROS_HIGH,
  DONUT_INCIDENTS,
  DONUT_VERNERUNDER,
  DONUT_SICK_LEAVE_DEPT,
  TABLE_OPEN_DECISIONS,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'briefing-kpi-incidents-total', category: 'Nøkkeltall', label: 'Avvik totalt', template: KPI_INCIDENTS_TOTAL },
  { catalogId: 'briefing-kpi-incidents-critical', category: 'Nøkkeltall', label: 'Kritiske avvik', template: KPI_INCIDENTS_CRITICAL },
  { catalogId: 'briefing-kpi-sick-leave-cases', category: 'Nøkkeltall', label: 'Sykefraværssaker', template: KPI_SICK_LEAVE_CASES },
  { catalogId: 'briefing-kpi-open-ros-high', category: 'Nøkkeltall', label: 'Åpne høyrisiko-ROS', template: KPI_OPEN_ROS_HIGH },
  { catalogId: 'briefing-kpi-open-decisions', category: 'Nøkkeltall', label: 'Åpne vedtak', template: KPI_OPEN_DECISIONS },
  { catalogId: 'briefing-kpi-vernerunder', category: 'Nøkkeltall', label: 'Vernerunder gjennomført', template: KPI_VERNERUNDER },
  { catalogId: 'briefing-donut-incidents', category: 'Diagrammer', label: 'Avvik — donut', template: DONUT_INCIDENTS },
  { catalogId: 'briefing-donut-vernerunder', category: 'Diagrammer', label: 'Vernerunder — donut', template: DONUT_VERNERUNDER },
  { catalogId: 'briefing-donut-whistleblowing', category: 'Diagrammer', label: 'Varslingssaker — donut', template: DONUT_WHISTLEBLOWING },
  { catalogId: 'briefing-donut-sick-leave-dept', category: 'Diagrammer', label: 'Sykefravær per avdeling', template: DONUT_SICK_LEAVE_DEPT },
  { catalogId: 'briefing-donut-training-kind', category: 'Diagrammer', label: 'Opplæring per type', template: DONUT_TRAINING_KIND },
  { catalogId: 'briefing-table-open-ros', category: 'Tabeller', label: 'Åpne høyrisiko-ROS', template: TABLE_OPEN_ROS },
  { catalogId: 'briefing-table-open-decisions', category: 'Tabeller', label: 'Åpne vedtak', template: TABLE_OPEN_DECISIONS },
]

registerDashboardScope({
  scopeId: MEETING_BRIEFING_SCOPE_ID,
  label: 'Møtebriefing',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  accent: '#0891b2',
})
