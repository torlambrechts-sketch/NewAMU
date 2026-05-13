// LayoutPuls — performance-terminal-variant av Arbeidsmiljøstrategi.
// Sterk informasjonsdensitet, status-fargekode per akse, sparklines
// over hele 12-måneders historikken og en handlingskø sortert etter
// alvorlighet. Designet for å åpnes hver morgen — temperaturen først.
//
// Palette: nesten-hvit slate-bakgrunn, smal-bordede kort uten skygger,
// tabulær monospace for tall, status-farger (emerald/amber/rose) for
// raske helhetsbedømminger. Vekstig animasjon på indeksen så «levende»
// signal er synlig i sidesynet.

import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowRight, Circle, MinusCircle, Pause, TrendingUp } from 'lucide-react'
import {
  WELLBEING_AXIS_LABELS,
  type WellbeingAxisKey,
} from '../dashboards/useWorkerWellbeingDatasets'
import type { ArbeidsmiljostrategiData } from '../hooks/useArbeidsmiljostrategiData'

type Status = 'good' | 'warn' | 'risk' | 'none'

function statusFor(score: string): Status {
  if (!score || score === '—') return 'none'
  const n = Number(score)
  if (Number.isNaN(n)) return 'none'
  if (n >= 70) return 'good'
  if (n >= 45) return 'warn'
  return 'risk'
}

const STATUS_TEXT: Record<Status, string> = {
  good: 'text-emerald-700',
  warn: 'text-amber-700',
  risk: 'text-rose-700',
  none: 'text-neutral-400',
}

const STATUS_BAR: Record<Status, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  risk: 'bg-rose-500',
  none: 'bg-neutral-300',
}

const STATUS_TINT: Record<Status, string> = {
  good: 'bg-emerald-50 border-emerald-200',
  warn: 'bg-amber-50 border-amber-200',
  risk: 'bg-rose-50 border-rose-200',
  none: 'bg-neutral-50 border-neutral-200',
}

const STATUS_LABEL: Record<Status, string> = {
  good: 'God',
  warn: 'Ujevn',
  risk: 'Lav',
  none: 'Ikke målt',
}

const SEVERITY_PILL: Record<string, string> = {
  Kritisk: 'bg-rose-100 text-rose-900 ring-rose-200',
  Høy: 'bg-amber-100 text-amber-900 ring-amber-200',
  Medium: 'bg-yellow-50 text-yellow-900 ring-yellow-200',
}

