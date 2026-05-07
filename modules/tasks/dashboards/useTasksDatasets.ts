// useTasksDatasets — extracted from TasksAnalysePage (3.5.1).
// Same shape as useChecklistDatasets / useSurveyDatasets / useLearningDatasets:
// take active filters + the source data the page already owns and return
// the scope's `Record<datasetKey, unknown>` map.

import { useMemo } from 'react'
import type { DashboardFilter } from '../../../src/lib/dashboards/dashboardFilters'
import type { DepartmentRow, OrganizationMemberRow } from '../../../src/types/organization'
import type {
  Task,
  TaskModule,
  TaskSourceType,
  TaskStatus,
} from '../../../src/types/task'
import type { UseTaskExtensions } from '../useTaskExtensions'
import type { TaskPriority } from '../types'

export const STATUS_OPTIONS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'Pågående' },
  { id: 'done', label: 'Fullført' },
]

export const MODULE_OPTIONS: { id: TaskModule; label: string }[] = [
  { id: 'general', label: 'Generelt' },
  { id: 'council', label: 'AMU' },
  { id: 'members', label: 'Medlemmer' },
  { id: 'org_health', label: 'Org-helse' },
  { id: 'hse', label: 'HMS' },
  { id: 'hrm', label: 'HRM' },
  { id: 'learning', label: 'Læring' },
]

export const SOURCE_OPTIONS: { id: TaskSourceType; label: string }[] = [
  { id: 'manual', label: 'Manuell' },
  { id: 'task_cosign_request', label: 'Co-sign' },
  { id: 'council_meeting', label: 'AMU-møte' },
  { id: 'council_compliance', label: 'AMU-compliance' },
  { id: 'representatives', label: 'Verneombud' },
  { id: 'survey', label: 'Undersøkelse' },
  { id: 'hse_safety_round', label: 'Vernerunde' },
  { id: 'hse_inspection', label: 'HMS-inspeksjon' },
  { id: 'hse_inspection_finding', label: 'HMS-funn' },
  { id: 'hse_incident', label: 'Hendelse' },
  { id: 'hse_sja', label: 'SJA' },
  { id: 'hse_sick_leave_milestone', label: 'Sykefravær-milepæl' },
  { id: 'nav_report', label: 'NAV-rapport' },
  { id: 'labor_metric', label: 'Arbeidstid-måling' },
  { id: 'learning_course', label: 'Læringskurs' },
  { id: 'ros_measure', label: 'ROS-tiltak' },
  { id: 'annual_review_action', label: 'Årsgjennomgang' },
]

export const PRIORITY_OPTIONS: { id: TaskPriority; label: string }[] = [
  { id: 'low', label: 'Lav' },
  { id: 'medium', label: 'Middels' },
  { id: 'high', label: 'Høy' },
  { id: 'critical', label: 'Kritisk' },
]

type FilterSelectors = {
  statuses: { ids: Set<TaskStatus>; mode: 'include' | 'exclude' } | null
  modules: { ids: Set<TaskModule>; mode: 'include' | 'exclude' } | null
  sources: { ids: Set<TaskSourceType>; mode: 'include' | 'exclude' } | null
  priorities: { ids: Set<TaskPriority>; mode: 'include' | 'exclude' } | null
  assignees: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  departments: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  dueFrom: Date | null
  dueTo: Date | null
}

