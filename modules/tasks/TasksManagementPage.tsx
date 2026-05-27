// TasksManagementPage — three-mode routing for the Oppgaver module.
//
//   hub        no ?template=, no ?project=  — checklist-style filter card
//                with Gjennomføringer / Maler tabs, view switcher, saved views,
//                + a projects (Prosjekttavler) section below.
//   template   ?template=<slug>             — filtered task list + create button
//   project    ?project=<id>               — kanban/PDCA board
//
// URL is the source of truth for mode. No silent defaulting.
//
// Hub-mode chrome mirrors `modules/compliance/ChecklistsPage` so the two
// modules read as siblings: tab strip with live counts, Enkel/Avansert
// toggle, Kategori/Status/Mal filter chips, saved views, and four view
// modes (Tabell/Bokser/Tidslinje/Tavle) for the entries list. The Maler
// tab supports Tabell + Bokser (templates have no dates or statuses).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  ClipboardList,
  Columns3,
  KanbanSquare,
  LayoutGrid,
  Play,
  Plus,
  Printer,
  Rows3,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { FilterBar, SavedViewsControl } from '../../src/components/ui/FilterBar'
import { FilterChip } from '../../src/components/ui/FilterChip'
import { useSavedViews } from '../../src/hooks/useSavedViews'
import { FavoriteToggle } from '../../src/components/favorites/FavoriteToggle'
import { TaskCreateForm } from './TaskCreateForm'
import { TaskDetailPanel } from './TaskDetailPanel'
import { TaskProjectBoard } from './TaskProjectBoard'
import { TaskProjectCreateForm } from './TaskProjectCreateForm'
import { TaskStatusBadge, TASK_STATUS_LABEL } from './components/TaskStatusBadge'
import { TaskPriorityBadge } from './components/TaskPriorityBadge'
import { TaskKindIcon } from './components/TaskKindIcon'
import { useTaskTemplates } from './useTaskTemplates'
import { useTaskItemsData } from './useTaskItemsData'
import { useTaskProjects } from './useTaskProjects'
import { useSubtaskCounts } from './useSubtaskCounts'
import type { TaskItemRow } from './useTaskItemsData'
import type { TaskTemplateRow } from './useTaskTemplates'
import type { TaskItemStatus, TaskPdcaPhase, TaskTemplateKind } from '../../src/types/task'

// ─── Constants ────────────────────────────────────────────────────────────────

const HUB_PAGE_SIZE = 50

const TASK_ACCENT = '#c2410c'

const KIND_LABEL: Partial<Record<TaskTemplateKind, string>> = {
  oppgave: 'Generell',
  avvik: 'Avvik',
  nestenulykke: 'Nestenulykke',
  tiltak: 'Tiltak',
  risiko: 'Risiko',
  forslag: 'Forslag',
  sykefravær: 'Sykefravær',
}

const ALL_STATUSES: TaskItemStatus[] = [
  'open',
  'in_progress',
  'root_cause_identified',
  'action_defined',
  'action_implemented',
  'effectiveness_pending',
  'effectiveness_verified',
  'closed',
  'cancelled',
]

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

// 4-column kanban buckets — narrower than the 9-state status enum so the
// board reads at a glance. Mirrors TasksAllePage.
const KANBAN_COLS: { key: string; label: string; sublabel: string; statuses: TaskItemStatus[]; color: string; accent: string }[] = [
  { key: 'backlog', label: 'Å gjøre', sublabel: 'Ikke startet', statuses: ['open'], color: 'bg-neutral-50 border-neutral-200', accent: '#a3a3a3' },
  { key: 'progress', label: 'Pågår', sublabel: 'Under behandling', statuses: ['in_progress', 'root_cause_identified', 'action_defined'], color: 'bg-amber-50 border-amber-200', accent: '#d97706' },
  { key: 'review', label: 'Gjennomgang', sublabel: 'Implementering / verifikasjon', statuses: ['action_implemented', 'effectiveness_pending', 'effectiveness_verified'], color: 'bg-violet-50 border-violet-200', accent: '#7c3aed' },
  { key: 'done', label: 'Ferdig', sublabel: 'Lukket', statuses: ['closed', 'cancelled'], color: 'bg-green-50 border-green-200', accent: '#16a34a' },
]

const MONTH_LABELS: Record<string, string> = {
  '01': 'Januar', '02': 'Februar', '03': 'Mars', '04': 'April',
  '05': 'Mai', '06': 'Juni', '07': 'Juli', '08': 'August',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember',
}

