// TasksAllePage — cross-template task overview.
//
// Four view modes:
//   list     — table with progress bar, avatar, category, expand-to-subtasks accordion
//   box      — card grid with progress bar, avatar, expand-to-subtasks
//   kanban   — 4 status columns with progress bar + avatar on each card
//   gantt    — waterfall/timeline chart showing tasks as bars on a date axis
//
// Filter bar mirrors Regelverk-dekning (cream-deep, always visible, × per filter).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlignJustify,
  ArrowLeft,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LayoutGrid,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { ToggleSwitch } from '../../src/components/ui/FormToggles'
import { TaskStatusBadge, TASK_STATUS_LABEL } from './components/TaskStatusBadge'
import { TaskPriorityBadge, TASK_PRIORITY_LABEL } from './components/TaskPriorityBadge'
import { TaskKindIcon } from './components/TaskKindIcon'
import { TaskSubtaskList } from './components/TaskSubtaskList'
import { TaskDetailPanel } from './TaskDetailPanel'
import { useTaskItemsData, type TaskItemRow } from './useTaskItemsData'
import { useSubtaskCounts } from './useSubtaskCounts'
import type { TaskItemStatus, TaskItemPriority, TaskTemplateKind } from '../../src/types/task'

// ── Subtask priority helpers (for aligned table rows) ─────────────────────────

type SubPriority = 'low' | 'medium' | 'high' | 'critical'

const SUB_PRIORITY_LABEL: Record<SubPriority, string> = {
  low: 'Lav', medium: 'Medium', high: 'Høy', critical: 'Kritisk',
}
const SUB_PRIORITY_STYLE: Record<SubPriority, string> = {
  low:      'bg-blue-50 text-blue-700 border border-blue-100',
  medium:   'bg-amber-50 text-amber-700 border border-amber-100',
  high:     'bg-orange-50 text-orange-700 border border-orange-100',
  critical: 'bg-red-50 text-red-700 border border-red-100',
}

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
          <Button
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
            className="flex w-full justify-between rounded-none border-t border-neutral-100 px-3 py-1.5 text-[11px] font-normal hover:bg-neutral-50"
          >
            <span className={expanded ? 'font-medium text-[#c2410c]' : 'text-neutral-400'}>
              {sc!.done}/{sc!.total} deloppgaver
            </span>
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-[#c2410c]" />
              : <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
            }
          </Button>
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
          <Button
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            className="flex w-full justify-between rounded-none border-t border-neutral-100 px-4 py-2 text-[11px] font-normal hover:bg-neutral-50"
          >
            <span className={expanded ? 'font-medium text-[#c2410c]' : 'text-neutral-500'}>
              {sc.done}/{sc.total} deloppgaver
            </span>
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-[#c2410c]" />
              : <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
            }
          </Button>
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

// ── SubtaskTableRows — subtasks rendered as table rows aligned to the parent ──
//
// Each subtask row mirrors the parent table columns:
//   [indent] [checkbox + title] [—] [done badge] [—] [priority] [owner] [dates] [delete]
// Priority shows a coloured pill when set, "Ikke satt" in neutral when absent.
// Owner shows an initials avatar when set, "—" otherwise.

type SubtaskRow = {
  id: string
  title: string
  isDone: boolean
  position: number
  ownerName: string | null
  priority: SubPriority | null
  startDate: string | null
  dueDate: string | null
}

type SubEditForm = {
  title: string; ownerName: string; priority: SubPriority | ''; startDate: string; dueDate: string
}
const EMPTY_SUB_EDIT: SubEditForm = { title: '', ownerName: '', priority: '', startDate: '', dueDate: '' }

