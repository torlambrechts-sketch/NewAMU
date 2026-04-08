/**
 * Global Action Board — Kanban across modules; task cards are drag-and-drop between columns.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  GripVertical,
  History,
  LayoutGrid,
  Plus,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { useCouncil } from '../../hooks/useCouncil'
import { useHse } from '../../hooks/useHse'
import { useInternalControl } from '../../hooks/useInternalControl'
import { useTasks } from '../../hooks/useTasks'
import { useCostSettings } from '../../hooks/useCostSettings'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { mergeLayoutPayload } from '../../lib/layoutLabTokens'
import { useOrgMenu1Styles } from '../../hooks/useOrgMenu1Styles'
import { useUiTheme } from '../../hooks/useUiTheme'
import type { Task, TaskStatus } from '../../types/task'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const HERO_ACTION_CLASS =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-none px-4 text-sm font-medium leading-none'
const R_FLAT = 'rounded-none'
const SETTINGS_THRESHOLD_BOX =
  'flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5'
const DRAG_TYPE = 'application/x-atics-task-id'

type BoardSource =
  | 'task'
  | 'sick_leave_milestone'
  | 'training_expiry'
  | 'incident'
  | 'ros_risk'
  | 'inspection'
  | 'sja'
  | 'amu_compliance'

type BoardItem = {
  id: string
  source: BoardSource
  title: string
  detail?: string
  status: TaskStatus
  module: string
  link: string
  dueDate?: string
  overdue?: boolean
  isDraggable: boolean
  taskId?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
}

const SOURCE_COLOUR: Record<BoardSource, string> = {
  task: 'bg-neutral-200/90 text-neutral-800',
  sick_leave_milestone: 'bg-orange-100 text-orange-900',
  training_expiry: 'bg-rose-100 text-rose-900',
  incident: 'bg-red-100 text-red-900',
  ros_risk: 'bg-amber-100 text-amber-900',
  inspection: 'bg-sky-100 text-sky-900',
  sja: 'bg-purple-100 text-purple-900',
  amu_compliance: 'bg-[#1a3d32]/15 text-[#1a3d32]',
}

const SOURCE_LABELS: Record<BoardSource, string> = {
  task: 'Oppgave',
  sick_leave_milestone: 'Sykefravær',
  training_expiry: 'Opplæring',
  incident: 'Hendelse',
  ros_risk: 'ROS-risiko',
  inspection: 'Inspeksjon',
  sja: 'SJA',
  amu_compliance: 'AMU-sjekkliste',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Å gjøre',
  in_progress: 'Pågår',
  done: 'Fullført',
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: 'border-neutral-300 bg-neutral-50',
  in_progress: 'border-sky-300 bg-sky-50/50',
  done: 'border-emerald-300 bg-emerald-50/50',
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('no-NO', { dateStyle: 'short' })
  } catch {
    return iso
  }
}

type BoardTab = 'board' | 'costs'

export function ActionBoardPage() {
  const menu1 = useOrgMenu1Styles()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)

  const { supabaseConfigured } = useOrgSetupContext()
  const tasks = useTasks()
  const hse = useHse()
  const ic = useInternalControl()
  const council = useCouncil()
  const cost = useCostSettings()

  const [boardTab, setBoardTab] = useState<BoardTab>('board')
  const [filterSource, setFilterSource] = useState<BoardSource | 'all'>('all')
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null)

  const boardError =
    [tasks.error, hse.error, ic.error, council.error, cost.error].filter(Boolean).join(' ') || null
  const boardLoading =
    supabaseConfigured && (tasks.loading || hse.loading || ic.loading || council.loading || cost.loading)

  const today = new Date().toISOString().slice(0, 10)

  const items = useMemo<BoardItem[]>(() => {
    const all: BoardItem[] = []

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
          link: '/council?tab=compliance',
          isDraggable: false,
        })
      })

    return all
  }, [tasks.tasks, hse, ic, council, today])

  const filtered = useMemo(
    () => (filterSource === 'all' ? items : items.filter((i) => i.source === filterSource)),
    [items, filterSource],
  )

  const byStatus = useMemo(
    () => ({
      todo: filtered.filter((i) => i.status === 'todo'),
      in_progress: filtered.filter((i) => i.status === 'in_progress'),
      done: filtered.filter((i) => i.status === 'done'),
    }),
    [filtered],
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
  const sourcesPresent = [...new Set(items.map((i) => i.source))] as BoardSource[]
  const taskCount = items.filter((i) => i.source === 'task').length
  const otherCount = items.length - taskCount

  const sourceSegments: { id: BoardSource | 'all'; label: string }[] = [
    { id: 'all', label: 'Alle' },
    ...sourcesPresent.map((s) => ({ id: s, label: SOURCE_LABELS[s] })),
  ]

  return (
    <div className={PAGE_WRAP}>
      <nav className="mb-6 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Workspace
        </Link>
        <span className="text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Action board</span>
      </nav>

      <div className="flex flex-col gap-6 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Global Action Board
          </h1>
          <p className="mt-1 text-sm text-neutral-500 max-w-2xl">
            Åpne tiltak på tvers av moduler. Oppgaver kan dras mellom kolonner (HTML5 drag-and-drop).
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
              Totalt <strong className="ml-1 font-semibold">{items.length}</strong>
            </span>
            <span className={`${HERO_ACTION_CLASS} bg-red-100 text-red-900`}>
              Forfalt <strong className="ml-1 font-semibold">{overdueTotalCount}</strong>
            </span>
            <span className={`${HERO_ACTION_CLASS} bg-neutral-100 text-neutral-700`}>
              Oppgaver <strong className="ml-1 font-semibold">{taskCount}</strong>
            </span>
            <span className={`${HERO_ACTION_CLASS} bg-sky-100 text-sky-900`}>
              Andre kilder <strong className="ml-1 font-semibold">{otherCount}</strong>
            </span>
            <Link
              to="/tasks?view=list"
              className={`${HERO_ACTION_CLASS} bg-[#1a3d32] text-white hover:bg-[#142e26]`}
            >
              <Plus className="size-4 shrink-0" /> Ny oppgave
            </Link>
          </div>
        </div>
      </div>

      <div className={menu1.barOuterClass} style={menu1.barStyle}>
        <div className={menu1.innerRowClass}>
          {(
            [
              { id: 'board' as const, label: 'Tavle', Icon: LayoutGrid },
              { id: 'costs' as const, label: 'Kostnader', Icon: History },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = boardTab === id
            const tb = menu1.tabButton(active)
            return (
              <button
                key={id}
                type="button"
                onClick={() => setBoardTab(id)}
                className={tb.className}
                style={tb.style}
              >
                <Icon className="size-4 shrink-0 opacity-90" />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {boardError && (
        <p className="mt-4 rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {boardError}
        </p>
      )}
      {boardLoading && <p className="mt-4 text-sm text-neutral-500">Laster tavledata…</p>}

      {boardTab === 'board' && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { title: 'Å gjøre', value: String(byStatus.todo.length) },
                { title: 'Pågår', value: String(byStatus.in_progress.length) },
                { title: 'Fullført', value: String(byStatus.done.length) },
                { title: 'I filter', value: String(filtered.length) },
              ] as const
            ).map((item) => (
              <div key={item.title} className={SETTINGS_THRESHOLD_BOX} style={menu1.barStyle}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{item.title}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-none border border-neutral-200 bg-neutral-50/80 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Kilde</p>
            <div className={`inline-flex max-w-full flex-wrap gap-1 border border-neutral-200 bg-white p-1 ${R_FLAT}`}>
              {sourceSegments.map(({ id, label }) => {
                const selected = filterSource === id
                return (
                  <button
                    key={String(id)}
                    type="button"
                    onClick={() => setFilterSource(id)}
                    className={`inline-flex items-center gap-2 px-2.5 py-2 text-xs font-medium transition sm:text-sm ${R_FLAT} ${
                      selected ? 'text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'
                    }`}
                    style={selected ? { backgroundColor: layout.accent, color: '#fff' } : undefined}
                  >
                    {selected ? (
                      <span className="flex size-4 items-center justify-center rounded-none bg-white/20">
                        <Check className="size-3" />
                      </span>
                    ) : (
                      <span className="size-4 rounded-none border-2 border-neutral-300" />
                    )}
                    {label}
                    {id === 'all' ? ` (${items.length})` : ` (${items.filter((i) => i.source === id).length})`}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((col) => (
              <div
                key={col}
                className={`flex min-h-[280px] flex-col gap-2 border-2 p-3 transition-colors ${R_FLAT} ${
                  dragOverCol === col ? 'border-[#c9a227] bg-[#c9a227]/10' : STATUS_STYLES[col]
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
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-sm font-semibold text-neutral-800">{STATUS_LABELS[col]}</span>
                  <span
                    className={`${R_FLAT} bg-white px-2 py-0.5 text-xs font-medium text-neutral-600 ring-1 ring-neutral-200`}
                  >
                    {byStatus[col].length}
                  </span>
                </div>

                {byStatus[col].length === 0 && (
                  <div
                    className={`flex flex-col items-center justify-center border border-dashed border-neutral-300 py-10 text-xs text-neutral-400 ${R_FLAT}`}
                  >
                    <LayoutGrid className="mb-1 size-5 opacity-40" />
                    Ingen handlingspunkter
                  </div>
                )}

                {byStatus[col].map((item) => (
                  <div
                    key={item.id}
                    draggable={item.isDraggable}
                    onDragStart={(e) => {
                      if (!item.isDraggable || !item.taskId) return
                      e.dataTransfer.setData(DRAG_TYPE, item.taskId)
                      e.dataTransfer.effectAllowed = 'move'
                      setDragTaskId(item.taskId)
                    }}
                    onDragEnd={() => {
                      setDragTaskId(null)
                      setDragOverCol(null)
                    }}
                    className={`group border bg-white p-3 shadow-sm transition-shadow hover:shadow ${R_FLAT} ${
                      item.overdue ? 'border-red-300' : 'border-neutral-200'
                    } ${item.isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${
                      dragTaskId === item.taskId ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {item.isDraggable && (
                        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-neutral-400" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`${R_FLAT} px-2 py-0.5 text-[10px] font-medium ${SOURCE_COLOUR[item.source]}`}
                          >
                            {SOURCE_LABELS[item.source]}
                          </span>
                          {item.overdue && (
                            <span className={`${R_FLAT} bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800`}>
                              Forfalt
                            </span>
                          )}
                          {item.severity === 'critical' && (
                            <span className={`${R_FLAT} bg-red-700 px-2 py-0.5 text-[10px] font-bold text-white`}>
                              Kritisk
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-sm font-medium text-neutral-900">{item.title}</p>
                        {item.detail && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{item.detail}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          {item.dueDate && (
                            <span
                              className={`flex items-center gap-1 text-xs ${
                                item.overdue ? 'font-medium text-red-600' : 'text-neutral-500'
                              }`}
                            >
                              <Calendar className="size-3" />
                              {formatDate(item.dueDate)}
                            </span>
                          )}
                          <Link
                            to={item.link}
                            className="ml-auto flex items-center gap-0.5 text-xs text-[#1a3d32] opacity-0 transition-opacity group-hover:opacity-100 hover:underline"
                          >
                            Åpne <ArrowRight className="size-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-none border border-neutral-200 bg-white p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Datakilder</p>
            <p className="text-xs text-neutral-600">
              Oppgaver kan dras mellom kolonner. Andre kort er lenkede visninger — bruk «Åpne» for kildemodulen.
            </p>
          </div>
        </>
      )}

      {boardTab === 'costs' && (
        <section className="mt-8 space-y-4">
          {!cost.settings.enabled ? (
            <div className="rounded-none border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
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
              <div
                className={`flex items-center gap-3 border border-amber-200 bg-amber-50/80 p-4 shadow-sm ${R_FLAT}`}
              >
                <AlertTriangle className="size-5 shrink-0 text-amber-600" />
                <div>
                  <div className="text-2xl font-bold tabular-nums text-neutral-900">{overdueTotalCount}</div>
                  <div className="text-sm text-neutral-600">Forfalte handlingspunkter</div>
                </div>
              </div>
            </div>
          )}
        </section>
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
    <div className={`rounded-none border ${border} ${bg} p-4 shadow-sm`}>
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