const AVATAR_COLORS = [
  '#c2410c', '#7c3aed', '#0e7490', '#1a3d32', '#a21caf', '#0f766e', '#b45309', '#1d4ed8',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function PersonAvatar({ name, size = 22 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/)
  const initials = (
    parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)
  ).toUpperCase()
  return (
    <span
      title={name}
      style={{ width: size, height: size, backgroundColor: nameToColor(name), fontSize: Math.max(9, Math.round(size * 0.4)) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
    >
      {initials}
    </span>
  )
}

function ProgressBar({
  taskId,
  status,
  subtaskCounts,
}: {
  taskId: string
  status: TaskItemStatus
  subtaskCounts: Map<string, { done: number; total: number }>
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
    : TASK_ACCENT

  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="relative h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="w-10 text-right text-[10px] tabular-nums text-neutral-400">{label}</span>
    </div>
  )
}

// ─── Filter state ─────────────────────────────────────────────────────────────

// Filter payload persisted in `module_saved_views.filters` for the
// 'tasks_hub' module slug. Empty arrays = no filter on that dimension.
type TaskHubFilters = {
  categoryIds: string[]
  statuses: TaskItemStatus[]
  templateSlugs: string[]
}

const EMPTY_FILTERS: TaskHubFilters = {
  categoryIds: [],
  statuses: [],
  templateSlugs: [],
}

function filtersEqual(a: TaskHubFilters, b: TaskHubFilters): boolean {
  const eq = (x: readonly string[], y: readonly string[]) => {
    if (x.length !== y.length) return false
    const xs = [...x].sort()
    const ys = [...y].sort()
    return xs.every((v, i) => v === ys[i])
  }
  return (
    eq(a.categoryIds, b.categoryIds) &&
    eq(a.statuses, b.statuses) &&
    eq(a.templateSlugs, b.templateSlugs)
  )
}

function countActiveFilters(f: TaskHubFilters): number {
  return f.categoryIds.length + f.statuses.length + f.templateSlugs.length
}

function filtersFromSearchParams(params: URLSearchParams): TaskHubFilters {
  const get = (key: string) => {
    const raw = params.get(key)
    return raw ? raw.split(',').filter(Boolean) : []
  }
  const validStatuses = new Set<TaskItemStatus>(ALL_STATUSES)
  return {
    categoryIds: get('cat'),
    statuses: get('status').filter((s): s is TaskItemStatus => validStatuses.has(s as TaskItemStatus)),
    templateSlugs: get('tpl'),
  }
}

// Sync filters to URL without triggering a react-router re-render
// (setSearchParams cascades down to every useSearchParams consumer).
// history.replaceState updates the visible URL only — see compliance/
// ChecklistsPage for the same pattern.
function syncFiltersToUrl(f: TaskHubFilters) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const setOrDelete = (key: string, values: string[]) => {
    if (values.length > 0) url.searchParams.set(key, values.join(','))
    else url.searchParams.delete(key)
  }
  setOrDelete('cat', f.categoryIds)
  setOrDelete('status', f.statuses)
  setOrDelete('tpl', f.templateSlugs)
  window.history.replaceState(null, '', url.toString())
}

// ─── View switcher ────────────────────────────────────────────────────────────

const VIEW_MODES = [
  { id: 'tabell', label: 'Tabell', Icon: Rows3 },
  { id: 'bokser', label: 'Bokser', Icon: LayoutGrid },
  { id: 'tidslinje', label: 'Tidslinje', Icon: CalendarDays },
  { id: 'tavle', label: 'Tavle', Icon: Columns3 },
] as const
type ViewMode = (typeof VIEW_MODES)[number]['id']

function ViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
      {VIEW_MODES.map(({ id, label, Icon }) => {
        const active = id === value
        return (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => onChange(id)}
            className={[
              'inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200'
                : 'text-neutral-500 hover:text-neutral-800',
            ].join(' ')}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden md:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Entries views ────────────────────────────────────────────────────────────

function EntriesTable({
  items,
  easy,
  subtaskCounts,
  onOpen,
}: {
  items: TaskItemRow[]
  easy: boolean
  subtaskCounts: Map<string, { done: number; total: number }>
  onOpen: (item: TaskItemRow) => void
}) {
  if (items.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen oppgaver i dette utvalget ennå.
      </div>
    )
  }
  return (
    <>
      {/* Mobile: compact list */}
      <ul className="divide-y divide-neutral-100 sm:hidden">
        {items.map((it) => {
          const personName = it.ownerName ?? it.assigneeName
          const overdue = isOverdue(it.dueDate, it.status)
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => onOpen(it)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 active:bg-neutral-100"
              >
                {it.templateKind ? (
                  <TaskKindIcon kind={it.templateKind} className="h-4 w-4 text-[#c2410c]/70" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-neutral-900">{it.title}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                    {personName && <span>{personName}</span>}
                    {personName && it.dueDate && <span>·</span>}
                    {it.dueDate && (
                      <span className={overdue ? 'font-semibold text-red-600' : 'tabular-nums'}>
                        {fmtDate(it.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
                <TaskStatusBadge status={it.status} />
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-300" aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
      {/* Desktop: full table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kategori</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
              {!easy && <th className={`w-36 ${LAYOUT_TABLE1_POSTINGS_TH}`}>Fremgang</th>}
              {!easy && <th className={LAYOUT_TABLE1_POSTINGS_TH}>Prioritet</th>}
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Ansvarlig</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Frist</th>
              <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const personName = it.ownerName ?? it.assigneeName
              const overdue = isOverdue(it.dueDate, it.status)
              return (
                <tr
                  key={it.id}
                  className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                  onClick={() => onOpen(it)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      {it.templateKind ? (
                        <TaskKindIcon kind={it.templateKind} className="h-4 w-4 shrink-0 text-[#c2410c]/70" />
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <span className="truncate font-medium text-neutral-900">{it.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-neutral-500">
                    {it.templateKind ? (KIND_LABEL[it.templateKind] ?? it.templateKind) : '—'}
                  </td>
                  <td className="px-5 py-3"><TaskStatusBadge status={it.status} /></td>
                  {!easy && (
                    <td className="w-36 px-5 py-3">
                      <ProgressBar taskId={it.id} status={it.status} subtaskCounts={subtaskCounts} />
                    </td>
                  )}
                  {!easy && (
                    <td className="px-5 py-3"><TaskPriorityBadge priority={it.priority} /></td>
                  )}
                  <td className="px-5 py-3">
                    {personName ? (
                      <span className="inline-flex items-center gap-2">
                        <PersonAvatar name={personName} size={22} />
                        <span className="text-neutral-700">{personName}</span>
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className={`px-5 py-3 tabular-nums ${overdue ? 'font-medium text-red-600' : 'text-neutral-700'}`}>
                    {fmtDate(it.dueDate)}
                  </td>
                  <td className="px-5 py-3 text-right text-neutral-300">›</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function EntriesBoxes({
  items,
  easy,
  subtaskCounts,
  onOpen,
}: {
  items: TaskItemRow[]
  easy: boolean
  subtaskCounts: Map<string, { done: number; total: number }>
  onOpen: (item: TaskItemRow) => void
}) {
  if (items.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen oppgaver i dette utvalget ennå.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => {
        const personName = it.ownerName ?? it.assigneeName
        const overdue = isOverdue(it.dueDate, it.status)
        return (
          <article
            key={it.id}
            onClick={() => onOpen(it)}
            className="cursor-pointer rounded-xl border border-neutral-200/80 bg-white p-4 transition-all hover:border-[#c2410c]/40 hover:shadow-md"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-start gap-3">
              {it.templateKind ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#c2410c]">
                  <TaskKindIcon kind={it.templateKind} className="h-4 w-4" />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-sm font-semibold leading-tight text-neutral-900">{it.title}</div>
                {it.templateKind && (
                  <div className="mt-0.5 text-[11px] text-neutral-500">
                    {KIND_LABEL[it.templateKind] ?? it.templateKind}
                  </div>
                )}
              </div>
              {personName && <PersonAvatar name={personName} size={22} />}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <TaskStatusBadge status={it.status} />
              {!easy && <TaskPriorityBadge priority={it.priority} />}
            </div>
            <div className="mt-3">
              <ProgressBar taskId={it.id} status={it.status} subtaskCounts={subtaskCounts} />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5 text-[11px] text-neutral-500">
              {it.dueDate ? (
                <span className={overdue ? 'font-semibold text-red-600' : 'tabular-nums'}>
                  Frist {fmtDate(it.dueDate)}{overdue ? ' — forfalt' : ''}
                </span>
              ) : (
                <span>Ingen frist</span>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function EntriesTimeline({
  items,
  easy,
  onOpen,
}: {
  items: TaskItemRow[]
  easy: boolean
  onOpen: (item: TaskItemRow) => void
}) {
  const sorted = [...items].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })

  const groups: Record<string, TaskItemRow[]> = {}
  sorted.forEach((it) => {
    if (!it.dueDate) return
    const d = new Date(it.dueDate)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = String(d.getFullYear())
    const key = `${mm}.${yyyy}`
    if (!groups[key]) groups[key] = []
    groups[key].push(it)
  })

  if (Object.keys(groups).length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen oppgaver med fristdato i dette utvalget.
      </div>
    )
  }

  return (
    <div className="p-5">
      <div className="space-y-5">
        {Object.entries(groups).map(([monthKey, list]) => {
          const [mm, yyyy] = monthKey.split('.')
          return (
            <div key={monthKey}>
              <div className="mb-2 flex items-baseline gap-2">
                <h4 className="text-sm font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  {MONTH_LABELS[mm]} {yyyy}
                </h4>
                <span className="text-[11px] tabular-nums text-neutral-400">{list.length} oppgaver</span>
              </div>
              <ol className="relative border-l-2 border-neutral-200 pl-5">
                {list.map((it) => {
                  const day = it.dueDate ? String(new Date(it.dueDate).getDate()).padStart(2, '0') : '?'
                  const overdue = isOverdue(it.dueDate, it.status)
                  const dotColor = overdue
                    ? 'bg-red-500'
                    : it.status === 'closed'
                    ? 'bg-green-600'
                    : it.status === 'cancelled'
                    ? 'bg-neutral-400'
                    : 'bg-blue-600'
                  const DotIcon = overdue ? AlertTriangle : it.status === 'closed' ? CheckCircle2 : ChevronRight
                  const personName = it.ownerName ?? it.assigneeName
                  return (
                    <li key={it.id} className="relative mb-2.5 last:mb-0">
                      <span className={`absolute -left-[28px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${dotColor}`}>
                        <DotIcon className="h-2.5 w-2.5 text-white" aria-hidden />
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpen(it)}
                        className="block w-full rounded-md border border-neutral-200/80 bg-white px-3 py-2 text-left hover:border-[#c2410c]/40 hover:bg-orange-50/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 shrink-0 text-center">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{MONTH_LABELS[mm]?.slice(0, 3)}</div>
                            <div className="text-base font-bold tabular-nums leading-none text-neutral-900">{day}</div>
                          </div>
                          <div className="h-8 w-px bg-neutral-200" />
                          {it.templateKind && (
                            <TaskKindIcon kind={it.templateKind} className="h-4 w-4 shrink-0 text-[#c2410c]/70" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-neutral-900">{it.title}</div>
                            <div className="text-[11px] text-neutral-500">
                              {it.templateKind ? (KIND_LABEL[it.templateKind] ?? it.templateKind) : ''}
                              {!easy && personName ? ` · ${personName}` : ''}
                            </div>
                          </div>
                          <TaskStatusBadge status={it.status} />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EntriesKanban({
  items,
  easy,
  onOpen,
}: {
  items: TaskItemRow[]
  easy: boolean
  onOpen: (item: TaskItemRow) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 overflow-x-auto p-3 sm:grid-cols-2 md:grid-cols-4">
      {KANBAN_COLS.map((col) => {
        const colItems = items.filter((it) => col.statuses.includes(it.status))
        return (
          <div key={col.key} className={`flex min-h-[400px] flex-col rounded-lg border border-neutral-200/80 ${col.color}/60`}>
            <div className="flex items-center justify-between border-b border-neutral-200/70 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: col.accent }} />
                <span className="text-xs font-semibold text-neutral-900">{col.label}</span>
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 ring-1 ring-neutral-200">{colItems.length}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2 p-2">
              {colItems.length === 0 ? (
                <div className="rounded-md border border-dashed border-neutral-200 p-3 text-center text-[11px] text-neutral-400">Ingen</div>
              ) : (
                colItems.map((it) => {
                  const personName = it.ownerName ?? it.assigneeName
                  const overdue = isOverdue(it.dueDate, it.status)
                  return (
                    <article
                      key={it.id}
                      onClick={() => onOpen(it)}
                      className="cursor-pointer rounded-md border border-neutral-200/80 bg-white p-2.5 hover:border-[#c2410c]/40 hover:shadow-sm"
                      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                    >
                      <div className="flex items-start gap-2">
                        {it.templateKind && (
                          <TaskKindIcon kind={it.templateKind} className="h-3.5 w-3.5 shrink-0 text-[#c2410c]/70" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-xs font-medium leading-tight text-neutral-900">{it.title}</div>
                          {!easy && it.templateKind && (
                            <div className="mt-0.5 text-[10px] text-neutral-500">{KIND_LABEL[it.templateKind] ?? it.templateKind}</div>
                          )}
                        </div>
                      </div>
                      {!easy && (
                        <div className="mt-1.5">
                          <TaskPriorityBadge priority={it.priority} />
                        </div>
                      )}
                      <div className="mt-1.5 flex items-center justify-between border-t border-neutral-100 pt-1.5 text-[10px]">
                        {it.dueDate ? (
                          <span className={overdue ? 'font-semibold text-red-700' : 'tabular-nums text-neutral-500'}>
                            {fmtDate(it.dueDate)}{overdue ? ' ⚠' : ''}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                        {!easy && personName ? <PersonAvatar name={personName} size={16} /> : null}
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Maler views ──────────────────────────────────────────────────────────────

function MalerTable({
  templates,
  easy,
  categoryNameById,
  onStart,
  onOpen,
}: {
  templates: TaskTemplateRow[]
  easy: boolean
  categoryNameById: Map<string, string>
  onStart: (slug: string) => void
  onOpen: (slug: string) => void
}) {
  if (templates.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen aktive maler. Gå til Innstillinger for å aktivere maler.
      </div>
    )
  }
  return (
    <>
      {/* Mobile: compact list */}
      <ul className="divide-y divide-neutral-100 sm:hidden">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <TaskKindIcon kind={t.templateKind} className="h-4 w-4 text-[#c2410c]/70" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-neutral-900">{t.name}</div>
              <div className="text-[11px] text-neutral-500">{t.cadenceHint ?? 'Ingen kadense'}</div>
            </div>
            <Button variant="primary" size="sm" icon={<Play className="h-3 w-3" />} onClick={() => onStart(t.slug)}>
              Start
            </Button>
          </li>
        ))}
      </ul>
      {/* Desktop: full table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Mal</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kategori</th>
              {!easy && <th className={LAYOUT_TABLE1_POSTINGS_TH}>Lovverk</th>}
              {!easy && <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kadense</th>}
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`} />
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}>
                <td className="px-5 py-3" onClick={() => onOpen(t.slug)}>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-50 text-[#c2410c]">
                      <TaskKindIcon kind={t.templateKind} className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 font-medium text-neutral-900">
                        {t.name}
                        {t.navPinned && (
                          <Badge variant="success">
                            <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
                            Festet
                          </Badge>
                        )}
                      </div>
                      {t.description && (
                        <div className="line-clamp-1 text-[11px] text-neutral-500">{t.description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-xs text-neutral-600">
                  {t.categoryId ? (categoryNameById.get(t.categoryId) ?? '—') : '—'}
                </td>
                {!easy && (
                  <td className="px-5 py-3">
                    {t.lawRefs.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.lawRefs.slice(0, 3).map((ref) => (
                          <span key={ref} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                            {ref}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                )}
                {!easy && (
                  <td className="px-5 py-3 text-neutral-700">
                    {t.cadenceHint ?? <span className="text-neutral-400">—</span>}
                  </td>
                )}
                <td className="px-5 py-3 text-right">
                  <Button variant="primary" size="sm" icon={<Play className="h-3 w-3" />} onClick={() => onStart(t.slug)}>
                    Start
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function MalerBoxes({
  templates,
  easy,
  categoryNameById,
  onStart,
  onOpen,
}: {
  templates: TaskTemplateRow[]
  easy: boolean
  categoryNameById: Map<string, string>
  onStart: (slug: string) => void
  onOpen: (slug: string) => void
}) {
  if (templates.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-neutral-500">
        Ingen aktive maler. Gå til Innstillinger for å aktivere maler.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <article key={t.id} className="relative flex flex-col rounded-xl border border-neutral-200/80 bg-white" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <FavoriteToggle
            kind="task"
            templateRef={t.id}
            templateName={t.name}
            size="sm"
            className="absolute right-1.5 top-1.5 z-10 bg-white/90"
          />
          <button
            type="button"
            onClick={() => onOpen(t.slug)}
            className="flex items-start gap-3 p-4 pb-3 pr-10 text-left transition-colors hover:bg-orange-50/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#c2410c]">
              <TaskKindIcon kind={t.templateKind} className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Mal · {t.categoryId ? (categoryNameById.get(t.categoryId) ?? 'Uten kategori') : 'Uten kategori'}
              </div>
              <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-tight text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                {t.name}
              </h3>
            </div>
          </button>
          {t.description ? (
            <div className="border-t border-dashed border-neutral-200 px-4 py-2.5">
              <p className="line-clamp-3 text-[11px] text-neutral-600">{t.description}</p>
            </div>
          ) : null}
          {!easy && t.lawRefs.length > 0 && (
            <div className="border-t border-neutral-100 bg-orange-50/40 px-4 py-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-1">
                {t.lawRefs.slice(0, 3).map((ref) => (
                  <span key={ref} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                    {ref}
                  </span>
                ))}
                {t.cadenceHint && (
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">{t.cadenceHint}</span>
                )}
              </div>
            </div>
          )}
          <div className="mt-auto flex items-center justify-between border-t border-neutral-100 px-4 py-2.5">
            <Link to="/tasks/management/admin" className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800">
              Rediger ›
            </Link>
            <Button variant="primary" size="sm" icon={<Play className="h-3 w-3" />} onClick={() => onStart(t.slug)}>
              Start
            </Button>
          </div>
        </article>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TasksManagementPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const templateSlug = searchParams.get('template')
  const projectId = searchParams.get('project')
  // Deeplink — when present, open the task detail panel for that id.
  // Used by the Risikoregister-side to drill from a row into the
  // source task. Cleared from the URL after the panel opens so a
  // browser back doesn't re-open it.
  const selectedIdParam = searchParams.get('selected')

  const isTemplateMode = !!templateSlug && !projectId

  const tplData = useTaskTemplates()
  const projectsData = useTaskProjects({ skip: isTemplateMode })
  const itemData = useTaskItemsData(
    projectId
      ? { projectId }
      : templateSlug
      ? { templateSlug }
      : { templateSlug: null },
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [createTemplateSlug, setCreateTemplateSlug] = useState<string | null>(null)
  const [projectCreateOpen, setProjectCreateOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TaskItemRow | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [showAllProjects, setShowAllProjects] = useState(false)

  // ?selected=<id> deeplink — derive the matching item, capture it into
  // `selectedItem`, then strip the param.
  const selectedFromUrl = useMemo(
    () => (selectedIdParam ? itemData.items.find((it) => it.id === selectedIdParam) ?? null : null),
    [selectedIdParam, itemData.items],
  )
  useEffect(() => {
    if (!selectedFromUrl) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedItem(selectedFromUrl)
    const next = new URLSearchParams(searchParams)
    next.delete('selected')
    setSearchParams(next, { replace: true })
  }, [selectedFromUrl, searchParams, setSearchParams])
  const effectiveSelected = selectedItem ?? selectedFromUrl

  const focusedTemplate = useMemo(() => {
    if (!templateSlug) return null
    return tplData.templates.find((t) => t.slug === templateSlug) ?? null
  }, [tplData.templates, templateSlug])

  const focusedProject = useMemo(() => {
    if (!projectId) return null
    return projectsData.projects.find((p) => p.id === projectId) ?? null
  }, [projectsData.projects, projectId])

  const mode: 'hub' | 'template' | 'project' =
    focusedProject ? 'project' : focusedTemplate ? 'template' : 'hub'

  // ── Project board mode ────────────────────────────────────────────────────
  if (mode === 'project' && focusedProject) {
    const proj = focusedProject
    const methodologyLabel = proj.methodology === 'pdca' ? 'PDCA' : 'Kanban'

    const KANBAN_COL_STATUS: Record<string, TaskItemStatus> = {
      backlog: 'open',
      progress: 'in_progress',
      review: 'effectiveness_pending',
    }

    const handleMoveCard = async (
      itemId: string,
      newPhase: TaskPdcaPhase | null,
      newStatus: TaskItemStatus | null,
    ): Promise<boolean> => {
      setBoardError(null)
      const ok = newPhase
        ? await itemData.updatePdcaPhase(itemId, newPhase)
        : newStatus
        ? await itemData.updateStatus(itemId, newStatus)
        : true
      if (!ok) setBoardError('Kunne ikke flytte oppgaven. Kontroller tilkoblingen og prøv igjen.')
      return ok
    }

    const handleQuickCreate = async (colKey: string, title: string): Promise<string | null> => {
      setBoardError(null)
      const id = await itemData.createItem({
        title,
        priority: 'medium',
        projectId: proj.id,
        templateSlug: 'oppgave-generell',
        templateKind: 'oppgave',
        pdcaPhase: proj.methodology === 'pdca' ? (colKey as TaskPdcaPhase) : 'do',
        status: proj.methodology === 'kanban' ? (KANBAN_COL_STATUS[colKey] ?? 'open') : 'open',
      })
      if (!id) setBoardError('Kunne ikke opprette oppgave.')
      return id
    }

    return (
      <>
        <ModulePageShell
          breadcrumb={[
            { label: 'Oppgaver', to: '/tasks/management' },
            { label: proj.title },
          ]}
          title={
            <span className="flex items-center gap-2">
              <KanbanSquare className="h-5 w-5 text-[#c2410c]/70" />
              {proj.title}
            </span>
          }
          description={proj.description || undefined}
          headerActions={
            <div className="flex items-center gap-2">
              <span className="hidden rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 sm:inline">
                {methodologyLabel}
              </span>
              {proj.status === 'active' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void projectsData.updateProject(proj.id, { status: 'closed' })}
                >
                  Lukk prosjekt
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            {proj.lawRefs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {proj.lawRefs.map((ref) => (
                  <span
                    key={ref}
                    className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            )}
            {(itemData.error ?? boardError) && (
              <WarningBox>{itemData.error ?? boardError}</WarningBox>
            )}
            <TaskProjectBoard
              project={proj}
              items={itemData.items}
              onCardClick={setSelectedItem}
              onMoveCard={handleMoveCard}
              onQuickCreate={handleQuickCreate}
            />
          </div>
        </ModulePageShell>

        <TaskDetailPanel
          open={effectiveSelected !== null}
          onClose={() => setSelectedItem(null)}
          item={effectiveSelected}
          onStatusChange={async (id, status) => {
            await itemData.updateStatus(id, status)
            setSelectedItem((prev) => (prev?.id === id ? { ...prev, status } : prev))
          }}
        />
      </>
    )
  }

  // ── Hub mode ─────────────────────────────────────────────────────────────
  if (mode === 'hub') {
    return (
      <HubMode
        templates={tplData.templates}
        categories={tplData.categories}
        templatesLoading={tplData.loading}
        templatesError={tplData.error}
        items={itemData.items}
        itemsLoading={itemData.loading}
        itemsError={itemData.error}
        onOpenItem={setSelectedItem}
        onStartCreate={(slug) => {
          setCreateTemplateSlug(slug)
          setCreateOpen(true)
        }}
        projects={projectsData.projects}
        projectsLoading={projectsData.loading}
        showAllProjects={showAllProjects}
        onToggleAllProjects={() => setShowAllProjects((v) => !v)}
        onCreateProject={() => setProjectCreateOpen(true)}
        onOpenProject={(id) => navigate(`/tasks/management?project=${id}`)}
        createOpen={createOpen}
        createTemplateSlug={createTemplateSlug}
        onCloseCreate={() => {
          setCreateOpen(false)
          setCreateTemplateSlug(null)
        }}
        onCreateItem={async (input) => {
          const id = await itemData.createItem(input)
          if (id) {
            setCreateOpen(false)
            setCreateTemplateSlug(null)
          }
          return id
        }}
        projectCreateOpen={projectCreateOpen}
        onCloseProjectCreate={() => setProjectCreateOpen(false)}
        onCreateProjectSubmit={async (input) => {
          const id = await projectsData.createProject(input)
          if (id) navigate(`/tasks/management?project=${id}`)
          return id
        }}
        effectiveSelected={effectiveSelected}
        onCloseDetail={() => setSelectedItem(null)}
        onStatusChange={async (id, status) => {
          await itemData.updateStatus(id, status)
          setSelectedItem((prev) => (prev?.id === id ? { ...prev, status } : prev))
        }}
      />
    )
  }

  // ── Template mode ─────────────────────────────────────────────────────────
  const tpl = focusedTemplate!
  const ctaLabel = `Ny ${tpl.name.toLowerCase()}`

  return (
    <>
      <ModulePageShell
        breadcrumb={[
          { label: 'Oppgaver', to: '/tasks/management' },
          { label: tpl.name },
        ]}
        title={
          <span className="flex items-center gap-2">
            <TaskKindIcon kind={tpl.templateKind} className="h-5 w-5 text-[#c2410c]/70" />
            {tpl.name}
          </span>
        }
        description={tpl.description || undefined}
        headerActions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
            >
              {ctaLabel}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {itemData.error && <WarningBox>{itemData.error}</WarningBox>}

          {/* Law refs */}
          {tpl.lawRefs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tpl.lawRefs.map((ref) => (
                <span
                  key={ref}
                  className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600"
                >
                  {ref}
                </span>
              ))}
            </div>
          )}

          <LayoutTable1PostingsShell
            wrap
            title={tpl.name}
            description={`Alle ${tpl.name.toLowerCase()} — sortert etter opprettelsesdato.`}
            toolbar={null}
            footer={
              <span className="text-neutral-500">
                {itemData.loading ? 'Laster…' : `${itemData.items.length} poster`}
              </span>
            }
          >
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Prioritet</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Ansvarlig</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Frist</th>
                    <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
                  </tr>
                </thead>
                <tbody>
                  {itemData.loading && itemData.items.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="py-12 text-center">
                          <p className="text-sm text-neutral-500">Laster oppgaver…</p>
                        </div>
                      </td>
                    </tr>
                  ) : itemData.items.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="py-12 text-center">
                          <p className="text-sm text-neutral-500">
                            Ingen {tpl.name.toLowerCase()} ennå.
                          </p>
                          <div className="mt-3 inline-flex">
                            <Button
                              variant="primary"
                              icon={<Plus className="h-4 w-4" />}
                              onClick={() => setCreateOpen(true)}
                            >
                              {ctaLabel}
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    itemData.items.map((row) => (
                      <tr
                        key={row.id}
                        className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                        onClick={() => setSelectedItem(row)}
                      >
                        <td className="px-5 py-3 font-medium text-neutral-900">{row.title}</td>
                        <td className="px-5 py-3">
                          <TaskStatusBadge status={row.status} />
                        </td>
                        <td className="px-5 py-3">
                          <TaskPriorityBadge priority={row.priority} />
                        </td>
                        <td className="px-5 py-3 text-neutral-600">
                          {row.ownerName ?? row.assigneeName ?? '—'}
                        </td>
                        <td
                          className={`px-5 py-3 text-sm ${
                            isOverdue(row.dueDate, row.status)
                              ? 'font-medium text-red-600'
                              : 'text-neutral-600'
                          }`}
                        >
                          {fmtDate(row.dueDate)}
                        </td>
                        <td className="w-8 px-3 py-3 text-neutral-300">
                          <ChevronRight className="h-4 w-4" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </LayoutTable1PostingsShell>
        </div>
      </ModulePageShell>

      {/* Create form */}
      <TaskCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        template={tpl}
        onCreate={async (input) => {
          const id = await itemData.createItem(input)
          if (id) setCreateOpen(false)
          return id
        }}
      />

      {/* Detail panel */}
      <TaskDetailPanel
        open={effectiveSelected !== null}
        onClose={() => setSelectedItem(null)}
        item={effectiveSelected}
        onStatusChange={async (id, status) => {
          await itemData.updateStatus(id, status)
          setSelectedItem((prev) => (prev?.id === id ? { ...prev, status } : prev))
        }}
      />
    </>
  )
}

// ─── Hub mode component ───────────────────────────────────────────────────────
//
// Extracted so its filter-state hooks (useState/useEffect) don't run when
// the page is in template or project mode. Mirrors the layout of
// `modules/compliance/ChecklistsPage` hub mode: tabs + search + view
// switcher in a card header, FilterBar with Enkel/Avansert + chips +
// saved views, then per-view content.

type HubModeProps = {
  templates: TaskTemplateRow[]
  categories: ReturnType<typeof useTaskTemplates>['categories']
  templatesLoading: boolean
  templatesError: string | null
  items: TaskItemRow[]
  itemsLoading: boolean
  itemsError: string | null
  onOpenItem: (item: TaskItemRow) => void
  onStartCreate: (slug: string) => void
  projects: ReturnType<typeof useTaskProjects>['projects']
  projectsLoading: boolean
  showAllProjects: boolean
  onToggleAllProjects: () => void
  onCreateProject: () => void
  onOpenProject: (id: string) => void
  createOpen: boolean
  createTemplateSlug: string | null
  onCloseCreate: () => void
  onCreateItem: (input: Parameters<ReturnType<typeof useTaskItemsData>['createItem']>[0]) => Promise<string | null>
  projectCreateOpen: boolean
  onCloseProjectCreate: () => void
  onCreateProjectSubmit: (input: Parameters<ReturnType<typeof useTaskProjects>['createProject']>[0]) => Promise<string | null>
  effectiveSelected: TaskItemRow | null
  onCloseDetail: () => void
  onStatusChange: (id: string, status: TaskItemStatus) => Promise<void>
}

function HubMode(props: HubModeProps) {
  const {
    templates,
    categories,
    templatesLoading,
    templatesError,
    items,
    itemsLoading,
    itemsError,
    onOpenItem,
    onStartCreate,
    projects,
    showAllProjects,
    onToggleAllProjects,
    onCreateProject,
    onOpenProject,
    createOpen,
    createTemplateSlug,
    onCloseCreate,
    onCreateItem,
    projectCreateOpen,
    onCloseProjectCreate,
    onCreateProjectSubmit,
    effectiveSelected,
    onCloseDetail,
    onStatusChange,
  } = props

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Subtask counts power the per-row progress bars in Tabell/Bokser views.
  const subtaskCounts = useSubtaskCounts()

  // ── Hub-mode UI state ───────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'entries' | 'maler'>('entries')
  const [viewMode, setViewMode] = useState<'easy' | 'advanced'>('easy')
  const [view, setView] = useState<ViewMode>('tabell')
  const [search, setSearch] = useState('')
  const [showAllEntries, setShowAllEntries] = useState(false)
  const [showAllMaler, setShowAllMaler] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  // ── Filters ─────────────────────────────────────────────────────────────
  // Hydrated from URL on first mount; subsequent edits pushed back via
  // history.replaceState in the effect so deep links stay shareable
  // without the cascade re-render cost of setSearchParams.
  const [filters, setFiltersState] = useState<TaskHubFilters>(() =>
    filtersFromSearchParams(searchParams),
  )
  const setFilters = useCallback((next: TaskHubFilters) => {
    setFiltersState(next)
  }, [])
  useEffect(() => {
    syncFiltersToUrl(filters)
  }, [filters])
  const activeFilterCount = countActiveFilters(filters)

  // ── Saved views ─────────────────────────────────────────────────────────
  const savedViews = useSavedViews<TaskHubFilters>('tasks_hub')
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [defaultApplied, setDefaultApplied] = useState(false)
  useEffect(() => {
    if (defaultApplied) return
    if (savedViews.loading) return
    if (activeFilterCount > 0) {
      const match = savedViews.views.find((v) =>
        filtersEqual(filters, { ...EMPTY_FILTERS, ...v.filters }),
      )
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (match) setActiveViewId(match.id)
      setDefaultApplied(true)
      return
    }
    if (savedViews.defaultViewId) {
      const def = savedViews.views.find((v) => v.id === savedViews.defaultViewId)
      if (def) {
        setFilters({ ...EMPTY_FILTERS, ...def.filters })
        setActiveViewId(def.id)
      }
    }
    setDefaultApplied(true)
  }, [
    defaultApplied,
    savedViews.loading,
    savedViews.defaultViewId,
    savedViews.views,
    activeFilterCount,
    filters,
    setFilters,
  ])

  const hasUnsavedChanges = useMemo(() => {
    if (!activeViewId) return false
    const v = savedViews.views.find((sv) => sv.id === activeViewId)
    if (!v) return false
    return !filtersEqual(filters, { ...EMPTY_FILTERS, ...v.filters })
  }, [activeViewId, filters, savedViews.views])

  const easy = viewMode === 'easy'

  // ── Lookups ─────────────────────────────────────────────────────────────
  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.id, c.name)
    return m
  }, [categories])

  // Map: categoryId → set of template slugs in that category.
  // Items reference templates by slug (not id), so the filter expands
  // selected category ids into the slug set that the item-filter checks.
  const slugsByCategory = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const t of templates) {
      if (t.categoryId) {
        const s = m.get(t.categoryId) ?? new Set()
        s.add(t.slug)
        m.set(t.categoryId, s)
      }
    }
    return m
  }, [templates])

  // Reset pagination when filters or tabs change.
  useEffect(() => {
    setShowAllEntries(false)
    setShowAllMaler(false)
  }, [filters, search, activeTab, viewMode])
  useEffect(() => {
    if (!templatesLoading && !itemsLoading) setHasLoadedOnce(true)
  }, [templatesLoading, itemsLoading])

  // ── Derived: which template slugs match the selected categories? ────────
  const slugsFromCategories = useMemo(() => {
    if (filters.categoryIds.length === 0) return null
    const set = new Set<string>()
    for (const catId of filters.categoryIds) {
      const slugSet = slugsByCategory.get(catId)
      if (slugSet) slugSet.forEach((s) => set.add(s))
    }
    return set
  }, [filters.categoryIds, slugsByCategory])

  // ── Filtered entries (Gjennomføringer tab) ──────────────────────────────
  const displayedEntries = useMemo(() => {
    let result = items
    if (slugsFromCategories) {
      result = result.filter((it) => it.templateSlug && slugsFromCategories.has(it.templateSlug))
    }
    if (filters.templateSlugs.length > 0) {
      const tplSet = new Set(filters.templateSlugs)
      result = result.filter((it) => it.templateSlug && tplSet.has(it.templateSlug))
    }
    if (filters.statuses.length > 0) {
      const statusSet = new Set(filters.statuses)
      result = result.filter((it) => statusSet.has(it.status))
    }
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter((it) => {
        const owner = (it.ownerName ?? it.assigneeName ?? '').toLowerCase()
        return it.title.toLowerCase().includes(q) || owner.includes(q)
      })
    }
    return result
  }, [items, slugsFromCategories, filters.templateSlugs, filters.statuses, search])

  // ── Filtered templates (Maler tab) ──────────────────────────────────────
  const displayedTemplates = useMemo(() => {
    let tpls = templates
    if (filters.categoryIds.length > 0) {
      const catSet = new Set(filters.categoryIds)
      tpls = tpls.filter((t) => t.categoryId && catSet.has(t.categoryId))
    }
    if (filters.templateSlugs.length > 0) {
      const slugSet = new Set(filters.templateSlugs)
      tpls = tpls.filter((t) => slugSet.has(t.slug))
    }
    const q = search.trim().toLowerCase()
    if (q) tpls = tpls.filter((t) => t.name.toLowerCase().includes(q))
    // Sort: pinned first, then by name
    return [...tpls].sort((a, b) => {
      const tier = (t: TaskTemplateRow) => (t.navPinned ? 0 : t.isSystem ? 1 : 2)
      const d = tier(a) - tier(b)
      return d !== 0 ? d : a.name.localeCompare(b.name, 'nb')
    })
  }, [templates, filters.categoryIds, filters.templateSlugs, search])

  // ── Filter chip options — counts reflect live data ──────────────────────
  const categoryFilterOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: c.name,
        count: items.filter((it) => {
          const slugSet = slugsByCategory.get(c.id)
          return slugSet && it.templateSlug ? slugSet.has(it.templateSlug) : false
        }).length,
      })),
    [categories, items, slugsByCategory],
  )

  const statusFilterOptions = useMemo(
    () =>
      ALL_STATUSES.map((s) => ({
        value: s,
        label: TASK_STATUS_LABEL[s],
        count: items.filter((it) => it.status === s).length,
      })),
    [items],
  )

  const templateFilterOptions = useMemo(
    () =>
      templates
        .map((t) => ({
          value: t.slug,
          label: t.name,
          count: items.filter((it) => it.templateSlug === t.slug).length,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'nb')),
    [templates, items],
  )

  // Template for the create form when launched from a Maler "Start" button.
  const createTemplate = useMemo(
    () => (createTemplateSlug ? templates.find((t) => t.slug === createTemplateSlug) ?? null : null),
    [templates, createTemplateSlug],
  )

  const visibleProjects = projects.filter((p) => showAllProjects || p.status === 'active')

  return (
    <>
      <ModulePageShell
        breadcrumb={[{ label: 'Oppgaver' }]}
        width="full"
        title="Oppgaver"
        description="Velg en mal for å opprette og følge opp oppgaver, avvik, risiko og forslag."
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/tasks/management/review"
              className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Printer className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Gjennomgang</span>
            </Link>
            <Link
              to="/tasks/management/analyse"
              className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Analyse</span>
            </Link>
            <Link
              to="/tasks/management/admin"
              className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Settings className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Innstillinger</span>
            </Link>
          </div>
        }
      >
        {/* Scope --ui-accent to the tasks orange so FilterBar/FilterChip
            chrome render in the module's accent (matches the per-scope
            accent map registered in src/lib/dashboards/). */}
        <div style={{ ['--ui-accent' as string]: TASK_ACCENT }} className="space-y-6">
          {templatesError && <WarningBox>{templatesError}</WarningBox>}
          {itemsError && <WarningBox>{itemsError}</WarningBox>}

          {/* Loading skeleton — first paint only */}
          {(templatesLoading || itemsLoading) && templates.length === 0 && items.length === 0 ? (
            <div className="animate-pulse space-y-4">
              <div className="h-10 rounded-lg bg-neutral-100" />
              <div className="h-10 rounded-lg bg-neutral-100 w-2/3" />
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-neutral-100" />
              ))}
            </div>
          ) : null}

          <section className={['space-y-3', (templatesLoading || itemsLoading) && templates.length === 0 && items.length === 0 ? 'hidden' : ''].join(' ')}>
            <div className="rounded-xl border border-neutral-200/80 bg-white" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              {/* Header strip: tabs + search + view switcher */}
              <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                {/* Tabs */}
                <nav className="flex items-center gap-1" aria-label="Faner">
                  {([
                    { id: 'entries', label: 'Gjennomføringer', Icon: ClipboardList, count: displayedEntries.length },
                    { id: 'maler', label: 'Maler', Icon: ClipboardCheck, count: displayedTemplates.length },
                  ] as const).map(({ id, label, Icon, count }) => {
                    const active = activeTab === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveTab(id)}
                        aria-current={active ? 'page' : undefined}
                        className={[
                          'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          active ? 'bg-[var(--ui-accent)] text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                        ].join(' ')}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span>{label}</span>
                        <span className={['ml-1.5 rounded-full px-2 py-0.5 text-xs', active ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'].join(' ')}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </nav>

                {/* Search + view switcher */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
                    <input
                      type="search"
                      placeholder={activeTab === 'entries' ? 'Søk i tittel, ansvarlig…' : 'Søk i malnavn…'}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--ui-accent)] focus:bg-white sm:w-64"
                    />
                  </div>
                  <ViewSwitcher value={view} onChange={setView} />
                </div>
              </div>

              {/* Filter bar — Enkel/Avansert + Kategori/Status/Mal + saved views */}
              <FilterBar
                leading={
                  <div
                    role="tablist"
                    aria-label="Visningsmodus"
                    className="inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-neutral-50 p-0.5"
                  >
                    {([
                      { id: 'easy', label: 'Enkel', Icon: CircleDot },
                      { id: 'advanced', label: 'Avansert', Icon: SlidersHorizontal },
                    ] as const).map(({ id, label, Icon }) => {
                      const active = viewMode === id
                      return (
                        <button
                          key={id}
                          role="tab"
                          type="button"
                          aria-selected={active}
                          onClick={() => setViewMode(id)}
                          className={[
                            'inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition-colors',
                            active
                              ? 'bg-[var(--ui-accent)] text-white shadow-sm'
                              : 'text-neutral-600 hover:text-neutral-900',
                          ].join(' ')}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="hidden sm:inline">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                }
                chips={
                  <>
                    <FilterChip
                      label="Kategori"
                      options={categoryFilterOptions}
                      value={filters.categoryIds}
                      onChange={(next) => {
                        setFilters({ ...filters, categoryIds: next })
                        setActiveViewId(null)
                      }}
                    />
                    {activeTab === 'entries' ? (
                      <FilterChip
                        label="Status"
                        options={statusFilterOptions}
                        value={filters.statuses}
                        onChange={(next) => {
                          setFilters({ ...filters, statuses: next as TaskItemStatus[] })
                          setActiveViewId(null)
                        }}
                      />
                    ) : null}
                    <FilterChip
                      label="Mal"
                      options={templateFilterOptions}
                      value={filters.templateSlugs}
                      onChange={(next) => {
                        setFilters({ ...filters, templateSlugs: next })
                        setActiveViewId(null)
                      }}
                    />
                  </>
                }
                activeFilterCount={activeFilterCount}
                onReset={() => {
                  setFilters(EMPTY_FILTERS)
                  setActiveViewId(null)
                }}
                savedViews={
                  <SavedViewsControl<TaskHubFilters>
                    currentFilters={filters}
                    activeViewId={activeViewId}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onApplyView={(v) => {
                      setFilters({ ...EMPTY_FILTERS, ...v.filters })
                      setActiveViewId(v.id)
                    }}
                    onClearActive={() => setActiveViewId(null)}
                    saved={savedViews}
                  />
                }
              />

              {/* Body */}
              <div className="p-0">
                {activeTab === 'entries' ? (
                  <>
                    {hasLoadedOnce && displayedEntries.length === 0 && (templatesLoading || itemsLoading) === false ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-neutral-400">
                        <ClipboardList className="h-10 w-10 opacity-30" />
                        <p className="text-sm font-medium">Ingen oppgaver i dette utvalget</p>
                        <p className="text-xs">Juster filtrene eller start fra en mal.</p>
                      </div>
                    ) : (() => {
                      const paged = showAllEntries ? displayedEntries : displayedEntries.slice(0, HUB_PAGE_SIZE)
                      const hasMore = !showAllEntries && displayedEntries.length > HUB_PAGE_SIZE
                      return (
                        <>
                          {view === 'tabell' && (
                            <EntriesTable items={paged} easy={easy} subtaskCounts={subtaskCounts} onOpen={onOpenItem} />
                          )}
                          {view === 'bokser' && (
                            <EntriesBoxes items={paged} easy={easy} subtaskCounts={subtaskCounts} onOpen={onOpenItem} />
                          )}
                          {view === 'tidslinje' && (
                            <EntriesTimeline items={paged} easy={easy} onOpen={onOpenItem} />
                          )}
                          {view === 'tavle' && (
                            <EntriesKanban items={paged} easy={easy} onOpen={onOpenItem} />
                          )}
                          {hasMore && (
                            <div className="flex items-center justify-center border-t border-neutral-100 py-3">
                              <button
                                type="button"
                                onClick={() => setShowAllEntries(true)}
                                className="text-xs font-semibold text-[var(--ui-accent)] hover:underline"
                              >
                                Vis alle {displayedEntries.length} oppgaver
                              </button>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </>
                ) : (
                  <>
                    {hasLoadedOnce && !templatesLoading && displayedTemplates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-neutral-400">
                        <ClipboardCheck className="h-10 w-10 opacity-30" />
                        <p className="text-sm font-medium">Ingen aktive maler i dette utvalget</p>
                        <p className="text-xs">Aktiver maler i Innstillinger for å komme i gang.</p>
                      </div>
                    ) : (() => {
                      const pagedMaler = showAllMaler ? displayedTemplates : displayedTemplates.slice(0, HUB_PAGE_SIZE)
                      const hasMoreMaler = !showAllMaler && displayedTemplates.length > HUB_PAGE_SIZE
                      const malerView = view === 'bokser' ? 'bokser' : 'tabell'
                      return (
                        <>
                          {malerView === 'bokser' ? (
                            <MalerBoxes
                              templates={pagedMaler}
                              easy={easy}
                              categoryNameById={categoryNameById}
                              onStart={onStartCreate}
                              onOpen={(slug) => navigate(`/tasks/management?template=${encodeURIComponent(slug)}`)}
                            />
                          ) : (
                            <MalerTable
                              templates={pagedMaler}
                              easy={easy}
                              categoryNameById={categoryNameById}
                              onStart={onStartCreate}
                              onOpen={(slug) => navigate(`/tasks/management?template=${encodeURIComponent(slug)}`)}
                            />
                          )}
                          {hasMoreMaler && (
                            <div className="flex items-center justify-center border-t border-neutral-100 py-3">
                              <button
                                type="button"
                                onClick={() => setShowAllMaler(true)}
                                className="text-xs font-semibold text-[var(--ui-accent)] hover:underline"
                              >
                                Vis alle {displayedTemplates.length} maler
                              </button>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Projects section — kept below the filter card so the hub still
              surfaces Kanban / PDCA boards. Compliance has no equivalent. */}
          <ModuleSectionCard className="p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200/70 pb-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold text-neutral-900">Prosjekttavler</h2>
                <span className="text-xs text-neutral-500">{projects.filter((p) => p.status === 'active').length} aktive</span>
              </div>
              <div className="flex items-center gap-2">
                {projects.some((p) => p.status !== 'active') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleAllProjects}
                    className="px-0 text-xs text-neutral-400 underline-offset-2 hover:bg-transparent hover:text-neutral-600 hover:underline"
                  >
                    {showAllProjects
                      ? 'Skjul avsluttede'
                      : `Vis avsluttede (${projects.filter((p) => p.status !== 'active').length})`}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onCreateProject}
                  icon={<Plus className="h-3.5 w-3.5" />}
                  className="border-neutral-200 hover:border-[#c2410c]/30 hover:text-[#c2410c]"
                >
                  Nytt prosjekt
                </Button>
              </div>
            </div>

            {visibleProjects.length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-500">
                Ingen aktive prosjekttavler.{' '}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCreateProject}
                  className="px-0 text-[#c2410c] underline-offset-2 hover:bg-transparent hover:underline"
                >
                  Opprett det første
                </Button>
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProjects.map((proj) => (
                  <li key={proj.id}>
                    <Button
                      variant="ghost"
                      onClick={() => onOpenProject(proj.id)}
                      className={`group flex h-full w-full flex-col items-start gap-2 rounded-lg border p-4 text-left font-normal transition-all ${
                        proj.status === 'active'
                          ? 'border-neutral-200/80 bg-white hover:border-[#c2410c]/30 hover:bg-orange-50/30 hover:shadow-sm'
                          : 'border-neutral-200/50 bg-neutral-50/60 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 shrink-0 text-[#c2410c]/60 transition group-hover:text-[#c2410c]">
                          <KanbanSquare className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-neutral-900 group-hover:text-[#c2410c]">
                            {proj.title}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                              {proj.methodology}
                            </span>
                            {proj.status !== 'active' && (
                              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                                {proj.status === 'closed' ? 'Lukket' : 'Arkivert'}
                              </span>
                            )}
                          </span>
                        </span>
                      </div>
                      {proj.description && (
                        <p className="line-clamp-2 text-xs text-neutral-500">{proj.description}</p>
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ModuleSectionCard>
        </div>
      </ModulePageShell>

      {/* Create task form — opened from Maler "Start" buttons */}
      {createTemplate && (
        <TaskCreateForm
          open={createOpen}
          onClose={onCloseCreate}
          template={createTemplate}
          onCreate={onCreateItem}
        />
      )}

      <TaskProjectCreateForm
        open={projectCreateOpen}
        onClose={onCloseProjectCreate}
        onCreate={onCreateProjectSubmit}
      />

      <TaskDetailPanel
        open={effectiveSelected !== null}
        onClose={onCloseDetail}
        item={effectiveSelected}
        onStatusChange={onStatusChange}
      />
    </>
  )
}

