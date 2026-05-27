// Iteration 10 — "Executive Cockpit".
//
// Cockpit-style readout for daglig leder. Big-number widgets, mini
// donut + sparkline-style bars, segmented health gauges, and a single
// "next decision" panel. Built for board prep — everything readable
// from across the room.
//
// Built on WorkplaceDashboardShell, WorkplaceSplit7030Layout. Widgets
// are CSS-only (no chart lib) so the file stays portable.

import { useMemo } from 'react'
import {
  ActivitySquare,
  AlertOctagon,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  CalendarRange,
  Compass,
  Download,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import { WorkplaceDashboardShell } from '../../../components/layout/WorkplaceDashboardShell'
import { WORKPLACE_PAGE_SERIF } from '../../../components/layout/WorkplacePageHeading1'
import { WorkplaceSplit7030Layout } from '../../../components/layout/WorkplaceSplit7030Layout'
import { Button } from '../../../components/ui/Button'
import {
  FIXTURE_HEALTH,
  FIXTURE_OBJECTIVES,
  FIXTURE_TASKS,
  computeFixtureSummary,
} from './planleggingIterationsData'

const COCKPIT_CANVAS = '#0E1B17'

export function PlanleggingIteration10Cockpit() {
  const summary = useMemo(() => computeFixtureSummary(), [])
  const overallPct = Math.round(summary.krProgress * 100)

  const overdue = FIXTURE_TASKS.filter((t) => t.daysToDue < 0 && t.status !== 'fullført').length
  const dueThisWeek = FIXTURE_TASKS.filter(
    (t) => t.daysToDue >= 0 && t.daysToDue <= 7 && t.status !== 'fullført',
  ).length

  return (
    <div className="rounded-2xl border border-white/10 p-6 md:p-8" style={{ backgroundColor: COCKPIT_CANVAS }}>
      <WorkplaceDashboardShell
        breadcrumb={[
          { label: 'Plattformadmin', to: '/platform-admin' },
          { label: 'Planlegging-iterasjoner', to: '/platform-admin/planlegging-iterations' },
          { label: '10 · Cockpit' },
        ]}
        title={
          <span className="text-white" style={{ fontFamily: WORKPLACE_PAGE_SERIF }}>
            Styresalen
          </span>
        }
        description={
          <p className="text-[15px] leading-relaxed text-white/60">
            Bord-klar oppsummering. Stor lesbarhet, høy kontrast, lite støy. Klar til å
            projiseres bak deg.
          </p>
        }
        headerActions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />}>Eksporter brief</Button>
            <Button variant="primary" icon={<CalendarRange className="h-4 w-4" />}>Til AMU</Button>
          </>
        }
      >
        {/* Hero: massive headline number */}
        <section
          className="grid gap-5 rounded-2xl border border-white/10 p-7 lg:grid-cols-[1.4fr_1fr]"
          style={{ backgroundColor: '#11241E' }}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300/80">
              SAMLET OKR-PROGRESJON · 2026 H1
            </p>
            <p
              className="mt-3 text-[96px] font-bold leading-none tabular-nums text-white"
              style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
            >
              {overallPct}
              <span className="text-[48px] text-white/40">%</span>
            </p>
            <p className="mt-3 text-[14px] text-white/70">
              {summary.objectivesOnTrack} av {summary.objectiveTotal} hovedmål på spor.{' '}
              {summary.objectivesAtRisk} risiko, {summary.objectivesOffTrack} ute av kurs.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
              <DeltaPill dir="up" tone="good">
                +4% vs Q1
              </DeltaPill>
              <DeltaPill dir="up" tone="warn">
                Forfall +1
              </DeltaPill>
              <DeltaPill dir="flat" tone="neutral">
                Kadens stabil
              </DeltaPill>
            </div>
          </div>

          {/* Donut */}
          <div className="flex items-center justify-center">
            <Donut pct={overallPct} />
          </div>
        </section>

        {/* Three gauges */}
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <Gauge3
            label="Mål — helse"
            value={summary.objectivesOnTrack}
            total={summary.objectiveTotal}
            icon={Target}
          />
          <Gauge3
            label="Kadens — aktiv"
            value={summary.activeCadences}
            total={summary.catalogCadences}
            icon={ShieldCheck}
          />
          <Gauge3
            label="Oppgaver — i tide"
            value={summary.openTasks - overdue}
            total={summary.openTasks}
            icon={ActivitySquare}
            tone={overdue > 0 ? 'warn' : 'good'}
          />
        </section>

        {/* Mid section: 7/3 split */}
        <div className="mt-6">
          <WorkplaceSplit7030Layout
            cardWrap={false}
            main={
              <div
                className="rounded-2xl border border-white/10 p-6"
                style={{ backgroundColor: '#11241E' }}
              >
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300/80">
                      Per hovedmål
                    </p>
                    <h3
                      className="mt-2 text-xl font-semibold leading-tight text-white"
                      style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
                    >
                      Tre store mål — én linje hver
                    </h3>
                  </div>
                </header>

                <ul className="mt-5 space-y-4">
                  {FIXTURE_OBJECTIVES.map((obj) => {
                    const health = FIXTURE_HEALTH[obj.health]
                    const progress =
                      obj.keyResults.reduce((acc, k) => {
                        const r = k.invert
                          ? Math.max(0, Math.min(1, k.target / Math.max(k.current, 0.01)))
                          : Math.min(1, k.current / Math.max(k.target, 0.01))
                        return acc + r
                      }, 0) / Math.max(obj.keyResults.length, 1)
                    return (
                      <li key={obj.id} className="rounded-xl bg-white/[0.04] p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p
                            className="text-[17px] font-semibold leading-snug text-white"
                            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
                          >
                            {obj.title}
                          </p>
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
                            style={{ backgroundColor: `${health.dot}33`, color: '#FEF3C7' }}
                          >
                            {health.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-white/50">
                          {obj.owner} · {obj.horizon}
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: health.dot }}
                            />
                          </div>
                          <p
                            className="font-mono text-[16px] font-bold tabular-nums text-white"
                            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
                          >
                            {Math.round(progress * 100)}%
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {obj.keyResults.map((kr) => {
                            const r = kr.invert
                              ? Math.max(0, Math.min(1, kr.target / Math.max(kr.current, 0.01)))
                              : Math.min(1, kr.current / Math.max(kr.target, 0.01))
                            const krHealth = FIXTURE_HEALTH[kr.health]
                            return (
                              <span
                                key={kr.id}
                                className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.06] px-2 py-1 text-[10.5px] font-medium text-white/70"
                                title={kr.title}
                              >
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: krHealth.dot }} />
                                {kr.title.split(' ').slice(0, 3).join(' ')}… {Math.round(r * 100)}%
                              </span>
                            )
                          })}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            }
            aside={
              <div className="space-y-4">
                <NextDecision />
                <SparkBars
                  label="Belastning — 12 uker"
                  values={[3, 4, 2, 5, 6, 8, 4, 3, 5, 7, 9, 6]}
                />
                <Counters overdue={overdue} dueThisWeek={dueThisWeek} completedMonth={summary.completedThisMonth} />
              </div>
            }
          />
        </div>

        {/* Bottom band */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BoardKpi
            icon={Award}
            label="Bevisførsel"
            value="100%"
            sub="Hver oppgave §-lenket"
            tone="good"
          />
          <BoardKpi
            icon={Compass}
            label="AMU-saker"
            value="11/16"
            sub="Q2 lukket"
          />
          <BoardKpi
            icon={AlertOctagon}
            label="Topp-risiko"
            value="3/10"
            sub="Verifiserte tiltak"
            tone="warn"
          />
          <BoardKpi
            icon={Sparkles}
            label="Auto-foreslag"
            value="2"
            sub="Klar for vurdering"
          />
        </section>
      </WorkplaceDashboardShell>
    </div>
  )
}