export function LayoutPuls({ data }: { data: ArbeidsmiljostrategiData }) {
  const indexStatus = statusFor(data.indexLabel)
  const latestCapturedAt = data.latestSnapshot?.captured_at
    ? new Date(data.latestSnapshot.captured_at).toLocaleString('nb-NO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—'

  // Beregn delta vs forrige snapshot. Bruker indeks 1 i den nyeste-først-
  // sorterte snapshot-listen så vi sammenligner inneværende måned med
  // den siste lagrede måneden — uavhengig av om dagens snapshot
  // eksisterer eller ikke.
  const previousSnapshot = data.snapshots[1] ?? data.snapshots[0] ?? null
  const previousIsCurrent = previousSnapshot && previousSnapshot.period_key === data.currentPeriodKey
  const compare = previousSnapshot && !previousIsCurrent ? previousSnapshot : data.snapshots[1] ?? null
  const sinceLast: Array<{ axisKey: WellbeingAxisKey; current: number | null; previous: number | null; delta: number | null }> = (
    ['trygghet', 'trivsel', 'medvirkning', 'mestring'] as WellbeingAxisKey[]
  ).map((k) => {
    const cur = Number(data.axisScores[k])
    const current = Number.isFinite(cur) ? cur : null
    const previous = compare ? (compare[`${k}_score` as keyof typeof compare] as number | null) ?? null : null
    const delta = current != null && previous != null ? current - previous : null
    return { axisKey: k, current, previous, delta }
  })
  const hasComparison = compare != null && sinceLast.some((r) => r.delta != null)
  const comparePeriod = compare?.period_key ?? null
  const indexCurrent = Number(data.indexLabel)
  const indexPrev = compare?.index_value ?? null
  const indexDelta = Number.isFinite(indexCurrent) && indexPrev != null ? indexCurrent - indexPrev : null

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-slate-50 px-4 py-6 sm:px-6 md:-mx-8 md:px-8 font-sans tabular-nums">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* ── Siden sist — diff-banner mot forrige snapshot ─────────── */}
        {hasComparison && (
          <SinceLastStripe
            comparePeriod={comparePeriod ?? '—'}
            indexDelta={indexDelta}
            axes={sinceLast}
          />
        )}
        {/* ── Top strip: live state ─────────────────────────────────── */}
        <header className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Big index card */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  <Activity className="h-3 w-3 animate-pulse text-amber-600" aria-hidden /> Live indeks
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className={`text-5xl font-bold leading-none ${STATUS_TEXT[indexStatus]}`}
                    style={{ fontFeatureSettings: '"tnum"' }}
                  >
                    {data.indexLabel}
                  </span>
                  <span className="text-xs text-slate-500">av 100</span>
                  {data.indexDelta && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                        data.indexDelta.startsWith('+')
                          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                          : data.indexDelta.startsWith('-')
                          ? 'bg-rose-50 text-rose-800 ring-rose-200'
                          : 'bg-slate-50 text-slate-700 ring-slate-200'
                      }`}
                    >
                      {data.indexDelta}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right text-[10px] uppercase tracking-wide text-slate-400">
                <div>Forrige capture</div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-700">{latestCapturedAt}</div>
                <div className="mt-2">{data.organizationName}</div>
              </div>
            </div>
            <Sparkline points={data.trendPoints} status={indexStatus} className="mt-3 h-16 w-full" />
          </div>
          {/* Axis status cards */}
          {(['trygghet', 'trivsel', 'medvirkning', 'mestring'] as WellbeingAxisKey[]).map((k) => (
            <AxisTile key={k} axisKey={k} score={data.axisScores[k]} trend={data.trendPoints} />
          ))}
        </header>

        {/* ── Trend + signal grid ───────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                <TrendingUp className="h-3 w-3" aria-hidden /> Trend · 12 mnd
              </div>
              <span className="text-[10px] text-slate-400">indeksverdier 0–100</span>
            </div>
            <TrendArea points={data.trendPoints} />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                <AlertTriangle className="h-3 w-3 text-rose-600" aria-hidden /> Handlingskø
              </div>
              <span className="text-[10px] text-slate-400">{data.actionQueue.length} åpne</span>
            </div>
            {data.actionQueue.length === 0 ? (
              <p className="text-xs italic text-slate-500">Ingen handling kreves akkurat nå.</p>
            ) : (
              <ul className="space-y-2">
                {data.actionQueue.slice(0, 7).map((row, i) => (
                  <li key={i} className="rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset ${SEVERITY_PILL[row.severity] ?? 'bg-slate-100 text-slate-700 ring-slate-200'}`}
                          >
                            {row.severity}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {row.axis}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-snug text-slate-800">{row.item}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-400">{row.origin}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── Axis-detail row (signal + neste steg) ─────────────────── */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.axisOverview.map((row) => {
            const s = statusFor(row.score)
            return (
              <article
                key={row.axisKey}
                className={`rounded-lg border p-3 ${STATUS_TINT[s]}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    <StatusDot status={s} /> {WELLBEING_AXIS_LABELS[row.axisKey]}
                  </div>
                  <span className={`text-2xl font-bold ${STATUS_TEXT[s]}`} style={{ fontFeatureSettings: '"tnum"' }}>
                    {row.score}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                  <span className="font-semibold text-slate-700">Signal</span>
                  <span className="text-slate-700">{row.signal}</span>
                  <span className="font-semibold text-slate-700">Neste</span>
                  <span className="text-slate-700">{row.nextMove}</span>
                </div>
              </article>
            )
          })}
        </section>

        {/* ── Tools readiness — terminal-style table ────────────────── */}
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Verktøy-status
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Akse</th>
                <th className="px-4 py-2 font-semibold">Verktøy</th>
                <th className="px-4 py-2 font-semibold">Tilstand</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.tools.map((tool, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {WELLBEING_AXIS_LABELS[tool.axis]}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-900">{tool.title}</td>
                  <td className="px-4 py-2 text-slate-600">{tool.description}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={tool.path}
                      className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900"
                    >
                      Åpne <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

function SinceLastStripe({
  comparePeriod,
  indexDelta,
  axes,
}: {
  comparePeriod: string
  indexDelta: number | null
  axes: Array<{ axisKey: WellbeingAxisKey; current: number | null; previous: number | null; delta: number | null }>
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          <ArrowRight className="h-3 w-3" aria-hidden /> Siden {comparePeriod}
        </div>
        <DeltaPill label="Indeks" delta={indexDelta} highlight />
        <div className="h-4 w-px bg-slate-200" aria-hidden />
        {axes.map((row) => (
          <DeltaPill key={row.axisKey} label={WELLBEING_AXIS_LABELS[row.axisKey]} delta={row.delta} />
        ))}
      </div>
    </div>
  )
}

function DeltaPill({
  label,
  delta,
  highlight = false,
}: {
  label: string
  delta: number | null
  highlight?: boolean
}) {
  const value = delta == null ? '—' : delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0'
  const tone =
    delta == null
      ? 'text-slate-400'
      : delta > 0
      ? 'text-emerald-700'
      : delta < 0
      ? 'text-rose-700'
      : 'text-slate-500'
  const arrow = delta == null ? null : delta > 0 ? '↑' : delta < 0 ? '↓' : '·'
  return (
    <div
      className={`inline-flex items-baseline gap-1.5 ${highlight ? 'rounded px-2 py-0.5 ring-1 ring-inset ring-slate-200 bg-slate-50' : ''}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`text-xs font-bold tabular-nums ${tone}`}>
        {arrow} {value}
      </span>
    </div>
  )
}

function StatusDot({ status }: { status: Status }) {
  if (status === 'none') return <MinusCircle className="h-3 w-3 text-slate-400" aria-hidden />
  if (status === 'risk') return <Circle className="h-3 w-3 fill-rose-500 text-rose-500" aria-hidden />
  if (status === 'warn') return <Pause className="h-3 w-3 text-amber-600" aria-hidden />
  return <Circle className="h-3 w-3 fill-emerald-500 text-emerald-500" aria-hidden />
}

function AxisTile({
  axisKey,
  score,
  trend,
}: {
  axisKey: WellbeingAxisKey
  score: string
  trend: Array<{ x: string; y: number; hasData?: boolean }>
}) {
  const s = statusFor(score)
  return (
    <div className={`rounded-lg border p-3 ${STATUS_TINT[s]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
          {WELLBEING_AXIS_LABELS[axisKey]}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wide ${STATUS_TEXT[s]}`}>
          {STATUS_LABEL[s]}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className={`text-3xl font-bold ${STATUS_TEXT[s]}`} style={{ fontFeatureSettings: '"tnum"' }}>
          {score}
        </span>
        <Sparkline points={trend} status={s} className="h-8 w-20" />
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-white/60">
        <div
          className={`h-1 rounded-full ${STATUS_BAR[s]}`}
          style={{ width: `${Math.max(0, Math.min(100, Number(score) || 0))}%` }}
        />
      </div>
    </div>
  )
}

function Sparkline({
  points,
  status,
  className = '',
}: {
  points: Array<{ y: number; hasData?: boolean }>
  status: Status
  className?: string
}) {
  const color = status === 'good' ? '#10b981' : status === 'warn' ? '#f59e0b' : status === 'risk' ? '#f43f5e' : '#cbd5e1'
  const W = 100
  const H = 30
  if (points.length === 0 || !points.some((p) => p.hasData)) {
    return <div className={`${className} text-[9px] text-slate-300`}>—</div>
  }
  const ys = points.map((p) => (p.hasData ? p.y : null))
  const segs: string[] = []
  let inLine = false
  ys.forEach((y, i) => {
    if (y == null) {
      inLine = false
      return
    }
    const x = (i / Math.max(1, ys.length - 1)) * W
    const yy = H - (y / 100) * H
    segs.push(`${inLine ? 'L' : 'M'} ${x.toFixed(1)} ${yy.toFixed(1)}`)
    inLine = true
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-hidden>
      <path d={segs.join(' ')} fill="none" stroke={color} strokeWidth={1.6} />
    </svg>
  )
}

function TrendArea({ points }: { points: Array<{ x: string; y: number; hasData?: boolean }> }) {
  const W = 700
  const H = 180
  const PAD = { top: 8, right: 8, bottom: 22, left: 28 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const xFor = (i: number) => PAD.left + (i / Math.max(1, points.length - 1)) * innerW
  const yFor = (y: number) => PAD.top + innerH - (y / 100) * innerH

  const hasAny = points.some((p) => p.hasData)
  if (!hasAny) {
    return (
      <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-10 text-center text-xs text-slate-500">
        Ingen snapshot ennå — første lagres når noen åpner siden.
      </div>
    )
  }

  const segs: string[] = []
  let inLine = false
  points.forEach((p, i) => {
    if (!p.hasData) {
      inLine = false
      return
    }
    segs.push(`${inLine ? 'L' : 'M'} ${xFor(i).toFixed(1)} ${yFor(p.y).toFixed(1)}`)
    inLine = true
  })
  const grid = [0, 25, 50, 75, 100]

  // Build a filled area underneath the line for "puls" feel
  const firstIdx = points.findIndex((p) => p.hasData)
  const lastIdx = points.length - 1 - [...points].reverse().findIndex((p) => p.hasData)
  const areaD =
    firstIdx >= 0 && lastIdx >= 0 && lastIdx > firstIdx
      ? `${segs.join(' ')} L ${xFor(lastIdx).toFixed(1)} ${yFor(0).toFixed(1)} L ${xFor(firstIdx).toFixed(1)} ${yFor(0).toFixed(1)} Z`
      : ''

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-hidden>
      {grid.map((g) => (
        <g key={g}>
          <line x1={PAD.left} x2={W - PAD.right} y1={yFor(g)} y2={yFor(g)} stroke="#e2e8f0" strokeWidth={0.5} />
          <text x={PAD.left - 4} y={yFor(g) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">
            {g}
          </text>
        </g>
      ))}
      {areaD && <path d={areaD} fill="#1a3d32" opacity={0.08} />}
      <path d={segs.join(' ')} fill="none" stroke="#1a3d32" strokeWidth={1.75} />
      {points.map((p, i) =>
        p.hasData ? <circle key={i} cx={xFor(i)} cy={yFor(p.y)} r={2.5} fill="#d97706" /> : null,
      )}
      {points.map((p, i) =>
        i % 2 === 0 ? (
          <text key={`x-${i}`} x={xFor(i)} y={H - 6} textAnchor="middle" fontSize={8.5} fill="#94a3b8">
            {p.x}
          </text>
        ) : null,
      )}
    </svg>
  )
}
