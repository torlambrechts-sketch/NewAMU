// Checklist analytics scope registration.
//
// Registers `compliance_checklist` with the dashboard registry on
// module load. The default layout is the same set of widgets the
// analyse page used to ship hard-coded; the widget catalog adds a few
// more options (total executions, signed share, executions per pack
// donut, etc.) for the "Add Widget" UI to expose later.
//
// Datasets are computed by ChecklistsAnalysePage and handed to
// ModuleAnalyticsDashboard at render time — the registry stays static
// metadata so it can be imported anywhere without pulling Supabase.

import type {
  ReportModule,
  ReportModuleBar,
  ReportModuleComplianceParagraphGrid,
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

const DATASETS: DatasetMeta[] = [
  { key: 'checklist_kpi_summary', label: 'KPI-sammendrag', shape: 'kpi-record' },
  {
    key: 'checklist_executions_by_status',
    label: 'Kjøringer per status',
    shape: 'segments',
  },
  {
    key: 'checklist_findings_by_severity',
    label: 'Funn per alvorlighetsgrad',
    shape: 'segments',
  },
  {
    key: 'checklist_executions_by_template',
    label: 'Kjøringer per mal',
    shape: 'segments',
  },
  {
    key: 'checklist_executions_by_pack',
    label: 'Kjøringer per pakke',
    shape: 'segments',
  },
  {
    key: 'checklist_executions_over_time',
    label: 'Kjøringer over tid',
    shape: 'series',
  },
  {
    key: 'checklist_findings_over_time',
    label: 'Funn over tid',
    shape: 'series',
  },
  {
    key: 'checklist_executions_by_location',
    label: 'Kjøringer per lokasjon',
    shape: 'segments',
  },
  {
    key: 'checklist_executions_by_department',
    label: 'Kjøringer per avdeling',
    shape: 'segments',
  },
  {
    key: 'checklist_kpi_summary_prev',
    label: 'KPI-sammendrag (forrige periode)',
    shape: 'kpi-record',
  },
  {
    key: 'checklist_executions_over_time_prev',
    label: 'Kjøringer over tid (forrige periode)',
    shape: 'series',
  },
  {
    key: 'checklist_findings_over_time_prev',
    label: 'Funn over tid (forrige periode)',
    shape: 'series',
  },
  {
    // Compliance heat-map dataset: paragraph-level status grid derived
    // from the latest signed aml-fullgjennomgang execution (or aggregated
    // across all executions when no walkthrough exists). Shape:
    //   { paragraphs: Array<{ id, label?, chapter, status, artefactCount?, route? }> }
    // Consumed by `compliance_paragraph_grid` widget kind. Reused by the
    // hms_overview composite scope (scope-namespaced merge — no collisions).
    key: 'compliance_paragraph_grid_aml',
    label: 'AML — paragrafdekning (rutenett)',
    shape: 'rows',
  },
]

export const CHECKLIST_DASHBOARD_SCOPE_ID = 'compliance_checklist'

const KPI_TOTAL: ReportModuleKpi = {
  id: 'kpi-total',
  kind: 'kpi',
  datasetKey: 'checklist_kpi_summary',
  title: 'Totalt antall sjekklister',
  valuePath: 'total',
  subtitle: 'Alle aktive (ikke arkiverte) kjøringer',
  colSpan: 'sm',
}
const KPI_OPEN: ReportModuleKpi = {
  id: 'kpi-open',
  kind: 'kpi',
  datasetKey: 'checklist_kpi_summary',
  title: 'Åpne / under arbeid',
  valuePath: 'open',
  subtitle: 'Status kladd eller aktiv',
  colSpan: 'sm',
}
const KPI_YTD: ReportModuleKpi = {
  id: 'kpi-ytd',
  kind: 'kpi',
  datasetKey: 'checklist_kpi_summary',
  title: 'Signert i år',
  valuePath: 'ytd',
  subtitle: 'YTD signerte runder',
  colSpan: 'sm',
  comparisonDatasetKey: 'checklist_kpi_summary_prev',
  comparisonValuePath: 'ytd',
  comparisonLabel: 'vs. samme periode i fjor',
  comparisonGoal: 'increase',
  sparklineDatasetKey: 'checklist_executions_over_time',
  sparklinePath: '',
}
const KPI_CRITICAL: ReportModuleKpi = {
  id: 'kpi-critical',
  kind: 'kpi',
  datasetKey: 'checklist_kpi_summary',
  title: 'Kritiske funn',
  valuePath: 'critical',
  subtitle: 'Krever oppfølging',
  colSpan: 'sm',
  comparisonDatasetKey: 'checklist_kpi_summary_prev',
  comparisonValuePath: 'critical',
  comparisonLabel: 'vs. samme periode i fjor',
  comparisonGoal: 'decrease',
  sparklineDatasetKey: 'checklist_findings_over_time',
  sparklinePath: '',
}
const KPI_FINDINGS: ReportModuleKpi = {
  id: 'kpi-findings',
  kind: 'kpi',
  datasetKey: 'checklist_kpi_summary',
  title: 'Totalt antall funn',
  valuePath: 'findings',
  subtitle: 'Alle alvorlighetsgrader',
  colSpan: 'sm',
}
const KPI_SIGNED: ReportModuleKpi = {
  id: 'kpi-signed',
  kind: 'kpi',
  datasetKey: 'checklist_kpi_summary',
  title: 'Signerte sjekklister',
  valuePath: 'signed',
  subtitle: 'Ferdig dokumentert',
  colSpan: 'sm',
}
const LINE_EXEC_OVER_TIME: ReportModuleLine = {
  id: 'line-exec-over-time',
  kind: 'line',
  datasetKey: 'checklist_executions_over_time',
  title: 'Sjekklister over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'md',
  comparisonDatasetKey: 'checklist_executions_over_time_prev',
  comparisonPointsPath: '',
  primaryLabel: 'Siste 12 mnd.',
  comparisonLabel: '12 mnd. tilbake',
}
const LINE_FINDINGS_OVER_TIME: ReportModuleLine = {
  id: 'line-findings-over-time',
  kind: 'line',
  datasetKey: 'checklist_findings_over_time',
  title: 'Funn over tid',
  pointsPath: '',
  xLabel: 'Måned',
  yLabel: 'Antall',
  colSpan: 'md',
  comparisonDatasetKey: 'checklist_findings_over_time_prev',
  comparisonPointsPath: '',
  primaryLabel: 'Siste 12 mnd.',
  comparisonLabel: '12 mnd. tilbake',
}
const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status',
  kind: 'donut',
  datasetKey: 'checklist_executions_by_status',
  title: 'Fordeling per status',
  segmentsPath: '',
  colSpan: 'md',
  drillDimensionId: 'status',
}
const DONUT_LOCATION: ReportModuleDonut = {
  id: 'donut-location',
  kind: 'donut',
  datasetKey: 'checklist_executions_by_location',
  title: 'Fordeling per lokasjon',
  segmentsPath: '',
  colSpan: 'md',
  drillDimensionId: 'location',
}
const DONUT_DEPARTMENT: ReportModuleDonut = {
  id: 'donut-department',
  kind: 'donut',
  datasetKey: 'checklist_executions_by_department',
  title: 'Fordeling per avdeling',
  segmentsPath: '',
  colSpan: 'md',
  drillDimensionId: 'department',
}
const BAR_LOCATION: ReportModuleBar = {
  id: 'bar-location',
  kind: 'bar',
  datasetKey: 'checklist_executions_by_location',
  title: 'Kjøringer per lokasjon',
  seriesKeys: [],
  colSpan: 'md',
  drillDimensionId: 'location',
}
const BAR_DEPARTMENT: ReportModuleBar = {
  id: 'bar-department',
  kind: 'bar',
  datasetKey: 'checklist_executions_by_department',
  title: 'Kjøringer per avdeling',
  seriesKeys: [],
  colSpan: 'md',
  drillDimensionId: 'department',
}
const DONUT_PACK: ReportModuleDonut = {
  id: 'donut-pack',
  kind: 'donut',
  datasetKey: 'checklist_executions_by_pack',
  title: 'Fordeling per regulativ pakke',
  segmentsPath: '',
  colSpan: 'md',
  drillDimensionId: 'pack',
}
const BAR_SEVERITY: ReportModuleBar = {
  id: 'bar-severity',
  kind: 'bar',
  datasetKey: 'checklist_findings_by_severity',
  title: 'Funn per alvorlighetsgrad',
  seriesKeys: ['Lav', 'Middels', 'Høy', 'Kritisk'],
  colSpan: 'md',
  drillDimensionId: 'severity',
}
const BAR_TEMPLATE: ReportModuleBar = {
  id: 'bar-template',
  kind: 'bar',
  datasetKey: 'checklist_executions_by_template',
  title: 'Mest brukte maler (topp 8)',
  // seriesKeys for bar widgets are computed at render time from the
  // dataset keys — the catalog version intentionally leaves it empty
  // so an instantiated copy reads "all keys" by default.
  seriesKeys: [],
  colSpan: 'md',
  drillDimensionId: 'template',
}
const TABLE_TEMPLATE: ReportModuleTable = {
  id: 'table-template',
  kind: 'table',
  datasetKey: 'checklist_executions_by_template',
  title: 'Maler — tabell',
  rowKeys: [],
  colSpan: 'full',
}
const PARAGRAPH_GRID_AML: ReportModuleComplianceParagraphGrid = {
  id: 'paragraph-grid-aml',
  kind: 'compliance_paragraph_grid',
  datasetKey: 'compliance_paragraph_grid_aml',
  title: 'AML — paragrafdekning',
  subtitle: 'Hver paragraf farget etter status i siste signerte gjennomgang',
  colSpan: 'full',
  hideEmptyChapters: true,
  drillDimensionId: 'law_ref',
}

