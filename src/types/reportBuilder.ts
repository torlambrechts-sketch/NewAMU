/**
 * Dataset key — the lookup key into the runtime's `datasets` map.
 *
 * Was a closed string union; opened to plain `string` so individual
 * scopes (compliance_checklist, survey, …) can register their own
 * keys without touching this core type. Convention: namespace with the
 * scope id, e.g. `checklist:executions_by_status`. Older keys without
 * the prefix continue to work since this is just a lookup string.
 */
export type ReportDatasetKey = string

export type ReportModuleKind = 'kpi' | 'table' | 'bar' | 'donut' | 'line'

/**
 * Widget layout hint, mapped to a 12-column responsive grid by the
 * dashboard runtime.
 *   sm    →  3 cols  (KPI tile, 4-up on lg)
 *   md    →  6 cols  (donut, bar — 2-up on lg)
 *   lg    →  9 cols  (wide chart with side legend)
 *   full  → 12 cols  (table, single highlight chart)
 * Defaults to 'md' when omitted so existing layouts keep their look.
 */
export type ReportModuleColSpan = 'sm' | 'md' | 'lg' | 'full'

export type ReportModuleBase = {
  id: string
  title: string
  /** Optional context line under the title (e.g. "Last 12 months · Grouped by pack"). */
  subtitle?: string
  datasetKey: ReportDatasetKey
  /** Visual width on the dashboard grid (lg breakpoint). */
  colSpan?: ReportModuleColSpan
  /** Force this widget to start on a new grid row (visual section break). */
  rowBreak?: boolean
}

export type ReportModuleKpi = ReportModuleBase & {
  kind: 'kpi'
  /** Dot-path into resolved dataset for numeric value, e.g. "activeEmployees" */
  valuePath: string
  subtitle?: string
}

export type ReportModuleTable = ReportModuleBase & {
  kind: 'table'
  rowKeys: string[]
}

export type ReportModuleBar = ReportModuleBase & {
  kind: 'bar'
  /** Keys in dataset object whose values are numbers */
  seriesKeys: string[]
}

export type ReportModuleDonut = ReportModuleBase & {
  kind: 'donut'
  /** Path to array of { label, value } */
  segmentsPath: string
}

export type ReportModuleLine = ReportModuleBase & {
  kind: 'line'
  /**
   * Path to an array of { x: string|number; y: number } points. When
   * empty string, the dataset itself is treated as the array.
   */
  pointsPath: string
  /** Optional axis labels. */
  xLabel?: string
  yLabel?: string
}

export type ReportModule =
  | ReportModuleKpi
  | ReportModuleTable
  | ReportModuleBar
  | ReportModuleDonut
  | ReportModuleLine

export type CustomReportTemplate = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  modules: ReportModule[]
  /** DB `report_definitions.version` for optimistic locking (remote only). */
  rowVersion?: number
}

export type ReportBuilderPayload = {
  templates: CustomReportTemplate[]
}
