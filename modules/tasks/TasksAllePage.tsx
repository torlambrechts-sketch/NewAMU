// TasksAllePage — cross-template task overview.
//
// Four view modes:
//   list     — table with progress bar, avatar, category, expand-to-subtasks accordion
//   box      — card grid with progress bar, avatar, expand-to-subtasks
//   kanban   — 4 status columns with progress bar + avatar on each card
//   gantt    — waterfall/timeline chart showing tasks as bars on a date axis
//
// Filter bar mirrors Regelverk-dekning (cream-deep, always visible, × per filter).

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlignJustify,
  ArrowLeft,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LayoutGrid,
  Search,
  X,
} from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { TaskStatusBadge, TASK_STATUS_LABEL } from './components/TaskStatusBadge'
import { TaskPriorityBadge, TASK_PRIORITY_LABEL } from './components/TaskPriorityBadge'
import { TaskKindIcon } from './components/TaskKindIcon'
import { TaskSubtaskList } from './components/TaskSubtaskList'
import { TaskDetailPanel } from './TaskDetailPanel'
import { useTaskItemsData, type TaskItemRow } from './useTaskItemsData'
import { useSubtaskCounts } from './useSubtaskCounts'
import type { TaskItemStatus, TaskItemPriority, TaskTemplateKind } from '../../src/types/task'

// ── Constants ────────────────────────────────────────────────────────────────

const CREAM_DEEP = '#EFE8DC'

type ViewMode = 'list' | 'box' | 'kanban' | 'gantt'

const KIND_LABEL: Partial<Record<TaskTemplateKind, string>> = {
  oppgave: 'Generell',
  avvik: 'Avvik',
  nestenulykke: 'Nestenulykke',
  tiltak: 'Tiltak',
  risiko: 'Risiko',
  forslag: 'Forslag',
  sykefravær: 'Sykefravær',
}

const STATUS_PROGRESS: Record<TaskItemStatus, number> = {
  open: 5,
  in_progress: 20,
  root_cause_identified: 35,
  action_defined: 50,
  action_implemented: 65,
  effectiveness_pending: 75,
  effectiveness_verified: 90,
  closed: 100,
  cancelled: 100,
}

const KANBAN_COLS = [
  {
    key: 'backlog', label: 'Å gjøre', sublabel: 'Ikke startet',
    color: 'bg-neutral-50 border-neutral-200',
    statuses: ['open'] as TaskItemStatus[],
  },
  {
    key: 'progress', label: 'Pågår', sublabel: 'Under behandling',
    color: 'bg-amber-50 border-amber-200',
    statuses: ['in_progress', 'root_cause_identified', 'action_defined'] as TaskItemStatus[],
  },
  {
    key: 'review', label: 'Gjennomgang', sublabel: 'Implementering og verifikasjon',
    color: 'bg-violet-50 border-violet-200',
    statuses: ['action_implemented', 'effectiveness_pending', 'effectiveness_verified'] as TaskItemStatus[],
  },
  {
    key: 'done', label: 'Ferdig', sublabel: 'Lukket',
    color: 'bg-green-50 border-green-200',
    statuses: ['closed', 'cancelled'] as TaskItemStatus[],
  },
]

const AVATAR_COLORS = [
  '#c2410c', '#7c3aed', '#0e7490', '#1a3d32', '#a21caf', '#0f766e', '#b45309', '#1d4ed8',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('nb-NO', { dateStyle: 'short' })
  } catch {
    return s
  }
}

function isOverdue(dueDate: string | null, status: TaskItemStatus) {
  if (!dueDate || status === 'closed' || status === 'cancelled') return false
  return new Date(dueDate) < new Date()
}

