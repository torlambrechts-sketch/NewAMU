import { useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { ReportModule, ReportModuleColSpan, ReportModuleKind } from '../../types/reportBuilder'
import { getAtPath, numberAtPath } from '../../lib/reportDatasets'

// Polished widget surface (Klarert dashboard kit V1 — see
// `ui_kits/dashboard/Widgets.jsx` `WidgetCard`). Earlier iterations of
// this runtime used `rounded-none` for a squared, utilitarian feel; the
// design kit calls for `rounded-xl` with a subtle `0 1px 2px` shadow
// and a soft hairline border. V2 bumps the shadow + padding so widgets
// read as substantive cards rather than hairline tiles.
const R = 'rounded-xl'
const WIDGET_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'

// Tailwind-safe lg-col-span classes per ReportModuleColSpan. Mobile and
// md breakpoints flow as a single column to keep tiles legible on
// narrow screens; lg is where the 12-col grid takes effect.
const COL_SPAN_CLASS: Record<ReportModuleColSpan, string> = {
  sm: 'lg:col-span-3',
  md: 'lg:col-span-6',
  lg: 'lg:col-span-9',
  full: 'lg:col-span-12',
}

// Numeric column count per colSpan — used by the resize handle to map a
// drag delta back to a snapped colSpan value (3.2.5).
const COL_SPAN_COLS: Record<ReportModuleColSpan, number> = {
  sm: 3,
  md: 6,
  lg: 9,
  full: 12,
}
const COL_SPAN_ORDER: ReportModuleColSpan[] = ['sm', 'md', 'lg', 'full']
function snapToColSpan(cols: number): ReportModuleColSpan {
  let best: ReportModuleColSpan = 'md'
  let bestDiff = Number.POSITIVE_INFINITY
  for (const span of COL_SPAN_ORDER) {
    const diff = Math.abs(COL_SPAN_COLS[span] - cols)
    if (diff < bestDiff) {
      bestDiff = diff
      best = span
    }
  }
  return best
}

// Optional control slot rendered top-right of every widget shell —
// used by the dashboard editor to surface a per-widget "..." menu.
type WidgetControlSlot = (m: ReportModule) => ReactNode

/** Resize callback (3.2.5) — fired when a user drags the SE handle and
 *  releases on a different colSpan, or clicks it (which cycles through
 *  sm → md → lg → full → sm). */
export type OnWidgetResize = (m: ReportModule, next: ReportModuleColSpan) => void

/** Inline X-to-remove callback used by V3 edit mode. */
export type OnWidgetRemove = (m: ReportModule) => void

/** Drop-from-library callback (V3 edit mode) — fired when the user drags
 *  a `WidgetCatalogEntry` from the docked library rail and drops it on
 *  the grid. The `catalogId` is the registered entry's id; the optional
 *  `kindOverride` lets the rail communicate a per-entry kind selection. */
export type OnDropFromLibrary = (payload: {
  catalogId: string
  kindOverride?: ReportModuleKind
}) => void

/**
 * Drill-down event payload (3.2.2). Emitted when a clickable segment of
 * a chart is activated. The runtime forwards the raw segment label;
 * pages translate to a chip value (label → option id) using whatever
 * lookup is natural for the dimension.
 */
export type DrillDownEvent = {
  module: ReportModule
  /** The segment / bar key the user clicked. */
  segmentLabel: string
  /** The dimension id declared on the widget (`module.drillDimensionId`). */
  dimensionId: string
}
type OnDrillDown = (e: DrillDownEvent) => void

function DonutMini({
  segments,
  onSliceClick,
}: {
  segments: { label: string; value: number; color: string }[]
  onSliceClick?: (label: string) => void
}) {
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
                <button
                  type="button"
                  onClick={() => onSliceClick(s.label)}
                  className="-mx-1 flex w-full justify-between gap-3 rounded-sm px-1 py-0.5 hover:bg-neutral-100"
                  title={`Filtrer på ${s.label}`}
                >
                  {inner}
                </button>
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
  onDrillDown,
  onResize,
  editMode,
  onRemove,
}: {
  module: ReportModule
  datasets: Record<string, unknown>
  accent: string
  layoutMode?: ReportModuleLayoutMode
  /** When dataset is missing, show this instead of hiding */
  emptyLabel?: string
  /** Optional renderer for a per-widget control (e.g. "..." menu). */
  controlSlot?: WidgetControlSlot
  /** Optional drill-down handler; activates segment clicks on donut/bar widgets that declare `drillDimensionId`. */
  onDrillDown?: OnDrillDown
  /** Optional resize handler — when set, an SE drag handle appears (3.2.5). */
  onResize?: OnWidgetResize
  /** V3 edit mode — when true, resize handle is always visible and an X-to-remove appears top-right. */
  editMode?: boolean
  /** Inline X-to-remove handler — only shown when editMode is true. */
  onRemove?: OnWidgetRemove
}) {
  const colors = ['#15803d', '#ca8a04', '#2563eb', '#c2410c', '#7c3aed']
  const ds = datasets[m.datasetKey]

  // Resize state (3.2.5): when the user drags the SE handle, we override
  // the rendered colSpan with `pendingSpan` so the live preview snaps to
  // each grid step. On pointerup we commit via `onResize`. The drag is
  // lg-only — below lg the grid collapses to one or two cols and a
  // 12-col span doesn't apply.
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [pendingSpan, setPendingSpan] = useState<ReportModuleColSpan | null>(null)
  const effectiveSpan: ReportModuleColSpan = pendingSpan ?? m.colSpan ?? 'md'

  // Width strategy:
  //   grid12 → honour m.colSpan (default 'md' = 6/12 cols)
  //   grid2  → legacy two-column behaviour (kpi 1-col, others wide)
  //   fluid  → no col-span class; caller is in charge
  const colSpanClass = (() => {
    if (layoutMode === 'fluid') return ''
    if (layoutMode === 'grid12') return COL_SPAN_CLASS[effectiveSpan]
    // legacy grid2
    return m.kind === 'kpi' ? '' : 'lg:col-span-2'
  })()
  // rowBreak forces this widget to start on a new row in the 12-col grid
  // by snapping to col-start-1 (works only on lg+ where the grid is in
  // effect; on smaller breakpoints everything's a single column anyway).
  const rowBreakClass = layoutMode === 'grid12' && m.rowBreak ? 'lg:col-start-1' : ''

  const titleBlock = (
    <div className="min-w-0">
      <p className="truncate text-xs font-bold uppercase tracking-wider text-neutral-900">
        {m.title}
      </p>
      {m.subtitle ? (
        <p className="mt-1 truncate text-[13px] text-neutral-500">{m.subtitle}</p>
      ) : null}
    </div>
  )

  const startResize = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!onResize || layoutMode !== 'grid12') return
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
      // Below lg the 12-col grid is inactive; fall back to a click-cycle.
      const next = COL_SPAN_ORDER[(COL_SPAN_ORDER.indexOf(m.colSpan ?? 'md') + 1) % COL_SPAN_ORDER.length]!
      onResize(m, next)
      return
    }
    const handle = e.currentTarget
    const widget = wrapRef.current
    const grid = widget?.closest<HTMLElement>('[data-dashboard-grid="12"]')
    if (!widget || !grid) return
    const gridRect = grid.getBoundingClientRect()
    const widgetRect = widget.getBoundingClientRect()
    // Tailwind `gap-4` = 16px; 11 gaps between 12 cols.
    const colWidth = (gridRect.width - 11 * 16) / 12
    if (!Number.isFinite(colWidth) || colWidth <= 0) return
    const startX = e.clientX
    const startSpan = m.colSpan ?? 'md'
    const startCols = COL_SPAN_COLS[startSpan]
    let didMove = false
    let lastSpan: ReportModuleColSpan = startSpan
    const widgetLeftCol = Math.round((widgetRect.left - gridRect.left) / (colWidth + 16))

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const colsDelta = Math.round(dx / (colWidth + 16))
      const projected = startCols + colsDelta
      // Clamp so the widget never extends past the grid's right edge.
      const maxCols = Math.max(3, Math.min(12, 12 - widgetLeftCol))
      const clamped = Math.max(3, Math.min(maxCols, projected))
      const next = snapToColSpan(clamped)
      if (Math.abs(dx) > 4) didMove = true
      if (next !== lastSpan) {
        lastSpan = next
        setPendingSpan(next)
      }
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      try { handle.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      setPendingSpan(null)
      const finalSpan = lastSpan
      if (didMove) {
        if (finalSpan !== startSpan) onResize(m, finalSpan)
      } else {
        // No drag → cycle to the next size.
        const next = COL_SPAN_ORDER[(COL_SPAN_ORDER.indexOf(startSpan) + 1) % COL_SPAN_ORDER.length]!
        onResize(m, next)
      }
    }
    try { handle.setPointerCapture(e.pointerId) } catch { /* noop */ }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const wrap = (inner: ReactNode) => (
    <div
      ref={wrapRef}
      className={`${R} group relative h-full min-h-[200px] border bg-white p-6 ${editMode ? 'border-dashed border-[#1a3d32]/30 ring-1 ring-[#1a3d32]/10' : 'border-neutral-200/70'} ${colSpanClass} ${rowBreakClass}`}
      style={
        m.kind === 'kpi'
          ? { boxShadow: `inset 0 3px 0 0 ${accent}, ${WIDGET_SHADOW}` }
          : { boxShadow: WIDGET_SHADOW }
      }
    >
      {controlSlot || (editMode && onRemove) ? (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
          {controlSlot ? controlSlot(m) : null}
          {editMode && onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(m)}
              aria-label={`Fjern widgeten ${m.title}`}
              title="Fjern widget"
              className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4">
                <path d="M3 3 L13 13 M13 3 L3 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
      {inner}
      {onResize && layoutMode === 'grid12' ? (
        <button
          type="button"
          onPointerDown={startResize}
          aria-label={`Endre størrelse på ${m.title}`}
          title="Dra for å endre bredde · klikk for å bla gjennom størrelser"
          className={`absolute bottom-0 right-0 h-4 w-4 cursor-se-resize items-end justify-end p-0.5 text-neutral-300 transition-colors hover:text-neutral-700 focus:flex focus:outline-none focus:ring-1 focus:ring-neutral-400 ${editMode ? 'flex' : 'hidden focus:flex group-hover:flex lg:flex'}`}
        >
          <svg viewBox="0 0 8 8" aria-hidden className="h-3 w-3">
            <path d="M7 1 L7 7 L1 7" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 4 L4 7" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      ) : null}
    </div>
  )

  if (m.kind === 'kpi') {
    const n = numberAtPath(ds, m.valuePath)
    const cmpDs = m.comparisonDatasetKey ? datasets[m.comparisonDatasetKey] : ds
    const cmp = m.comparisonValuePath ? numberAtPath(cmpDs, m.comparisonValuePath) : null
    const sparkDs = m.sparklineDatasetKey ? datasets[m.sparklineDatasetKey] : ds
    const sparkRaw = m.sparklinePath ? getAtPath(sparkDs, m.sparklinePath) : null
    const sparkPoints = Array.isArray(sparkRaw)
      ? (sparkRaw as unknown[]).flatMap((p) => {
          if (!p || typeof p !== 'object') return []
          const obj = p as Record<string, unknown>
          const y = obj.y ?? obj.value
          if (typeof y !== 'number') return []
          return [y]
        })
      : []
    return wrap(
      <>
        {titleBlock}
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-4xl font-semibold tabular-nums text-neutral-900">{n ?? '—'}</p>
          {cmp != null && n != null ? (
            <KpiDeltaChip current={n} previous={cmp} goal={m.comparisonGoal ?? 'increase'} />
          ) : null}
        </div>
        {m.comparisonLabel && cmp != null ? (
          <p className="mt-0.5 text-[11px] text-neutral-500">{m.comparisonLabel}</p>
        ) : null}
        {sparkPoints.length > 1 ? (
          <div className="mt-2">
            <Sparkline values={sparkPoints} accent={accent} />
          </div>
        ) : null}
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
    const drillable = !!(m.drillDimensionId && onDrillDown)
    return wrap(
      <>
        {titleBlock}
        <div className="mt-5 space-y-3.5">
          {keys.map((k, i) => {
            const v = nums[i] ?? 0
            const pct = Math.round((v / max) * 100)
            const inner = (
              <div className="flex items-center gap-4">
                <span className="w-32 shrink-0 truncate text-sm text-neutral-700">{k}</span>
                <span className="w-12 shrink-0 text-lg font-semibold tabular-nums text-neutral-900">
                  {v}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }}
                  />
                </div>
              </div>
            )
            if (drillable) {
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    onDrillDown?.({ module: m, segmentLabel: k, dimensionId: m.drillDimensionId! })
                  }
                  title={`Filtrer på ${k}`}
                  className="block w-full rounded-sm px-1 py-0.5 text-left hover:bg-neutral-50"
                >
                  {inner}
                </button>
              )
            }
            return <div key={k}>{inner}</div>
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
    const handleSlice =
      m.drillDimensionId && onDrillDown
        ? (label: string) =>
            onDrillDown({ module: m, segmentLabel: label, dimensionId: m.drillDimensionId! })
        : undefined
    return wrap(
      <>
        {titleBlock}
        {segments.length ? (
          <div className="mt-4">
            <DonutMini segments={segments} onSliceClick={handleSlice} />
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
    type Point = { x: string | number; y: number }
    const parsePoints = (raw: unknown): Point[] =>
      Array.isArray(raw)
        ? (raw as unknown[]).flatMap((p) => {
            if (!p || typeof p !== 'object') return []
            const obj = p as Record<string, unknown>
            const x = obj.x ?? obj.label
            const y = obj.y ?? obj.value
            if ((typeof x !== 'string' && typeof x !== 'number') || typeof y !== 'number') return []
            return [{ x, y } as Point]
          })
        : []
    const points = parsePoints(m.pointsPath ? getAtPath(ds, m.pointsPath) : ds)
    const cmpDs = m.comparisonDatasetKey ? datasets[m.comparisonDatasetKey] : ds
    const cmpPoints = m.comparisonPointsPath
      ? parsePoints(getAtPath(cmpDs, m.comparisonPointsPath))
      : []
    return wrap(
      <>
        {titleBlock}
        {points.length === 0 ? (
          <EmptyWidget label={emptyLabel ?? 'Ingen datapunkter ennå.'} />
        ) : (
          <LineMini
            points={points}
            comparisonPoints={cmpPoints.length > 1 ? cmpPoints : undefined}
            primaryLabel={m.primaryLabel ?? m.title}
            comparisonLabel={m.comparisonLabel}
            accent={accent}
            xLabel={m.xLabel}
            yLabel={m.yLabel}
          />
        )}
      </>,
    )
  }
  if (m.kind === 'scorecard') {
    const raw = m.groupsPath ? getAtPath(ds, m.groupsPath) : ds
    type ScorecardRow = {
      id?: string
      label?: string
      title?: string
      applies?: string
      obligation?: 'mandatory' | 'recommended' | 'conditional'
      status?: 'covered' | 'partial' | 'only_avvik' | 'uncovered'
    }
    type ScorecardGroup = {
      category?: string
      total?: number
      covered?: number
      partial?: number
      needsAttention?: number
      rows?: ScorecardRow[]
    }
    const groups: ScorecardGroup[] = Array.isArray(raw) ? (raw as ScorecardGroup[]) : []
    const drillable = !!(m.drillDimensionId && onDrillDown)
    return wrap(
      <>
        {titleBlock}
        {groups.length === 0 ? (
          <EmptyWidget label={emptyLabel ?? 'Ingen krav matcher filteret.'} />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((g, idx) => {
              const total = g.total ?? g.rows?.length ?? 0
              const covered = g.covered ?? 0
              const partial = g.partial ?? 0
              const needs = g.needsAttention ?? Math.max(0, total - covered - partial)
              const pct = total === 0 ? 0 : Math.round((covered / total) * 100)
              return (
                <div
                  key={g.category ?? `g-${idx}`}
                  className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white"
                >
                  <div className="border-b border-neutral-100 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <h4
                        className="text-sm font-semibold text-neutral-900"
                        style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                      >
                        {g.category ?? 'Ukategorisert'}
                      </h4>
                      <p
                        className="shrink-0 text-lg font-bold tabular-nums"
                        style={{ color: accent }}
                      >
                        {pct}%
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: accent }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
                      <span>
                        <span className="font-semibold text-emerald-700">{covered}</span> dekket
                      </span>
                      {partial > 0 ? (
                        <span>
                          <span className="font-semibold text-amber-700">{partial}</span> mangler bevis
                        </span>
                      ) : null}
                      {needs > 0 ? (
                        <span>
                          <span className="font-semibold text-red-700">{needs}</span> udekket
                        </span>
                      ) : null}
                      <span className="text-neutral-400">av {total}</span>
                    </div>
                  </div>
                  <ul
                    className="divide-y divide-neutral-100/80"
                    style={{ backgroundColor: 'rgba(245, 230, 211, 0.50)' }}
                  >
                    {(g.rows ?? []).map((r, ridx) => {
                      const statusColor =
                        r.status === 'covered'
                          ? 'text-emerald-600'
                          : r.status === 'partial'
                            ? 'text-amber-500'
                            : r.status === 'only_avvik'
                              ? 'text-amber-600'
                              : 'text-red-500'
                      const statusGlyph =
                        r.status === 'covered'
                          ? '✓'
                          : r.status === 'partial'
                            ? '◷'
                            : r.status === 'only_avvik'
                              ? '!'
                              : '✕'
                      const obligationCls =
                        r.obligation === 'mandatory'
                          ? 'bg-red-50 text-red-900 ring-red-200'
                          : r.obligation === 'recommended'
                            ? 'bg-amber-50 text-amber-900 ring-amber-200'
                            : 'bg-neutral-50 text-neutral-700 ring-neutral-200'
                      const obligationText =
                        r.obligation === 'mandatory'
                          ? 'Pliktig'
                          : r.obligation === 'recommended'
                            ? 'Anbefalt'
                            : r.obligation === 'conditional'
                              ? 'Betinget'
                              : null
                      const rowKey = r.id ?? r.label ?? `r-${ridx}`
                      const inner = (
                        <>
                          <span className={`shrink-0 text-base font-bold ${statusColor}`} aria-hidden>
                            {statusGlyph}
                          </span>
                          <span
                            className="w-28 shrink-0 truncate text-[13px] font-semibold text-neutral-900"
                            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                          >
                            {r.label ?? ''}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
                            {r.title ?? ''}
                          </span>
                          {obligationText ? (
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${obligationCls}`}
                            >
                              {obligationText}
                            </span>
                          ) : null}
                        </>
                      )
                      return (
                        <li key={rowKey}>
                          {drillable && r.id ? (
                            <button
                              type="button"
                              onClick={() =>
                                onDrillDown?.({
                                  module: m,
                                  segmentLabel: r.id!,
                                  dimensionId: m.drillDimensionId!,
                                })
                              }
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/60"
                            >
                              {inner}
                            </button>
                          ) : (
                            <div className="flex w-full items-center gap-3 px-4 py-2.5">{inner}</div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </>,
    )
  }
  if (m.kind === 'bowtie') {
    // Bowtie — risiko-trekant per krav. Forbruker samme dataset-form som
    // scorecard (groups med rows). Rader kan i tillegg inneholde:
    //   - byKind: Record<kind, number> per akse (course / document / ...)
    //   - proof: { freshInstances, staleInstances, templatesOnly }
    // for fargekoding av preventive barrierer. Når disse felter mangler
    // faller vi tilbake til binær «har / mangler».
    type BowtieRow = {
      id?: string
      label?: string
      title?: string
      applies?: string
      obligation?: 'mandatory' | 'recommended' | 'conditional'
      status?: 'covered' | 'partial' | 'only_avvik' | 'uncovered'
      byKind?: Record<string, number>
      proof?: { freshInstances?: number; staleInstances?: number; templatesOnly?: number }
    }
    type BowtieGroup = {
      category?: string
      total?: number
      covered?: number
      partial?: number
      needsAttention?: number
      rows?: BowtieRow[]
    }
    const raw = m.groupsPath ? getAtPath(ds, m.groupsPath) : ds
    const groups: BowtieGroup[] = Array.isArray(raw) ? (raw as BowtieGroup[]) : []
    const drillable = !!(m.drillDimensionId && onDrillDown)

    type AxisDef = { id: string; label: string; kinds: string[] }
    const PREVENTIVE_AXES: AxisDef[] = [
      { id: 'course', label: 'Kurs', kinds: ['course_system', 'course_org'] },
      { id: 'document', label: 'Dokument', kinds: ['document', 'document_template'] },
      { id: 'checklist', label: 'Sjekkliste', kinds: ['checklist_template', 'checklist_item'] },
      { id: 'survey', label: 'Undersøkelse', kinds: ['survey'] },
      { id: 'meeting', label: 'Møte', kinds: ['meeting_template'] },
    ]
    const THREATS = ['Manglende kunnskap', 'Manglende rutine', 'Manglende kontroll']

    const axisCount = (r: BowtieRow, axis: AxisDef) => {
      if (!r.byKind) return 0
      return axis.kinds.reduce((s, k) => s + (r.byKind?.[k] ?? 0), 0)
    }
    const axisCls = (r: BowtieRow, axis: AxisDef) => {
      const n = axisCount(r, axis)
      if (n === 0) return 'border-dashed border-red-300 bg-red-50/50 text-red-700'
      // Fresh proof er per-krav (ikke per-akse) — bruk det som signal:
      // hvis kravet samlet sett har fersk dekning, fargekod aksene grønt.
      if ((r.proof?.freshInstances ?? 0) > 0)
        return 'border-emerald-300 bg-emerald-50 text-emerald-900'
      if (r.status === 'partial' || (r.proof?.staleInstances ?? 0) > 0)
        return 'border-amber-300 bg-amber-50 text-amber-900'
      return 'border-sky-200 bg-sky-50 text-sky-900'
    }
    const taskCount = (r: BowtieRow) => r.byKind?.task ?? 0
    const consequencesFor = (
      o: BowtieRow['obligation'],
    ): { label: string; sub: string; tone: 'severe' | 'medium' | 'low' }[] => {
      if (o === 'mandatory') {
        return [
          { label: 'Pålegg', sub: 'AML § 18-6', tone: 'medium' },
          { label: 'Overtredelsesgebyr', sub: 'AML § 18-10 (15 G)', tone: 'severe' },
          { label: 'Straffeansvar', sub: 'AML § 19-1', tone: 'severe' },
        ]
      }
      if (o === 'conditional') {
        return [
          { label: 'Pålegg ved trigger', sub: 'AML § 18-6', tone: 'medium' },
          { label: 'Tvangsmulkt', sub: 'AML § 18-7', tone: 'medium' },
        ]
      }
      return [{ label: 'Tilsynsmerknad', sub: 'Anbefaling', tone: 'low' }]
    }
    const consequenceCls = (tone: 'severe' | 'medium' | 'low') =>
      tone === 'severe'
        ? 'bg-red-50 text-red-900 ring-red-200'
        : tone === 'medium'
          ? 'bg-amber-50 text-amber-900 ring-amber-200'
          : 'bg-neutral-50 text-neutral-700 ring-neutral-200'

    return wrap(
      <>
        {titleBlock}
        {groups.length === 0 ? (
          <EmptyWidget label={emptyLabel ?? 'Ingen krav matcher filteret.'} />
        ) : (
          <div className="mt-4 space-y-6">
            <p className="text-[11px] text-neutral-500">
              Venstre side: preventive barrierer (kurs · dokument · sjekkliste ·
              undersøkelse · møte). Sentralt: brudd på §. Høyre side: mitigerende
              barrierer (avvik · ROS) og konsekvenser etter AML kap. 18–19.
            </p>
            {groups.map((g, idx) => {
              const total = g.total ?? g.rows?.length ?? 0
              const covered = g.covered ?? 0
              const pct = total === 0 ? 0 : Math.round((covered / total) * 100)
              return (
                <section key={g.category ?? `g-${idx}`} className="space-y-2">
                  <header className="flex items-baseline justify-between gap-3 border-b border-neutral-200 pb-1.5">
                    <h4
                      className="text-sm font-semibold text-neutral-900"
                      style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                    >
                      {g.category ?? 'Ukategorisert'}
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      <span className="font-bold tabular-nums" style={{ color: accent }}>
                        {pct}%
                      </span>{' '}
                      · {covered} av {total} dekket
                    </p>
                  </header>
                  <ul className="space-y-2">
                    {(g.rows ?? []).map((r, ridx) => {
                      const rowKey = r.id ?? r.label ?? `r-${ridx}`
                      const statusGlyph =
                        r.status === 'covered'
                          ? '✓'
                          : r.status === 'partial'
                            ? '◷'
                            : r.status === 'only_avvik'
                              ? '!'
                              : '✕'
                      const statusColor =
                        r.status === 'covered'
                          ? 'text-emerald-600'
                          : r.status === 'partial'
                            ? 'text-amber-500'
                            : r.status === 'only_avvik'
                              ? 'text-amber-600'
                              : 'text-red-500'
                      const obligationCls =
                        r.obligation === 'mandatory'
                          ? 'bg-red-50 text-red-900 ring-red-200'
                          : r.obligation === 'recommended'
                            ? 'bg-amber-50 text-amber-900 ring-amber-200'
                            : 'bg-neutral-50 text-neutral-700 ring-neutral-200'
                      const obligationText =
                        r.obligation === 'mandatory'
                          ? 'Pliktig'
                          : r.obligation === 'recommended'
                            ? 'Anbefalt'
                            : r.obligation === 'conditional'
                              ? 'Betinget'
                              : null
                      const tasks = taskCount(r)
                      const cons = consequencesFor(r.obligation)
                      const titleEl = (
                        <div className="flex w-full items-center gap-3">
                          <span className={`shrink-0 text-base font-bold ${statusColor}`} aria-hidden>
                            {statusGlyph}
                          </span>
                          <span
                            className="shrink-0 rounded-md bg-neutral-50 px-2 py-1 text-[12px] font-semibold text-neutral-900 ring-1 ring-inset ring-neutral-200"
                            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                          >
                            {r.label ?? ''}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">
                            {r.title ?? ''}
                          </span>
                          {obligationText ? (
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${obligationCls}`}
                            >
                              {obligationText}
                            </span>
                          ) : null}
                        </div>
                      )
                      return (
                        <li
                          key={rowKey}
                          className="rounded-lg border border-neutral-200/80 bg-white p-3"
                        >
                          {drillable && r.id ? (
                            <button
                              type="button"
                              onClick={() =>
                                onDrillDown?.({
                                  module: m,
                                  segmentLabel: r.id!,
                                  dimensionId: m.drillDimensionId!,
                                })
                              }
                              className="mb-2 w-full text-left transition hover:opacity-80"
                            >
                              {titleEl}
                            </button>
                          ) : (
                            <div className="mb-2">{titleEl}</div>
                          )}
                          <div className="grid gap-2 lg:grid-cols-[110px_1fr_60px_1fr_140px] lg:items-center">
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                                Trusler
                              </p>
                              {THREATS.map((t) => (
                                <div
                                  key={t}
                                  className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-700"
                                >
                                  {t}
                                </div>
                              ))}
                            </div>
                            <div>
                              <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                                Preventive barrierer
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {PREVENTIVE_AXES.map((axis) => {
                                  const n = axisCount(r, axis)
                                  return (
                                    <span
                                      key={axis.id}
                                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${axisCls(r, axis)}`}
                                      title={`${axis.label}: ${n} ressurs${n === 1 ? '' : 'er'}`}
                                    >
                                      {axis.label}
                                      <span className="tabular-nums">{n > 0 ? n : '—'}</span>
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                            <div className="flex items-center justify-center">
                              <div
                                className="flex size-14 shrink-0 flex-col items-center justify-center rounded-full text-[9px] font-bold uppercase tracking-wide text-white"
                                style={{ backgroundColor: accent }}
                                aria-hidden
                              >
                                Topp­hendelse
                              </div>
                            </div>
                            <div>
                              <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                                Mitigerende barrierer
                              </p>
                              <div className="flex flex-wrap gap-1">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${tasks > 0 ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-dashed border-neutral-300 bg-neutral-50/50 text-neutral-500'}`}
                                  title={`Avvik tagget med ${r.label ?? ''}`}
                                >
                                  Avvik
                                  <span className="tabular-nums">{tasks > 0 ? tasks : '—'}</span>
                                </span>
                                <span
                                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-300 bg-neutral-50/50 px-1.5 py-0.5 text-[10px] text-neutral-500"
                                  title="ROS-analyser tagges på domene-nivå (eks. AML)."
                                >
                                  ROS
                                  <span>domene</span>
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                                {r.obligation === 'mandatory'
                                  ? 'Konsekvens ved brudd'
                                  : 'Mulig konsekvens'}
                              </p>
                              {cons.map((c) => (
                                <div
                                  key={c.label}
                                  className={`rounded border px-1.5 py-0.5 text-[10px] ring-1 ring-inset ${consequenceCls(c.tone)}`}
                                >
                                  <div className="font-semibold">{c.label}</div>
                                  <div className="text-[9px] opacity-80">{c.sub}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
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
// container width via viewBox + preserveAspectRatio. When
// `comparisonPoints` are passed, both series share the same y-scale and
// are drawn against a shared x-axis indexed by the *primary* series — the
// comparison series is plotted by index so the visual delta reads
// directly even when x labels (e.g. months) differ between periods.
function LineMini({
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
}) {
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
  // Comparison series is truncated/padded against the primary's length so
  // both share the same x positions even if the underlying ranges differ.
  const cmpXy = comparisonPoints
    ? project(comparisonPoints.slice(0, points.length))
    : []
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
  const path = toPath(xy)
  const cmpPath = cmpXy.length ? toPath(cmpXy) : ''
  const area = `${path} L ${xy[xy.length - 1]?.x.toFixed(1)} ${H - PAD} L ${xy[0]?.x.toFixed(1)} ${H - PAD} Z`
  // Pick up to 6 evenly-spaced x-axis labels so dense data doesn't overlap.
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

// Tiny per-KPI delta chip. Direction is computed from current vs previous;
// colour is driven by `goal` so "fewer is better" KPIs (e.g. critical
// findings) flip the green/red mapping.
function KpiDeltaChip({
  current,
  previous,
  goal,
}: {
  current: number
  previous: number
  goal: 'increase' | 'decrease'
}) {
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

// Sub-pixel sparkline — auto-scales over the values, no axis chrome.
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
  onDrillDown,
  onResize,
  editMode,
  onRemove,
  onDropFromLibrary,
}: {
  modules: ReportModule[]
  datasets: Record<string, unknown>
  accent: string
  layoutMode?: ReportModuleLayoutMode
  emptyLabel?: string
  /** Optional renderer for a per-widget control (e.g. "..." menu). */
  controlSlot?: WidgetControlSlot
  /** Optional drill-down handler — propagated to every widget. */
  onDrillDown?: OnDrillDown
  /** Optional resize handler (3.2.5) — propagated to every widget. */
  onResize?: OnWidgetResize
  /** V3 edit mode — propagated to every widget so chrome is always-on. */
  editMode?: boolean
  /** Inline X-to-remove handler — propagated to every widget. */
  onRemove?: OnWidgetRemove
  /** Drop-from-library handler — when set, the grid becomes a drop
   *  target for items dragged out of `DashboardWidgetLibraryRail`. */
  onDropFromLibrary?: OnDropFromLibrary
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const containerClass = (() => {
    if (layoutMode === 'grid12') return 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12'
    if (layoutMode === 'grid2') return 'grid grid-cols-1 gap-4 lg:grid-cols-2'
    return 'flex flex-col gap-4'
  })()
  // The data-attribute lets a child widget locate the 12-col grid at
  // pointerdown time without prop-drilling a ref.
  const dataGrid = layoutMode === 'grid12' ? '12' : undefined

  const dropEnabled = !!(editMode && onDropFromLibrary)
  const parsePayload = (e: ReactDragEvent): { catalogId: string; kindOverride?: ReportModuleKind } | null => {
    const raw =
      e.dataTransfer.getData('application/x-klarert-catalog-id') ||
      (e.dataTransfer.getData('text/plain') || '').replace(/^klarert-widget:/, '')
    if (!raw) return null
    const [catalogId, kind] = raw.split('::')
    if (!catalogId) return null
    return { catalogId, kindOverride: kind ? (kind as ReportModuleKind) : undefined }
  }

  return (
    <div
      className={`${containerClass} ${dropEnabled && isDragOver ? 'rounded-xl ring-2 ring-[#1a3d32]/40 ring-offset-4 ring-offset-[#f7f6f2] transition-shadow' : ''}`}
      data-dashboard-grid={dataGrid}
      onDragOver={
        dropEnabled
          ? (e) => {
              if (!e.dataTransfer.types.includes('application/x-klarert-catalog-id')) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
              if (!isDragOver) setIsDragOver(true)
            }
          : undefined
      }
      onDragLeave={
        dropEnabled
          ? (e) => {
              // Only clear when actually leaving the grid (not crossing
              // between children). Compare relatedTarget to the current
              // target's bounding rect.
              if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                setIsDragOver(false)
              }
            }
          : undefined
      }
      onDrop={
        dropEnabled
          ? (e) => {
              e.preventDefault()
              setIsDragOver(false)
              const payload = parsePayload(e)
              if (payload) onDropFromLibrary?.(payload)
            }
          : undefined
      }
    >
      {modules.map((m) => (
        <ReportModuleWidget
          key={m.id}
          module={m}
          datasets={datasets}
          accent={accent}
          layoutMode={layoutMode}
          emptyLabel={emptyLabel}
          controlSlot={controlSlot}
          onDrillDown={onDrillDown}
          onResize={onResize}
          editMode={editMode}
          onRemove={onRemove}
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