function Donut({ pct }: { pct: number }) {
  const size = 200
  const stroke = 18
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const dash = circ * (pct / 100)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#FCD34D"
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="white"
        style={{
          fontFamily: WORKPLACE_PAGE_SERIF,
          fontSize: 44,
          fontWeight: 700,
        }}
      >
        {pct}%
      </text>
    </svg>
  )
}

function Gauge3({
  label,
  value,
  total,
  icon: Icon,
  tone = 'good',
}: {
  label: string
  value: number
  total: number
  icon: typeof Target
  tone?: 'good' | 'warn'
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100)
  return (
    <article
      className="rounded-2xl border border-white/10 p-5"
      style={{ backgroundColor: '#11241E' }}
    >
      <div className="flex items-center justify-between">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300"
        >
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-white/50">{label}</p>
      </div>
      <p
        className="mt-3 text-4xl font-bold tabular-nums text-white"
        style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
      >
        {value}
        <span className="ml-1 text-xl text-white/40">/{total}</span>
      </p>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: tone === 'warn' ? '#fbbf24' : '#86efac' }}
          />
        </div>
        <span className="font-mono text-[10.5px] font-bold tabular-nums text-white/60">{pct}%</span>
      </div>
    </article>
  )
}

function DeltaPill({
  dir,
  tone,
  children,
}: {
  dir: 'up' | 'down' | 'flat'
  tone: 'good' | 'warn' | 'neutral'
  children: React.ReactNode
}) {
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : null
  const bg =
    tone === 'good'
      ? 'bg-emerald-400/20 text-emerald-200'
      : tone === 'warn'
        ? 'bg-amber-400/20 text-amber-200'
        : 'bg-white/10 text-white/70'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${bg}`}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-current opacity-60" />}
      {children}
    </span>
  )
}

function NextDecision() {
  return (
    <section
      className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/20 to-orange-500/10 p-5 text-amber-50"
    >
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-200">
        <Sparkles className="h-3.5 w-3.5" />
        Neste beslutning
      </p>
      <p
        className="mt-2 text-[18px] font-semibold leading-snug text-white"
        style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
      >
        Skal vi flytte ressurs fra «Kompetanse» til «Risiko» for å redde Q2?
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-amber-100/80">
        «Risiko» har glidd 7 dager. Et Linjeleder-team er ledig i 14 dager etter HMS-grunnkurset.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary">Se analyse</Button>
        <Button variant="primary">Bring til AMU</Button>
      </div>
    </section>
  )
}

function SparkBars({ label, values }: { label: string; values: number[] }) {
  const max = Math.max(...values)
  return (
    <section
      className="rounded-2xl border border-white/10 p-5"
      style={{ backgroundColor: '#11241E' }}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-white/50">{label}</p>
      <div className="mt-3 flex h-[64px] items-end gap-1.5">
        {values.map((v, i) => {
          const h = max === 0 ? 0 : (v / max) * 100
          return (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${Math.max(4, h)}%`,
                backgroundColor: i === values.length - 2 ? '#FCD34D' : 'rgba(252,211,77,0.3)',
              }}
              aria-label={`Uke ${i + 1}: ${v} hendelser`}
            />
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wide text-white/40">
        <span>Uke 13</span>
        <span>Uke 24</span>
      </div>
    </section>
  )
}

