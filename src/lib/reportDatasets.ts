import type { Task } from '../types/task'
import type { OrgEmployee, OrgUnit, OrgSettings } from '../types/organisation'
import type { ReportDatasetKey } from '../types/reportBuilder'

export type OrgSnapshot = {
  settings: OrgSettings
  employees: OrgEmployee[]
  units: OrgUnit[]
}

function taskStatusCounts(tasks: Task[]) {
  const todo = tasks.filter((t) => t.status === 'todo').length
  const prog = tasks.filter((t) => t.status === 'in_progress').length
  const done = tasks.filter((t) => t.status === 'done').length
  return { todo, in_progress: prog, done, total: tasks.length }
}

function pickSummary(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const o = obj as Record<string, unknown>
    const keys = Object.keys(o).slice(0, 8)
    const out: Record<string, unknown> = {}
    for (const k of keys) out[k] = o[k]
    return out
  }
  return { raw: obj }
}

export async function buildReportDatasets(input: {
  keys: ReportDatasetKey[]
  year: number
  org: OrgSnapshot
  tasks: Task[]
  fetchAmuAnnual: (y: number) => Promise<unknown | null>
  fetchAnnualIk: (y: number) => Promise<unknown | null>
  fetchArp: (y: number) => Promise<unknown | null>
  fetchSickByDept: (y: number, min: number) => Promise<unknown | null>
  fetchCorrelation: (y: number) => Promise<unknown | null>
  fetchCostFriction: (y: number) => Promise<unknown | null>
  fetchComplianceScore: () => Promise<unknown | null>
}): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  const need = new Set(input.keys)

  if (need.has('org_overview')) {
    const active = input.org.employees.filter((e) => e.active).length
    out.org_overview = {
      orgName: input.org.settings.orgName,
      activeEmployees: active,
      totalEmployees: input.org.employees.length,
      units: input.org.units.length,
    }
  }

  if (need.has('tasks_by_status')) {
    out.tasks_by_status = taskStatusCounts(input.tasks)
  }

  if (need.has('tasks_table')) {
    out.tasks_table = input.tasks.slice(0, 12).map((t) => ({
      title: t.title,
      status: t.status,
      assignee: t.assignee,
      module: t.module,
      dueDate: t.dueDate,
    }))
  }

  const jobs: Promise<void>[] = []

  if (need.has('compliance_score')) {
    jobs.push(
      (async () => {
        const d = await input.fetchComplianceScore()
        out.compliance_score = d ?? { message: 'Ingen data' }
      })(),
    )
  }
  if (need.has('amu_summary')) {
    jobs.push(
      (async () => {
        const d = await input.fetchAmuAnnual(input.year)
        out.amu_summary = pickSummary(d)
      })(),
    )
  }
  if (need.has('ik_summary')) {
    jobs.push(
      (async () => {
        const d = await input.fetchAnnualIk(input.year)
        out.ik_summary = pickSummary(d)
      })(),
    )
  }
  if (need.has('arp_summary')) {
    jobs.push(
      (async () => {
        const d = await input.fetchArp(input.year)
        out.arp_summary = pickSummary(d)
      })(),
    )
  }
  if (need.has('sick_leave_summary')) {
    jobs.push(
      (async () => {
        const d = await input.fetchSickByDept(input.year, 5)
        out.sick_leave_summary = pickSummary(d)
      })(),
    )
  }
  if (need.has('correlation_summary')) {
    jobs.push(
      (async () => {
        const d = await input.fetchCorrelation(input.year)
        out.correlation_summary = pickSummary(d)
      })(),
    )
  }
  if (need.has('cost_friction_summary')) {
    jobs.push(
      (async () => {
        const d = await input.fetchCostFriction(input.year)
        out.cost_friction_summary = pickSummary(d)
      })(),
    )
  }

  await Promise.all(jobs)
  return out
}

export function getAtPath(obj: unknown, path: string): unknown {
  if (!path) return undefined
  const parts = path.split('.').filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

export function numberAtPath(obj: unknown, path: string): number | null {
  const v = getAtPath(obj, path)
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return null
}
