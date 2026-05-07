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
  ReportModuleDonut,
  ReportModuleKpi,
  ReportModuleLine,
  ReportModuleTable,
} from '../../../src/types/reportBuilder'
import {
  registerDashboardScope,
  type WidgetCatalogEntry,
} from '../../../src/lib/dashboards/dashboardRegistry'

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
}
const KPI_CRITICAL: ReportModuleKpi = {
  id: 'kpi-critical',
  kind: 'kpi',
  datasetKey: 'checklist_kpi_summary',
  title: 'Kritiske funn',
  valuePath: 'critical',
  subtitle: 'Krever oppfølging',
  colSpan: 'sm',
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
}
const DONUT_STATUS: ReportModuleDonut = {
  id: 'donut-status',
  kind: 'donut',
  datasetKey: 'checklist_executions_by_status',
  title: 'Fordeling per status',
  segmentsPath: '',
  colSpan: 'md',
}
const DONUT_PACK: ReportModuleDonut = {
  id: 'donut-pack',
  kind: 'donut',
  datasetKey: 'checklist_executions_by_pack',
  title: 'Fordeling per regulativ pakke',
  segmentsPath: '',
  colSpan: 'md',
}
const BAR_SEVERITY: ReportModuleBar = {
  id: 'bar-severity',
  kind: 'bar',
  datasetKey: 'checklist_findings_by_severity',
  title: 'Funn per alvorlighetsgrad',
  seriesKeys: ['Lav', 'Middels', 'Høy', 'Kritisk'],
  colSpan: 'md',
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
}
const TABLE_TEMPLATE: ReportModuleTable = {
  id: 'table-template',
  kind: 'table',
  datasetKey: 'checklist_executions_by_template',
  title: 'Maler — tabell',
  rowKeys: [],
  colSpan: 'full',
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
]

registerDashboardScope({
  scopeId: CHECKLIST_DASHBOARD_SCOPE_ID,
  label: 'Sjekklister',
  defaultLayout: DEFAULT_LAYOUT,
  widgetCatalog: WIDGET_CATALOG,
})
