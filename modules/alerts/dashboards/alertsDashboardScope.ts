// Alerts analytics scope registration. Side-effect import from
// AlertsAnalysePage triggers the registration. Accent: #b91c1c (rød).

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
  type DashboardDimension,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../src/lib/dashboards/dashboardRegistry'
import { ALERTS_ACCENT } from '../alertsLabels'

export const ALERTS_DASHBOARD_SCOPE_ID = 'alerts'

const DATASETS: DatasetMeta[] = [
  { key: 'alerts_kpi_summary', label: 'KPI-sammendrag', shape: 'kpi-record' },
  { key: 'alerts_status_distribution', label: 'Status', shape: 'segments' },
  { key: 'alerts_kind_distribution', label: 'Type', shape: 'segments' },
  { key: 'alerts_template_distribution', label: 'Per mal', shape: 'segments' },
  { key: 'alerts_category_distribution', label: 'Per kategori', shape: 'segments' },
  { key: 'alerts_severity_distribution', label: 'Alvorlighet', shape: 'segments' },
  { key: 'alerts_anonymity_distribution', label: 'Anonymitet', shape: 'segments' },
  { key: 'alerts_received_over_time', label: 'Mottatt over tid', shape: 'series' },
  { key: 'alerts_closed_over_time', label: 'Lukket over tid', shape: 'series' },
  { key: 'alerts_acknowledgement_compliance', label: 'Bekreftelse innen frist', shape: 'segments' },
  { key: 'alerts_gdpr_72h_compliance', label: 'GDPR 72-timersfrist', shape: 'segments' },
  { key: 'alerts_by_location', label: 'Per lokasjon', shape: 'segments' },
  { key: 'alerts_by_department', label: 'Per avdeling', shape: 'segments' },
  { key: 'alerts_law_ref_coverage', label: 'Lovreferanser dekket', shape: 'segments' },
  { key: 'alerts_retention_upcoming_purges', label: 'Kommende sletting', shape: 'segments' },
  // v1.1 additions
  { key: 'alerts_sla_states', label: 'SLA-klokker', shape: 'segments' },
  { key: 'alerts_anonymity_share', label: 'Anonymitetsfordeling (v1.1)', shape: 'segments' },
  { key: 'alerts_retention_horizon', label: 'Retensjons-horisont', shape: 'segments' },
  { key: 'alerts_dsar_burn', label: 'DSAR-nedbrenning (30d)', shape: 'segments' },
  { key: 'alerts_break_glass_activity', label: 'Break-glass-aktivitet', shape: 'segments' },
]

const DIMENSIONS: DashboardDimension[] = [
  { id: 'kind', label: 'Type', kind: 'enum' },
  { id: 'template', label: 'Mal', kind: 'enum' },
  { id: 'category', label: 'Kategori', kind: 'enum' },
  { id: 'status', label: 'Status', kind: 'enum' },
  { id: 'severity', label: 'Alvorlighet', kind: 'enum' },
  { id: 'anonymity', label: 'Anonymitet', kind: 'enum' },
  { id: 'location', label: 'Lokasjon', kind: 'enum' },
  { id: 'department', label: 'Avdeling', kind: 'enum' },
  { id: 'date', label: 'Periode', kind: 'date_range' },
  // v1.1 additions
  { id: 'anonymity_mode', label: 'Anonymitetsmodus (v1.1)', kind: 'enum' },
  { id: 'sla_state', label: 'SLA-status', kind: 'enum' },
  { id: 'legal_hold', label: 'Legal hold', kind: 'enum' },
]

