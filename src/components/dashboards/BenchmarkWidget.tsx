// Anonymisert benchmark-widget — viser organisasjonens egen verdi for
// en metric ved siden av et anonymisert tverr-virksomhet referansebånd
// (median + p25/p75) per NACE-kode og størrelses-bånd. Bygger på RPC-en
// `public.get_my_org_benchmark(p_org_id, p_metric, p_periods)` som
// håndhever k-anonymitet ≥ 5: bøtter med færre bidragende virksomheter
// returnerer kAnonOk=false og widgeten skjuler referansetallene.
//
// Widgeten brukes både stand-alone på `BenchmarkPage` og som widget-kind
// `benchmark` i dashboard-runtimen (se `ReportModuleWidget.tsx`).

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

export type BenchmarkMetricKey =
  | 'findings_critical_per_org'
  | 'vernerunder_per_quarter'
  | 'overdue_actions_pct'
  | 'course_certificates_per_employee'
  | 'sjekkliste_completion_pct'

export type BenchmarkPoint = {
  periodMonth: string
  orgValue: number
  benchMedian: number | null
  benchP25: number | null
  benchP75: number | null
  benchMean: number | null
  benchOrgCount: number | null
  naceCode2digit: string | null
  sizeBand: string | null
  kAnonOk: boolean
}

type Props = {
  orgId: string | null | undefined
  metric: BenchmarkMetricKey
  label: string
  /** Forklarende undertekst (f.eks. «Kritiske funn siste 90 dager»). */
  valueLabel?: string
  /** 'increase' = høyere er bedre (default), 'decrease' = lavere er bedre. */
  goalDirection?: 'increase' | 'decrease'
  /** Antall historiske måneder å hente (default 6). */
  periods?: number
  /** Når satt, brukes denne serien i stedet for å hente fra RPC. */
  series?: BenchmarkPoint[]
  accent?: string
}

const NACE2_NAMES: Record<string, string> = {
  '01': 'jordbruk', '02': 'skogbruk', '03': 'fiske', '05': 'kullutvinning',
  '06': 'petroleumsutvinning', '10': 'næringsmiddel', '13': 'tekstil',
  '16': 'trelast', '20': 'kjemisk', '23': 'mineralprodukter', '24': 'metall',
  '25': 'metallvarer', '28': 'maskiner', '29': 'motorvogn', '33': 'reparasjon',
  '35': 'kraft', '36': 'vannforsyning', '38': 'avfall', '41': 'bygg',
  '42': 'anlegg', '43': 'byggevirksomhet', '45': 'motorvognreparasjon',
  '46': 'engros', '47': 'detalj', '49': 'landtransport', '50': 'sjøtransport',
  '52': 'lagring', '55': 'overnatting', '56': 'servering', '58': 'forlag',
  '61': 'telekom', '62': 'IT', '64': 'finans', '68': 'eiendom', '69': 'juridisk',
  '70': 'hovedkontor', '71': 'arkitekt', '74': 'faglig', '78': 'arbeidsformidling',
  '80': 'sikkerhet', '81': 'eiendomsservice', '84': 'offentlig forvaltning',
  '85': 'undervisning', '86': 'helsetjenester', '87': 'pleie- og omsorg',
  '88': 'sosialtjeneste', '90': 'kunst', '93': 'sport',
  '94': 'organisasjoner', '96': 'personlig tjenesteyting',
}

function formatValue(metric: BenchmarkMetricKey, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (metric === 'overdue_actions_pct' || metric === 'sjekkliste_completion_pct') {
    return `${v.toFixed(1)} %`
  }
  if (metric === 'course_certificates_per_employee') return v.toFixed(2)
  return String(Math.round(v))
}

/** Percentil-anslag fra p25/p50/p75 — lineær interpolasjon innenfor
 *  hver kvartil. Brukerne ser dette som "rangering" mot peers. */
function percentileFromQuartiles(
  v: number,
  p25: number,
  p50: number,
  p75: number,
): number {
  if (!Number.isFinite(v)) return 50
  if (v <= p25) {
    // Under p25: lineær mellom 0 og 25.
    if (p25 === 0) return v <= 0 ? 0 : 25
    return Math.max(0, Math.min(25, (v / p25) * 25))
  }
  if (v <= p50) {
    const span = p50 - p25 || 1
    return 25 + ((v - p25) / span) * 25
  }
  if (v <= p75) {
    const span = p75 - p50 || 1
    return 50 + ((v - p50) / span) * 25
  }
  // Over p75: 75–100 ekstrapolert mot 2× IQR (kappet ved 100).
  const iqr = (p75 - p25) || 1
  return Math.min(100, 75 + ((v - p75) / iqr) * 25)
}

