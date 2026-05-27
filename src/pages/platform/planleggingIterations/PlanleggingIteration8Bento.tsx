// Iteration 8 — "Bento Mosaic".
//
// Modern mixed-size card grid (apple/notion-style bento). One hero card
// for the headline mål, medium cards for kadens-puls and overdue, and
// smaller cards for KPI confetti. Visually rich, dense without being
// cluttered. Great for sharing as a screenshot in chat.
//
// Built on WorkplacePageHeading1 (no shell), CSS grid for the mosaic.

import { useMemo } from 'react'
import {
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  ListChecks,
  Plus,
  Repeat,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
} from 'lucide-react'
import { WorkplacePageHeading1, WORKPLACE_PAGE_SERIF } from '../../../components/layout/WorkplacePageHeading1'
import { Button } from '../../../components/ui/Button'
import {
  CADENCE_CATEGORY_META,
  FIXTURE_CADENCES,
  FIXTURE_HEALTH,
  FIXTURE_OBJECTIVES,
  FIXTURE_TASKS,
  FREQ_LABEL,
  PRIORITY_META,
  computeFixtureSummary,
} from './planleggingIterationsData'

const BENTO_CANVAS = '#EFE9DA'

export function PlanleggingIteration8Bento() {
  const summary = useMemo(() => computeFixtureSummary(), [])
  const hero = FIXTURE_OBJECTIVES[0]
  const overdue = FIXTURE_TASKS.filter((t) => t.daysToDue < 0 && t.status !== 'fullført')
  const upcoming = FIXTURE_TASKS.filter((t) => t.daysToDue >= 0 && t.daysToDue <= 14 && t.status !== 'fullført')
  const enabled = FIXTURE_CADENCES.filter((c) => c.enabled)

  return (
    <div className="rounded-2xl border border-white/10 p-6 md:p-8" style={{ backgroundColor: BENTO_CANVAS }}>
      <WorkplacePageHeading1
        breadcrumb={[
          { label: 'Plattformadmin', to: '/platform-admin' },
          { label: 'Planlegging-iterasjoner', to: '/platform-admin/planlegging-iterations' },
          { label: '08 · Bento Mosaic' },
        ]}
        title="Planlegging — alt på ett blikk"
        description="Mosaikk-oppsett der hver brikke har et formål. Hold pekeren over en brikke for å bla videre."
        headerActions={
          <>
            <Button variant="secondary" icon={<CalendarRange className="h-4 w-4" />}>Eksporter PNG</Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>Ny brikke</Button>
          </>
        }
      />

      <div className="mt-8 grid auto-rows-[minmax(140px,auto)] grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
        {/* Hero — headline OKR */}
        {hero ? <HeroTile obj={hero} /> : null}

        {/* KPI confetti */}
        <KpiTile
          className="md:col-span-3 lg:col-span-3"
          icon={Target}
          label="OKR på spor"
          value={`${summary.objectivesOnTrack}/${summary.objectiveTotal}`}
          sub={`${summary.objectivesAtRisk} risiko · ${summary.objectivesOffTrack} ute av kurs`}
          accent="#1a3d32"
        />
        <KpiTile
          className="md:col-span-3 lg:col-span-3"
          icon={TriangleAlert}
          label="Forfalt"
          value={`${summary.overdueTasks}`}
          sub="Krever oppmerksomhet"
          accent="#b3382a"
          tone="danger"
        />

        {/* Kadens pulse — wide medium */}
        <section
          className="md:col-span-6 lg:col-span-6 rounded-2xl border border-neutral-200/80 bg-white p-5 lg:row-span-2"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <header className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
              <Repeat className="h-3.5 w-3.5" />
              Rytmen
            </p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
              {enabled.length} aktive
            </span>
          </header>
          <h3
            className="mt-3 text-[22px] font-semibold leading-tight text-neutral-900"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
          >
            Pulsen som holder oss i form
          </h3>
          <ul className="mt-4 space-y-2">
            {enabled.slice(0, 5).map((c) => {
              const meta = CADENCE_CATEGORY_META[c.category]
              const Icon = c.icon
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200/70 bg-neutral-50/50 px-3 py-2"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-900">{c.title}</p>
                  <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                    {FREQ_LABEL[c.freq]}
                  </span>
                </li>
              )
            })}
          </ul>
          <Button variant="ghost" className="mt-3 -ml-2">
            Alle rutiner
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        </section>

        {/* Overdue tile — accent */}
        <section
          className="md:col-span-6 lg:col-span-6 rounded-2xl bg-[#1a3d32] p-5 text-white"
          style={{ boxShadow: '0 6px 16px rgba(26,61,50,0.18)' }}
        >
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
            <TriangleAlert className="h-3.5 w-3.5" />
            Forfalt — fiks dette først
          </p>
          <h3
            className="mt-3 text-[22px] font-semibold leading-tight"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
          >
            {overdue.length === 0 ? 'Ingen forfalte. Nyt en kaffe.' : `${overdue.length} oppgaver venter på handling`}
          </h3>
          <ul className="mt-4 space-y-2">
            {overdue.slice(0, 3).map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2 backdrop-blur"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">
                  {t.ownerInit}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{t.title}</p>
                  <p className="text-[10.5px] text-white/60">
                    {Math.abs(t.daysToDue)} d forsinket · {t.owner}
                  </p>
                </div>
                <span className="rounded-md bg-red-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-100">
                  Akutt
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Mini-KPIs */}
        <KpiTile
          className="md:col-span-3 lg:col-span-3"
          icon={ListChecks}
          label="Åpne oppgaver"
          value={`${summary.openTasks}`}
          sub={`${summary.recurringTasks} er rutiner`}
          accent="#0e7490"
        />
        <KpiTile
          className="md:col-span-3 lg:col-span-3"
          icon={CheckCircle2}
          label="Fullført i mai"
          value={`${summary.completedThisMonth}`}
          sub="Bevisførsel klar"
          accent="#16A34A"
        />

        {/* Upcoming week — medium */}
        <section
          className="md:col-span-6 lg:col-span-6 rounded-2xl border border-neutral-200/80 bg-white p-5"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <header className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
              <CalendarRange className="h-3.5 w-3.5" />
              Neste 14 dager
            </p>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-700">
              {upcoming.length} oppgaver
            </span>
          </header>
          <ul className="mt-4 space-y-2">
            {upcoming.slice(0, 4).map((t) => {
              const priority = PRIORITY_META[t.priority]
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200/70 bg-neutral-50/40 px-3 py-2"
                >
                  <p className="min-w-0 flex-1 text-[13px] font-medium text-neutral-900">{t.title}</p>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${priority.chip}`}>
                    {priority.label}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-neutral-700">{t.due}</span>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Suggestion / AI tile */}
        <section
          className="md:col-span-6 lg:col-span-6 flex flex-col rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50/50 p-5"
        >
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-800">
            <Sparkles className="h-3.5 w-3.5" />
            Foreslått handling
          </p>
          <h3
            className="mt-3 text-[20px] font-semibold leading-tight text-neutral-900"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
          >
            Tre oppgaver kolliderer i juni — flytt vernerunden til juli?
          </h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-700">
            Eier «Hovedverneombud» har tre samtidige rutiner uke 25. Flytt vernerunden ut én
            uke for bedre kapasitet.
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <Button variant="secondary">Vis kollisjonen</Button>
            <Button variant="primary">Aksepter</Button>
          </div>
        </section>

        {/* Footer band — bevisjournal */}
        <section
          className="md:col-span-6 lg:col-span-12 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white px-5 py-4"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a3d32]/10 text-[#1a3d32]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-neutral-900">Alle ledd har bevisførsel</p>
              <p className="text-[11px] text-neutral-500">
                Hver oppgave kobles til §-grunnlag og loggføres i bevisjournalen — klart for Arbeidstilsynet.
              </p>
            </div>
          </div>
          <Button variant="ghost">
            Åpne bevisjournal
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        </section>
      </div>
    </div>
  )
}

function HeroTile({ obj }: { obj: typeof FIXTURE_OBJECTIVES[number] }) {
  const health = FIXTURE_HEALTH[obj.health]
  const progress =
    obj.keyResults.reduce((acc, k) => {
      const r = k.invert
        ? Math.max(0, Math.min(1, k.target / Math.max(k.current, 0.01)))
        : Math.min(1, k.current / Math.max(k.target, 0.01))
      return acc + r
    }, 0) / Math.max(obj.keyResults.length, 1)
  return (
    <section
      className="md:col-span-6 lg:col-span-6 rounded-2xl border border-neutral-200/80 bg-white p-6 lg:row-span-2"
      style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2f7757]">Hovedmål · {obj.horizon}</p>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ backgroundColor: health.soft, color: health.text }}
        >
          {health.label}
        </span>
      </header>
      <h2
        className="mt-4 text-[26px] font-semibold leading-[1.15] text-neutral-900"
        style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
      >
        {obj.title}
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-neutral-600">{obj.description}</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Samlet progresjon</p>
          <p
            className="text-3xl font-bold tabular-nums text-neutral-900"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
          >
            {Math.round(progress * 100)}%
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: health.dot }}
          />
        </div>
      </div>

      <ul className="mt-5 space-y-2.5 border-t border-neutral-200 pt-4">
        {obj.keyResults.map((kr) => {
          const ratio = kr.invert
            ? Math.max(0, Math.min(1, kr.target / Math.max(kr.current, 0.01)))
            : Math.min(1, kr.current / Math.max(kr.target, 0.01))
          const krHealth = FIXTURE_HEALTH[kr.health]
          return (
            <li key={kr.id} className="grid grid-cols-[1fr_80px] items-center gap-3">
              <p className="text-[13px] text-neutral-800 truncate">{kr.title}</p>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: krHealth.dot }}
                  />
                </div>
                <span className="font-mono text-[10.5px] font-bold tabular-nums text-neutral-700">
                  {Math.round(ratio * 100)}%
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function KpiTile({
  className,
  icon: Icon,
  label,
  value,
  sub,
  accent,
  tone = 'default',
}: {
  className?: string
  icon: typeof Target
  label: string
  value: string
  sub: string
  accent: string
  tone?: 'default' | 'danger'
}) {
  return (
    <section
      className={`rounded-2xl border border-neutral-200/80 bg-white p-5 ${className ?? ''}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
      </div>
      <p
        className={`mt-3 text-4xl font-bold tabular-nums ${tone === 'danger' ? 'text-red-700' : 'text-neutral-900'}`}
        style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[12px] text-neutral-500">{sub}</p>
    </section>
  )
}