const KPI_TOTAL: ReportModuleKpi = {
  id: 'kpi-total',
  kind: 'kpi',
  datasetKey: 'alerts_kpi_summary',
  title: 'Totalt antall saker',
  valuePath: 'total',
  subtitle: 'Alle ikke-redigerte saker',
  colSpan: 'sm',
}
const KPI_OPEN: ReportModuleKpi = {
  id: 'kpi-open',
  kind: 'kpi',
  datasetKey: 'alerts_kpi_summary',
  title: 'Åpne',
  valuePath: 'openCases',
  subtitle: 'Status ikke lukket eller avvist',
  colSpan: 'sm',
}
const KPI_OVERDUE_ACK: ReportModuleKpi = {
  id: 'kpi-overdue-ack',
  kind: 'kpi',
  datasetKey: 'alerts_kpi_summary',
  title: 'Forsinket kvittering',
  valuePath: 'overdueAcknowledgement',
  subtitle: 'AML § 2A-3 frist passert',
  colSpan: 'sm',
}
const KPI_CRITICAL: ReportModuleKpi = {
  id: 'kpi-critical',
  kind: 'kpi',
  datasetKey: 'alerts_kpi_summary',
  title: 'Kritisk alvorlighet',
  valuePath: 'criticalSeverity',
  subtitle: 'Alvorlighet = kritisk',
  colSpan: 'sm',
}
const KPI_ANONYMOUS_SHARE: ReportModuleKpi = {
  id: 'kpi-anonymous-share',
  kind: 'kpi',
  datasetKey: 'alerts_kpi_summary',
  title: 'Andel anonyme',
  valuePath: 'anonymousShare',
  subtitle: 'Anonyme / totalt (%)',
  colSpan: 'sm',
}
const KPI_CLOSED_YTD: ReportModuleKpi = {
  id: 'kpi-closed-ytd',
  kind: 'kpi',
  datasetKey: 'alerts_kpi_summary',
  title: 'Lukkede i år',
  valuePath: 'closedYtd',
  subtitle: 'YTD',
  colSpan: 'sm',
}

