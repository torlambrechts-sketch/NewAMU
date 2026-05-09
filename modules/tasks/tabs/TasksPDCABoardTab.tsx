// PDCA-tavle — 01 workspace view.
//
// 4-column Kanban (Plan / Do / Check / Act) where each column maps to
// a task_pdca_phase value. Cards show source_category chip, law_refs
// tags, priority badge, assignee and due date. Pack switcher (?pack=)
// narrows visible cards. Drag-and-drop reorders pdca_phase via
// updateItem. Column "+ Ny" pre-fills the correct source_category.
import { useState } from 'react'
import { ClipboardList, Plus, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { TaskItem, TaskPack, TaskPdcaPhase, TaskSourceCategory } from '../../../src/types/task'
import { useTaskItems } from '../useTaskItems'
import { NewTaskModal } from '../components/NewTaskModal'

type ColumnDef = {
  phase: TaskPdcaPhase
  label: string
  description: string
  lawRefs: string[]
  defaultCategory: TaskSourceCategory
  accent: string
}

const COLUMNS: ColumnDef[] = [
  {
    phase: 'plan',
    label: 'Plan',
    description: 'Kartlegg og vurder risiko',
    lawRefs: ['AML § 3-1', 'IK-f § 5 nr. 6'],
    defaultCategory: 'risikovurdering',
    accent: '#0f766e',
  },
  {
    phase: 'do',
    label: 'Do',
    description: 'Gjennomfør tiltak',
    lawRefs: ['AML § 3-2', 'AML § 4-1'],
    defaultCategory: 'tiltak',
    accent: '#0369a1',
  },
  {
    phase: 'check',
    label: 'Check',
    description: 'Kontroller og følg opp avvik',
    lawRefs: ['AML § 5-1', 'AML § 5-2'],
    defaultCategory: 'avvik',
    accent: '#b45309',
  },
  {
    phase: 'act',
    label: 'Act',
    description: 'Standardiser og luk syklusen',
    lawRefs: ['AML § 4-2', 'AML § 4-3'],
    defaultCategory: 'tiltak',
    accent: '#7c3aed',
  },
]

const CATEGORY_LABELS: Record<TaskSourceCategory, string> = {
  avvik: 'Avvik',
  risikovurdering: 'Risiko',
  tiltak: 'Tiltak',
  general: 'Generell',
}

const PRIORITY_COLORS: Record<TaskItem['priority'], string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-neutral-100 text-neutral-600',
}

const PRIORITY_LABELS: Record<TaskItem['priority'], string> = {
  critical: 'Kritisk',
  high: 'Høy',
  medium: 'Medium',
  low: 'Lav',
}

function TaskCard({
  item,
  onDragStart,
}: {
  item: TaskItem
  onDragStart: (id: string) => void
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(item.id)}
      className="group cursor-grab rounded border border-neutral-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      {/* Source category chip + priority */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
          {CATEGORY_LABELS[item.sourceCategory]}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[item.priority]}`}>
          {PRIORITY_LABELS[item.priority]}
        </span>
      </div>

      {/* Title */}
      <p className="mb-2 text-sm font-medium leading-snug text-neutral-900 line-clamp-2">
        {item.title}
      </p>

      {/* Law refs */}
      {item.lawRefs.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {item.lawRefs.slice(0, 2).map((ref) => (
            <span
              key={ref}
              className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
            >
              {ref}
            </span>
          ))}
          {item.lawRefs.length > 2 && (
            <span className="rounded bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-500">
              +{item.lawRefs.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Footer: assignee + due date */}
      <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
        {item.assigneeName ? (
          <span className="truncate">{item.assigneeName}</span>
        ) : (
          <span className="italic">Ikke tildelt</span>
        )}
        {item.dueDate && (
          <span className={new Date(item.dueDate) < new Date() && item.status !== 'done' ? 'font-medium text-red-600' : ''}>
            {item.dueDate}
          </span>
        )}
      </div>

      {/* Status indicator */}
      {item.status === 'done' && (
        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Fullført
        </div>
      )}
    </div>
  )
}

export function TasksPDCABoardTab() {
  const [searchParams] = useSearchParams()
  const activePack = (searchParams.get('pack') as TaskPack | null) ?? 'aml-amu'
  const [search, setSearch] = useState('')
  const [newTaskPhase, setNewTaskPhase] = useState<TaskPdcaPhase | null>(null)
  const [newTaskCategory, setNewTaskCategory] = useState<TaskSourceCategory>('general')
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const { byPhase, loading, updateItem } = useTaskItems({ pack: activePack })

  const filterItems = (items: TaskItem[]) =>
    search
      ? items.filter(
          (t) =>
            t.title.toLowerCase().includes(search.toLowerCase()) ||
            t.lawRefs.some((r) => r.toLowerCase().includes(search.toLowerCase())),
        )
      : items

  const handleDrop = async (phase: TaskPdcaPhase) => {
    if (!draggedId) return
    await updateItem(draggedId, { pdcaPhase: phase })
    setDraggedId(null)
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            type="search"
            placeholder="Søk oppgaver, paragraf..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded border border-neutral-300 pl-8 pr-3 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => { setNewTaskPhase('check'); setNewTaskCategory('avvik') }}
          className="inline-flex h-8 items-center gap-1.5 rounded bg-[#c2410c] px-3 text-sm font-medium text-white hover:bg-orange-700"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Ny oppgave
        </button>
      </div>

      {/* Board columns */}
      <div className="grid flex-1 grid-cols-4 gap-4 overflow-hidden">
        {COLUMNS.map((col) => {
          const items = filterItems(byPhase[col.phase] ?? [])
          return (
            <div
              key={col.phase}
              className="flex flex-col gap-3 rounded border border-neutral-200 bg-neutral-50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void handleDrop(col.phase)}
            >
              {/* Column header */}
              <div className="border-b border-neutral-200 px-3 pt-3 pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-900">{col.label}</span>
                  <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600">
                    {items.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">{col.description}</p>
                {/* Law ref badges */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {col.lawRefs.map((ref) => (
                    <span
                      key={ref}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: col.accent }}
                    >
                      {ref}
                    </span>
                  ))}
                </div>
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
                {loading ? (
                  <div className="flex flex-col gap-2">
                    {[1, 2].map((n) => (
                      <div key={n} className="h-20 animate-pulse rounded bg-neutral-200" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-neutral-400">
                    <ClipboardList className="h-6 w-6" aria-hidden />
                    <span>Ingen oppgaver</span>
                  </div>
                ) : (
                  items.map((item) => (
                    <TaskCard
                      key={item.id}
                      item={item}
                      onDragStart={(id) => setDraggedId(id)}
                    />
                  ))
                )}

                {/* Add button per column */}
                <button
                  type="button"
                  onClick={() => { setNewTaskPhase(col.phase); setNewTaskCategory(col.defaultCategory) }}
                  className="mt-1 flex items-center gap-1.5 rounded border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-white hover:text-neutral-700"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Ny {CATEGORY_LABELS[col.defaultCategory].toLowerCase()}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* New task modal */}
      {newTaskPhase !== null && (
        <NewTaskModal
          defaultPdcaPhase={newTaskPhase}
          defaultSourceCategory={newTaskCategory}
          defaultPack={activePack}
          onClose={() => setNewTaskPhase(null)}
        />
      )}
    </div>
  )
}
