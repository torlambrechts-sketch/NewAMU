// Internkontroll — composite dashboard scope.
//
// Hosts both the Compliance Dashboard and the Gap Analysis system reports.
// The two pages dispatch off the system row's `slug` in `SystemReport.tsx`,
// share the same registered scope, and reuse existing widget kinds (kpi,
// bar, heatmap, table) — no new ReportModuleKind union members.
//
// The scope publishes its own four datasets (internkontroll_kpi_summary /
// _framework_coverage / _gap_matrix / _recent_evidence) and inherits the
// member-scope dataset metadata from `hms_overview` via `compositeMembers`
// so the dashboard editor's "Datakilde"-picker sees both layers.
//
// Accent is a deep burgundy — distinct from compliance #1a3d32 and
// hms_overview #4338ca so the audit lens reads as a different layer.

import type {
  ReportModule,
  ReportModuleKpi,
  ReportModuleBar,
  ReportModuleHeatmap,
  ReportModuleTable,
} from '../../../types/reportBuilder'
import {
  registerDashboardScope,
  type DatasetMeta,
  type WidgetCatalogEntry,
} from '../../../lib/dashboards/dashboardRegistry'

export const INTERNKONTROLL_SCOPE_ID = 'internkontroll'

const DATASETS: DatasetMeta[] = [
  {
    key: 'internkontroll_kpi_summary',
    label: 'Internkontroll — KPI-sammendrag',
    shape: 'kpi-record',
  },
  {
    key: 'internkontroll_framework_coverage',
    label: 'Internkontroll — dekning per regelverk',
    shape: 'segments',
  },
  {
    key: 'internkontroll_gap_matrix',
    label: 'Internkontroll — gap-matrise (§ × modul)',
    shape: 'kpi-record',
  },
  {
    key: 'internkontroll_recent_evidence',
    label: 'Internkontroll — siste aktivitet',
    shape: 'rows',
  },
]

// ── KPI strip ───────────────────────────────────────────────────────────────
const KPI_COVERAGE_PCT: ReportModuleKpi = {
  id: 'kpi-internkontroll-coverage-pct',
  kind: 'kpi',
  datasetKey: 'internkontroll_kpi_summary',
  title: 'Dekning %',
  valuePath: 'pctCoverage',
  subtitle: 'Paragraphs med ≥ 1 dekkende ressurs',
  colSpan: 'sm',
}
const KPI_COVERED: ReportModuleKpi = {
  id: 'kpi-internkontroll-covered',
  kind: 'kpi',
  datasetKey: 'internkontroll_kpi_summary',
  title: 'Dekket',
  valuePath: 'paragraphsCovered',
  subtitle: 'Antall paragrafer med dekning',
  colSpan: 'sm',
}
const KPI_UNCOVERED: ReportModuleKpi = {
  id: 'kpi-internkontroll-uncovered',
  kind: 'kpi',
  datasetKey: 'internkontroll_kpi_summary',
  title: 'Udekket',
  valuePath: 'paragraphsUncovered',
  subtitle: 'Paragraphs uten dekkende ressurs',
  comparisonGoal: 'decrease',
  colSpan: 'sm',
}
const KPI_OPEN_PLAN_ITEMS: ReportModuleKpi = {
  id: 'kpi-internkontroll-open-plan-items',
  kind: 'kpi',
  datasetKey: 'internkontroll_kpi_summary',
  title: 'Tiltak i arbeid',
  valuePath: 'openPlanItems',
  subtitle: 'Plan-tiltak med status pågående',
  colSpan: 'sm',
}

const BAR_FRAMEWORK_COVERAGE: ReportModuleBar = {
  id: 'bar-internkontroll-framework-coverage',
  kind: 'bar',
  datasetKey: 'internkontroll_framework_coverage',
  title: 'Dekning per regelverk',
  subtitle: '% paragrafer med ≥ 1 dekkende ressurs',
  seriesKeys: ['AML', 'IK-f', 'GDPR', 'Åpenhetsloven', 'ISO 45001'],
  drillDimensionId: 'framework',
  colSpan: 'full',
}