const LINE_RECEIVED: ReportModuleLine = {
  id: 'line-received-over-time',
  kind: 'line',
  datasetKey: 'alerts_received_over_time',
  title: 'Mottatte saker over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'lg',
}
const LINE_CLOSED: ReportModuleLine = {
  id: 'line-closed-over-time',
  kind: 'line',
  datasetKey: 'alerts_closed_over_time',
  title: 'Lukkede saker over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'md',
}
const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status',
  kind: 'donut',
  datasetKey: 'alerts_status_distribution',
  title: 'Fordeling per status',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_KIND: ReportModuleDonut = {
  id: 'donut-kind',
  kind: 'donut',
  datasetKey: 'alerts_kind_distribution',
  title: 'Fordeling per type',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_SEVERITY: ReportModuleDonut = {
  id: 'donut-severity',
  kind: 'donut',
  datasetKey: 'alerts_severity_distribution',
  title: 'Alvorlighet',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_ANONYMITY: ReportModuleDonut = {
  id: 'donut-anonymity',
  kind: 'donut',
  datasetKey: 'alerts_anonymity_distribution',
  title: 'Anonymitet',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_ACK_COMPLIANCE: ReportModuleDonut = {
  id: 'donut-ack-compliance',
  kind: 'donut',
  datasetKey: 'alerts_acknowledgement_compliance',
  title: 'Bekreftelse innen frist (AML § 2A-3)',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_GDPR_72H: ReportModuleDonut = {
  id: 'donut-gdpr-72h',
  kind: 'donut',
  datasetKey: 'alerts_gdpr_72h_compliance',
  title: 'GDPR Art. 33 — 72-timersfrist',
  segmentsPath: '',
  colSpan: 'md',
}
const BAR_TEMPLATE: ReportModuleBar = {
  id: 'bar-template',
  kind: 'bar',
  datasetKey: 'alerts_template_distribution',
  title: 'Mest brukte maler',
  seriesKeys: [],
  colSpan: 'md',
}
const BAR_CATEGORY: ReportModuleBar = {
  id: 'bar-category',
  kind: 'bar',
  datasetKey: 'alerts_category_distribution',
  title: 'Per kategori',
  seriesKeys: [],
  colSpan: 'md',
}
const DONUT_LOCATION: ReportModuleDonut = {
  id: 'donut-location',
  kind: 'donut',
  datasetKey: 'alerts_by_location',
  title: 'Per lokasjon',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_DEPARTMENT: ReportModuleDonut = {
  id: 'donut-department',
  kind: 'donut',
  datasetKey: 'alerts_by_department',
  title: 'Per avdeling',
  segmentsPath: '',
  colSpan: 'md',
}
const TABLE_LAW_REFS: ReportModuleTable = {
  id: 'table-law-refs',
  kind: 'table',
  datasetKey: 'alerts_law_ref_coverage',
  title: 'Lovreferanser dekket',
  rowKeys: [],
  colSpan: 'full',
}
const DONUT_RETENTION: ReportModuleDonut = {
  id: 'donut-retention',
  kind: 'donut',
  datasetKey: 'alerts_retention_upcoming_purges',
  title: 'Kommende sletting (oppbevaringsfrist)',
  segmentsPath: '',
  colSpan: 'md',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_TOTAL,
  KPI_OPEN,
  KPI_OVERDUE_ACK,
  KPI_CRITICAL,
  DONUT_STATUS,
  DONUT_KIND,
  LINE_RECEIVED,
  BAR_TEMPLATE,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-total', category: 'Volum', label: 'Totalt antall saker', template: KPI_TOTAL },
  { catalogId: 'kpi-open', category: 'Volum', label: 'Åpne saker', template: KPI_OPEN },
  { catalogId: 'kpi-closed-ytd', category: 'Volum', label: 'Lukkede i år', template: KPI_CLOSED_YTD },
  { catalogId: 'kpi-overdue-ack', category: 'Risiko', label: 'Forsinket kvittering', template: KPI_OVERDUE_ACK },
  { catalogId: 'kpi-critical', category: 'Risiko', label: 'Kritisk alvorlighet', template: KPI_CRITICAL },
  { catalogId: 'kpi-anonymous-share', category: 'Anonymitet', label: 'Andel anonyme (%)', template: KPI_ANONYMOUS_SHARE },
  { catalogId: 'line-received-over-time', category: 'Trend', label: 'Mottatte over tid', template: LINE_RECEIVED },
  { catalogId: 'line-closed-over-time', category: 'Trend', label: 'Lukkede over tid', template: LINE_CLOSED },
  { catalogId: 'donut-status', category: 'Diagrammer', label: 'Status — kakediagram', template: DONUT_STATUS },
  { catalogId: 'donut-kind', category: 'Diagrammer', label: 'Type — kakediagram', template: DONUT_KIND },
  { catalogId: 'donut-severity', category: 'Diagrammer', label: 'Alvorlighet — kakediagram', template: DONUT_SEVERITY },
  { catalogId: 'donut-anonymity', category: 'Anonymitet', label: 'Anonymitet — kakediagram', template: DONUT_ANONYMITY },
  { catalogId: 'donut-ack-compliance', category: 'Etterlevelse', label: 'Bekreftelse innen frist', template: DONUT_ACK_COMPLIANCE },
  { catalogId: 'donut-gdpr-72h', category: 'Etterlevelse', label: 'GDPR 72-timersfrist', template: DONUT_GDPR_72H },
  { catalogId: 'bar-template', category: 'Diagrammer', label: 'Mest brukte maler', template: BAR_TEMPLATE },
  { catalogId: 'bar-category', category: 'Diagrammer', label: 'Per kategori', template: BAR_CATEGORY },
  { catalogId: 'donut-location', category: 'Org-kontekst', label: 'Per lokasjon', template: DONUT_LOCATION },
  { catalogId: 'donut-department', category: 'Org-kontekst', label: 'Per avdeling', template: DONUT_DEPARTMENT },
  { catalogId: 'table-law-refs', category: 'Etterlevelse', label: 'Lovreferanser dekket', template: TABLE_LAW_REFS },
  { catalogId: 'donut-retention', category: 'Etterlevelse', label: 'Kommende sletting', template: DONUT_RETENTION },
]

registerDashboardScope({
  scopeId: ALERTS_DASHBOARD_SCOPE_ID,
  label: 'Varslinger',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  dimensions: DIMENSIONS,
  accent: ALERTS_ACCENT,
})
