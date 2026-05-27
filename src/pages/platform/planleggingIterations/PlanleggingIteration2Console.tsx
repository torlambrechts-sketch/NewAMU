// Iteration 2 — "Command Console".
//
// Dense operations dashboard. Hub menu with badge counts, KPI strip with
// trend deltas, table-first workspace via WorkplaceStandardListLayout
// (toolbar with search + filters + view-mode switch + primary CTA).
// Tone: ops-room. Heads-down work where status is information-dense.

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  KanbanSquare,
  ListChecks,
  Pause,
  Plus,
  Repeat,
  Target,
  Wand2,
} from 'lucide-react'
import type { HubMenu1Item } from '../../../components/layout/HubMenu1Bar'
import {
  WorkplaceStandardListLayout,
  type WorkplaceListViewMode,
} from '../../../components/layout/WorkplaceStandardListLayout'
import { Button } from '../../../components/ui/Button'
import {
  CADENCE_CATEGORY_META,
  FIXTURE_CADENCES,
  FIXTURE_HEALTH,
  FIXTURE_OBJECTIVES,
  FIXTURE_TASKS,
  PRIORITY_META,
  STATUS_META,
  computeFixtureSummary,
} from './planleggingIterationsData'

const ITERATION_CREAM = '#F9F7F2'

type ConsoleSection = 'strategi' | 'kadens' | 'oversikt'

export function PlanleggingIteration2Console() {
  const [section, setSection] = useState<ConsoleSection>('oversikt')
  const [viewMode, setViewMode] = useState<WorkplaceListViewMode>('table')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sort, setSort] = useState('due')

  const summary = useMemo(() => computeFixtureSummary(), [])

  const hubItems: HubMenu1Item[] = [
    {
      key: 'strategi',
      label: 'Strategi & OKR',
      icon: Target,
      active: section === 'strategi',
      onClick: () => setSection('strategi'),
      badgeCount: summary.objectiveTotal,
    },
    {
      key: 'kadens',
      label: 'Kadens',
      icon: Wand2,
      active: section === 'kadens',
      onClick: () => setSection('kadens'),
      badgeCount: summary.activeCadences,
    },
    {
      key: 'oversikt',
      label: 'Oppgaver',
      icon: KanbanSquare,
      active: section === 'oversikt',
      onClick: () => setSection('oversikt'),
      badgeCount: summary.openTasks,
      badgeVariant: summary.overdueTasks > 0 ? 'danger' : 'default',
    },
  ]

  const owners = useMemo(
    () => Array.from(new Set(FIXTURE_TASKS.map((t) => t.owner))).sort((a, b) => a.localeCompare(b, 'nb')),
    [],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = FIXTURE_TASKS.filter((t) => {
      if (ownerFilter !== 'all' && t.owner !== ownerFilter) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q)
        || t.owner.toLowerCase().includes(q)
        || (t.lawRef ?? '').toLowerCase().includes(q)
      )
    })
    list = [...list].sort((a, b) => {
      if (sort === 'priority') {
        const order = { kritisk: 0, 'høy': 1, middels: 2, lav: 3 }
        return order[a.priority] - order[b.priority]
      }
      if (sort === 'owner') return a.owner.localeCompare(b.owner, 'nb')
      return a.daysToDue - b.daysToDue
    })
    return list
  }, [search, ownerFilter, statusFilter, sort])

  const activeFilters = (ownerFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)

  return (
    <div className="rounded-2xl border border-white/10 p-6 md:p-8" style={{ backgroundColor: ITERATION_CREAM }}>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ConsoleKpi
          label="Åpne oppgaver"
          value={summary.openTasks}
          icon={ListChecks}
          delta={{ dir: 'up', value: '+4 vs forrige uke', tone: 'warn' }}
        />
        <ConsoleKpi
          label="Forfalt"
          value={summary.overdueTasks}
          icon={AlertTriangle}
          tone="danger"
          delta={{ dir: 'up', value: '+1 siste 24t', tone: 'danger' }}
        />
        <ConsoleKpi
          label="Aktive rutiner"
          value={summary.activeCadences}
          icon={Repeat}
          delta={{ dir: 'flat', value: 'Uendret denne mnd', tone: 'neutral' }}
        />
        <ConsoleKpi
          label="OKR på spor"
          value={`${summary.objectivesOnTrack}/${summary.objectiveTotal}`}
          icon={Target}
          delta={{ dir: 'down', value: '−1 vs forrige uke', tone: 'warn' }}
        />
      </div>

      <WorkplaceStandardListLayout
        breadcrumb={[
          { label: 'Plattformadmin', to: '/platform-admin' },
          { label: 'Planlegging-iterasjoner', to: '/platform-admin/planlegging-iterations' },
          { label: '02 · Command Console' },
        ]}
        title="Planlegging — operativ"
        description="Toppstrøk for HMS-ledelsen. Hver rad er en handling som flytter målene. Dypdykk via raden."
        hubAriaLabel="Planlegging — seksjoner"
        hubItems={hubItems}
        headerActions={
          <>
            <Button variant="secondary" icon={<CalendarRange className="h-4 w-4" />}>Eksporter uka</Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>Ny oppgave</Button>
          </>
        }
        toolbar={
          section === 'oversikt'
            ? {
                count: { value: filtered.length, label: 'oppgaver i visning' },
                searchPlaceholder: 'Søk i tittel, eier eller §-referanse…',
                searchValue: search,
                onSearchChange: setSearch,
                filtersOpen,
                onFiltersOpenChange: setFiltersOpen,
                filterStatusText:
                  activeFilters === 0
                    ? 'Ingen filter aktive'
                    : `${activeFilters} filter aktiv${activeFilters === 1 ? '' : 'e'}`,
                filterPanel: (
                  <div className="flex flex-wrap items-end gap-4">
                    <FilterSelect
                      label="Status"
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={[
                        { value: 'all', label: 'Alle statuser' },
                        ...Object.entries(STATUS_META).map(([id, m]) => ({ value: id, label: m.label })),
                      ]}
                    />
                    <FilterSelect
                      label="Eier"
                      value={ownerFilter}
                      onChange={setOwnerFilter}
                      options={[
                        { value: 'all', label: 'Alle eiere' },
                        ...owners.map((o) => ({ value: o, label: o })),
                      ]}
                    />
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setOwnerFilter('all')
                        setStatusFilter('all')
                      }}
                      className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700"
                    >
                      Nullstill
                    </Button>
                  </div>
                ),
                sortOptions: [
                  { value: 'due', label: 'Frist (først)' },
                  { value: 'priority', label: 'Prioritet (kritisk først)' },
                  { value: 'owner', label: 'Eier (A–Å)' },
                ],
                sortValue: sort,
                onSortChange: setSort,
                viewMode,
                onViewModeChange: setViewMode,
                primaryAction: {
                  label: 'Ny oppgave',
                  onClick: () => undefined,
                },
                showSettingsButton: true,
                onSettingsClick: () => undefined,
              }
            : undefined
        }
      >
        {section === 'oversikt' ? <ConsoleTasks view={viewMode} rows={filtered} /> : null}
        {section === 'strategi' ? <ConsoleStrategi /> : null}
        {section === 'kadens' ? <ConsoleKadens /> : null}
      </WorkplaceStandardListLayout>
    </div>
  )
}

