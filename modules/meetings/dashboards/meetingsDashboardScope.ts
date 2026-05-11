// Meetings analytics scope registration.
//
// Registers `meetings` with the dashboard registry on module load.
// Default layout: 4-up KPI strip + decision trend line + status donut
// + framework donut + template bar. Side-effect import from
// MeetingsAnalysePage triggers the registration.

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

export const MEETINGS_DASHBOARD_SCOPE_ID = 'meetings'

const DATASETS: DatasetMeta[] = [
  { key: 'meeting_kpi_summary', label: 'KPI-sammendrag', shape: 'kpi-record' },
  { key: 'meeting_status_distribution', label: 'Status', shape: 'segments' },
  { key: 'meeting_framework_distribution', label: 'Per rammeverk', shape: 'segments' },
  { key: 'meeting_template_distribution', label: 'Per mal', shape: 'segments' },
  { key: 'meeting_category_distribution', label: 'Per kategori', shape: 'segments' },
  { key: 'meeting_completion_over_time', label: 'Gjennomførte møter over tid', shape: 'series' },
  { key: 'meeting_decisions_over_time', label: 'Vedtak over tid', shape: 'series' },
  { key: 'meeting_quorum_distribution', label: 'Beslutningsdyktighet', shape: 'segments' },
  { key: 'meeting_instances_by_location', label: 'Per lokasjon', shape: 'segments' },
  { key: 'meeting_instances_by_department', label: 'Per avdeling', shape: 'segments' },
  { key: 'meeting_law_ref_coverage', label: 'Lovreferanser dekket', shape: 'segments' },
]

const KPI_TOTAL: ReportModuleKpi = {
  id: 'kpi-total',
  kind: 'kpi',
  datasetKey: 'meeting_kpi_summary',
  title: 'Totalt antall møter',
  valuePath: 'total',
  subtitle: 'Alle ikke-arkiverte instanser',
  colSpan: 'sm',
}
const KPI_PLANNED: ReportModuleKpi = {
  id: 'kpi-planned',
  kind: 'kpi',
  datasetKey: 'meeting_kpi_summary',
  title: 'Planlagte',
  valuePath: 'planned',
  subtitle: 'Status planlagt eller pågår',
  colSpan: 'sm',
}
const KPI_COMPLETED: ReportModuleKpi = {
  id: 'kpi-completed',
  kind: 'kpi',
  datasetKey: 'meeting_kpi_summary',
  title: 'Gjennomførte',
  valuePath: 'completed',
  subtitle: 'Status gjennomført',
  colSpan: 'sm',
}
const KPI_DECISIONS_OPEN: ReportModuleKpi = {
  id: 'kpi-decisions-open',
  kind: 'kpi',
  datasetKey: 'meeting_kpi_summary',
  title: 'Åpne vedtak',
  valuePath: 'decisionsOpen',
  subtitle: 'Status åpent — ikke iverksatt',
  colSpan: 'sm',
}
const KPI_DECISIONS_YTD: ReportModuleKpi = {
  id: 'kpi-decisions-ytd',
  kind: 'kpi',
  datasetKey: 'meeting_kpi_summary',
  title: 'Iverksatte vedtak i år',
  valuePath: 'decisionsImplementedYtd',
  subtitle: 'YTD',
  colSpan: 'sm',
}
const KPI_OVERDUE_SIGN: ReportModuleKpi = {
  id: 'kpi-overdue-sign',
  kind: 'kpi',
  datasetKey: 'meeting_kpi_summary',
  title: 'Mangler protokollsignatur',
  valuePath: 'overdueSign',
  subtitle: 'Gjennomført uten signatur',
  colSpan: 'sm',
}

