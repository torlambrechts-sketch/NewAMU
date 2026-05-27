// Iteration 9 — "Heatmap / Year-at-a-glance".
//
// One scroll, one year. 52 week cells × 12 months coloured by total
// load (tasks + cadenser due that week). Hover/click a cell to see the
// detail in the right column. Helps planners spot capacity dips and
// peaks before they happen.
//
// Built on WorkplaceDashboardShell with kpiSlot and a custom calendar.

import { useMemo, useState } from 'react'
import {
  Activity,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  KanbanSquare,
  Plus,
  Target,
  Wand2,
} from 'lucide-react'
import type { HubMenu1Item } from '../../../components/layout/HubMenu1Bar'
import { WorkplaceDashboardShell } from '../../../components/layout/WorkplaceDashboardShell'
import { WorkplaceSerifSectionTitle, WORKPLACE_PAGE_SERIF } from '../../../components/layout/WorkplacePageHeading1'
import { WorkplaceSplit7030Layout } from '../../../components/layout/WorkplaceSplit7030Layout'
import { Button } from '../../../components/ui/Button'
import {
  CADENCE_CATEGORY_META,
  FIXTURE_CADENCES,
  FIXTURE_TASKS,
  FREQ_LABEL,
  computeFixtureSummary,
} from './planleggingIterationsData'

const HEATMAP_CANVAS = '#F4EFE3'
const HEATMAP_PAPER = '#FFFDF7'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
const WEEKDAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S']

/** Build a deterministic week-load grid (rows = weekdays, cols = weeks 1..52). */
function buildLoadGrid(year: number): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(52).fill(0))
  // Tasks: assume daysToDue from today (week ~21 in 2026 of fixture date 2026-05-27).
  const todayWeek = 21
  for (const t of FIXTURE_TASKS) {
    const w = Math.max(0, Math.min(51, todayWeek + Math.floor(t.daysToDue / 7)))
    const wd = Math.abs(t.id.charCodeAt(t.id.length - 1)) % 7
    grid[wd][w] += t.recurring ? 2 : 1
    // Recurring tasks add a faint trail forward.
    if (t.recurring) {
      for (let dw = 4; dw < 52 - w; dw += 4) {
        grid[wd][w + dw] += 1
      }
    }
  }
  // Add baseline cadenser
  for (let c = 0; c < FIXTURE_CADENCES.filter((x) => x.enabled).length; c += 1) {
    for (let w = c; w < 52; w += 6 + c) {
      const wd = (c * 3) % 7
      grid[wd][w] += 1
    }
  }
  // Approximate "year" with a seed so different years look different.
  const seed = year % 4
  for (let wd = 0; wd < 7; wd += 1) {
    for (let w = 0; w < 52; w += 1) {
      if ((w + wd + seed) % 13 === 0) grid[wd][w] += 1
    }
  }
  return grid
}

function intensityColor(value: number): string {
  if (value === 0) return '#E8E1D0'
  if (value <= 1) return '#CDE0CF'
  if (value <= 2) return '#9CC4A3'
  if (value <= 3) return '#5F9F77'
  if (value <= 4) return '#3A7855'
  return '#1a3d32'
}

