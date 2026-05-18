import { useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { ReportModule, ReportModuleColSpan, ReportModuleKind } from '../../types/reportBuilder'
import { Button } from '../ui/Button'
import { getWidgetKind } from '../../lib/studio/WidgetKindRegistry'

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

// All per-kind rendering moved to src/components/reports/widgetRenderers.tsx
// (Task 0.3 Stage B). Helpers (DonutMini, EmptyWidget, LineMini, etc.)
// live in src/components/reports/widgetParts.tsx. This file now owns only
// the chrome (sizing, edit-mode affordances, resize handle, drop target)
// + the registry lookup that delegates to the per-kind renderer.

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(m)}
              aria-label={`Fjern widgeten ${m.title}`}
              title="Fjern widget"
              className="h-6 w-6 rounded-md p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4">
                <path d="M3 3 L13 13 M13 3 L3 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Button>
          ) : null}
        </div>
      ) : null}
      {inner}
      {onResize && layoutMode === 'grid12' ? (
        <Button
          variant="ghost"
          size="icon"
          onPointerDown={startResize}
          aria-label={`Endre størrelse på ${m.title}`}
          title="Dra for å endre bredde · klikk for å bla gjennom størrelser"
          className={`absolute bottom-0 right-0 h-4 w-4 cursor-se-resize items-end justify-end p-0.5 text-neutral-300 transition-colors hover:text-neutral-700 focus:flex focus:outline-none focus:ring-1 focus:ring-neutral-400 ${editMode ? 'flex' : 'hidden focus:flex group-hover:flex lg:flex'}`}
        >
          <svg viewBox="0 0 8 8" aria-hidden className="h-3 w-3">
            <path d="M7 1 L7 7 L1 7" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 4 L4 7" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </Button>
      ) : null}
    </div>
  )

  // ────────────────────────────────────────────────────────────────────
  // Render — registry-driven lookup (was: 9-branch if-chain pre-Task 0.3
  // Stage B). The kind metadata + renderer pair lives in
  // src/lib/studio/WidgetKindRegistry.ts → ../components/reports/widgetRenderers.tsx.
  // Adding a new kind means adding an entry in those two files, not editing
  // this component.
  // ────────────────────────────────────────────────────────────────────

  const entry = getWidgetKind(m.kind)
  const result = entry?.renderer(m, {
    ds,
    datasets,
    accent,
    colors,
    onDrillDown,
    emptyLabel,
    titleBlock,
  })
  if (!result || result.node == null) return null
  if (result.skipWrap) {
    // Renderer emitted its own card chrome (benchmark). Preserve the
    // colSpan + rowBreak wrapping so grid placement still works.
    return (
      <div ref={wrapRef} className={`${colSpanClass} ${rowBreakClass}`}>
        {result.node}
      </div>
    )
  }
  return wrap(result.node)
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
