// Tabellvisning — 03 filterable report table.
//
// Full table of task_items with columns: title, source_category,
// law_refs, pack, pdca_phase, status, priority, assignee, due_date,
// project. Clicking a row opens project detail if projectId is set,
// otherwise falls back to the legacy TaskDetailPanel.
import { useMemo, useState } from 'react'
import { ArrowUpDown, Download, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { TaskItem, TaskPack, TaskPdcaPhase, TaskSourceCategory } from '../../../src/types/task'
import { useTaskItems } from '../useTaskItems'
import { useTaskProjects } from '../useTaskProjects'
import { SlidePanel } from '../../../src/components/layout/SlidePanel'
import { TaskProjectDetailPanel } from '../TaskProjectDetailPanel'

const CATEGORY_LABELS: Record<TaskSourceCategory, string> = {
  avvik: 'Avvik',
  risikovurdering: 'Risikovurdering',
  tiltak: 'Tiltak',
  general: 'Generell',
}

const PDCA_LABELS: Record<TaskPdcaPhase, string> = {
  plan: 'Plan', do: 'Do', check: 'Check', act: 'Act',
}

const STATUS_LABELS: Record<TaskItem['status'], string> = {
  todo: 'Ikke startet',
  in_progress: 'Pågår',
  done: 'Fullført',
}

const PRIORITY_LABELS: Record<TaskItem['priority'], string> = {
  critical: 'Kritisk', high: 'Høy', medium: 'Medium', low: 'Lav',
}

const STATUS_COLORS: Record<TaskItem['status'], string> = {
  todo: 'bg-neutral-100 text-neutral-600',
  in_progress: 'bg-orange-100 text-orange-800',
  done: 'bg-green-100 text-green-800',
}

const PRIORITY_COLORS: Record<TaskItem['priority'], string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-neutral-100 text-neutral-600',
}

type SortKey = 'title' | 'sourceCategory' | 'status' | 'priority' | 'dueDate' | 'pdcaPhase'

