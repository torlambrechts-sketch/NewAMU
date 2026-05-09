// Unified task list view — replaces the separate Liste / PDCA-tavle / Tavle /
// Tabellvisning tabs with a single surface that lets users switch display mode
// via a view-picker toolbar. Selected view is persisted in the URL via ?view=.
import { useSearchParams } from 'react-router-dom'
import { List, KanbanSquare, LayoutGrid, Table2 } from 'lucide-react'
import type { Task, TaskStatus } from '../../../src/types/task'
import type { UseTaskExtensions } from '../useTaskExtensions'
import { TasksListTab } from './TasksListTab'
import { TasksKanbanTab } from './TasksKanbanTab'
import { TasksPDCABoardTab } from './TasksPDCABoardTab'
import { TasksTableReportTab } from './TasksTableReportTab'

type ListViewMode = 'liste' | 'kanban' | 'pdca' | 'rapport'

const VIEWS: { id: ListViewMode; label: string; Icon: React.ElementType }[] = [
  { id: 'liste',   label: 'Liste',        Icon: List },
  { id: 'kanban',  label: 'Tavle',        Icon: KanbanSquare },
  { id: 'pdca',    label: 'PDCA',         Icon: LayoutGrid },
  { id: 'rapport', label: 'Tabellvisning', Icon: Table2 },
]

type Props = {
  tasks: Task[]
  ext: UseTaskExtensions
  onOpenTask: (taskId: string) => void
  onSetStatus: (taskId: string, status: TaskStatus) => void
}

export function TasksListView({ tasks, ext, onOpenTask, onSetStatus }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const viewParam = searchParams.get('view') as ListViewMode | null
  const activeView: ListViewMode = VIEWS.some((v) => v.id === viewParam) ? viewParam! : 'liste'

  function switchView(next: ListViewMode) {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'liste') {
          p.delete('view')
        } else {
          p.set('view', next)
        }
        return p
      },
      { replace: true },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── View switcher ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 self-end rounded-lg border border-neutral-200 bg-white p-1 shadow-sm">
        {VIEWS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchView(id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeView === id
                ? 'bg-[#1a3d32] text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Active view ────────────────────────────────────────────────────── */}
      {activeView === 'liste' && (
        <TasksListTab tasks={tasks} ext={ext} onOpenTask={onOpenTask} />
      )}
      {activeView === 'kanban' && (
        <TasksKanbanTab
          tasks={tasks}
          ext={ext}
          onSetStatus={(id, status) => onSetStatus(id, status)}
          onOpenTask={onOpenTask}
        />
      )}
      {activeView === 'pdca' && <TasksPDCABoardTab />}
      {activeView === 'rapport' && <TasksTableReportTab />}
    </div>
  )
}
