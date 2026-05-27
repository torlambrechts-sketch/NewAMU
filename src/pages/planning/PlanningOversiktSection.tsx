// PlanningOversiktSection — Oppgaver & prosjekter tab.
//
// View switch:
//   Kanban — group by status column
//   Liste — flat sortable list
//   Tidslinje — Gantt-style timeline
//   Prosjekter — project cards with linked tasks
//
// Filters: owner, type, OKR.
// Recurrence handling: every task row shows interval / "stoppet"-status and
// allows quick stop/change.

import { useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarRange,
  Columns3,
  FolderKanban,
  GanttChart,
  KanbanSquare,
  List,
  ListTodo,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Target,
} from 'lucide-react'
import { Initials } from '../../components/ui/elearningPrimitives'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import type { TaskItemStatus } from '../../types/task'
import type { OkrPlanFull } from '../../types/planning'
import type { TaskProject } from '../../../modules/tasks/useTaskProjects'
import type { PlanningTaskRow, UsePlanningTasksReturn } from '../../hooks/usePlanningTasks'
import {
  KANBAN_COLUMNS,
  PRIORITY_META,
  STATUS_META,
  fmtDateShort,
  kanbanColumnFor,
} from './planningConstants'
import { RECURRENCE_PRESETS, presetForDays, type RecurrencePresetId } from '../../types/planning'

type ViewId = 'kanban' | 'list' | 'timeline' | 'projects'

type Props = {
  plan: OkrPlanFull | null
  tasks: PlanningTaskRow[]
  projects: TaskProject[]
  tasksCtrl: UsePlanningTasksReturn
  onCreateTask: () => void
  onCreateProject: () => void
}

