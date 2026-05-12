// Role compliance dashboard scope.
//
// Niende registered scope etter compliance / survey / tasks / learning /
// documents / meetings / registers / hms_overview. Gjenbruker eksisterende
// widget-kinder (kpi/table/bar/donut/heatmap) og fôres av
// useRoleComplianceDatasets — som joiner training_matrix_view +
// org_active_role_holders + functional_roles.
//
// Brukes på AdminPage > Funksjonelle roller > Compliance-oversikt-fanen.

import type {
  ReportModule,
  ReportModuleBar,
  ReportModuleDonut,
  ReportModuleHeatmap,
  ReportModuleKpi,
  ReportModuleTable,
} from '../../../types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'

export const ROLE_COMPLIANCE_DASHBOARD_SCOPE_ID = 'role_compliance'

const DATASETS: DatasetMeta[] = [
  { key: 'role_compliance_kpi_summary', label: 'KPI-sammendrag', shape: 'kpi-record' },
  { key: 'role_compliance_status_distribution', label: 'Status-fordeling', shape: 'segments' },
  { key: 'role_compliance_role_distribution', label: 'Innehavere per rolle', shape: 'segments' },
  { key: 'role_compliance_kind_distribution', label: 'Krav per type', shape: 'segments' },
  { key: 'role_compliance_top_gaps', label: 'Største mangler — tabell', shape: 'rows' },
  { key: 'role_compliance_overdue_persons', label: 'Personer med forfalt', shape: 'rows' },
  { key: 'role_compliance_role_x_course_heatmap', label: 'Rolle × kurs — varmekart', shape: 'rows' },
  { key: 'role_compliance_threshold_violations', label: 'Terskel-brudd (mangler innehavere)', shape: 'rows' },
]

const KPI_TOTAL_ROLES: ReportModuleKpi = {
  id: 'kpi-roles-active',
  kind: 'kpi',
  datasetKey: 'role_compliance_kpi_summary',
  title: 'Aktive funksjonelle roller',
  valuePath: 'activeRoles',
  subtitle: 'Av 16 mulige',
  colSpan: 'sm',
}
const KPI_ASSIGNMENTS: ReportModuleKpi = {
  id: 'kpi-assignments',
  kind: 'kpi',
  datasetKey: 'role_compliance_kpi_summary',
  title: 'Rolle-tildelinger',
  valuePath: 'totalAssignments',
  subtitle: 'Aktive innehavere totalt',
  colSpan: 'sm',
}
const KPI_COMPLETED: ReportModuleKpi = {
  id: 'kpi-completed',
  kind: 'kpi',
  datasetKey: 'role_compliance_kpi_summary',
  title: 'Bestått opplæring',
  valuePath: 'trainingCompleted',
  subtitle: 'Av krav som har data',
  colSpan: 'sm',
}
const KPI_OVERDUE: ReportModuleKpi = {
  id: 'kpi-overdue',
  kind: 'kpi',
  datasetKey: 'role_compliance_kpi_summary',
  title: 'Forfalt',
  valuePath: 'trainingOverdue',
  subtitle: 'Krever oppfølging',
  colSpan: 'sm',
}
const KPI_EXPIRING: ReportModuleKpi = {
  id: 'kpi-expiring-soon',
  kind: 'kpi',
  datasetKey: 'role_compliance_kpi_summary',
  title: 'Utløper snart',
  valuePath: 'trainingExpiringSoon',
  subtitle: '< 60 dager til resertifisering',
  colSpan: 'sm',
}
const KPI_THRESHOLD: ReportModuleKpi = {
  id: 'kpi-threshold-violations',
  kind: 'kpi',
  datasetKey: 'role_compliance_kpi_summary',
  title: 'Terskel-brudd',
  valuePath: 'thresholdViolations',
  subtitle: 'Pliktige roller mangler innehaver',
  colSpan: 'sm',
}

const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status',
  kind: 'donut',
  datasetKey: 'role_compliance_status_distribution',
  title: 'Opplærings-status — fordeling',
  segmentsPath: '',
  colSpan: 'md',
}

const BAR_ROLE_DIST: ReportModuleBar = {
  id: 'bar-role-dist',
  kind: 'bar',
  datasetKey: 'role_compliance_role_distribution',
  title: 'Innehavere per rolle',
  seriesKeys: [],
  colSpan: 'md',
}

const BAR_KIND: ReportModuleBar = {
  id: 'bar-kind',
  kind: 'bar',
  datasetKey: 'role_compliance_kind_distribution',
  title: 'Krav etter type',
  seriesKeys: [],
  colSpan: 'md',
}

