// TasksAllePage — cross-template task list.
// Shows every task_item for the org with filter chips for status, priority,
// template kind, and overdue state. Click row → TaskDetailPanel.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Filter, X } from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { Badge } from '../../src/components/ui/Badge'
import { TaskStatusBadge, TASK_STATUS_LABEL } from './components/TaskStatusBadge'
import { TaskPriorityBadge, TASK_PRIORITY_LABEL } from './components/TaskPriorityBadge'
import { TaskKindIcon } from './components/TaskKindIcon'
import { TaskDetailPanel } from './TaskDetailPanel'
import { useTaskItemsData, type TaskItemRow } from './useTaskItemsData'
import type { TaskItemStatus, TaskItemPriority, TaskTemplateKind } from '../../src/types/task'

const KIND_LABEL: Partial<Record<TaskTemplateKind, string>> = {
  oppgave: 'Generell',
  avvik: 'Avvik',
  nestenulykke: 'Nestenulykke',
  tiltak: 'Tiltak',
  risiko: 'Risiko',
  forslag: 'Forslag',
  'sykefravær': 'Sykefravær',
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('nb-NO', { dateStyle: 'short' })
  } catch { return s }
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
  status: null, priority: null, kind: null, overdueOnly: false,
}

const ALL_STATUSES: TaskItemStatus[] = [
  'open', 'in_progress', 'root_cause_identified', 'action_defined',
  'action_implemented', 'effectiveness_pending', 'effectiveness_verified',
  'closed', 'cancelled',
]
const ALL_PRIORITIES: TaskItemPriority[] = ['critical', 'high', 'medium', 'low']
const ALL_KINDS: TaskTemplateKind[] = ['oppgave', 'avvik', 'nestenulykke', 'tiltak', 'risiko', 'forslag', 'sykefravær']

export function TasksAllePage() {
  const allItems = useTaskItemsData(null)
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS)
  const [selectedItem, setSelectedItem] = useState<TaskItemRow | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)

  const set = <K extends keyof ActiveFilters>(k: K, v: ActiveFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }))

  const clear = () => setFilters(EMPTY_FILTERS)

  const activeCount = Object.values(filters).filter(Boolean).length

  const filtered = useMemo(() => {
    return allItems.items.filter((item) => {
      if (filters.status && item.status !== filters.status) return false
      if (filters.priority && item.priority !== filters.priority) return false
      if (filters.kind && item.templateKind !== filters.kind) return false
      if (filters.overdueOnly && !isOverdue(item.dueDate, item.status)) return false
      return true
    })
  }, [allItems.items, filters])

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 border px-3 py-2 text-sm font-medium transition-colors ${
                filterOpen || activeCount > 0
                  ? 'border-[#c2410c]/30 bg-orange-50 text-[#c2410c]'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filter
              {activeCount > 0 && (
                <Badge variant="high" className="text-[10px]">{activeCount}</Badge>
              )}
            </button>
            <Link
              to="/tasks/management"
              className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Tilbake</span>
            </Link>
          </div>
        }
      >
        <div className="space-y-4">
          {allItems.error && <WarningBox>{allItems.error}</WarningBox>}

          {/* Filter bar */}
          {filterOpen && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Status
                  </p>
                  <select
                    value={filters.status ?? ''}
                    onChange={(e) => set('status', (e.target.value as TaskItemStatus) || null)}
                    className="w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[#c2410c] focus:outline-none"
                  >
                    <option value="">Alle statuser</option>
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Prioritet
                  </p>
                  <select
                    value={filters.priority ?? ''}
                    onChange={(e) => set('priority', (e.target.value as TaskItemPriority) || null)}
                    className="w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[#c2410c] focus:outline-none"
                  >
                    <option value="">Alle prioriteter</option>
                    {ALL_PRIORITIES.map((p) => (
                      <option key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Maltype
                  </p>
                  <select
                    value={filters.kind ?? ''}
                    onChange={(e) => set('kind', (e.target.value as TaskTemplateKind) || null)}
                    className="w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[#c2410c] focus:outline-none"
                  >
                    <option value="">Alle typer</option>
                    {ALL_KINDS.map((k) => (
                      <option key={k} value={k}>{KIND_LABEL[k] ?? k}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex cursor-pointer items-center gap-2.5 rounded border border-neutral-200 bg-white px-3 py-2 transition hover:bg-neutral-50">
                    <input
                      type="checkbox"
                      checked={filters.overdueOnly}
                      onChange={(e) => set('overdueOnly', e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300 text-[#c2410c] focus:ring-[#c2410c]/20"
                    />
                    <span className="text-sm text-neutral-700">Kun forfalt</span>
                  </label>
                </div>
              </div>

              {activeCount > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={clear}
                    className="flex items-center gap-1 text-xs text-neutral-500 transition hover:text-neutral-800"
                  >
                    <X className="h-3.5 w-3.5" />
                    Nullstill filter
                  </button>
                </div>
              )}
            </div>
          )}

          <LayoutTable1PostingsShell
            wrap
            title="Alle oppgaver"
            description=""
            toolbar={null}
            footer={
              <span className="text-neutral-500">
                {allItems.loading
                  ? 'Laster…'
                  : `${filtered.length} av ${allItems.items.length} oppgaver`}
              </span>
            }
          >
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Prioritet</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Ansvarlig</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Frist</th>
                    <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
                  </tr>
                </thead>
                <tbody>
                  {allItems.loading && filtered.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-sm text-neutral-500">Laster…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
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
                        <td className="px-5 py-3 font-medium text-neutral-900 max-w-[280px] truncate">
                          {row.title}
                        </td>
                        <td className="px-5 py-3">
                          <TaskStatusBadge status={row.status} />
                        </td>
                        <td className="px-5 py-3">
                          <TaskPriorityBadge priority={row.priority} />
                        </td>
                        <td className="px-5 py-3 text-neutral-600 truncate max-w-[140px]">
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
