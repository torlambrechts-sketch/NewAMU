// DashboardVekst — varm-styled KPI / trend / aktivitets-dashboard.
// Skiller seg fra LayoutVekst (som er en strategi-side) ved at den
// pakker fire-fem KPI-tiler, en mild trend-graf og en aktivitetslogg
// inn i samme cream-palette og serif-typografi. Ment som mal for
// HMS-oversikt-flater hvor narrativ-stilen passer bedre enn den
// kompakte Puls-terminalen.

import type { ReactNode } from 'react'
import {
  MotifMedvirkning,
  MotifMestring,
  MotifTrivsel,
  MotifTrygghet,
} from '../components/AxisMotifs'
import type { WellbeingAxisKey } from '../dashboards/useWorkerWellbeingDatasets'

const SERIF = "'Libre Baskerville', Georgia, serif"
const INK = '#1a3d32'
const WARM = '#d97706'

const MOTIF_BY_AXIS: Record<WellbeingAxisKey, React.ComponentType<{ className?: string }>> = {
  trygghet: MotifTrygghet,
  trivsel: MotifTrivsel,
  medvirkning: MotifMedvirkning,
  mestring: MotifMestring,
}

export type DashboardVekstKpi = {
  id: string
  label: string
  value: string | number
  sub?: string
  delta?: string
  motif?: WellbeingAxisKey
}

export type DashboardVekstTrend = {
  title: string
  description?: string
  /** points sorted left-to-right; y in 0..100 */
  points: Array<{ x: string; y: number; hasData?: boolean }>
}

export type DashboardVekstActivityRow = {
  id: string
  when: string
  what: string
  who?: string
  motif?: WellbeingAxisKey
  /** Affects the warm-tint of the row dot. */
  tone?: 'warm' | 'neutral' | 'forest'
}

export type DashboardVekstProps = {
  eyebrow?: string
  title: string
  subtitle?: ReactNode
  /** Top-right area — e.g. a print or settings button. */
  headerActions?: ReactNode
  kpis: DashboardVekstKpi[]
  trend?: DashboardVekstTrend
  activity?: DashboardVekstActivityRow[]
  footnote?: ReactNode
}