export function PlanleggingIteration9Heatmap() {
  const summary = useMemo(() => computeFixtureSummary(), [])
  const [year, setYear] = useState(2026)
  const [selected, setSelected] = useState<{ week: number; weekday: number } | null>({ week: 21, weekday: 2 })

  const grid = useMemo(() => buildLoadGrid(year), [year])
  const yearTotal = useMemo(
    () => grid.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0),
    [grid],
  )
  const peak = useMemo(() => {
    let max = 0
    let week = 0
    for (let w = 0; w < 52; w += 1) {
      let sum = 0
      for (let wd = 0; wd < 7; wd += 1) sum += grid[wd][w]
      if (sum > max) {
        max = sum
        week = w
      }
    }
    return { week, count: max }
  }, [grid])

  const hubItems: HubMenu1Item[] = [
    { key: 'oversikt', label: 'Belastning', icon: Activity, active: true, onClick: () => undefined, badgeCount: yearTotal },
    { key: 'okr', label: 'OKR-fokus', icon: Target, active: false, onClick: () => undefined, badgeCount: summary.objectiveTotal },
    { key: 'kadens', label: 'Bare rutiner', icon: Wand2, active: false, onClick: () => undefined, badgeCount: summary.activeCadences },
    { key: 'tasks', label: 'Bare oppgaver', icon: KanbanSquare, active: false, onClick: () => undefined, badgeCount: summary.openTasks },
  ]

  const kpiSlot = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <HeatKpi label="Total belastning" value={`${yearTotal}`} sub="hendelser i året" />
      <HeatKpi label="Topp-uke" value={`UKE ${peak.week + 1}`} sub={`${peak.count} hendelser`} tone="warn" />
      <HeatKpi label="Stilleste måned" value="JULI" sub="bare 6 hendelser" />
      <HeatKpi label="Aktive rutiner" value={`${summary.activeCadences}`} sub="genererer kalenderlast" />
    </div>
  )

  return (
    <div className="rounded-2xl border border-white/10 p-6 md:p-8" style={{ backgroundColor: HEATMAP_CANVAS }}>
      <WorkplaceDashboardShell
        breadcrumb={[
          { label: 'Plattformadmin', to: '/platform-admin' },
          { label: 'Planlegging-iterasjoner', to: '/platform-admin/planlegging-iterations' },
          { label: '09 · Heatmap' },
        ]}
        title="Året i ett blikk"
        description="52 uker × 7 dager. Mørke ruter betyr høy belastning — flytt arbeid til de lyse for å unngå å brenne ut teamet."
        hubAriaLabel="Heatmap — lens"
        hubItems={hubItems}
        headerActions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />}>Eksporter SVG</Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>Ny milepæl</Button>
          </>
        }
        kpiSlot={kpiSlot}
      >
        <YearScrubber year={year} onChange={setYear} />

        <div className="mt-6">
          <WorkplaceSplit7030Layout
            splitDensity="default"
            main={
              <div className="space-y-5">
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2f7757]">Belastnings-kalender</p>
                    <WorkplaceSerifSectionTitle>52 uker, fra januar til desember</WorkplaceSerifSectionTitle>
                  </div>
                  <Legend />
                </header>

                <Heatmap grid={grid} selected={selected} onSelect={setSelected} />
              </div>
            }
            aside={
              <DetailPanel
                year={year}
                selected={selected}
                load={selected ? grid[selected.weekday][selected.week] : 0}
              />
            }
          />
        </div>
      </WorkplaceDashboardShell>
    </div>
  )
}

function YearScrubber({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white px-4 py-3"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => onChange(year - 1)} aria-label="Forrige år">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p
          className="text-2xl font-semibold tabular-nums text-neutral-900"
          style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
        >
          {year}
        </p>
        <Button variant="ghost" size="icon" onClick={() => onChange(year + 1)} aria-label="Neste år">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[2025, 2026, 2027].map((y) => (
          <Button
            key={y}
            variant={y === year ? 'primary' : 'ghost'}
            onClick={() => onChange(y)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              y === year ? '' : 'border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {y}
          </Button>
        ))}
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-[10.5px] text-neutral-500">
      <span className="font-bold uppercase tracking-wide">Lite</span>
      {[0, 1, 2, 3, 4, 5].map((v) => (
        <span
          key={v}
          className="h-3 w-3 rounded-sm"
          style={{ backgroundColor: intensityColor(v) }}
          aria-hidden
        />
      ))}
      <span className="font-bold uppercase tracking-wide">Mye</span>
    </div>
  )
}

