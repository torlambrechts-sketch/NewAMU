// Iteration 5 — "Timeline / Horizon".
//
// Long-form planners want to see time, not status. Sticky quarter ribbon
// up top, then per-OKR rows where each KR and its tasks are positioned
// along a time axis. The aside lists upcoming cadences this quarter,
// the next escalation, and links to bevisjournal.
//
// Built on WorkplaceDashboardShell (for the KPI strip + hub) and
// WorkplaceSplit7030Layout for the body. The "timeline" itself is a
// styled grid; clean horizontal rules and faint quarter columns keep
// the visual quiet.

import { useMemo, useState } from 'react'
import {
  CalendarRange,
  ChevronRight,
  Compass,
  KanbanSquare,
  Plus,
  Sparkles,
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
  FIXTURE_HEALTH,
  FIXTURE_OBJECTIVES,
  FIXTURE_TASKS,
  FREQ_LABEL,
  computeFixtureSummary,
  type FixtureTask,
} from './planleggingIterationsData'

const TIMELINE_CANVAS = '#F4EFE3'
const TIMELINE_PAPER = '#FFFDF7'
const TIMELINE_GRID = 'rgba(26, 61, 50, 0.08)'

const QUARTERS = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'] as const

type Quarter = (typeof QUARTERS)[number]

/** Map a task's daysToDue to a quarter slot (0..3). */
function taskQuarter(t: FixtureTask): number {
  // Today = "now"; Q2 = next ~90 days, Q3 = 90–180, etc.
  if (t.daysToDue < 0) return 0
  if (t.daysToDue <= 90) return 1
  if (t.daysToDue <= 180) return 2
  return 3
}

function taskColumnSpan(t: FixtureTask): number {
  // Recurring tasks span ahead from their first occurrence to the end of horizon.
  if (t.recurring) return Math.max(1, 4 - taskQuarter(t))
  return 1
}

