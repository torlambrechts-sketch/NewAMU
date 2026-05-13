// Vernerunder analytics scope.
//
// Registers `vernerunder` med dashboard-registry. Tynnet ut for v1 av
// Arbeidsmiljøstrategi — gir Trygghet-aksen reelle data om åpne funn,
// alvorlighet og dager siden siste alvorlig hendelse. Import som
// side-effekt for å sikre at registreringen kjører før layout-spørringen
// blir gjort.
//
// Accent: vernerunder bruker compliance-grønnen (#1a3d32) for å lese
// som «vernearbeid» — feltet ligger nært inn på sjekkliste-flyten.

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

export const VERNERUNDER_DASHBOARD_SCOPE_ID = 'vernerunder'

const DATASETS: DatasetMeta[] = [
  { key: 'vernerunde_kpi_summary', label: 'Vernerunder — KPI-sammendrag', shape: 'kpi-record' },
  { key: 'vernerunde_status_distribution', label: 'Vernerunder — status', shape: 'segments' },
  { key: 'vernerunde_findings_severity', label: 'Funn etter alvorlighet', shape: 'segments' },
  { key: 'vernerunde_completed_over_time', label: 'Fullførte vernerunder over tid', shape: 'series' },
  { key: 'vernerunde_recent_findings', label: 'Siste funn', shape: 'rows' },
]

const KPI_TOTAL: ReportModuleKpi = {
  id: 'kpi-vr-total', kind: 'kpi', datasetKey: 'vernerunde_kpi_summary',
  title: 'Vernerunder', valuePath: 'total', subtitle: 'Alle perioder', colSpan: 'sm',
}
const KPI_OPEN_FINDINGS: ReportModuleKpi = {
  id: 'kpi-vr-findings-open', kind: 'kpi', datasetKey: 'vernerunde_kpi_summary',
  title: 'Åpne funn', valuePath: 'findingsOpen', subtitle: 'Ikke lukket via tiltak', colSpan: 'sm',
}
const KPI_CRITICAL_FINDINGS: ReportModuleKpi = {
  id: 'kpi-vr-findings-critical', kind: 'kpi', datasetKey: 'vernerunde_kpi_summary',
  title: 'Kritiske funn', valuePath: 'findingsCritical', subtitle: 'Severity = critical', colSpan: 'sm',
}
const KPI_DAYS_SINCE: ReportModuleKpi = {
  id: 'kpi-vr-days-since', kind: 'kpi', datasetKey: 'vernerunde_kpi_summary',
  title: 'Dager siden siste runde', valuePath: 'daysSinceLast',
  subtitle: 'Fullført eller signert', colSpan: 'sm',
}

const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-vr-status', kind: 'donut', datasetKey: 'vernerunde_status_distribution',
  title: 'Status', segmentsPath: '', colSpan: 'md',
}
const BAR_SEVERITY: ReportModuleBar = {
  id: 'bar-vr-severity', kind: 'bar', datasetKey: 'vernerunde_findings_severity',
  title: 'Alvorlighet på funn', seriesKeys: [], colSpan: 'md',
}
const LINE_COMPLETED: ReportModuleLine = {
  id: 'line-vr-completed', kind: 'line', datasetKey: 'vernerunde_completed_over_time',
  title: 'Fullførte vernerunder over tid',
  pointsPath: '', xLabel: 'Måned', yLabel: 'Antall', colSpan: 'md',
}
const TABLE_RECENT: ReportModuleTable = {
  id: 'table-vr-recent', kind: 'table', datasetKey: 'vernerunde_recent_findings',
  title: 'Siste funn',
  rowKeys: ['runde', 'severity', 'description', 'createdAt'],
  colSpan: 'lg',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_TOTAL, KPI_OPEN_FINDINGS, KPI_CRITICAL_FINDINGS, KPI_DAYS_SINCE,
  DONUT_STATUS, BAR_SEVERITY, LINE_COMPLETED,
  TABLE_RECENT,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-vr-total', category: 'Volum', label: 'Vernerunder totalt', template: KPI_TOTAL },
  { catalogId: 'kpi-vr-findings-open', category: 'Funn', label: 'Åpne funn', template: KPI_OPEN_FINDINGS },
  { catalogId: 'kpi-vr-findings-critical', category: 'Funn', label: 'Kritiske funn', template: KPI_CRITICAL_FINDINGS },
  { catalogId: 'kpi-vr-days-since', category: 'Volum', label: 'Dager siden siste runde', template: KPI_DAYS_SINCE },
  { catalogId: 'donut-vr-status', category: 'Diagrammer', label: 'Status', template: DONUT_STATUS },
  { catalogId: 'bar-vr-severity', category: 'Diagrammer', label: 'Alvorlighet', template: BAR_SEVERITY },
  { catalogId: 'line-vr-completed', category: 'Trender', label: 'Fullført over tid', template: LINE_COMPLETED },
  { catalogId: 'table-vr-recent', category: 'Tabeller', label: 'Siste funn', template: TABLE_RECENT },
]

registerDashboardScope({
  scopeId: VERNERUNDER_DASHBOARD_SCOPE_ID,
  label: 'Vernerunder',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  accent: '#1a3d32',
})