function Heatmap({
  grid,
  selected,
  onSelect,
}: {
  grid: number[][]
  selected: { week: number; weekday: number } | null
  onSelect: (sel: { week: number; weekday: number } | null) => void
}) {
  return (
    <div
      className="overflow-x-auto rounded-xl border border-neutral-200/80 bg-white p-5"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="min-w-[820px]">
        <div className="grid grid-cols-[28px_repeat(52,minmax(0,1fr))] gap-[3px]">
          <div />
          {Array.from({ length: 52 }, (_, i) => i).map((w) => {
            // Show month label only at first week of each month (approx).
            const month = Math.floor((w / 52) * 12)
            const showLabel = w === Math.round((month / 12) * 52)
            return (
              <div
                key={w}
                className="text-center text-[8.5px] font-bold uppercase text-neutral-400"
                aria-hidden
              >
                {showLabel ? MONTHS[month] : ''}
              </div>
            )
          })}
          {WEEKDAYS.map((wd, wdIdx) => (
            <FragmentRow
              key={wdIdx}
              label={wd}
              row={grid[wdIdx]}
              weekday={wdIdx}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function FragmentRow({
  label,
  row,
  weekday,
  selected,
  onSelect,
}: {
  label: string
  row: number[]
  weekday: number
  selected: { week: number; weekday: number } | null
  onSelect: (sel: { week: number; weekday: number } | null) => void
}) {
  return (
    <>
      <div className="flex items-center text-[10px] font-bold text-neutral-500">{label}</div>
      {row.map((value, w) => {
        const isSel = selected?.week === w && selected?.weekday === weekday
        return (
          <button
            key={w}
            type="button"
            onClick={() => onSelect({ week: w, weekday })}
            aria-label={`Uke ${w + 1}, ${label} — belastning ${value}`}
            className={`aspect-square rounded-sm transition ${
              isSel ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-white' : 'hover:ring-2 hover:ring-neutral-300'
            }`}
            style={{ backgroundColor: intensityColor(value) }}
          />
        )
      })}
    </>
  )
}

function DetailPanel({
  year,
  selected,
  load,
}: {
  year: number
  selected: { week: number; weekday: number } | null
  load: number
}) {
  if (!selected) {
    return (
      <div className="rounded-xl border border-neutral-200/80 p-5 text-sm text-neutral-500" style={{ backgroundColor: HEATMAP_PAPER }}>
        Klikk på en rute for å se hva som skjer den dagen.
      </div>
    )
  }
  const month = Math.floor((selected.week / 52) * 12)
  const sampleTasks = FIXTURE_TASKS.slice(selected.week % FIXTURE_TASKS.length, (selected.week % FIXTURE_TASKS.length) + 3)
  const sampleCadences = FIXTURE_CADENCES.filter((c) => c.enabled).slice(0, 2)
  return (
    <div className="space-y-5">
      <section
        className="rounded-xl border border-neutral-200/80 p-5"
        style={{ backgroundColor: HEATMAP_PAPER, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">Valgt celle</p>
        <p
          className="mt-2 text-[22px] font-semibold leading-tight text-neutral-900"
          style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
        >
          {WEEKDAYS[selected.weekday]} · uke {selected.week + 1}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {MONTHS[month]} {year} · belastning {load} hendelser
        </p>
      </section>

      <section>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">Hva skjer</p>
        <ul className="mt-2 space-y-2">
          {sampleTasks.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-neutral-200/80 px-3 py-2"
              style={{ backgroundColor: HEATMAP_PAPER }}
            >
              <p className="text-[13px] font-medium text-neutral-900">{t.title}</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                {t.owner}
                {t.lawRef ? <> · <span className="font-mono">{t.lawRef}</span></> : null}
              </p>
            </li>
          ))}
          {sampleCadences.map((c) => {
            const meta = CADENCE_CATEGORY_META[c.category]
            return (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-neutral-200/80 px-3 py-2 text-[12.5px]"
                style={{ backgroundColor: HEATMAP_PAPER }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                <span className="font-medium text-neutral-900">{c.title}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-neutral-500">
                  {FREQ_LABEL[c.freq]}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-xl bg-[#1a3d32] p-4 text-white">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
          <CalendarRange className="h-3.5 w-3.5" />
          Anbefaling
        </p>
        <p
          className="mt-2 text-[16px] leading-snug"
          style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
        >
          Uke {selected.week + 1} har {load} hendelser — vurder å flytte én rutine til uke{' '}
          {((selected.week + 4) % 52) + 1}, som er lysere.
        </p>
      </section>
    </div>
  )
}

function HeatKpi({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: string
  sub: string
  tone?: 'default' | 'warn'
}) {
  return (
    <div
      className="rounded-xl border border-neutral-200/80 p-4"
      style={{ backgroundColor: HEATMAP_PAPER, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold tabular-nums ${tone === 'warn' ? 'text-amber-800' : 'text-neutral-900'}`}
        style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-neutral-500">{sub}</p>
    </div>
  )
}