const HEATMAP_ROLE_X_COURSE: ReportModuleHeatmap = {
  id: 'heatmap-role-course',
  kind: 'heatmap',
  datasetKey: 'role_compliance_role_x_course_heatmap',
  title: 'Rolle × kurs — fullførings-rate',
  valueLabel: 'Fullført %',
  valueMin: 0,
  valueMax: 100,
  colSpan: 'lg',
}

const TABLE_TOP_GAPS: ReportModuleTable = {
  id: 'table-top-gaps',
  kind: 'table',
  datasetKey: 'role_compliance_top_gaps',
  title: 'Største mangler — krav per rolle',
  rowsPath: '',
  columns: [
    { key: 'role', label: 'Rolle' },
    { key: 'course', label: 'Krav' },
    { key: 'missingCount', label: 'Mangler' },
    { key: 'totalCount', label: 'Av' },
  ],
  colSpan: 'md',
}

const TABLE_OVERDUE: ReportModuleTable = {
  id: 'table-overdue',
  kind: 'table',
  datasetKey: 'role_compliance_overdue_persons',
  title: 'Personer med forfalt opplæring',
  rowsPath: '',
  columns: [
    { key: 'name', label: 'Person' },
    { key: 'role', label: 'Rolle' },
    { key: 'course', label: 'Kurs' },
    { key: 'daysOverdue', label: 'Dager forfalt' },
  ],
  colSpan: 'md',
}

const TABLE_THRESHOLD: ReportModuleTable = {
  id: 'table-threshold-violations',
  kind: 'table',
  datasetKey: 'role_compliance_threshold_violations',
  title: 'Terskel-brudd — mangler rolle-innehavere',
  rowsPath: '',
  columns: [
    { key: 'role', label: 'Rolle' },
    { key: 'requiredFrom', label: 'Pliktig fra ansatte' },
    { key: 'currentEmployees', label: 'Vi har' },
    { key: 'currentHolders', label: 'Innehavere' },
  ],
  colSpan: 'md',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_TOTAL_ROLES,
  KPI_ASSIGNMENTS,
  KPI_COMPLETED,
  KPI_OVERDUE,
  KPI_EXPIRING,
  KPI_THRESHOLD,
  DONUT_STATUS,
  BAR_ROLE_DIST,
  BAR_KIND,
  HEATMAP_ROLE_X_COURSE,
  TABLE_TOP_GAPS,
  TABLE_OVERDUE,
  TABLE_THRESHOLD,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-roles-active', category: 'Volum', label: 'Aktive funksjonelle roller', template: KPI_TOTAL_ROLES },
  { catalogId: 'kpi-assignments', category: 'Volum', label: 'Rolle-tildelinger', template: KPI_ASSIGNMENTS },
  { catalogId: 'kpi-completed', category: 'Opplæring', label: 'Bestått opplæring', template: KPI_COMPLETED },
  { catalogId: 'kpi-overdue', category: 'Risiko', label: 'Forfalt opplæring', template: KPI_OVERDUE },
  { catalogId: 'kpi-expiring-soon', category: 'Risiko', label: 'Utløper snart', template: KPI_EXPIRING },
  { catalogId: 'kpi-threshold-violations', category: 'Risiko', label: 'Terskel-brudd', template: KPI_THRESHOLD },
  { catalogId: 'donut-status', category: 'Diagrammer', label: 'Status-fordeling', template: DONUT_STATUS },
  { catalogId: 'bar-role-dist', category: 'Diagrammer', label: 'Innehavere per rolle', template: BAR_ROLE_DIST },
  { catalogId: 'bar-kind', category: 'Diagrammer', label: 'Krav etter type', template: BAR_KIND },
  { catalogId: 'heatmap-role-course', category: 'Compliance', label: 'Rolle × kurs varmekart', template: HEATMAP_ROLE_X_COURSE },
  { catalogId: 'table-top-gaps', category: 'Tabeller', label: 'Største mangler', template: TABLE_TOP_GAPS },
  { catalogId: 'table-overdue', category: 'Tabeller', label: 'Forfalt — personer', template: TABLE_OVERDUE },
  { catalogId: 'table-threshold-violations', category: 'Tabeller', label: 'Terskel-brudd', template: TABLE_THRESHOLD },
]

registerDashboardScope({
  scopeId: ROLE_COMPLIANCE_DASHBOARD_SCOPE_ID,
  label: 'Rolle-compliance',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  // Mørk magenta — distinkt fra både learning (#0e7490 teal) og
  // documents (#0f766e deep teal) så scopen står tydelig i HMS-oversikten.
  accent: '#a21caf',
})
