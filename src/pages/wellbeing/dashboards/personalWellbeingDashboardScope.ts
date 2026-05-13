// Arbeidsmiljøstrategi — personlig speil (Min trivsel).
//
// Samme akser som org-flaten, men sett gjennom «hva er mitt»: hva har
// jeg utestående, hvor blir min stemme bedt om, hva må jeg lære. Vi
// viser ikke individuelle psykososial-svar (AML § 4-3 anonymitet) —
// trivsels-aksen rapporterer kun deltakelse + tilgang til kanaler.
//
// Accent: #0d9488 (teal-600) — mykt og personlig, distinkt fra org-
// flatens amber (#d97706) og olive-fargen til Min compliance.

import type {
  ReportModule,
  ReportModuleDonut,
  ReportModuleKpi,
  ReportModuleTable,
} from '../../../types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'

export const PERSONAL_WELLBEING_SCOPE_ID = 'worker_wellbeing_personal'

const DATASETS: DatasetMeta[] = [
  { key: 'pwb_kpi_summary', label: 'Min trivsel — KPI', shape: 'kpi-record' },
  { key: 'pwb_axis_axis_distribution', label: 'Aktivitet per akse', shape: 'segments' },
  { key: 'pwb_pending_surveys', label: 'Undersøkelser jeg er invitert til', shape: 'rows' },
  { key: 'pwb_open_courses', label: 'Mine åpne kurs', shape: 'rows' },
  { key: 'pwb_expiring_certificates', label: 'Sertifikater som utløper', shape: 'rows' },
  { key: 'pwb_my_focus_areas', label: 'Fokusområder dette året', shape: 'rows' },
]

const KPI_PENDING_SURVEYS: ReportModuleKpi = {
  id: 'kpi-pwb-pending-surveys', kind: 'kpi', datasetKey: 'pwb_kpi_summary',
  title: 'Mine undersøkelser', valuePath: 'pendingSurveys',
  subtitle: 'Inviterte men ubesvarte', colSpan: 'sm',
}
const KPI_OPEN_COURSES: ReportModuleKpi = {
  id: 'kpi-pwb-open-courses', kind: 'kpi', datasetKey: 'pwb_kpi_summary',
  title: 'Mine kurs', valuePath: 'openCourses',
  subtitle: 'Påbegynt eller tildelt', colSpan: 'sm',
}
const KPI_COMPLETED_YTD: ReportModuleKpi = {
  id: 'kpi-pwb-completed-ytd', kind: 'kpi', datasetKey: 'pwb_kpi_summary',
  title: 'Fullført i år', valuePath: 'completedYtd',
  subtitle: 'Læring · YTD', colSpan: 'sm',
}
const KPI_EXPIRING: ReportModuleKpi = {
  id: 'kpi-pwb-expiring', kind: 'kpi', datasetKey: 'pwb_kpi_summary',
  title: 'Utløper snart', valuePath: 'expiringSoon',
  subtitle: 'Sertifikater · 90 dg', colSpan: 'sm',
}

const DONUT_AXIS: ReportModuleDonut = {
  id: 'donut-pwb-axis', kind: 'donut', datasetKey: 'pwb_axis_axis_distribution',
  title: 'Mine signaler per akse', segmentsPath: '', colSpan: 'md',
}

const TABLE_PENDING: ReportModuleTable = {
  id: 'table-pwb-pending', kind: 'table', datasetKey: 'pwb_pending_surveys',
  title: 'Undersøkelser jeg kan svare på',
  rowKeys: ['title', 'pack', 'closesAt', 'action'],
  colSpan: 'full',
}
const TABLE_COURSES: ReportModuleTable = {
  id: 'table-pwb-courses', kind: 'table', datasetKey: 'pwb_open_courses',
  title: 'Mine åpne kurs',
  rowKeys: ['title', 'progress', 'modulesLeft', 'action'],
  colSpan: 'lg',
}
const TABLE_CERTS: ReportModuleTable = {
  id: 'table-pwb-certs', kind: 'table', datasetKey: 'pwb_expiring_certificates',
  title: 'Sertifikater som nærmer seg utløp',
  rowKeys: ['title', 'issuedAt', 'expiresAt', 'daysLeft'],
  colSpan: 'lg',
}
const TABLE_FOCUS: ReportModuleTable = {
  id: 'table-pwb-focus', kind: 'table', datasetKey: 'pwb_my_focus_areas',
  title: 'Hva organisasjonen jobber mot i år',
  rowKeys: ['axis', 'title', 'target'],
  colSpan: 'full',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_PENDING_SURVEYS, KPI_OPEN_COURSES, KPI_COMPLETED_YTD, KPI_EXPIRING,
  DONUT_AXIS,
  TABLE_PENDING,
  TABLE_COURSES,
  TABLE_CERTS,
  TABLE_FOCUS,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-pwb-pending-surveys', category: 'Min stemme', label: 'Mine undersøkelser', template: KPI_PENDING_SURVEYS },
  { catalogId: 'kpi-pwb-open-courses', category: 'Min mestring', label: 'Mine kurs', template: KPI_OPEN_COURSES },
  { catalogId: 'kpi-pwb-completed-ytd', category: 'Min mestring', label: 'Fullført i år', template: KPI_COMPLETED_YTD },
  { catalogId: 'kpi-pwb-expiring', category: 'Min mestring', label: 'Sertifikater utløper', template: KPI_EXPIRING },
  { catalogId: 'donut-pwb-axis', category: 'Diagrammer', label: 'Signaler per akse', template: DONUT_AXIS },
  { catalogId: 'table-pwb-pending', category: 'Tabeller', label: 'Undersøkelser jeg kan svare på', template: TABLE_PENDING },
  { catalogId: 'table-pwb-courses', category: 'Tabeller', label: 'Mine åpne kurs', template: TABLE_COURSES },
  { catalogId: 'table-pwb-certs', category: 'Tabeller', label: 'Sertifikater som utløper', template: TABLE_CERTS },
  { catalogId: 'table-pwb-focus', category: 'Tabeller', label: 'Fokusområder fra strategien', template: TABLE_FOCUS },
]

registerDashboardScope({
  scopeId: PERSONAL_WELLBEING_SCOPE_ID,
  label: 'Min trivsel',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  accent: '#0d9488',
})