function SubtaskTableRows({ taskItemId }: { taskItemId: string }) {
  const { supabase } = useOrgSetupContext()
  const [subtasks, setSubtasks] = useState<SubtaskRow[]>([])
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<SubEditForm>(EMPTY_SUB_EDIT)
  const setEF = (k: keyof SubEditForm, v: string) => setEditForm((f) => ({ ...f, [k]: v }))

  const load = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('task_subtasks')
      .select('id, title, is_done, position, owner_name, priority, start_date, due_date')
      .eq('task_item_id', taskItemId)
      .is('deleted_at', null)
      .order('position', { ascending: true })
    if (data) {
      setSubtasks(
        data.map((r) => ({
          id: String(r.id),
          title: String(r.title ?? ''),
          isDone: Boolean(r.is_done),
          position: Number(r.position ?? 0),
          ownerName: r.owner_name ? String(r.owner_name) : null,
          priority: r.priority ? (r.priority as SubPriority) : null,
          startDate: r.start_date ? String(r.start_date) : null,
          dueDate: r.due_date ? String(r.due_date) : null,
        })),
      )
    }
  }, [supabase, taskItemId])

  useEffect(() => { void load() }, [load])

  const toggle = async (id: string, current: boolean) => {
    if (!supabase) return
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, isDone: !current } : s)))
    await supabase
      .from('task_subtasks')
      .update({ is_done: !current, done_at: !current ? new Date().toISOString() : null })
      .eq('id', id)
  }

  const remove = async (id: string) => {
    if (!supabase) return
    setSubtasks((prev) => prev.filter((s) => s.id !== id))
    await supabase.from('task_subtasks').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  }

  const openEdit = (sub: SubtaskRow) => {
    setEditingId(sub.id)
    setEditForm({ title: sub.title, ownerName: sub.ownerName ?? '', priority: sub.priority ?? '', startDate: sub.startDate ?? '', dueDate: sub.dueDate ?? '' })
  }

  const saveEdit = async () => {
    if (!supabase || !editingId || !editForm.title.trim()) return
    const id = editingId
    await supabase.from('task_subtasks').update({
      title: editForm.title.trim(),
      owner_name: editForm.ownerName.trim() || null,
      priority: editForm.priority || null,
      start_date: editForm.startDate || null,
      due_date: editForm.dueDate || null,
    }).eq('id', id)
    setSubtasks((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, title: editForm.title.trim(), ownerName: editForm.ownerName.trim() || null, priority: (editForm.priority as SubPriority) || null, startDate: editForm.startDate || null, dueDate: editForm.dueDate || null }
          : s,
      ),
    )
    setEditingId(null)
  }

  const addSubtask = async () => {
    if (!supabase || !newTitle.trim()) return
    setAdding(true)
    const maxPos = subtasks.length > 0 ? Math.max(...subtasks.map((s) => s.position)) + 10 : 10
    const { data } = await supabase
      .from('task_subtasks')
      .insert({ task_item_id: taskItemId, title: newTitle.trim(), position: maxPos })
      .select('id, title, is_done, position, owner_name, priority, start_date, due_date')
      .single()
    if (data) {
      setSubtasks((prev) => [
        ...prev,
        {
          id: String(data.id),
          title: String(data.title),
          isDone: false,
          position: Number(data.position),
          ownerName: null,
          priority: null,
          startDate: null,
          dueDate: null,
        },
      ])
    }
    setNewTitle('')
    setAdding(false)
  }

  return (
    <>
      {subtasks.map((sub) => {
        const dateRange =
          sub.startDate && sub.dueDate
            ? `${fmtDate(sub.startDate)} – ${fmtDate(sub.dueDate)}`
            : sub.dueDate
            ? fmtDate(sub.dueDate)
            : sub.startDate
            ? `Fra ${fmtDate(sub.startDate)}`
            : null

        return [
          <tr key={sub.id} className="group border-b border-neutral-100 bg-neutral-50/60">
            {/* Col 1: Type — indent only */}
            <td className="w-10 px-3 py-2" />

            {/* Col 2: Title — checkbox + clickable text */}
            <td className="px-3 py-2">
              <div className="flex items-center gap-2 pl-5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void toggle(sub.id, sub.isDone)}
                  aria-label={sub.isDone ? 'Marker som ikke ferdig' : 'Marker som ferdig'}
                  aria-pressed={sub.isDone}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    sub.isDone
                      ? 'border-[#c2410c] bg-[#c2410c] text-white hover:bg-[#c2410c]'
                      : 'border-neutral-300 bg-white hover:border-[#c2410c]'
                  }`}
                >
                  {sub.isDone && <Check className="h-2.5 w-2.5" />}
                </Button>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(sub)}
                  onKeyDown={(e) => { if (e.key === 'Enter') openEdit(sub) }}
                  className={`cursor-pointer text-sm hover:text-[#c2410c] hover:underline ${
                    sub.isDone ? 'text-neutral-400 line-through' : 'text-neutral-700'
                  }`}
                >
                  {sub.title}
                </span>
              </div>
            </td>

            {/* Col 3: Kategori — blank */}
            <td className="px-5 py-2" />

            {/* Col 4: Status — done/open indicator */}
            <td className="px-5 py-2">
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  sub.isDone
                    ? 'bg-green-50 text-green-700'
                    : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {sub.isDone ? 'Ferdig' : 'Åpen'}
              </span>
            </td>

            {/* Col 5: Fremgang — blank */}
            <td className="w-36 px-5 py-2" />

            {/* Col 6: Prioritet — pill or "Ikke satt" */}
            <td className="px-5 py-2">
              {sub.priority ? (
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${SUB_PRIORITY_STYLE[sub.priority]}`}
                >
                  {SUB_PRIORITY_LABEL[sub.priority]}
                </span>
              ) : (
                <span className="text-[10px] italic text-neutral-300">Ikke satt</span>
              )}
            </td>

            {/* Col 7: Ansvarlig — avatar or "—" */}
            <td className="px-5 py-2">
              {sub.ownerName ? (
                <PersonAvatar name={sub.ownerName} size="sm" />
              ) : (
                <span className="text-xs text-neutral-300">—</span>
              )}
            </td>

            {/* Col 8: Frist — date range */}
            <td className="px-5 py-2 text-xs text-neutral-500">
              {dateRange ?? <span className="text-neutral-300">—</span>}
            </td>

            {/* Col 9: Delete */}
            <td className="w-8 px-3 py-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void remove(sub.id)}
                className="h-6 w-6 text-neutral-200 opacity-0 transition hover:bg-transparent hover:text-red-500 group-hover:opacity-100"
                aria-label="Slett deloppgave"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </td>
          </tr>,

          /* Inline edit form row */
          editingId === sub.id ? (
            <tr key={`${sub.id}-edit`} className="border-b border-[#c2410c]/20 bg-orange-50/40">
              <td className="w-10 px-3 py-2" />
              <td colSpan={7} className="px-3 py-2">
                <div className="space-y-2 pl-5">
                  <StandardInput
                    autoFocus
                    value={editForm.title}
                    onChange={(e) => setEF('title', e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
                    placeholder="Tittel…"
                  />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">Ansvarlig</p>
                      <StandardInput value={editForm.ownerName} onChange={(e) => setEF('ownerName', e.target.value)} placeholder="Navn…" />
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">Prioritet</p>
                      <SearchableSelect
                        value={editForm.priority}
                        options={[
                          { value: '', label: '—' },
                          { value: 'low', label: 'Lav' },
                          { value: 'medium', label: 'Medium' },
                          { value: 'high', label: 'Høy' },
                          { value: 'critical', label: 'Kritisk' },
                        ]}
                        onChange={(v) => setEF('priority', v)}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">Start</p>
                      <StandardInput type="date" value={editForm.startDate} onChange={(e) => setEF('startDate', e.target.value)} />
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">Frist</p>
                      <StandardInput type="date" value={editForm.dueDate} onChange={(e) => setEF('dueDate', e.target.value)} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="primary" disabled={!editForm.title.trim()} onClick={() => void saveEdit()} className="bg-[#c2410c] hover:bg-[#a33609]">Lagre</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-neutral-400 hover:bg-transparent hover:text-neutral-700">Avbryt</Button>
                  </div>
                </div>
              </td>
              <td className="w-8 px-3 py-2" />
            </tr>
          ) : null,
        ]
      })}

      {/* Quick-add row */}
      <tr className="border-b border-neutral-100 bg-neutral-50/50">
        <td className="w-10 px-3 py-2" />
        <td className="px-3 py-1.5" colSpan={7}>
          <div className="flex items-center gap-2 pl-5">
            <Plus className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
            <StandardInput
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addSubtask()
              }}
              placeholder="Legg til deloppgave…"
              disabled={adding}
              className="flex-1 rounded border-transparent bg-transparent px-0 py-0.5 text-neutral-600 placeholder:text-neutral-300 focus:border-neutral-200 focus:bg-white focus:px-2"
            />
            {newTitle.trim() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void addSubtask()}
                disabled={adding}
                className="shrink-0 px-0 text-[10px] font-medium text-[#c2410c] hover:bg-transparent hover:underline"
              >
                Legg til
              </Button>
            )}
          </div>
        </td>
        <td className="w-8 px-3 py-1.5" />
      </tr>
    </>
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
            <StandardInput
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk på tittel …"
              className="rounded-lg pl-10 focus:ring-2 focus:ring-[#c2410c]/25"
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
                <div className="min-w-0 flex-1">
                  <SearchableSelect
                    value={filters.status ?? ''}
                    options={[
                      { value: '', label: 'Alle statuser' },
                      ...ALL_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] })),
                    ]}
                    onChange={(v) => set('status', (v as TaskItemStatus) || null)}
                  />
                </div>
                {filters.status && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => set('status', null)}
                    className="h-9 w-9 rounded-md border-neutral-200 text-neutral-500"
                    aria-label="Fjern status-filter"
                  >×</Button>
                )}
              </div>
            </label>

            {/* Prioritet */}
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Prioritet
              <div className="mt-1.5 flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <SearchableSelect
                    value={filters.priority ?? ''}
                    options={[
                      { value: '', label: 'Alle prioriteter' },
                      ...ALL_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABEL[p] })),
                    ]}
                    onChange={(v) => set('priority', (v as TaskItemPriority) || null)}
                  />
                </div>
                {filters.priority && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => set('priority', null)}
                    className="h-9 w-9 rounded-md border-neutral-200 text-neutral-500"
                    aria-label="Fjern prioritet-filter"
                  >×</Button>
                )}
              </div>
            </label>

            {/* Maltype */}
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Maltype
              <div className="mt-1.5 flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <SearchableSelect
                    value={filters.kind ?? ''}
                    options={[
                      { value: '', label: 'Alle typer' },
                      ...ALL_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] ?? k })),
                    ]}
                    onChange={(v) => set('kind', (v as TaskTemplateKind) || null)}
                  />
                </div>
                {filters.kind && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => set('kind', null)}
                    className="h-9 w-9 rounded-md border-neutral-200 text-neutral-500"
                    aria-label="Fjern type-filter"
                  >×</Button>
                )}
              </div>
            </label>

            {/* Kun forfalt + view switcher */}
            <div className="flex flex-col justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                <ToggleSwitch
                  checked={filters.overdueOnly}
                  onChange={(v) => set('overdueOnly', v)}
                  label="Kun forfalt"
                />
                <span>Kun forfalt</span>
              </div>
              <div className="flex items-center gap-1">
                {VIEW_BTNS.map(({ mode, Icon, title }) => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? 'primary' : 'secondary'}
                    size="icon"
                    onClick={() => setViewMode(mode)}
                    title={title}
                    className={
                      viewMode === mode
                        ? 'h-8 w-8 rounded bg-[#c2410c] hover:bg-[#a33609]'
                        : 'h-8 w-8 rounded border-neutral-200 text-neutral-500 hover:bg-neutral-100'
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
                {activeCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clear}
                    title="Nullstill alle filter"
                    icon={<X className="h-3 w-3" />}
                    className="ml-1 px-0 text-[10px] text-neutral-500 hover:bg-transparent hover:text-neutral-800"
                  >
                    Nullstill
                  </Button>
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
                    <tr className={`${LAYOUT_TABLE1_POSTINGS_HEADER_ROW} bg-neutral-50/90`}>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={clear}
                                className="mt-2 px-0 text-xs text-neutral-500 underline hover:bg-transparent hover:text-neutral-700"
                              >
                                Nullstill filter
                              </Button>
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
                            <td className="px-5 py-4">
                              {row.templateKind ? (
                                <TaskKindIcon
                                  kind={row.templateKind}
                                  className="h-4 w-4 text-[#c2410c]/60"
                                />
                              ) : (
                                <span className="text-xs text-neutral-400">—</span>
                              )}
                            </td>

                            {/* Title — expand toggle in front, title click opens detail */}
                            <td className="px-3 py-4">
                              <div className="flex items-center gap-1.5">
                                {/* Expand/collapse button — only for tasks with subtasks */}
                                {sc && sc.total > 0 ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleRow(row.id)}
                                    className={`h-5 w-5 shrink-0 ${
                                      isExpanded
                                        ? 'text-[#c2410c] hover:bg-transparent'
                                        : 'text-neutral-300 hover:bg-transparent hover:text-[#c2410c]'
                                    }`}
                                    aria-label={isExpanded ? 'Skjul deloppgaver' : 'Vis deloppgaver'}
                                  >
                                    {isExpanded
                                      ? <ChevronDown className="h-4 w-4" />
                                      : <ChevronRight className="h-4 w-4" />
                                    }
                                  </Button>
                                ) : (
                                  <span className="w-5 shrink-0" />
                                )}
                                <span
                                  className="max-w-[200px] cursor-pointer truncate font-medium text-neutral-900 hover:text-[#c2410c]"
                                  onClick={() => setSelectedItem(row)}
                                  title={row.title}
                                >
                                  {row.title}
                                </span>
                              </div>
                            </td>

                            {/* Kategori */}
                            <td className="px-5 py-4 text-xs text-neutral-500">
                              {row.templateKind ? (KIND_LABEL[row.templateKind] ?? row.templateKind) : '—'}
                            </td>

                            {/* Status */}
                            <td className="px-5 py-4">
                              <TaskStatusBadge status={row.status} />
                            </td>

                            {/* Progress */}
                            <td className="w-36 px-5 py-4">
                              <ProgressBar
                                taskId={row.id}
                                status={row.status}
                                subtaskCounts={subtaskCounts}
                              />
                              {sc && sc.total > 0 && (
                                <p className="mt-0.5 text-[10px] text-neutral-400">
                                  {sc.done}/{sc.total} deloppg.
                                </p>
                              )}
                            </td>

                            {/* Prioritet */}
                            <td className="px-5 py-4">
                              <TaskPriorityBadge priority={row.priority} />
                            </td>

                            {/* Ansvarlig avatar */}
                            <td className="px-5 py-4">
                              {personName ? (
                                <PersonAvatar name={personName} size="sm" />
                              ) : (
                                <span className="text-xs text-neutral-400">—</span>
                              )}
                            </td>

                            {/* Frist */}
                            <td
                              className={`px-5 py-4 text-sm ${
                                overdue ? 'font-medium text-red-600' : 'text-neutral-600'
                              }`}
                            >
                              {fmtDate(row.dueDate)}
                            </td>

                            {/* Open detail panel */}
                            <td className="w-8 px-3 py-4">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedItem(row)}
                                className="h-6 w-6 text-neutral-300 hover:bg-transparent hover:text-neutral-500"
                                aria-label="Åpne detaljer"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>,

                          // Subtask rows — aligned to parent columns
                          isExpanded && (
                            <SubtaskTableRows key={`${row.id}-sub`} taskItemId={row.id} />
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
        onUpdate={(id, dueDate) => {
          allItems.reload()
          setSelectedItem((prev) => (prev?.id === id ? { ...prev, dueDate } : prev))
        }}
      />
    </>
  )
}
