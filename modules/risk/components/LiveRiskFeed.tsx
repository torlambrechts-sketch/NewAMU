// LiveRiskFeed — sidebar block on RiskAnalysePage showing the most
// recent red / critical risks, with auto-refresh on a 60s interval.
//
// This is the "live feed" P2 plan item, implemented as polling
// (cheap, no realtime channel needed) rather than realtime
// subscriptions. Polling is enough — risk events don't arrive every
// few seconds in a HMS context.
//
// The feed reads the same `UnifiedRiskRow[]` the rest of the dashboard
// uses, but renders inline in a compact list with relative
// timestamps. Each entry deeplinks to the Risikoregister with the
// row pre-selected.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertCircle } from 'lucide-react'
import { RISK_SOURCE_LABELS, type UnifiedRiskRow } from '../dashboards/useRiskDatasets'

type Props = {
  rows: UnifiedRiskRow[]
  /** Override the default 60s refresh interval (ms). 0 disables. */
  pollIntervalMs?: number
  /** Max number of items in the feed. */
  limit?: number
  /** Called on each tick so the parent can re-fetch the underlying rows. */
  onTick?: () => void
}

function relTime(iso: string, nowMs: number): string {
  const diffMs = nowMs - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'nå'
  if (min < 60) return `${min} min siden`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} t siden`
  const d = Math.floor(hr / 24)
  if (d < 30) return `${d} d siden`
  return new Date(iso).toLocaleDateString('nb-NO')
}

export function LiveRiskFeed({ rows, pollIntervalMs = 60_000, limit = 5, onTick }: Props) {
  // `nowMs` ticks every minute (or per pollIntervalMs) so relative
  // timestamps update without manual re-renders. We also poke
  // `onTick` so the parent can re-fetch source data.
  const [nowMs, setNowMs] = useState(() => new Date().getTime())
  useEffect(() => {
    if (pollIntervalMs <= 0) return
    const id = setInterval(() => {
      setNowMs(new Date().getTime())
      onTick?.()
    }, pollIntervalMs)
    return () => clearInterval(id)
  }, [pollIntervalMs, onTick])

  const items = useMemo(() => {
    return [...rows]
      .filter((r) => r.isOpen && (r.band === 'red' || r.severityTier === 'critical'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
  }, [rows, limit])

  return (
    <aside
      className="rounded-lg border border-rose-200 bg-white p-3 shadow-sm"
      aria-labelledby="live-risk-feed-heading"
    >
      <header className="mb-2 flex items-center justify-between">
        <h3
          id="live-risk-feed-heading"
          className="flex items-center gap-1.5 text-sm font-semibold text-rose-900"
        >
          <Activity className="h-4 w-4" aria-hidden />
          Live risikofeed
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-neutral-400">
          oppdateres hvert min
        </span>
      </header>

      {items.length === 0 ? (
        <p className="text-xs text-neutral-500">
          Ingen røde risikoer akkurat nå. Bra jobbet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id} className="rounded-md border border-neutral-100 p-2 text-xs hover:border-rose-200 hover:bg-rose-50/40">
              <Link
                to={`/risk/register?riskId=${encodeURIComponent(r.id)}`}
                className="block"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900">{r.title}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {RISK_SOURCE_LABELS[r.source]} · {r.severityTier === 'critical' ? 'Kritisk' : 'Høy'} · Score {r.riskScore}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-neutral-400">
                    {relTime(r.createdAt, nowMs)}
                  </span>
                </div>
                {r.isPsychosocial && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-pink-50 px-1.5 py-0.5 text-[10px] text-pink-700 ring-1 ring-pink-200">
                    <AlertCircle className="h-2.5 w-2.5" aria-hidden />
                    Psykososial
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
