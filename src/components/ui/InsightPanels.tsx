import type { CSSProperties, ReactNode } from 'react'

/**
 * Shared insight panel primitives — same visual language as the platform-admin
 * rapportering / ui-advanced reference panels.
 *
 * InsightCardShell  — white card wrapper (matches WORKPLACE_MODULE_CARD surface)
 * DonutChartBlock   — SVG donut with centred label + value
 * HorizontalMetricRow — labelled value + coloured progress bar
 */

export function InsightCardShell({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`relative rounded-xl border border-neutral-200/80 bg-white shadow-sm ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)', ...style }}
    >
      {children}
    </div>
  )
}

export function DonutChartBlock({
  segments,
  centerLabel,
  centerValue,
  size = 140,
}: {
  /** Each segment as a percentage (0–100). Segments should sum to 100. */
  segments: { pct: number; color: string }[]
  centerLabel: string
  centerValue: string
  size?: number
}) {
  const stroke = 16
  const r = (size - stroke) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r
  const arcs: { dash: number; offset: number }[] = []
  let cum = 0
  for (const seg of segments) {
    const dash = (seg.pct / 100) * circumference
    arcs.push({ dash, offset: cum })
    cum += dash
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <g transform={`rotate(-90 ${c} ${c})`}>
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={segments[i]!.color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="round"
          />
        ))}
      </g>
      <text
        x={c}
        y={c - 5}
        textAnchor="middle"
        style={{ fontSize: 9, fontWeight: 600, fill: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        {centerLabel}
      </text>
      <text
        x={c}
        y={c + 14}
        textAnchor="middle"
        style={{ fontSize: 22, fontWeight: 700, fill: '#171717' }}
      >
        {centerValue}
      </text>
    </svg>
  )
}

export function HorizontalMetricRow({
  label,
  value,
  max,
  barColor,
}: {
  label: string
  value: number
  max: number
  barColor: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-neutral-600">{label}</span>
      <span className="w-5 shrink-0 tabular-nums font-medium text-neutral-900">{value}</span>
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
        {value > 0 ? (
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        ) : null}
      </div>
    </div>
  )
}
