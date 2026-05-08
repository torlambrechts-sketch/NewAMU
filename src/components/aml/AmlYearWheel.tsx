// AmlYearWheel — circular calendar component used on the
// Arbeidsmiljøloven dashboard. 12 month wedges, concentric rings (one
// per category), activity dots placed at (month, ring). Click a wedge
// to filter the side list to that month.
//
// Design source: ui_kits/aml-compliance/Arshjul.jsx. Reusable for any
// per-regulation annual cycle — pass a different `items` array + ring
// legend to repurpose for ISO 9001 / 14001 / GDPR.

import {
  AML_RING_LEGEND,
  AML_TODAY,
  AML_WHEEL,
  MONTHS_NB,
  MONTHS_NB_SHORT,
  type AmlRingLegendEntry,
  type AmlToday,
  type AmlWheelItem,
  type AmlWheelState,
} from '../../data/amlComplianceSeed'

const SERIF = "'Libre Baskerville', Georgia, serif"

type Props = {
  today?: AmlToday
  items?: AmlWheelItem[]
  legend?: AmlRingLegendEntry[]
  selectedMonth?: number | null
  onSelectMonth?: (next: number | null) => void
}

export function AmlYearWheel({
  today = AML_TODAY,
  items = AML_WHEEL,
  legend = AML_RING_LEGEND,
  selectedMonth = null,
  onSelectMonth,
}: Props) {
  const SIZE = 720
  const CX = SIZE / 2
  const CY = SIZE / 2
  const R_OUTER = 320
  const R_INNER = 96
  const RING_COUNT = legend.length
  const RING_GAP = (R_OUTER - R_INNER) / RING_COUNT

  const ringColor = (id: number): string =>
    legend.find((r) => r.id === id)?.color ?? '#525252'

  const monthAngles = (m: number) => {
    const start = -90 + m * 30
    const end = start + 30
    return { start, end, mid: (start + end) / 2 }
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [
    cx + r * Math.cos(toRad(deg)),
    cy + r * Math.sin(toRad(deg)),
  ]
  const arcPath = (
    cx: number,
    cy: number,
    rOuter: number,
    rInner: number,
    startDeg: number,
    endDeg: number,
  ) => {
    const [x1, y1] = polar(cx, cy, rOuter, startDeg)
    const [x2, y2] = polar(cx, cy, rOuter, endDeg)
    const [x3, y3] = polar(cx, cy, rInner, endDeg)
    const [x4, y4] = polar(cx, cy, rInner, startDeg)
    const large = endDeg - startDeg <= 180 ? 0 : 1
    return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`
  }

  const todayAngle = -90 + today.m * 30 + (today.d / 30) * 30
  const [tx, ty] = polar(CX, CY, R_OUTER + 6, todayAngle)
  const [t0x, t0y] = polar(CX, CY, R_INNER, todayAngle)

  // Group items by (month, ring) so colliding activities stack.
  const grouped = new Map<string, AmlWheelItem[]>()
  for (const it of items) {
    const k = `${it.month}-${it.ring}`
    const list = grouped.get(k) ?? []
    list.push(it)
    grouped.set(k, list)
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        aria-label={`Årshjul for ${today.y}`}
      >
        <defs>
          <radialGradient id="aml-center-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbf9f3" />
            <stop offset="100%" stopColor="#F1ECDF" />
          </radialGradient>
        </defs>

        {/* Month wedges */}
        {Array.from({ length: 12 }).map((_, m) => {
          const { start, end } = monthAngles(m)
          const isCurrent = m === today.m
          const isSelected = selectedMonth === m
          const isPast = m < today.m
          const fill = isCurrent ? '#e7efe9' : isPast ? '#fbf9f3' : '#ffffff'
          const strokeColor = isSelected ? '#1a3d32' : '#e3ddcc'
          const strokeWidth = isSelected ? 2 : 1
          return (
            <g
              key={`wedge-${m}`}
              style={{ cursor: onSelectMonth ? 'pointer' : 'default' }}
              onClick={() => onSelectMonth?.(m === selectedMonth ? null : m)}
            >
              <path
                d={arcPath(CX, CY, R_OUTER, R_INNER, start, end)}
                fill={fill}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            </g>
          )
        })}

        {/* Concentric ring lines */}
        {Array.from({ length: RING_COUNT - 1 }).map((_, i) => (
          <circle
            key={`ringline-${i}`}
            cx={CX}
            cy={CY}
            r={R_INNER + RING_GAP * (i + 1)}
            fill="none"
            stroke="#e3ddcc"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        ))}

        {/* Month labels */}
        {Array.from({ length: 12 }).map((_, m) => {
          const { mid } = monthAngles(m)
          const [lx, ly] = polar(CX, CY, R_OUTER + 26, mid)
          const isCurrent = m === today.m
          const isPast = m < today.m
          const color = isCurrent ? '#1a3d32' : isPast ? '#a3a3a3' : '#404040'
          const weight = isCurrent ? 700 : 600
          return (
            <text
              key={`mlabel-${m}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={13}
              fontWeight={weight}
              fill={color}
              style={{
                fontFamily: "'Inter', sans-serif",
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {MONTHS_NB_SHORT[m]}
            </text>
          )
        })}

        {/* Activity dots */}
        {[...grouped.entries()].flatMap(([key, group]) => {
          const [m, ring] = key.split('-').map(Number) as [number, number]
          const { mid } = monthAngles(m)
          const ringR = R_OUTER - RING_GAP * ring - RING_GAP / 2
          const baseColor = ringColor(ring)
          const spread =
            group.length === 1 ? [0] : group.length === 2 ? [-7, 7] : [-10, 0, 10]
          return group.map((it, idx) => {
            const angle = mid + (spread[idx] ?? 0)
            const [x, y] = polar(CX, CY, ringR, angle)
            const s = stateStyle(it.state, baseColor)
            return (
              <g key={`dot-${m}-${ring}-${idx}`}>
                <title>{`${it.label} — ${it.law}`}</title>
                {s.haloColor ? (
                  <circle cx={x} cy={y} r={11} fill={s.haloColor} opacity={0.18} />
                ) : null}
                <circle
                  cx={x}
                  cy={y}
                  r={6.5}
                  fill={s.fill}
                  stroke={s.stroke}
                  strokeWidth={2}
                />
                {it.state === 'done' ? (
                  <path
                    d={`M ${x - 2.4} ${y + 0.2} L ${x - 0.6} ${y + 2} L ${x + 2.6} ${y - 1.8}`}
                    stroke="#fff"
                    strokeWidth={1.6}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
              </g>
            )
          })
        })}

        {/* "I dag" radial line */}
        <line x1={t0x} y1={t0y} x2={tx} y2={ty} stroke="#1a3d32" strokeWidth={1.5} />
        <circle cx={tx} cy={ty} r={4} fill="#1a3d32" />

        {/* Inner center disc */}
        <circle
          cx={CX}
          cy={CY}
          r={R_INNER - 4}
          fill="url(#aml-center-glow)"
          stroke="#e3ddcc"
          strokeWidth={1}
        />
        <text
          x={CX}
          y={CY - 14}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill="#525252"
          style={{
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          Årshjul
        </text>
        <text
          x={CX}
          y={CY + 12}
          textAnchor="middle"
          fontSize={28}
          fontWeight={600}
          fill="#171717"
          style={{ fontFamily: SERIF, letterSpacing: '-0.01em' }}
        >
          {MONTHS_NB[today.m]}
        </text>
        <text
          x={CX}
          y={CY + 32}
          textAnchor="middle"
          fontSize={11}
          fill="#737373"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {today.y}
        </text>
        <circle cx={CX} cy={CY - R_INNER + 12} r={2} fill="#1a3d32" />
      </svg>
    </div>
  )
}

function stateStyle(
  state: AmlWheelState,
  baseColor: string,
): { fill: string; stroke: string; haloColor: string | null } {
  switch (state) {
    case 'done':
      return { fill: baseColor, stroke: baseColor, haloColor: null }
    case 'now':
      return { fill: '#fff', stroke: baseColor, haloColor: baseColor }
    case 'overdue':
      return { fill: '#dc2626', stroke: '#7f1d1d', haloColor: '#dc2626' }
    case 'upcoming':
    default:
      return { fill: '#fff', stroke: baseColor, haloColor: null }
  }
}

// ── Side panels ─────────────────────────────────────────────────────────

export function AmlYearWheelMonthList({
  today = AML_TODAY,
  items = AML_WHEEL,
  legend = AML_RING_LEGEND,
  selectedMonth = null,
  onClear,
}: {
  today?: AmlToday
  items?: AmlWheelItem[]
  legend?: AmlRingLegendEntry[]
  selectedMonth?: number | null
  onClear?: () => void
}) {
  const m = selectedMonth ?? today.m
  const ringColor = (id: number) =>
    legend.find((r) => r.id === id)?.color ?? '#525252'
  const monthItems = items
    .filter((it) => it.month === m)
    .slice()
    .sort((a, b) => a.ring - b.ring)
  const isCurrent = m === today.m

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            {isCurrent ? 'Denne måneden' : 'Valgt måned'}
          </p>
          <h4
            className="mt-0.5 text-lg font-semibold text-neutral-900"
            style={{ fontFamily: SERIF }}
          >
            {MONTHS_NB[m]} {today.y}
          </h4>
        </div>
        {selectedMonth != null ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-neutral-500 hover:text-neutral-800"
          >
            Tilbakestill
          </button>
        ) : null}
      </div>
      <ul className="mt-3 space-y-1.5">
        {monthItems.length === 0 ? (
          <li className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500">
            Ingen planlagte aktiviteter denne måneden.
          </li>
        ) : (
          monthItems.map((it, i) => {
            const baseColor = ringColor(it.ring)
            const s = stateStyle(it.state, baseColor)
            const stateLabel = (
              { done: 'Fullført', now: 'Pågår', overdue: 'Overdue', upcoming: 'Planlagt' } as const
            )[it.state]
            const stateTone = (
              {
                done: 'text-green-700',
                now: 'text-[#1a3d32]',
                overdue: 'text-red-700',
                upcoming: 'text-neutral-500',
              } as const
            )[it.state]
            return (
              <li
                key={i}
                className="grid grid-cols-[14px_1fr_auto] items-start gap-2.5 border-b border-neutral-100 pb-1.5 last:border-b-0"
              >
                <span
                  className="mt-1.5 inline-flex h-2.5 w-2.5 rounded-full"
                  style={{ background: s.fill, border: `2px solid ${s.stroke}` }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm text-neutral-900">{it.label}</p>
                  <p className="text-[11px] text-neutral-500">
                    <span className="font-mono">{it.law}</span> ·{' '}
                    <span className={stateTone}>{stateLabel}</span>
                  </p>
                </div>
                <span />
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

export function AmlYearWheelLegend({
  legend = AML_RING_LEGEND,
}: {
  legend?: AmlRingLegendEntry[]
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
      {legend.map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-[11px] text-neutral-700">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
          <span className="truncate">{r.label}</span>
        </div>
      ))}
      <div className="col-span-2 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-100 pt-2 text-[11px] text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1a3d32]" /> Fullført
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#1a3d32] bg-white" />{' '}
          Pågår
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#2f7757] bg-white opacity-70" />{' '}
          Planlagt
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" /> Overdue
        </span>
      </div>
    </div>
  )
}
