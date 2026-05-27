// Hub page for the /platform-admin/planlegging-iterations design exploration.
//
// Shows the five iterations as cards (eyebrow, name, intent, when-to-use,
// primary primitives used), plus inline live previews below each card so
// reviewers can scroll through all five styles on one screen.
//
// The chrome here is the dark plattformadmin shell; each iteration
// renders inside a light "preview frame" so the workspace surfaces (cream
// canvas, white cards) look as they would in the real app.

import type { ReactElement } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, BookOpen, CalendarRange, Compass, Eye, Gauge, KanbanSquare, type LucideIcon } from 'lucide-react'
import { PlanleggingIteration1Editorial } from './planleggingIterations/PlanleggingIteration1Editorial'
import { PlanleggingIteration2Console } from './planleggingIterations/PlanleggingIteration2Console'
import { PlanleggingIteration3Focus } from './planleggingIterations/PlanleggingIteration3Focus'
import { PlanleggingIteration4Kanban } from './planleggingIterations/PlanleggingIteration4Kanban'
import { PlanleggingIteration5Timeline } from './planleggingIterations/PlanleggingIteration5Timeline'

type IterationCard = {
  id: string
  slug: string
  eyebrow: string
  name: string
  intent: string
  whenToUse: string
  primitives: string[]
  accent: string
  icon: LucideIcon
  Component: () => ReactElement
}

const ITERATIONS: IterationCard[] = [
  {
    id: '01',
    slug: 'editorial',
    eyebrow: '01 · Editorial',
    name: 'Magasin-stil',
    intent:
      'Strategien fortelles som en redaksjonell historie — serif H1, åpne margin, en KPI-rad i kremede ark og 7/3-split for OKR-narrativ + "ukens beats".',
    whenToUse:
      'Når Planlegging skal lese som virksomhetens årsplan: AMU-gjennomgang, halvårspresentasjoner, eier-møter.',
    primitives: ['WorkplaceDashboardShell', 'WorkplaceSplit7030Layout', 'WorkplaceSerifSectionTitle'],
    accent: '#1a3d32',
    icon: BookOpen,
    Component: PlanleggingIteration1Editorial,
  },
  {
    id: '02',
    slug: 'console',
    eyebrow: '02 · Command Console',
    name: 'Operativ konsoll',
    intent:
      'Tett pakket arbeidsoverflate med KPI + delta-piler, hub-meny med tellere, og WorkplaceStandardListLayout-toolbar med søk, filter og tabell/boks/liste-veksler.',
    whenToUse:
      'For HMS-leder eller HR-leder som driver dag-til-dag: dypdykk i forfalte oppgaver, status-fanen som hovedvisning, filter etter eier.',
    primitives: ['WorkplaceStandardListLayout', 'WorkplaceListToolbar', 'HubMenu1Bar'],
    accent: '#c2410c',
    icon: Gauge,
    Component: PlanleggingIteration2Console,
  },
  {
    id: '03',
    slug: 'focus',
    eyebrow: '03 · Calm Focus',
    name: 'Rolig fokus',
    intent:
      'Én lesbar kolonne. 17 px serif kropp, generøs vertikal rytme, ingen filter-toolbar. Tre seksjoner: ambisjon, kadens, neste leveranser.',
    whenToUse:
      'Når lederen vil ha en bevisst, fortellende oversikt — eller når Planlegging brukes som "én-sides brief" til daglig leder før et styremøte.',
    primitives: ['WorkplacePageHeading1', 'WorkplaceSerifSectionTitle'],
    accent: '#0f766e',
    icon: Eye,
    Component: PlanleggingIteration3Focus,
  },
  {
    id: '04',
    slug: 'kanban',
    eyebrow: '04 · Kanban Studio',
    name: 'Tavle-først',
    intent:
      'Hele planen som ett brett. Pulse-felter på toppen, lens-bytte (status / mål / eier), tette kort med eier-initialer, §-referanse, frist-merking og kadens-flagg.',
    whenToUse:
      'For utførende team — mellomledere, verneombud, fag-eiere — som vil ha hele tavla på én skjerm og dra-prioritere visuelt.',
    primitives: ['WorkplacePageHeading1', 'HubMenu1Bar'],
    accent: '#4338ca',
    icon: KanbanSquare,
    Component: PlanleggingIteration4Kanban,
  },
  {
    id: '05',
    slug: 'timeline',
    eyebrow: '05 · Horisont (tidslinje)',
    name: 'Kvartal-horisont',
    intent:
      'Kvartal-bånd som sticky topp. Per mål: KR-progresjon som horisontale stolper langs Q1–Q4, og oppgavene plassert som chips i sitt kvartal. Kadenser i sidefeltet.',
    whenToUse:
      'For strategi-eiere og daglig leder som planlegger på 6–12-måneders horisont og må se hva som kolliderer i Q3 vs Q4.',
    primitives: ['WorkplaceDashboardShell', 'WorkplaceSplit7030Layout', 'WorkplaceSerifSectionTitle'],
    accent: '#0891b2',
    icon: CalendarRange,
    Component: PlanleggingIteration5Timeline,
  },
]

