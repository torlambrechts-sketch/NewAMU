/**
 * Global Action Board — Kanban across modules; task cards are drag-and-drop between columns.
 * Layout chrome follows layout-reference Scorecard (cream, serif titles, filter strip, scorecard cards).
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Download, History, LayoutGrid, Plus, Search, ShieldAlert, Users } from 'lucide-react'
import { useCouncil } from '../../hooks/useCouncil'
import { useHse } from '../../hooks/useHse'
import { useInternalControl } from '../../hooks/useInternalControl'
import { useTasks } from '../../hooks/useTasks'
import { useCostSettings } from '../../hooks/useCostSettings'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { Task, TaskStatus } from '../../types/task'
import {
  AB_SCORECARD_CREAM_DEEP,
  AB_SCORECARD_FOREST,
  ACTION_BOARD_SOURCE_LABELS,
  ActionBoardPill,
  ActionBoardSerifHeading,
  ActionBoardTaskScorecardCard,
  type ActionBoardScorecardItem,
  type ActionBoardSource,
} from './actionBoardScorecardLayout'
import { HubMenu1Bar, type HubMenu1Item } from '../../components/layout/HubMenu1Bar'
import { WorkplacePageHeading1 } from '../../components/layout/WorkplacePageHeading1'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const DRAG_TYPE = 'application/x-atics-task-id'

const SOURCE_COLOUR: Record<ActionBoardSource, string> = {
  task: 'bg-neutral-200/90 text-neutral-800',
  sick_leave_milestone: 'bg-orange-100 text-orange-900',
  training_expiry: 'bg-rose-100 text-rose-900',
  incident: 'bg-red-100 text-red-900',
  ros_risk: 'bg-amber-100 text-amber-900',
  inspection: 'bg-sky-100 text-sky-900',
  sja: 'bg-purple-100 text-purple-900',
  amu_compliance: 'bg-[#1a3d32]/15 text-[#1a3d32]',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Å gjøre',
  in_progress: 'Pågår',
  done: 'Fullført',
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: 'border-neutral-200/90 bg-neutral-50/90',
  in_progress: 'border-sky-200/90 bg-sky-50/60',
  done: 'border-emerald-200/90 bg-emerald-50/60',
}

type BoardTab = 'board' | 'costs'

type ColumnFocus = 'all' | TaskStatus

type BoardSortOrder = 'status_board' | 'due_soon' | 'title_az'

function normalizeSearch(s: string) {
  return s.trim().toLowerCase()
}

function compareDueSoon(a: ActionBoardScorecardItem, b: ActionBoardScorecardItem): number {
  if (!a.dueDate && !b.dueDate) return 0
  if (!a.dueDate) return 1
  if (!b.dueDate) return -1
  return a.dueDate.localeCompare(b.dueDate)
}

export function ActionBoardPage() {
  const { supabaseConfigured } = useOrgSetupContext()
  const tasks = useTasks()
  const hse = useHse()
  const ic = useInternalControl()
  const council = useCouncil()
  const cost = useCostSettings()

  const [boardTab, setBoardTab] = useState<BoardTab>('board')
  const [filterSource, setFilterSource] = useState<ActionBoardSource | 'all'>('all')
  const [boardSearchQuery, setBoardSearchQuery] = useState('')
  const [columnFocus, setColumnFocus] = useState<ColumnFocus>('all')
  const [sortOrder, setSortOrder] = useState<BoardSortOrder>('status_board')
  const [showCardDetail, setShowCardDetail] = useState(true)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null)

  const boardError =
    [tasks.error, hse.error, ic.error, council.error, cost.error].filter(Boolean).join(' ') || null
  const boardLoading =
    supabaseConfigured && (tasks.loading || hse.loading || ic.loading || council.loading || cost.loading)

  const today = new Date().toISOString().slice(0, 10)

  const items = useMemo<ActionBoardScorecardItem[]>(() => {
    const all: ActionBoardScorecardItem[] = []

    tasks.tasks.forEach((t: Task) => {
      all.push({
        id: `task-${t.id}`,
        source: 'task',
        title: t.title,
        detail: t.description?.slice(0, 80) || t.sourceLabel,
        status: t.status,
        module: t.module,
        link: '/tasks',
        dueDate: t.dueDate || undefined,
        overdue: !!t.dueDate && t.dueDate < today && t.status !== 'done',
        isDraggable: true,
        taskId: t.id,
      })
    })

    hse.sickLeaveCases
      .filter((c) => c.status === 'active' || c.status === 'partial')
      .forEach((c) => {
        c.milestones
          .filter((m) => !m.completedAt)
          .forEach((m) => {
            const daysUntil = Math.ceil((new Date(m.dueAt).getTime() - Date.now()) / 86400000)
            if (daysUntil > 14) return
            all.push({
              id: `sl-${c.id}-${m.kind}`,
              source: 'sick_leave_milestone',
              title: m.label,
              detail: c.employeeName,
              status: daysUntil < 0 ? 'todo' : 'in_progress',
              module: 'hse',
              link: '/hse?tab=sickness',
              dueDate: m.dueAt,
              overdue: daysUntil < 0,
              isDraggable: false,
            })
          })
      })

    hse.trainingRecords
      .filter((r) => r.expiresAt && r.expiresAt <= today)
      .forEach((r) => {
        all.push({
          id: `train-${r.id}`,
          source: 'training_expiry',
          title: `Utløpt opplæring: ${r.employeeName}`,
          detail: r.trainingKind === 'custom' ? r.customLabel : r.trainingKind,
          status: 'todo',
          module: 'hse',
          link: '/hse?tab=training',
          dueDate: r.expiresAt,
          overdue: true,
          isDraggable: false,
        })
      })

    hse.incidents
      .filter((i) => i.status !== 'closed' && (i.severity === 'high' || i.severity === 'critical'))
      .forEach((i) => {
        all.push({
          id: `inc-${i.id}`,
          source: 'incident',
          title: `${i.severity === 'critical' ? '🚨 ' : ''}${i.location}: ${i.description.slice(0, 60)}`,
          detail: `${i.kind} · ${i.department || '—'}`,
          status: i.status === 'investigating' ? 'in_progress' : 'todo',
          module: 'hse',
          link: '/workplace-reporting/incidents',
          overdue: i.status === 'reported',
          isDraggable: false,
          severity: i.severity,
        })
      })

    ic.rosAssessments.forEach((ros) => {
      ros.rows
        .filter((r) => !r.done && r.riskScore >= 8)
        .forEach((r) => {
          all.push({
            id: `ros-${r.id}`,
            source: 'ros_risk',
            title: r.hazard.slice(0, 80),
            detail: `${ros.title} · Risiko ${r.riskScore} · ${r.responsible}`,
            status: r.dueDate && r.dueDate < today ? 'todo' : 'in_progress',
            module: 'hse',
            link: '/internal-control?tab=ros',
            dueDate: r.dueDate || undefined,
            overdue: !!r.dueDate && r.dueDate < today,
            isDraggable: false,
          })
        })
    })

    hse.inspections
      .filter((i) => i.status === 'open')
      .forEach((i) => {
        all.push({
          id: `ins-${i.id}`,
          source: 'inspection',
          title: i.title,
          detail: i.responsible,
          status: 'in_progress',
          module: 'hse',
          link: '/hse?tab=inspections',
          isDraggable: false,
        })
      })

    hse.sjaAnalyses
      .filter((s) => s.status === 'draft')
      .forEach((s) => {
        all.push({
          id: `sja-${s.id}`,
          source: 'sja',
          title: s.title,
          detail: s.location,
          status: 'todo',
          module: 'hse',
          link: '/hse?tab=sja',
          isDraggable: false,
        })
      })

    council.compliance
      .filter((c) => !c.done)
      .forEach((c) => {
        all.push({
          id: `amu-${c.id}`,
          source: 'amu_compliance',
          title: c.title,
          detail: c.lawRef,
          status: 'todo',
          module: 'council',
          link: '/council?tab=requirements',
          isDraggable: false,
        })
      })

    return all
  }, [tasks.tasks, hse, ic, council, today])

  const filtered = useMemo(() => {
    let list = filterSource === 'all' ? items : items.filter((i) => i.source === filterSource)
    const q = normalizeSearch(boardSearchQuery)
    if (q) {
      list = list.filter((i) => {
        const t = `${i.title} ${i.detail ?? ''}`.toLowerCase()
        return t.includes(q)
      })
    }
    return list
  }, [items, filterSource, boardSearchQuery])

  const sortedFiltered = useMemo(() => {
    const list = [...filtered]
    if (sortOrder === 'due_soon') {
      list.sort(compareDueSoon)
    } else if (sortOrder === 'title_az') {
      list.sort((a, b) => a.title.localeCompare(b.title, 'nb'))
    }
    return list
  }, [filtered, sortOrder])

  const byStatus = useMemo(
    () => ({
      todo: sortedFiltered.filter((i) => i.status === 'todo'),
      in_progress: sortedFiltered.filter((i) => i.status === 'in_progress'),
      done: sortedFiltered.filter((i) => i.status === 'done'),
    }),
    [sortedFiltered],
  )

  const visibleColumns: TaskStatus[] = useMemo(
    () => (columnFocus === 'all' ? ['todo', 'in_progress', 'done'] : [columnFocus]),
    [columnFocus],
  )

  const costSummary = useMemo(() => {
    const openHighIncidents = hse.incidents.filter(
      (i) => i.status !== 'closed' && (i.severity === 'high' || i.severity === 'critical'),
    ).length
    const activeSickDays = hse.sickLeaveCases
      .filter((c) => c.status === 'active' || c.status === 'partial')
      .reduce((acc, c) => {
        const from = new Date(c.sickFrom)
        // Rolling estimate; anchor to "today" string keeps render stable for lint
        const anchor = new Date(`${today}T12:00:00`).getTime()
        const diff = Math.max(0, Math.ceil((anchor - from.getTime()) / 86400000))
        return acc + diff * (c.sicknessDegree / 100)
      }, 0)
    return {
      sickLeaveCost: cost.sickLeaveCost(Math.round(activeSickDays)),
      incidentCost: cost.incidentCost(openHighIncidents * 8),
      sickDays: Math.round(activeSickDays),
      openIncidents: openHighIncidents,
    }
  }, [hse, cost, today])

  const overdueTotalCount = items.filter((i) => i.overdue).length
  const sourcesPresent = [...new Set(items.map((i) => i.source))] as ActionBoardSource[]
  const taskCount = items.filter((i) => i.source === 'task').length
  const otherCount = items.length - taskCount

  const sourceSegments: { id: ActionBoardSource | 'all'; label: string }[] = [
    { id: 'all', label: 'Alle' },
    ...sourcesPresent.map((s) => ({ id: s, label: ACTION_BOARD_SOURCE_LABELS[s] })),
  ]

  const actionBoardHubItems: HubMenu1Item[] = useMemo(
    () => [
      {
        key: 'board',
        label: 'Tavle',
        icon: LayoutGrid,
        active: boardTab === 'board',
        onClick: () => setBoardTab('board'),
      },
      {
        key: 'costs',
        label: 'Kostnader',
        icon: History,
        active: boardTab === 'costs',
        onClick: () => setBoardTab('costs'),
      },
    ],
    [boardTab],
  )

  return (
    <div className={PAGE_WRAP}>
      {boardError && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {boardError}
        </p>
      )}
      {boardLoading && <p className="mt-4 text-sm text-neutral-500">Laster tavledata…</p>}

      {boardTab === 'board' && (
        <div className="mt-6 w-full space-y-6 font-[Inter,system-ui,sans-serif] text-[#171717]">
          <WorkplacePageHeading1
            breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Action board' }, { label: 'Tavle' }]}
            title="Global Action Board"
            description="Åpne tiltak på tvers av moduler. Oppgaver kan dras mellom kolonner."
            headerActions={
              <>
                <ActionBoardPill tone="tan">Totalt {items.length}</ActionBoardPill>
                <ActionBoardPill tone="red">Forfalt {overdueTotalCount}</ActionBoardPill>
                <ActionBoardPill tone="green">Oppgaver {taskCount}</ActionBoardPill>
                <ActionBoardPill tone="blue">Andre {otherCount}</ActionBoardPill>
                <Link
                  to="/tasks?view=list"
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase text-white shadow-sm"
                  style={{ backgroundColor: AB_SCORECARD_FOREST }}
                >
                  <Plus className="size-3.5 shrink-0" />
                  Ny oppgave
                </Link>
              </>
            }
            menu={<HubMenu1Bar ariaLabel="Action board — visning" items={actionBoardHubItems} />}
          />

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <ActionBoardSerifHeading className="text-xl">Handlingspunkter</ActionBoardSerifHeading>
              <p className="mt-1 text-sm text-neutral-600">
                Filtrer på kilde, søk i tittel og dra oppgavekort mellom statuskolonner.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase shadow-sm"
            >
              <Download className="size-3.5" />
              Eksport
            </button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={boardSearchQuery}
              onChange={(e) => setBoardSearchQuery(e.target.value)}
              placeholder="Søk i tittel og beskrivelse…"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#1a3d32]/25"
              aria-label="Søk i handlingspunkter"
            />
          </div>

          <div
            className="grid gap-4 rounded-lg border border-neutral-200/80 p-4 sm:grid-cols-2 lg:grid-cols-4"
            style={{ backgroundColor: AB_SCORECARD_CREAM_DEEP }}
          >
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Kilde
              <select
                className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                value={filterSource}
                onChange={(e) => setFilterSource((e.target.value === 'all' ? 'all' : e.target.value) as ActionBoardSource | 'all')}
              >
                {sourceSegments.map(({ id, label }) => (
                  <option key={String(id)} value={String(id)}>
                    {label}
                    {id === 'all' ? ` (${items.length})` : ` (${items.filter((i) => i.source === id).length})`}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Kolonne (visning)
              <select
                className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                value={columnFocus}
                onChange={(e) => setColumnFocus(e.target.value as ColumnFocus)}
              >
                <option value="all">Alle tre</option>
                <option value="todo">Å gjøre</option>
                <option value="in_progress">Pågår</option>
                <option value="done">Fullført</option>
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Sortering
              <select
                className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as BoardSortOrder)}
              >
                <option value="status_board">Status (tavle)</option>
                <option value="due_soon">Frist (snart først)</option>
                <option value="title_az">Tittel A–Å</option>
              </select>
            </label>
            <div className="flex items-end gap-3 pb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">Vis detalj</span>
              <label htmlFor="action-board-vis-detalj" className="relative inline-flex cursor-pointer items-center">
                <input
                  id="action-board-vis-detalj"
                  type="checkbox"
                  className="peer sr-only"
                  checked={showCardDetail}
                  onChange={(e) => setShowCardDetail(e.target.checked)}
                />
                <span className="h-6 w-11 rounded-full bg-neutral-300 peer-checked:bg-[#1a3d32] after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { title: 'Å gjøre', value: String(byStatus.todo.length), sub: 'Venter' },
                { title: 'Pågår', value: String(byStatus.in_progress.length), sub: 'Aktiv' },
                { title: 'Fullført', value: String(byStatus.done.length), sub: 'Lukket' },
                { title: 'Treff', value: String(filtered.length), sub: 'Etter kilde og søk' },
              ] as const
            ).map((kpi) => (
              <div
                key={kpi.title}
                className="rounded-lg border border-neutral-200/80 px-5 py-4"
                style={{ backgroundColor: AB_SCORECARD_CREAM_DEEP }}
              >
                <p className="text-3xl font-bold tabular-nums text-neutral-900">{kpi.value}</p>
                <p className="mt-1 text-sm font-medium text-neutral-800">{kpi.title}</p>
                <p className="text-xs text-neutral-600">{kpi.sub}</p>
              </div>
            ))}
          </div>

          <div
            className={`grid gap-6 ${columnFocus === 'all' ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}
          >
            {visibleColumns.map((col) => (
              <div
                key={col}
                className={`flex min-h-[320px] flex-col gap-3 rounded-xl border-2 p-3 transition-colors ${STATUS_STYLES[col]} ${
                  dragOverCol === col ? 'border-[#c9a227] bg-[#c9a227]/10' : ''
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverCol(col)
                }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData(DRAG_TYPE)
                  if (id) {
                    tasks.setStatus(id, col)
                  }
                  setDragTaskId(null)
                  setDragOverCol(null)
                }}
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-neutral-800">{STATUS_LABELS[col]}</span>
                  <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-neutral-600 ring-1 ring-neutral-200">
                    {byStatus[col].length}
                  </span>
                </div>

                {byStatus[col].length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 py-12 text-xs text-neutral-400">
                    <LayoutGrid className="mb-1 size-5 opacity-40" />
                    Ingen handlingspunkter
                  </div>
                )}

                {byStatus[col].map((item) => (
                  <ActionBoardTaskScorecardCard
                    key={item.id}
                    item={item}
                    sourceLabel={ACTION_BOARD_SOURCE_LABELS[item.source]}
                    sourceColourClass={SOURCE_COLOUR[item.source]}
                    dragTaskId={dragTaskId}
                    showDetail={showCardDetail}
                    onDragStart={(e, taskId) => {
                      e.dataTransfer.setData(DRAG_TYPE, taskId)
                      e.dataTransfer.effectAllowed = 'move'
                      setDragTaskId(taskId)
                    }}
                    onDragEnd={() => {
                      setDragTaskId(null)
                      setDragOverCol(null)
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-neutral-200/80 bg-white p-4 shadow-sm">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Datakilder</p>
            <p className="text-xs text-neutral-600">
              Oppgaver kan dras mellom kolonner. Andre kort er lenkede visninger — bruk «Åpne kilde» for kildemodulen.
            </p>
          </div>
        </div>
      )}

      {boardTab === 'costs' && (
        <div className="mt-6 w-full space-y-6 font-[Inter,system-ui,sans-serif] text-[#171717]">
          <WorkplacePageHeading1
            breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Action board' }, { label: 'Kostnader' }]}
            title="Kostnadsoversikt"
            description="Forenklet estimat basert på innstillinger — ikke regnskapsgrunnlag."
            menu={<HubMenu1Bar ariaLabel="Action board — visning" items={actionBoardHubItems} />}
          />

          <section className="space-y-4 pt-2">
            {!cost.settings.enabled ? (
              <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-600 shadow-sm">
                Kostnadsestimat er av. Aktiver under innstillinger for å se sykefravær- og hendelseskostnader her.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <CostCard
                  label="Estimert kostnad aktive sykefravær"
                  value={`kr ${costSummary.sickLeaveCost.toLocaleString('no-NO')}`}
                  detail={`${costSummary.sickDays} tapte dagsverk × kr ${cost.settings.hourlyRateNok}/t × ${cost.settings.hoursPerDay}t`}
                  colour="orange"
                />
                <CostCard
                  label="Estimert kostnad åpne alvorlige hendelser"
                  value={`kr ${costSummary.incidentCost.toLocaleString('no-NO')}`}
                  detail={`${costSummary.openIncidents} hendelser × 8t utredning × kr ${cost.settings.hourlyRateNok}/t`}
                  colour="red"
                />
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
                  <AlertTriangle className="size-5 shrink-0 text-amber-600" />
                  <div>
                    <div className="text-2xl font-bold tabular-nums text-neutral-900">{overdueTotalCount}</div>
                    <div className="text-sm text-neutral-600">Forfalte handlingspunkter</div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function CostCard({
  label,
  value,
  detail,
  colour,
}: {
  label: string
  value: string
  detail: string
  colour: 'orange' | 'red'
}) {
  const Icon = colour === 'orange' ? Users : ShieldAlert
  const border = colour === 'orange' ? 'border-orange-200' : 'border-red-200'
  const bg = colour === 'orange' ? 'bg-orange-50' : 'bg-red-50'
  const textColour = colour === 'orange' ? 'text-orange-800' : 'text-red-800'
  return (
    <div className={`rounded-lg border ${border} ${bg} p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 size-5 shrink-0 ${textColour}`} />
        <div>
          <div className={`text-xl font-bold tabular-nums ${textColour}`}>{value}</div>
          <div className="text-xs font-medium text-neutral-800">{label}</div>
          <div className="mt-0.5 text-[10px] text-neutral-500">{detail}</div>
        </div>
      </div>
    </div>
  )
}
