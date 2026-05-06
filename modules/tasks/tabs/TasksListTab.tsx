import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module'
import {
  MODULE_TABLE_TD,
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
} from '../../../src/components/module/moduleTableKit'
import { Badge } from '../../../src/components/ui/Badge'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardInput } from '../../../src/components/ui/Input'
import type { Task, TaskStatus } from '../../../src/types/task'
import { MODULE_LABELS } from '../../../src/lib/taskNavigation'
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  formatDueDate,
  isOverdue,
  PRIORITY_RANK,
  priorityBadgeVariant,
  statusBadgeVariant,
} from '../taskUiHelpers'
import type { TaskPriority } from '../types'
import { TASK_PRIORITY_OPTIONS } from '../types'
import type { UseTaskExtensions } from '../useTaskExtensions'

type SortKey = 'due' | 'title' | 'status' | 'priority' | 'module'

type Props = {
  tasks: Task[]
  ext: UseTaskExtensions
  onOpenTask: (taskId: string) => void
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Alle statuser' },
  ...TASK_STATUS_ORDER.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] })),
]

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'Alle prioriteter' },
  ...TASK_PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label })),
]

/**
 * Tabular list with search, sort, and status / priority filters. Reuses the
 * same MODULE_TABLE_* tokens as the survey/registry tables for visual parity.
 */
export function TasksListTab({ tasks, ext, onOpenTask }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('due')
  const [sortAsc, setSortAsc] = useState(true)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = tasks.filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false
      if (priorityFilter !== 'all') {
        const p = ext.taskExtensionMap.get(task.id)?.priority ?? 'medium'
        if (p !== priorityFilter) return false
      }
      if (!q) return true
      const hay = `${task.title} ${task.description} ${task.assignee} ${task.ownerRole}`.toLowerCase()
      return hay.includes(q)
    })

    const sorted = [...filtered].sort((a, b) => {
      const cmp = compareForKey(a, b, sortKey, ext)
      return sortAsc ? cmp : -cmp
    })
    return sorted
  }, [tasks, ext, search, statusFilter, priorityFilter, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const SortIcon = sortAsc ? ArrowUp : ArrowDown

  return (
    <ModuleSectionCard className="overflow-visible p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-sm font-semibold text-neutral-800">Listevisning</h3>
        <div className="flex flex-wrap items-center gap-2">
          <StandardInput
            type="search"
            placeholder="Søk i tittel, beskrivelse eller ansvarlig…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-72"
          />
          <div className="w-full md:w-44">
            <SearchableSelect
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(v) => setStatusFilter(v as TaskStatus | 'all')}
            />
          </div>
          <div className="w-full md:w-44">
            <SearchableSelect
              value={priorityFilter}
              options={PRIORITY_OPTIONS}
              onChange={(v) => setPriorityFilter(v as TaskPriority | 'all')}
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <SortableTh active={sortKey === 'title'} ascending={sortAsc} onClick={() => toggleSort('title')} icon={SortIcon}>
                Tittel
              </SortableTh>
              <SortableTh active={sortKey === 'priority'} ascending={sortAsc} onClick={() => toggleSort('priority')} icon={SortIcon}>
                Prioritet
              </SortableTh>
              <SortableTh active={sortKey === 'status'} ascending={sortAsc} onClick={() => toggleSort('status')} icon={SortIcon}>
                Status
              </SortableTh>
              <th className={MODULE_TABLE_TH}>Ansvarlig</th>
              <SortableTh active={sortKey === 'due'} ascending={sortAsc} onClick={() => toggleSort('due')} icon={SortIcon}>
                Frist
              </SortableTh>
              <SortableTh active={sortKey === 'module'} ascending={sortAsc} onClick={() => toggleSort('module')} icon={SortIcon}>
                Kilde
              </SortableTh>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="border-t border-neutral-100 px-3 py-10 text-center text-sm text-neutral-500">
                  Ingen oppgaver matcher filteret.
                </td>
              </tr>
            ) : (
              rows.map((task) => {
                const tExt = ext.taskExtensionMap.get(task.id)
                const overdue = isOverdue(task)
                return (
                  <tr key={task.id} className={MODULE_TABLE_TR_BODY}>
                    <td className={MODULE_TABLE_TD}>
                      <button
                        type="button"
                        onClick={() => onOpenTask(task.id)}
                        className="text-left font-medium text-neutral-900 hover:text-[#1a3d32] hover:underline"
                      >
                        {task.title}
                      </button>
                      {task.sourceLabel ? (
                        <p className="mt-0.5 text-xs text-neutral-500">{task.sourceLabel}</p>
                      ) : null}
                    </td>
                    <td className={MODULE_TABLE_TD}>
                      {tExt ? (
                        <Badge variant={priorityBadgeVariant(tExt.priority)}>
                          {TASK_PRIORITY_LABELS[tExt.priority]}
                        </Badge>
                      ) : null}
                    </td>
                    <td className={MODULE_TABLE_TD}>
                      <Badge variant={statusBadgeVariant(task.status)}>
                        {TASK_STATUS_LABELS[task.status]}
                      </Badge>
                    </td>
                    <td className={MODULE_TABLE_TD}>{task.assignee}</td>
                    <td className={MODULE_TABLE_TD}>
                      <span className={overdue ? 'font-semibold text-red-600' : ''}>
                        {formatDueDate(task.dueDate)}
                      </span>
                    </td>
                    <td className={MODULE_TABLE_TD}>{MODULE_LABELS[task.module]}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </ModuleSectionCard>
  )
}

function compareForKey(a: Task, b: Task, key: SortKey, ext: UseTaskExtensions): number {
  switch (key) {
    case 'title':
      return a.title.localeCompare(b.title, 'nb-NO', { sensitivity: 'base' })
    case 'status': {
      const orderA = TASK_STATUS_ORDER.indexOf(a.status)
      const orderB = TASK_STATUS_ORDER.indexOf(b.status)
      return orderA - orderB
    }
    case 'priority': {
      const pa = ext.taskExtensionMap.get(a.id)?.priority ?? 'medium'
      const pb = ext.taskExtensionMap.get(b.id)?.priority ?? 'medium'
      return PRIORITY_RANK[pa] - PRIORITY_RANK[pb]
    }
    case 'module':
      return MODULE_LABELS[a.module].localeCompare(MODULE_LABELS[b.module], 'nb-NO')
    case 'due':
    default: {
      const ta = new Date(a.dueDate).getTime()
      const tb = new Date(b.dueDate).getTime()
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
      if (Number.isNaN(ta)) return 1
      if (Number.isNaN(tb)) return -1
      return ta - tb
    }
  }
}

function SortableTh({
  active,
  ascending,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  ascending: boolean
  onClick: () => void
  icon: typeof ArrowUp
  children: React.ReactNode
}) {
  return (
    <th className={MODULE_TABLE_TH}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-700 hover:text-neutral-900"
      >
        {children}
        {active ? <Icon className="h-3 w-3" aria-hidden /> : null}
        <span className="sr-only">{active ? (ascending ? 'stigende' : 'synkende') : 'sorter'}</span>
      </button>
    </th>
  )
}