export function PlanningOversiktSection({
  plan,
  tasks,
  projects,
  tasksCtrl,
  onCreateTask,
  onCreateProject,
}: Props) {
  const [view, setView] = useState<ViewId>('kanban')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [okrFilter, setOkrFilter] = useState<string>('all')
  const [recurringOnly, setRecurringOnly] = useState(false)

  const owners = useMemo(
    () =>
      Array.from(new Set(tasks.map((t) => t.ownerName ?? '').filter((o) => o))).sort((a, b) =>
        a.localeCompare(b, 'nb'),
      ),
    [tasks],
  )

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (ownerFilter !== 'all' && (t.ownerName ?? '') !== ownerFilter) return false
      if (typeFilter !== 'all') {
        if (typeFilter === 'recurring' && !t.recurrenceActive) return false
        if (typeFilter === 'oppgave' && (t.recurrenceActive || t.templateKind === 'risiko')) return false
        if (typeFilter === 'prosjekt' && !t.projectId) return false
      }
      if (recurringOnly && !t.recurrenceActive) return false
      if (okrFilter !== 'all') {
        if (!plan) return false
        const obj = plan.objectives.find((o) => o.id === okrFilter)
        if (!obj) return false
        if (!t.okrKeyResultId) return false
        if (!obj.keyResults.some((k) => k.id === t.okrKeyResultId)) return false
      }
      return true
    })
  }, [tasks, ownerFilter, typeFilter, recurringOnly, okrFilter, plan])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#1a3d32]/20 bg-[#e7efe9]/30 p-4">
        <div className="flex items-start gap-3">
          <KanbanSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#1a3d32]" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neutral-900">Alt arbeid samlet</h3>
            <p className="mt-0.5 text-[12px] text-neutral-700">
              Oppgaver, rutiner og prosjekter knyttet til OKR-treet og kadensen. Bytt visning for å
              fokusere på status, tid eller eier. Rutiner regenereres automatisk ved fullføring
              inntil du stopper dem.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
          <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5">
            {(
              [
                { id: 'kanban', label: 'Tavle', icon: Columns3 },
                { id: 'list', label: 'Liste', icon: List },
                { id: 'timeline', label: 'Tidslinje', icon: GanttChart },
                { id: 'projects', label: 'Prosjekter', icon: FolderKanban },
              ] as const
            ).map((v) => {
              const VIcon = v.icon
              return (
                <Button
                  key={v.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setView(v.id as ViewId)}
                  className={[
                    'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold normal-case transition-colors',
                    view === v.id
                      ? 'bg-[#1a3d32] text-white hover:bg-[#14312a] hover:text-white'
                      : 'text-neutral-600 hover:bg-neutral-50',
                  ].join(' ')}
                >
                  <VIcon className="h-3.5 w-3.5" />
                  {v.label}
                </Button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* eslint-disable-next-line no-restricted-syntax */}
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs"
            >
              <option value="all">Alle eiere</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs"
            >
              <option value="all">Alle typer</option>
              <option value="oppgave">Oppgaver</option>
              <option value="prosjekt">I prosjekt</option>
              <option value="recurring">Rutiner</option>
            </select>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <select
              value={okrFilter}
              onChange={(e) => setOkrFilter(e.target.value)}
              className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs"
            >
              <option value="all">Alle OKR</option>
              {plan?.objectives.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.ordLabel} — {o.objective.slice(0, 40)}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-1 text-[11px] text-neutral-700">
              {/* eslint-disable-next-line no-restricted-syntax */}
              <input
                type="checkbox"
                checked={recurringOnly}
                onChange={(e) => setRecurringOnly(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Kun rutiner
            </label>
            <Button
              variant="secondary"
              size="sm"
              onClick={onCreateProject}
              icon={<FolderKanban className="h-3 w-3" />}
            >
              Nytt prosjekt
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onCreateTask}
              icon={<Plus className="h-3 w-3" />}
            >
              Ny oppgave
            </Button>
          </div>
        </div>

        {view === 'kanban' && <KanbanView tasks={filtered} plan={plan} tasksCtrl={tasksCtrl} />}
        {view === 'list' && <ListView tasks={filtered} plan={plan} tasksCtrl={tasksCtrl} />}
        {view === 'timeline' && <TimelineView tasks={filtered} plan={plan} />}
        {view === 'projects' && (
          <ProjectsView
            projects={projects}
            tasks={tasks}
            plan={plan}
            onCreateProject={onCreateProject}
          />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Kanban view
// ─────────────────────────────────────────────────────────────────────────────

function KanbanView({
  tasks,
  plan,
  tasksCtrl,
}: {
  tasks: PlanningTaskRow[]
  plan: OkrPlanFull | null
  tasksCtrl: UsePlanningTasksReturn
}) {
  const grouped = useMemo(() => {
    const g: Record<string, PlanningTaskRow[]> = {}
    for (const col of KANBAN_COLUMNS) g[col.id] = []
    for (const t of tasks) {
      const col = kanbanColumnFor(t.status)
      g[col]?.push(t)
    }
    return g
  }, [tasks])

  return (
    <div className="grid auto-cols-fr grid-flow-col gap-3 overflow-x-auto p-5">
      {KANBAN_COLUMNS.map((col) => {
        const list = grouped[col.id] ?? []
        const ColIcon = col.icon
        return (
          <div
            key={col.id}
            className="flex min-w-[240px] flex-col rounded-lg bg-[#fbf9f3]/40"
          >
            <header className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-neutral-700">
                  <ColIcon className="h-2.5 w-2.5" />
                  {col.label}
                </span>
              </div>
              <span className="text-[10px] font-semibold tabular-nums text-neutral-500">
                {list.length}
              </span>
            </header>
            <div className="flex-1 space-y-2 p-2">
              {list.length === 0 ? (
                <div className="rounded border-2 border-dashed border-neutral-200 py-6 text-center text-[10px] italic text-neutral-400">
                  Ingen
                </div>
              ) : (
                list.map((t) => (
                  <TaskCard key={t.id} t={t} plan={plan} tasksCtrl={tasksCtrl} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TaskCard({
  t,
  plan,
  tasksCtrl,
}: {
  t: PlanningTaskRow
  plan: OkrPlanFull | null
  tasksCtrl: UsePlanningTasksReturn
}) {
  const okrObj = plan && t.okrKeyResultId
    ? plan.objectives.find((o) => o.keyResults.some((k) => k.id === t.okrKeyResultId))
    : null
  const meta = STATUS_META[(t.status as keyof typeof STATUS_META) ?? 'open']
  const prio = PRIORITY_META[t.priority]

  return (
    <article className="cursor-pointer rounded-md border border-neutral-200 bg-white p-2.5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span
          className={[
            'shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase',
            prio.bg,
            prio.text,
          ].join(' ')}
        >
          {prio.label}
        </span>
        <div className="flex items-center gap-1">
          {t.recurrenceActive && (
            <span className="inline-flex items-center gap-0.5 rounded bg-[#e7efe9] px-1 py-0.5 text-[9px] font-bold text-[#1a3d32]">
              <Repeat className="h-2.5 w-2.5" />
              Rutine
            </span>
          )}
          <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
            {t.templateKind ?? 'oppgave'}
          </span>
        </div>
      </div>
      <h4 className="mt-2 text-[12.5px] font-semibold leading-snug text-neutral-900">
        {t.title}
      </h4>
      {okrObj && (
        <div className="mt-2 inline-flex items-center gap-1 rounded bg-[#e7efe9]/60 px-1.5 py-0.5 text-[9.5px] font-semibold text-[#1a3d32]">
          <Target className="h-2.5 w-2.5" />
          {okrObj.ordLabel}
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-neutral-500">
        <div className="inline-flex items-center gap-1">
          <Initials name={t.ownerName ?? '—'} size={16} />
          <span>{(t.ownerName ?? '').split(' ')[0] || '—'}</span>
        </div>
        <span className="tabular-nums">{fmtDateShort(t.dueDate)}</span>
      </div>
      {t.recurrenceActive && t.recurrenceIntervalDays && (
        <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-500">
          <span>
            Gjentas hver {t.recurrenceIntervalDays} dag{t.recurrenceIntervalDays === 1 ? '' : 'er'}
          </span>
          {/* eslint-disable-next-line no-restricted-syntax */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void tasksCtrl.stopRecurrence(t.id)
            }}
            title="Stopp serien"
            className="rounded p-0.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
          >
            <Pause className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="mt-1.5 inline-flex w-full items-center gap-1.5">
        <span
          className={[
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold',
            meta?.bg ?? 'bg-neutral-100',
            meta?.text ?? 'text-neutral-700',
          ].join(' ')}
        >
          <meta.icon className="h-2.5 w-2.5" />
          {meta?.label ?? t.status}
        </span>
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// List view
// ─────────────────────────────────────────────────────────────────────────────

function ListView({
  tasks,
  plan,
  tasksCtrl,
}: {
  tasks: PlanningTaskRow[]
  plan: OkrPlanFull | null
  tasksCtrl: UsePlanningTasksReturn
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-neutral-50/60">
          <tr>
            <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Oppgave
            </th>
            <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Type
            </th>
            <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              OKR
            </th>
            <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Eier
            </th>
            <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Frist
            </th>
            <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Rutine
            </th>
            <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Status
            </th>
            <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Prioritet
            </th>
            <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-neutral-500" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const okrObj = plan && t.okrKeyResultId
              ? plan.objectives.find((o) => o.keyResults.some((k) => k.id === t.okrKeyResultId))
              : null
            const meta = STATUS_META[(t.status as keyof typeof STATUS_META) ?? 'open']
            const prio = PRIORITY_META[t.priority]
            const Icon = meta.icon
            return (
              <tr key={t.id} className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50/40">
                <td className="px-5 py-3">
                  <div className="font-medium text-neutral-900">{t.title}</div>
                  <div className="text-[10px] text-neutral-500">{t.id.slice(0, 8)}</div>
                </td>
                <td className="px-5 py-3">
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                    {t.recurrenceActive ? 'rutine' : t.templateKind ?? 'oppgave'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {okrObj ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-bold text-[#1a3d32]">
                      <Target className="h-2.5 w-2.5" />
                      {okrObj.ordLabel}
                    </span>
                  ) : (
                    <span className="text-[10px] italic text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <Initials name={t.ownerName ?? '—'} size={18} />
                    <span className="text-[11px] text-neutral-700">{t.ownerName ?? '—'}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-[11px] tabular-nums text-neutral-600">
                  {fmtDateShort(t.dueDate)}
                </td>
                <td className="px-5 py-3">
                  <RecurrenceCell t={t} tasksCtrl={tasksCtrl} />
                </td>
                <td className="px-5 py-3">
                  <span
                    className={[
                      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                      meta.bg,
                      meta.text,
                    ].join(' ')}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {meta.label}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span
                    className={[
                      'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                      prio.bg,
                      prio.text,
                    ].join(' ')}
                  >
                    {prio.label}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  <button
                    type="button"
                    onClick={() => {
                      const next: TaskItemStatus = t.status === 'closed' ? 'open' : 'closed'
                      void tasksCtrl.updateTaskStatus(t.id, next)
                    }}
                    className="rounded px-2 py-1 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-100"
                  >
                    {t.status === 'closed' ? 'Gjenåpne' : 'Lukk'}
                  </button>
                </td>
              </tr>
            )
          })}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={9} className="px-5 py-8 text-center text-[12px] italic text-neutral-500">
                Ingen oppgaver matcher filteret.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function RecurrenceCell({
  t,
  tasksCtrl,
}: {
  t: PlanningTaskRow
  tasksCtrl: UsePlanningTasksReturn
}) {
  const [editing, setEditing] = useState(false)
  const [intervalDays, setIntervalDays] = useState<number>(t.recurrenceIntervalDays ?? 30)
  const [stopAt, setStopAt] = useState<string>(t.recurrenceStopAt ?? '')
  const [preset, setPreset] = useState<RecurrencePresetId>(presetForDays(t.recurrenceIntervalDays))

  if (!t.recurrenceActive && !t.recurrenceIntervalDays) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setEditing((v) => !v)}
        className="inline-flex items-center gap-1 rounded border border-dashed border-neutral-300 px-2 py-1 text-[10px] font-normal normal-case text-neutral-500 hover:border-[#1a3d32] hover:bg-[#e7efe9]/50 hover:text-[#1a3d32]"
      >
        <Repeat className="h-3 w-3" />
        {editing ? 'Avbryt' : 'Sett rutine'}
        {editing && (
          <RecurrenceEditor
            preset={preset}
            setPreset={setPreset}
            intervalDays={intervalDays}
            setIntervalDays={setIntervalDays}
            stopAt={stopAt}
            setStopAt={setStopAt}
            onApply={() => {
              void tasksCtrl.setRecurrence(t.id, intervalDays, stopAt || null)
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        )}
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2 text-[11px]">
      {t.recurrenceActive ? (
        <>
          <span className="inline-flex items-center gap-1 rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-bold text-[#1a3d32]">
            <Repeat className="h-2.5 w-2.5" />
            {t.recurrenceIntervalDays} d
          </span>
          {t.recurrenceStopAt && (
            <span className="text-[10px] text-neutral-500">
              stopper {fmtDateShort(t.recurrenceStopAt)}
            </span>
          )}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            title="Endre intervall"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          {/* eslint-disable-next-line no-restricted-syntax */}
          <button
            type="button"
            onClick={() => void tasksCtrl.stopRecurrence(t.id)}
            className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-700"
            title="Stopp serien"
          >
            <Pause className="h-3 w-3" />
          </button>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
            <AlertCircle className="h-2.5 w-2.5" />
            Stoppet
          </span>
          {/* eslint-disable-next-line no-restricted-syntax */}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded p-1 text-neutral-400 hover:bg-[#e7efe9]/50 hover:text-[#1a3d32]"
            title="Reaktiver rutine"
          >
            <Play className="h-3 w-3" />
          </button>
        </>
      )}
      {editing && (
        <RecurrenceEditor
          preset={preset}
          setPreset={setPreset}
          intervalDays={intervalDays}
          setIntervalDays={setIntervalDays}
          stopAt={stopAt}
          setStopAt={setStopAt}
          onApply={() => {
            void tasksCtrl.setRecurrence(t.id, intervalDays, stopAt || null)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  )
}

function RecurrenceEditor({
  preset,
  setPreset,
  intervalDays,
  setIntervalDays,
  stopAt,
  setStopAt,
  onApply,
  onCancel,
}: {
  preset: RecurrencePresetId
  setPreset: (v: RecurrencePresetId) => void
  intervalDays: number
  setIntervalDays: (v: number) => void
  stopAt: string
  setStopAt: (v: string) => void
  onApply: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="absolute z-10 mt-1 flex flex-col gap-1.5 rounded-md border border-neutral-200 bg-white p-2 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
        Frekvens
      </label>
      {/* eslint-disable-next-line no-restricted-syntax */}
      <select
        value={preset}
        onChange={(e) => {
          const v = e.target.value as RecurrencePresetId
          setPreset(v)
          const def = RECURRENCE_PRESETS.find((p) => p.id === v)
          if (def?.days != null) setIntervalDays(def.days)
        }}
        className="rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-[#1a3d32]"
      >
        {RECURRENCE_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {preset === 'custom' && (
        <StandardInput
          type="number"
          min={1}
          value={intervalDays}
          onChange={(e) => setIntervalDays(Math.max(1, Number(e.target.value) || 1))}
          placeholder="Dager mellom forekomster"
          className="px-2 py-1 text-[11px] tabular-nums"
        />
      )}
      <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
        Slutt-dato (valgfri)
      </label>
      {/* eslint-disable-next-line no-restricted-syntax */}
      <input
        type="date"
        value={stopAt}
        onChange={(e) => setStopAt(e.target.value)}
        className="rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] tabular-nums outline-none focus:border-[#1a3d32]"
      />
      <div className="flex gap-1">
        {/* eslint-disable-next-line no-restricted-syntax */}
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-neutral-200 px-2 py-1 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-50"
        >
          Avbryt
        </button>
        {/* eslint-disable-next-line no-restricted-syntax */}
        <button
          type="button"
          onClick={onApply}
          className="flex-1 rounded bg-[#1a3d32] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#14312a]"
        >
          Bekreft
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline view
// ─────────────────────────────────────────────────────────────────────────────

function TimelineView({
  tasks,
  plan,
}: {
  tasks: PlanningTaskRow[]
  plan: OkrPlanFull | null
}) {
  const year = new Date().getFullYear()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']

  const today = useMemo(() => {
    const now = new Date()
    if (now.getFullYear() !== year) {
      return now.getFullYear() < year ? 0 : 12
    }
    return now.getMonth() + (now.getDate() - 1) / 30
  }, [year])

  const sliceFraction = (s: string | null | undefined) => {
    if (!s) return 0
    try {
      const d = new Date(s)
      if (d.getFullYear() < year) return 0
      if (d.getFullYear() > year) return 12
      return d.getMonth() + (d.getDate() - 1) / 30
    } catch {
      return 0
    }
  }

  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    [tasks],
  )

  return (
    <div className="overflow-x-auto p-5">
      <div className="min-w-[900px]">
        <div className="ml-[240px] grid grid-cols-12 border-b border-neutral-200 pb-1.5">
          {months.map((m) => (
            <div
              key={m}
              className="text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500"
            >
              {m}
            </div>
          ))}
        </div>
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-[12px] italic text-neutral-500">
            Ingen oppgaver med dato å vise.
          </p>
        ) : (
          sorted.map((t) => {
            const start = t.createdAt ? sliceFraction(t.createdAt) : 0
            const end = sliceFraction(t.dueDate ?? t.createdAt)
            const left = (Math.max(0, Math.min(12, start)) / 12) * 100
            const right = (Math.max(0, Math.min(12, end)) / 12) * 100
            const width = Math.max(2, right - left)
            const okrObj = plan && t.okrKeyResultId
              ? plan.objectives.find((o) => o.keyResults.some((k) => k.id === t.okrKeyResultId))
              : null
            const color =
              t.status === 'closed' ? '#2f7757' : t.status === 'cancelled' ? '#b3382a' : '#1a3d32'
            return (
              <div
                key={t.id}
                className="relative grid grid-cols-1 items-center border-b border-neutral-100 py-1.5 md:grid-cols-[240px_minmax(0,1fr)]"
              >
                <div className="flex items-center gap-2 pr-3">
                  {okrObj && (
                    <span className="rounded bg-[#e7efe9] px-1 py-0.5 text-[9px] font-bold text-[#1a3d32]">
                      {okrObj.ordLabel}
                    </span>
                  )}
                  {t.recurrenceActive && <Repeat className="h-3 w-3 text-[#1a3d32]" />}
                  <span className="truncate text-[12px] font-medium text-neutral-900">
                    {t.title}
                  </span>
                </div>
                <div className="relative h-6">
                  <span
                    className="absolute top-0 z-10 h-full w-px bg-[#b3382a]/70"
                    style={{ left: `${(today / 12) * 100}%` }}
                  />
                  <span
                    className="absolute top-1 h-4 rounded-md shadow-sm"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: color + '20',
                      border: `1px solid ${color}80`,
                    }}
                  >
                    <span
                      className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold"
                      style={{ color }}
                    >
                      {fmtDateShort(t.dueDate)}
                    </span>
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects view
// ─────────────────────────────────────────────────────────────────────────────

function ProjectsView({
  projects,
  tasks,
  plan,
  onCreateProject,
}: {
  projects: TaskProject[]
  tasks: PlanningTaskRow[]
  plan: OkrPlanFull | null
  onCreateProject: () => void
}) {
  const activeProjects = projects.filter((p) => p.status === 'active')
  if (activeProjects.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <FolderKanban className="mx-auto h-8 w-8 text-neutral-300" />
        <p className="mt-3 text-sm text-neutral-700">
          Ingen aktive prosjekter ennå.
        </p>
        <p className="mt-1 text-[12px] text-neutral-500">
          Prosjekter samler relaterte oppgaver under en felles paraply — eks. «Ny HMS-onboarding»,
          «Sykefravær-program», «Gap-lukking IK 2026».
        </p>
        <div className="mt-4">
          <Button
            variant="primary"
            size="sm"
            onClick={onCreateProject}
            icon={<Plus className="h-3 w-3" />}
          >
            Nytt prosjekt
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 p-5 lg:grid-cols-2">
      {activeProjects.map((p) => {
        const linkedTasks = tasks.filter((t) => t.projectId === p.id)
        const completed = linkedTasks.filter((t) => t.status === 'closed').length
        const progress = linkedTasks.length === 0 ? 0 : completed / linkedTasks.length
        const okr =
          plan && p.lawRefs.length > 0
            ? plan.objectives.find((o) =>
                o.lawRef ? p.lawRefs.some((r) => o.lawRef?.includes(r)) : false,
              )
            : null
        const tone =
          p.methodology === 'pdca'
            ? '#1a3d32'
            : p.methodology === 'kanban'
              ? '#c98a2b'
              : '#2f7757'
        return (
          <article
            key={p.id}
            className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-[#1a3d32]/40"
          >
            <div className="h-1.5" style={{ background: tone }} />
            <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {okr && (
                    <span className="rounded bg-[#1a3d32] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
                      {okr.ordLabel}
                    </span>
                  )}
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-600">
                    {p.methodology}
                  </span>
                  <span className="text-[10px] tabular-nums text-neutral-500">
                    Frist {fmtDateShort(p.endDate ?? null)}
                  </span>
                </div>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: tone }}>
                  {Math.round(progress * 100)}%
                </span>
              </div>
              <h4 className="mt-2 font-serif text-base font-bold text-neutral-900">{p.title}</h4>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-[12px] text-neutral-600">{p.description}</p>
              )}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full"
                  style={{ width: `${progress * 100}%`, background: tone }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-700">
                  <CalendarRange className="h-3 w-3 text-neutral-500" />
                  <span>
                    {fmtDateShort(p.startDate ?? null)} → {fmtDateShort(p.endDate ?? null)}
                  </span>
                </div>
                <span className="text-[10px] tabular-nums text-neutral-500">
                  {linkedTasks.length} oppgave{linkedTasks.length === 1 ? '' : 'r'}
                </span>
              </div>
              {linkedTasks.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-neutral-100 pt-2">
                  {linkedTasks.slice(0, 5).map((t) => {
                    const meta = STATUS_META[(t.status as keyof typeof STATUS_META) ?? 'open']
                    const Icon = meta.icon
                    return (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="flex items-center gap-1.5">
                          <Icon className="h-2.5 w-2.5 text-neutral-400" />
                          <span className="truncate text-neutral-800">{t.title}</span>
                        </span>
                        <span className="tabular-nums text-[10px] text-neutral-500">
                          {fmtDateShort(t.dueDate)}
                        </span>
                      </li>
                    )
                  })}
                  {linkedTasks.length > 5 && (
                    <li className="text-[10px] italic text-neutral-500">
                      + {linkedTasks.length - 5} flere
                    </li>
                  )}
                </ul>
              )}
              {linkedTasks.length === 0 && (
                <p className="mt-2 inline-flex items-center gap-1 text-[10px] italic text-neutral-500">
                  <ListTodo className="h-2.5 w-2.5" />
                  Ingen oppgaver i prosjektet ennå.
                </p>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
