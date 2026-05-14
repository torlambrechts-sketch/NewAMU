// TasksAllePage — cross-template task list.
// Shows every task_item for the org with a search bar + cream-deep filter bar
// (mirrors Regelverk-dekning pattern). Three view modes: kanban (status columns),
// box (card grid), list (table with category column).

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlignJustify,
  ArrowLeft,
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
import { TaskProjectCard } from './components/TaskProjectCard'
import { TaskDetailPanel } from './TaskDetailPanel'
import { useTaskItemsData, type TaskItemRow } from './useTaskItemsData'
import type { TaskItemStatus, TaskItemPriority, TaskTemplateKind } from '../../src/types/task'

const CREAM_DEEP = '#EFE8DC'

type ViewMode = 'kanban' | 'box' | 'list'

const KIND_LABEL: Partial<Record<TaskTemplateKind, string>> = {
  oppgave: 'Generell',
  avvik: 'Avvik',
  nestenulykke: 'Nestenulykke',
  tiltak: 'Tiltak',
  risiko: 'Risiko',
  forslag: 'Forslag',
  sykefravær: 'Sykefravær',
}

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

type ActiveFilters = {
  status: TaskItemStatus | null
  priority: TaskItemPriority | null
  kind: TaskTemplateKind | null
  overdueOnly: boolean
}

