// Compliance — Selskap (company-wide compliance dashboard scope).
//
// 10. registrerte scope. Aggregerer på tvers av alle moduler via
// org_role_requirement_instances + role_compliance_requirements_view.
// Brukes på HMS-oversikt > Compliance > Selskap.

import type {
  ReportModule,
  ReportModuleBar,
  ReportModuleDonut,
  ReportModuleKpi,
  ReportModuleTable,
  ReportModuleHeatmap,
} from '../../../types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'
import type { DatasetsHookDeps } from '../../../lib/dashboards/dashboardRegistry'
import { useComplianceCompanyDatasets } from './useComplianceDatasets'

function useComplianceCompanyDatasetsForReports(deps: DatasetsHookDeps): Record<string, unknown> {
  return useComplianceCompanyDatasets(deps.filters)
}

export const COMPLIANCE_COMPANY_SCOPE_ID = 'compliance_company'

const DATASETS: DatasetMeta[] = [
  { key: 'cc_kpi_summary', label: 'KPI-sammendrag', shape: 'kpi-record' },
  { key: 'cc_kind_distribution', label: 'Krav etter type', shape: 'segments' },
  { key: 'cc_status_distribution', label: 'Status-fordeling', shape: 'segments' },
  { key: 'cc_severity_distribution', label: 'Alvorlighets-fordeling', shape: 'segments' },
  { key: 'cc_role_status_heatmap', label: 'Rolle × status varmekart', shape: 'rows' },
  { key: 'cc_overdue_table', label: 'Forfalt — detalj', shape: 'rows' },
  { key: 'cc_unmapped_requirements', label: 'Ikke-dekkede lovkrav', shape: 'rows' },
  { key: 'cc_modules_coverage', label: 'Modul-dekning per krav', shape: 'rows' },
  { key: 'cc_modules_health', label: 'Modul-helse selskap-bredt', shape: 'rows' },
]

const KPI_TOTAL: ReportModuleKpi = {
  id: 'kpi-total', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Krav totalt', valuePath: 'total', subtitle: 'Aktive krav på tvers av moduler', colSpan: 'sm',
}
const KPI_COMPLETED: ReportModuleKpi = {
  id: 'kpi-completed', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Oppfylt', valuePath: 'completed', subtitle: '% av totale', colSpan: 'sm',
}
const KPI_OVERDUE: ReportModuleKpi = {
  id: 'kpi-overdue', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Forfalt', valuePath: 'overdue', subtitle: 'Krever umiddelbar handling', colSpan: 'sm',
}
const KPI_CRITICAL: ReportModuleKpi = {
  id: 'kpi-critical', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Kritiske åpne', valuePath: 'criticalOpen', subtitle: 'Severity = high/critical', colSpan: 'sm',
}
const KPI_UNMAPPED: ReportModuleKpi = {
  id: 'kpi-unmapped', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Ikke-dekkede lovkrav', valuePath: 'unmappedCount', subtitle: 'Gaps fra inventory', colSpan: 'sm',
}
const KPI_COMPLIANCE_PCT: ReportModuleKpi = {
  id: 'kpi-compliance-pct', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Compliance-grad', valuePath: 'complianceRate', subtitle: 'Oppfylt / totalt × 100',
  colSpan: 'sm',
}
const KPI_BREACH_ACTIVE: ReportModuleKpi = {
  id: 'kpi-breach-active', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Aktive GDPR-brudd', valuePath: 'breachActive',
  subtitle: 'Detected + investigating', colSpan: 'sm',
}
const KPI_BREACH_OVERDUE: ReportModuleKpi = {
  id: 'kpi-breach-overdue', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Brudd over 72t', valuePath: 'breachOverdue',
  subtitle: 'KRITISK — Art. 33 brutt', colSpan: 'sm',
}
const KPI_BREACH_DUE_24H: ReportModuleKpi = {
  id: 'kpi-breach-due-24h', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Brudd forfaller < 24t', valuePath: 'breachDueWithin24h',
  subtitle: 'Haster rapportering', colSpan: 'sm',
}