// Best-practice default layout: dense KPI strip, then a wide trend line,
// then split donut + bar breakdowns, then a final wide chart.
const DEFAULT_LAYOUT: ReportModule[] = [
  KPI_TOTAL,
  KPI_OPEN,
  KPI_YTD,
  KPI_CRITICAL,
  LINE_EXEC_OVER_TIME,
  DONUT_STATUS,
  BAR_SEVERITY,
  BAR_TEMPLATE,
]

const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    catalogId: 'kpi-total',
    category: 'Volum',
    label: 'Totalt antall sjekklister',
    description: 'Alle aktive kjøringer i organisasjonen.',
    template: KPI_TOTAL,
  },
  {
    catalogId: 'kpi-open',
    category: 'Volum',
    label: 'Åpne / under arbeid',
    template: KPI_OPEN,
  },
  {
    catalogId: 'kpi-signed',
    category: 'Volum',
    label: 'Signerte sjekklister',
    template: KPI_SIGNED,
  },
  {
    catalogId: 'kpi-ytd',
    category: 'Volum',
    label: 'Signert i år',
    template: KPI_YTD,
  },
  {
    catalogId: 'kpi-findings',
    category: 'Funn',
    label: 'Totalt antall funn',
    template: KPI_FINDINGS,
  },
  {
    catalogId: 'kpi-critical',
    category: 'Funn',
    label: 'Kritiske funn',
    template: KPI_CRITICAL,
  },
  {
    catalogId: 'donut-status',
    category: 'Diagrammer',
    label: 'Status — kakediagram',
    description: 'Kakediagram av kjøringer fordelt på status.',
    template: DONUT_STATUS,
  },
  {
    catalogId: 'donut-pack',
    category: 'Diagrammer',
    label: 'Pakke — kakediagram',
    description: 'Kjøringer fordelt på regulativ pakke (AML, ISO, …).',
    template: DONUT_PACK,
  },
  {
    catalogId: 'bar-severity',
    category: 'Diagrammer',
    label: 'Funn per alvorlighetsgrad',
    template: BAR_SEVERITY,
  },
  {
    catalogId: 'bar-template',
    category: 'Diagrammer',
    label: 'Topp brukte maler — søylediagram',
    template: BAR_TEMPLATE,
  },
  {
    catalogId: 'table-template',
    category: 'Tabeller',
    label: 'Maler — tabell',
    description: 'Alle maler med antall kjøringer i en tabell.',
    template: TABLE_TEMPLATE,
  },
  {
    catalogId: 'line-exec-over-time',
    category: 'Trend',
    label: 'Sjekklister over tid',
    description: 'Antall opprettede sjekklister per måned siste 12 mnd.',
    template: LINE_EXEC_OVER_TIME,
  },
  {
    catalogId: 'line-findings-over-time',
    category: 'Trend',
    label: 'Funn over tid',
    description: 'Antall registrerte funn per måned siste 12 mnd.',
    template: LINE_FINDINGS_OVER_TIME,
  },
  {
    catalogId: 'donut-location',
    category: 'Org-kontekst',
    label: 'Lokasjon — kakediagram',
    description: 'Kjøringer fordelt på lokasjon (krever at malen har lokasjon-felt).',
    template: DONUT_LOCATION,
  },
  {
    catalogId: 'donut-department',
    category: 'Org-kontekst',
    label: 'Avdeling — kakediagram',
    description: 'Kjøringer fordelt på avdeling (krever at malen har avdeling-felt).',
    template: DONUT_DEPARTMENT,
  },
  {
    catalogId: 'bar-location',
    category: 'Org-kontekst',
    label: 'Lokasjon — søylediagram',
    template: BAR_LOCATION,
  },
  {
    catalogId: 'bar-department',
    category: 'Org-kontekst',
    label: 'Avdeling — søylediagram',
    template: BAR_DEPARTMENT,
  },
  {
    catalogId: 'paragraph-grid-aml',
    category: 'Compliance',
    label: 'AML — paragrafdekning (rutenett)',
    description:
      'Heat-map med alle AML-paragrafer farget etter status i siste signerte fullgjennomgang. Klikk en celle for å filtrere analysen til den paragrafen.',
    template: PARAGRAPH_GRID_AML,
  },
]

registerDashboardScope({
  scopeId: CHECKLIST_DASHBOARD_SCOPE_ID,
  label: 'Sjekklister',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
  datasets: DATASETS,
  // Dimensions are declared by the page (ChecklistsAnalysePage) because
  // their loadOptions need live org data (pack list, template list).
  accent: '#1a3d32', // brand green — default; ChecklistsAnalysePage flips
                     // to a pack-specific colour when ?pack= is active
                     // (see PACK_ACCENTS in modules/compliance/dashboards/packAccents.ts).
})