export function PlanleggingIteration5Timeline() {
  const summary = useMemo(() => computeFixtureSummary(), [])
  const [focusQuarter, setFocusQuarter] = useState<Quarter>('Q2 2026')

  const hubItems: HubMenu1Item[] = [
    { key: 'strategi', label: 'Strategi & OKR', icon: Target, active: true, onClick: () => undefined },
    { key: 'kadens', label: 'Kadens', icon: Wand2, active: false, onClick: () => undefined, badgeCount: summary.activeCadences },
    { key: 'oversikt', label: 'Oppgaver', icon: KanbanSquare, active: false, onClick: () => undefined, badgeCount: summary.openTasks },
  ]

  const kpiSlot = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <TimelineKpi label="Aktiv horisont" value="2026" sub="H1 + H2" />
      <TimelineKpi label="Mål" value={`${summary.objectiveTotal}`} sub={`${summary.objectivesOnTrack} på spor`} />
      <TimelineKpi label="Rutiner" value={`${summary.activeCadences}`} sub="aktive i år" />
      <TimelineKpi label="Forfalt" value={`${summary.overdueTasks}`} sub="krever flytting" tone="warn" />
    </div>
  )

  return (
    <div className="rounded-2xl border border-white/10 p-6 md:p-8" style={{ backgroundColor: TIMELINE_CANVAS }}>
      <WorkplaceDashboardShell
        breadcrumb={[
          { label: 'Plattformadmin', to: '/platform-admin' },
          { label: 'Planlegging-iterasjoner', to: '/platform-admin/planlegging-iterations' },
          { label: '05 · Horisont' },
        ]}
        title="Horisont 2026"
        description="Hvor faller arbeidet i tid? Bla mellom kvartaler og se hvilke mål, rutiner og oppgaver som kolliderer."
        headerActions={
          <>
            <Button variant="secondary" icon={<CalendarRange className="h-4 w-4" />}>Eksporter PDF</Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>Ny milepæl</Button>
          </>
        }
        hubAriaLabel="Planlegging — seksjoner"
        hubItems={hubItems}
        kpiSlot={kpiSlot}
      >
        <QuarterRibbon focus={focusQuarter} onFocus={setFocusQuarter} />

        <div className="mt-6">
          <WorkplaceSplit7030Layout
            main={
              <div className="space-y-6">
                <header className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2f7757]">Tidslinje</p>
                  <WorkplaceSerifSectionTitle>Tre mål på fire kvartaler</WorkplaceSerifSectionTitle>
                </header>

                <div className="space-y-5">
                  {FIXTURE_OBJECTIVES.map((obj) => {
                    const health = FIXTURE_HEALTH[obj.health]
                    const objTasks = FIXTURE_TASKS.filter((t) => obj.keyResults.some((k) => t.okr && k.title.toLowerCase().includes(t.okr.toLowerCase().slice(0, 4))))
                    return (
                      <article
                        key={obj.id}
                        className="rounded-2xl border border-neutral-200/80 p-5"
                        style={{ backgroundColor: TIMELINE_PAPER, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                      >
                        <header className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p
                              className="text-[17px] font-semibold leading-snug text-neutral-900"
                              style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
                            >
                              {obj.title}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {obj.owner} · {obj.horizon} · {obj.keyResults.length} nøkkelresultater
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{ backgroundColor: health.soft, color: health.text }}
                          >
                            {health.label}
                          </span>
                        </header>

                        <div className="mt-4">
                          <TimelineGrid focus={focusQuarter}>
                            {obj.keyResults.map((kr) => {
                              const krHealth = FIXTURE_HEALTH[kr.health]
                              const ratio = kr.invert
                                ? Math.max(0, Math.min(1, kr.target / Math.max(kr.current, 0.01)))
                                : Math.min(1, kr.current / Math.max(kr.target, 0.01))
                              return (
                                <div
                                  key={kr.id}
                                  className="col-span-full grid grid-cols-[180px_repeat(4,minmax(0,1fr))] items-center gap-3 border-b border-neutral-100 py-2.5 last:border-b-0"
                                >
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-medium leading-tight text-neutral-900">{kr.title}</p>
                                    <p className="mt-0.5 text-[11px] text-neutral-500">
                                      {kr.current}/{kr.target} {kr.unit}
                                    </p>
                                  </div>
                                  <div
                                    className="relative col-span-4 h-8 rounded-md"
                                    style={{ backgroundColor: `${krHealth.dot}10` }}
                                  >
                                    <div
                                      className="absolute inset-y-0 left-0 flex items-center rounded-md px-2"
                                      style={{
                                        width: `${Math.max(8, ratio * 100)}%`,
                                        backgroundColor: `${krHealth.dot}33`,
                                        borderLeft: `3px solid ${krHealth.dot}`,
                                      }}
                                    >
                                      <span className="text-[10.5px] font-bold tabular-nums text-neutral-700">
                                        {Math.round(ratio * 100)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                            {objTasks.slice(0, 3).map((t) => {
                              const start = taskQuarter(t)
                              const span = taskColumnSpan(t)
                              return (
                                <div
                                  key={t.id}
                                  className="col-span-full grid grid-cols-[180px_repeat(4,minmax(0,1fr))] items-center gap-3 py-1.5"
                                >
                                  <div className="min-w-0">
                                    <p className="text-[12px] leading-tight text-neutral-700">{t.title}</p>
                                    <p className="text-[10.5px] text-neutral-500">{t.owner}</p>
                                  </div>
                                  {[0, 1, 2, 3].map((q) => {
                                    const inSpan = q >= start && q < start + span
                                    if (!inSpan) return <div key={q} aria-hidden />
                                    if (q !== start) return <div key={q} aria-hidden />
                                    return (
                                      <div
                                        key={q}
                                        className="inline-flex items-center gap-1.5 rounded-md border border-[#1a3d32]/30 bg-white px-2 py-1 text-[10.5px] font-medium text-neutral-700 shadow-sm"
                                        style={{
                                          gridColumn: `span ${span} / span ${span}`,
                                        }}
                                      >
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1a3d32]" />
                                        <span className="truncate">{t.due}</span>
                                        {t.recurring ? (
                                          <span className="ml-auto rounded bg-neutral-100 px-1 text-[9px] font-bold uppercase text-neutral-600">
                                            kadens
                                          </span>
                                        ) : null}
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </TimelineGrid>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            }
            aside={
              <div className="space-y-6">
                <section>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Rutiner i {focusQuarter}
                  </p>
                  <WorkplaceSerifSectionTitle as="h3" variant="compact" className="mt-2">
                    Det som gjentas
                  </WorkplaceSerifSectionTitle>
                  <ul className="mt-3 space-y-2.5">
                    {FIXTURE_CADENCES.filter((c) => c.enabled)
                      .slice(0, 4)
                      .map((c) => {
                        const meta = CADENCE_CATEGORY_META[c.category]
                        return (
                          <li
                            key={c.id}
                            className="flex items-center gap-3 rounded-lg border border-neutral-200/80 p-3"
                            style={{ backgroundColor: TIMELINE_PAPER }}
                          >
                            <span
                              className="h-7 w-1 shrink-0 rounded-full"
                              style={{ backgroundColor: meta.color }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium leading-tight text-neutral-900">{c.title}</p>
                              <p className="mt-0.5 text-[11px] text-neutral-500">
                                {FREQ_LABEL[c.freq]} · {c.owner}
                              </p>
                            </div>
                          </li>
                        )
                      })}
                  </ul>
                </section>

                <section className="rounded-xl border border-neutral-200/80 p-4" style={{ backgroundColor: TIMELINE_PAPER }}>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    <Compass className="h-3.5 w-3.5" />
                    Neste milepæl
                  </div>
                  <p
                    className="mt-2 text-[19px] font-semibold leading-tight text-neutral-900"
                    style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
                  >
                    AMU Q2 — 15. juni
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-600">
                    Saksliste lukkes 8. juni. Pulsmåling og risikoregister-utdrag forventes vedlagt.
                  </p>
                  <Button variant="ghost" className="mt-2 -ml-2 text-sm">
                    Åpne AMU-agenda
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </section>

                <section className="rounded-xl bg-[#1a3d32] p-4 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">Foreslå</p>
                  <p
                    className="mt-2 text-[17px] font-semibold leading-snug"
                    style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
                  >
                    Tre oppgaver kolliderer i Q3 — flytt brann­øvelsen til september?
                  </p>
                  <Button variant="secondary" icon={<Sparkles className="h-4 w-4" />} className="mt-3">
                    Vurder
                  </Button>
                </section>
              </div>
            }
          />
        </div>
      </WorkplaceDashboardShell>
    </div>
  )
}

function QuarterRibbon({
  focus,
  onFocus,
}: {
  focus: Quarter
  onFocus: (q: Quarter) => void
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="grid grid-cols-4">
        {QUARTERS.map((q, i) => {
          const active = q === focus
          return (
            <button
              key={q}
              type="button"
              onClick={() => onFocus(q)}
              className={`group flex flex-col items-start gap-1 border-r border-neutral-200/80 px-5 py-4 text-left last:border-r-0 ${
                active ? 'bg-[#e7efe9]/60' : 'bg-white hover:bg-neutral-50'
              }`}
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                0{i + 1}
              </span>
              <span className="text-base font-semibold text-neutral-900">{q}</span>
              <span className="text-[11px] text-neutral-500">
                {i === 0 ? 'Avsluttet' : i === 1 ? 'Pågår' : i === 2 ? 'Sommer/høst' : 'Avslutning'}
              </span>
              {active ? <span className="mt-1 h-0.5 w-10 rounded-full bg-[#1a3d32]" /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TimelineGrid({ children, focus }: { children: React.ReactNode; focus: Quarter }) {
  const focusIdx = QUARTERS.indexOf(focus)
  return (
    <div className="relative">
      <div
        className="absolute inset-0 grid grid-cols-[180px_repeat(4,minmax(0,1fr))] pointer-events-none"
        aria-hidden
      >
        <div />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-full border-r border-neutral-100 last:border-r-0 ${
              i === focusIdx ? 'bg-[#1a3d32]/[0.04]' : ''
            }`}
            style={{ borderRightColor: TIMELINE_GRID }}
          />
        ))}
      </div>
      <div className="relative grid grid-cols-[180px_repeat(4,minmax(0,1fr))] gap-x-3">
        <div />
        {QUARTERS.map((q, i) => (
          <div
            key={q}
            className={`px-1 pb-2 text-[10.5px] font-bold uppercase tracking-wide ${
              i === focusIdx ? 'text-[#1a3d32]' : 'text-neutral-400'
            }`}
          >
            {q}
          </div>
        ))}
        {children}
      </div>
    </div>
  )
}

function TimelineKpi({
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
      style={{ backgroundColor: TIMELINE_PAPER, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${tone === 'warn' ? 'text-amber-800' : 'text-neutral-900'}`}
        style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] text-neutral-500">{sub}</p>
    </div>
  )
}
