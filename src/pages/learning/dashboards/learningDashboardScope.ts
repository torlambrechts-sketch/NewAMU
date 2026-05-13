// Learning analytics scope registration.
//
// Registers `learning` with the dashboard registry on module load.
// Datasets are computed by LearningAnalysePage from useLearning data;
// this file is pure metadata.
//
// Per /specs/elearning-parity.md: includes the e-learning-specific
// "certification-expiry" dimension via the certs_expiring_window
// dataset (segments: 0-30d / 30-60d / 60-90d / 90+d).

import type {
  ReportModule,
  ReportModuleBar,
  ReportModuleDonut,
  ReportModuleHeatmap,
  ReportModuleKpi,
  ReportModuleLine,
  ReportModuleTable,
} from '../../../types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'
import { useLearningDatasetsForReports } from './useLearningDatasetsForReports'

export const LEARNING_DASHBOARD_SCOPE_ID = 'learning'

const DATASETS: DatasetMeta[] = [
  { key: 'learning_kpi_summary', label: 'KPI-sammendrag', shape: 'kpi-record' },
  { key: 'learning_status_distribution', label: 'Status', shape: 'segments' },
  { key: 'learning_category_distribution', label: 'Per kategori', shape: 'segments' },
  { key: 'learning_top_courses', label: 'Topp kurs', shape: 'segments' },
  { key: 'learning_completions_over_time', label: 'Fullføringer over tid', shape: 'series' },
  {
    key: 'learning_certs_expiring_window',
    label: 'Sertifikater — utløpsvinduer',
    shape: 'segments',
  },
  {
    key: 'learning_completions_by_department',
    label: 'Fullført per avdeling',
    shape: 'segments',
  },
  {
    key: 'learning_completions_by_user_heatmap',
    label: 'Fullføringer — brukere × kurs',
    shape: 'rows',
  },
  {
    key: 'learning_completions_over_time_prev',
    label: 'Fullføringer over tid (forrige periode)',
    shape: 'series',
  },
  {
    key: 'learning_kpi_summary_prev',
    label: 'KPI-sammendrag (forrige periode)',
    shape: 'kpi-record',
  },
]

// ── Default widgets ───────────────────────────────────────────────────────

