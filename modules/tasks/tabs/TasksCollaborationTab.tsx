import { useMemo } from 'react'
import { Eye, MessageSquare, Users } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module'
import { Badge } from '../../../src/components/ui/Badge'
import type { Task } from '../../../src/types/task'
import { useOrganisation } from '../../../src/hooks/useOrganisation'
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  formatDueDate,
  priorityBadgeVariant,
  statusBadgeVariant,
} from '../taskUiHelpers'
import type { UseTaskExtensions } from '../useTaskExtensions'

type Props = {
  tasks: Task[]
  ext: UseTaskExtensions
  onOpenTask: (taskId: string) => void
}

/**
 * Per-employee workload + recent comment activity. Designed to satisfy
 * AML § 6-2 and § 7-2 — verneombud and AMU members can see at a glance who
 * carries which tasks, and how recently each was updated.
 */
export function TasksCollaborationTab({ tasks, ext, onOpenTask }: Props) {
  const org = useOrganisation()

  const groups = useMemo(() => {
    type Group = { key: string; name: string; assigned: Task[]; watching: Task[] }
    const map = new Map<string, Group>()
    const ensure = (key: string, name: string) => {
      let g = map.get(key)
      if (!g) {
        g = { key, name, assigned: [], watching: [] }
        map.set(key, g)
      }
      return g
    }

    for (const task of tasks) {
      const assignedKey = task.assigneeEmployeeId ?? `name:${task.assignee || 'Uten ansvarlig'}`
      ensure(assignedKey, task.assignee || 'Uten ansvarlig').assigned.push(task)

      const watchers = ext.taskExtensionMap.get(task.id)?.watchers ?? []
      for (const watcherId of watchers) {
        const employee = org.displayEmployees.find((e) => e.id === watcherId)
        ensure(watcherId, employee?.name ?? 'Watcher').watching.push(task)
      }
    }
    return [...map.values()].sort((a, b) => b.assigned.length - a.assigned.length)
  }, [tasks, ext.taskExtensionMap, org.displayEmployees])

  const recentComments = useMemo(() => {
    const out: Array<{ taskId: string; taskTitle: string; comment: { id: string; authorName: string; body: string; at: string } }> = []
    for (const task of tasks) {
      const e = ext.taskExtensionMap.get(task.id)
      if (!e) continue
      for (const c of e.comments) {
        out.push({ taskId: task.id, taskTitle: task.title, comment: c })
      }
    }
    return out
      .sort((a, b) => new Date(b.comment.at).getTime() - new Date(a.comment.at).getTime())
      .slice(0, 10)
  }, [tasks, ext.taskExtensionMap])

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <ModuleSectionCard className="p-5">
        <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <Users className="h-4 w-4 text-emerald-700" aria-hidden /> Arbeidsbelastning
        </h3>
        {groups.length === 0 ? (
          <p className="text-sm text-neutral-500">Ingen oppgaver er fordelt enda.</p>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.key} className="rounded-md border border-neutral-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-neutral-900">{g.name}</p>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span>
                      <strong className="text-neutral-900">{g.assigned.length}</strong> ansvarlig
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" aria-hidden />
                      <strong className="text-neutral-900">{g.watching.length}</strong> følger
                    </span>
                  </div>
                </div>
                {g.assigned.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {g.assigned.slice(0, 4).map((task) => {
                      const e = ext.taskExtensionMap.get(task.id)
                      return (
                        <li key={task.id}>
                          <button
                            type="button"
                            onClick={() => onOpenTask(task.id)}
                            className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-100 bg-neutral-50 p-2 text-left hover:bg-neutral-100"
                          >
                            <span className="truncate text-sm text-neutral-800">{task.title}</span>
                            <span className="flex items-center gap-2">
                              {e ? (
                                <Badge variant={priorityBadgeVariant(e.priority)} className="text-[10px]">
                                  {TASK_PRIORITY_LABELS[e.priority]}
                                </Badge>
                              ) : null}
                              <Badge variant={statusBadgeVariant(task.status)} className="text-[10px]">
                                {TASK_STATUS_LABELS[task.status]}
                              </Badge>
                              <span className="text-[11px] text-neutral-500">{formatDueDate(task.dueDate)}</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                    {g.assigned.length > 4 ? (
                      <li className="px-2 text-[11px] text-neutral-500">
                        +{g.assigned.length - 4} flere oppgaver…
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5">
        <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <MessageSquare className="h-4 w-4 text-emerald-700" aria-hidden /> Nylige kommentarer
        </h3>
        {recentComments.length === 0 ? (
          <p className="text-sm text-neutral-500">Ingen kommentarer registrert enda.</p>
        ) : (
          <ul className="space-y-2">
            {recentComments.map(({ taskId, taskTitle, comment }) => (
              <li key={comment.id}>
                <button
                  type="button"
                  onClick={() => onOpenTask(taskId)}
                  className="block w-full rounded-md border border-neutral-200 bg-white p-3 text-left hover:bg-neutral-50"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                    <span className="truncate font-medium text-neutral-900">{taskTitle}</span>
                    <span>{relativeTime(comment.at)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-700">{comment.body}</p>
                  <p className="mt-1 text-[11px] text-neutral-500">— {comment.authorName}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ModuleSectionCard>
    </div>
  )
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const seconds = Math.round(diff / 1000)
  if (seconds < 60) return `${seconds}s siden`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min siden`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} t siden`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} d siden`
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}