export function DashboardVekst({
  eyebrow,
  title,
  subtitle,
  headerActions,
  kpis,
  trend,
  activity,
  footnote,
}: DashboardVekstProps) {
  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[#FAF6EE] px-4 py-10 sm:px-6 sm:py-12 md:-mx-8 md:px-12">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            {eyebrow && (
              <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900">
                {eyebrow}
              </span>
            )}
            <h1
              className="text-4xl font-bold leading-tight text-[#1a3d32] sm:text-5xl"
              style={{ fontFamily: SERIF }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="max-w-2xl text-base leading-relaxed text-[#516760]">{subtitle}</p>
            )}
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </header>

        {/* KPI grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => {
            const Motif = kpi.motif ? MOTIF_BY_AXIS[kpi.motif] : null
            return (
              <article
                key={kpi.id}
                className="relative overflow-hidden rounded-3xl border border-[#1a3d32]/15 bg-white p-5 shadow-[0_10px_30px_-18px_rgba(26,61,50,0.25)]"
              >
                {Motif && (
                  <Motif className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 opacity-[0.06]" />
                )}
                <div className="relative">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                    {kpi.label}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className="text-4xl font-bold leading-none text-[#1a3d32]"
                      style={{ fontFamily: SERIF, fontFeatureSettings: '"tnum"' }}
                    >
                      {kpi.value}
                    </span>
                    {kpi.delta && (
                      <span
                        className={`text-xs font-semibold ${
                          kpi.delta.startsWith('+')
                            ? 'text-emerald-700'
                            : kpi.delta.startsWith('-')
                            ? 'text-rose-700'
                            : 'text-[#516760]'
                        }`}
                      >
                        {kpi.delta}
                      </span>
                    )}
                  </div>
                  {kpi.sub && (
                    <p className="mt-1 text-xs leading-relaxed text-[#516760]">{kpi.sub}</p>
                  )}
                </div>
              </article>
            )
          })}
        </section>

        {/* Trend */}
        {trend && (
          <section className="rounded-3xl border border-[#1a3d32]/15 bg-white p-6 shadow-[0_10px_30px_-18px_rgba(26,61,50,0.25)]">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                  Slik vokser vi
                </div>
                <h2
                  className="mt-1 text-2xl font-bold text-[#1a3d32]"
                  style={{ fontFamily: SERIF }}
                >
                  {trend.title}
                </h2>
                {trend.description && (
                  <p className="mt-1 text-sm text-[#516760]">{trend.description}</p>
                )}
              </div>
            </div>
            <WarmTrend points={trend.points} />
          </section>
        )}

        {/* Activity */}
        {activity && activity.length > 0 && (
          <section className="rounded-3xl border border-[#1a3d32]/15 bg-white p-6 shadow-[0_10px_30px_-18px_rgba(26,61,50,0.25)]">
            <div className="mb-4 flex items-baseline justify-between gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                  Dette har vi gjort sammen
                </div>
                <h2
                  className="mt-1 text-2xl font-bold text-[#1a3d32]"
                  style={{ fontFamily: SERIF }}
                >
                  Aktivitet
                </h2>
              </div>
            </div>
            <ol className="space-y-4">
              {activity.map((row) => {
                const Motif = row.motif ? MOTIF_BY_AXIS[row.motif] : null
                const tone =
                  row.tone === 'forest'
                    ? 'bg-emerald-500'
                    : row.tone === 'neutral'
                    ? 'bg-[#1a3d32]/40'
                    : 'bg-amber-500'
                return (
                  <li key={row.id} className="flex items-start gap-4">
                    <div className="flex flex-col items-center pt-1">
                      <span className={`h-3 w-3 rounded-full ${tone}`} />
                      <span className="mt-1 h-full w-px bg-amber-100" />
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-baseline gap-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#516760]">
                          {row.when}
                        </span>
                        {row.who && (
                          <span
                            className="text-xs italic text-[#516760]"
                            style={{ fontFamily: SERIF }}
                          >
                            {row.who}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-start gap-2">
                        {Motif && <Motif className="h-5 w-5 shrink-0" />}
                        <p
                          className="text-base leading-relaxed text-[#1a3d32]"
                          style={{ fontFamily: SERIF }}
                        >
                          {row.what}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {footnote && <p className="text-center text-[11px] italic text-[#516760]">{footnote}</p>}
      </div>
    </div>
  )
}

function WarmTrend({ points }: { points: Array<{ x: string; y: number; hasData?: boolean }> }) {
  const W = 720
  const H = 200
  const PAD = { top: 16, right: 24, bottom: 32, left: 36 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const hasAny = points.some((p) => p.hasData !== false)
  if (!hasAny || points.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/30 px-6 py-10 text-center text-sm text-[#516760]">
        Vi har ikke nok historikk ennå. Den første lille linjen kommer når neste
        snapshot lagres.
      </div>
    )
  }

  const xFor = (i: number) => PAD.left + (i / Math.max(1, points.length - 1)) * innerW
  const yFor = (v: number) => PAD.top + innerH - (v / 100) * innerH

  const linePts: string[] = []
  let inLine = false
  points.forEach((p, i) => {
    if (p.hasData === false) {
      inLine = false
      return
    }
    linePts.push(`${inLine ? 'L' : 'M'} ${xFor(i).toFixed(1)} ${yFor(p.y).toFixed(1)}`)
    inLine = true
  })

  const firstIdx = points.findIndex((p) => p.hasData !== false)
  const lastIdx = points.length - 1 - [...points].reverse().findIndex((p) => p.hasData !== false)
  const areaD =
    firstIdx >= 0 && lastIdx >= 0 && lastIdx > firstIdx
      ? `${linePts.join(' ')} L ${xFor(lastIdx).toFixed(1)} ${yFor(0).toFixed(
          1,
        )} L ${xFor(firstIdx).toFixed(1)} ${yFor(0).toFixed(1)} Z`
      : ''

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-hidden>
      <defs>
        <linearGradient id="vekstTrendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={WARM} stopOpacity="0.35" />
          <stop offset="100%" stopColor={WARM} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 50, 75, 100].map((g) => (
        <line
          key={g}
          x1={PAD.left}
          x2={W - PAD.right}
          y1={yFor(g)}
          y2={yFor(g)}
          stroke="#e2d8c5"
          strokeWidth={0.6}
          strokeDasharray="2 4"
        />
      ))}
      {areaD && <path d={areaD} fill="url(#vekstTrendGrad)" />}
      <path d={linePts.join(' ')} fill="none" stroke={INK} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) =>
        p.hasData !== false ? (
          <circle key={i} cx={xFor(i)} cy={yFor(p.y)} r={3.5} fill={WARM} stroke="#fff" strokeWidth={1.5} />
        ) : null,
      )}
      {points.map((p, i) =>
        i % 2 === 0 ? (
          <text key={`x-${i}`} x={xFor(i)} y={H - 10} textAnchor="middle" fontSize={10} fill="#516760" fontFamily={SERIF}>
            {p.x}
          </text>
        ) : null,
      )}
      {[0, 50, 100].map((g) => (
        <text key={g} x={PAD.left - 6} y={yFor(g) + 4} textAnchor="end" fontSize={10} fill="#516760">
          {g}
        </text>
      ))}
    </svg>
  )
}