// ── Cross-modul KPIs (selskap-bredt, ikke kun rolle-basert) ──────────────
const KPI_LEARNING_RATE: ReportModuleKpi = {
  id: 'kpi-learning-rate', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Opplæring fullført %', valuePath: 'learningRate',
  subtitle: 'Av alle ansatte × kurs', colSpan: 'sm',
}
const KPI_DOCS_ACK_RATE: ReportModuleKpi = {
  id: 'kpi-docs-ack-rate', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Dokument-kvittering %', valuePath: 'docsAckRate',
  subtitle: 'Acks ÷ ansatte × dokumenter', colSpan: 'sm',
}
const KPI_CHECKLISTS_COMPLETION: ReportModuleKpi = {
  id: 'kpi-checklists-rate', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Sjekklister signert %', valuePath: 'checklistsCompletionRate',
  subtitle: 'aml-amu + iso-45001', colSpan: 'sm',
}
const KPI_ROS_APPROVAL: ReportModuleKpi = {
  id: 'kpi-ros-approval', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'ROS godkjent %', valuePath: 'rosApprovalRate',
  subtitle: 'Approved ÷ totalt', colSpan: 'sm',
}
const KPI_TASKS_OPEN: ReportModuleKpi = {
  id: 'kpi-tasks-open', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Avvik åpne', valuePath: 'tasksOpen',
  subtitle: 'Tasks med status != done', colSpan: 'sm',
}
const KPI_TASKS_OVERDUE: ReportModuleKpi = {
  id: 'kpi-tasks-overdue', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Avvik forfalt', valuePath: 'tasksOverdue',
  subtitle: 'Krever umiddelbar handling', colSpan: 'sm',
}
const KPI_EMPLOYEES: ReportModuleKpi = {
  id: 'kpi-employees', kind: 'kpi', datasetKey: 'cc_kpi_summary',
  title: 'Ansatte', valuePath: 'employeeCount',
  subtitle: 'Org-medlemmer totalt', colSpan: 'sm',
}

const TABLE_MODULES_HEALTH: ReportModuleTable = {
  id: 'table-modules-health',
  kind: 'table',
  datasetKey: 'cc_modules_health',
  title: 'Modul-helse — selskap-bredt',
  rowKeys: ['module', 'total', 'completed', 'gap', 'overdueOrExpired', 'coveragePct'],
  colSpan: 'full',
}

const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status', kind: 'donut', datasetKey: 'cc_status_distribution',
  title: 'Status-fordeling', segmentsPath: '', colSpan: 'md',
}
const DONUT_KIND: ReportModuleDonut = {
  id: 'donut-kind', kind: 'donut', datasetKey: 'cc_kind_distribution',
  title: 'Krav etter type', segmentsPath: '', colSpan: 'md',
}
const BAR_SEVERITY: ReportModuleBar = {
  id: 'bar-severity', kind: 'bar', datasetKey: 'cc_severity_distribution',
  title: 'Alvorlighet', seriesKeys: [], colSpan: 'md',
}
const HEATMAP_ROLE_STATUS: ReportModuleHeatmap = {
  id: 'heatmap-role-status', kind: 'heatmap', datasetKey: 'cc_role_status_heatmap',
  title: 'Rolle × status — varmekart', valueLabel: 'Antall', valueMin: 0, colSpan: 'lg',
}

