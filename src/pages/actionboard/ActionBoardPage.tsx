/**
 * Global Action Board
 *
 * Unified Kanban showing every open action across all modules:
 *  - Manual tasks (useTasks)
 *  - Sick leave milestones overdue/upcoming (useHse)
 *  - Overdue training records (useHse)
 *  - Open ROS rows with responsible person (useInternalControl)
 *  - Open incidents not yet closed (useHse)
 *  - AMU compliance items not ticked (useCouncil)
 *  - Open inspections (useHse)
 *  - Open SJA drafts (useHse)
 *
 * Each derived item carries a link back to its source module.
 * Tasks from useTasks can be dragged between columns.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronRight,
  GripVertical,
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
import type { Task, TaskStatus } from '../../types/task'

// ─── Board item — unified shape across all sources ─────────────────────────────

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
  /** Only task-sourced items support drag to change status */
  isDraggable: boolean
  severity?: 'low' | 'medium' | 'high' | 'critical'
}

const SOURCE_COLOUR: Record<BoardSource, string> = {
  task:                  'bg-neutral-100 text-neutral-700',
  sick_leave_milestone:  'bg-orange-100 text-orange-800',
  training_expiry:       'bg-rose-100 text-rose-800',
  incident:              'bg-red-100 text-red-800',
  ros_risk:              'bg-amber-100 text-amber-800',
  inspection:            'bg-sky-100 text-sky-800',
  sja:                   'bg-purple-100 text-purple-800',
  amu_compliance:        'bg-[#1a3d32]/10 text-[#1a3d32]',
}

