// Survey analytics scope registration.
//
// Registers `survey` with the dashboard registry on module load. The
// default layout is the same shape as the checklist analyse page —
// 4-up KPI strip, then a wide trend line, then breakdowns. Datasets
// are computed by SurveyAnalysePage from useSurvey + useOrgSetupContext
// data; this file is pure metadata.

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

export const SURVEY_DASHBOARD_SCOPE_ID = 'survey'

const DATASETS: DatasetMeta[] = [
  { key: 'survey_kpi_summary', label: 'KPI-sammendrag', shape: 'kpi-record' },
  { key: 'survey_status_distribution', label: 'Status', shape: 'segments' },
  { key: 'survey_pack_distribution', label: 'Per pakke', shape: 'segments' },
  { key: 'survey_template_distribution', label: 'Per mal', shape: 'segments' },
  { key: 'survey_anonymity_distribution', label: 'Anonymitet', shape: 'segments' },
  { key: 'survey_responses_over_time', label: 'Svar over tid', shape: 'series' },
  {
    key: 'survey_response_rate_over_time',
    label: 'Svarprosent over tid',
    shape: 'series',
  },
]

// ── Default-layout widgets ────────────────────────────────────────────────

const KPI_TOTAL: ReportModuleKpi = {
  id: 'kpi-total',
  kind: 'kpi',
  datasetKey: 'survey_kpi_summary',
  title: 'Totalt antall undersøkelser',
  valuePath: 'total',
  subtitle: 'Alle aktive (ikke arkiverte) kjøringer',
  colSpan: 'sm',
}
const KPI_OPEN: ReportModuleKpi = {
  id: 'kpi-open',
  kind: 'kpi',
  datasetKey: 'survey_kpi_summary',
  title: 'Åpne / publiserte',
  valuePath: 'open',
  subtitle: 'Status kladd, publisert eller pågående',
  colSpan: 'sm',
}
const KPI_RESPONSES: ReportModuleKpi = {
  id: 'kpi-responses',
  kind: 'kpi',
  datasetKey: 'survey_kpi_summary',
  title: 'Totalt antall svar',
  valuePath: 'responses',
  subtitle: 'Akkumulert',
  colSpan: 'sm',
}
const KPI_RESPONSE_RATE: ReportModuleKpi = {
  id: 'kpi-response-rate',
  kind: 'kpi',
  datasetKey: 'survey_kpi_summary',
  title: 'Svarprosent (avg)',
  valuePath: 'responseRatePct',
  subtitle: 'Snitt på publiserte undersøkelser',
  colSpan: 'sm',
}
const KPI_YTD_CLOSED: ReportModuleKpi = {
  id: 'kpi-ytd-closed',
  kind: 'kpi',
  datasetKey: 'survey_kpi_summary',
  title: 'Lukket i år',
  valuePath: 'ytdClosed',
  subtitle: 'YTD',
  colSpan: 'sm',
}
const KPI_CLOSED: ReportModuleKpi = {
  id: 'kpi-closed',
  kind: 'kpi',
  datasetKey: 'survey_kpi_summary',
  title: 'Lukkede undersøkelser',
  valuePath: 'closed',
  subtitle: 'Status lukket',
  colSpan: 'sm',
}
const LINE_RESPONSES: ReportModuleLine = {
  id: 'line-responses-over-time',
  kind: 'line',
  datasetKey: 'survey_responses_over_time',
  title: 'Svar over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall svar',
  colSpan: 'md',
}
const LINE_RATE: ReportModuleLine = {
  id: 'line-rate-over-time',
  kind: 'line',
  datasetKey: 'survey_response_rate_over_time',
  title: 'Svarprosent over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: '%',
  colSpan: 'md',
}
const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status',
  kind: 'donut',
  datasetKey: 'survey_status_distribution',
  title: 'Fordeling per status',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_PACK: ReportModuleDonut = {
  id: 'donut-pack',
  kind: 'donut',
  datasetKey: 'survey_pack_distribution',
  title: 'Fordeling per pakke',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_ANON: ReportModuleDonut = {
  id: 'donut-anon',
  kind: 'donut',
  datasetKey: 'survey_anonymity_distribution',
  title: 'Anonyme vs identifiserte',
  segmentsPath: '',
  colSpan: 'md',
}
const BAR_TEMPLATE: ReportModuleBar = {
  id: 'bar-template',
  kind: 'bar',
  datasetKey: 'survey_template_distribution',
  title: 'Mest brukte maler (topp 8)',
  seriesKeys: [],
  colSpan: 'md',
}
const TABLE_TEMPLATE: ReportModuleTable = {
  id: 'table-template',
  kind: 'table',
  datasetKey: 'survey_template_distribution',
  title: 'Maler — tabell',
  rowKeys: [],
  colSpan: 'full',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_TOTAL,
  KPI_OPEN,
  KPI_RESPONSES,
  KPI_RESPONSE_RATE,
  LINE_RESPONSES,
  DONUT_STATUS,
  BAR_TEMPLATE,
  DONUT_PACK,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-total', category: 'Volum', label: 'Totalt antall undersøkelser', template: KPI_TOTAL },
  { catalogId: 'kpi-open', category: 'Volum', label: 'Åpne / publiserte', template: KPI_OPEN },
  { catalogId: 'kpi-closed', category: 'Volum', label: 'Lukkede undersøkelser', template: KPI_CLOSED },
  { catalogId: 'kpi-ytd-closed', category: 'Volum', label: 'Lukket i år', template: KPI_YTD_CLOSED },
  { catalogId: 'kpi-responses', category: 'Svar', label: 'Totalt antall svar', template: KPI_RESPONSES },
  { catalogId: 'kpi-response-rate', category: 'Svar', label: 'Svarprosent (avg)', template: KPI_RESPONSE_RATE },
  { catalogId: 'line-responses-over-time', category: 'Trend', label: 'Svar over tid', description: 'Antall svar per måned siste 12 mnd.', template: LINE_RESPONSES },
  { catalogId: 'line-rate-over-time', category: 'Trend', label: 'Svarprosent over tid', description: 'Snitt svarprosent per måned siste 12 mnd.', template: LINE_RATE },
  { catalogId: 'donut-status', category: 'Diagrammer', label: 'Status — kakediagram', template: DONUT_STATUS },
  { catalogId: 'donut-pack', category: 'Diagrammer', label: 'Pakke — kakediagram', template: DONUT_PACK },
  { catalogId: 'donut-anon', category: 'Diagrammer', label: 'Anonymitet — kakediagram', template: DONUT_ANON },
  { catalogId: 'bar-template', category: 'Diagrammer', label: 'Topp brukte maler', template: BAR_TEMPLATE },
  { catalogId: 'table-template', category: 'Tabeller', label: 'Maler — tabell', template: TABLE_TEMPLATE },
]

registerDashboardScope({
  scopeId: SURVEY_DASHBOARD_SCOPE_ID,
  label: 'Undersøkelser',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  // Dimensions are page-side (need live org data for pack/template lists).
})