const EMPTY_FILTERS: ActiveFilters = {
  status: null,
  priority: null,
  kind: null,
  overdueOnly: false,
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
const ALL_PRIORITIES: TaskItemPriority[] = ['critical', 'high', 'medium', 'low']
const ALL_KINDS: TaskTemplateKind[] = [
  'oppgave',
  'avvik',
  'nestenulykke',
  'tiltak',
  'risiko',
  'forslag',
  'sykefravær',
]

// ── Kanban view ──────────────────────────────────────────────────────────────

type KanbanColDef = {
  key: string
  label: string
  sublabel: string
  color: string
  statuses: TaskItemStatus[]
}

const KANBAN_COLS: KanbanColDef[] = [
  {
    key: 'backlog',
    label: 'Å gjøre',
    sublabel: 'Ikke startet',
    color: 'bg-neutral-50 border-neutral-200',
    statuses: ['open'],
  },
  {
    key: 'progress',
    label: 'Pågår',
    sublabel: 'Under behandling',
    color: 'bg-amber-50 border-amber-200',
    statuses: ['in_progress', 'root_cause_identified', 'action_defined'],
  },
  {
    key: 'review',
    label: 'Gjennomgang',
    sublabel: 'Implementering og verifikasjon',
    color: 'bg-violet-50 border-violet-200',
    statuses: ['action_implemented', 'effectiveness_pending', 'effectiveness_verified'],
  },
  {
    key: 'done',
    label: 'Ferdig',
    sublabel: 'Lukket',
    color: 'bg-green-50 border-green-200',
    statuses: ['closed', 'cancelled'],
  },
]

function KanbanView({
  items,
  onCardClick,
}: {
  items: TaskItemRow[]
  onCardClick: (item: TaskItemRow) => void
}) {
  return (
    <div className="flex min-h-[480px] gap-4 overflow-x-auto pb-4">
      {KANBAN_COLS.map((col) => {
        const colItems = items.filter((i) => col.statuses.includes(i.status))
        return (
          <div key={col.key} className="flex min-w-[260px] flex-1 flex-col">
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
                    <TaskProjectCard
                      key={item.id}
                      item={item}
                      onClick={() => onCardClick(item)}
                      onDragStart={() => {}}
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

// ── Box / card grid view ─────────────────────────────────────────────────────

function BoxView({
  items,
  onCardClick,
}: {
  items: TaskItemRow[]
  onCardClick: (item: TaskItemRow) => void
}) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-neutral-500">Ingen oppgaver å vise.</p>
      </div>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <TaskProjectCard
          key={item.id}
          item={item}
          onClick={() => onCardClick(item)}
          onDragStart={() => {}}
        />
      ))}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function TasksAllePage() {
  const allItems = useTaskItemsData(null)
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS)
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<TaskItemRow | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const set = <K extends keyof ActiveFilters>(k: K, v: ActiveFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const clear = () => {
    setFilters(EMPTY_FILTERS)
    setSearch('')
  }

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

          {/* Search field — above filter bar, mirrors Regelverk-dekning */}
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
                    <option key={s} value={s}>
                      {TASK_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                {filters.status && (
                  <button
                    type="button"
                    onClick={() => set('status', null)}
                    className="rounded-md border border-neutral-200 bg-white p-2 text-neutral-500 hover:bg-neutral-50"
                    aria-label="Fjern status-filter"
                  >
                    ×
                  </button>
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
                    <option key={p} value={p}>
                      {TASK_PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
                {filters.priority && (
                  <button
                    type="button"
                    onClick={() => set('priority', null)}
                    className="rounded-md border border-neutral-200 bg-white p-2 text-neutral-500 hover:bg-neutral-50"
                    aria-label="Fjern prioritet-filter"
                  >
                    ×
                  </button>
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
                    <option key={k} value={k}>
                      {KIND_LABEL[k] ?? k}
                    </option>
                  ))}
                </select>
                {filters.kind && (
                  <button
                    type="button"
                    onClick={() => set('kind', null)}
                    className="rounded-md border border-neutral-200 bg-white p-2 text-neutral-500 hover:bg-neutral-50"
                    aria-label="Fjern type-filter"
                  >
                    ×
                  </button>
                )}
              </div>
            </label>

            {/* Kun forfalt + view mode switcher */}
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
                <button
                  type="button"
                  onClick={() => setViewMode('kanban')}
                  title="Kanban-visning"
                  className={`rounded p-1.5 transition ${
                    viewMode === 'kanban'
                      ? 'bg-[#c2410c] text-white'
                      : 'border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('box')}
                  title="Kort-visning"
                  className={`rounded p-1.5 transition ${
                    viewMode === 'box'
                      ? 'bg-[#c2410c] text-white'
                      : 'border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  title="Liste-visning"
                  className={`rounded p-1.5 transition ${
                    viewMode === 'list'
                      ? 'bg-[#c2410c] text-white'
                      : 'border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  <AlignJustify className="h-4 w-4" />
                </button>
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

          {/* Kanban view */}
          {viewMode === 'kanban' && (
            <KanbanView items={filtered} onCardClick={setSelectedItem} />
          )}

          {/* Box / card grid view */}
          {viewMode === 'box' && (
            <BoxView items={filtered} onCardClick={setSelectedItem} />
          )}

          {/* List / table view */}
          {viewMode === 'list' && (
            <LayoutTable1PostingsShell
              wrap
              title="Alle oppgaver"
              description=""
              toolbar={null}
              footer={null}
            >
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                  <thead>
                    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kategori</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Prioritet</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Ansvarlig</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Frist</th>
                      <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
                    </tr>
                  </thead>
                  <tbody>
                    {allItems.loading && filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-sm text-neutral-500">
                          Laster…
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
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
                      filtered.map((row) => (
                        <tr
                          key={row.id}
                          className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                          onClick={() => setSelectedItem(row)}
                        >
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
                          <td className="max-w-[220px] truncate px-5 py-3 font-medium text-neutral-900">
                            {row.title}
                          </td>
                          <td className="px-5 py-3 text-xs text-neutral-500">
                            {row.templateKind
                              ? (KIND_LABEL[row.templateKind] ?? row.templateKind)
                              : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <TaskStatusBadge status={row.status} />
                          </td>
                          <td className="px-5 py-3">
                            <TaskPriorityBadge priority={row.priority} />
                          </td>
                          <td className="max-w-[140px] truncate px-5 py-3 text-neutral-600">
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