function nameToColor(name: string) {
  return AVATAR_COLORS[
    name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  ]
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function PersonAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const parts = name.trim().split(/\s+/)
  const initials = (
    parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)
  ).toUpperCase()
  const sz = size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-8 w-8 text-xs'
  return (
    <span
      title={name}
      style={{ backgroundColor: nameToColor(name) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${sz}`}
    >
      {initials}
    </span>
  )
}

function ProgressBar({
  taskId,
  status,
  subtaskCounts,
  compact = false,
}: {
  taskId: string
  status: TaskItemStatus
  subtaskCounts: Map<string, { done: number; total: number }>
  compact?: boolean
}) {
  const sc = subtaskCounts.get(taskId)
  const pct = sc && sc.total > 0
    ? Math.round((sc.done / sc.total) * 100)
    : STATUS_PROGRESS[status] ?? 0
  const label = sc && sc.total > 0 ? `${sc.done}/${sc.total}` : `${pct}%`
  const barColor = status === 'cancelled'
    ? '#9ca3af'
    : status === 'closed'
    ? '#16a34a'
    : '#c2410c'

  return (
    <div className={`flex items-center gap-1.5 ${compact ? '' : 'w-full'}`}>
      <div className="relative h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      {!compact && (
        <span className="w-8 text-right text-[10px] tabular-nums text-neutral-400">{label}</span>
      )}
    </div>
  )
}

// ── Filter state ──────────────────────────────────────────────────────────────

const ALL_STATUSES: TaskItemStatus[] = [
  'open', 'in_progress', 'root_cause_identified', 'action_defined',
  'action_implemented', 'effectiveness_pending', 'effectiveness_verified',
  'closed', 'cancelled',
]
const ALL_PRIORITIES: TaskItemPriority[] = ['critical', 'high', 'medium', 'low']
const ALL_KINDS: TaskTemplateKind[] = [
  'oppgave', 'avvik', 'nestenulykke', 'tiltak', 'risiko', 'forslag', 'sykefravær',
]

type ActiveFilters = {
  status: TaskItemStatus | null
  priority: TaskItemPriority | null
  kind: TaskTemplateKind | null
  overdueOnly: boolean
}
const EMPTY_FILTERS: ActiveFilters = { status: null, priority: null, kind: null, overdueOnly: false }

// ── Kanban view ───────────────────────────────────────────────────────────────

function KanbanCard({
  item,
  subtaskCounts,
  expanded,
  onToggleExpand,
  onClick,
}: {
  item: TaskItemRow
  subtaskCounts: Map<string, { done: number; total: number }>
  expanded: boolean
  onToggleExpand: () => void
  onClick: () => void
}) {
  const personName = item.ownerName ?? item.assigneeName
  const overdue = isOverdue(item.dueDate, item.status)
  const sc = subtaskCounts.get(item.id)
  const hasSubtasks = (sc?.total ?? 0) > 0

  return (
    <div
      className={`rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md ${
        expanded ? 'border-[#c2410c]/30' : 'border-neutral-200'
      }`}
    >
      {/* Clickable card body → opens detail panel */}
      <div
        onClick={onClick}
        className="cursor-pointer p-3"
      >
        <p className="text-sm font-medium leading-snug text-neutral-900">{item.title}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <TaskStatusBadge status={item.status} />
          <TaskPriorityBadge priority={item.priority} />
        </div>

        {/* Progress bar */}
        <div className="mt-2.5">
          <ProgressBar taskId={item.id} status={item.status} subtaskCounts={subtaskCounts} />
        </div>

        {/* Footer: date + avatar */}
        {(item.dueDate || personName) && (
          <div className="mt-2 flex items-center justify-between gap-2">
            {item.dueDate ? (
              <span
                className={`text-[11px] ${overdue ? 'font-semibold text-red-600' : 'text-neutral-400'}`}
              >
                {fmtDate(item.dueDate)}{overdue ? ' — forfalt' : ''}
              </span>
            ) : (
              <span />
            )}
            {personName && <PersonAvatar name={personName} size="sm" />}
          </div>
        )}
      </div>

      {/* Expand toggle — only rendered when subtasks exist */}
      {hasSubtasks && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
            className="flex w-full items-center justify-between border-t border-neutral-100 px-3 py-1.5 text-[11px] transition hover:bg-neutral-50"
          >
            <span className={expanded ? 'font-medium text-[#c2410c]' : 'text-neutral-400'}>
              {sc!.done}/{sc!.total} deloppgaver
            </span>
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-[#c2410c]" />
              : <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
            }
          </button>
          {expanded && (
            <div className="border-t border-neutral-100 bg-neutral-50/60 p-3">
              <TaskSubtaskList taskItemId={item.id} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KanbanView({
  items,
  subtaskCounts,
  onCardClick,
}: {
  items: TaskItemRow[]
  subtaskCounts: Map<string, { done: number; total: number }>
  onCardClick: (item: TaskItemRow) => void
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div className="flex min-h-[480px] gap-4 overflow-x-auto pb-4">
      {KANBAN_COLS.map((col) => {
        const colItems = items.filter((i) => col.statuses.includes(i.status))
        return (
          <div key={col.key} className="flex min-w-[280px] flex-1 flex-col">
            <div className={`rounded-t-lg border border-b-0 px-3 py-2.5 ${col.color}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-neutral-800">{col.label}</span>
                  <span className="ml-2 text-xs text-neutral-500">{col.sublabel}</span>
                </div>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-neutral-600">
                  {colItems.length}
                </span>
              </div>
            </div>
            <div className={`flex-1 rounded-b-lg border px-2 py-2 ${col.color}`}>
              {colItems.length === 0 ? (
                <p className="py-8 text-center text-xs text-neutral-400">Ingen oppgaver</p>
              ) : (
                <div className="space-y-2">
                  {colItems.map((item) => (
                    <KanbanCard
                      key={item.id}
                      item={item}
                      subtaskCounts={subtaskCounts}
                      expanded={expandedIds.has(item.id)}
                      onToggleExpand={() => toggleExpand(item.id)}
                      onClick={() => onCardClick(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Box / card grid view ──────────────────────────────────────────────────────

function BoxCard({
  item,
  subtaskCounts,
  expanded,
  onToggle,
  onOpenDetail,
}: {
  item: TaskItemRow
  subtaskCounts: Map<string, { done: number; total: number }>
  expanded: boolean
  onToggle: () => void
  onOpenDetail: () => void
}) {
  const personName = item.ownerName ?? item.assigneeName
  const overdue = isOverdue(item.dueDate, item.status)
  const sc = subtaskCounts.get(item.id)

  return (
    <div
      className={`rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md ${
        expanded ? 'border-[#c2410c]/30' : 'border-neutral-200'
      }`}
    >
      {/* Card body */}
      <div
        className="cursor-pointer p-4"
        onClick={onOpenDetail}
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <p className="flex-1 text-sm font-medium leading-snug text-neutral-900">{item.title}</p>
          {personName && <PersonAvatar name={personName} size="sm" />}
        </div>

        {/* Kind + status badges */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {item.templateKind && (
            <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-500">
              {KIND_LABEL[item.templateKind] ?? item.templateKind}
            </span>
          )}
          <TaskStatusBadge status={item.status} />
          <TaskPriorityBadge priority={item.priority} />
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <ProgressBar taskId={item.id} status={item.status} subtaskCounts={subtaskCounts} />
        </div>

        {/* Due date */}
        {item.dueDate && (
          <p
            className={`mt-2 text-[11px] ${
              overdue ? 'font-semibold text-red-600' : 'text-neutral-400'
            }`}
          >
            Frist: {fmtDate(item.dueDate)}{overdue ? ' — forfalt' : ''}
          </p>
        )}
      </div>

      {/* Expand toggle — only when subtasks exist */}
      {sc && sc.total > 0 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            className="flex w-full items-center justify-between border-t border-neutral-100 px-4 py-2 text-[11px] transition hover:bg-neutral-50"
          >
            <span className={expanded ? 'font-medium text-[#c2410c]' : 'text-neutral-500'}>
              {sc.done}/{sc.total} deloppgaver
            </span>
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-[#c2410c]" />
              : <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
            }
          </button>
          {expanded && (
            <div className="border-t border-neutral-100 bg-neutral-50/60 p-4">
              <TaskSubtaskList taskItemId={item.id} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function BoxView({
  items,
  subtaskCounts,
  onOpenDetail,
}: {
  items: TaskItemRow[]
  subtaskCounts: Map<string, { done: number; total: number }>
  onOpenDetail: (item: TaskItemRow) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-neutral-500">Ingen oppgaver å vise.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <BoxCard
          key={item.id}
          item={item}
          subtaskCounts={subtaskCounts}
          expanded={expanded.has(item.id)}
          onToggle={() => toggle(item.id)}
          onOpenDetail={() => onOpenDetail(item)}
        />
      ))}
    </div>
  )
}

// ── Waterfall / Gantt view ────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date) {
  return (b.getTime() - a.getTime()) / 86_400_000
}

function toPercent(date: Date, minDate: Date, totalDays: number) {
  return Math.max(0, Math.min(100, (daysBetween(minDate, date) / totalDays) * 100))
}

function monthTicks(minDate: Date, maxDate: Date, totalDays: number) {
  const ticks: { label: string; pct: number }[] = []
  const d = new Date(minDate)
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  while (d <= maxDate) {
    ticks.push({
      label: d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' }),
      pct: toPercent(d, minDate, totalDays),
    })
    d.setMonth(d.getMonth() + 1)
  }
  return ticks
}

function WaterfallView({
  items,
  subtaskCounts,
  onCardClick,
}: {
  items: TaskItemRow[]
  subtaskCounts: Map<string, { done: number; total: number }>
  onCardClick: (item: TaskItemRow) => void
}) {
  // Only show tasks with a due date; sort by start (createdAt)
  const tasksWithDates = useMemo(
    () =>
      items
        .filter((i) => i.dueDate)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [items],
  )

  if (tasksWithDates.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center">
        <p className="text-sm text-neutral-500">
          Ingen oppgaver med frist — legg til en frist for å se dem i tidslinja.
        </p>
      </div>
    )
  }

  const starts = tasksWithDates.map((i) => new Date(i.createdAt))
  const ends = tasksWithDates.map((i) => new Date(i.dueDate!))
  let minDate = new Date(Math.min(...starts.map((d) => d.getTime())))
  let maxDate = new Date(Math.max(...ends.map((d) => d.getTime())))
  minDate.setDate(minDate.getDate() - 3)
  maxDate.setDate(maxDate.getDate() + 10)
  const totalDays = daysBetween(minDate, maxDate)

  const ticks = monthTicks(minDate, maxDate, totalDays)
  const today = new Date()
  const todayPct = toPercent(today, minDate, totalDays)

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      {/* Legend / header */}
      <div className="flex border-b border-neutral-200">
        <div className="w-52 shrink-0 border-r border-neutral-200 px-4 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Oppgave
          </span>
        </div>
        <div className="relative flex-1 overflow-hidden py-2.5">
          {ticks.map((t) => (
            <div
              key={t.label}
              className="absolute top-0 bottom-0 flex items-center border-l border-neutral-100 pl-1"
              style={{ left: `${t.pct}%` }}
            >
              <span className="text-[10px] text-neutral-300">{t.label}</span>
            </div>
          ))}
          {/* Today marker */}
          {todayPct >= 0 && todayPct <= 100 && (
            <div
              className="absolute top-0 bottom-0 flex items-center border-l-2 border-blue-400/60 pl-1"
              style={{ left: `${todayPct}%` }}
            >
              <span className="text-[9px] font-semibold text-blue-400">i dag</span>
            </div>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-neutral-100">
        {tasksWithDates.map((item) => {
          const startPct = toPercent(new Date(item.createdAt), minDate, totalDays)
          const endPct = toPercent(new Date(item.dueDate!), minDate, totalDays)
          const widthPct = Math.max(endPct - startPct, 1.5)
          const overdue = isOverdue(item.dueDate, item.status)
          const personName = item.ownerName ?? item.assigneeName
          const sc = subtaskCounts.get(item.id)
          const pct =
            sc && sc.total > 0
              ? Math.round((sc.done / sc.total) * 100)
              : STATUS_PROGRESS[item.status] ?? 0
          const barFill =
            item.status === 'cancelled'
              ? '#9ca3af'
              : item.status === 'closed'
              ? '#16a34a'
              : '#c2410c'

          return (
            <div key={item.id} className="flex items-stretch hover:bg-neutral-50/60">
              {/* Label column */}
              <div className="flex w-52 shrink-0 items-center gap-2 border-r border-neutral-100 px-4 py-3">
                {personName && <PersonAvatar name={personName} size="sm" />}
                <div className="min-w-0">
                  <p
                    className="cursor-pointer truncate text-xs font-medium text-neutral-800 hover:text-[#c2410c]"
                    onClick={() => onCardClick(item)}
                    title={item.title}
                  >
                    {item.title}
                  </p>
                  <p className="truncate text-[10px] text-neutral-400">
                    {item.templateKind ? (KIND_LABEL[item.templateKind] ?? item.templateKind) : ''}
                  </p>
                </div>
              </div>

              {/* Timeline column */}
              <div className="relative flex-1 px-1 py-4" onClick={() => onCardClick(item)}>
                {/* Today line (repeated per row for visual alignment) */}
                {todayPct >= 0 && todayPct <= 100 && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 w-px bg-blue-300/40"
                    style={{ left: `${todayPct}%` }}
                  />
                )}

                {/* Month grid lines */}
                {ticks.map((t) => (
                  <div
                    key={t.label}
                    className="pointer-events-none absolute top-0 bottom-0 w-px bg-neutral-100"
                    style={{ left: `${t.pct}%` }}
                  />
                ))}

                {/* Task bar */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 h-7 cursor-pointer overflow-hidden rounded-md border transition hover:opacity-90 ${
                    overdue ? 'border-red-300' : 'border-neutral-200/80'
                  }`}
                  style={{
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: overdue ? '#fee2e2' : '#fed7aa',
                    minWidth: 4,
                  }}
                >
                  {/* Progress fill */}
                  <div
                    className="absolute left-0 top-0 h-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: barFill, opacity: 0.55 }}
                  />
                  {/* Bar label */}
                  {widthPct > 8 && (
                    <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-neutral-700">
                      {sc && sc.total > 0 ? `${sc.done}/${sc.total}` : `${pct}%`}
                    </span>
                  )}
                </div>
              </div>

              {/* Priority + deadline column */}
              <div className="flex w-28 shrink-0 flex-col items-end justify-center gap-0.5 border-l border-neutral-100 px-3">
                <TaskPriorityBadge priority={item.priority} />
                {item.dueDate && (
                  <span
                    className={`text-[10px] ${overdue ? 'font-semibold text-red-500' : 'text-neutral-400'}`}
                  >
                    {fmtDate(item.dueDate)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TasksAllePage() {
  const allItems = useTaskItemsData(null)
  const subtaskCounts = useSubtaskCounts()
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS)
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<TaskItemRow | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const set = <K extends keyof ActiveFilters>(k: K, v: ActiveFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const clear = () => { setFilters(EMPTY_FILTERS); setSearch('') }

  const activeCount =
    (filters.status ? 1 : 0) +
    (filters.priority ? 1 : 0) +
    (filters.kind ? 1 : 0) +
    (filters.overdueOnly ? 1 : 0) +
    (search ? 1 : 0)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allItems.items.filter((item) => {
      if (filters.status && item.status !== filters.status) return false
      if (filters.priority && item.priority !== filters.priority) return false
      if (filters.kind && item.templateKind !== filters.kind) return false
      if (filters.overdueOnly && !isOverdue(item.dueDate, item.status)) return false
      if (q && !item.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [allItems.items, filters, search])

  const toggleRow = (id: string) =>
    setExpandedRows((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const VIEW_BTNS: { mode: ViewMode; Icon: React.ComponentType<{ className?: string }>; title: string }[] = [
    { mode: 'kanban', Icon: LayoutDashboard, title: 'Kanban' },
    { mode: 'box',    Icon: LayoutGrid,      title: 'Kort' },
    { mode: 'list',   Icon: AlignJustify,    title: 'Liste' },
    { mode: 'gantt',  Icon: CalendarRange,   title: 'Tidslinje' },
  ]

  return (
    <>
      <ModulePageShell
        breadcrumb={[
          { label: 'Oppgaver', to: '/tasks/management' },
          { label: 'Alle oppgaver' },
        ]}
        title="Alle oppgaver"
        description="Tverrsnitt av alle oppgavemaler — filtrer på status, prioritet og type."
        headerActions={
          <Link
            to="/tasks/management"
            className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Tilbake</span>
          </Link>
        }
      >
        <div className="space-y-4">
          {allItems.error && <WarningBox>{allItems.error}</WarningBox>}

          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk på tittel …"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#c2410c]/25"
            />
          </div>

          {/* Filter bar — cream-deep, always visible */}
          <div
            className="grid gap-4 rounded-lg border border-neutral-200/80 p-4 sm:grid-cols-2 lg:grid-cols-4"
            style={{ backgroundColor: CREAM_DEEP }}
          >
            {/* Status */}
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Status
              <div className="mt-1.5 flex items-center gap-1">
                <select
                  value={filters.status ?? ''}
                  onChange={(e) => set('status', (e.target.value as TaskItemStatus) || null)}
                  className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Alle statuser</option>
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>
                  ))}
                </select>
                {filters.status && (
                  <button
                    type="button"
                    onClick={() => set('status', null)}
                    className="rounded-md border border-neutral-200 bg-white p-2 text-neutral-500 hover:bg-neutral-50"
                    aria-label="Fjern status-filter"
                  >×</button>
                )}
              </div>
            </label>

            {/* Prioritet */}
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Prioritet
              <div className="mt-1.5 flex items-center gap-1">
                <select
                  value={filters.priority ?? ''}
                  onChange={(e) => set('priority', (e.target.value as TaskItemPriority) || null)}
                  className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Alle prioriteter</option>
                  {ALL_PRIORITIES.map((p) => (
                    <option key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</option>
                  ))}
                </select>
                {filters.priority && (
                  <button
                    type="button"
                    onClick={() => set('priority', null)}
                    className="rounded-md border border-neutral-200 bg-white p-2 text-neutral-500 hover:bg-neutral-50"
                    aria-label="Fjern prioritet-filter"
                  >×</button>
                )}
              </div>
            </label>

            {/* Maltype */}
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Maltype
              <div className="mt-1.5 flex items-center gap-1">
                <select
                  value={filters.kind ?? ''}
                  onChange={(e) => set('kind', (e.target.value as TaskTemplateKind) || null)}
                  className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Alle typer</option>
                  {ALL_KINDS.map((k) => (
                    <option key={k} value={k}>{KIND_LABEL[k] ?? k}</option>
                  ))}
                </select>
                {filters.kind && (
                  <button
                    type="button"
                    onClick={() => set('kind', null)}
                    className="rounded-md border border-neutral-200 bg-white p-2 text-neutral-500 hover:bg-neutral-50"
                    aria-label="Fjern type-filter"
                  >×</button>
                )}
              </div>
            </label>

            {/* Kun forfalt + view switcher */}
            <div className="flex flex-col justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                <input
                  type="checkbox"
                  checked={filters.overdueOnly}
                  onChange={(e) => set('overdueOnly', e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-[#c2410c] focus:ring-[#c2410c]/20"
                />
                Kun forfalt
              </label>
              <div className="flex items-center gap-1">
                {VIEW_BTNS.map(({ mode, Icon, title }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    title={title}
                    className={`rounded p-1.5 transition ${
                      viewMode === mode
                        ? 'bg-[#c2410c] text-white'
                        : 'border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={clear}
                    title="Nullstill alle filter"
                    className="ml-1 flex items-center gap-0.5 text-[10px] text-neutral-500 transition hover:text-neutral-800"
                  >
                    <X className="h-3 w-3" />
                    Nullstill
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Result count */}
          <p className="text-xs text-neutral-500">
            {allItems.loading
              ? 'Laster…'
              : `${filtered.length} av ${allItems.items.length} oppgaver`}
          </p>

          {/* ── Views ── */}

          {viewMode === 'kanban' && (
            <KanbanView
              items={filtered}
              subtaskCounts={subtaskCounts}
              onCardClick={setSelectedItem}
            />
          )}

          {viewMode === 'box' && (
            <BoxView
              items={filtered}
              subtaskCounts={subtaskCounts}
              onOpenDetail={setSelectedItem}
            />
          )}

          {viewMode === 'gantt' && (
            <WaterfallView
              items={filtered}
              subtaskCounts={subtaskCounts}
              onCardClick={setSelectedItem}
            />
          )}

          {viewMode === 'list' && (
            <LayoutTable1PostingsShell
              wrap
              title="Alle oppgaver"
              description=""
              toolbar={null}
              footer={null}
            >
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead>
                    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kategori</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                      <th className={`w-32 ${LAYOUT_TABLE1_POSTINGS_TH}`}>Fremgang</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Prioritet</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Ansvarlig</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Frist</th>
                      <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
                    </tr>
                  </thead>
                  <tbody>
                    {allItems.loading && filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-sm text-neutral-500">
                          Laster…
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <div className="py-12 text-center">
                            <p className="text-sm text-neutral-500">
                              {activeCount > 0
                                ? 'Ingen oppgaver matcher filteret.'
                                : 'Ingen oppgaver ennå.'}
                            </p>
                            {activeCount > 0 && (
                              <button
                                type="button"
                                onClick={clear}
                                className="mt-2 text-xs text-neutral-500 underline hover:text-neutral-700"
                              >
                                Nullstill filter
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filtered.flatMap((row) => {
                        const personName = row.ownerName ?? row.assigneeName
                        const overdue = isOverdue(row.dueDate, row.status)
                        const isExpanded = expandedRows.has(row.id)
                        const sc = subtaskCounts.get(row.id)

                        return [
                          <tr
                            key={row.id}
                            className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} ${
                              isExpanded ? 'bg-neutral-50' : 'hover:bg-neutral-50'
                            }`}
                          >
                            {/* Type icon */}
                            <td className="px-5 py-3">
                              {row.templateKind ? (
                                <TaskKindIcon
                                  kind={row.templateKind}
                                  className="h-4 w-4 text-[#c2410c]/60"
                                />
                              ) : (
                                <span className="text-xs text-neutral-400">—</span>
                              )}
                            </td>

                            {/* Title */}
                            <td
                              className="max-w-[200px] cursor-pointer truncate px-5 py-3 font-medium text-neutral-900 hover:text-[#c2410c]"
                              onClick={() => setSelectedItem(row)}
                            >
                              {row.title}
                            </td>

                            {/* Kategori */}
                            <td className="px-5 py-3 text-xs text-neutral-500">
                              {row.templateKind ? (KIND_LABEL[row.templateKind] ?? row.templateKind) : '—'}
                            </td>

                            {/* Status */}
                            <td className="px-5 py-3">
                              <TaskStatusBadge status={row.status} />
                            </td>

                            {/* Progress */}
                            <td className="w-36 px-5 py-3">
                              <ProgressBar
                                taskId={row.id}
                                status={row.status}
                                subtaskCounts={subtaskCounts}
                              />
                              {sc && sc.total > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleRow(row.id)}
                                  className={`mt-1 flex items-center gap-0.5 text-[10px] transition ${
                                    isExpanded
                                      ? 'font-semibold text-[#c2410c]'
                                      : 'text-neutral-400 hover:text-[#c2410c]'
                                  }`}
                                >
                                  {isExpanded
                                    ? <ChevronDown className="h-3 w-3" />
                                    : <ChevronRight className="h-3 w-3" />
                                  }
                                  {sc.done}/{sc.total} deloppg.
                                </button>
                              )}
                            </td>

                            {/* Prioritet */}
                            <td className="px-5 py-3">
                              <TaskPriorityBadge priority={row.priority} />
                            </td>

                            {/* Ansvarlig avatar */}
                            <td className="px-5 py-3">
                              {personName ? (
                                <PersonAvatar name={personName} size="sm" />
                              ) : (
                                <span className="text-xs text-neutral-400">—</span>
                              )}
                            </td>

                            {/* Frist */}
                            <td
                              className={`px-5 py-3 text-sm ${
                                overdue ? 'font-medium text-red-600' : 'text-neutral-600'
                              }`}
                            >
                              {fmtDate(row.dueDate)}
                            </td>

                            {/* Expand toggle — only shown when no subtask count pill above */}
                            <td className="w-8 px-3 py-3">
                              {(!sc || sc.total === 0) && (
                                <ChevronRight className="h-4 w-4 text-neutral-200" />
                              )}
                            </td>
                          </tr>,

                          // Subtask accordion row
                          isExpanded && (
                            <tr key={`${row.id}-sub`} className="bg-neutral-50/80">
                              <td colSpan={9} className="border-b border-neutral-100 px-10 py-4">
                                <TaskSubtaskList taskItemId={row.id} />
                              </td>
                            </tr>
                          ),
                        ].filter(Boolean)
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </LayoutTable1PostingsShell>
          )}
        </div>
      </ModulePageShell>

      <TaskDetailPanel
        open={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
        onStatusChange={async (id, status) => {
          await allItems.updateStatus(id, status)
          setSelectedItem((prev) => (prev?.id === id ? { ...prev, status } : prev))
        }}
      />
    </>
  )
}
