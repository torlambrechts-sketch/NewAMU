// Iteration 1 — "Editorial".
//
// Magazine-style strategy hub. Big serif H1, generous whitespace, a quiet
// KPI strip, and a 7/3 split where the main column is a typeset OKR
// narrative and the aside is "this week's beats". Tone: confident, calm,
// reads like a printed annual plan.
//
// Built on WorkplaceDashboardShell + WorkplaceSplit7030Layout from
// /platform-admin/layout. Hub menu lives under the heading to switch the
// three planning sections.

import { useMemo, useState } from 'react'
import { ArrowUpRight, BookOpen, CalendarDays, ChevronRight, Share2, Sparkles, UserCheck } from 'lucide-react'
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
  PLAN_SECTION_ICONS,
  computeFixtureSummary,
} from './planleggingIterationsData'

const ITERATION_CREAM = '#F9F7F2'
const ITERATION_PAPER = '#FFFDF7'

export function PlanleggingIteration1Editorial() {
  const [section, setSection] = useState<'strategi' | 'kadens' | 'oversikt'>('strategi')
  const summary = useMemo(() => computeFixtureSummary(), [])

  const hubItems: HubMenu1Item[] = [
    {
      key: 'strategi',
      label: 'Strategi & OKR',
      icon: PLAN_SECTION_ICONS.strategi,
      active: section === 'strategi',
      onClick: () => setSection('strategi'),
      badgeCount: summary.objectiveTotal,
    },
    {
      key: 'kadens',
      label: 'Kadens-planlegger',
      icon: PLAN_SECTION_ICONS.kadens,
      active: section === 'kadens',
      onClick: () => setSection('kadens'),
      badgeCount: summary.activeCadences,
    },
    {
      key: 'oversikt',
      label: 'Oppgaver & prosjekter',
      icon: PLAN_SECTION_ICONS.oversikt,
      active: section === 'oversikt',
      onClick: () => setSection('oversikt'),
      badgeCount: summary.openTasks,
      badgeVariant: summary.overdueTasks > 0 ? 'danger' : 'default',
    },
  ]

  const kpiSlot = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <EditorialKpi
        eyebrow="Ambisjon"
        value={`${Math.round(summary.krProgress * 100)}%`}
        label="Samlet OKR-progresjon"
        sub={`${summary.krTotal} nøkkelresultater · ${summary.objectiveTotal} mål`}
      />
      <EditorialKpi
        eyebrow="Helse"
        value={`${summary.objectivesOnTrack}/${summary.objectiveTotal}`}
        label="Mål på spor"
        sub={`${summary.objectivesAtRisk} risiko · ${summary.objectivesOffTrack} ute av kurs`}
      />
      <EditorialKpi
        eyebrow="Kadens"
        value={`${summary.activeCadences}`}
        label="Faste rutiner aktive"
        sub={`${summary.catalogCadences - summary.activeCadences} tilgjengelig i katalogen`}
      />
      <EditorialKpi
        eyebrow="Tempo"
        value={`${summary.openTasks}`}
        label="Åpne oppgaver"
        sub={`${summary.overdueTasks} forfalt · ${summary.completedThisMonth} fullført i mai`}
        tone={summary.overdueTasks > 0 ? 'warn' : 'default'}
      />
    </div>
  )

  return (
    <div className="rounded-2xl border border-white/10 bg-[#F4EEDF] p-6 md:p-8" style={{ backgroundColor: ITERATION_CREAM }}>
      <WorkplaceDashboardShell
        breadcrumb={[
          { label: 'Plattformadmin', to: '/platform-admin' },
          { label: 'Planlegging-iterasjoner', to: '/platform-admin/planlegging-iterations' },
          { label: '01 · Editorial' },
        ]}
        title="Planlegging"
        description={
          <p
            className="text-base leading-relaxed text-neutral-700"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF, fontStyle: 'italic' }}
          >
            Fra ambisjon til kadens — én sammenhengende fortelling, fra Arbeidsmiljølovens krav
            til hver enkelt oppgave som beveger nålen.
          </p>
        }
        headerActions={
          <>
            <Button variant="secondary" icon={<Share2 className="h-4 w-4" />}>Del med AMU</Button>
            <Button variant="primary" icon={<Sparkles className="h-4 w-4" />}>Ny ambisjon</Button>
          </>
        }
        hubAriaLabel="Planlegging — seksjoner"
        hubItems={hubItems}
        kpiSlot={kpiSlot}
      >
        {section === 'strategi' ? <EditorialStrategi /> : null}
        {section === 'kadens' ? <EditorialKadens /> : null}
        {section === 'oversikt' ? <EditorialOversikt /> : null}
      </WorkplaceDashboardShell>
    </div>
  )
}