const KPI_TOTAL_COURSES: ReportModuleKpi = {
  id: 'kpi-total-courses',
  kind: 'kpi',
  datasetKey: 'learning_kpi_summary',
  title: 'Totalt antall kurs',
  valuePath: 'totalCourses',
  subtitle: 'Publiserte og kladd',
  colSpan: 'sm',
}
const KPI_ACTIVE_LEARNERS: ReportModuleKpi = {
  id: 'kpi-active-learners',
  kind: 'kpi',
  datasetKey: 'learning_kpi_summary',
  title: 'Aktive deltakere',
  valuePath: 'activeLearners',
  subtitle: 'Påbegynt, ikke fullført',
  colSpan: 'sm',
}
const KPI_COMPLETED_YTD: ReportModuleKpi = {
  id: 'kpi-completed-ytd',
  kind: 'kpi',
  datasetKey: 'learning_kpi_summary',
  title: 'Fullført i år',
  valuePath: 'completedYtd',
  subtitle: 'YTD',
  colSpan: 'sm',
  comparisonDatasetKey: 'learning_kpi_summary_prev',
  comparisonValuePath: 'completedYtd',
  comparisonLabel: 'vs. samme periode i fjor',
  comparisonGoal: 'increase',
  sparklineDatasetKey: 'learning_completions_over_time',
  sparklinePath: '',
}
const KPI_CERTS_EXPIRING: ReportModuleKpi = {
  id: 'kpi-certs-expiring',
  kind: 'kpi',
  datasetKey: 'learning_kpi_summary',
  title: 'Utløper innen 30 dager',
  valuePath: 'certsExpiring30d',
  subtitle: 'Sertifikater som må fornyes',
  colSpan: 'sm',
}
const KPI_TOTAL_COMPLETED: ReportModuleKpi = {
  id: 'kpi-total-completed',
  kind: 'kpi',
  datasetKey: 'learning_kpi_summary',
  title: 'Totalt fullførte',
  valuePath: 'totalCompleted',
  subtitle: 'Akkumulert',
  colSpan: 'sm',
}
const LINE_COMPLETIONS: ReportModuleLine = {
  id: 'line-completions-over-time',
  kind: 'line',
  datasetKey: 'learning_completions_over_time',
  title: 'Fullføringer over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'md',
  comparisonDatasetKey: 'learning_completions_over_time_prev',
  comparisonPointsPath: '',
  primaryLabel: 'Siste 12 mnd.',
  comparisonLabel: '12 mnd. tilbake',
}
const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status',
  kind: 'donut',
  datasetKey: 'learning_status_distribution',
  title: 'Fordeling per status',
  segmentsPath: '',
  colSpan: 'md',
  drillDimensionId: 'status',
}
const DONUT_CATEGORY: ReportModuleDonut = {
  id: 'donut-category',
  kind: 'donut',
  datasetKey: 'learning_category_distribution',
  title: 'Fordeling per kategori',
  segmentsPath: '',
  colSpan: 'md',
  drillDimensionId: 'category',
}
const BAR_TOP_COURSES: ReportModuleBar = {
  id: 'bar-top-courses',
  kind: 'bar',
  datasetKey: 'learning_top_courses',
  title: 'Mest fullførte kurs',
  seriesKeys: [],
  colSpan: 'md',
  drillDimensionId: 'course',
}
const BAR_EXPIRING: ReportModuleBar = {
  id: 'bar-expiring',
  kind: 'bar',
  datasetKey: 'learning_certs_expiring_window',
  title: 'Sertifikater — utløpsvinduer',
  seriesKeys: ['Innen 30d', '30–60d', '60–90d', '90d+'],
  colSpan: 'md',
}
const BAR_DEPARTMENT: ReportModuleBar = {
  id: 'bar-department',
  kind: 'bar',
  datasetKey: 'learning_completions_by_department',
  title: 'Fullført per avdeling',
  seriesKeys: [],
  colSpan: 'md',
  drillDimensionId: 'department',
}
const TABLE_TOP_COURSES: ReportModuleTable = {
  id: 'table-top-courses',
  kind: 'table',
  datasetKey: 'learning_top_courses',
  title: 'Topp kurs — tabell',
  rowKeys: [],
  colSpan: 'full',
}
const HEATMAP_USER_COMPLETIONS: ReportModuleHeatmap = {
  id: 'heatmap-user-completions',
  kind: 'heatmap',
  datasetKey: 'learning_completions_by_user_heatmap',
  title: 'Brukere × kurs — fullføring',
  subtitle: 'Grønn = fullført, lys = ikke fullført',
  // Completion ratios are 0 / 0.5 (in progress) / 1 (complete) — lock the
  // colour scale so the gradient reads consistently regardless of which
  // cells happen to be visible.
  valueMin: 0,
  valueMax: 1,
  valueLabel: '(0 = ikke startet, 1 = fullført)',
  colSpan: 'full',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_ACTIVE_LEARNERS,
  KPI_COMPLETED_YTD,
  KPI_CERTS_EXPIRING,
  KPI_TOTAL_COURSES,
  LINE_COMPLETIONS,
  DONUT_STATUS,
  BAR_TOP_COURSES,
  BAR_EXPIRING,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  { catalogId: 'kpi-total-courses', category: 'Volum', label: 'Totalt antall kurs', template: KPI_TOTAL_COURSES },
  { catalogId: 'kpi-active-learners', category: 'Volum', label: 'Aktive deltakere', template: KPI_ACTIVE_LEARNERS },
  { catalogId: 'kpi-completed-ytd', category: 'Volum', label: 'Fullført i år', template: KPI_COMPLETED_YTD },
  { catalogId: 'kpi-total-completed', category: 'Volum', label: 'Totalt fullførte', template: KPI_TOTAL_COMPLETED },
  { catalogId: 'kpi-certs-expiring', category: 'Sertifikater', label: 'Utløper innen 30 dager', template: KPI_CERTS_EXPIRING },
  { catalogId: 'line-completions-over-time', category: 'Trend', label: 'Fullføringer over tid', template: LINE_COMPLETIONS },
  { catalogId: 'donut-status', category: 'Diagrammer', label: 'Status — kakediagram', template: DONUT_STATUS },
  { catalogId: 'donut-category', category: 'Diagrammer', label: 'Kategori — kakediagram', template: DONUT_CATEGORY },
  { catalogId: 'bar-top-courses', category: 'Diagrammer', label: 'Topp kurs — søylediagram', template: BAR_TOP_COURSES },
  { catalogId: 'bar-expiring', category: 'Sertifikater', label: 'Utløpsvinduer — søylediagram', template: BAR_EXPIRING },
  { catalogId: 'bar-department', category: 'Org-kontekst', label: 'Per avdeling — søylediagram', template: BAR_DEPARTMENT },
  { catalogId: 'table-top-courses', category: 'Tabeller', label: 'Topp kurs — tabell', template: TABLE_TOP_COURSES },
  {
    catalogId: 'heatmap-user-completions',
    category: 'Heatmap',
    label: 'Brukere × kurs — fullføring',
    template: HEATMAP_USER_COMPLETIONS,
  },
]

registerDashboardScope({
  scopeId: LEARNING_DASHBOARD_SCOPE_ID,
  label: 'Læring',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  accent: '#0e7490', // teal — visually pairs with the GraduationCap module icon
  datasetsHook: useLearningDatasetsForReports,
})
