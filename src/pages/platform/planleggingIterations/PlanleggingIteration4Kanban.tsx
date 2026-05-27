// Iteration 4 — "Kanban Studio".
//
// Board-first execution view. Hub menu picks the lens (status, eier,
// OKR). KPI strip is reduced to a sticky-feeling pulse bar. The body is
// a wide horizontal Kanban; cards carry just enough metadata to act:
// title, eier, frist, §-grunnlag, prioritet, OKR-tag.
//
// Built on WorkplaceStandardListLayout — we hide the toolbar's view-mode
// switch because the board IS the view; the toolbar gives us a place to
// hang search + filters + the primary CTA in a familiar position.

import { useMemo, useState } from 'react'
import {
  CalendarRange,
  Filter as FilterIcon,
  KanbanSquare,
  ListChecks,
  Plus,
  Repeat,
  Search,
  Target,
} from 'lucide-react'
import type { HubMenu1Item } from '../../../components/layout/HubMenu1Bar'
import { HubMenu1Bar } from '../../../components/layout/HubMenu1Bar'
import { WorkplacePageHeading1 } from '../../../components/layout/WorkplacePageHeading1'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import {
  FIXTURE_TASKS,
  PRIORITY_META,
  STATUS_META,
  computeFixtureSummary,
  type FixtureStatus,
} from './planleggingIterationsData'

const KANBAN_CANVAS = '#F5F1E6'
const KANBAN_COL_BG = '#FFFDF7'

const COLUMNS: FixtureStatus[] = ['backlog', 'planlagt', 'pågår', 'gjennomgang', 'fullført']

type LensId = 'status' | 'okr' | 'eier'

export function PlanleggingIteration4Kanban() {
  const summary = useMemo(() => computeFixtureSummary(), [])
  const [lens, setLens] = useState<LensId>('status')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  const tasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    return FIXTURE_TASKS.filter((t) => {
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      if (!q) return true
      return t.title.toLowerCase().includes(q) || t.owner.toLowerCase().includes(q)
    })
  }, [search, priorityFilter])

  const hubItems: HubMenu1Item[] = [
    {
      key: 'status',
      label: 'Status',
      icon: KanbanSquare,
      active: lens === 'status',
      onClick: () => setLens('status'),
    },
    {
      key: 'okr',
      label: 'Mål (OKR)',
      icon: Target,
      active: lens === 'okr',
      onClick: () => setLens('okr'),
    },
    {
      key: 'eier',
      label: 'Eier',
      icon: ListChecks,
      active: lens === 'eier',
      onClick: () => setLens('eier'),
    },
  ]

  return (
    <div className="rounded-2xl border border-white/10 p-6 md:p-8" style={{ backgroundColor: KANBAN_CANVAS }}>
      <WorkplacePageHeading1
        breadcrumb={[
          { label: 'Plattformadmin', to: '/platform-admin' },
          { label: 'Planlegging-iterasjoner', to: '/platform-admin/planlegging-iterations' },
          { label: '04 · Kanban Studio' },
        ]}
        title="Arbeidstavle"
        description="Hele planen som ett bord. Bytt lens — etter status, mål eller eier — og la kortene snakke."
        headerActions={
          <>
            <Button variant="secondary" icon={<CalendarRange className="h-4 w-4" />}>Kalender</Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>Nytt kort</Button>
          </>
        }
      />

      {/* Pulse strip */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <PulseTile label="Backlog" value={tasks.filter((t) => t.status === 'backlog').length} color="#737373" />
        <PulseTile label="Planlagt" value={tasks.filter((t) => t.status === 'planlagt').length} color="#0284c7" />
        <PulseTile label="Pågår" value={tasks.filter((t) => t.status === 'pågår').length} color="#4f46e5" />
        <PulseTile label="Gjennomgang" value={tasks.filter((t) => t.status === 'gjennomgang').length} color="#c98a2b" />
        <PulseTile label="Fullført" value={tasks.filter((t) => t.status === 'fullført').length} color="#16A34A" />
      </div>

      <div className="mt-6">
        <HubMenu1Bar ariaLabel="Kanban — lens" items={hubItems} />
      </div>

      {/* Toolbar */}
      <div
        className="mt-5 flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-3 shadow-sm md:flex-row md:items-center"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <StandardInput
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk i tittel eller eier…"
            className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold uppercase tracking-wide text-neutral-500">
            <FilterIcon className="mr-1 inline h-3.5 w-3.5" />
            Prioritet
          </span>
          {(['all', 'kritisk', 'høy', 'middels', 'lav'] as const).map((p) => (
            <Button
              key={p}
              variant={priorityFilter === p ? 'primary' : 'ghost'}
              onClick={() => setPriorityFilter(p)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${
                priorityFilter === p
                  ? ''
                  : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {p === 'all' ? 'Alle' : p}
            </Button>
          ))}
        </div>
      </div>

      {/* Board */}
      {lens === 'status' ? <BoardByStatus tasks={tasks} /> : null}
      {lens === 'okr' ? <BoardByOkr tasks={tasks} /> : null}
      {lens === 'eier' ? <BoardByOwner tasks={tasks} /> : null}

      <p className="mt-6 text-xs text-neutral-500">
        {summary.recurringTasks} kort er knyttet til vedvarende rutiner ·{' '}
        <Repeat className="inline h-3 w-3" /> indikerer kadens-oppgave
      </p>
    </div>
  )
}

function PulseTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white px-4 py-3"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{value}</p>
      </div>
      <span className="h-9 w-1.5 rounded-full" style={{ backgroundColor: color }} />
    </div>
  )
}