function EditorialKpi({
  eyebrow,
  value,
  label,
  sub,
  tone = 'default',
}: {
  eyebrow: string
  value: string
  label: string
  sub: string
  tone?: 'default' | 'warn'
}) {
  return (
    <div
      className="rounded-xl border border-neutral-200/70 p-5"
      style={{ backgroundColor: ITERATION_PAPER }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{eyebrow}</p>
      <p
        className="mt-3 text-4xl font-semibold tabular-nums text-neutral-900"
        style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
      >
        {value}
      </p>
      <p className="mt-2 text-sm font-medium text-neutral-900">{label}</p>
      <p className={`mt-1 text-xs leading-relaxed ${tone === 'warn' ? 'text-red-700' : 'text-neutral-500'}`}>{sub}</p>
    </div>
  )
}

function EditorialStrategi() {
  return (
    <WorkplaceSplit7030Layout
      main={
        <div className="space-y-8">
          <header className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2f7757]">Kapittel 01</p>
            <WorkplaceSerifSectionTitle>Tre mål for første halvår 2026</WorkplaceSerifSectionTitle>
            <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-700">
              Hver ambisjon brytes ned i nøkkelresultater, og hvert nøkkelresultat har en eier
              som bringer det til virksomheten gjennom kadens, prosjekter og oppgaver.
            </p>
          </header>

          <div className="space-y-8">
            {FIXTURE_OBJECTIVES.map((obj, i) => {
              const health = FIXTURE_HEALTH[obj.health]
              return (
                <article key={obj.id} className="border-t border-neutral-200/80 pt-7">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p
                      className="font-mono text-[12px] font-bold tracking-[0.18em] text-neutral-400"
                    >
                      0{i + 1} · {obj.horizon.toUpperCase()}
                    </p>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ backgroundColor: health.soft, color: health.text }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: health.dot }} />
                      {health.label}
                    </span>
                  </div>
                  <h3
                    className="mt-3 text-2xl font-semibold leading-snug text-neutral-900"
                    style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
                  >
                    {obj.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-700">{obj.description}</p>

                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-700">
                        {obj.ownerInit}
                      </span>
                      Eier: <strong className="font-semibold text-neutral-800">{obj.owner}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {obj.horizon}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      {obj.keyResults.length} nøkkelresultater
                    </span>
                  </div>

                  <ul className="mt-5 space-y-3">
                    {obj.keyResults.map((kr) => {
                      const krHealth = FIXTURE_HEALTH[kr.health]
                      const ratio = kr.invert
                        ? Math.max(0, Math.min(1, kr.target / Math.max(kr.current, 0.01)))
                        : Math.min(1, kr.current / Math.max(kr.target, 0.01))
                      return (
                        <li
                          key={kr.id}
                          className="grid gap-3 rounded-lg border border-neutral-200/80 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center"
                          style={{ backgroundColor: ITERATION_PAPER }}
                        >
                          <div className="min-w-0">
                            <p className="text-[15px] font-medium leading-snug text-neutral-900">{kr.title}</p>
                            <p className="mt-1 text-xs text-neutral-500">
                              Eier <span className="font-semibold text-neutral-700">{kr.owner}</span>
                              {' · '}
                              {kr.linkedTasks} koblede oppgaver
                            </p>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-baseline justify-between">
                              <p className="font-mono text-sm font-bold text-neutral-900 tabular-nums">
                                {kr.current} / {kr.target}
                                <span className="ml-1 text-[11px] font-normal text-neutral-500">{kr.unit}</span>
                              </p>
                              <span
                                className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                style={{ backgroundColor: krHealth.soft, color: krHealth.text }}
                              >
                                {Math.round(ratio * 100)}%
                              </span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: krHealth.dot }}
                              />
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </article>
              )
            })}
          </div>
        </div>
      }
      aside={
        <div className="space-y-6">
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Denne uken</p>
            <WorkplaceSerifSectionTitle as="h3" variant="compact">
              Tre ting som flytter målene
            </WorkplaceSerifSectionTitle>
            <ul className="space-y-3">
              {FIXTURE_TASKS.slice(0, 3).map((t) => (
                <li key={t.id} className="rounded-lg border border-neutral-200/80 p-3" style={{ backgroundColor: ITERATION_PAPER }}>
                  <p className="text-[13.5px] font-medium leading-snug text-neutral-900">{t.title}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                    <span className="inline-flex items-center gap-1">
                      <UserCheck className="h-3 w-3" />
                      {t.owner}
                    </span>
                    <span className="font-mono tabular-nums">{t.due}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 border-t border-neutral-200/80 pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Neste milepæl</p>
            <p
              className="text-2xl font-semibold leading-tight text-neutral-900"
              style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
            >
              Halvårsgjennomgang
            </p>
            <p className="text-sm leading-relaxed text-neutral-600">
              28. juni 2026 — AMU + ledelsen møtes for å gjennomgå alle mål, og dokumentere
              status i bevisjournalen.
            </p>
            <Button variant="ghost" className="-ml-2">
              Åpne agenda
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </section>
        </div>
      }
    />
  )
}

function EditorialKadens() {
  return (
    <WorkplaceSplit7030Layout
      main={
        <div className="space-y-6">
          <header className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2f7757]">Kapittel 02</p>
            <WorkplaceSerifSectionTitle>Kadensen som holder organisasjonen i form</WorkplaceSerifSectionTitle>
            <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-700">
              Velg de regulatoriske rutinene som passer for virksomheten. Hver kadens blir lagt
              til som vedvarende oppgaver i planen.
            </p>
          </header>
          <ul className="space-y-3">
            {FIXTURE_CADENCES.map((c) => {
              const meta = CADENCE_CATEGORY_META[c.category]
              const Icon = c.icon
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-4 rounded-lg border border-neutral-200/80 p-4"
                  style={{ backgroundColor: ITERATION_PAPER }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-[15px] font-semibold text-neutral-900">{c.title}</p>
                      {c.recommended ? (
                        <span className="rounded-full bg-[#1a3d32] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Anbefalt
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {FREQ_LABEL[c.freq]} · {meta.label} · {c.lawRefs.join(', ')} · Eier: {c.owner}
                    </p>
                  </div>
                  <Button
                    variant={c.enabled ? 'primary' : 'secondary'}
                    className="shrink-0"
                  >
                    {c.enabled ? 'Aktiv' : 'Legg til'}
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      }
      aside={
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Sammendrag</p>
          <p
            className="text-2xl font-semibold leading-tight text-neutral-900"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
          >
            5 av 8 rutiner aktive
          </p>
          <p className="text-sm leading-relaxed text-neutral-600">
            Tre uaktive kadenser dekker områder hvor §-krav er svake eller frivillige.
            Vurder å aktivere én før neste AMU.
          </p>
          <Button variant="secondary">
            Anbefal til AMU
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      }
    />
  )
}

function EditorialOversikt() {
  const open = FIXTURE_TASKS.filter((t) => t.status !== 'fullført').slice(0, 6)
  return (
    <WorkplaceSplit7030Layout
      main={
        <div className="space-y-6">
          <header className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2f7757]">Kapittel 03</p>
            <WorkplaceSerifSectionTitle>Arbeid som er underveis</WorkplaceSerifSectionTitle>
            <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-700">
              Et utvalg av åpne oppgaver, gruppert etter eier — ikke etter status. Slik
              ser man fortellingen, ikke kolonnene.
            </p>
          </header>
          <ul className="space-y-3">
            {open.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-neutral-200/80 p-4"
                style={{ backgroundColor: ITERATION_PAPER }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[15px] font-medium leading-snug text-neutral-900">{t.title}</p>
                  <span className="font-mono text-xs tabular-nums text-neutral-500">{t.due}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {t.owner}
                  {t.lawRef ? <> · <span className="text-neutral-700">{t.lawRef}</span></> : null}
                </p>
              </li>
            ))}
          </ul>
        </div>
      }
      aside={
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Fortell videre</p>
          <p
            className="text-2xl font-semibold leading-tight text-neutral-900"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
          >
            Dette er øyeblikksbildet
          </p>
          <p className="text-sm leading-relaxed text-neutral-600">
            For tabeller, prosjekter og Kanban-visning åpnes detalj-perspektivet. Editorial-stilen
            holder oppmerksomheten på de få oppgavene som faktisk preger uka.
          </p>
        </div>
      }
    />
  )
}
