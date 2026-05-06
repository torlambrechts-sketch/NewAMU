import type { Task, TaskStatus } from '../../src/types/task'

/**
 * Klarert task management module — extended types.
 *
 * The core {@link Task} record stays the system of record (signatures, audit log,
 * Level 1 evidence). This module adds non-signed planning metadata on top:
 * priority, labels, project / milestone grouping, time estimates, dependencies,
 * watchers and threaded comments. Extension data is stored client-side per org
 * via {@link OrgModulePayloadKey} `tasks` co-tenant store, so it never breaks the
 * signed envelope of the underlying task.
 */

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export const TASK_PRIORITY_OPTIONS: ReadonlyArray<{ value: TaskPriority; label: string }> = [
  { value: 'low', label: 'Lav' },
  { value: 'medium', label: 'Middels' },
  { value: 'high', label: 'Høy' },
  { value: 'critical', label: 'Kritisk' },
]

export type TaskMethodology = 'kanban' | 'scrum' | 'waterfall'

export const TASK_METHODOLOGY_OPTIONS: ReadonlyArray<{ value: TaskMethodology; label: string; sub: string }> = [
  { value: 'kanban', label: 'Kanban', sub: 'Kontinuerlig flyt med WIP-grenser (anbefalt for HMS-oppfølging)' },
  { value: 'scrum', label: 'Scrum', sub: 'Tidsbokset sprint med faste mål og restropektiv' },
  { value: 'waterfall', label: 'Faseplan', sub: 'Sekvensiell planlegging med milepæler (egnet for større prosjekter)' },
]

export type TaskCommentEntry = {
  id: string
  authorName: string
  authorUserId?: string
  body: string
  at: string
}

export type TaskSubtask = {
  id: string
  title: string
  done: boolean
}

export type TaskExtension = {
  /** Foreign key — matches Task.id one-to-one. */
  taskId: string
  priority: TaskPriority
  labels: string[]
  projectId?: string
  milestoneId?: string
  /** Estimated effort in hours. */
  estimateHours?: number
  /** Logged effort in hours. */
  spentHours?: number
  /** Other Task.id values this task depends on. */
  dependsOn: string[]
  /** Employee ids subscribed to changes. */
  watchers: string[]
  comments: TaskCommentEntry[]
  subtasks: TaskSubtask[]
}

export type TaskMilestone = {
  id: string
  projectId: string
  name: string
  description?: string
  dueDate: string
}

export type TaskProject = {
  id: string
  name: string
  description: string
  methodology: TaskMethodology
  /** Optional overall start / target dates for waterfall planning. */
  startDate?: string
  endDate?: string
  /** Members (employee ids) collaborating on the project. */
  memberEmployeeIds: string[]
  /** Per-status WIP limits — empty values disable the cap. */
  wipLimits: Partial<Record<TaskStatus, number>>
  /** Sprint length in days when methodology = scrum. */
  sprintLengthDays?: number
  createdAt: string
}

export type TaskModuleStore = {
  extensions: Record<string, TaskExtension>
  projects: TaskProject[]
  milestones: TaskMilestone[]
}

export const EMPTY_TASK_MODULE_STORE: TaskModuleStore = {
  extensions: {},
  projects: [],
  milestones: [],
}

/**
 * Default extension applied to a task that has not yet been touched by the
 * management module. Every task has *at least* a priority so Kanban/Planning
 * views never need to defensively branch.
 */
export function defaultExtensionFor(task: Task): TaskExtension {
  return {
    taskId: task.id,
    priority: task.requiresManagementSignOff ? 'high' : 'medium',
    labels: [],
    dependsOn: [],
    watchers: [],
    comments: [],
    subtasks: [],
  }
}

export const TASK_DEFAULT_LABEL_SUGGESTIONS = [
  'AML',
  'IK-forskriften',
  'HMS',
  'Personvern',
  'Risikovurdering',
  'Vernerunde',
  'AMU',
  'Tiltaksplan',
  'Sykefravær',
] as const