const TABLE_OVERDUE: ReportModuleTable = {
  id: 'table-overdue', kind: 'table', datasetKey: 'cc_overdue_table',
  title: 'Forfalt — detalj',
  rowKeys: ['user', 'role', 'kind', 'resource', 'daysOverdue', 'hjemmel'],
  colSpan: 'lg',
}
const TABLE_UNMAPPED: ReportModuleTable = {
  id: 'table-unmapped', kind: 'table', datasetKey: 'cc_unmapped_requirements',
  title: 'Ikke-dekkede lovkrav (fra inventory)',
  rowKeys: ['lovkrav', 'omrade', 'foreslattMal', 'prioritet'],
  colSpan: 'lg',
}
const TABLE_MODULES: ReportModuleTable = {
  id: 'table-modules', kind: 'table', datasetKey: 'cc_modules_coverage',
  title: 'Krav per modul med ansvarlig',
  rowKeys: ['kind', 'totalRequirements', 'completed', 'overdue', 'topOwners'],
  colSpan: 'md',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  // Selskap-bredt aggregat (cross-modul)
  KPI_TOTAL, KPI_COMPLETED, KPI_OVERDUE, KPI_COMPLIANCE_PCT,
  KPI_EMPLOYEES, KPI_UNMAPPED, KPI_CRITICAL,
  // Per-modul completion rates
  KPI_LEARNING_RATE, KPI_DOCS_ACK_RATE, KPI_CHECKLISTS_COMPLETION, KPI_ROS_APPROVAL,
  KPI_TASKS_OPEN, KPI_TASKS_OVERDUE,
  // GDPR-spesifikt
  KPI_BREACH_ACTIVE, KPI_BREACH_OVERDUE, KPI_BREACH_DUE_24H,
  // Modul-helse-tabell — øverst slik at compliance officer ser status per modul
  TABLE_MODULES_HEALTH,
  // Diagrammer fra rolle-instanser
  DONUT_STATUS, DONUT_KIND, BAR_SEVERITY,
  HEATMAP_ROLE_STATUS,
  TABLE_OVERDUE, TABLE_MODULES, TABLE_UNMAPPED,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-total', category: 'Volum', label: 'Krav totalt', template: KPI_TOTAL },
  { catalogId: 'kpi-completed', category: 'Volum', label: 'Oppfylt', template: KPI_COMPLETED },
  { catalogId: 'kpi-overdue', category: 'Risiko', label: 'Forfalt', template: KPI_OVERDUE },
  { catalogId: 'kpi-critical', category: 'Risiko', label: 'Kritiske åpne', template: KPI_CRITICAL },
  { catalogId: 'kpi-unmapped', category: 'Risiko', label: 'Ikke-dekkede lovkrav', template: KPI_UNMAPPED },
  { catalogId: 'kpi-compliance-pct', category: 'Volum', label: 'Compliance-grad', template: KPI_COMPLIANCE_PCT },
  { catalogId: 'kpi-breach-active', category: 'GDPR', label: 'Aktive GDPR-brudd', template: KPI_BREACH_ACTIVE },
  { catalogId: 'kpi-breach-overdue', category: 'GDPR', label: 'Brudd over 72t', template: KPI_BREACH_OVERDUE },
  { catalogId: 'kpi-breach-due-24h', category: 'GDPR', label: 'Brudd forfaller < 24t', template: KPI_BREACH_DUE_24H },
  { catalogId: 'kpi-learning-rate', category: 'Modul-helse', label: 'Opplæring fullført %', template: KPI_LEARNING_RATE },
  { catalogId: 'kpi-docs-ack-rate', category: 'Modul-helse', label: 'Dokument-kvittering %', template: KPI_DOCS_ACK_RATE },
  { catalogId: 'kpi-checklists-rate', category: 'Modul-helse', label: 'Sjekklister signert %', template: KPI_CHECKLISTS_COMPLETION },
  { catalogId: 'kpi-ros-approval', category: 'Modul-helse', label: 'ROS godkjent %', template: KPI_ROS_APPROVAL },
  { catalogId: 'kpi-tasks-open', category: 'Modul-helse', label: 'Avvik åpne', template: KPI_TASKS_OPEN },
  { catalogId: 'kpi-tasks-overdue', category: 'Modul-helse', label: 'Avvik forfalt', template: KPI_TASKS_OVERDUE },
  { catalogId: 'kpi-employees', category: 'Volum', label: 'Ansatte totalt', template: KPI_EMPLOYEES },
  { catalogId: 'table-modules-health', category: 'Modul-helse', label: 'Modul-helse selskap-bredt', template: TABLE_MODULES_HEALTH },
  { catalogId: 'donut-status', category: 'Diagrammer', label: 'Status-fordeling', template: DONUT_STATUS },
  { catalogId: 'donut-kind', category: 'Diagrammer', label: 'Krav etter type', template: DONUT_KIND },
  { catalogId: 'bar-severity', category: 'Diagrammer', label: 'Alvorlighet', template: BAR_SEVERITY },
  { catalogId: 'heatmap-role-status', category: 'Compliance', label: 'Rolle × status varmekart', template: HEATMAP_ROLE_STATUS },
  { catalogId: 'table-overdue', category: 'Tabeller', label: 'Forfalt detaljert', template: TABLE_OVERDUE },
  { catalogId: 'table-unmapped', category: 'Tabeller', label: 'Ikke-dekkede lovkrav', template: TABLE_UNMAPPED },
  { catalogId: 'table-modules', category: 'Tabeller', label: 'Modul-dekning', template: TABLE_MODULES },
]

registerDashboardScope({
  scopeId: COMPLIANCE_COMPANY_SCOPE_ID,
  label: 'Compliance — selskap',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  // Dyp rød — kompromissløs «selskaps-compliance»-signal
  accent: '#991b1b',
  datasetsHook: useComplianceCompanyDatasetsForReports,
})