const LINE_COMPLETION: ReportModuleLine = {
  id: 'line-completion-over-time',
  kind: 'line',
  datasetKey: 'meeting_completion_over_time',
  title: 'Gjennomførte møter over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'md',
}
const LINE_DECISIONS: ReportModuleLine = {
  id: 'line-decisions-over-time',
  kind: 'line',
  datasetKey: 'meeting_decisions_over_time',
  title: 'Vedtak over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall vedtak',
  colSpan: 'md',
}
const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status',
  kind: 'donut',
  datasetKey: 'meeting_status_distribution',
  title: 'Fordeling per status',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_FRAMEWORK: ReportModuleDonut = {
  id: 'donut-framework',
  kind: 'donut',
  datasetKey: 'meeting_framework_distribution',
  title: 'Fordeling per rammeverk',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_QUORUM: ReportModuleDonut = {
  id: 'donut-quorum',
  kind: 'donut',
  datasetKey: 'meeting_quorum_distribution',
  title: 'Beslutningsdyktighet',
  segmentsPath: '',
  colSpan: 'md',
}
const BAR_TEMPLATE: ReportModuleBar = {
  id: 'bar-template',
  kind: 'bar',
  datasetKey: 'meeting_template_distribution',
  title: 'Mest brukte maler',
  seriesKeys: [],
  colSpan: 'md',
}
const BAR_CATEGORY: ReportModuleBar = {
  id: 'bar-category',
  kind: 'bar',
  datasetKey: 'meeting_category_distribution',
  title: 'Møter per kategori',
  seriesKeys: [],
  colSpan: 'md',
}
const DONUT_LOCATION: ReportModuleDonut = {
  id: 'donut-location',
  kind: 'donut',
  datasetKey: 'meeting_instances_by_location',
  title: 'Per lokasjon',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_DEPARTMENT: ReportModuleDonut = {
  id: 'donut-department',
  kind: 'donut',
  datasetKey: 'meeting_instances_by_department',
  title: 'Per avdeling',
  segmentsPath: '',
  colSpan: 'md',
}
const TABLE_LAW_REFS: ReportModuleTable = {
  id: 'table-law-refs',
  kind: 'table',
  datasetKey: 'meeting_law_ref_coverage',
  title: 'Lovreferanser dekket',
  rowKeys: [],
  colSpan: 'full',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_TOTAL,
  KPI_PLANNED,
  KPI_COMPLETED,
  KPI_DECISIONS_OPEN,
  LINE_COMPLETION,
  DONUT_STATUS,
  DONUT_FRAMEWORK,
  BAR_TEMPLATE,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-total', category: 'Volum', label: 'Totalt antall møter', template: KPI_TOTAL },
  { catalogId: 'kpi-planned', category: 'Volum', label: 'Planlagte / pågående', template: KPI_PLANNED },
  { catalogId: 'kpi-completed', category: 'Volum', label: 'Gjennomførte', template: KPI_COMPLETED },
  { catalogId: 'kpi-overdue-sign', category: 'Risiko', label: 'Mangler protokollsignatur', template: KPI_OVERDUE_SIGN },
  { catalogId: 'kpi-decisions-open', category: 'Vedtak', label: 'Åpne vedtak', template: KPI_DECISIONS_OPEN },
  { catalogId: 'kpi-decisions-ytd', category: 'Vedtak', label: 'Iverksatte vedtak i år', template: KPI_DECISIONS_YTD },
  { catalogId: 'line-completion-over-time', category: 'Trend', label: 'Gjennomførte møter over tid', template: LINE_COMPLETION },
  { catalogId: 'line-decisions-over-time', category: 'Trend', label: 'Vedtak over tid', template: LINE_DECISIONS },
  { catalogId: 'donut-status', category: 'Diagrammer', label: 'Status — kakediagram', template: DONUT_STATUS },
  { catalogId: 'donut-framework', category: 'Diagrammer', label: 'Rammeverk — kakediagram', template: DONUT_FRAMEWORK },
  { catalogId: 'donut-quorum', category: 'Diagrammer', label: 'Beslutningsdyktighet — kakediagram', template: DONUT_QUORUM },
  { catalogId: 'bar-template', category: 'Diagrammer', label: 'Mest brukte maler', template: BAR_TEMPLATE },
  { catalogId: 'bar-category', category: 'Diagrammer', label: 'Per kategori', template: BAR_CATEGORY },
  { catalogId: 'donut-location', category: 'Org-kontekst', label: 'Per lokasjon', template: DONUT_LOCATION },
  { catalogId: 'donut-department', category: 'Org-kontekst', label: 'Per avdeling', template: DONUT_DEPARTMENT },
  { catalogId: 'table-law-refs', category: 'Etterlevelse', label: 'Lovreferanser dekket', template: TABLE_LAW_REFS },
]

registerDashboardScope({
  scopeId: MEETINGS_DASHBOARD_SCOPE_ID,
  label: 'Møter',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  accent: '#0891b2',
})