function ConsoleKpi({
  label,
  value,
  icon: Icon,
  delta,
  tone = 'default',
}: {
  label: string
  value: number | string
  icon: typeof ListChecks
  delta?: { dir: 'up' | 'down' | 'flat'; value: string; tone: 'warn' | 'danger' | 'good' | 'neutral' }
  tone?: 'default' | 'danger'
}) {
  const Arrow = delta?.dir === 'up' ? ArrowUpRight : delta?.dir === 'down' ? ArrowDownRight : null
  const deltaClass =
    delta?.tone === 'danger'
      ? 'text-red-700'
      : delta?.tone === 'warn'
        ? 'text-amber-800'
        : delta?.tone === 'good'
          ? 'text-emerald-700'
          : 'text-neutral-500'
  return (
    <div
      className={`rounded-xl border bg-white p-4 ${tone === 'danger' ? 'border-red-200' : 'border-neutral-200/80'}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-neutral-500">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
      </div>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${tone === 'danger' ? 'text-red-700' : 'text-neutral-900'}`}>
        {value}
      </p>
      {delta ? (
        <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${deltaClass}`}>
          {Arrow ? <Arrow className="h-3.5 w-3.5" /> : <span className="h-3 w-3 rounded-full bg-neutral-300" />}
          {delta.value}
        </p>
      ) : null}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 block min-w-[160px] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ConsoleTasks({ view, rows }: { view: WorkplaceListViewMode; rows: typeof FIXTURE_TASKS }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-neutral-500">Ingen treff.</p>
  }

  if (view === 'table') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              <th className="py-3 pr-4">Oppgave</th>
              <th className="py-3 pr-4">Eier</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Prioritet</th>
              <th className="py-3 pr-4">Forfall</th>
              <th className="py-3 pr-4">OKR</th>
              <th className="w-10 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = STATUS_META[row.status]
              const priority = PRIORITY_META[row.priority]
              const overdue = row.daysToDue < 0 && row.status !== 'fullført'
              const StatusIcon = status.icon
              return (
                <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50/80">
                  <td className="py-3 pr-4">
                    <div className="flex items-start gap-2">
                      {row.recurring ? (
                        <Repeat className="mt-1 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      ) : null}
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">{row.title}</p>
                        {row.lawRef ? (
                          <p className="mt-0.5 text-[11px] font-mono text-neutral-500">{row.lawRef}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-700">
                        {row.ownerInit}
                      </span>
                      <span className="text-neutral-700">{row.owner}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${status.chip}`}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${priority.chip}`}>
                      {priority.label}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="font-mono text-xs tabular-nums text-neutral-700">{row.due}</p>
                    {overdue ? (
                      <p className="text-[10px] font-bold uppercase tracking-wide text-red-700">
                        {Math.abs(row.daysToDue)} d for sent
                      </p>
                    ) : (
                      <p className="text-[10px] text-neutral-500">om {row.daysToDue} d</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-neutral-600">{row.okr ?? '—'}</td>
                  <td className="py-3 text-right">
                    <Button variant="ghost" size="sm">Åpne</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  if (view === 'box') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const status = STATUS_META[row.status]
          const priority = PRIORITY_META[row.priority]
          const overdue = row.daysToDue < 0 && row.status !== 'fullført'
          return (
            <article
              key={row.id}
              className="rounded-xl border border-neutral-200/80 bg-white p-4"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${status.chip}`}>
                  {status.label}
                </span>
                <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${priority.chip}`}>
                  {priority.label}
                </span>
              </div>
              <p className="mt-3 text-[14.5px] font-semibold leading-snug text-neutral-900">{row.title}</p>
              {row.lawRef ? <p className="mt-1 text-[11px] font-mono text-neutral-500">{row.lawRef}</p> : null}
              <div className="mt-4 flex items-center justify-between text-xs text-neutral-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-700">
                    {row.ownerInit}
                  </span>
                  {row.owner}
                </span>
                <span className={`font-mono tabular-nums ${overdue ? 'text-red-700 font-bold' : ''}`}>{row.due}</span>
              </div>
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <ul className="divide-y divide-neutral-100">
      {rows.map((row) => {
        const status = STATUS_META[row.status]
        const priority = PRIORITY_META[row.priority]
        return (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
            <div className="min-w-0">
              <p className="font-medium text-neutral-900">{row.title}</p>
              <p className="text-xs text-neutral-500">{row.owner} · {row.lawRef ?? '—'}</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${status.chip}`}>{status.label}</span>
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${priority.chip}`}>{priority.label}</span>
              <span className="font-mono tabular-nums text-neutral-700">{row.due}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ConsoleStrategi() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
            <th className="py-3 pr-4">Mål</th>
            <th className="py-3 pr-4">Eier</th>
            <th className="py-3 pr-4">Horisont</th>
            <th className="py-3 pr-4">KR</th>
            <th className="py-3 pr-4">Helse</th>
            <th className="w-10 py-3" />
          </tr>
        </thead>
        <tbody>
          {FIXTURE_OBJECTIVES.map((obj) => {
            const health = FIXTURE_HEALTH[obj.health]
            return (
              <tr key={obj.id} className="border-b border-neutral-100 hover:bg-neutral-50/80">
                <td className="py-3 pr-4">
                  <p className="font-medium leading-snug text-neutral-900">{obj.title}</p>
                  <p className="mt-1 text-xs text-neutral-500 line-clamp-2">{obj.description}</p>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-700">
                      {obj.ownerInit}
                    </span>
                    <span className="text-neutral-700">{obj.owner}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 font-mono text-xs tabular-nums text-neutral-700">{obj.horizon}</td>
                <td className="py-3 pr-4 tabular-nums">{obj.keyResults.length}</td>
                <td className="py-3 pr-4">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: health.soft, color: health.text }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: health.dot }} />
                    {health.label}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <Button variant="ghost" size="sm">Åpne</Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ConsoleKadens() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
            <th className="py-3 pr-4">Rutine</th>
            <th className="py-3 pr-4">Kategori</th>
            <th className="py-3 pr-4">Frekvens</th>
            <th className="py-3 pr-4">§-grunnlag</th>
            <th className="py-3 pr-4">Eier</th>
            <th className="py-3 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {FIXTURE_CADENCES.map((c) => {
            const meta = CADENCE_CATEGORY_META[c.category]
            return (
              <tr key={c.id} className="border-b border-neutral-100 hover:bg-neutral-50/80">
                <td className="py-3 pr-4 font-medium text-neutral-900">{c.title}</td>
                <td className="py-3 pr-4">
                  <span
                    className="inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </td>
                <td className="py-3 pr-4 text-xs text-neutral-700 capitalize">{c.freq}</td>
                <td className="py-3 pr-4 font-mono text-[11px] text-neutral-700">{c.lawRefs.join(', ')}</td>
                <td className="py-3 pr-4 text-xs text-neutral-700">{c.owner}</td>
                <td className="py-3 pr-4">
                  {c.enabled ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                      Aktiv
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                      <Pause className="h-3 w-3" /> Ikke aktiv
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
