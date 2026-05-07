import type { ReactNode } from 'react'
import type { ReportModule, ReportModuleColSpan } from '../../types/reportBuilder'
import { getAtPath, numberAtPath } from '../../lib/reportDatasets'

const R = 'rounded-none'

// Tailwind-safe lg-col-span classes per ReportModuleColSpan. Mobile and
// md breakpoints flow as a single column to keep tiles legible on
// narrow screens; lg is where the 12-col grid takes effect.
const COL_SPAN_CLASS: Record<ReportModuleColSpan, string> = {
  sm: 'lg:col-span-3',
  md: 'lg:col-span-6',
  lg: 'lg:col-span-9',
  full: 'lg:col-span-12',
}

// Optional control slot rendered top-right of every widget shell —
// used by the dashboard editor to surface a per-widget "..." menu.
type WidgetControlSlot = (m: ReportModule) => ReactNode

function DonutMini({ segments }: { segments: { label: string; value: number; color: string }[] }) {
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
    <div className="flex items-center gap-4">
      <div
        className="relative size-24 shrink-0 rounded-full border border-neutral-200"
        style={{ background: bg }}
      >
        <div className="absolute inset-[18%] flex items-center justify-center rounded-full bg-white text-[11px] font-bold text-neutral-800">
          {Math.round(total)}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex justify-between gap-2">
            <span className="flex items-center gap-1.5 truncate text-neutral-600">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-neutral-900">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function segmentsFromObject(o: Record<string, unknown>, colors: string[]) {
  return Object.entries(o)
    .filter(([, v]) => typeof v === 'number' && !Number.isNaN(v as number))
    .map(([label, value], i) => ({
      label,
      value: value as number,
      color: colors[i % colors.length],
    }))
}

/**
 * Layout hint for the parent grid. 'grid2' is the legacy 2-col mode
 * (now equivalent to widgets defaulting to colSpan='md'); 'grid12' is
 * the new 12-col responsive grid that honours colSpan per widget;
 * 'fluid' lets widgets size themselves with no layout shell.
 */
export type ReportModuleLayoutMode = 'grid2' | 'grid12' | 'fluid'

