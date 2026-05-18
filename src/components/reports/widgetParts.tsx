// Studio Builder — extracted widget rendering helpers.
//
// These were previously module-private in ReportModuleWidget.tsx. As part
// of Task 0.3 Stage B (the destructive refactor of the 9-branch if-chain),
// each widget kind's renderer moves into widgetRenderers.tsx, which needs
// to import these helpers — so they live here.
//
// Pure motion: no behaviour changes, no API changes. ReportModuleWidget.tsx
// re-imports them from this file. External consumers (none today) would
// import directly.
//
// Spec: specs/studio-builder.md §5 Phase 0 Task 0.3 (Stage B).

import type { ReactNode } from 'react'
import { Button } from '../ui/Button'

// ────────────────────────────────────────────────────────────────────
// Donut — segments + center totalt + clickable list
// ────────────────────────────────────────────────────────────────────

export function DonutMini({
  segments,
  onSliceClick,
}: {
  segments: { label: string; value: number; color: string }[]
  onSliceClick?: (label: string) => void
}): ReactNode {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  let startPct = 0
  const stops: string[] = []
  for (const s of segments) {
    const pct = (s.value / total) * 100
    const end = startPct + pct
    stops.push(`${s.color} ${startPct}% ${end}%`)
    startPct = end
  }
  const bg = stops.length ? `conic-gradient(${stops.join(', ')})` : '#e5e7eb'

  return (
    <div className="flex flex-row-reverse items-center gap-6">
      <div
        className="relative size-40 shrink-0 rounded-full border border-neutral-200"
        style={{ background: bg }}
      >
        <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Totalt
          </span>
          <span className="text-2xl font-bold tabular-nums text-neutral-900">
            {Math.round(total)}
          </span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {segments.map((s) => {
          const pct = (s.value / total) * 100
          const inner = (
            <>
              <span className="flex min-w-0 items-center gap-2 truncate text-neutral-700">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="text-base font-semibold text-neutral-900">{s.value}</span>
                <span className="text-xs text-neutral-500">{pct.toFixed(2)}%</span>
              </span>
            </>
          )
          if (onSliceClick) {
            return (
              <li key={s.label}>
                <Button
                  variant="ghost"
                  onClick={() => onSliceClick(s.label)}
                  className="-mx-1 flex w-full justify-between gap-3 rounded-sm px-1 py-0.5 font-normal hover:bg-neutral-100"
                  title={`Filtrer på ${s.label}`}
                >
                  {inner}
                </Button>
              </li>
            )
          }
          return (
            <li key={s.label} className="flex justify-between gap-3">
              {inner}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// segmentsFromObject — Record → array of colored segments
// ────────────────────────────────────────────────────────────────────

export function segmentsFromObject(o: Record<string, unknown>, colors: string[]) {
  return Object.entries(o)
    .filter(([, v]) => typeof v === 'number' && !Number.isNaN(v as number))
    .map(([label, value], i) => ({
      label,
      value: value as number,
      color: colors[i % colors.length],
    }))
}

// ────────────────────────────────────────────────────────────────────
// EmptyWidget — quiet skeleton for "no data"
// ────────────────────────────────────────────────────────────────────

export function EmptyWidget({ label }: { label: string }): ReactNode {
  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-200 bg-neutral-50/40 px-4 py-6 text-center">
      <div className="h-1.5 w-12 rounded-full bg-neutral-200" />
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// LineMini — inline SVG line chart with optional comparison series
// ────────────────────────────────────────────────────────────────────

export function LineMini({
  points,
  comparisonPoints,
  primaryLabel,
  comparisonLabel,
  accent,
  xLabel,
  yLabel,
}: {
  points: { x: string | number; y: number }[]
  comparisonPoints?: { x: string | number; y: number }[]
  primaryLabel?: string
  comparisonLabel?: string
  accent: string
  xLabel?: string
  yLabel?: string
}): ReactNode {
  const W = 600
  const H = 220
  const PAD = 32
  const allYs = [...points.map((p) => p.y), ...(comparisonPoints?.map((p) => p.y) ?? [])]
  const minY = Math.min(0, ...allYs)
  const maxY = Math.max(1, ...allYs)
  const range = maxY - minY || 1
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0
  const project = (series: { x: string | number; y: number }[]) =>
    series.map((p, i) => {
      const x = PAD + i * stepX
      const y = H - PAD - ((p.y - minY) / range) * (H - PAD * 2)
      return { x, y, raw: p }
    })
  const xy = project(points)
  const cmpXy = comparisonPoints ? project(comparisonPoints.slice(0, points.length)) : []
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
  const path = toPath(xy)
  const cmpPath = cmpXy.length ? toPath(cmpXy) : ''
  const area = `${path} L ${xy[xy.length - 1]?.x.toFixed(1)} ${H - PAD} L ${xy[0]?.x.toFixed(1)} ${H - PAD} Z`
  const showEvery = Math.max(1, Math.ceil(xy.length / 6))
  return (
    <div className="mt-3">
      {comparisonPoints && comparisonPoints.length > 1 ? (
        <div className="mb-1 flex items-center gap-3 text-[10px] text-neutral-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4" style={{ backgroundColor: accent }} />
            {primaryLabel ?? 'Nåværende periode'}
          </span>
          <span className="inline-flex items-center gap-1.5 text-neutral-500">
            <span
              className="inline-block h-[2px] w-4"
              style={{
                backgroundImage: `linear-gradient(to right, ${accent} 50%, transparent 0%)`,
                backgroundSize: '4px 2px',
                backgroundRepeat: 'repeat-x',
              }}
            />
            {comparisonLabel ?? 'Forrige periode'}
          </span>
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-56 w-full"
        role="img"
        aria-label={`${yLabel ?? 'Verdi'} over ${xLabel ?? 'tid'}`}
      >
        {[0.25, 0.5, 0.75].map((f) => {
          const y = PAD + f * (H - PAD * 2)
          return (
            <line
              key={f}
              x1={PAD}
              x2={W - PAD}
              y1={y}
              y2={y}
              stroke="#e5e7eb"
              strokeDasharray="3 3"
            />
          )
        })}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#d4d4d8" />
        <path d={area} fill={accent} fillOpacity={0.08} />
        {cmpPath ? (
          <path
            d={cmpPath}
            fill="none"
            stroke={accent}
            strokeOpacity={0.55}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            strokeLinejoin="round"
          />
        ) : null}
        <path d={path} fill="none" stroke={accent} strokeWidth={2} strokeLinejoin="round" />
        {xy.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill={accent} />
        ))}
        {xy.map((pt, i) =>
          i % showEvery === 0 ? (
            <text
              key={`xl-${i}`}
              x={pt.x}
              y={H - PAD + 14}
              fontSize={10}
              fill="#6b7280"
              textAnchor="middle"
            >
              {String(pt.raw.x)}
            </text>
          ) : null,
        )}
        <text x={PAD - 4} y={PAD + 4} fontSize={10} fill="#6b7280" textAnchor="end">
          {Math.round(maxY)}
        </text>
        <text x={PAD - 4} y={H - PAD + 4} fontSize={10} fill="#6b7280" textAnchor="end">
          {Math.round(minY)}
        </text>
      </svg>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// KpiDeltaChip — small delta indicator above KPI values
// ────────────────────────────────────────────────────────────────────

export function KpiDeltaChip({
  current,
  previous,
  goal,
}: {
  current: number
  previous: number
  goal: 'increase' | 'decrease'
}): ReactNode {
  if (previous === 0 && current === 0) return null
  const diff = current - previous
  const pct = previous === 0 ? null : (diff / Math.abs(previous)) * 100
  const up = diff > 0
  const flat = diff === 0
  const isGood = flat ? null : goal === 'increase' ? up : !up
  const color = isGood == null ? '#6b7280' : isGood ? '#15803d' : '#b91c1c'
  const bg = isGood == null ? '#f3f4f6' : isGood ? '#dcfce7' : '#fee2e2'
  const arrow = flat ? '→' : up ? '▲' : '▼'
  const label =
    pct == null
      ? `${up ? '+' : ''}${diff}`
      : `${up ? '+' : ''}${pct.toFixed(pct >= 10 || pct <= -10 ? 0 : 1)} %`
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
      style={{ color, backgroundColor: bg }}
      title={`Forrige periode: ${previous}`}
    >
      <span aria-hidden>{arrow}</span>
      {label}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────
// Sparkline — sub-pixel SVG polyline
// ────────────────────────────────────────────────────────────────────

export function Sparkline({ values, accent }: { values: number[]; accent: string }): ReactNode {
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

// ────────────────────────────────────────────────────────────────────
// HeatmapMini — inline SVG-on-html heatmap
// ────────────────────────────────────────────────────────────────────

export function HeatmapMini({
  rows,
  columns,
  cells,
  accent,
  valueMin,
  valueMax,
  valueLabel,
}: {
  rows: string[]
  columns: string[]
  cells: number[][]
  accent: string
  valueMin?: number
  valueMax?: number
  valueLabel?: string
}): ReactNode {
  const flat = cells.flat().filter((v) => Number.isFinite(v))
  const lo = valueMin ?? (flat.length ? Math.min(...flat) : 0)
  const hi = valueMax ?? (flat.length ? Math.max(...flat) : 1)
  const span = hi - lo || 1
  const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

  return (
    <div className="mt-3 overflow-x-auto">
      <table
        className="border-collapse text-[11px]"
        role="grid"
        aria-label={`Heatmap${valueLabel ? `: ${valueLabel}` : ''}`}
      >
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border border-neutral-200 bg-neutral-50 px-2 py-1 text-left font-semibold text-neutral-700" />
            {columns.map((c) => (
              <th
                key={c}
                title={c}
                className="border border-neutral-200 bg-neutral-50 px-1.5 py-1 align-bottom font-semibold text-neutral-700"
                style={{ minWidth: 40, maxWidth: 80 }}
              >
                <div className="origin-bottom-left -rotate-45 whitespace-nowrap text-left leading-none">
                  {truncate(c, 18)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((rowLabel, ri) => (
            <tr key={rowLabel}>
              <th
                scope="row"
                title={rowLabel}
                className="sticky left-0 z-10 border border-neutral-200 bg-neutral-50 px-2 py-1 text-left font-medium text-neutral-700"
                style={{ minWidth: 140, maxWidth: 220 }}
              >
                {truncate(rowLabel, 28)}
              </th>
              {columns.map((colLabel, ci) => {
                const v = cells[ri]?.[ci] ?? 0
                const t = Math.max(0, Math.min(1, (v - lo) / span))
                const bg = `${accent}${Math.round((0.1 + t * 0.8) * 255)
                  .toString(16)
                  .padStart(2, '0')}`
                const text = t > 0.55 ? '#ffffff' : '#1f2937'
                return (
                  <td
                    key={colLabel}
                    title={`${rowLabel} · ${colLabel}: ${v}${valueLabel ? ` ${valueLabel}` : ''}`}
                    className="border border-neutral-200 px-2 py-1 text-center font-medium tabular-nums"
                    style={{ backgroundColor: bg, color: text, minWidth: 40 }}
                  >
                    {Number.isFinite(v) ? (Number.isInteger(v) ? v : v.toFixed(1)) : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
