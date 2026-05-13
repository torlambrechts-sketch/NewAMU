// Registers analytics scope registration.
//
// Cross-cutting analyse page for the registers engine — aggregates
// `register_records` across every enabled type. Per-type detail
// (e.g. "kjemikalier with H350 by location") lives on the per-type
// list page, not here. The KPIs surface what an HMS-leder cares
// about cross-register: totals by status + reviews overdue +
// distribution by regulation.
//
// Side-effect import contract per CLAUDE.md: pages that consume the
// scope must import this file for the side effect.

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
import { useRegistersDatasetsForReports } from './useRegistersDatasetsForReports'

export const REGISTERS_DASHBOARD_SCOPE_ID = 'registers'

const DATASETS: DatasetMeta[] = [
  { key: 'registers_kpi_summary', label: 'KPI-sammendrag', shape: 'kpi-record' },
  { key: 'registers_status_distribution', label: 'Per status', shape: 'segments' },
  { key: 'registers_by_type', label: 'Antall per registertype', shape: 'segments' },
  { key: 'registers_by_regulation', label: 'Antall per regelverk', shape: 'segments' },
  { key: 'registers_by_category', label: 'Antall per kategori', shape: 'segments' },
  { key: 'registers_review_due_soon', label: 'Til gjennomgang innen 30 dager', shape: 'rows' },
]

// ── KPIs ────────────────────────────────────────────────────────────────

const KPI_TOTAL: ReportModuleKpi = {
  id: 'kpi-total-records',
  kind: 'kpi',
  datasetKey: 'registers_kpi_summary',
  title: 'Aktive rader',
  valuePath: 'activeRecords',
  subtitle: 'På tvers av alle registertyper',
  colSpan: 'sm',
}

const KPI_REVIEWS_OVERDUE: ReportModuleKpi = {
  id: 'kpi-reviews-overdue',
  kind: 'kpi',
  datasetKey: 'registers_kpi_summary',
  title: 'Gjennomgang forfalt',
  valuePath: 'reviewsOverdue',
  subtitle: 'Rader med review_due_at i fortid',
  colSpan: 'sm',
}

const KPI_REVIEWS_DUE_SOON: ReportModuleKpi = {
  id: 'kpi-reviews-due-soon',
  kind: 'kpi',
  datasetKey: 'registers_kpi_summary',
  title: 'Forfaller innen 30 dager',
  valuePath: 'reviewsDueIn30Days',
  subtitle: 'Forsterk planleggingen før de bikker',
  colSpan: 'sm',
}

const KPI_TYPES_ENABLED: ReportModuleKpi = {
  id: 'kpi-types-enabled',
  kind: 'kpi',
  datasetKey: 'registers_kpi_summary',
  title: 'Aktive registertyper',
  valuePath: 'enabledTypes',
  subtitle: 'Inkl. egne registertyper',
  colSpan: 'sm',
}

// ── Charts ──────────────────────────────────────────────────────────────

const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status',
  kind: 'donut',
  datasetKey: 'registers_status_distribution',
  title: 'Fordeling per status',
  segmentsPath: '',
  colSpan: 'md',
  drillDimensionId: 'status',
}

const BAR_BY_TYPE: ReportModuleBar = {
  id: 'bar-by-type',
  kind: 'bar',
  datasetKey: 'registers_by_type',
  title: 'Antall per registertype',
  seriesKeys: [],
  colSpan: 'md',
  drillDimensionId: 'register_type',
}

const BAR_BY_REGULATION: ReportModuleBar = {
  id: 'bar-by-regulation',
  kind: 'bar',
  datasetKey: 'registers_by_regulation',
  title: 'Antall per regelverk',
  seriesKeys: [],
  colSpan: 'md',
  drillDimensionId: 'regulation',
}

const TABLE_REVIEW_DUE: ReportModuleTable = {
  id: 'table-review-due-soon',
  kind: 'table',
  datasetKey: 'registers_review_due_soon',
  title: 'Forfaller innen 30 dager',
  subtitle: 'Sortert etter dato',
  rowKeys: ['name', 'type', 'reviewDueAt', 'status'],
  colSpan: 'full',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_TOTAL,
  KPI_REVIEWS_OVERDUE,
  KPI_REVIEWS_DUE_SOON,
  KPI_TYPES_ENABLED,
  DONUT_STATUS,
  BAR_BY_TYPE,
  BAR_BY_REGULATION,
  TABLE_REVIEW_DUE,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    catalogId: 'kpi-total-records',
    label: 'Aktive rader',
    description: 'Totalt antall aktive register-rader.',
    category: 'KPIer',
    template: KPI_TOTAL,
  },
  {
    catalogId: 'kpi-reviews-overdue',
    label: 'Gjennomgang forfalt',
    description: 'Rader med review_due_at i fortid.',
    category: 'KPIer',
    template: KPI_REVIEWS_OVERDUE,
  },
  {
    catalogId: 'kpi-reviews-due-soon',
    label: 'Forfaller innen 30 dager',
    description: 'Forberedelseshelp for nestkommende gjennomganger.',
    category: 'KPIer',
    template: KPI_REVIEWS_DUE_SOON,
  },
  {
    catalogId: 'kpi-types-enabled',
    label: 'Aktive registertyper',
    description: 'Hvor mange registertyper organisasjonen bruker.',
    category: 'KPIer',
    template: KPI_TYPES_ENABLED,
  },
  {
    catalogId: 'donut-status',
    label: 'Fordeling per status',
    description: 'Aktiv vs. utkast vs. arkivert.',
    category: 'Fordeling',
    template: DONUT_STATUS,
  },
  {
    catalogId: 'bar-by-type',
    label: 'Antall per registertype',
    description: 'Hvor mange rader hver type har.',
    category: 'Fordeling',
    template: BAR_BY_TYPE,
  },
  {
    catalogId: 'bar-by-regulation',
    label: 'Antall per regelverk',
    description: 'Cross-regelverk dekning — én rad i et register kan telle i flere.',
    category: 'Fordeling',
    template: BAR_BY_REGULATION,
  },
  {
    catalogId: 'table-review-due-soon',
    label: 'Forfaller innen 30 dager',
    description: 'Tabell med rader til oppfølging.',
    category: 'Tabeller',
    template: TABLE_REVIEW_DUE,
  },
]

registerDashboardScope({
  scopeId: REGISTERS_DASHBOARD_SCOPE_ID,
  label: 'Register',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  // Steel-blue — distinct from the other registered scope accents
  // (forest / purple / amber / teal / deep-teal / indigo).
  accent: '#0369a1',
  datasetsHook: useRegistersDatasetsForReports,
})
