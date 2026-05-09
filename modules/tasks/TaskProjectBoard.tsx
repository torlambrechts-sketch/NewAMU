// TaskProjectBoard — PDCA or Kanban board for a task_project.
//
// PDCA methodology: 4 columns matching task_pdca_phase (plan/do/check/act).
//   Dragging a card updates pdca_phase on the item.
//
// Kanban methodology: 4 status buckets (open / in-progress group / review group / done).
//   Dragging a card updates status to the column's target status.
//
// Drag-and-drop uses the HTML5 drag API — no external DnD library.

import { useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { TaskProjectCard } from './components/TaskProjectCard'
import type { TaskItemRow } from './useTaskItemsData'
import type { TaskPdcaPhase, TaskItemStatus, TaskProject } from '../../src/types/task'

type Props = {
  project: TaskProject
  items: TaskItemRow[]
  onCardClick: (item: TaskItemRow) => void
  onMoveCard: (itemId: string, newPhase: TaskPdcaPhase | null, newStatus: TaskItemStatus | null) => void
  onQuickCreate: (colKey: string, title: string) => void
}

// ── PDCA column definitions ──────────────────────────────────────────────────

type PdcaCol = { phase: TaskPdcaPhase; label: string; sublabel: string; color: string }

const PDCA_COLS: PdcaCol[] = [
  { phase: 'plan', label: 'Plan', sublabel: 'Planlegging', color: 'bg-blue-50 border-blue-200' },
  { phase: 'do', label: 'Do', sublabel: 'Gjennomføring', color: 'bg-amber-50 border-amber-200' },
  { phase: 'check', label: 'Check', sublabel: 'Kontroll', color: 'bg-violet-50 border-violet-200' },
  { phase: 'act', label: 'Act', sublabel: 'Forbedring', color: 'bg-green-50 border-green-200' },
]

// ── Kanban column definitions ────────────────────────────────────────────────

type KanbanCol = {
  key: string
  label: string
  sublabel: string
  color: string
  statuses: TaskItemStatus[]
  targetStatus: TaskItemStatus
}

const KANBAN_COLS: KanbanCol[] = [
  {
    key: 'backlog',
    label: 'Å gjøre',
    sublabel: 'Ikke startet',
    color: 'bg-neutral-50 border-neutral-200',
    statuses: ['open'],
    targetStatus: 'open',
  },
  {
    key: 'progress',
    label: 'Pågår',
    sublabel: 'Under behandling',
    color: 'bg-amber-50 border-amber-200',
    statuses: ['in_progress', 'root_cause_identified', 'action_defined'],
    targetStatus: 'in_progress',
  },
  {
    key: 'review',
    label: 'Gjennomgang',
    sublabel: 'Implementering og verifikasjon',
    color: 'bg-violet-50 border-violet-200',
    statuses: ['action_implemented', 'effectiveness_pending', 'effectiveness_verified'],
    targetStatus: 'effectiveness_pending',
  },
  {
    key: 'done',
    label: 'Ferdig',
    sublabel: 'Lukket',
    color: 'bg-green-50 border-green-200',
    statuses: ['closed', 'cancelled'],
    targetStatus: 'closed',
  },
]

// ── Quick-add inline form ────────────────────────────────────────────────────

function QuickAddForm({
  onAdd,
  onCancel,
}: {
  onAdd: (title: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const canAdd = title.trim().length > 0

  return (
    <div className="mt-2 rounded-lg border border-[#c2410c]/30 bg-white p-2 shadow-sm">
      <textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (canAdd) onAdd(title.trim())
          }
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Tittel på oppgave… (Enter for å legge til)"
        rows={2}
        className="w-full resize-none rounded border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#c2410c] focus:outline-none focus:ring-1 focus:ring-[#c2410c]/20"
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => onAdd(title.trim())}
          className="rounded bg-[#c2410c] px-3 py-1 text-xs font-medium text-white transition hover:bg-[#a33609] disabled:opacity-40"
        >
          Legg til
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1 text-neutral-400 transition hover:text-neutral-600"
          aria-label="Avbryt"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── PDCA Board ───────────────────────────────────────────────────────────────

function PdcaBoard({ project, items, onCardClick, onMoveCard, onQuickCreate }: Props) {
  const draggedId = useRef<string | null>(null)
  const [overCol, setOverCol] = useState<TaskPdcaPhase | null>(null)
  const [addingIn, setAddingIn] = useState<TaskPdcaPhase | null>(null)

  return (
    <div className="flex min-h-[480px] gap-4 overflow-x-auto pb-4">
      {PDCA_COLS.map((col) => {
        const colItems = items.filter((i) => i.pdcaPhase === col.phase)
        const isOver = overCol === col.phase

        return (
          <div
            key={col.phase}
            className="flex min-w-[260px] flex-1 flex-col"
            onDragOver={(e) => {
              e.preventDefault()
              setOverCol(col.phase)
            }}
            onDragLeave={() => setOverCol(null)}
            onDrop={(e) => {
              e.preventDefault()
              setOverCol(null)
              if (draggedId.current) {
                onMoveCard(draggedId.current, col.phase, null)
                draggedId.current = null
              }
            }}
          >
            {/* Column header */}
            <div
              className={`rounded-t-lg border border-b-0 px-3 py-2.5 ${col.color}`}
            >
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

            {/* Column body */}
            <div
              className={`flex-1 rounded-b-lg border px-2 py-2 transition-colors ${col.color} ${
                isOver ? 'ring-2 ring-[#c2410c]/40' : ''
              }`}
            >
              <div className="space-y-2">
                {colItems.map((item) => (
                  <TaskProjectCard
                    key={item.id}
                    item={item}
                    onClick={() => onCardClick(item)}
                    onDragStart={(id) => {
                      draggedId.current = id
                    }}
                  />
                ))}
              </div>

              {addingIn === col.phase ? (
                <QuickAddForm
                  onAdd={(title) => {
                    onQuickCreate(col.phase, title)
                    setAddingIn(null)
                  }}
                  onCancel={() => setAddingIn(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingIn(col.phase)}
                  className="mt-2 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-neutral-400 transition hover:bg-white/60 hover:text-neutral-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ny oppgave
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({ items, onCardClick, onMoveCard, onQuickCreate }: Props) {
  const draggedId = useRef<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [addingIn, setAddingIn] = useState<string | null>(null)

  return (
    <div className="flex min-h-[480px] gap-4 overflow-x-auto pb-4">
      {KANBAN_COLS.map((col) => {
        const colItems = items.filter((i) => col.statuses.includes(i.status))
        const isOver = overCol === col.key

        return (
          <div
            key={col.key}
            className="flex min-w-[260px] flex-1 flex-col"
            onDragOver={(e) => {
              e.preventDefault()
              setOverCol(col.key)
            }}
            onDragLeave={() => setOverCol(null)}
            onDrop={(e) => {
              e.preventDefault()
              setOverCol(null)
              if (draggedId.current) {
                onMoveCard(draggedId.current, null, col.targetStatus)
                draggedId.current = null
              }
            }}
          >
            {/* Column header */}
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

            {/* Column body */}
            <div
              className={`flex-1 rounded-b-lg border px-2 py-2 transition-colors ${col.color} ${
                isOver ? 'ring-2 ring-[#c2410c]/40' : ''
              }`}
            >
              <div className="space-y-2">
                {colItems.map((item) => (
                  <TaskProjectCard
                    key={item.id}
                    item={item}
                    onClick={() => onCardClick(item)}
                    onDragStart={(id) => {
                      draggedId.current = id
                    }}
                  />
                ))}
              </div>

              {col.key !== 'done' && (
                addingIn === col.key ? (
                  <QuickAddForm
                    onAdd={(title) => {
                      onQuickCreate(col.key, title)
                      setAddingIn(null)
                    }}
                    onCancel={() => setAddingIn(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingIn(col.key)}
                    className="mt-2 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-neutral-400 transition hover:bg-white/60 hover:text-neutral-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ny oppgave
                  </button>
                )
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export function TaskProjectBoard(props: Props) {
  if (props.project.methodology === 'kanban') {
    return <KanbanBoard {...props} />
  }
  return <PdcaBoard {...props} />
}
