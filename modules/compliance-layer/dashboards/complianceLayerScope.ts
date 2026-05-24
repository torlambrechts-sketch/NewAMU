// Compliance Layer analytics scope registration.
//
// Registers `compliance_layer` with the dashboard registry. Following
// the pattern from `complianceDashboardScope.ts` / `tasksDashboardScope.ts`:
// scope metadata is static (no Supabase dependency) so the file is safe
// to import as a side-effect from `ComplianceLayerAnalysePage.tsx`.

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

export const COMPLIANCE_LAYER_SCOPE_ID = 'compliance_layer'

const DATASETS: DatasetMeta[] = [
  {
    key: 'controls_kpi_summary',
    label: 'KPI — kontrollstatus',
    shape: 'kpi-record',
  },
  {
    key: 'controls_status_distribution',
    label: 'Kontroller per status',
    shape: 'segments',
  },
  {
    key: 'controls_by_regulation',
    label: 'Kontroller per regelverk',
    shape: 'segments',
  },
  {
    key: 'controls_by_family',
    label: 'Kontroller per familie',
    shape: 'segments',
  },
  {
    key: 'controls_executions_over_time',
    label: 'Bevisrader over tid',
    shape: 'series',
  },
  {
    key: 'controls_overdue_table',
    label: 'Forfalte kontroller',
    shape: 'rows',
  },
  {
    key: 'controls_kpi_summary_prev',
    label: 'KPI — forrige periode',
    shape: 'kpi-record',
  },
]

const KPI_TOTAL: Omit<ReportModuleKpi, 'id'> = {
  kind: 'kpi',
  title: 'Totalt antall kontroller',
  datasetKey: 'controls_kpi_summary',
  valuePath: 'total',
  colSpan: 'sm',
}

const KPI_OVERDUE: Omit<ReportModuleKpi, 'id'> = {
  kind: 'kpi',
  title: 'Forfalt',
  datasetKey: 'controls_kpi_summary',
  valuePath: 'overdue',
  colSpan: 'sm',
  comparisonGoal: 'decrease',
}

const KPI_DUE_SOON: Omit<ReportModuleKpi, 'id'> = {
  kind: 'kpi',
  title: 'Forfaller snart',
  datasetKey: 'controls_kpi_summary',
  valuePath: 'due_soon',
  colSpan: 'sm',
  comparisonGoal: 'decrease',
}

const KPI_ON_TRACK: Omit<ReportModuleKpi, 'id'> = {
  kind: 'kpi',
  title: 'På sporet',
  datasetKey: 'controls_kpi_summary',
  valuePath: 'on_track',
  colSpan: 'sm',
  comparisonGoal: 'increase',
}

const DONUT_STATUS: Omit<ReportModuleDonut, 'id'> = {
  kind: 'donut',
  title: 'Kontroller per status',
  datasetKey: 'controls_status_distribution',
  segmentsPath: '',
  colSpan: 'md',
  drillDimensionId: 'status',
}

const DONUT_REGULATION: Omit<ReportModuleDonut, 'id'> = {
  kind: 'donut',
  title: 'Kontroller per regelverk',
  datasetKey: 'controls_by_regulation',
  segmentsPath: '',
  colSpan: 'md',
  drillDimensionId: 'regulation',
}

const BAR_FAMILY: Omit<ReportModuleBar, 'id'> = {
  kind: 'bar',
  title: 'Kontroller per familie',
  datasetKey: 'controls_by_family',
  seriesKeys: [],
  colSpan: 'md',
  drillDimensionId: 'control_family',
}

const LINE_EXECUTIONS: Omit<ReportModuleLine, 'id'> = {
  kind: 'line',
  title: 'Bevisrader over tid',
  datasetKey: 'controls_executions_over_time',
  pointsPath: '',
  colSpan: 'lg',
}

const TABLE_OVERDUE: Omit<ReportModuleTable, 'id'> = {
  kind: 'table',
  title: 'Forfalte kontroller',
  datasetKey: 'controls_overdue_table',
  rowKeys: ['navn', 'ansvarlig', 'frekvens', 'sist_utfort', 'frist'],
  colSpan: 'full',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  { ...(KPI_TOTAL as ReportModule), id: 'default-kpi-total' },
  { ...(KPI_OVERDUE as ReportModule), id: 'default-kpi-overdue' },
  { ...(KPI_DUE_SOON as ReportModule), id: 'default-kpi-due-soon' },
  { ...(KPI_ON_TRACK as ReportModule), id: 'default-kpi-on-track' },
  { ...(DONUT_STATUS as ReportModule), id: 'default-donut-status' },
  { ...(DONUT_REGULATION as ReportModule), id: 'default-donut-regulation' },
  { ...(BAR_FAMILY as ReportModule), id: 'default-bar-family' },
  { ...(LINE_EXECUTIONS as ReportModule), id: 'default-line-executions' },
  { ...(TABLE_OVERDUE as ReportModule), id: 'default-table-overdue' },
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    catalogId: 'kpi-total',
    category: 'KPI',
    label: 'Totalt antall kontroller',
    template: KPI_TOTAL,
  },
  {
    catalogId: 'kpi-overdue',
    category: 'KPI',
    label: 'Forfalte kontroller',
    template: KPI_OVERDUE,
  },
  {
    catalogId: 'kpi-due-soon',
    category: 'KPI',
    label: 'Forfaller snart',
    template: KPI_DUE_SOON,
  },
  {
    catalogId: 'kpi-on-track',
    category: 'KPI',
    label: 'På sporet',
    template: KPI_ON_TRACK,
  },
  {
    catalogId: 'donut-status',
    category: 'Distribusjon',
    label: 'Kontroller per status — kakediagram',
    template: DONUT_STATUS,
  },
  {
    catalogId: 'donut-regulation',
    category: 'Distribusjon',
    label: 'Kontroller per regelverk — kakediagram',
    template: DONUT_REGULATION,
  },
  {
    catalogId: 'bar-family',
    category: 'Distribusjon',
    label: 'Kontroller per familie — søylediagram',
    template: BAR_FAMILY,
  },
  {
    catalogId: 'line-executions',
    category: 'Over tid',
    label: 'Bevisrader over tid',
    template: LINE_EXECUTIONS,
  },
  {
    catalogId: 'table-overdue',
    category: 'Tabell',
    label: 'Forfalte kontroller — tabell',
    template: TABLE_OVERDUE,
  },
]

registerDashboardScope({
  scopeId: COMPLIANCE_LAYER_SCOPE_ID,
  label: 'Kontroller',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  accent: '#b45309', // amber-700 — distinct from compliance-green, learning-teal etc.
  supportsComparison: true,
})
