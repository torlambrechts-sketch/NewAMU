import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { BarChart3, Download, EyeOff, Filter } from 'lucide-react'
import { InfoBox } from '../../src/components/ui/AlertBox'
import { SURVEY_K_ANONYMITY_MIN } from '../../src/lib/orgSurveyKAnonymity'
import type { UseSurveyState } from './useSurvey'
import { LAYOUT_SCORE_STAT_CREAM } from '../../src/components/layout/platformLayoutKit'
import { WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { buildAnalyticsByQuestionId } from './surveyAnalytics'
import { globalQuestionIdOrder } from './surveyQuestionGlobalOrder'
import { buildSurveyAnalyticsCsv } from './surveyExportCsv'
import {
  fetchSurveyChoiceCountsRpc,
  fetchSurveyNumericStatsRpc,
  type NumericStatsRow,
} from './surveyAnalyticsRpc'
import type { OrgSurveyQuestionRow, SurveyRow } from './types'

function AnalyseBar({ label, valuePct, sublabel }: { label: string; valuePct: number; sublabel?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-neutral-600">
        <span className="min-w-0 pr-2">
          <span className="block truncate font-medium text-neutral-800">{label}</span>
          {sublabel ? (
            <span className="mt-0.5 block truncate text-[11px] font-normal text-neutral-500">{sublabel}</span>
          ) : null}
        </span>
        <span className="shrink-0 font-medium text-neutral-800">{Math.round(valuePct)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-[#1a3d32] transition-[width]"
          style={{ width: `${Math.min(100, Math.max(0, valuePct))}%` }}
        />
      </div>
    </div>
  )
}

function TabEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="max-w-md text-sm text-neutral-500">{message}</p>
    </div>
  )
}

type Props = {
  survey: UseSurveyState
  s: SurveyRow
  supabase: SupabaseClient | null
}

/** k-anonymitet (terskel, RPC, «Skjult») gjelder kun anonyme undersøkelser. Identifiserte viser aggregater uten dette kravet. */
export function SurveyAnalyseTab({ survey, s, supabase }: Props) {
  const kAnonApplies = s.is_anonymous
  const minResponses = kAnonApplies
    ? Math.max(s.anonymity_threshold ?? SURVEY_K_ANONYMITY_MIN, SURVEY_K_ANONYMITY_MIN)
    : 1
  const responseCount = survey.responses.length

  const analyticsByQuestion = useMemo(
    () => buildAnalyticsByQuestionId(survey.questions, survey.answers),
    [survey.questions, survey.answers],
  )

  const [rpcChoiceMap, setRpcChoiceMap] = useState<Record<string, Record<string, number> | null>>({})
  const [rpcNumericMap, setRpcNumericMap] = useState<Record<string, NumericStatsRow | null | 'error'>>({})
  const [rpcWarn, setRpcWarn] = useState<string | null>(null)

  useEffect(() => {
    if (!kAnonApplies || !supabase || survey.questions.length === 0 || responseCount < minResponses) {
      queueMicrotask(() => {
        setRpcChoiceMap({})
        setRpcNumericMap({})
        setRpcWarn(null)
      })
      return
    }

    let cancelled = false
    queueMicrotask(() => setRpcWarn(null))

    const choiceTypes = new Set([
      'multiple_choice',
      'yes_no',
      'single_select',
      'multi_select',
      'dropdown',
      'image_choice',
    ])
    const numericTypes = new Set([
      'rating_1_to_5',
      'rating_1_to_10',
      'nps',
      'rating_visual',
      'likert_scale',
      'slider',
      'number',
    ])

    void (async () => {
      const choiceUpdates: Record<string, Record<string, number> | null> = {}
      const numUpdates: Record<string, NumericStatsRow | null | 'error'> = {}
      let anyErr = false

      await Promise.all(
        survey.questions.map(async (q) => {
          if (choiceTypes.has(q.question_type)) {
            const rows = await fetchSurveyChoiceCountsRpc(supabase, s.id, q.id, minResponses)
            if (cancelled) return
            if (rows === null) {
              anyErr = true
              choiceUpdates[q.id] = null
              return
            }
            if (rows.length === 0) {
              choiceUpdates[q.id] = {}
              return
            }
            const m: Record<string, number> = {}
            for (const r of rows) m[r.choice_label] = Number(r.cnt)
            choiceUpdates[q.id] = m
            return
          }
          if (numericTypes.has(q.question_type)) {
            const row = await fetchSurveyNumericStatsRpc(supabase, s.id, q.id, minResponses)
            if (cancelled) return
            if (row === null) {
              anyErr = true
              numUpdates[q.id] = 'error'
              return
            }
            numUpdates[q.id] = row
          }
        }),
      )

      if (cancelled) return
      setRpcChoiceMap(choiceUpdates)
      setRpcNumericMap(numUpdates)
      if (anyErr) setRpcWarn('Noen aggregater kunne ikke hentes serverside — visning faller tilbake til klient der det trengs.')
    })()

    return () => {
      cancelled = true
    }
  }, [kAnonApplies, supabase, s.id, survey.questions, responseCount, minResponses])

  const csvBlobUrl = useMemo(() => {
    if (survey.questions.length === 0) return null
    const csv = buildSurveyAnalyticsCsv({
      survey: s,
      questions: survey.questions,
      answers: survey.answers,
      sections: survey.surveySections,
      analyticsOverride: kAnonApplies && responseCount >= minResponses ? rpcChoiceMap : undefined,
      numericOverride: kAnonApplies && responseCount >= minResponses ? rpcNumericMap : undefined,
    })
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    return URL.createObjectURL(blob)
  }, [
    s,
    survey.questions,
    survey.answers,
    survey.surveySections,
    rpcChoiceMap,
    rpcNumericMap,
    kAnonApplies,
    responseCount,
    minResponses,
  ])

  useEffect(() => {
    return () => {
      if (csvBlobUrl) URL.revokeObjectURL(csvBlobUrl)
    }
  }, [csvBlobUrl])

  const exportFileName = useMemo(() => {
    const safe = s.title.replace(/[^\wæøåÆØÅ\- ]+/g, '').trim().slice(0, 60) || 'undersokelse'
    return `analyse-${safe}.csv`
  }, [s.title])

  const orderedQuestions = useMemo(() => {
    const order = globalQuestionIdOrder(survey.questions, s.id, survey.surveySections)
    const m = new Map(survey.questions.map((q) => [q.id, q]))
    return order.map((id) => m.get(id)).filter((q): q is OrgSurveyQuestionRow => q != null)
  }, [survey.questions, survey.surveySections, s.id])

  const sectionTitleById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const sec of survey.surveySections) map[sec.id] = sec.title
    return map
  }, [survey.surveySections])

  const choiceCountsFor = (q: OrgSurveyQuestionRow, client: Record<string, number>): Record<string, number> => {
    if (!kAnonApplies || responseCount < minResponses) return client
    const rpc = rpcChoiceMap[q.id]
    if (rpc === undefined) return client
    if (rpc === null) return client
    return Object.keys(rpc).length > 0 ? rpc : client
  }

  const numericBlocked = (qid: string): boolean => {
    if (!kAnonApplies || responseCount < minResponses) return false
    const st = rpcNumericMap[qid]
    return st !== undefined && st !== 'error' && st !== null && st.n === 0
  }

  const numericDisplay = (
    q: OrgSurveyQuestionRow,
    n: number,
    a: ReturnType<typeof buildAnalyticsByQuestionId>[string] | undefined,
  ): { avg: number; nEff: number } => {
    const st = rpcNumericMap[q.id]
    if (
      kAnonApplies &&
      responseCount >= minResponses &&
      st &&
      st !== 'error' &&
      st !== null &&
      st.n > 0 &&
      st.avg_val != null
    ) {
      return { avg: Number(st.avg_val), nEff: st.n }
    }
    const nums = a?.numbers ?? []
    const avg = n > 0 ? nums.reduce((x, y) => x + y, 0) / n : 0
    return { avg, nEff: n }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <BarChart3 className="mt-1 h-6 w-6 shrink-0 text-neutral-600" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">Undersøkelse</p>
            <h2
              className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Analyse
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:text-neutral-900"
          >
            <Filter className="h-3.5 w-3.5" aria-hidden />
            Vis filtre
          </button>
          {csvBlobUrl ? (
            <a
              href={csvBlobUrl}
              download={exportFileName}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:text-neutral-900"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Eksporter CSV
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div
          className="rounded-lg border border-neutral-200/80 px-5 py-4"
          style={{ backgroundColor: LAYOUT_SCORE_STAT_CREAM }}
        >
          <p className="text-3xl font-bold tabular-nums text-neutral-900">{responseCount}</p>
          <p className="mt-1 text-sm text-neutral-700">Mottatte besvarelser</p>
        </div>
        <div
          className="rounded-lg border border-neutral-200/80 px-5 py-4"
          style={{ backgroundColor: LAYOUT_SCORE_STAT_CREAM }}
        >
          <p className="text-3xl font-bold tabular-nums text-neutral-900">{survey.questions.length}</p>
          <p className="mt-1 text-sm text-neutral-700">Spørsmål i undersøkelsen</p>
        </div>
      </div>

      <div className="space-y-2">
        <InfoBox>
          {kAnonApplies ? (
            <>
              Denne undersøkelsen er <strong>anonym</strong>. For valg og tall gjelder minst {minResponses} svar per
              spørsmål (k-anonymitet). Fritekst vises aldri ordrett. Under terskelen vises «Skjult». Aggregater kan hentes
              via databasefunksjon slik at rå svar ikke må prosesseres i nettleseren når terskel er nådd.
            </>
          ) : (
            <>
              Denne undersøkelsen er <strong>identifisert</strong> (ikke anonym). Standard k-anonymitetsterskel for analyse
              gjelder ikke; aggregater vises uten krav om minst fem svar per spørsmål. Fritekst vises fortsatt ikke ordrett
              her (personvern).
            </>
          )}
        </InfoBox>
        {rpcWarn ? <p className="text-xs text-amber-800">{rpcWarn}</p> : null}
      </div>

      {survey.questions.length === 0 ? (
        <TabEmpty message="Ingen spørsmål å analysere. Legg til spørsmål i byggeren." />
      ) : survey.answers.length === 0 && survey.responses.length === 0 ? (
        <TabEmpty message="Ingen svar å analysere ennå. Når deltakere svarer, oppdateres visningen her." />
      ) : (
        orderedQuestions.map((q, qi) => {
          const a = analyticsByQuestion[q.id]
          const isNumeric =
            q.question_type === 'rating_1_to_5' ||
            q.question_type === 'rating_1_to_10' ||
            q.question_type === 'nps' ||
            q.question_type === 'rating_visual' ||
            q.question_type === 'likert_scale' ||
            q.question_type === 'slider' ||
            q.question_type === 'number'
          const isChoice =
            q.question_type === 'multiple_choice' ||
            q.question_type === 'yes_no' ||
            q.question_type === 'single_select' ||
            q.question_type === 'multi_select' ||
            q.question_type === 'dropdown' ||
            q.question_type === 'image_choice'
          const isMatrix = q.question_type === 'matrix'
          const isRanking = q.question_type === 'ranking'
          const isTextLike =
            q.question_type === 'text' ||
            q.question_type === 'long_text' ||
            q.question_type === 'short_text' ||
            q.question_type === 'email' ||
            q.question_type === 'datetime' ||
            q.question_type === 'signature' ||
            q.question_type === 'file_upload'
          const n = isNumeric
            ? a?.numbers.length ?? 0
            : isChoice
              ? (Object.values(a?.choiceCounts ?? {}) as number[]).reduce(
                  (sum, v) => sum + (typeof v === 'number' ? v : 0),
                  0,
                )
              : isMatrix || isRanking
                ? a?.textCount ?? 0
                : 0

          const prev = orderedQuestions[qi - 1]
          const showSection =
            survey.surveySections.length > 0 &&
            (prev?.section_id ?? null) !== (q.section_id ?? null) &&
            q.section_id != null

          const sectionHeader =
            showSection && q.section_id ? (
              <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-neutral-500 first:mt-0">
                {sectionTitleById[q.section_id] ?? 'Seksjon'}
              </h3>
            ) : null

          if (isMatrix && n >= minResponses) {
            const cfg = q.config as { rows?: string[]; columns?: string[] } | undefined
            const rows = Array.isArray(cfg?.rows) ? cfg.rows : Object.keys(a?.matrixRowChoiceCounts ?? {})
            const columns =
              Array.isArray(cfg?.columns) && cfg.columns.length > 0
                ? cfg.columns
                : (() => {
                    const set = new Set<string>()
                    for (const inner of Object.values(a?.matrixRowChoiceCounts ?? {})) {
                      for (const k of Object.keys(inner)) set.add(k)
                    }
                    return [...set].sort()
                  })()
            const matrixCounts = a?.matrixRowChoiceCounts ?? {}
            return (
              <div key={q.id}>
                {sectionHeader}
                <div className="rounded-lg border border-neutral-200/90 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                  <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Matrise · n={n} besvarelser · tabellen viser relativ frekvens per celle (heatmap)
                  </p>
                  {rows.length === 0 || columns.length === 0 ? (
                    <p className="mt-3 text-sm text-neutral-500">Ingen rader/kolonner definert eller ingen svar.</p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[280px] border-collapse text-xs">
                        <thead>
                          <tr>
                            <th className="border border-neutral-200 bg-neutral-50 p-2 text-left font-medium text-neutral-600" />
                            {columns.map((col) => (
                              <th
                                key={col}
                                className="border border-neutral-200 bg-neutral-50 p-2 text-center font-medium text-neutral-700"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((rowLabel) => {
                            const counts = matrixCounts[rowLabel] ?? {}
                            const rowTotal = Object.values(counts).reduce((s, v) => s + v, 0) || 1
                            return (
                              <tr key={rowLabel}>
                                <td className="border border-neutral-200 bg-neutral-50/80 p-2 font-medium text-neutral-800">
                                  {rowLabel}
                                </td>
                                {columns.map((col) => {
                                  const cnt = counts[col] ?? 0
                                  const pct = (cnt / rowTotal) * 100
                                  return (
                                    <td
                                      key={`${rowLabel}-${col}`}
                                      className="border border-neutral-200 p-0 text-center"
                                      title={`${cnt} svar (${Math.round(pct)} % av raden)`}
                                    >
                                      <div
                                        className="flex min-h-[36px] items-center justify-center px-1 py-2 font-medium text-neutral-900"
                                        style={{
                                          backgroundColor: `rgba(26, 61, 50, ${Math.min(0.85, 0.12 + pct / 120)})`,
                                        }}
                                      >
                                        {Math.round(pct)}%
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="mt-4 space-y-6 border-t border-neutral-100 pt-4">
                    <p className="text-xs font-semibold text-neutral-600">Fordeling per rad (samme som før)</p>
                    {rows.map((rowLabel) => {
                      const counts = a?.matrixRowChoiceCounts?.[rowLabel] ?? {}
                      const rowTotal = Object.values(counts).reduce((s, v) => s + v, 0) || 1
                      return (
                        <div key={rowLabel}>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">{rowLabel}</p>
                          <div className="space-y-3">
                            {columns.map((col) => {
                              const cnt = counts[col] ?? 0
                              return (
                                <AnalyseBar
                                  key={`${rowLabel}-${col}`}
                                  label={col}
                                  valuePct={(cnt / rowTotal) * 100}
                                />
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          }

          if (isRanking && n >= minResponses) {
            const cfg = q.config as { items?: string[] } | undefined
            const items = Array.isArray(cfg?.items) ? cfg.items : Object.keys(a?.rankingPositionCounts ?? {})
            const avgByItem = a?.rankingAverageByItem ?? {}
            return (
              <div key={q.id}>
                {sectionHeader}
                <div className="rounded-lg border border-neutral-200/90 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                  <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Rangering · fordeling av plass · gj.sn. plass (lavere = viktigere oftere) · n={n} besvarelser
                  </p>
                  {items.length === 0 ? (
                    <p className="mt-3 text-sm text-neutral-500">Ingen elementer eller ingen svar.</p>
                  ) : (
                    <div className="mt-4 space-y-6">
                      {items.map((itemLabel) => {
                        const counts = a?.rankingPositionCounts?.[itemLabel] ?? {}
                        const itemTotal = Object.values(counts).reduce((s, v) => s + v, 0) || 1
                        const positions = Object.keys(counts).sort((x, y) => Number(x) - Number(y))
                        const avgRank = avgByItem[itemLabel]
                        return (
                          <div key={itemLabel}>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                              {itemLabel}
                              {avgRank != null && Number.isFinite(avgRank) ? (
                                <span className="ml-2 font-normal text-neutral-500">
                                  · gj.sn. plass {avgRank.toFixed(2)}
                                </span>
                              ) : null}
                            </p>
                            <div className="space-y-3">
                              {positions.map((pos) => {
                                const cnt = counts[pos] ?? 0
                                return (
                                  <AnalyseBar
                                    key={`${itemLabel}-${pos}`}
                                    label={`Plass ${pos}`}
                                    valuePct={(cnt / itemTotal) * 100}
                                  />
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          }

          if (isTextLike) {
            const c = a?.textCount ?? 0
            return (
              <div key={q.id}>
                {sectionHeader}
                <div className="rounded-lg border border-neutral-200/90 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                  <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                  <p className="mt-2 text-sm text-neutral-500">
                    Strukturert/tekst · {c} utfylte svar. Detaljer vises ikke (GDPR).
                  </p>
                  {c === 0 ? <p className="mt-3 text-sm text-neutral-500">Ingen svar mottatt.</p> : null}
                </div>
              </div>
            )
          }

          if (kAnonApplies && n < minResponses) {
            return (
              <div key={q.id}>
                {sectionHeader}
                <div className="rounded-lg border border-neutral-200 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                  <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                  <div className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
                    <EyeOff className="h-4 w-4" aria-hidden />
                    <span>
                      Skjult — under {minResponses} svar (n={n}). k-anonymitet.
                    </span>
                  </div>
                </div>
              </div>
            )
          }

          if (isNumeric && numericBlocked(q.id)) {
            return (
              <div key={q.id}>
                {sectionHeader}
                <div className="rounded-lg border border-neutral-200 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                  <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                  <div className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
                    <EyeOff className="h-4 w-4" aria-hidden />
                    <span>Skjult — ingen gyldige tall under personvernterskel på serversiden.</span>
                  </div>
                </div>
              </div>
            )
          }

          if (isNumeric) {
            const cfg = q.config as {
              scaleMin?: number
              scaleMax?: number
              rangeStart?: number
              rangeEnd?: number
              minValue?: number
              maxValue?: number
            } | undefined
            let smin = cfg?.scaleMin ?? 1
            let smax = cfg?.scaleMax ?? 5
            if (q.question_type === 'nps' || q.question_type === 'rating_1_to_10') {
              smin = cfg?.scaleMin ?? 0
              smax = cfg?.scaleMax ?? 10
            } else if (q.question_type === 'rating_1_to_5' || q.question_type === 'likert_scale') {
              smin = cfg?.scaleMin ?? 1
              smax = cfg?.scaleMax ?? 5
            } else if (q.question_type === 'slider') {
              smin = typeof cfg?.rangeStart === 'number' ? cfg.rangeStart : 0
              smax = typeof cfg?.rangeEnd === 'number' ? cfg.rangeEnd : 100
            } else if (q.question_type === 'number') {
              smin = typeof cfg?.minValue === 'number' ? cfg.minValue : 0
              smax = typeof cfg?.maxValue === 'number' ? cfg.maxValue : 100
            }
            const span = Math.max(1, smax - smin)
            const { avg, nEff } = numericDisplay(q, n, a)
            const st = rpcNumericMap[q.id]
            const rangeNote =
              st && st !== 'error' && st !== null && st.min_val != null && st.max_val != null
                ? ` · min ${st.min_val.toFixed(1)} · maks ${st.max_val.toFixed(1)}`
                : ''
            return (
              <div key={q.id}>
                {sectionHeader}
                <div className="rounded-lg border border-neutral-200/90 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                  <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Gjennomsnitt av tall • skala {smin}–{smax} • n={nEff}
                    {rangeNote}
                  </p>
                  {nEff === 0 ? (
                    <p className="mt-3 text-sm text-neutral-500">Ingen numeriske svar for dette spørsmålet.</p>
                  ) : null}
                  {nEff > 0 ? (
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-[#1a3d32]"
                        style={{ width: `${Math.min(100, ((avg - smin) / span) * 100)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            )
          }

          const clientCounts = (a?.choiceCounts ?? {}) as Record<string, number>
          const counts = choiceCountsFor(q, clientCounts)
          const entries = Object.entries(counts) as [string, number][]
          const total = entries.reduce((s2, [, v]) => s2 + v, 0) || 1

          const rpcEmptyBlocked =
            kAnonApplies &&
            responseCount >= minResponses &&
            isChoice &&
            rpcChoiceMap[q.id] !== undefined &&
            rpcChoiceMap[q.id] !== null &&
            Object.keys(rpcChoiceMap[q.id]!).length === 0

          if (rpcEmptyBlocked) {
            return (
              <div key={q.id}>
                {sectionHeader}
                <div className="rounded-lg border border-neutral-200 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                  <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                  <div className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
                    <EyeOff className="h-4 w-4" aria-hidden />
                    <span>Skjult — aggregerte valg er ikke tilgjengelig under gjeldende personvernterskel.</span>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <div key={q.id}>
              {sectionHeader}
              <div className="rounded-lg border border-neutral-200/90 bg-white p-5" style={WORKPLACE_MODULE_CARD_SHADOW}>
                <h3 className="text-sm font-semibold text-neutral-900">{q.question_text}</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Andel av alle som besvarte dette spørsmålet (summerer til 100 %).
                </p>
                {entries.length === 0 ? (
                  <p className="mt-3 text-sm text-neutral-500">Ingen valgsvar registrert.</p>
                ) : null}
                {entries.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {entries
                      .sort((x, y) => y[1] - x[1])
                      .map(([k, v]) => <AnalyseBar key={k} label={k} valuePct={(v / total) * 100} />)}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