export function BenchmarkWidget({
  orgId,
  metric,
  label,
  valueLabel,
  goalDirection = 'decrease',
  periods = 6,
  series,
  accent = '#4338ca',
}: Props) {
  const ctx = useOrgSetupContext()
  const supabase = ctx.supabase
  const [data, setData] = useState<BenchmarkPoint[]>(series ?? [])
  const [loading, setLoading] = useState<boolean>(!series && !!orgId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (series) {
      setData(series)
      return
    }
    if (!supabase || !orgId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void supabase
      .rpc('get_my_org_benchmark', {
        p_org_id: orgId,
        p_metric: metric,
        p_periods: periods,
      })
      .then(({ data: rows, error: rpcErr }) => {
        if (cancelled) return
        if (rpcErr) {
          setError(rpcErr.message)
          setLoading(false)
          return
        }
        const normalized: BenchmarkPoint[] = ((rows ?? []) as Array<Record<string, unknown>>).map(
          (r) => ({
            periodMonth: String(r.period_month ?? ''),
            orgValue: Number(r.org_value ?? 0),
            benchMedian: r.bench_median == null ? null : Number(r.bench_median),
            benchP25: r.bench_p25 == null ? null : Number(r.bench_p25),
            benchP75: r.bench_p75 == null ? null : Number(r.bench_p75),
            benchMean: r.bench_mean == null ? null : Number(r.bench_mean),
            benchOrgCount: r.bench_org_count == null ? null : Number(r.bench_org_count),
            naceCode2digit: (r.nace_code_2digit as string | null) ?? null,
            sizeBand: (r.size_band as string | null) ?? null,
            kAnonOk: Boolean(r.k_anon_ok),
          }),
        )
        setData(normalized)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId, metric, periods, series])

  const latest = data[0]
  const naceName = latest?.naceCode2digit ? NACE2_NAMES[latest.naceCode2digit] ?? `NACE ${latest.naceCode2digit}` : null
  const orgPercentile = useMemo(() => {
    if (!latest || !latest.kAnonOk) return null
    const { benchP25, benchMedian, benchP75 } = latest
    if (benchP25 == null || benchMedian == null || benchP75 == null) return null
    return percentileFromQuartiles(latest.orgValue, benchP25, benchMedian, benchP75)
  }, [latest])

  const sparkSeries = useMemo(() => [...data].reverse().map((d) => d.orgValue), [data])

  return (
    <div className="rounded-xl border border-neutral-200/70 bg-white p-6" style={{ boxShadow: 'inset 0 3px 0 0 ' + accent + ', 0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-wider text-neutral-900">{label}</p>
          {valueLabel ? <p className="mt-1 text-[13px] text-neutral-500">{valueLabel}</p> : null}
        </div>
        <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 ring-1 ring-inset ring-indigo-200">
          Anonymisert
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <p className="text-4xl font-semibold tabular-nums text-neutral-900">
          {loading ? '…' : error ? '—' : formatValue(metric, latest?.orgValue)}
        </p>
        {orgPercentile != null ? (
          <PercentilePill percentile={orgPercentile} goal={goalDirection} />
        ) : null}
      </div>

      {sparkSeries.length > 1 ? (
        <div className="mt-2">
          <Sparkline values={sparkSeries} accent={accent} />
        </div>
      ) : null}

      <div className="mt-3 text-[11px] leading-relaxed text-neutral-600">
        {error ? (
          <p className="text-red-600">Kunne ikke hente benchmark: {error}</p>
        ) : latest && !latest.kAnonOk ? (
          <p className="rounded bg-amber-50 px-2 py-1 text-amber-900 ring-1 ring-inset ring-amber-200">
            For lite data i din bransje + størrelses-bånd (k-anonymitet=5 ikke nådd).
          </p>
        ) : latest && latest.kAnonOk && latest.benchMedian != null ? (
          <>
            <p>
              Bransje-median: <span className="font-semibold tabular-nums text-neutral-900">{formatValue(metric, latest.benchMedian)}</span>
              {' · '}
              p25–p75: <span className="tabular-nums">{formatValue(metric, latest.benchP25)} – {formatValue(metric, latest.benchP75)}</span>
            </p>
            <p className="mt-0.5 text-neutral-500">
              Sammenliknet med {latest.benchOrgCount} andre virksomheter
              {naceName ? ` i bransje ${naceName}` : ''}
              {latest.sizeBand ? ` (${latest.sizeBand} ansatte)` : ''}.
            </p>
          </>
        ) : (
          <p className="text-neutral-500">Ingen sammenligning tilgjengelig ennå.</p>
        )}
      </div>
    </div>
  )
}

/** Liten chip som viser percentil + en pil basert på goalDirection. */
function PercentilePill({ percentile, goal }: { percentile: number; goal: 'increase' | 'decrease' }) {
  const isGood = goal === 'increase' ? percentile >= 50 : percentile <= 50
  const color = isGood ? '#15803d' : '#b91c1c'
  const bg = isGood ? '#dcfce7' : '#fee2e2'
  const arrow = goal === 'increase' ? (percentile >= 50 ? '▲' : '▼') : percentile <= 50 ? '▼' : '▲'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
      style={{ color, backgroundColor: bg }}
      title={goal === 'increase' ? 'Høyere er bedre' : 'Lavere er bedre'}
    >
      <span aria-hidden>{arrow}</span>
      P{Math.round(percentile)}
    </span>
  )
}

/** Sub-pixel sparkline — auto-skalert, ingen akse-chrome. */
function Sparkline({ values, accent }: { values: number[]; accent: string }) {
  const W = 120
  const H = 28
  const PAD = 2
  const minY = Math.min(...values)
  const maxY = Math.max(...values)
  const range = maxY - minY || 1
  const step = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0
  const pts = values.map((y, i) => {
    const px = PAD + i * step
    const py = H - PAD - ((y - minY) / range) * (H - PAD * 2)
    return `${px.toFixed(1)},${py.toFixed(1)}`
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-7 w-full" aria-hidden>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={accent}
        strokeOpacity={0.85}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
