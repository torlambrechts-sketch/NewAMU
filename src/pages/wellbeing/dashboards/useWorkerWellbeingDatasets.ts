// useWorkerWellbeingDatasets — utfalls-aggregater på toppen av modulene.
//
// Hooken «komponerer» — den re-spør IKKE Supabase. Den tar inn de allerede
// beregnede datasetene fra hver medlems-hook (vernerunder, survey, tasks,
// learning), trekker ut nøkkelmetrikker, og publiserer fem nye datasets
// som er Arbeidsmiljøstrategi-spesifikke:
//
//   wellbeing_index_summary     — vektet helhets-indeks + de fire akse-skårene
//   wellbeing_axis_scores       — segments for bar/donut («akse → skår»)
//   wellbeing_axis_overview     — rader med akse + signal + foreslått neste steg
//   wellbeing_tool_coverage     — rader som binder verktøy til akse (statisk
//                                 kuratert i v1; planer å hente via law_refs[]
//                                 i fase 2)
//   wellbeing_action_queue      — topp-N elementer som krever umiddelbar
//                                 oppmerksomhet, hentet fra medlems-datasetene
//
// Skår-formler er bevisst enkle og symmetriske: alle 0-100, høyere er bedre.
// De er ikke validerte mål — de gir en pekepinn som AMU kan diskutere, ikke
// en sannferdig psykometrisk verdi.

import { useMemo } from 'react'

export type WellbeingAxisKey = 'trygghet' | 'trivsel' | 'medvirkning' | 'mestring'

export type WellbeingIndexWeights = Record<WellbeingAxisKey, number>

export const DEFAULT_WELLBEING_WEIGHTS: WellbeingIndexWeights = {
  trygghet: 0.25,
  trivsel: 0.25,
  medvirkning: 0.25,
  mestring: 0.25,
}

export const WELLBEING_AXIS_LABELS: Record<WellbeingAxisKey, string> = {
  trygghet: 'Trygghet',
  trivsel: 'Trivsel',
  medvirkning: 'Medvirkning',
  mestring: 'Mestring & utvikling',
}

export const WELLBEING_AXIS_LAW: Record<WellbeingAxisKey, string> = {
  trygghet: 'AML § 4-1, § 4-4',
  trivsel: 'AML § 4-3',
  medvirkning: 'AML § 2-3, kap. 6, kap. 7',
  mestring: 'AML § 3-2, § 4-2',
}

type KpiBag = Record<string, unknown>