function buildSelectors(filters: DashboardFilter[]): FilterSelectors {
  const out: FilterSelectors = {
    statuses: null,
    modules: null,
    sources: null,
    priorities: null,
    assignees: null,
    departments: null,
    dueFrom: null,
    dueTo: null,
  }
  const setOf = <T extends string>(v: unknown): Set<T> =>
    new Set(Array.isArray(v) ? (v as T[]) : typeof v === 'string' && v ? [v as T] : [])

  for (const f of filters) {
    const mode = f.operator === 'is_not' ? 'exclude' : 'include'
    if (f.dimensionId === 'status') {
      const ids = setOf<TaskStatus>(f.value)
      if (ids.size) out.statuses = { ids, mode }
    } else if (f.dimensionId === 'module') {
      const ids = setOf<TaskModule>(f.value)
      if (ids.size) out.modules = { ids, mode }
    } else if (f.dimensionId === 'source') {
      const ids = setOf<TaskSourceType>(f.value)
      if (ids.size) out.sources = { ids, mode }
    } else if (f.dimensionId === 'priority') {
      const ids = setOf<TaskPriority>(f.value)
      if (ids.size) out.priorities = { ids, mode }
    } else if (f.dimensionId === 'assignee') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.assignees = { ids, mode }
    } else if (f.dimensionId === 'department') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.departments = { ids, mode }
    } else if (f.dimensionId === 'due') {
      if (f.operator === 'between' && f.value && typeof f.value === 'object') {
        const r = f.value as { from?: string; to?: string }
        if (r.from) out.dueFrom = new Date(r.from)
        if (r.to) out.dueTo = new Date(r.to + 'T23:59:59')
      } else if (f.operator === 'after' && typeof f.value === 'string' && f.value) {
        out.dueFrom = new Date(f.value)
      } else if (f.operator === 'before' && typeof f.value === 'string' && f.value) {
        out.dueTo = new Date(f.value + 'T23:59:59')
      }
    }
  }
  return out
}

const matchesSet = <T,>(s: { ids: Set<T>; mode: 'include' | 'exclude' } | null, v: T): boolean => {
  if (!s) return true
  return s.mode === 'include' ? s.ids.has(v) : !s.ids.has(v)
}

