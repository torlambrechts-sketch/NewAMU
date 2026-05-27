// Iteration 3 — "Calm Focus".
//
// Single-column layout with deliberate vertical rhythm: large readable
// type, generous whitespace between sections, no toolbars, no badges
// that aren't earned. The page reads top-to-bottom like a one-page brief
// you'd hand a manager: "this is what we're aiming for, this is the
// rhythm, this is what's open this week."
//
// Built on WorkplacePageHeading1 (no shell) so we control the rhythm.

import { useMemo } from 'react'
import { ArrowRight, CalendarCheck, Compass, Sparkles } from 'lucide-react'
import {
  WorkplacePageHeading1,
  WorkplaceSerifSectionTitle,
  WORKPLACE_PAGE_SERIF,
} from '../../../components/layout/WorkplacePageHeading1'
import { Button } from '../../../components/ui/Button'
import {
  FIXTURE_HEALTH,
  FIXTURE_OBJECTIVES,
  FIXTURE_TASKS,
  computeFixtureSummary,
} from './planleggingIterationsData'

const FOCUS_CANVAS = '#FAF8F1'

export function PlanleggingIteration3Focus() {
  const summary = useMemo(() => computeFixtureSummary(), [])
  const overallPct = Math.round(summary.krProgress * 100)
  const thisWeek = FIXTURE_TASKS.filter((t) => t.daysToDue >= 0 && t.daysToDue <= 14 && t.status !== 'fullført').slice(0, 4)

  return (
    <div
      className="rounded-2xl border border-white/10 px-6 py-10 md:px-12 md:py-14"
      style={{ backgroundColor: FOCUS_CANVAS }}
    >
      <div className="mx-auto max-w-[760px]">
        <WorkplacePageHeading1
          breadcrumb={[
            { label: 'Plattformadmin', to: '/platform-admin' },
            { label: 'Planlegging-iterasjoner', to: '/platform-admin/planlegging-iterations' },
            { label: '03 · Calm Focus' },
          ]}
          title="Planlegging, i ro"
          description={
            <p className="text-[17px] leading-[1.7] text-neutral-700">
              Én side. Tre spørsmål: hva er ambisjonen, hvilken kadens holder oss i form,
              og hva er det neste vi skal levere?
            </p>
          }
        />

        {/* Section 1 — Ambisjon */}
        <section className="mt-16 space-y-6">
          <SectionEyebrow step="01" label="Ambisjon" />
          <WorkplaceSerifSectionTitle>Helheten vi sikter mot</WorkplaceSerifSectionTitle>

          <div
            className="rounded-2xl border border-neutral-200/80 bg-white px-7 py-7"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Samlet OKR-progresjon
            </p>
            <p
              className="mt-3 text-[64px] font-semibold leading-none tabular-nums text-neutral-900"
              style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
            >
              {overallPct}%
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
              {summary.objectiveTotal} mål, {summary.krTotal} nøkkelresultater. {summary.objectivesOnTrack} mål er på spor;{' '}
              {summary.objectivesAtRisk} trenger oppmerksomhet, {summary.objectivesOffTrack} har avveket vesentlig.
            </p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-[#1a3d32] transition-all"
                style={{ width: `${overallPct}%` }}
              />
            </div>
          </div>

          <div className="space-y-6">
            {FIXTURE_OBJECTIVES.map((obj) => {
              const health = FIXTURE_HEALTH[obj.health]
              return (
                <article key={obj.id} className="py-3">
                  <div className="flex items-start justify-between gap-4">
                    <h3
                      className="text-[22px] font-semibold leading-[1.35] text-neutral-900"
                      style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
                    >
                      {obj.title}
                    </h3>
                    <span
                      className="mt-1 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ backgroundColor: health.soft, color: health.text }}
                    >
                      {health.label}
                    </span>
                  </div>
                  <p className="mt-3 text-[15.5px] leading-[1.65] text-neutral-700">{obj.description}</p>
                  <p className="mt-4 text-[12px] text-neutral-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-700">
                        {obj.ownerInit}
                      </span>
                      {obj.owner}
                    </span>
                    <span className="mx-3 text-neutral-300">·</span>
                    {obj.horizon}
                    <span className="mx-3 text-neutral-300">·</span>
                    {obj.keyResults.length} nøkkelresultater
                  </p>
                </article>
              )
            })}
          </div>
        </section>

        {/* Section 2 — Kadens */}
        <section className="mt-20 space-y-6">
          <SectionEyebrow step="02" label="Kadens" />
          <WorkplaceSerifSectionTitle>Pulsen som holder oss i form</WorkplaceSerifSectionTitle>

          <p className="max-w-[60ch] text-[15.5px] leading-[1.7] text-neutral-700">
            {summary.activeCadences} av {summary.catalogCadences} regulatoriske rutiner er aktive. Dette er rytmen som binder
            ambisjon til arbeid — uten den blir hver mål-gjennomgang en brannslukning.
          </p>

          <div
            className="grid gap-4 rounded-2xl border border-neutral-200/80 bg-white px-7 py-6 sm:grid-cols-2"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <CalmStat label="Aktive rutiner" value={`${summary.activeCadences}`} sub="av 8 i katalogen" />
            <CalmStat label="Forfalt" value={`${summary.overdueTasks}`} sub="krever oppmerksomhet" tone="warn" />
            <CalmStat label="Åpne oppgaver" value={`${summary.openTasks}`} sub="totalt på tvers av eierne" />
            <CalmStat label="Fullført i mai" value={`${summary.completedThisMonth}`} sub="bevisførsel klar" />
          </div>

          <div className="pt-2">
            <Button variant="ghost" className="-ml-2">
              <Compass className="mr-1 h-4 w-4" />
              Åpne kadens-katalogen
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Section 3 — Neste leveranser */}
        <section className="mt-20 space-y-6">
          <SectionEyebrow step="03" label="Neste leveranser" />
          <WorkplaceSerifSectionTitle>De fire neste tingene som skal leveres</WorkplaceSerifSectionTitle>

          <ol className="space-y-5">
            {thisWeek.map((t, i) => (
              <li key={t.id} className="flex gap-5">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white font-mono text-[13px] font-bold text-neutral-700"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                >
                  0{i + 1}
                </span>
                <div className="min-w-0 flex-1 border-b border-neutral-200/80 pb-5">
                  <p className="text-[16px] font-medium leading-snug text-neutral-900">{t.title}</p>
                  <p className="mt-1.5 text-[13px] text-neutral-500">
                    <span className="font-medium text-neutral-700">{t.owner}</span>
                    {t.lawRef ? <> · <span className="font-mono">{t.lawRef}</span></> : null}
                  </p>
                  <p className="mt-1 text-[12.5px] text-neutral-500">
                    Forfall <span className="font-mono tabular-nums">{t.due}</span> · om {t.daysToDue} dager
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 rounded-2xl bg-[#1a3d32] px-7 py-7 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">Anbefaling</p>
              <p
                className="mt-2 text-[22px] font-semibold leading-snug"
                style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
              >
                Aktiver pulsmåling før Q3 — det er den enkleste innsatsen som flytter MO-indeksen.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Sparkles className="h-4 w-4" />}>
                Forklar
              </Button>
              <Button variant="primary" icon={<CalendarCheck className="h-4 w-4" />}>
                Aktiver
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function SectionEyebrow({ step, label }: { step: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-neutral-400">{step}</span>
      <span className="h-px flex-1 bg-neutral-200" />
      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500">{label}</span>
    </div>
  )
}

function CalmStat({
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
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          tone === 'warn' ? 'text-amber-800' : 'text-neutral-900'
        }`}
        style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
      >
        {value}
      </p>
      <p className="mt-1 text-[13px] text-neutral-500">{sub}</p>
    </div>
  )
}
