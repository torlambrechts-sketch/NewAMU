import type { ReportDatasetKey, ReportModule, ReportModuleKind } from '../types/reportBuilder'

export const DATASET_OPTIONS: { value: ReportDatasetKey; label: string }[] = [
  { value: 'org_overview', label: 'Organisasjon — oversikt' },
  { value: 'tasks_by_status', label: 'Oppgaver — statusfordeling' },
  { value: 'tasks_table', label: 'Oppgaver — tabell' },
  { value: 'compliance_score', label: 'Compliance-score (RPC)' },
  { value: 'amu_summary', label: 'AMU — sammendrag (RPC)' },
  { value: 'ik_summary', label: 'Årlig gjennomgang — sammendrag (RPC)' },
  { value: 'arp_summary', label: 'ARP — sammendrag (RPC)' },
  { value: 'sick_leave_summary', label: 'Sykefravær — sammendrag (RPC)' },
  { value: 'correlation_summary', label: 'Korrelasjon — sammendrag (RPC)' },
  { value: 'cost_friction_summary', label: 'Cost of friction — sammendrag (RPC)' },
]

export const KPI_PATHS: Partial<Record<ReportDatasetKey, { path: string; label: string }[]>> = {
  org_overview: [
    { path: 'activeEmployees', label: 'Aktive ansatte' },
    { path: 'totalEmployees', label: 'Ansatte totalt' },
    { path: 'units', label: 'Enheter' },
  ],
  tasks_by_status: [
    { path: 'total', label: 'Oppgaver totalt' },
    { path: 'todo', label: 'To do' },
    { path: 'in_progress', label: 'Pågår' },
    { path: 'done', label: 'Ferdig' },
  ],
}

export const TABLE_COLUMNS: Partial<Record<ReportDatasetKey, string[]>> = {
  tasks_table: ['title', 'status', 'assignee', 'module', 'dueDate'],
}

export const BAR_SERIES_PRESETS: Partial<Record<ReportDatasetKey, string[]>> = {
  tasks_by_status: ['todo', 'in_progress', 'done'],
}

export function newModuleId() {
  return crypto.randomUUID()
}

export function createDefaultModule(kind: ReportModuleKind): ReportModule {
  const id = newModuleId()
  switch (kind) {
    case 'kpi':
      return {
        id,
        kind: 'kpi',
        title: 'Ny nøkkeltall',
        datasetKey: 'org_overview',
        valuePath: 'activeEmployees',
        subtitle: 'Aktive ansatte',
      }
    case 'table':
      return {
        id,
        kind: 'table',
        title: 'Oppgaveliste',
        datasetKey: 'tasks_table',
        rowKeys: ['title', 'status', 'assignee'],
      }
    case 'bar':
      return {
        id,
        kind: 'bar',
        title: 'Statusfordeling',
        datasetKey: 'tasks_by_status',
        seriesKeys: ['todo', 'in_progress', 'done'],
      }
    case 'donut':
      return {
        id,
        kind: 'donut',
        title: 'Oppgaver fordelt',
        datasetKey: 'tasks_by_status',
        segmentsPath: '',
      }
    default:
      return {
        id,
        kind: 'kpi',
        title: 'Ny nøkkeltall',
        datasetKey: 'org_overview',
        valuePath: 'activeEmployees',
      }
  }
}
