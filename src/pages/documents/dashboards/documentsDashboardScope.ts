// Documents analytics scope (documents-parity §T2).
//
// Standard registry pattern — datasets are computed by
// useDocumentsDatasets at render time. This file is pure metadata so it
// can be imported anywhere (including the HMS Overview composite scope
// later) without dragging Supabase / hook deps along.

import type {
  ReportModule,
  ReportModuleBar,
  ReportModuleDonut,
  ReportModuleKpi,
  ReportModuleLine,
} from '../../../types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'

export const DOCUMENTS_DASHBOARD_SCOPE_ID = 'documents'

const DATASETS: DatasetMeta[] = [
  { key: 'documents_kpi_summary', label: 'KPI-sammendrag', shape: 'kpi-record' },
  { key: 'documents_status_distribution', label: 'Status', shape: 'segments' },
  { key: 'documents_space_distribution', label: 'Per plass', shape: 'segments' },
  { key: 'documents_top_templates', label: 'Mest brukte maler', shape: 'segments' },
  { key: 'documents_retention_buckets', label: 'Retention — utløpsvinduer', shape: 'segments' },
  { key: 'documents_published_over_time', label: 'Publisert over tid', shape: 'series' },
]

const KPI_TOTAL: ReportModuleKpi = {
  id: 'kpi-total',
  kind: 'kpi',
  datasetKey: 'documents_kpi_summary',
  title: 'Totalt antall sider',
  valuePath: 'totalPages',
  subtitle: 'Alle plasser',
  colSpan: 'sm',
}
const KPI_PUBLISHED: ReportModuleKpi = {
  id: 'kpi-published',
  kind: 'kpi',
  datasetKey: 'documents_kpi_summary',
  title: 'Publisert',
  valuePath: 'published',
  subtitle: 'Status = publisert',
  colSpan: 'sm',
}
const KPI_PENDING_REVIEW: ReportModuleKpi = {
  id: 'kpi-pending-review',
  kind: 'kpi',
  datasetKey: 'documents_kpi_summary',
  title: 'Til godkjenning',
  valuePath: 'pendingReview',
  subtitle: 'Krever fagansvarlig',
  colSpan: 'sm',
}
const KPI_RETENTION_OVERDUE: ReportModuleKpi = {
  id: 'kpi-retention-overdue',
  kind: 'kpi',
  datasetKey: 'documents_kpi_summary',
  title: 'Forfalt revisjon',
  valuePath: 'retentionOverdue',
  subtitle: 'Krever oppfølging',
  colSpan: 'sm',
}
const KPI_ACCESS_REQUESTS: ReportModuleKpi = {
  id: 'kpi-access-requests',
  kind: 'kpi',
  datasetKey: 'documents_kpi_summary',
  title: 'Åpne tilgangsforespørsler',
  valuePath: 'accessRequestsOpen',
  subtitle: 'Avventer beslutning',
  colSpan: 'sm',
}
const KPI_YTD: ReportModuleKpi = {
  id: 'kpi-published-ytd',
  kind: 'kpi',
  datasetKey: 'documents_kpi_summary',
  title: 'Publisert i år',
  valuePath: 'publishedYtd',
  subtitle: 'YTD',
  colSpan: 'sm',
}

const LINE_PUBLISHED: ReportModuleLine = {
  id: 'line-published-over-time',
  kind: 'line',
  datasetKey: 'documents_published_over_time',
  title: 'Publisert over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'md',
}
const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status',
  kind: 'donut',
  datasetKey: 'documents_status_distribution',
  title: 'Fordeling per status',
  segmentsPath: '',
  colSpan: 'md',
}
const BAR_SPACE: ReportModuleBar = {
  id: 'bar-space',
  kind: 'bar',
  datasetKey: 'documents_space_distribution',
  title: 'Sider per plass',
  seriesKeys: [],
  colSpan: 'md',
}
const BAR_RETENTION: ReportModuleBar = {
  id: 'bar-retention',
  kind: 'bar',
  datasetKey: 'documents_retention_buckets',
  title: 'Retention — utløpsvinduer',
  seriesKeys: ['Forfalt', 'Innen 30 dager', 'Innen 60 dager', 'Innen 90 dager', 'Senere'],
  colSpan: 'md',
}
const BAR_TOP_TEMPLATES: ReportModuleBar = {
  id: 'bar-top-templates',
  kind: 'bar',
  datasetKey: 'documents_top_templates',
  title: 'Mest brukte maler',
  seriesKeys: [],
  colSpan: 'md',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_TOTAL,
  KPI_PUBLISHED,
  KPI_PENDING_REVIEW,
  KPI_RETENTION_OVERDUE,
  LINE_PUBLISHED,
  DONUT_STATUS,
  BAR_SPACE,
  BAR_RETENTION,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-total', category: 'Volum', label: 'Totalt antall sider', template: KPI_TOTAL },
  { catalogId: 'kpi-published', category: 'Volum', label: 'Publisert', template: KPI_PUBLISHED },
  { catalogId: 'kpi-published-ytd', category: 'Volum', label: 'Publisert i år', template: KPI_YTD },
  { catalogId: 'kpi-pending-review', category: 'Kvalitet', label: 'Til godkjenning', template: KPI_PENDING_REVIEW },
  { catalogId: 'kpi-retention-overdue', category: 'Kvalitet', label: 'Forfalt revisjon', template: KPI_RETENTION_OVERDUE },
  { catalogId: 'kpi-access-requests', category: 'Tilgang', label: 'Åpne tilgangsforespørsler', template: KPI_ACCESS_REQUESTS },
  { catalogId: 'line-published-over-time', category: 'Trend', label: 'Publisert over tid', template: LINE_PUBLISHED },
  { catalogId: 'donut-status', category: 'Diagrammer', label: 'Status — kakediagram', template: DONUT_STATUS },
  { catalogId: 'bar-space', category: 'Diagrammer', label: 'Sider per plass — søylediagram', template: BAR_SPACE },
  { catalogId: 'bar-retention', category: 'Kvalitet', label: 'Retention-vinduer — søylediagram', template: BAR_RETENTION },
  { catalogId: 'bar-top-templates', category: 'Diagrammer', label: 'Mest brukte maler — søylediagram', template: BAR_TOP_TEMPLATES },
]

registerDashboardScope({
  scopeId: DOCUMENTS_DASHBOARD_SCOPE_ID,
  label: 'Dokumenter',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  // Deep teal — distinct from learning's #0e7490 so the two modules don't
  // visually merge in the HMS Overview composite.
  accent: '#0f766e',
})
