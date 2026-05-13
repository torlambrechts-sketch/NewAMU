// Compliance — Min compliance (personlig dashboard scope).
//
// 11. registrerte scope. Viser brukerens egne krav på tvers av roller
// vedkommende har. Brukes av alle ansatte; admin har egen visning.

import type {
  ReportModule,
  ReportModuleBar,
  ReportModuleDonut,
  ReportModuleKpi,
  ReportModuleTable,
} from '../../../types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'
import { useCompliancePersonalDatasets } from './useComplianceDatasets'

function useCompliancePersonalDatasetsForReports(): Record<string, unknown> {
  return useCompliancePersonalDatasets()
}

export const COMPLIANCE_PERSONAL_SCOPE_ID = 'compliance_personal'

const DATASETS: DatasetMeta[] = [
  { key: 'cp_kpi_summary', label: 'KPI-sammendrag', shape: 'kpi-record' },
  { key: 'cp_status_distribution', label: 'Status-fordeling', shape: 'segments' },
  { key: 'cp_kind_distribution', label: 'Krav etter type', shape: 'segments' },
  { key: 'cp_my_roles', label: 'Mine roller', shape: 'segments' },
  { key: 'cp_open_table', label: 'Åpne krav', shape: 'rows' },
  { key: 'cp_completed_table', label: 'Oppfylte krav', shape: 'rows' },
]

const KPI_OPEN: ReportModuleKpi = {
  id: 'kpi-open', kind: 'kpi', datasetKey: 'cp_kpi_summary',
  title: 'Åpne krav', valuePath: 'open', subtitle: 'Krever handling fra deg', colSpan: 'sm',
}
const KPI_OVERDUE: ReportModuleKpi = {
  id: 'kpi-overdue', kind: 'kpi', datasetKey: 'cp_kpi_summary',
  title: 'Forfalt', valuePath: 'overdue', subtitle: 'Frist passert', colSpan: 'sm',
}
const KPI_DUE_SOON: ReportModuleKpi = {
  id: 'kpi-due-soon', kind: 'kpi', datasetKey: 'cp_kpi_summary',
  title: 'Forfaller snart', valuePath: 'dueSoon', subtitle: '< 14 dager', colSpan: 'sm',
}
const KPI_COMPLETED: ReportModuleKpi = {
  id: 'kpi-completed', kind: 'kpi', datasetKey: 'cp_kpi_summary',
  title: 'Oppfylt', valuePath: 'completed', subtitle: 'Bestått / kvittert / signert', colSpan: 'sm',
}

const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status', kind: 'donut', datasetKey: 'cp_status_distribution',
  title: 'Mine krav — status', segmentsPath: '', colSpan: 'md',
}
const BAR_KIND: ReportModuleBar = {
  id: 'bar-kind', kind: 'bar', datasetKey: 'cp_kind_distribution',
  title: 'Mine krav etter type', seriesKeys: [], colSpan: 'md',
}
const BAR_ROLES: ReportModuleBar = {
  id: 'bar-my-roles', kind: 'bar', datasetKey: 'cp_my_roles',
  title: 'Mine funksjonelle roller', seriesKeys: [], colSpan: 'md',
}

const TABLE_OPEN: ReportModuleTable = {
  id: 'table-open', kind: 'table', datasetKey: 'cp_open_table',
  title: 'Åpne krav — handle nå',
  rowKeys: ['role', 'kind', 'resource', 'dueAt', 'daysUntilDue', 'severity'],
  colSpan: 'full',
}
const TABLE_COMPLETED: ReportModuleTable = {
  id: 'table-completed', kind: 'table', datasetKey: 'cp_completed_table',
  title: 'Oppfylt — historikk',
  rowKeys: ['role', 'kind', 'resource', 'completedAt'],
  colSpan: 'lg',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_OPEN, KPI_OVERDUE, KPI_DUE_SOON, KPI_COMPLETED,
  DONUT_STATUS, BAR_KIND, BAR_ROLES,
  TABLE_OPEN, TABLE_COMPLETED,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-open', category: 'Volum', label: 'Åpne krav', template: KPI_OPEN },
  { catalogId: 'kpi-overdue', category: 'Risiko', label: 'Forfalt', template: KPI_OVERDUE },
  { catalogId: 'kpi-due-soon', category: 'Risiko', label: 'Forfaller snart', template: KPI_DUE_SOON },
  { catalogId: 'kpi-completed', category: 'Volum', label: 'Oppfylt', template: KPI_COMPLETED },
  { catalogId: 'donut-status', category: 'Diagrammer', label: 'Status-donut', template: DONUT_STATUS },
  { catalogId: 'bar-kind', category: 'Diagrammer', label: 'Krav etter type', template: BAR_KIND },
  { catalogId: 'bar-my-roles', category: 'Diagrammer', label: 'Mine roller', template: BAR_ROLES },
  { catalogId: 'table-open', category: 'Tabeller', label: 'Åpne krav', template: TABLE_OPEN },
  { catalogId: 'table-completed', category: 'Tabeller', label: 'Oppfylt-historikk', template: TABLE_COMPLETED },
]

registerDashboardScope({
  scopeId: COMPLIANCE_PERSONAL_SCOPE_ID,
  label: 'Min compliance',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  // Olive — personlig, mindre dramatisk enn rød
  accent: '#65a30d',
  datasetsHook: useCompliancePersonalDatasetsForReports,
})
