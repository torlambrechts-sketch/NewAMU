import { useInternalControl } from '../../../hooks/useInternalControl'

type Props = {
  maxItems?: number
  showDepartment?: boolean
}

function riskColor(score: number) {
  if (score >= 15) return { bg: 'bg-red-100', text: 'text-red-800', label: 'Høy' }
  if (score >= 8) return { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Middels' }
  return { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Lav' }
}

export function LiveRiskFeed({ maxItems = 3, showDepartment = true }: Props) {
  const ic = useInternalControl()

  const topRisks = ic.rosAssessments
    .flatMap((ros) =>
      ros.rows
        .filter((r) => !r.done)
        .map((r) => ({ ...r, assessment: ros })),
    )
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, maxItems)

  return (
    <div className="not-prose my-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-100 text-xs text-amber-800">⚠</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Live risikooversikt — topp {maxItems} åpne risikoer
        </span>
      </div>

      {topRisks.length === 0 ? (
        <p className="text-sm text-neutral-500">Ingen åpne risikoer registrert. Gå til Internkontroll → ROS for å registrere.</p>
      ) : (
        <div className="space-y-2">
          {topRisks.map((r) => {
            const color = riskColor(r.riskScore)
            return (
              <div key={r.id} className="flex flex-wrap items-start gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${color.bg} ${color.text}`}>
                  {color.label} · {r.riskScore}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-neutral-900 line-clamp-1">{r.hazard}</div>
                  <div className="text-xs text-neutral-500">
                    {r.activity}
                    {showDepartment && r.assessment.department ? ` · ${r.assessment.department}` : ''}
                  </div>
                  {r.proposedMeasures && (
                    <div className="mt-0.5 text-xs text-neutral-500 line-clamp-1">Tiltak: {r.proposedMeasures}</div>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-neutral-400">
                  <div>{r.responsible}</div>
                  {r.dueDate && <div>{r.dueDate}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-2 text-xs text-neutral-400">
        Henter data live fra Internkontroll → ROS. Tiltak som er merket «fullført» vises ikke her.
      </p>
    </div>
  )
}
