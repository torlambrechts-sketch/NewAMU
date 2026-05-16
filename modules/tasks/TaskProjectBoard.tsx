// TaskProjectBoard — PDCA or Kanban board for a task_project.
//
// PDCA methodology: 4 columns matching task_pdca_phase (plan/do/check/act).
//   Dragging a card updates pdca_phase on the item.
//
// Kanban methodology: 4 status buckets (open / in-progress group / review group / done).
//   Dragging a card updates status to the column's target status.
//
// Drag-and-drop uses the HTML5 drag API — no external DnD library.
// onDragLeave uses relatedTarget guard to avoid child-element false fires.

import { useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '../../src/components/ui/Button'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { TaskProjectCard } from './components/TaskProjectCard'
import type { TaskItemRow } from './useTaskItemsData'
import type { TaskPdcaPhase, TaskItemStatus, TaskProject } from '../../src/types/task'

type Props = {
  project: TaskProject
  items: TaskItemRow[]
  onCardClick: (item: TaskItemRow) => void
  onMoveCard: (itemId: string, newPhase: TaskPdcaPhase | null, newStatus: TaskItemStatus | null) => Promise<boolean>
  onQuickCreate: (colKey: string, title: string) => Promise<string | null>
}

// ── PDCA column definitions ──────────────────────────────────────────────────

type PdcaCol = { phase: TaskPdcaPhase; label: string; sublabel: string; color: string; dropColor: string }

const PDCA_COLS: PdcaCol[] = [
  { phase: 'plan',  label: 'Plan',  sublabel: 'Planlegging',  color: 'bg-blue-50 border-blue-200',     dropColor: 'ring-blue-400' },
  { phase: 'do',    label: 'Do',    sublabel: 'Gjennomføring', color: 'bg-amber-50 border-amber-200',   dropColor: 'ring-amber-400' },
  { phase: 'check', label: 'Check', sublabel: 'Kontroll',      color: 'bg-violet-50 border-violet-200', dropColor: 'ring-violet-400' },
  { phase: 'act',   label: 'Act',   sublabel: 'Forbedring',    color: 'bg-green-50 border-green-200',   dropColor: 'ring-green-400' },
]

// ── Kanban column definitions ────────────────────────────────────────────────

type KanbanCol = {
  key: string
  label: string
  sublabel: string
  color: string
  dropColor: string
  statuses: TaskItemStatus[]
  targetStatus: TaskItemStatus
  allowAdd: boolean
}

const KANBAN_COLS: KanbanCol[] = [
  {
    key: 'backlog', label: 'Å gjøre', sublabel: 'Ikke startet',
    color: 'bg-neutral-50 border-neutral-200', dropColor: 'ring-neutral-400',
    statuses: ['open'], targetStatus: 'open', allowAdd: true,
  },
  {
    key: 'progress', label: 'Pågår', sublabel: 'Under behandling',
    color: 'bg-amber-50 border-amber-200', dropColor: 'ring-amber-400',
    statuses: ['in_progress', 'root_cause_identified', 'action_defined'],
    targetStatus: 'in_progress', allowAdd: true,
  },
  {
    key: 'review', label: 'Gjennomgang', sublabel: 'Implementering og verifikasjon',
    color: 'bg-violet-50 border-violet-200', dropColor: 'ring-violet-400',
    statuses: ['action_implemented', 'effectiveness_pending', 'effectiveness_verified'],
    targetStatus: 'effectiveness_pending', allowAdd: true,
  },
  {
    key: 'done', label: 'Ferdig', sublabel: 'Lukket',
    color: 'bg-green-50 border-green-200', dropColor: 'ring-green-400',
    statuses: ['closed', 'cancelled'], targetStatus: 'closed', allowAdd: false,
  },
]

// ── Quick-add inline form ────────────────────────────────────────────────────

function QuickAddForm({
  onAdd,
  onCancel,
}: {
  onAdd: (title: string) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canAdd = !submitting && title.trim().length > 0

  const handleAdd = async () => {
    if (!canAdd) return
    setSubmitting(true)
    setError(null)
    try {
      await onAdd(title.trim())
      // parent closes the form on success
    } catch {
      setError('Kunne ikke opprette oppgave.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-[#c2410c]/30 bg-white p-2 shadow-sm">
      <StandardTextarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void handleAdd()
          }
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Tittel på oppgave… (Enter for å legge til)"
        rows={2}
        disabled={submitting}
        className="resize-none focus:border-[#c2410c] focus:ring-[#c2410c]/20 disabled:opacity-60"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-1.5 flex items-center gap-1.5">
        <Button
          size="sm"
          variant="primary"
          disabled={!canAdd}
          onClick={() => void handleAdd()}
          className="bg-[#c2410c] hover:bg-[#a33609]"
        >
          {submitting ? 'Legger til…' : 'Legg til'}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-6 w-6 text-neutral-400 hover:bg-transparent hover:text-neutral-600"
          aria-label="Avbryt"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── Column component (shared between PDCA and Kanban) ────────────────────────

function BoardColumn({
  colKey,
  label,
  sublabel,
  color,
  dropColor,
  items,
  allowAdd,
  isDragging,
  onCardClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  addingIn,
  setAddingIn,
  onQuickCreate,
}: {
  colKey: string
  label: string
  sublabel: string
  color: string
  dropColor: string
  items: TaskItemRow[]
  allowAdd: boolean
  isDragging: boolean
  onCardClick: (item: TaskItemRow) => void
  onDragStart: (id: string) => void
  onDragOver: (e: React.DragEvent, key: string) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, key: string) => void
  addingIn: string | null
  setAddingIn: (key: string | null) => void
  onQuickCreate: (colKey: string, title: string) => Promise<string | null>
}) {
  const isOver = isDragging && addingIn !== colKey

  return (
    <div
      className="flex min-w-[260px] flex-1 flex-col"
      onDragOver={(e) => onDragOver(e, colKey)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, colKey)}
    >
      {/* Column header */}
      <div className={`rounded-t-lg border border-b-0 px-3 py-2.5 ${color}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-sm font-semibold text-neutral-800">{label}</span>
            <span className="ml-2 text-xs text-neutral-500">{sublabel}</span>
          </div>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-neutral-600">
            {items.length}
          </span>
        </div>
      </div>

      {/* Column body */}
      <div
        className={`relative flex-1 rounded-b-lg border px-2 py-2 transition-all ${color} ${
          isOver ? `ring-2 ${dropColor}` : ''
        }`}
      >
        <div className="space-y-2">
          {items.map((item) => (
            <TaskProjectCard
              key={item.id}
              item={item}
              onClick={() => onCardClick(item)}
              onDragStart={onDragStart}
            />
          ))}
        </div>

        {/* Empty column drop hint */}
        {items.length === 0 && isDragging && (
          <div className="pointer-events-none flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-neutral-300/60 text-xs text-neutral-400">
            Slipp her
          </div>
        )}

        {allowAdd && (
          addingIn === colKey ? (
            <QuickAddForm
              onAdd={async (title) => {
                const id = await onQuickCreate(colKey, title)
                if (id) setAddingIn(null)
              }}
              onCancel={() => setAddingIn(null)}
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddingIn(colKey)}
              icon={<Plus className="h-3.5 w-3.5" />}
              className="mt-2 flex w-full justify-start rounded px-2 py-1.5 text-xs font-normal text-neutral-400 hover:bg-white/60 hover:text-neutral-600"
            >
              Ny oppgave
            </Button>
          )
        )}
      </div>
    </div>
  )
}

// ── PDCA Board ───────────────────────────────────────────────────────────────

function PdcaBoard({ items, onCardClick, onMoveCard, onQuickCreate }: Props) {
  const draggedId = useRef<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [addingIn, setAddingIn] = useState<string | null>(null)

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault()
    setOverCol(key)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setOverCol(null)
    }
  }

  const handleDrop = (e: React.DragEvent, key: string) => {
    e.preventDefault()
    setOverCol(null)
    if (draggedId.current) {
      void onMoveCard(draggedId.current, key as TaskPdcaPhase, null)
      draggedId.current = null
    }
  }

  return (
    <div className="flex min-h-[480px] gap-4 overflow-x-auto pb-4">
      {PDCA_COLS.map((col) => (
        <BoardColumn
          key={col.phase}
          colKey={col.phase}
          label={col.label}
          sublabel={col.sublabel}
          color={col.color}
          dropColor={col.dropColor}
          items={items.filter((i) => i.pdcaPhase === col.phase)}
          allowAdd
          isDragging={overCol === col.phase}
          onCardClick={onCardClick}
          onDragStart={(id) => { draggedId.current = id }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          addingIn={addingIn}
          setAddingIn={setAddingIn}
          onQuickCreate={onQuickCreate}
        />
      ))}
    </div>
  )
}

// ── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({ items, onCardClick, onMoveCard, onQuickCreate }: Props) {
  const draggedId = useRef<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [addingIn, setAddingIn] = useState<string | null>(null)

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault()
    setOverCol(key)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setOverCol(null)
    }
  }

  const handleDrop = (e: React.DragEvent, key: string) => {
    e.preventDefault()
    setOverCol(null)
    if (draggedId.current) {
      const col = KANBAN_COLS.find((c) => c.key === key)
      if (col) void onMoveCard(draggedId.current, null, col.targetStatus)
      draggedId.current = null
    }
  }

  return (
    <div className="flex min-h-[480px] gap-4 overflow-x-auto pb-4">
      {KANBAN_COLS.map((col) => (
        <BoardColumn
          key={col.key}
          colKey={col.key}
          label={col.label}
          sublabel={col.sublabel}
          color={col.color}
          dropColor={col.dropColor}
          items={items.filter((i) => col.statuses.includes(i.status))}
          allowAdd={col.allowAdd}
          isDragging={overCol === col.key}
          onCardClick={onCardClick}
          onDragStart={(id) => { draggedId.current = id }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          addingIn={addingIn}
          setAddingIn={setAddingIn}
          onQuickCreate={onQuickCreate}
        />
      ))}
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
