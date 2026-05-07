export type ReportDatasetKey =
  | 'org_overview'
  | 'tasks_by_status'
  | 'tasks_table'
  | 'compliance_score'
  | 'amu_summary'
  | 'ik_summary'
  | 'arp_summary'
  | 'sick_leave_summary'
  | 'correlation_summary'
  | 'cost_friction_summary'
  | 'checklist_kpi_summary'
  | 'checklist_executions_by_status'
  | 'checklist_findings_by_severity'
  | 'checklist_executions_by_template'
  | 'checklist_executions_by_pack'
  | 'checklist_executions_over_time'
  | 'checklist_findings_over_time'

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
  datasetKey: ReportDatasetKey
  /** Visual width on the dashboard grid (lg breakpoint). */
  colSpan?: ReportModuleColSpan
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
