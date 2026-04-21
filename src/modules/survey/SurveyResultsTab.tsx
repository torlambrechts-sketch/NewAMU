import { EyeOff, TrendingUp, AlertTriangle } from 'lucide-react'
import type { SurveyModuleState } from './useSurveyLegacy'
import type { SurveyCampaignRow, SurveyPillar, SurveyResultRow } from './types'
import { PILLAR_LABEL, PILLAR_COLOR, scoreColor, scoreBg, scoreLabel } from './types'

type Props = { survey: SurveyModuleState; campaign: SurveyCampaignRow }

export function SurveyResultsTab({ survey, campaign }: Props) {
  if (survey.results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <TrendingUp className="h-10 w-10 text-neutral-300" />
        <p className="text-sm font-medium text-neutral-500">Ingen resultater ennå</p>
        {campaign.status === 'closed' && (
          <p className="text-xs text-neutral-400">Klikk «Beregn resultater» i toplinjen for å aggregere svar.</p>
        )}
        {campaign.status === 'open' && (
          <p className="text-xs text-neutral-400">Resultater beregnes etter at undersøkelsen er avsluttet.</p>
        )}
      </div>
    )
  }

  const orgResults = survey.results.filter((r) => r.department === null)
  const byPillar = orgResults.reduce<Partial<Record<SurveyPillar, SurveyResultRow[]>>>((acc, r) => {
    const p = r.pillar as SurveyPillar
    ;(acc[p] ??= []).push(r)
    return acc
  }, {})

  const pillarScores = (Object.entries(byPillar) as [SurveyPillar, SurveyResultRow[]][]).map(([pillar, rows]) => {
    const visible = rows.filter((r) => !r.is_suppressed && r.score !== null)
    const avg = visible.length
      ? Math.round(visible.reduce((a, b) => a + (b.score ?? 0), 0) / visible.length)
      : null
    return { pillar, avg, rows }
  })

  const departments = [...new Set(survey.results.filter((r) => r.department).map((r) => r.department!))]

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#1a3d32]/20 bg-[#f4f1ea] px-4 py-3 text-sm text-[#1a3d32]">
        <strong>Anonymitet (GDPR):</strong> Resultater for grupper med færre enn {campaign.anonymity_threshold}{' '}
        respondenter er skjult og merket med <EyeOff className="mx-0.5 inline h-3.5 w-3.5" />. Individuelle svar er
        aldri tilgjengelige.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {pillarScores.map(({ pillar, avg }) => (
          <div key={pillar} className="rounded-xl border border-neutral-200 bg-white p-5 text-center shadow-sm">
            <div className={`text-3xl font-bold ${scoreColor(avg)}`}>{avg !== null ? avg : '–'}</div>
            <div
              className={`mx-auto mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${scoreBg(avg)} ${scoreColor(avg)}`}
            >
              {scoreLabel(avg)}
            </div>
            <div className="mt-2 text-xs text-neutral-500">{PILLAR_LABEL[pillar]}</div>
            <div className="mt-1">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PILLAR_COLOR[pillar]}`}>
                {pillar}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {pillarScores.map(({ pillar, rows }) => (
          <div key={pillar} className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-[#1a3d32]">{PILLAR_LABEL[pillar]}</h3>
            </div>
            <div className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <CategoryResultRow
                  key={r.id}
                  result={r}
                  threshold={campaign.anonymity_threshold}
                  actionThreshold={campaign.action_threshold}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {departments.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-[#1a3d32]">Resultater per avdeling</h3>
          </div>
          <div className="p-4">
            <p className="mb-3 text-xs text-neutral-400">
              Avdelinger med færre enn {campaign.anonymity_threshold} respondenter vises som skjult.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Avdeling</th>
                    {pillarScores.map(({ pillar }) => (
                      <th key={pillar} className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        {PILLAR_LABEL[pillar].split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {departments.map((dept) => {
                    const deptResults = survey.results.filter((r) => r.department === dept)
                    return (
                      <tr key={dept}>
                        <td className="py-2 pr-4 font-medium text-neutral-700">{dept}</td>
                        {pillarScores.map(({ pillar }) => {
                          const pr = deptResults.find((r) => r.pillar === pillar)
                          return (
                            <td key={pillar} className="px-2 py-2 text-center">
                              {!pr ? (
                                <span className="text-neutral-300">–</span>
                              ) : pr.is_suppressed ? (
                                <EyeOff className="mx-auto h-4 w-4 text-neutral-300" />
                              ) : (
                                <span className={`font-semibold ${scoreColor(pr.score)}`}>{pr.score}</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryResultRow({
  result: r,
  threshold,
  actionThreshold,
}: {
  result: SurveyResultRow
  threshold: number
  actionThreshold: number
}) {
  const isLow = !r.is_suppressed && r.score !== null && r.score < actionThreshold
  return (
    <div
      className={`flex items-center gap-3 border-l-4 px-4 py-3 ${isLow ? 'border-l-red-400 bg-red-50/30' : 'border-l-transparent'}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-700">{r.category}</p>
        <p className="text-xs text-neutral-400">{r.response_count} svar</p>
      </div>
      {r.is_suppressed ? (
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <EyeOff className="h-3.5 w-3.5" />
          <span>
            Skjult (&lt;{threshold})
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {isLow && <AlertTriangle className="h-4 w-4 text-red-500" />}
          <div className="h-2 w-24 overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full ${(r.score ?? 0) < 40 ? 'bg-red-400' : (r.score ?? 0) < 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ width: `${r.score ?? 0}%` }}
            />
          </div>
          <span className={`w-8 text-right text-sm font-bold ${scoreColor(r.score)}`}>{r.score}</span>
        </div>
      )}
    </div>
  )
}