export function TasksTableReportTab() {
  const [searchParams] = useSearchParams()
  const activePack = (searchParams.get('pack') as TaskPack | null) ?? undefined

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<TaskSourceCategory | ''>('')
  const [statusFilter, setStatusFilter] = useState<TaskItem['status'] | ''>('')
  const [sortKey, setSortKey] = useState<SortKey>('dueDate')
  const [sortAsc, setSortAsc] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const { items, loading } = useTaskItems({ pack: activePack })
  const { projects } = useTaskProjects(activePack)

  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  )

  const filtered = useMemo(() => {
    let rows = items
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.lawRefs.some((r) => r.toLowerCase().includes(q)) ||
          (t.assigneeName ?? '').toLowerCase().includes(q),
      )
    }
    if (categoryFilter) rows = rows.filter((t) => t.sourceCategory === categoryFilter)
    if (statusFilter) rows = rows.filter((t) => t.status === statusFilter)
    return rows.slice().sort((a, b) => {
      let av: string
      let bv: string
      switch (sortKey) {
        case 'title': av = a.title; bv = b.title; break
        case 'sourceCategory': av = a.sourceCategory; bv = b.sourceCategory; break
        case 'status': av = a.status; bv = b.status; break
        case 'priority': {
          const order = { critical: 0, high: 1, medium: 2, low: 3 }
          return sortAsc
            ? order[a.priority] - order[b.priority]
            : order[b.priority] - order[a.priority]
        }
        case 'dueDate': av = a.dueDate ?? '9999'; bv = b.dueDate ?? '9999'; break
        case 'pdcaPhase': av = a.pdcaPhase; bv = b.pdcaPhase; break
        default: av = ''; bv = ''
      }
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [items, search, categoryFilter, statusFilter, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p)
    else { setSortKey(key); setSortAsc(true) }
  }

  const exportCsv = () => {
    const header = ['Tittel', 'Kategori', 'Lovhenvisning', 'PDCA', 'Status', 'Prioritet', 'Ansvarlig', 'Frist', 'Prosjekt']
    const rows = filtered.map((t) => [
      `"${t.title.replace(/"/g, '""')}"`,
      CATEGORY_LABELS[t.sourceCategory],
      t.lawRefs.join('; '),
      PDCA_LABELS[t.pdcaPhase],
      STATUS_LABELS[t.status],
      PRIORITY_LABELS[t.priority],
      t.assigneeName ?? '',
      t.dueDate ?? '',
      t.projectId ? (projectById.get(t.projectId)?.title ?? t.projectId) : '',
    ])
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'oppgaver.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const selectedProject = selectedProjectId ? (projectById.get(selectedProjectId) ?? null) : null

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 text-left font-medium text-neutral-600 hover:text-neutral-900"
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortKey === k ? 'text-neutral-900' : 'text-neutral-300'}`} aria-hidden />
    </button>
  )

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            type="search"
            placeholder="Søk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 rounded border border-neutral-300 pl-8 pr-3 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as TaskSourceCategory | '')}
          className="h-8 rounded border border-neutral-300 px-2 text-sm focus:border-neutral-500 focus:outline-none"
        >
          <option value="">Alle kategorier</option>
          {(Object.keys(CATEGORY_LABELS) as TaskSourceCategory[]).map((k) => (
            <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskItem['status'] | '')}
          className="h-8 rounded border border-neutral-300 px-2 text-sm focus:border-neutral-500 focus:outline-none"
        >
          <option value="">Alle statuser</option>
          {(Object.keys(STATUS_LABELS) as TaskItem['status'][]).map((k) => (
            <option key={k} value={k}>{STATUS_LABELS[k]}</option>
          ))}
        </select>
        <span className="text-xs text-neutral-400">{filtered.length} treff</span>
        <button
          type="button"
          onClick={exportCsv}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Eksporter CSV
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded border border-neutral-200">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs"><SortBtn k="title" label="Tittel" /></th>
              <th className="px-3 py-2.5 text-left text-xs"><SortBtn k="sourceCategory" label="Kategori" /></th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-neutral-600">Lovhenvisning</th>
              <th className="px-3 py-2.5 text-left text-xs"><SortBtn k="pdcaPhase" label="PDCA" /></th>
              <th className="px-3 py-2.5 text-left text-xs"><SortBtn k="status" label="Status" /></th>
              <th className="px-3 py-2.5 text-left text-xs"><SortBtn k="priority" label="Prioritet" /></th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-neutral-600">Ansvarlig</th>
              <th className="px-3 py-2.5 text-left text-xs"><SortBtn k="dueDate" label="Frist" /></th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-neutral-600">Prosjekt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-3 py-2.5">
                      <div className="h-4 animate-pulse rounded bg-neutral-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-neutral-400">
                  Ingen oppgaver funnet
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const project = item.projectId ? projectById.get(item.projectId) : null
                const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'done'
                return (
                  <tr
                    key={item.id}
                    onClick={() => { if (item.projectId) setSelectedProjectId(item.projectId) }}
                    className={`transition-colors ${item.projectId ? 'cursor-pointer hover:bg-neutral-50' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-medium text-neutral-900 max-w-xs">
                      <span className="line-clamp-1">{item.title}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                        {CATEGORY_LABELS[item.sourceCategory]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {item.lawRefs.slice(0, 2).map((ref) => (
                          <span key={ref} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                            {ref}
                          </span>
                        ))}
                        {item.lawRefs.length > 2 && (
                          <span className="text-[10px] text-neutral-400">+{item.lawRefs.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-neutral-500">{PDCA_LABELS[item.pdcaPhase]}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[item.priority]}`}>
                        {PRIORITY_LABELS[item.priority]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-neutral-600 max-w-[120px]">
                      <span className="truncate block">{item.assigneeName ?? '—'}</span>
                    </td>
                    <td className={`px-3 py-2.5 text-xs ${isOverdue ? 'font-medium text-red-600' : 'text-neutral-600'}`}>
                      {item.dueDate ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-neutral-500 max-w-[140px]">
                      {project ? (
                        <span className="truncate block text-[#c2410c] underline underline-offset-2">
                          {project.title}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Project detail slide panel */}
      {selectedProject && (
        <SlidePanel
          open
          onClose={() => setSelectedProjectId(null)}
          title={selectedProject.title}
          width="lg"
        >
          <TaskProjectDetailPanel
            project={selectedProject}
            onClose={() => setSelectedProjectId(null)}
          />
        </SlidePanel>
      )}
    </div>
  )
}
