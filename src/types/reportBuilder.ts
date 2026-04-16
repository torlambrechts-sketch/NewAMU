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

export type ReportModuleKind = 'kpi' | 'table' | 'bar' | 'donut'

export type ReportModuleBase = {
  id: string
  title: string
  datasetKey: ReportDatasetKey
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

export type ReportModule = ReportModuleKpi | ReportModuleTable | ReportModuleBar | ReportModuleDonut

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
