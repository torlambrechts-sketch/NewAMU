import { useCallback, useMemo, useState, type DragEvent } from 'react'
import { AlertTriangle, MessageSquare, Paperclip, User } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module'
import { Badge } from '../../../src/components/ui/Badge'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardInput } from '../../../src/components/ui/Input'
import type { Task, TaskStatus } from '../../../src/types/task'
import { MODULE_LABELS } from '../../../src/lib/taskNavigation'
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  TASK_PRIORITY_LABELS,
  formatDueDate,
  isOverdue,
  priorityBadgeVariant,
  sortTasksForBoard,
  subtaskProgressPercent,
} from '../taskUiHelpers'
import type { UseTaskExtensions } from '../useTaskExtensions'

const PROJECT_FILTER_NONE = '__none__'
const PROJECT_FILTER_ALL = '__all__'

type Props = {
  tasks: Task[]
  ext: UseTaskExtensions
  onSetStatus: (taskId: string, status: TaskStatus) => void
  onOpenTask: (taskId: string) => void
}

/**
 * HTML5-DnD Kanban board grouped by status. Columns surface WIP-limit
 * warnings (kanban core practice) when the configured project's `wipLimits`
 * are exceeded. Cards link straight to the detail panel so users can edit
 * priority, watchers and comments without leaving the board.
 */
export function TasksKanbanTab({ tasks, ext, onSetStatus, onOpenTask }: Props) {
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>(PROJECT_FILTER_ALL)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverColumn, setHoverColumn] = useState<TaskStatus | null>(null)

  const projectOptions = useMemo(
    () => [
      { value: PROJECT_FILTER_ALL, label: 'Alle prosjekter' },
      { value: PROJECT_FILTER_NONE, label: 'Uten prosjekt' },
      ...ext.projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [ext.projects],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((task) => {
      if (q) {
        const hay = `${task.title} ${task.description} ${task.assignee} ${task.ownerRole}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (projectFilter === PROJECT_FILTER_ALL) return true
      const tExt = ext.taskExtensionMap.get(task.id)
      if (projectFilter === PROJECT_FILTER_NONE) return !tExt?.projectId
      return tExt?.projectId === projectFilter
    })
  }, [tasks, ext.taskExtensionMap, search, projectFilter])

  const grouped = useMemo(() => {
    const out: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] }
    for (const t of filtered) out[t.status].push(t)
    for (const key of TASK_STATUS_ORDER) {
      out[key] = sortTasksForBoard(out[key], ext.taskExtensionMap)
    }
    return out
  }, [filtered, ext.taskExtensionMap])

  const wipLimitsForProject = useMemo(() => {
    if (projectFilter === PROJECT_FILTER_ALL || projectFilter === PROJECT_FILTER_NONE) return null
    const project = ext.projects.find((p) => p.id === projectFilter)
    return project?.wipLimits ?? null
  }, [projectFilter, ext.projects])

  const handleDragStart = useCallback((id: string) => {
    setDraggingId(id)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggingId(null)
    setHoverColumn(null)
  }, [])

  const handleDrop = useCallback(
    (status: TaskStatus, e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (!draggingId) return
      const task = tasks.find((t) => t.id === draggingId)
      if (task && task.status !== status) onSetStatus(draggingId, status)
      setDraggingId(null)
      setHoverColumn(null)
    },
    [draggingId, tasks, onSetStatus],
  )

  return (
    <ModuleSectionCard className="p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-sm font-semibold text-neutral-800">Tavle (Kanban)</h3>
        <div className="flex flex-wrap items-center gap-2">
          <StandardInput
            type="search"
            placeholder="Søk i oppgaver…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64"
          />
          <div className="w-full md:w-56">
            <SearchableSelect
              value={projectFilter}
              options={projectOptions}
              onChange={setProjectFilter}
              placeholder="Filtrer prosjekt"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {TASK_STATUS_ORDER.map((status) => {
          const items = grouped[status]
          const limit = wipLimitsForProject?.[status]
          const overLimit = typeof limit === 'number' && status !== 'done' && items.length > limit
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault()
                if (hoverColumn !== status) setHoverColumn(status)
              }}
              onDragLeave={(e) => {
                if (e.currentTarget === e.target) setHoverColumn(null)
              }}
              onDrop={(e) => handleDrop(status, e)}
              className={`flex min-h-[16rem] flex-col rounded-lg border bg-neutral-50 p-2 transition-colors ${
                hoverColumn === status
                  ? 'border-[#1a3d32]/40 bg-emerald-50/40'
                  : overLimit
                    ? 'border-amber-300'
                    : 'border-neutral-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-1.5 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                    {TASK_STATUS_LABELS[status]}
                  </span>
                  <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                    {items.length}
                  </span>
                </div>
                {typeof limit === 'number' ? (
                  <span
                    className={`text-[10px] font-semibold ${
                      overLimit ? 'text-amber-700' : 'text-neutral-500'
                    }`}
                  >
                    WIP {items.length}/{limit}
                  </span>
                ) : null}
              </div>
              {overLimit ? (
                <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  WIP-grense overskredet — fullfør pågående oppgaver før nye startes.
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                {items.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    extension={ext.taskExtensionMap.get(task.id)}
                    isDragging={draggingId === task.id}
                    onClick={() => onOpenTask(task.id)}
                    onDragStart={() => handleDragStart(task.id)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
                {items.length === 0 ? (
                  <div className="rounded-md border border-dashed border-neutral-300 bg-white/50 p-3 text-center text-xs text-neutral-500">
                    Slipp en oppgave her
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </ModuleSectionCard>
  )
}

type KanbanCardProps = {
  task: Task
  extension: ReturnType<UseTaskExtensions['getExtension']> | undefined
  isDragging: boolean
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
}

function KanbanCard({ task, extension, isDragging, onClick, onDragStart, onDragEnd }: KanbanCardProps) {
  const overdue = isOverdue(task)
  const subtaskPercent = extension ? subtaskProgressPercent(extension) : 0

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={`cursor-grab rounded-md border bg-white p-3 text-left shadow-sm transition-shadow hover:shadow ${
        isDragging ? 'opacity-50' : ''
      } ${overdue ? 'border-red-200' : 'border-neutral-200'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium text-neutral-900">{task.title}</p>
        {extension ? (
          <Badge variant={priorityBadgeVariant(extension.priority)} className="shrink-0 text-[10px]">
            {TASK_PRIORITY_LABELS[extension.priority]}
          </Badge>
        ) : null}
      </div>
      {extension && extension.labels.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {extension.labels.slice(0, 4).map((label) => (
            <span
              key={label}
              className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <User className="h-3 w-3" aria-hidden />
          {task.assignee}
        </span>
        <span className={overdue ? 'font-semibold text-red-600' : ''}>
          Frist: {formatDueDate(task.dueDate)}
        </span>
        <span>{MODULE_LABELS[task.module]}</span>
      </div>
      {extension && (extension.subtasks.length > 0 || extension.comments.length > 0) ? (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-500">
          {extension.subtasks.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3 w-3" aria-hidden />
              {extension.subtasks.filter((s) => s.done).length}/{extension.subtasks.length}
            </span>
          ) : null}
          {extension.comments.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" aria-hidden />
              {extension.comments.length}
            </span>
          ) : null}
          {extension.subtasks.length > 0 ? (
            <div className="ml-auto h-1 w-16 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full bg-[#1a3d32]"
                style={{ width: `${subtaskPercent}%` }}
                aria-hidden
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
