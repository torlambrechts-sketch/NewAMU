// Arbeidsmiljøstrategi — styreromsrapport (PDF/print).
//
// En-side oppsummering for AMU og styret. Ingen interaktive widgets;
// alt rendres statisk slik at `window.print()` produserer en stabil
// PDF. Bruker den globale print.css (skjuler nav/aside/header) +
// lokale `no-print`-klasser for siden-spesifikk chrome.
//
// Datakilde-mønster: samme hooks som ArbeidsmiljostrategiPage. Vi
// duplicerer komposisjonen heller enn å trekke ut en delt hook for
// nå — rapporten er en sannsynlig fremtidig kandidat for refaktor
// hvis vi får flere rapport-flater.

import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useLearning } from '../../hooks/useLearning'
import { useLearningCategories } from '../../hooks/useLearningCategories'
import { useLearningDatasets } from '../learning/dashboards/useLearningDatasets'
import { useChecklistModule } from '../../../modules/compliance/useChecklistModule'
import { useChecklistDatasets } from '../../../modules/compliance/dashboards/useChecklistDatasets'
import { useLicensedPacks } from '../../context/packContextValue'
import { useSurvey } from '../../../modules/survey/useSurvey'
import { useSurveyPacks } from '../../../modules/survey/useSurveyPacks'
import { useSurveyOrgTemplates } from '../../../modules/survey/useSurveyOrgTemplates'
import { useSurveyDatasets } from '../../../modules/survey/dashboards/useSurveyDatasets'
import { useTaskItemsData } from '../../../modules/tasks/useTaskItemsData'
import { useTasksDatasets } from '../../../modules/tasks/dashboards/useTasksDatasets'
import { useDocuments } from '../../hooks/useDocuments'
import { useDocumentsDatasets } from '../documents/dashboards/useDocumentsDatasets'
import { useVernerunderDatasets } from '../../../modules/vernerunder/dashboards/useVernerunderDatasets'
import {
  useWorkerWellbeingDatasets,
  WELLBEING_AXIS_LABELS,
  WELLBEING_AXIS_LAW,
  type WellbeingAxisKey,
} from './dashboards/useWorkerWellbeingDatasets'
import { useWellbeingStrategy } from './hooks/useWellbeingStrategy'
import { useWellbeingSnapshots } from './hooks/useWellbeingSnapshots'

type AxisOverviewRow = {
  axis: string
  score: string
  signal: string
  nextMove: string
}

type ActionRow = {
  axis: string
  item: string
  severity: string
  origin: string
}

type FocusRow = {
  id: string
  axis_key: WellbeingAxisKey
  title: string
  body_md: string | null
  target_metric: string | null
}

