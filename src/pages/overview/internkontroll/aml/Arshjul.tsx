// Årshjul — circular annual compliance wheel.
//
// 12 month wedges × 6 concentric category rings. Activities are dots
// placed at (month, ring). State drives styling: done (filled), now
// (white core w/ ring), upcoming (soft outline), overdue (red w/ halo).
//
// Ported from klarert-design-system/ui_kits/aml-compliance/Arshjul.jsx
// with state typing + memoised geometry.

import { useMemo } from 'react'
import {
  AML_RING_LEGEND,
  AML_WHEEL,
  MONTHS_NB,
  MONTHS_NB_SHORT,
  type ArshjulItem,
  type ArshjulItemState,
} from './amlModuleCatalog'

const SIZE = 720
const CX = SIZE / 2
const CY = SIZE / 2
const R_OUTER = 320
const R_INNER = 96
const RING_COUNT = 6
const RING_GAP = (R_OUTER - R_INNER) / RING_COUNT

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  return [cx + r * Math.cos(toRad(deg)), cy + r * Math.sin(toRad(deg))]
}

function arcPath(
  cx: number, cy: number, rOuter: number, rInner: number,
  startDeg: number, endDeg: number,
): string {
  const [x1, y1] = polar(cx, cy, rOuter, startDeg)
  const [x2, y2] = polar(cx, cy, rOuter, endDeg)
  const [x3, y3] = polar(cx, cy, rInner, endDeg)
  const [x4, y4] = polar(cx, cy, rInner, startDeg)
  const large = endDeg - startDeg <= 180 ? 0 : 1
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`
}

function ringColor(id: number): string {
  return AML_RING_LEGEND.find((r) => r.id === id)?.color ?? '#525252'
}

function stateStyle(state: ArshjulItemState, baseColor: string) {
  switch (state) {
    case 'done':
      return { fill: baseColor, stroke: baseColor, halo: false, haloColor: baseColor }
    case 'now':
      return { fill: '#fff', stroke: baseColor, halo: true, haloColor: baseColor }
    case 'overdue':
      return { fill: '#dc2626', stroke: '#7f1d1d', halo: true, haloColor: '#dc2626' }
    case 'upcoming':
    default:
      return { fill: '#fff', stroke: baseColor, halo: false, haloColor: baseColor }
  }
}

function deriveState(item: ArshjulItem, today: Date): ArshjulItemState {
  if (item.state) return item.state
  const m = today.getMonth()
  if (item.month < m) return 'done'
  if (item.month === m) return 'now'
  return 'upcoming'
}

export type ArshjulProps = {
  /** 0..11 month selected by the user; null = no selection (shows current month list). */
  selectedMonth: number | null
  onSelectMonth: (m: number | null) => void
  items?: ArshjulItem[]
  today?: Date
}

export function Arshjul({
  selectedMonth,
  onSelectMonth,
  items = AML_WHEEL,
  today = new Date(),
}: ArshjulProps) {
  const todayMonth = today.getMonth()
  const todayAngle = useMemo(
    () => -90 + todayMonth * 30 + (today.getDate() / 30) * 30,
    [todayMonth, today],
  )
  const [tx, ty] = polar(CX, CY, R_OUTER + 6, todayAngle)
  const [t0x, t0y] = polar(CX, CY, R_INNER, todayAngle)

  // Group items by (month, ring) so colliding activities stack.
  const grouped = useMemo(() => {
    const g: Record<string, ArshjulItem[]> = {}
    for (const it of items) {
      const k = `${it.month}-${it.ring}`
      ;(g[k] ??= []).push(it)
    }
    return g
  }, [items])

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Årshjul — AML compliance årssyklus"
      >
        <defs>
          <radialGradient id="arshjul-center-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbf9f3" />
            <stop offset="100%" stopColor="#F1ECDF" />
          </radialGradient>
        </defs>

        {/* Month wedges */}
        {Array.from({ length: 12 }).map((_, m) => {
          const start = -90 + m * 30
          const end = start + 30
          const isCurrent = m === todayMonth
          const isSelected = selectedMonth === m
          const isPast = m < todayMonth
          const fill = isCurrent ? '#e7efe9' : isPast ? '#fbf9f3' : '#ffffff'
          const strokeColor = isSelected ? '#1a3d32' : '#e3ddcc'
          const strokeWidth = isSelected ? 2 : 1
          return (
            <g
              key={`wedge-${m}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectMonth(m === selectedMonth ? null : m)}
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
          const start = -90 + m * 30
          const mid = start + 15
          const [lx, ly] = polar(CX, CY, R_OUTER + 26, mid)
          const isCurrent = m === todayMonth
          const isPast = m < todayMonth
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
              style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              {MONTHS_NB_SHORT[m]}
            </text>
          )
        })}

        {/* Activity dots */}
        {Object.entries(grouped).flatMap(([key, group]) => {
          const [m, ring] = key.split('-').map(Number)
          if (typeof m !== 'number' || typeof ring !== 'number') return []
          const mid = -90 + m * 30 + 15
          const ringR = R_OUTER - RING_GAP * ring - RING_GAP / 2
          const baseColor = ringColor(ring)
          const spread =
            group.length === 1 ? [0] :
            group.length === 2 ? [-7, 7] :
            [-10, 0, 10]
          return group.map((it, idx) => {
            const offset = spread[idx] ?? 0
            const angle = mid + offset
            const [x, y] = polar(CX, CY, ringR, angle)
            const s = stateStyle(deriveState(it, today), baseColor)
            return (
              <g key={`dot-${m}-${ring}-${idx}`}>
                <title>{`${it.label} — ${it.law}`}</title>
                {s.halo ? (
                  <circle cx={x} cy={y} r={11} fill={s.haloColor} opacity={0.18} />
                ) : null}
                <circle cx={x} cy={y} r={6.5} fill={s.fill} stroke={s.stroke} strokeWidth={2} />
                {deriveState(it, today) === 'done' ? (
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

        {/* I dag radial line */}
        <line x1={t0x} y1={t0y} x2={tx} y2={ty} stroke="#1a3d32" strokeWidth={1.5} />
        <circle cx={tx} cy={ty} r={4} fill="#1a3d32" />

        {/* Inner center disc */}
        <circle cx={CX} cy={CY} r={R_INNER - 4} fill="url(#arshjul-center-glow)" stroke="#e3ddcc" strokeWidth={1} />
        <text
          x={CX}
          y={CY - 14}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill="#525252"
          style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '0.14em', textTransform: 'uppercase' }}
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
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif", letterSpacing: '-0.01em' }}
        >
          {MONTHS_NB[todayMonth]}
        </text>
        <text
          x={CX}
          y={CY + 32}
          textAnchor="middle"
          fontSize={11}
          fill="#737373"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {today.getFullYear()}
        </text>
      </svg>
    </div>
  )
}

export function ArshjulMonthList({
  selectedMonth,
  onClear,
  items = AML_WHEEL,
  today = new Date(),
}: {
  selectedMonth: number | null
  onClear: () => void
  items?: ArshjulItem[]
  today?: Date
}) {
  const m = selectedMonth ?? today.getMonth()
  const monthItems = useMemo(
    () => items.filter((it) => it.month === m).sort((a, b) => a.ring - b.ring),
    [items, m],
  )
  const isCurrent = m === today.getMonth()

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            {isCurrent ? 'Denne måneden' : 'Valgt måned'}
          </p>
          <h4
            className="mt-0.5 text-lg font-semibold text-neutral-900"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {MONTHS_NB[m]} {today.getFullYear()}
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
            const s = stateStyle(deriveState(it, today), baseColor)
            const stateLabel = {
              done: 'Fullført',
              now: 'Pågår',
              overdue: 'Forfalt',
              upcoming: 'Planlagt',
            }[deriveState(it, today)]
            const stateTone = {
              done: 'text-green-700',
              now: 'text-[#1a3d32]',
              overdue: 'text-red-700',
              upcoming: 'text-neutral-500',
            }[deriveState(it, today)]
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
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

export function ArshjulLegend() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
      {AML_RING_LEGEND.map((r) => (
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
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#1a3d32] bg-white" /> Pågår
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#2f7757] bg-white opacity-70" /> Planlagt
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" /> Forfalt
        </span>
      </div>
    </div>
  )
}