const SOURCE_LABELS: Record<BoardSource, string> = {
  task:                  'Oppgave',
  sick_leave_milestone:  'Sykefravær',
  training_expiry:       'Opplæring',
  incident:              'Hendelse',
  ros_risk:              'ROS-risiko',
  inspection:            'Inspeksjon',
  sja:                   'SJA',
  amu_compliance:        'AMU-sjekkliste',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Å gjøre',
  in_progress: 'Pågår',
  done: 'Fullført',
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: 'border-neutral-200 bg-neutral-50',
  in_progress: 'border-sky-200 bg-sky-50/40',
  done: 'border-emerald-200 bg-emerald-50/40',
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('no-NO', { dateStyle: 'short' }) }
  catch { return iso }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ActionBoardPage() {
  const tasks = useTasks()
  const hse = useHse()
  const ic = useInternalControl()
  const council = useCouncil()
  const cost = useCostSettings()

  const [filterSource, setFilterSource] = useState<BoardSource | 'all'>('all')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  // ── Collect all board items ────────────────────────────────────────────────

  const items = useMemo<BoardItem[]>(() => {
    const all: BoardItem[] = []

    // 1. Manual tasks
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
        severity: undefined,
      })
    })

    // 2. Sick leave milestones — overdue or due within 14 days
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

    // 3. Overdue or expiring training
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

    // 4. Open incidents (high/critical not closed)
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
          link: '/hse?tab=incidents',
          overdue: i.status === 'reported',
          isDraggable: false,
          severity: i.severity,
        })
      })

    // 5. Open ROS rows (undone, high risk)
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

    // 6. Open inspections
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

    // 7. SJA drafts
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

    // 8. AMU compliance items not ticked
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
    () => filterSource === 'all' ? items : items.filter((i) => i.source === filterSource),
    [items, filterSource],
  )

  const byStatus = useMemo(() => ({
    todo: filtered.filter((i) => i.status === 'todo'),
    in_progress: filtered.filter((i) => i.status === 'in_progress'),
    done: filtered.filter((i) => i.status === 'done'),
  }), [filtered])

  // ── Cost summary ───────────────────────────────────────────────────────────

  const costSummary = useMemo(() => {
    const openHighIncidents = hse.incidents.filter((i) => i.status !== 'closed' && (i.severity === 'high' || i.severity === 'critical')).length
    const activeSickDays = hse.sickLeaveCases
      .filter((c) => c.status === 'active' || c.status === 'partial')
      .reduce((acc, c) => {
        const from = new Date(c.sickFrom)
        // eslint-disable-next-line react-hooks/purity -- rolling estimate of active sick days
        const diff = Math.max(0, Math.ceil((Date.now() - from.getTime()) / 86400000))
        return acc + diff * (c.sicknessDegree / 100)
      }, 0)
    return {
      sickLeaveCost: cost.sickLeaveCost(Math.round(activeSickDays)),
      incidentCost: cost.incidentCost(openHighIncidents * 8),
      sickDays: Math.round(activeSickDays),
      openIncidents: openHighIncidents,
    }
  }, [hse, cost])

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(id: string) { setDragId(id) }
  function handleDragEnd() { setDragId(null); setDragOver(null) }
  function handleDrop(col: TaskStatus) {
    if (!dragId) return
    const sourceId = dragId.replace('task-', '')
    tasks.setStatus(sourceId, col)
    setDragId(null)
    setDragOver(null)
  }

  const overdueTotalCount = items.filter((i) => i.overdue).length
  const sourcesPresent = [...new Set(items.map((i) => i.source))] as BoardSource[]

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      {/* Header */}
      <nav className="mb-4 flex items-center gap-1 text-sm text-neutral-500">
        <Link to="/" className="hover:text-[#1a3d32]">Prosjekter</Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-neutral-800">Action Board</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 md:text-3xl" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Global Action Board
          </h1>
          <p className="mt-1 text-sm text-neutral-600 max-w-2xl">
            Alle åpne handlingspunkter på tvers av HMS, AMU, sykefravær og internkontroll — samlet i ett bilde. Oppgaver fra Oppgavelisten kan dras mellom kolonner.
          </p>
        </div>
        <Link to="/tasks?title=&module=general" className="inline-flex items-center gap-1.5 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]">
          <Plus className="size-4" /> Ny oppgave
        </Link>
      </div>

      {/* Cost summary strip */}
      {cost.settings.enabled && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
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
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm flex items-center gap-3">
            <AlertTriangle className="size-5 text-amber-500 shrink-0" />
            <div>
              <div className="text-2xl font-bold tabular-nums text-neutral-900">{overdueTotalCount}</div>
              <div className="text-sm text-neutral-500">Forfalte handlingspunkter</div>
            </div>
          </div>
        </div>
      )}

      {/* Source filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilterSource('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${filterSource === 'all' ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>
          Alle ({items.length})
        </button>
        {sourcesPresent.map((src) => {
          const count = items.filter((i) => i.source === src).length
          return (
            <button key={src} type="button" onClick={() => setFilterSource(src === filterSource ? 'all' : src)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${filterSource === src ? `${SOURCE_COLOUR[src]} ring-1 ring-current` : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>
              {SOURCE_LABELS[src]} ({count})
            </button>
          )
        })}
      </div>

      {/* Kanban columns */}
      <div className="grid gap-4 md:grid-cols-3">
        {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((col) => (
          <div
            key={col}
            className={`flex flex-col gap-3 rounded-2xl border-2 p-3 transition-colors ${dragOver === col ? 'border-[#c9a227] bg-[#c9a227]/5' : STATUS_STYLES[col]}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(col) }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(col)}
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-neutral-700">{STATUS_LABELS[col]}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-neutral-500 shadow-sm">{byStatus[col].length}</span>
            </div>

            {byStatus[col].length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 py-8 text-xs text-neutral-400">
                <LayoutGrid className="mb-1 size-5 opacity-40" />
                Ingen handlingspunkter
              </div>
            )}

            {byStatus[col].map((item) => (
              <div
                key={item.id}
                draggable={item.isDraggable}
                onDragStart={() => item.isDraggable && handleDragStart(item.id)}
                onDragEnd={handleDragEnd}
                className={`group rounded-xl border bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${item.overdue ? 'border-red-200' : 'border-neutral-200'} ${item.isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${dragId === item.id ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {item.isDraggable && <GripVertical className="mt-0.5 size-3.5 shrink-0 text-neutral-300" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SOURCE_COLOUR[item.source]}`}>
                        {SOURCE_LABELS[item.source]}
                      </span>
                      {item.overdue && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Forfalt</span>
                      )}
                      {item.severity === 'critical' && (
                        <span className="rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-bold text-white">Kritisk</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-neutral-900 line-clamp-2">{item.title}</p>
                    {item.detail && <p className="mt-0.5 text-xs text-neutral-500 line-clamp-1">{item.detail}</p>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {item.dueDate && (
                        <span className={`flex items-center gap-1 text-xs ${item.overdue ? 'text-red-600 font-medium' : 'text-neutral-400'}`}>
                          <Calendar className="size-3" />
                          {formatDate(item.dueDate)}
                        </span>
                      )}
                      <Link to={item.link} className="ml-auto flex items-center gap-0.5 text-xs text-[#1a3d32] opacity-0 group-hover:opacity-100 transition-opacity hover:underline">
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

      {/* Legend */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Datakilder</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(SOURCE_LABELS) as BoardSource[]).map((src) => (
            <div key={src} className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SOURCE_COLOUR[src]}`}>{SOURCE_LABELS[src]}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Oppgaver (grå) kan dras mellom kolonner. Alle andre rader er lenkede visninger — klikk «Åpne» for å gå til kildemodellen.
          {cost.settings.enabled && ' Kostnadstall basert på timesats kr ' + cost.settings.hourlyRateNok + '/t.'}
        </p>
      </div>
    </div>
  )
}

function CostCard({ label, value, detail, colour }: { label: string; value: string; detail: string; colour: 'orange' | 'red' }) {
  const Icon = colour === 'orange' ? Users : ShieldAlert
  const border = colour === 'orange' ? 'border-orange-200' : 'border-red-200'
  const bg = colour === 'orange' ? 'bg-orange-50' : 'bg-red-50'
  const textColour = colour === 'orange' ? 'text-orange-800' : 'text-red-800'
  return (
    <div className={`rounded-xl border ${border} ${bg} p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 size-5 shrink-0 ${textColour}`} />
        <div>
          <div className={`text-xl font-bold tabular-nums ${textColour}`}>{value}</div>
          <div className="text-xs font-medium text-neutral-700">{label}</div>
          <div className="mt-0.5 text-[10px] text-neutral-500">{detail}</div>
        </div>
      </div>
    </div>
  )
}
