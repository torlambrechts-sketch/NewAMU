// Iteration 7 — "Power Grid".
//
// Spreadsheet density for ops-experts. Sticky first column, hover-edit
// affordances, inline progress bars, frozen header row, bulk-select
// chrome. Hub-meny toggles three grid lenses (mål, kadens, oppgaver).
// Quick filters live in a single top row to maximise grid area.
//
// Built on WorkplaceStandardListLayout — we keep the toolbar but the
// body trades cards for an editable-feeling data grid.

import { useMemo, useState } from 'react'
import {
  CheckSquare,
  Download,
  Grid3x3,
  ListChecks,
  Plus,
  RefreshCw,
  Square,
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
  FREQ_LABEL,
  PRIORITY_META,
  STATUS_META,
  computeFixtureSummary,
} from './planleggingIterationsData'

const GRID_CANVAS = '#F4EFE3'

type GridLens = 'okr' | 'kadens' | 'oppgaver'

export function PlanleggingIteration7PowerGrid() {
  const [lens, setLens] = useState<GridLens>('oppgaver')
  const [viewMode, setViewMode] = useState<WorkplaceListViewMode>('table')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const summary = useMemo(() => computeFixtureSummary(), [])

  const hubItems: HubMenu1Item[] = [
    {
      key: 'oppgaver',
      label: 'Oppgaver',
      icon: ListChecks,
      active: lens === 'oppgaver',
      onClick: () => {
        setLens('oppgaver')
        setSelected(new Set())
      },
      badgeCount: summary.openTasks,
      badgeVariant: summary.overdueTasks > 0 ? 'danger' : 'default',
    },
    {
      key: 'okr',
      label: 'Nøkkelresultater',
      icon: Target,
      active: lens === 'okr',
      onClick: () => {
        setLens('okr')
        setSelected(new Set())
      },
      badgeCount: summary.krTotal,
    },
    {
      key: 'kadens',
      label: 'Rutiner',
      icon: Wand2,
      active: lens === 'kadens',
      onClick: () => {
        setLens('kadens')
        setSelected(new Set())
      },
      badgeCount: summary.activeCadences,
    },
  ]

  const tasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    return FIXTURE_TASKS.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (!q) return true
      return t.title.toLowerCase().includes(q) || t.owner.toLowerCase().includes(q) || (t.lawRef ?? '').toLowerCase().includes(q)
    })
  }, [search, statusFilter])

  const toggleAll = (ids: string[]) => {
    setSelected((prev) => {
      if (ids.every((id) => prev.has(id))) return new Set()
      return new Set(ids)
    })
  }
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleIds =
    lens === 'oppgaver'
      ? tasks.map((t) => t.id)
      : lens === 'okr'
        ? FIXTURE_OBJECTIVES.flatMap((o) => o.keyResults.map((k) => k.id))
        : FIXTURE_CADENCES.map((c) => c.id)

  return (
    <div className="rounded-2xl border border-white/10 p-6 md:p-8" style={{ backgroundColor: GRID_CANVAS }}>
      <WorkplaceStandardListLayout
        breadcrumb={[
          { label: 'Plattformadmin', to: '/platform-admin' },
          { label: 'Planlegging-iterasjoner', to: '/platform-admin/planlegging-iterations' },
          { label: '07 · Power Grid' },
        ]}
        title="Planlegging — datagrid"
        description="For deg som tenker i rader og kolonner. Alle felter er klikkbare — endre eier, frist eller status direkte i cella."
        hubAriaLabel="Datagrid — lens"
        hubItems={hubItems}
        headerActions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />}>Eksporter CSV</Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>Ny rad</Button>
          </>
        }
        toolbar={{
          count: { value: visibleIds.length, label: lens === 'oppgaver' ? 'oppgaver' : lens === 'okr' ? 'nøkkelresultater' : 'rutiner' },
          searchPlaceholder: 'Søk i alle kolonner…',
          searchValue: search,
          onSearchChange: setSearch,
          filtersOpen,
          onFiltersOpenChange: setFiltersOpen,
          filterStatusText: statusFilter === 'all' ? 'Ingen filter' : '1 filter aktivt',
          filterPanel: (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                Status
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="mt-1.5 block min-w-[150px] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">Alle</option>
                  {Object.entries(STATUS_META).map(([id, m]) => (
                    <option key={id} value={id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="ghost"
                onClick={() => setStatusFilter('all')}
                className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700"
              >
                Nullstill
              </Button>
            </div>
          ),
          viewMode,
          onViewModeChange: setViewMode,
          primaryAction: { label: 'Ny rad', onClick: () => undefined },
          showSettingsButton: true,
          onSettingsClick: () => undefined,
        }}
      >
        {selected.size > 0 ? (
          <div
            className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#1a3d32] bg-[#1a3d32]/[0.06] px-4 py-2 text-sm"
          >
            <p className="font-semibold text-[#1a3d32]">
              {selected.size} rad{selected.size === 1 ? '' : 'er'} valgt
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                Sett ny eier
              </Button>
              <Button variant="ghost" size="sm">Endre frist</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Tøm valg
              </Button>
            </div>
          </div>
        ) : null}

        {lens === 'oppgaver' ? (
          <TasksGrid
            rows={tasks}
            selected={selected}
            onToggleAll={() => toggleAll(visibleIds)}
            onToggleOne={toggleOne}
          />
        ) : lens === 'okr' ? (
          <OkrGrid selected={selected} onToggleAll={() => toggleAll(visibleIds)} onToggleOne={toggleOne} />
        ) : (
          <CadenceGrid selected={selected} onToggleAll={() => toggleAll(visibleIds)} onToggleOne={toggleOne} />
        )}

        <footer className="mt-4 flex items-center justify-between text-[11px] text-neutral-500">
          <p>
            <Grid3x3 className="mr-1 inline h-3 w-3" />
            Sticky første kolonne · klikk celle for å redigere · ⌘+klikk for å multi-velge
          </p>
          <p>
            {visibleIds.length} av {lens === 'oppgaver' ? FIXTURE_TASKS.length : lens === 'okr' ? summary.krTotal : FIXTURE_CADENCES.length} rader
          </p>
        </footer>
      </WorkplaceStandardListLayout>
    </div>
  )
}

function HeaderCheckbox({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-checked={checked}
      role="checkbox"
      className="flex h-5 w-5 items-center justify-center rounded border border-neutral-300 bg-white hover:border-neutral-400"
    >
      {checked ? <CheckSquare className="h-4 w-4 text-[#1a3d32]" /> : <Square className="h-4 w-4 text-transparent" />}
    </button>
  )
}

function RowCheckbox({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-checked={checked}
      role="checkbox"
      className={`flex h-4 w-4 items-center justify-center rounded border ${
        checked ? 'border-[#1a3d32] bg-[#1a3d32]' : 'border-neutral-300 bg-white hover:border-neutral-400'
      }`}
    >
      {checked ? <CheckSquare className="h-3 w-3 text-white" /> : null}
    </button>
  )
}

const TH =
  'sticky top-0 z-10 border-b border-neutral-300 bg-neutral-100 px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-neutral-600'
const TD =
  'border-b border-neutral-100 px-3 py-2 align-middle text-[12.5px] text-neutral-800'
const TD_HOVER = 'cursor-cell hover:bg-amber-50/60 hover:ring-2 hover:ring-inset hover:ring-amber-200/80'

function TasksGrid({
  rows,
  selected,
  onToggleAll,
  onToggleOne,
}: {
  rows: typeof FIXTURE_TASKS
  selected: Set<string>
  onToggleAll: () => void
  onToggleOne: (id: string) => void
}) {
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id))
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full min-w-[980px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${TH} sticky left-0 z-20 w-10`}>
              <HeaderCheckbox checked={allChecked} onClick={onToggleAll} />
            </th>
            <th className={`${TH} sticky left-10 z-20 min-w-[260px] bg-neutral-100`}>Oppgave</th>
            <th className={TH}>Eier</th>
            <th className={TH}>Status</th>
            <th className={TH}>Prioritet</th>
            <th className={TH}>Forfall</th>
            <th className={TH}>OKR</th>
            <th className={TH}>§-grunnlag</th>
            <th className={TH}>Kadens</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const status = STATUS_META[row.status]
            const priority = PRIORITY_META[row.priority]
            const overdue = row.daysToDue < 0 && row.status !== 'fullført'
            const isSel = selected.has(row.id)
            return (
              <tr key={row.id} className={isSel ? 'bg-amber-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'}>
                <td className={`${TD} sticky left-0 z-10 w-10 ${isSel ? 'bg-amber-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'}`}>
                  <RowCheckbox checked={isSel} onClick={() => onToggleOne(row.id)} />
                </td>
                <td
                  className={`${TD} sticky left-10 z-10 min-w-[260px] font-medium text-neutral-900 ${TD_HOVER} ${
                    isSel ? 'bg-amber-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'
                  }`}
                >
                  {row.title}
                </td>
                <td className={`${TD} ${TD_HOVER}`}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-[9px] font-bold text-neutral-700">
                      {row.ownerInit}
                    </span>
                    {row.owner}
                  </span>
                </td>
                <td className={`${TD} ${TD_HOVER}`}>
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${status.chip}`}>
                    {status.label}
                  </span>
                </td>
                <td className={`${TD} ${TD_HOVER}`}>
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${priority.chip}`}>
                    {priority.label}
                  </span>
                </td>
                <td className={`${TD} ${TD_HOVER} font-mono tabular-nums`}>
                  <span className={overdue ? 'font-bold text-red-700' : ''}>{row.due}</span>
                  {overdue ? (
                    <span className="ml-1 text-[10px] font-bold text-red-700">−{Math.abs(row.daysToDue)}d</span>
                  ) : null}
                </td>
                <td className={`${TD} ${TD_HOVER} text-neutral-600`}>{row.okr ?? '—'}</td>
                <td className={`${TD} ${TD_HOVER} font-mono text-[11px] text-neutral-700`}>{row.lawRef ?? '—'}</td>
                <td className={`${TD} ${TD_HOVER}`}>{row.recurring ? '✓' : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function OkrGrid({
  selected,
  onToggleAll,
  onToggleOne,
}: {
  selected: Set<string>
  onToggleAll: () => void
  onToggleOne: (id: string) => void
}) {
  const rows = FIXTURE_OBJECTIVES.flatMap((o) =>
    o.keyResults.map((k) => ({ obj: o, kr: k })),
  )
  const allChecked = rows.every((r) => selected.has(r.kr.id))
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full min-w-[920px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${TH} sticky left-0 z-20 w-10`}>
              <HeaderCheckbox checked={allChecked} onClick={onToggleAll} />
            </th>
            <th className={`${TH} sticky left-10 z-20 min-w-[280px] bg-neutral-100`}>Nøkkelresultat</th>
            <th className={TH}>Mål</th>
            <th className={TH}>Eier</th>
            <th className={TH}>Helse</th>
            <th className={TH}>Nå</th>
            <th className={TH}>Mål</th>
            <th className={TH}>Enhet</th>
            <th className={TH}>Progresjon</th>
            <th className={TH}>Oppgaver</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ obj, kr }, i) => {
            const isSel = selected.has(kr.id)
            const health = FIXTURE_HEALTH[kr.health]
            const ratio = kr.invert
              ? Math.max(0, Math.min(1, kr.target / Math.max(kr.current, 0.01)))
              : Math.min(1, kr.current / Math.max(kr.target, 0.01))
            const rowBg = isSel ? 'bg-amber-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'
            return (
              <tr key={kr.id} className={rowBg}>
                <td className={`${TD} sticky left-0 z-10 ${rowBg}`}>
                  <RowCheckbox checked={isSel} onClick={() => onToggleOne(kr.id)} />
                </td>
                <td className={`${TD} sticky left-10 z-10 font-medium text-neutral-900 ${TD_HOVER} ${rowBg}`}>
                  {kr.title}
                </td>
                <td className={`${TD} ${TD_HOVER} text-neutral-700`}>{obj.title.split(' ').slice(0, 4).join(' ')}…</td>
                <td className={`${TD} ${TD_HOVER}`}>{kr.owner}</td>
                <td className={`${TD} ${TD_HOVER}`}>
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: health.soft, color: health.text }}
                  >
                    {health.label}
                  </span>
                </td>
                <td className={`${TD} ${TD_HOVER} font-mono tabular-nums`}>{kr.current}</td>
                <td className={`${TD} ${TD_HOVER} font-mono tabular-nums`}>{kr.target}</td>
                <td className={`${TD} ${TD_HOVER} text-neutral-600`}>{kr.unit}</td>
                <td className={`${TD} ${TD_HOVER} min-w-[140px]`}>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: health.dot }}
                      />
                    </div>
                    <span className="font-mono text-[10.5px] font-bold tabular-nums text-neutral-700">
                      {Math.round(ratio * 100)}%
                    </span>
                  </div>
                </td>
                <td className={`${TD} ${TD_HOVER} tabular-nums`}>{kr.linkedTasks}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CadenceGrid({
  selected,
  onToggleAll,
  onToggleOne,
}: {
  selected: Set<string>
  onToggleAll: () => void
  onToggleOne: (id: string) => void
}) {
  const allChecked = FIXTURE_CADENCES.every((c) => selected.has(c.id))
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full min-w-[880px] border-collapse text-left">
        <thead>
          <tr>
            <th className={`${TH} sticky left-0 z-20 w-10`}>
              <HeaderCheckbox checked={allChecked} onClick={onToggleAll} />
            </th>
            <th className={`${TH} sticky left-10 z-20 min-w-[260px] bg-neutral-100`}>Rutine</th>
            <th className={TH}>Kategori</th>
            <th className={TH}>Frekvens</th>
            <th className={TH}>§-grunnlag</th>
            <th className={TH}>Eier</th>
            <th className={TH}>Status</th>
            <th className={TH}>Anbefalt</th>
          </tr>
        </thead>
        <tbody>
          {FIXTURE_CADENCES.map((c, i) => {
            const isSel = selected.has(c.id)
            const meta = CADENCE_CATEGORY_META[c.category]
            const rowBg = isSel ? 'bg-amber-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/40'
            return (
              <tr key={c.id} className={rowBg}>
                <td className={`${TD} sticky left-0 z-10 ${rowBg}`}>
                  <RowCheckbox checked={isSel} onClick={() => onToggleOne(c.id)} />
                </td>
                <td className={`${TD} sticky left-10 z-10 font-medium text-neutral-900 ${TD_HOVER} ${rowBg}`}>
                  {c.title}
                </td>
                <td className={`${TD} ${TD_HOVER}`}>
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </td>
                <td className={`${TD} ${TD_HOVER}`}>{FREQ_LABEL[c.freq]}</td>
                <td className={`${TD} ${TD_HOVER} font-mono text-[11px] text-neutral-700`}>{c.lawRefs.join(', ')}</td>
                <td className={`${TD} ${TD_HOVER}`}>{c.owner}</td>
                <td className={`${TD} ${TD_HOVER}`}>
                  {c.enabled ? (
                    <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-900">
                      Aktiv
                    </span>
                  ) : (
                    <span className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700">
                      Av
                    </span>
                  )}
                </td>
                <td className={`${TD} ${TD_HOVER}`}>{c.recommended ? '✓' : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