function BoardByStatus({ tasks }: { tasks: typeof FIXTURE_TASKS }) {
  return (
    <div className="mt-6 overflow-x-auto pb-2">
      <div className="grid min-w-[1100px] grid-cols-5 gap-4">
        {COLUMNS.map((s) => {
          const meta = STATUS_META[s]
          const rows = tasks.filter((t) => t.status === s)
          const Icon = meta.icon
          return (
            <div
              key={s}
              className="flex min-h-[360px] flex-col rounded-xl border border-neutral-200/80 p-3"
              style={{ backgroundColor: KANBAN_COL_BG }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                </span>
                <span className="font-mono text-xs font-bold tabular-nums text-neutral-500">{rows.length}</span>
              </div>
              <div className="space-y-2.5">
                {rows.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
                {rows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-neutral-200 bg-white/60 px-3 py-6 text-center text-xs text-neutral-500">
                    Tomt
                  </p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BoardByOkr({ tasks }: { tasks: typeof FIXTURE_TASKS }) {
  const okrs = Array.from(new Set(tasks.map((t) => t.okr ?? 'Uten mål')))
  return (
    <div className="mt-6 overflow-x-auto pb-2">
      <div className="grid min-w-[900px] gap-4" style={{ gridTemplateColumns: `repeat(${okrs.length}, minmax(220px, 1fr))` }}>
        {okrs.map((okr) => {
          const rows = tasks.filter((t) => (t.okr ?? 'Uten mål') === okr)
          return (
            <div
              key={okr}
              className="flex min-h-[360px] flex-col rounded-xl border border-neutral-200/80 p-3"
              style={{ backgroundColor: KANBAN_COL_BG }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1a3d32]">
                  <Target className="h-3.5 w-3.5" />
                  {okr}
                </span>
                <span className="font-mono text-xs font-bold tabular-nums text-neutral-500">{rows.length}</span>
              </div>
              <div className="space-y-2.5">
                {rows.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BoardByOwner({ tasks }: { tasks: typeof FIXTURE_TASKS }) {
  const owners = Array.from(new Set(tasks.map((t) => t.owner))).sort((a, b) => a.localeCompare(b, 'nb'))
  return (
    <div className="mt-6 overflow-x-auto pb-2">
      <div className="grid min-w-[1100px] gap-4" style={{ gridTemplateColumns: `repeat(${owners.length}, minmax(240px, 1fr))` }}>
        {owners.map((owner) => {
          const rows = tasks.filter((t) => t.owner === owner)
          const init = rows[0]?.ownerInit ?? '?'
          return (
            <div
              key={owner}
              className="flex min-h-[360px] flex-col rounded-xl border border-neutral-200/80 p-3"
              style={{ backgroundColor: KANBAN_COL_BG }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-700">
                    {init}
                  </span>
                  <span className="text-xs font-semibold text-neutral-800">{owner}</span>
                </span>
                <span className="font-mono text-xs font-bold tabular-nums text-neutral-500">{rows.length}</span>
              </div>
              <div className="space-y-2.5">
                {rows.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskCard({ task }: { task: typeof FIXTURE_TASKS[number] }) {
  const priority = PRIORITY_META[task.priority]
  const overdue = task.daysToDue < 0 && task.status !== 'fullført'
  return (
    <article
      className={`rounded-lg border bg-white px-3 py-3 ${overdue ? 'border-red-200' : 'border-neutral-200'}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13.5px] font-medium leading-snug text-neutral-900">{task.title}</p>
        {task.recurring ? <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" /> : null}
      </div>
      {task.lawRef ? (
        <p className="mt-1 font-mono text-[10.5px] text-neutral-500">{task.lawRef}</p>
      ) : null}
      <div className="mt-2.5 flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-neutral-600">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-[9px] font-bold text-neutral-700">
            {task.ownerInit}
          </span>
          {task.owner.split(' ')[0]}
        </span>
        <span className={`font-mono tabular-nums ${overdue ? 'font-bold text-red-700' : 'text-neutral-600'}`}>
          {task.due}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${priority.chip}`}>
          {priority.label}
        </span>
        {task.okr ? (
          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
            {task.okr}
          </span>
        ) : null}
      </div>
    </article>
  )
}