function numAt(obj: unknown, key: string): number {
  if (!obj || typeof obj !== 'object') return 0
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function clamp01to100(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

// ── Per-akse skår ────────────────────────────────────────────────────────
// Hver formel returnerer 0-100. Når kildedata mangler returnerer vi `null`
// (axis-kortet rendrer da «Ikke målt ennå») i stedet for misvisende 0.

function scoreTrygghet(args: {
  vernerunde: KpiBag | undefined
  tasks: KpiBag | undefined
}): number | null {
  const vr = args.vernerunde
  const tasks = args.tasks
  if (!vr && !tasks) return null
  const findingsCritical = numAt(vr, 'findingsCritical')
  const findingsHigh = numAt(vr, 'findingsHigh')
  const findingsOpen = numAt(vr, 'findingsOpen')
  const tasksOverdue = numAt(tasks, 'overdue')
  // Strafferegnesett: kritiske funn 8 poeng, høy 4, øvrige åpne 1,
  // forfalt avvik 2. Start på 100 og trekk fra. Cap på 100 / gulv 0.
  const penalty =
    findingsCritical * 8 +
    findingsHigh * 4 +
    Math.max(0, findingsOpen - findingsCritical - findingsHigh) * 1 +
    tasksOverdue * 2
  return clamp01to100(100 - penalty)
}

function scoreTrivsel(args: { survey: KpiBag | undefined }): number | null {
  const s = args.survey
  if (!s) return null
  const total = numAt(s, 'total')
  if (total === 0) return null
  // I v1 bruker vi response-rate som proxy for psykososial dekning — har vi
  // ikke kjørte undersøkelser kan vi heller ikke uttale oss om trivsel.
  // En egen sub-skala-aggregering kan legges på i fase 2.
  const rate = numAt(s, 'responseRatePct')
  return clamp01to100(rate)
}

function scoreMedvirkning(args: { survey: KpiBag | undefined }): number | null {
  const s = args.survey
  if (!s) return null
  const total = numAt(s, 'total')
  if (total === 0) return null
  // Medvirkning v1: kombinasjon av response-rate (stemmen brukes) og
  // at det faktisk finnes lukkede undersøkelser (saksbehandling skjer).
  const rate = numAt(s, 'responseRatePct')
  const closedYtd = numAt(s, 'ytdClosed')
  const closedBoost = closedYtd > 0 ? 15 : 0
  return clamp01to100(rate + closedBoost)
}

function scoreMestring(args: { learning: KpiBag | undefined }): number | null {
  const l = args.learning
  if (!l) return null
  // Læring-hooket publiserer flere mulige felter avhengig av versjon. Vi
  // foretrekker `completionRate` (prosent 0-100), faller tilbake til
  // forholdet `completedYtd / coursesAssigned` hvis den finnes.
  const explicitRate = numAt(l, 'completionRate')
  if (explicitRate > 0) return clamp01to100(explicitRate)
  const completedYtd = numAt(l, 'completedYtd')
  const assigned = numAt(l, 'coursesAssigned') || numAt(l, 'enrollments')
  if (assigned > 0) return clamp01to100((completedYtd / assigned) * 100)
  return null
}

// ── Aksens "signal" — kort norsk tekst basert på rådata ──────────────────
function trygghetSignal(vr: KpiBag | undefined, tasks: KpiBag | undefined): string {
  const fc = numAt(vr, 'findingsCritical')
  const fh = numAt(vr, 'findingsHigh')
  const overdue = numAt(tasks, 'overdue')
  const days = vr ? (vr as Record<string, unknown>).daysSinceLast : null
  const parts: string[] = []
  if (fc > 0) parts.push(`${fc} kritiske funn`)
  if (fh > 0) parts.push(`${fh} alvorlige funn`)
  if (overdue > 0) parts.push(`${overdue} forfalt avvik`)
  if (typeof days === 'number') parts.push(`${days} dg siden siste runde`)
  return parts.length ? parts.join(' · ') : 'Ingen åpne signaler'
}

function trivselSignal(s: KpiBag | undefined): string {
  const total = numAt(s, 'total')
  if (total === 0) return 'Ingen psykososial undersøkelse kjørt'
  const rate = numAt(s, 'responseRatePct')
  return `Svarprosent ${rate}% · ${total} undersøkelser`
}

function medvirkningSignal(s: KpiBag | undefined): string {
  const closed = numAt(s, 'ytdClosed')
  const rate = numAt(s, 'responseRatePct')
  if (closed === 0) return 'Ingen lukket undersøkelse i år'
  return `${closed} undersøkelser lukket i år · svarprosent ${rate}%`
}

function mestringSignal(l: KpiBag | undefined): string {
  const completedYtd = numAt(l, 'completedYtd')
  if (completedYtd === 0) return 'Ingen kursfullføringer i år'
  return `${completedYtd} kurs fullført i år`
}

// ── Foreslått neste steg per akse ────────────────────────────────────────
function nextMove(axis: WellbeingAxisKey, args: {
  vernerunde: KpiBag | undefined
  tasks: KpiBag | undefined
  survey: KpiBag | undefined
  learning: KpiBag | undefined
}): string {
  if (axis === 'trygghet') {
    if (numAt(args.vernerunde, 'findingsCritical') > 0) return 'Lukk kritiske vernerunde-funn'
    if (numAt(args.tasks, 'overdue') > 0) return 'Behandle forfalt avvik'
    return 'Planlegg neste vernerunde'
  }
  if (axis === 'trivsel') {
    if (!args.survey || numAt(args.survey, 'total') === 0) return 'Kjør QPS Nordic eller ARK'
    if (numAt(args.survey, 'responseRatePct') < 50) return 'Heve svarprosent i pågående undersøkelse'
    return 'Lukke psykososial undersøkelse og rapportere til AMU'
  }
  if (axis === 'medvirkning') {
    if (!args.survey || numAt(args.survey, 'total') === 0) return 'Verifiser AMU-kadens i § 7-2 (1)'
    return 'Bringe resultater til neste AMU-møte'
  }
  // mestring
  if (!args.learning || numAt(args.learning, 'completedYtd') === 0) {
    return 'Tildel HMS-grunnopplæring til alle nyansatte'
  }
  return 'Gjennomgå kompetanse-matrise'
}

// ── Verktøy-katalog (statisk i v1) ───────────────────────────────────────
// Fase 2 vil hente dette dynamisk via law_refs[] mot AML-aksene.
type ToolEntry = {
  axis: WellbeingAxisKey
  tool: string
  path: string
}

const STATIC_TOOLS: ToolEntry[] = [
  { axis: 'trygghet', tool: 'Vernerunder', path: '/vernerunder' },
  { axis: 'trygghet', tool: 'Avvik & nestenulykke (oppgaver)', path: '/tasks/management?template=avvik' },
  { axis: 'trygghet', tool: 'Risikoanalyser (ROS)', path: '/ros' },
  { axis: 'trivsel', tool: 'Psykososial undersøkelse (QPS / ARK / NAQ-R+)', path: '/survey' },
  { axis: 'trivsel', tool: 'Sjekkliste § 4-3 oppfølging', path: '/compliance/checklists' },
  { axis: 'medvirkning', tool: 'AMU-møter (Q1-Q4)', path: '/meetings' },
  { axis: 'medvirkning', tool: 'Verneombud-møter', path: '/meetings' },
  { axis: 'medvirkning', tool: 'Varslingskanal', path: '/workplace-reporting/anonymous-aml' },
  { axis: 'mestring', tool: 'HMS-grunnopplæring (40 timer)', path: '/learning' },
  { axis: 'mestring', tool: 'Verneombud-opplæring (40t)', path: '/learning' },
  { axis: 'mestring', tool: 'AMU-grunnopplæring', path: '/learning' },
]

/** Et punkt i indeks-tidsserien — formet for line-widget. */
export type WellbeingTrendPoint = { x: string; y: number; periodKey?: string; hasData?: boolean }

/** Rad i snapshot-historikken — formet for table-widget. */
export type WellbeingSnapshotHistoryRow = {
  period_key: string
  captured_at: string
  index_value: number | null
  trygghet_score: number | null
  trivsel_score: number | null
  medvirkning_score: number | null
  mestring_score: number | null
}

export type UseWorkerWellbeingDatasetsArgs = {
  /** Mergede medlems-datasets — det page-en allerede har bygget. */
  memberDatasets: Record<string, unknown>
  /** Vekter fra org_wellbeing_strategy — defaults til lik vekt. */
  weights?: WellbeingIndexWeights
  /** Pre-formaterte 12 mnd serie for indeks-trenden (fra useWellbeingSnapshots). */
  indexHistory?: WellbeingTrendPoint[]
  /** Rå snapshot-rader sortert nyeste først (fra useWellbeingSnapshots). */
  snapshotHistory?: WellbeingSnapshotHistoryRow[]
}

export function useWorkerWellbeingDatasets({
  memberDatasets,
  weights = DEFAULT_WELLBEING_WEIGHTS,
  indexHistory,
  snapshotHistory,
}: UseWorkerWellbeingDatasetsArgs): Record<string, unknown> {
  return useMemo(() => {
    const vr = memberDatasets['vernerunde_kpi_summary'] as KpiBag | undefined
    const tasks = memberDatasets['tasks_kpi_summary'] as KpiBag | undefined
    const survey = memberDatasets['survey_kpi_summary'] as KpiBag | undefined
    const learning = memberDatasets['learning_kpi_summary'] as KpiBag | undefined

    const scores: Record<WellbeingAxisKey, number | null> = {
      trygghet: scoreTrygghet({ vernerunde: vr, tasks }),
      trivsel: scoreTrivsel({ survey }),
      medvirkning: scoreMedvirkning({ survey }),
      mestring: scoreMestring({ learning }),
    }

    // Vektet indeks — mangler en akse data, faller dens vekt ut og resten
    // re-normaliseres. På den måten gir vi aldri «0 fordi vi ikke målte».
    let weighted = 0
    let weightSum = 0
    ;(Object.keys(scores) as WellbeingAxisKey[]).forEach((k) => {
      const s = scores[k]
      if (s == null) return
      const w = weights[k] ?? 0
      weighted += s * w
      weightSum += w
    })
    const index = weightSum > 0 ? Math.round(weighted / weightSum) : null

    const fmtScore = (s: number | null): string => (s == null ? '—' : String(s))

    // Delta vs forrige snapshot (én måned tilbake — hopper over de
    // siste-er-naa-snapshot ettersom de speiler den live indeksen).
    // Når historikken mangler, eller når nåværende ikke er beregnet,
    // returnerer vi en tom streng som UI håndterer som «ingen endring».
    let indexDelta: string = ''
    if (index != null && snapshotHistory && snapshotHistory.length > 0) {
      // Finn første historiske snapshot som ikke er fra inneværende måned
      // (vi sammenligner alltid mot forrige måned, ikke mot dagens lagring).
      const anchor = new Date()
      const currentPeriodKey = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`
      const previous = snapshotHistory.find(
        (s) => s.period_key !== currentPeriodKey && s.index_value != null,
      )
      if (previous && previous.index_value != null) {
        const delta = index - previous.index_value
        if (delta === 0) indexDelta = '±0'
        else indexDelta = delta > 0 ? `+${delta}` : `${delta}`
      }
    }

    const wellbeing_index_summary: Record<string, unknown> = {
      index: index ?? 0,
      indexLabel: index == null ? 'Ikke målt' : `${index}`,
      indexDelta,
      trygghet: fmtScore(scores.trygghet),
      trivsel: fmtScore(scores.trivsel),
      medvirkning: fmtScore(scores.medvirkning),
      mestring: fmtScore(scores.mestring),
      // Rå tall (kan være null) — siden bruker disse for å sende
      // snapshot-RPC og dirigere knappen «Lagre snapshot».
      indexRaw: index,
      trygghetRaw: scores.trygghet,
      trivselRaw: scores.trivsel,
      medvirkningRaw: scores.medvirkning,
      mestringRaw: scores.mestring,
    }

    const wellbeing_axis_scores: Record<string, number> = {
      Trygghet: scores.trygghet ?? 0,
      Trivsel: scores.trivsel ?? 0,
      Medvirkning: scores.medvirkning ?? 0,
      Mestring: scores.mestring ?? 0,
    }

    const args = { vernerunde: vr, tasks, survey, learning }
    const wellbeing_axis_overview = (
      ['trygghet', 'trivsel', 'medvirkning', 'mestring'] as WellbeingAxisKey[]
    ).map((k) => ({
      axis: `${WELLBEING_AXIS_LABELS[k]} · ${WELLBEING_AXIS_LAW[k]}`,
      score: fmtScore(scores[k]),
      signal:
        k === 'trygghet' ? trygghetSignal(vr, tasks)
        : k === 'trivsel' ? trivselSignal(survey)
        : k === 'medvirkning' ? medvirkningSignal(survey)
        : mestringSignal(learning),
      nextMove: nextMove(k, args),
    }))

    const wellbeing_tool_coverage = STATIC_TOOLS.map((t) => ({
      axis: WELLBEING_AXIS_LABELS[t.axis],
      tool: t.tool,
      lastUsed: '—',
      status: 'Tilgjengelig',
    }))

    // Action queue — topp-N elementer som faktisk krever handling.
    type ActionRow = { axis: string; item: string; severity: string; origin: string }
    const queue: ActionRow[] = []
    const findingsCritical = numAt(vr, 'findingsCritical')
    if (findingsCritical > 0) {
      queue.push({
        axis: 'Trygghet',
        item: `${findingsCritical} kritiske vernerunde-funn må lukkes`,
        severity: 'Kritisk',
        origin: 'Vernerunder',
      })
    }
    const findingsHigh = numAt(vr, 'findingsHigh')
    if (findingsHigh > 0) {
      queue.push({
        axis: 'Trygghet',
        item: `${findingsHigh} alvorlige vernerunde-funn`,
        severity: 'Høy',
        origin: 'Vernerunder',
      })
    }
    const tasksOverdue = numAt(tasks, 'overdue')
    if (tasksOverdue > 0) {
      queue.push({
        axis: 'Trygghet',
        item: `${tasksOverdue} forfalt avvik`,
        severity: 'Høy',
        origin: 'Oppgaver',
      })
    }
    if (!survey || numAt(survey, 'total') === 0) {
      queue.push({
        axis: 'Trivsel',
        item: 'Ingen psykososial undersøkelse registrert — kjør QPS Nordic eller ARK',
        severity: 'Medium',
        origin: 'Undersøkelser',
      })
    } else if (numAt(survey, 'responseRatePct') < 50) {
      queue.push({
        axis: 'Trivsel',
        item: `Svarprosent ${numAt(survey, 'responseRatePct')}% — under § 4-3 representativitets-grense`,
        severity: 'Medium',
        origin: 'Undersøkelser',
      })
    }
    if (!learning || numAt(learning, 'completedYtd') === 0) {
      queue.push({
        axis: 'Mestring',
        item: 'Ingen HMS-kurs fullført i år',
        severity: 'Medium',
        origin: 'Læring',
      })
    }

    // Historikk-datasett — bare bygges når sidens snapshot-hook har
    // levert data. Når historikken mangler returnerer vi tom serie
    // slik at line-widgeten viser «ingen historikk» fremfor å crashe.
    const wellbeing_index_over_time = indexHistory ?? []
    const wellbeing_snapshot_history = (snapshotHistory ?? []).map((row) => ({
      period: row.period_key,
      index: row.index_value ?? '—',
      trygghet: row.trygghet_score ?? '—',
      trivsel: row.trivsel_score ?? '—',
      medvirkning: row.medvirkning_score ?? '—',
      mestring: row.mestring_score ?? '—',
      capturedAt: new Date(row.captured_at).toLocaleDateString('nb-NO'),
    }))

    return {
      wellbeing_index_summary,
      wellbeing_axis_scores,
      wellbeing_axis_overview,
      wellbeing_tool_coverage,
      wellbeing_action_queue: queue,
      wellbeing_index_over_time,
      wellbeing_snapshot_history,
    } as Record<string, unknown>
  }, [memberDatasets, weights, indexHistory, snapshotHistory])
}