const dateInRange = (d: Date | null, from: Date | null, to: Date | null): boolean => {
  if (!d) return true
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

export type TasksDatasetsArgs = {
  filters: DashboardFilter[]
  tasks: Task[]
  ext: UseTaskExtensions
  members: OrganizationMemberRow[]
  departments: DepartmentRow[]
}

export function useTasksDatasets({
  filters,
  tasks: rawTasks,
  ext,
  members,
  departments,
}: TasksDatasetsArgs): Record<string, unknown> {
  const departmentByEmployeeId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const member of members) {
      m.set(member.id, member.department_id)
    }
    return m
  }, [members])

  return useMemo(() => {
    const sel = buildSelectors(filters)
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const tasks = rawTasks.filter((t: Task) => {
      if (!matchesSet(sel.statuses, t.status)) return false
      if (!matchesSet(sel.modules, t.module)) return false
      if (!matchesSet(sel.sources, t.sourceType)) return false
      if (sel.priorities) {
        const p = ext.getExtension(t).priority
        if (!matchesSet(sel.priorities, p)) return false
      }
      if (sel.assignees) {
        if (!t.assigneeEmployeeId) {
          if (sel.assignees.mode === 'include') return false
        } else if (!matchesSet(sel.assignees, t.assigneeEmployeeId)) {
          return false
        }
      }
      if (sel.departments) {
        const dep = t.assigneeEmployeeId
          ? departmentByEmployeeId.get(t.assigneeEmployeeId) ?? null
          : null
        if (!dep) {
          if (sel.departments.mode === 'include') return false
        } else if (!matchesSet(sel.departments, dep)) {
          return false
        }
      }
      if (sel.dueFrom || sel.dueTo) {
        const dd = t.dueDate ? new Date(t.dueDate) : null
        if (!dateInRange(dd, sel.dueFrom, sel.dueTo)) return false
      }
      return true
    })

    let total = 0
    let open = 0
    let overdue = 0
    let completedYtd = 0
    let requiringSignOff = 0
    const statusCounts: Record<string, number> = { Todo: 0, Pågående: 0, Fullført: 0 }
    const moduleCounts = new Map<string, number>()
    const sourceCounts = new Map<string, number>()
    const priorityCounts: Record<string, number> = {
      Lav: 0,
      Middels: 0,
      Høy: 0,
      Kritisk: 0,
    }
    const assigneeCounts = new Map<string, number>()
    const departmentCounts = new Map<string, number>()

    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = (d: Date) =>
      d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })
    const months: { key: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: monthKey(d), label: monthLabel(d) })
    }
    const completedByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))
    const overdueByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))

    const moduleLabelById = new Map(MODULE_OPTIONS.map((o) => [o.id, o.label]))
    const sourceLabelById = new Map(SOURCE_OPTIONS.map((o) => [o.id, o.label]))
    const memberLabelById = new Map(members.map((m) => [m.id, m.display_name]))
    const departmentLabelById = new Map(departments.map((d) => [d.id, d.name]))

    for (const t of tasks) {
      total += 1
      const dueAt = t.dueDate ? new Date(t.dueDate) : null
      const completedAt = t.assigneeSignature?.signedAt
        ? new Date(t.assigneeSignature.signedAt)
        : null

      if (t.status === 'done') {
        statusCounts.Fullført = (statusCounts.Fullført ?? 0) + 1
        if (completedAt && completedAt >= yearStart) completedYtd += 1
        if (completedAt) {
          const k = monthKey(completedAt)
          if (completedByMonth.has(k))
            completedByMonth.set(k, (completedByMonth.get(k) ?? 0) + 1)
        }
      } else if (t.status === 'in_progress') {
        open += 1
        statusCounts.Pågående = (statusCounts.Pågående ?? 0) + 1
      } else {
        open += 1
        statusCounts.Todo = (statusCounts.Todo ?? 0) + 1
      }

      if (t.status !== 'done' && dueAt && dueAt < now) {
        overdue += 1
        const k = monthKey(dueAt)
        if (overdueByMonth.has(k))
          overdueByMonth.set(k, (overdueByMonth.get(k) ?? 0) + 1)
      }

      if (t.requiresManagementSignOff && !t.managementSignature) {
        requiringSignOff += 1
      }

      const modLabel = moduleLabelById.get(t.module) ?? t.module
      moduleCounts.set(modLabel, (moduleCounts.get(modLabel) ?? 0) + 1)

      const srcLabel = sourceLabelById.get(t.sourceType) ?? t.sourceType
      sourceCounts.set(srcLabel, (sourceCounts.get(srcLabel) ?? 0) + 1)

      const p = ext.getExtension(t).priority
      const priLabel =
        p === 'low' ? 'Lav' : p === 'medium' ? 'Middels' : p === 'high' ? 'Høy' : 'Kritisk'
      priorityCounts[priLabel] = (priorityCounts[priLabel] ?? 0) + 1

      if (t.assigneeEmployeeId) {
        const aLabel = memberLabelById.get(t.assigneeEmployeeId) ?? t.assignee
        assigneeCounts.set(aLabel, (assigneeCounts.get(aLabel) ?? 0) + 1)
      }

      const depId = t.assigneeEmployeeId
        ? departmentByEmployeeId.get(t.assigneeEmployeeId) ?? null
        : null
      const depLabel = depId
        ? departmentLabelById.get(depId) ?? '(ukjent)'
        : '(uten avdeling)'
      departmentCounts.set(depLabel, (departmentCounts.get(depLabel) ?? 0) + 1)
    }

    const topAssignees = [...assigneeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    const assigneeBar: Record<string, number> = {}
    for (const [name, count] of topAssignees) assigneeBar[name] = count

    const topSources = [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    const sourceBar: Record<string, number> = {}
    for (const [name, count] of topSources) sourceBar[name] = count

    return {
      tasks_kpi_summary: { total, open, overdue, completedYtd, requiringSignOff },
      tasks_status_distribution: statusCounts,
      tasks_module_distribution: Object.fromEntries(moduleCounts),
      tasks_source_distribution: sourceBar,
      tasks_priority_distribution: priorityCounts,
      tasks_distribution_by_assignee: assigneeBar,
      tasks_distribution_by_department: Object.fromEntries(departmentCounts),
      tasks_completed_over_time: months.map((m) => ({
        x: m.label,
        y: completedByMonth.get(m.key) ?? 0,
      })),
      tasks_overdue_over_time: months.map((m) => ({
        x: m.label,
        y: overdueByMonth.get(m.key) ?? 0,
      })),
    } as Record<string, unknown>
  }, [filters, rawTasks, ext, members, departments, departmentByEmployeeId])
}