export function ArbeidsmiljostrategiRapportPage() {
  const orgSetup = useOrgSetupContext()
  const { supabase, organization } = orgSetup

  // ── Source data (samme komposisjon som ArbeidsmiljostrategiPage) ─────────
  const cl = useChecklistModule({ supabase })
  const packs = useLicensedPacks()
  const survey = useSurvey({ supabase })
  const { packs: surveyPacks } = useSurveyPacks({ supabase })
  const surveyOrgTemplates = useSurveyOrgTemplates({ supabase })
  const tasksApi = useTaskItemsData()
  const learning = useLearning()
  const cats = useLearningCategories({ supabase })
  const docs = useDocuments()
  const wellbeingStrategy = useWellbeingStrategy()
  const snapshots = useWellbeingSnapshots()

  const categoryByCatalogId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const t of surveyOrgTemplates.templates) m.set(t.catalogId, t.categoryId)
    return m
  }, [surveyOrgTemplates.templates])

  // Bruker ingen filter-chips på rapporten — vi vil ha hele bildet.
  const filters = useMemo(() => [], [])

  const checklistDs = useChecklistDatasets({
    filters,
    executions: cl.executions,
    responsesByExecutionId: cl.responsesByExecutionId,
    templates: cl.templates,
    packs,
    locations: orgSetup.locations,
    departments: orgSetup.departments,
  })
  const surveyDs = useSurveyDatasets({
    filters,
    surveys: survey.surveys,
    templateCatalog: survey.templateCatalog,
    packs: surveyPacks,
    locations: orgSetup.locations,
    departments: orgSetup.departments,
    categoryByCatalogId,
  })
  const tasksDs = useTasksDatasets(
    tasksApi.items.map((t) => ({
      id: t.id,
      status: t.status,
      priority: t.priority,
      templateKind: t.templateKind,
      templateSlug: t.templateSlug,
      templateName: null,
      dueDate: t.dueDate,
      slaDueAt: t.slaDueAt,
      closedAt: t.closedAt,
      createdAt: t.createdAt,
    })),
    filters,
  )
  const learningDs = useLearningDatasets({
    filters,
    courses: learning.courses,
    progress: learning.progress,
    certificates: learning.certificates,
    categories: cats.categories,
    members: orgSetup.members,
    departments: orgSetup.departments,
  })
  const accessRequestsOpen = useMemo(
    () => docs.wikiAccessRequests.filter((r) => r.status === 'pending').length,
    [docs.wikiAccessRequests],
  )
  const documentsDs = useDocumentsDatasets({
    filters,
    pages: docs.pages,
    spaces: docs.spaces,
    orgCustomTemplates: docs.orgCustomTemplates,
    accessRequestsOpen,
  })
  const vernerunderDs = useVernerunderDatasets({ filters })

  const memberDatasets = useMemo<Record<string, unknown>>(
    () => ({ ...checklistDs, ...surveyDs, ...tasksDs, ...learningDs, ...documentsDs, ...vernerunderDs }),
    [checklistDs, surveyDs, tasksDs, learningDs, documentsDs, vernerunderDs],
  )
  const wellbeingDs = useWorkerWellbeingDatasets({
    memberDatasets,
    weights: wellbeingStrategy.weights,
    indexHistory: snapshots.series,
    snapshotHistory: snapshots.snapshots,
  })

  const indexSummary = (wellbeingDs['wellbeing_index_summary'] as Record<string, unknown> | undefined) ?? {}
  const indexLabel = typeof indexSummary.indexLabel === 'string' ? indexSummary.indexLabel : '—'
  const indexDelta = typeof indexSummary.indexDelta === 'string' ? indexSummary.indexDelta : ''
  const axisOverview = (wellbeingDs['wellbeing_axis_overview'] as AxisOverviewRow[] | undefined) ?? []
  const actionQueue = (wellbeingDs['wellbeing_action_queue'] as ActionRow[] | undefined) ?? []
  const trendPoints = (wellbeingDs['wellbeing_index_over_time'] as Array<{ x: string; y: number; hasData?: boolean }> | undefined) ?? []

  const focusAreas = wellbeingStrategy.focusAreas as FocusRow[]

  // Auto-trigger print-dialog når brukeren navigerer hit fra «Skriv ut
  // rapport»-CTAen via `?autoprint=1`. Vi unngår å re-trigge ved hver
  // mount — kjør én gang etter at data har stabilisert seg.
  const printedRef = useRef(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('autoprint') !== '1') return
    if (printedRef.current) return
    if (cl.loading || survey.loading || learning.learningLoading || wellbeingStrategy.loading) return
    printedRef.current = true
    // Litt forsinkelse så DOM rekker å rendre layout før print-dialog
    // åpnes — uten dette får man ofte en tom første side.
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [cl.loading, survey.loading, learning.learningLoading, wellbeingStrategy.loading])

  const reportDate = new Date().toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const orgName = organization?.name?.trim() || 'Organisasjon'

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 print:bg-white">
      {/* On-screen chrome — hidden when printing */}
      <div className="no-print sticky top-0 z-10 border-b border-neutral-200 bg-white px-6 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <Link
            to="/overview/arbeidsmiljostrategi"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Tilbake til Arbeidsmiljøstrategi
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
          >
            <Printer className="h-4 w-4" aria-hidden /> Skriv ut / lagre som PDF
          </button>
        </div>
      </div>

      {/* The report itself — A4-friendly width */}
      <article className="mx-auto max-w-3xl bg-white px-10 py-10 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {/* Title block */}
        <header className="border-b-2 border-amber-600 pb-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
            Styreromsrapport · AML kap. 4
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
            Arbeidsmiljøstrategi — {orgName}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Status per {reportDate}. Rapporten viser hvordan organisasjonen lever opp til
            arbeidsmiljølovens intensjon: trygghet, trivsel, medvirkning og mestring — ikke
            paragraf-dekning, men utfall for de ansatte.
          </p>
        </header>

        {/* Vision + mission */}
        <Section title="Vår vilje">
          {wellbeingStrategy.strategy?.vision_md?.trim() ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Visjon</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                  {wellbeingStrategy.strategy.vision_md}
                </p>
              </div>
              {wellbeingStrategy.strategy?.mission_md?.trim() && (
                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Misjon</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                    {wellbeingStrategy.strategy.mission_md}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm italic text-neutral-500">
              Ingen visjon eller misjon er formulert ennå. Strategien blir tydeligere når disse
              er på plass — det binder verktøyene mot ett felles mål.
            </p>
          )}
        </Section>

        {/* Focus areas */}
        {focusAreas.length > 0 && (
          <Section title="Fokusområder i år">
            <ul className="space-y-2">
              {focusAreas.map((f) => (
                <li key={f.id} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-sm font-semibold text-neutral-900">{f.title}</h4>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      {WELLBEING_AXIS_LABELS[f.axis_key]}
                    </span>
                  </div>
                  {f.body_md && (
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-neutral-700">{f.body_md}</p>
                  )}
                  {f.target_metric && (
                    <p className="mt-1 text-[11px] font-medium text-neutral-600">
                      Mål: <span className="font-semibold text-neutral-800">{f.target_metric}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Index + axis snapshot */}
        <Section title="Arbeidsmiljø-indeks (0–100)">
          <div className="flex flex-wrap items-baseline justify-between gap-3 rounded-md border-2 border-amber-300 bg-amber-50/60 px-5 py-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Samlet indeks</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-amber-900">{indexLabel}</span>
                <span className="text-sm text-neutral-500">av 100</span>
                {indexDelta && (
                  <span className="text-xs font-semibold text-neutral-700">({indexDelta} vs forrige måned)</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 text-[11px] text-neutral-700">
              {(['trygghet', 'trivsel', 'medvirkning', 'mestring'] as WellbeingAxisKey[]).map((k) => {
                const v = indexSummary[k]
                return (
                  <div key={k} className="text-center">
                    <div className="font-semibold uppercase tracking-wide text-neutral-500">{WELLBEING_AXIS_LABELS[k]}</div>
                    <div className="mt-0.5 text-lg font-bold text-neutral-900">{typeof v === 'string' ? v : '—'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </Section>

        {/* Trend chart */}
        <Section title="Indeks-trend · 12 måneder">
          <TrendChart points={trendPoints} />
        </Section>

        {/* Per-axis breakdown */}
        <Section title="Akser i detalj">
          <ul className="space-y-3">
            {axisOverview.map((row, idx) => {
              const axisKey = (['trygghet', 'trivsel', 'medvirkning', 'mestring'] as WellbeingAxisKey[])[idx]
              return (
                <li key={row.axis} className="rounded-md border border-neutral-200 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-sm font-semibold text-neutral-900">
                      {WELLBEING_AXIS_LABELS[axisKey]} <span className="text-xs font-normal text-neutral-500">· {WELLBEING_AXIS_LAW[axisKey]}</span>
                    </h4>
                    <span className="text-base font-bold text-amber-900">{row.score}</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-700">
                    <span className="font-semibold text-neutral-800">Signal:</span> {row.signal}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-700">
                    <span className="font-semibold text-neutral-800">Neste steg:</span> {row.nextMove}
                  </p>
                </li>
              )
            })}
          </ul>
        </Section>

        {/* Action queue */}
        {actionQueue.length > 0 && (
          <Section title="Krever oppmerksomhet">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-3 font-semibold">Akse</th>
                  <th className="py-2 pr-3 font-semibold">Sak</th>
                  <th className="py-2 pr-3 font-semibold">Alvorlighet</th>
                  <th className="py-2 font-semibold">Kilde</th>
                </tr>
              </thead>
              <tbody>
                {actionQueue.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-100 align-top">
                    <td className="py-2 pr-3 font-semibold text-neutral-800">{row.axis}</td>
                    <td className="py-2 pr-3 text-neutral-700">{row.item}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          row.severity === 'Kritisk'
                            ? 'bg-rose-100 text-rose-900'
                            : row.severity === 'Høy'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {row.severity}
                      </span>
                    </td>
                    <td className="py-2 text-neutral-600">{row.origin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Footer — sign-off */}
        <footer className="mt-8 border-t border-neutral-300 pt-5">
          <p className="text-[11px] leading-relaxed text-neutral-600">
            Rapporten er bygget på datapunkter fra vernerunder, psykososial undersøkelse, AMU- og
            verneombud-møter, avviks- og hendelsesregistreringer og læring. Indeksen er et vektet
            snitt; vektingen kan justeres for å reflektere organisasjonens prioriteringer. Lov-
            hjemmel: arbeidsmiljøloven § 1-1, kap. 4 og § 3-1 (b) om mål for HMS-arbeidet.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-10 text-xs">
            <div>
              <div className="h-12 border-b border-neutral-400" />
              <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">HMS-leder</div>
              <div className="text-neutral-700">Dato:</div>
            </div>
            <div>
              <div className="h-12 border-b border-neutral-400" />
              <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">AMU-leder</div>
              <div className="text-neutral-700">Dato:</div>
            </div>
          </div>
          <p className="mt-6 text-center text-[10px] text-neutral-400">
            Generert {reportDate} via Klarert · Arbeidsmiljøstrategi v1
          </p>
        </footer>
      </article>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          .no-print { display: none !important; }
          body { background: white !important; }
          article { page-break-inside: auto; }
          section { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-700">{title}</h2>
      {children}
    </section>
  )
}

/**
 * Minimal SVG-trend — print-vennlig, ingen runtime-avhengigheter. Tar en
 * 12-punkts serie og rendrer en linje + dots der hasData er sann. Tomme
 * måneder vises som hull (ingen dot) men holder x-aksens kadens.
 */
function TrendChart({ points }: { points: Array<{ x: string; y: number; hasData?: boolean }> }) {
  const W = 640
  const H = 160
  const PAD = { top: 16, right: 16, bottom: 28, left: 32 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const hasAny = points.some((p) => p.hasData)
  const yMin = 0
  const yMax = 100
  const yRange = yMax - yMin

  if (!hasAny) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-6 text-center text-xs text-neutral-500">
        Ingen historiske snapshots ennå. Et nytt snapshot lagres månedlig så snart noen åpner
        Arbeidsmiljøstrategi-siden.
      </div>
    )
  }

  const xFor = (idx: number) => PAD.left + (idx / Math.max(1, points.length - 1)) * innerW
  const yFor = (v: number) => PAD.top + innerH - ((v - yMin) / yRange) * innerH

  // Bygg path: starter ved første hasData-punkt, hopp over hull med 'M'
  // for å unngå rette streker gjennom tomme måneder.
  const pathSegments: string[] = []
  let inLine = false
  points.forEach((p, i) => {
    if (!p.hasData) {
      inLine = false
      return
    }
    const cmd = inLine ? 'L' : 'M'
    pathSegments.push(`${cmd} ${xFor(i).toFixed(1)} ${yFor(p.y).toFixed(1)}`)
    inLine = true
  })
  const pathD = pathSegments.join(' ')

  // Gridlinjer ved 0, 25, 50, 75, 100
  const grid = [0, 25, 50, 75, 100]

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Indeks over tid">
        {grid.map((g) => (
          <g key={g}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yFor(g)}
              y2={yFor(g)}
              stroke="#e5e5e5"
              strokeWidth={0.5}
            />
            <text x={PAD.left - 4} y={yFor(g) + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
              {g}
            </text>
          </g>
        ))}
        <path d={pathD} fill="none" stroke="#d97706" strokeWidth={1.75} />
        {points.map((p, i) =>
          p.hasData ? (
            <circle key={i} cx={xFor(i)} cy={yFor(p.y)} r={2.4} fill="#d97706" />
          ) : null,
        )}
        {points.map((p, i) => (
          <text key={`x-${i}`} x={xFor(i)} y={H - 10} textAnchor="middle" fontSize={9} fill="#6b7280">
            {p.x}
          </text>
        ))}
      </svg>
    </div>
  )
}