export function PlanleggingIterationsHubPage() {
  const location = useLocation()
  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400/90">
            UI-utforskning
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Planlegging — fem iterasjoner
          </h1>
          <p className="text-sm leading-relaxed text-neutral-400">
            Fem stilistiske retninger for <code className="rounded bg-white/10 px-1 py-0.5 text-amber-200/90">/planlegging</code>,
            alle bygget på samme primitiver fra{' '}
            <Link to="/platform-admin/layout" className="font-medium text-amber-300 underline hover:text-amber-200">
              /platform-admin/layout
            </Link>
            : <code className="rounded bg-white/10 px-1 text-xs">WorkplaceDashboardShell</code>,{' '}
            <code className="rounded bg-white/10 px-1 text-xs">WorkplaceStandardListLayout</code>,{' '}
            <code className="rounded bg-white/10 px-1 text-xs">WorkplaceSplit7030Layout</code>,{' '}
            <code className="rounded bg-white/10 px-1 text-xs">WorkplacePageHeading1</code> og{' '}
            <code className="rounded bg-white/10 px-1 text-xs">HubMenu1Bar</code>. Hver iterasjon tester en hypotese om
            hvordan strategi, kadens og oppgaver bør prioriteres visuelt.
          </p>
        </div>
        <div
          aria-hidden
          className="hidden h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300 lg:flex"
        >
          <Compass className="h-12 w-12" />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ITERATIONS.map((it) => {
          const Icon = it.icon
          const isActive = location.hash === `#${it.slug}`
          return (
            <a
              key={it.id}
              href={`#${it.slug}`}
              className={`group flex flex-col gap-3 rounded-2xl border p-5 text-left transition ${
                isActive
                  ? 'border-amber-400/60 bg-amber-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${it.accent}25`, color: '#FDE68A' }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-neutral-500">
                  {it.id}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-400/90">
                  {it.eyebrow.split('·')[1]?.trim() ?? it.eyebrow}
                </p>
                <p className="mt-1 text-base font-semibold leading-snug text-white">{it.name}</p>
              </div>
              <p className="text-xs leading-relaxed text-neutral-400 line-clamp-3">{it.intent}</p>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-amber-300 group-hover:text-amber-200">
                Bla til forhåndsvisning
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </a>
          )
        })}
      </section>

      <div className="space-y-12">
        {ITERATIONS.map((it) => {
          const Component = it.Component
          return (
            <section
              key={it.id}
              id={it.slug}
              className="scroll-mt-24 space-y-4"
            >
              <div className="flex flex-col gap-2 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 max-w-2xl space-y-1.5">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: '#FCD34D' }}
                  >
                    {it.eyebrow}
                  </p>
                  <h2 className="text-xl font-semibold text-white">{it.name}</h2>
                  <p className="text-sm leading-relaxed text-neutral-400">{it.intent}</p>
                  <p className="text-xs leading-relaxed text-neutral-500">
                    <strong className="font-semibold text-neutral-300">Bruk når:</strong> {it.whenToUse}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-neutral-500">
                    {it.primitives.map((p) => (
                      <code
                        key={p}
                        className="rounded bg-white/5 px-1.5 py-0.5 text-amber-200/80"
                      >
                        {p}
                      </code>
                    ))}
                  </p>
                </div>
                <Link
                  to={`/platform-admin/planlegging-iterations/${it.slug}`}
                  className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-white/10"
                >
                  Åpne i full bredde
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <Component />
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** Solo-pages used by /platform-admin/planlegging-iterations/<slug>. */
export function PlanleggingIterationSoloPage({ slug }: { slug: string }) {
  const it = ITERATIONS.find((x) => x.slug === slug)
  if (!it) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
        <p className="text-sm">Ukjent iterasjon: {slug}</p>
        <Link
          to="/platform-admin/planlegging-iterations"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-300 underline hover:text-amber-200"
        >
          Tilbake til iterasjons-hub
        </Link>
      </div>
    )
  }
  const Component = it.Component
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-400/90">
            {it.eyebrow}
          </p>
          <h1 className="text-xl font-semibold text-white">{it.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">{it.intent}</p>
        </div>
        <Link
          to="/platform-admin/planlegging-iterations"
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200 hover:bg-white/10"
        >
          ← Tilbake til alle fem
        </Link>
      </div>
      <Component />
    </div>
  )
}
