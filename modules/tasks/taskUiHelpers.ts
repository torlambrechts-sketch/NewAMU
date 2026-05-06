import type { Task, TaskStatus } from '../../src/types/task'
import type { BadgeVariant } from '../../src/components/ui/Badge'
import type { TaskExtension, TaskPriority } from './types'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Å gjøre',
  in_progress: 'Pågår',
  done: 'Fullført',
}

export const TASK_STATUS_ORDER: ReadonlyArray<TaskStatus> = ['todo', 'in_progress', 'done']

export function statusBadgeVariant(status: TaskStatus): BadgeVariant {
  if (status === 'done') return 'success'
  if (status === 'in_progress') return 'info'
  return 'neutral'
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
}

export function priorityBadgeVariant(p: TaskPriority): BadgeVariant {
  if (p === 'critical') return 'critical'
  if (p === 'high') return 'high'
  if (p === 'medium') return 'medium'
  return 'neutral'
}

export const PRIORITY_RANK: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function formatDueDate(d: string): string {
  if (!d || d === '—') return '—'
  const t = new Date(d)
  if (Number.isNaN(t.getTime())) return d
  return t.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function isOverdue(task: Task, now: number = Date.now()): boolean {
  if (task.status === 'done') return false
  if (!task.dueDate || task.dueDate === '—') return false
  const t = new Date(task.dueDate).getTime()
  if (Number.isNaN(t)) return false
  return t < now
}

export function daysUntilDue(task: Task, now: number = Date.now()): number | null {
  if (!task.dueDate || task.dueDate === '—') return null
  const t = new Date(task.dueDate).getTime()
  if (Number.isNaN(t)) return null
  return Math.round((t - now) / (1000 * 60 * 60 * 24))
}

/**
 * Combined sort: critical-first, then overdue-first within same priority,
 * then earliest due date. Stable, deterministic — used by every list/board.
 */
export function sortTasksForBoard(tasks: Task[], extById: Map<string, TaskExtension>): Task[] {
  const now = Date.now()
  return [...tasks].sort((a, b) => {
    const pa = extById.get(a.id)?.priority ?? 'medium'
    const pb = extById.get(b.id)?.priority ?? 'medium'
    if (PRIORITY_RANK[pa] !== PRIORITY_RANK[pb]) return PRIORITY_RANK[pa] - PRIORITY_RANK[pb]
    const oa = isOverdue(a, now) ? 0 : 1
    const ob = isOverdue(b, now) ? 0 : 1
    if (oa !== ob) return oa - ob
    const ta = new Date(a.dueDate).getTime()
    const tb = new Date(b.dueDate).getTime()
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
    if (Number.isNaN(ta)) return 1
    if (Number.isNaN(tb)) return -1
    return ta - tb
  })
}

/** Subtask completion percent (0–100). 0 when no subtasks. */
export function subtaskProgressPercent(ext: TaskExtension): number {
  if (ext.subtasks.length === 0) return 0
  const done = ext.subtasks.filter((s) => s.done).length
  return Math.round((done / ext.subtasks.length) * 100)
}