export function ReportModuleWidget({
  module: m,
  datasets,
  accent,
  layoutMode = 'grid12',
  emptyLabel,
  controlSlot,
}: {
  module: ReportModule
  datasets: Record<string, unknown>
  accent: string
  layoutMode?: ReportModuleLayoutMode
  /** When dataset is missing, show this instead of hiding */
  emptyLabel?: string
  /** Optional renderer for a per-widget control (e.g. "..." menu). */
  controlSlot?: WidgetControlSlot
}) {
  const colors = ['#15803d', '#ca8a04', '#2563eb', '#c2410c', '#7c3aed']
  const ds = datasets[m.datasetKey]

  // Width strategy:
  //   grid12 → honour m.colSpan (default 'md' = 6/12 cols)
  //   grid2  → legacy two-column behaviour (kpi 1-col, others wide)
  //   fluid  → no col-span class; caller is in charge
  const colSpanClass = (() => {
    if (layoutMode === 'fluid') return ''
    if (layoutMode === 'grid12') return COL_SPAN_CLASS[m.colSpan ?? 'md']
    // legacy grid2
    return m.kind === 'kpi' ? '' : 'lg:col-span-2'
  })()
  // rowBreak forces this widget to start on a new row in the 12-col grid
  // by snapping to col-start-1 (works only on lg+ where the grid is in
  // effect; on smaller breakpoints everything's a single column anyway).
  const rowBreakClass = layoutMode === 'grid12' && m.rowBreak ? 'lg:col-start-1' : ''

  const titleBlock = (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {m.title}
      </p>
      {m.subtitle ? (
        <p className="mt-0.5 truncate text-[11px] text-neutral-500">{m.subtitle}</p>
      ) : null}
    </div>
  )

  const wrap = (inner: ReactNode) => (
    <div
      className={`${R} relative h-full min-h-[120px] border border-neutral-200/90 bg-white p-5 shadow-sm ${colSpanClass} ${rowBreakClass}`}
      style={m.kind === 'kpi' ? { boxShadow: `inset 0 3px 0 0 ${accent}` } : undefined}
    >
      {controlSlot ? (
        <div className="absolute right-3 top-3 z-10">{controlSlot(m)}</div>
      ) : null}
      {inner}
    </div>
  )

  if (m.kind === 'kpi') {
    const n = numberAtPath(ds, m.valuePath)
    return wrap(
      <>
        {titleBlock}
        <p className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900">{n ?? '—'}</p>
      </>,
    )
  }
  if (m.kind === 'table') {
    const rows = Array.isArray(ds) ? (ds as Record<string, unknown>[]) : []
    const cols = m.rowKeys.length ? m.rowKeys : Object.keys(rows[0] ?? {})
    return wrap(
      <>
        {titleBlock}
        <div className="mt-3 overflow-x-auto border border-neutral-200">
          <table className="w-full min-w-[480px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                {cols.map((c) => (
                  <th key={c} className="px-3 py-2 font-semibold text-neutral-700">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((row, ri) => (
                <tr key={ri} className="border-b border-neutral-100">
                  {cols.map((c) => (
                    <td key={c} className="px-3 py-2 text-neutral-800">
                      {String(row[c] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <EmptyWidget label={emptyLabel ?? "Ingen rader."} /> : null}
      </>,
    )
  }
  if (m.kind === 'bar') {
    const obj = ds && typeof ds === 'object' && !Array.isArray(ds) ? (ds as Record<string, unknown>) : {}
    const keys = m.seriesKeys.filter((k) => k in obj)
    const nums = keys.map((k) => Number(obj[k]) || 0)
    const max = Math.max(1, ...nums)
    return wrap(
      <>
        {titleBlock}
        <div className="mt-4 space-y-2">
          {keys.map((k, i) => {
            const v = nums[i] ?? 0
            const pct = Math.round((v / max) * 100)
            return (
              <div key={k}>
                <div className="flex justify-between text-xs text-neutral-600">
                  <span>{k}</span>
                  <span className="tabular-nums font-medium">{v}</span>
                </div>
                <div className="mt-1 h-2 w-full bg-neutral-100">
                  <div
                    className="h-2 transition-all"
                    style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        {keys.length === 0 ? <EmptyWidget label={emptyLabel ?? "Ingen serier."} /> : null}
      </>,
    )
  }
  if (m.kind === 'donut') {
    const raw = m.segmentsPath ? getAtPath(ds, m.segmentsPath) : ds
    let segments: { label: string; value: number; color: string }[] = []
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      segments = segmentsFromObject(raw as Record<string, unknown>, colors)
    } else if (ds && typeof ds === 'object' && !Array.isArray(ds)) {
      segments = segmentsFromObject(ds as Record<string, unknown>, colors)
    }
    return wrap(
      <>
        {titleBlock}
        {segments.length ? (
          <div className="mt-4">
            <DonutMini segments={segments} />
          </div>
        ) : (
          <EmptyWidget label={emptyLabel ?? 'Ingen data å vise.'} />
        )}
      </>,
    )
  }
  if (m.kind === 'heatmap') {
    const rowsRaw = m.rowsPath ? getAtPath(ds, m.rowsPath) : (ds as Record<string, unknown> | null | undefined)?.rows
    const colsRaw = m.columnsPath ? getAtPath(ds, m.columnsPath) : (ds as Record<string, unknown> | null | undefined)?.columns
    const cellsRaw = m.cellsPath ? getAtPath(ds, m.cellsPath) : (ds as Record<string, unknown> | null | undefined)?.cells
    const rows = Array.isArray(rowsRaw) ? (rowsRaw as unknown[]).map(String) : []
    const columns = Array.isArray(colsRaw) ? (colsRaw as unknown[]).map(String) : []
    const cells: number[][] = Array.isArray(cellsRaw)
      ? (cellsRaw as unknown[]).map((row) =>
          Array.isArray(row) ? (row as unknown[]).map((v) => Number(v) || 0) : [],
        )
      : []
    return wrap(
      <>
        {titleBlock}
        {rows.length === 0 || columns.length === 0 ? (
          <EmptyWidget label={emptyLabel ?? 'Ingen data å vise.'} />
        ) : (
          <HeatmapMini
            rows={rows}
            columns={columns}
            cells={cells}
            accent={accent}
            valueMin={m.valueMin}
            valueMax={m.valueMax}
            valueLabel={m.valueLabel}
          />
        )}
      </>,
    )
  }
  if (m.kind === 'line') {
    const raw = m.pointsPath ? getAtPath(ds, m.pointsPath) : ds
    type Point = { x: string | number; y: number }
    const points = Array.isArray(raw)
      ? (raw as unknown[]).flatMap((p) => {
          if (!p || typeof p !== 'object') return []
          const obj = p as Record<string, unknown>
          const x = obj.x ?? obj.label
          const y = obj.y ?? obj.value
          if ((typeof x !== 'string' && typeof x !== 'number') || typeof y !== 'number') return []
          return [{ x, y } as Point]
        })
      : []
    return wrap(
      <>
        {titleBlock}
        {points.length === 0 ? (
          <EmptyWidget label={emptyLabel ?? 'Ingen datapunkter ennå.'} />
        ) : (
          <LineMini points={points} accent={accent} xLabel={m.xLabel} yLabel={m.yLabel} />
        )}
      </>,
    )
  }
  return null
}

// Soft empty-state for chart widgets: a quiet skeleton with a subtle
// label so the widget keeps its space and visual rhythm even when the
// underlying dataset is empty (zero data, filters too tight, etc.).
function EmptyWidget({ label }: { label: string }) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-neutral-200 bg-neutral-50/40 px-4 py-6 text-center">
      <div className="h-1.5 w-12 rounded-full bg-neutral-200" />
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  )
}

// Lightweight inline-SVG line chart — no charting dep, scales to its
// container width via viewBox + preserveAspectRatio.
function LineMini({
  points,
  accent,
  xLabel,
  yLabel,
}: {
  points: { x: string | number; y: number }[]
  accent: string
  xLabel?: string
  yLabel?: string
}) {
  const W = 600
  const H = 180
  const PAD = 28
  const ys = points.map((p) => p.y)
  const minY = Math.min(0, ...ys)
  const maxY = Math.max(1, ...ys)
  const range = maxY - minY || 1
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0
  const xy = points.map((p, i) => {
    const x = PAD + i * stepX
    const y = H - PAD - ((p.y - minY) / range) * (H - PAD * 2)
    return { x, y, raw: p }
  })
  const path = xy
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ')
  const area = `${path} L ${xy[xy.length - 1]?.x.toFixed(1)} ${H - PAD} L ${xy[0]?.x.toFixed(1)} ${H - PAD} Z`
  // Pick up to 6 evenly-spaced x-axis labels so dense data doesn't overlap.
  const showEvery = Math.max(1, Math.ceil(xy.length / 6))
  return (
    <div className="mt-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
        aria-label={`${yLabel ?? 'Verdi'} over ${xLabel ?? 'tid'}`}
      >
        {/* horizontal gridlines */}
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

// Inline-SVG heatmap. Cells colour-mix against `accent` by their normalised
// value (0 → near-white, 1 → solid accent). When `valueMin`/`valueMax` are
// omitted the scale spans the visible cell range.
function HeatmapMini({
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
}) {
  const flat = cells.flat().filter((v) => Number.isFinite(v))
  const lo = valueMin ?? (flat.length ? Math.min(...flat) : 0)
  const hi = valueMax ?? (flat.length ? Math.max(...flat) : 1)
  const span = hi - lo || 1

  // Truncate long labels for readability — the full label lands in the
  // <title> tooltip below.
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
                // Mix accent against white via alpha — quick & dependency-free.
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

export function ReportModulesGrid({
  modules,
  datasets,
  accent,
  layoutMode = 'grid12',
  emptyLabel,
  controlSlot,
}: {
  modules: ReportModule[]
  datasets: Record<string, unknown>
  accent: string
  layoutMode?: ReportModuleLayoutMode
  emptyLabel?: string
  /** Optional renderer for a per-widget control (e.g. "..." menu). */
  controlSlot?: WidgetControlSlot
}) {
  const containerClass = (() => {
    if (layoutMode === 'grid12') return 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12'
    if (layoutMode === 'grid2') return 'grid grid-cols-1 gap-4 lg:grid-cols-2'
    return 'flex flex-col gap-4'
  })()
  return (
    <div className={containerClass}>
      {modules.map((m) => (
        <ReportModuleWidget
          key={m.id}
          module={m}
          datasets={datasets}
          accent={accent}
          layoutMode={layoutMode}
          emptyLabel={emptyLabel}
          controlSlot={controlSlot}
        />
      ))}
      {modules.length === 0 ? (
        <p className={`text-sm text-neutral-500 ${layoutMode === 'grid12' ? 'lg:col-span-12' : layoutMode === 'grid2' ? 'lg:col-span-2' : ''}`}>
          Legg til moduler i redigeringspanelet.
        </p>
      ) : null}
    </div>
  )
}