const HEATMAP_GAP_MATRIX: ReportModuleHeatmap = {
  id: 'heatmap-internkontroll-gap-matrix',
  kind: 'heatmap',
  datasetKey: 'internkontroll_gap_matrix',
  title: 'Gap-analyse — paragrafer × moduler',
  subtitle: 'Antall dekkende ressurser per § × modul. Klikk en celle for drill-down.',
  rowsPath: 'rows',
  columnsPath: 'columns',
  cellsPath: 'cells',
  valueLabel: 'ressurser',
  drillDimensionId: 'gap_cell',
  colSpan: 'full',
}

const TABLE_RECENT_EVIDENCE: ReportModuleTable = {
  id: 'table-internkontroll-recent-evidence',
  kind: 'table',
  datasetKey: 'internkontroll_recent_evidence',
  title: 'Siste aktivitet',
  subtitle: 'Maler og publiserte ressurser per paragraf',
  rowKeys: ['Paragraf', 'Modul', 'Type', 'Tittel'],
  colSpan: 'full',
}

const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_COVERAGE_PCT,
  KPI_COVERED,
  KPI_UNCOVERED,
  KPI_OPEN_PLAN_ITEMS,
  BAR_FRAMEWORK_COVERAGE,
  TABLE_RECENT_EVIDENCE,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    catalogId: 'kpi-internkontroll-coverage-pct',
    category: 'KPI',
    label: 'Dekning %',
    template: KPI_COVERAGE_PCT,
  },
  {
    catalogId: 'kpi-internkontroll-covered',
    category: 'KPI',
    label: 'Dekket (antall §)',
    template: KPI_COVERED,
  },
  {
    catalogId: 'kpi-internkontroll-uncovered',
    category: 'KPI',
    label: 'Udekket (antall §)',
    template: KPI_UNCOVERED,
  },
  {
    catalogId: 'kpi-internkontroll-open-plan-items',
    category: 'KPI',
    label: 'Tiltak i arbeid',
    template: KPI_OPEN_PLAN_ITEMS,
  },
  {
    catalogId: 'bar-internkontroll-framework-coverage',
    category: 'Diagrammer',
    label: 'Dekning per regelverk',
    template: BAR_FRAMEWORK_COVERAGE,
  },
  {
    catalogId: 'heatmap-internkontroll-gap-matrix',
    category: 'Diagrammer',
    label: 'Gap-matrise (§ × modul)',
    template: HEATMAP_GAP_MATRIX,
  },
  {
    catalogId: 'table-internkontroll-recent-evidence',
    category: 'Tabeller',
    label: 'Siste aktivitet',
    template: TABLE_RECENT_EVIDENCE,
  },
]

registerDashboardScope({
  scopeId: INTERNKONTROLL_SCOPE_ID,
  label: 'Internkontroll',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  // Audit-burgundy — reads as gravitas without alarm. Distinct from
  // compliance brand green, hms_overview indigo, and brand neutral.
  accent: '#7F1D1D',
  // Filter dimensions exposed to the dashboard editor. The framework
  // chip is also added inline by the two system-report renderers so
  // session-local filtering works even on the locked layouts.
  dimensions: [
    {
      id: 'framework',
      label: 'Regelverk',
      description: 'Begrenser dekning og gap-matrise til valgt regelverk.',
      kind: 'enum',
      defaultOperator: 'is',
      operatorOptions: ['is'],
      loadOptions: () => [
        { id: 'aml', label: 'AML — Arbeidsmiljøloven' },
        { id: 'ik-f', label: 'IK-f — Internkontrollforskriften' },
        { id: 'gdpr', label: 'GDPR — Personopplysningsloven' },
        { id: 'apenhetsloven', label: 'Åpenhetsloven' },
        { id: 'iso-45001', label: 'ISO 45001 — NS-EN ISO 45001:2018' },
      ],
    },
  ],
})