function Counters({
  overdue,
  dueThisWeek,
  completedMonth,
}: {
  overdue: number
  dueThisWeek: number
  completedMonth: number
}) {
  return (
    <section className="grid grid-cols-3 gap-2">
      <CounterTile label="Forfalt" value={overdue} tone="danger" />
      <CounterTile label="Denne uka" value={dueThisWeek} />
      <CounterTile label="Lukket mai" value={completedMonth} tone="good" />
    </section>
  )
}

function CounterTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'good' | 'danger'
}) {
  const fg =
    tone === 'danger' ? 'text-red-300' : tone === 'good' ? 'text-emerald-300' : 'text-white'
  return (
    <div className="rounded-xl border border-white/10 p-3" style={{ backgroundColor: '#11241E' }}>
      <p
        className={`text-2xl font-bold tabular-nums ${fg}`}
        style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
      >
        {value}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">{label}</p>
    </div>
  )
}

function BoardKpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: typeof Target
  label: string
  value: string
  sub: string
  tone?: 'default' | 'good' | 'warn'
}) {
  const valueColor =
    tone === 'warn' ? 'text-amber-300' : tone === 'good' ? 'text-emerald-300' : 'text-white'
  return (
    <article
      className="rounded-2xl border border-white/10 p-5"
      style={{ backgroundColor: '#11241E' }}
    >
      <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wide text-white/50">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p
        className={`mt-2 text-3xl font-bold tabular-nums ${valueColor}`}
        style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
      >
        {value}
      </p>
      <p className="mt-1 text-[11.5px] text-white/60">{sub}</p>
    </article>
  )
}
