// Studio Builder — extracted widget renderers (Task 0.3 Stage B).
//
// Each function here is the renderer for one ReportModuleKind. Together
// they replace the 9-branch if-chain that used to live in
// ReportModuleWidget.tsx (lines 277–961 pre-refactor).
//
// Each renderer takes:
//   - m: the typed module config (narrowed by the kind discriminant)
//   - ctx: WidgetRenderContext — everything that used to be closure-captured
//     from the ReportModuleWidget component scope (ds, datasets, accent,
//     colors, onDrillDown, emptyLabel, titleBlock)
//
// Returns WidgetRendererResult:
//   - { node }            — caller wraps via the chrome wrap() helper
//   - { node, skipWrap }  — caller emits the node as-is (benchmark uses this
//                           because BenchmarkWidget renders its own card)
//
// ⚠️ VISUAL DIFF REQUIRED before merging the consumer refactor in
// ReportModuleWidget.tsx. The JSX has been moved verbatim — same
// children, same className strings, same styles — but a careful manual
// screenshot diff against a seeded multi-widget dashboard is the spec's
// acceptance gate.
//
// Spec: specs/studio-builder.md §5 Phase 0 Task 0.3 (Stage B).

import type { ReactNode } from 'react'
import type {
  ReportModule,
  ReportModuleKpi,
  ReportModuleTable,
  ReportModuleBar,
  ReportModuleDonut,
  ReportModuleHeatmap,
  ReportModuleLine,
  ReportModuleScorecard,
  ReportModuleBowtie,
  ReportModuleBenchmark,
} from '../../types/reportBuilder'
import { getAtPath, numberAtPath } from '../../lib/reportDatasets'
import { BenchmarkWidget, type BenchmarkPoint } from '../dashboards/BenchmarkWidget'
import { Button } from '../ui/Button'
import {
  DonutMini,
  EmptyWidget,
  HeatmapMini,
  KpiDeltaChip,
  LineMini,
  Sparkline,
} from './widgetParts'
import { segmentsFromObject } from './widgetUtils'
// DrillDownEvent is canonically declared in ReportModuleWidget.tsx so
// existing consumers (LearningAnalysePage, DocumentsAnalysePage, etc.)
// can keep importing it from there. We pull it via `import type` so
// there's no runtime cycle even though WidgetKindRegistry → this file →
// ReportModuleWidget would otherwise form one. `import type` statements
// are erased at compile time and contribute zero to the runtime module
// graph.
import type { DrillDownEvent } from './ReportModuleWidget'

// ────────────────────────────────────────────────────────────────────
// 1. Renderer context + result types
// ────────────────────────────────────────────────────────────────────

export type OnDrillDown = (e: DrillDownEvent) => void

export type WidgetRenderContext = {
  /** Dataset resolved at `datasets[m.datasetKey]`. */
  ds: unknown
  /** Full dataset map (used for cross-dataset lookups e.g. comparison). */
  datasets: Record<string, unknown>
  /** Brand accent colour. */
  accent: string
  /** Stable palette for multi-series widgets. */
  colors: string[]
  /** Drill-down click handler (optional). */
  onDrillDown?: OnDrillDown
  /** Empty-state copy override. */
  emptyLabel?: string
  /** Pre-rendered title + subtitle block. */
  titleBlock: ReactNode
}

export type WidgetRendererResult = {
  /** Inner JSX (excluding the wrap chrome). */
  node: ReactNode
  /**
   * When true, the renderer's node is final — caller does NOT apply the
   * default wrap chrome. Only benchmark uses this today, because
   * BenchmarkWidget renders its own card and we'd double-wrap otherwise.
   */
  skipWrap?: boolean
}

export type WidgetRenderer = (m: ReportModule, ctx: WidgetRenderContext) => WidgetRendererResult

// ────────────────────────────────────────────────────────────────────
// 2. Per-kind renderers
// ────────────────────────────────────────────────────────────────────

export const renderKpi: WidgetRenderer = (m, ctx): WidgetRendererResult => {
  if (m.kind !== 'kpi') return { node: null }
  const kpi: ReportModuleKpi = m
  const { ds, datasets, accent, titleBlock } = ctx
  const n = numberAtPath(ds, kpi.valuePath)
  const cmpDs = kpi.comparisonDatasetKey ? datasets[kpi.comparisonDatasetKey] : ds
  const cmp = kpi.comparisonValuePath ? numberAtPath(cmpDs, kpi.comparisonValuePath) : null
  const sparkDs = kpi.sparklineDatasetKey ? datasets[kpi.sparklineDatasetKey] : ds
  const sparkRaw = kpi.sparklinePath ? getAtPath(sparkDs, kpi.sparklinePath) : null
  const sparkPoints = Array.isArray(sparkRaw)
    ? (sparkRaw as unknown[]).flatMap((p) => {
        if (!p || typeof p !== 'object') return []
        const obj = p as Record<string, unknown>
        const y = obj.y ?? obj.value
        if (typeof y !== 'number') return []
        return [y]
      })
    : []
  return {
    node: (
      <>
        {titleBlock}
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-4xl font-semibold tabular-nums text-neutral-900">{n ?? '—'}</p>
          {cmp != null && n != null ? (
            <KpiDeltaChip current={n} previous={cmp} goal={kpi.comparisonGoal ?? 'increase'} />
          ) : null}
        </div>
        {kpi.comparisonLabel && cmp != null ? (
          <p className="mt-0.5 text-[11px] text-neutral-500">{kpi.comparisonLabel}</p>
        ) : null}
        {sparkPoints.length > 1 ? (
          <div className="mt-2">
            <Sparkline values={sparkPoints} accent={accent} />
          </div>
        ) : null}
      </>
    ),
  }
}

export const renderTable: WidgetRenderer = (m, ctx): WidgetRendererResult => {
  if (m.kind !== 'table') return { node: null }
  const tbl: ReportModuleTable = m
  const { ds, emptyLabel, titleBlock } = ctx
  const rows = Array.isArray(ds) ? (ds as Record<string, unknown>[]) : []
  const cols = tbl.rowKeys.length ? tbl.rowKeys : Object.keys(rows[0] ?? {})
  return {
    node: (
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
        {rows.length === 0 ? <EmptyWidget label={emptyLabel ?? 'Ingen rader.'} /> : null}
      </>
    ),
  }
}

export const renderBar: WidgetRenderer = (m, ctx): WidgetRendererResult => {
  if (m.kind !== 'bar') return { node: null }
  const bar: ReportModuleBar = m
  const { ds, colors, onDrillDown, emptyLabel, titleBlock } = ctx
  const obj = ds && typeof ds === 'object' && !Array.isArray(ds) ? (ds as Record<string, unknown>) : {}
  const keys = bar.seriesKeys.filter((k) => k in obj)
  const nums = keys.map((k) => Number(obj[k]) || 0)
  const max = Math.max(1, ...nums)
  const drillable = !!(bar.drillDimensionId && onDrillDown)
  return {
    node: (
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
                <Button
                  key={k}
                  variant="ghost"
                  onClick={() =>
                    onDrillDown?.({ module: bar, segmentLabel: k, dimensionId: bar.drillDimensionId! })
                  }
                  title={`Filtrer på ${k}`}
                  className="block w-full rounded-sm px-1 py-0.5 text-left font-normal hover:bg-neutral-50"
                >
                  {inner}
                </Button>
              )
            }
            return <div key={k}>{inner}</div>
          })}
        </div>
        {keys.length === 0 ? <EmptyWidget label={emptyLabel ?? 'Ingen serier.'} /> : null}
      </>
    ),
  }
}

export const renderDonut: WidgetRenderer = (m, ctx): WidgetRendererResult => {
  if (m.kind !== 'donut') return { node: null }
  const dn: ReportModuleDonut = m
  const { ds, colors, onDrillDown, emptyLabel, titleBlock } = ctx
  const raw = dn.segmentsPath ? getAtPath(ds, dn.segmentsPath) : ds
  let segments: { label: string; value: number; color: string }[] = []
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    segments = segmentsFromObject(raw as Record<string, unknown>, colors)
  } else if (ds && typeof ds === 'object' && !Array.isArray(ds)) {
    segments = segmentsFromObject(ds as Record<string, unknown>, colors)
  }
  const handleSlice =
    dn.drillDimensionId && onDrillDown
      ? (label: string) => onDrillDown({ module: dn, segmentLabel: label, dimensionId: dn.drillDimensionId! })
      : undefined
  return {
    node: (
      <>
        {titleBlock}
        {segments.length ? (
          <div className="mt-4">
            <DonutMini segments={segments} onSliceClick={handleSlice} />
          </div>
        ) : (
          <EmptyWidget label={emptyLabel ?? 'Ingen data å vise.'} />
        )}
      </>
    ),
  }
}

export const renderHeatmap: WidgetRenderer = (m, ctx): WidgetRendererResult => {
  if (m.kind !== 'heatmap') return { node: null }
  const hm: ReportModuleHeatmap = m
  const { ds, accent, emptyLabel, titleBlock } = ctx
  const rowsRaw = hm.rowsPath ? getAtPath(ds, hm.rowsPath) : (ds as Record<string, unknown> | null | undefined)?.rows
  const colsRaw = hm.columnsPath
    ? getAtPath(ds, hm.columnsPath)
    : (ds as Record<string, unknown> | null | undefined)?.columns
  const cellsRaw = hm.cellsPath
    ? getAtPath(ds, hm.cellsPath)
    : (ds as Record<string, unknown> | null | undefined)?.cells
  const rows = Array.isArray(rowsRaw) ? (rowsRaw as unknown[]).map(String) : []
  const columns = Array.isArray(colsRaw) ? (colsRaw as unknown[]).map(String) : []
  const cells: number[][] = Array.isArray(cellsRaw)
    ? (cellsRaw as unknown[]).map((row) =>
        Array.isArray(row) ? (row as unknown[]).map((v) => Number(v) || 0) : [],
      )
    : []
  return {
    node: (
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
            valueMin={hm.valueMin}
            valueMax={hm.valueMax}
            valueLabel={hm.valueLabel}
          />
        )}
      </>
    ),
  }
}

export const renderLine: WidgetRenderer = (m, ctx): WidgetRendererResult => {
  if (m.kind !== 'line') return { node: null }
  const ln: ReportModuleLine = m
  const { ds, datasets, accent, emptyLabel, titleBlock } = ctx
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
  const points = parsePoints(ln.pointsPath ? getAtPath(ds, ln.pointsPath) : ds)
  const cmpDs = ln.comparisonDatasetKey ? datasets[ln.comparisonDatasetKey] : ds
  const cmpPoints = ln.comparisonPointsPath ? parsePoints(getAtPath(cmpDs, ln.comparisonPointsPath)) : []
  return {
    node: (
      <>
        {titleBlock}
        {points.length === 0 ? (
          <EmptyWidget label={emptyLabel ?? 'Ingen datapunkter ennå.'} />
        ) : (
          <LineMini
            points={points}
            comparisonPoints={cmpPoints.length > 1 ? cmpPoints : undefined}
            primaryLabel={ln.primaryLabel ?? ln.title}
            comparisonLabel={ln.comparisonLabel}
            accent={accent}
            xLabel={ln.xLabel}
            yLabel={ln.yLabel}
          />
        )}
      </>
    ),
  }
}

// ────────────────────────────────────────────────────────────────────
// Scorecard + Bowtie — large, share types
// ────────────────────────────────────────────────────────────────────

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

export const renderScorecard: WidgetRenderer = (m, ctx): WidgetRendererResult => {
  if (m.kind !== 'scorecard') return { node: null }
  const sc: ReportModuleScorecard = m
  const { ds, accent, onDrillDown, emptyLabel, titleBlock } = ctx
  const raw = sc.groupsPath ? getAtPath(ds, sc.groupsPath) : ds
  const groups: ScorecardGroup[] = Array.isArray(raw) ? (raw as ScorecardGroup[]) : []
  const drillable = !!(sc.drillDimensionId && onDrillDown)
  return {
    node: (
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
                      <p className="shrink-0 text-lg font-bold tabular-nums" style={{ color: accent }}>
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
                            <Button
                              variant="ghost"
                              onClick={() =>
                                onDrillDown?.({
                                  module: sc,
                                  segmentLabel: r.id!,
                                  dimensionId: sc.drillDimensionId!,
                                })
                              }
                              className="flex w-full items-center justify-start gap-3 rounded-none px-4 py-2.5 text-left font-normal transition hover:bg-white/60"
                            >
                              {inner}
                            </Button>
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
      </>
    ),
  }
}

// ────────────────────────────────────────────────────────────────────
// Bowtie — risiko-trekant per krav
// ────────────────────────────────────────────────────────────────────

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

type BowtieAxisDef = { id: string; label: string; kinds: string[] }
const BOWTIE_PREVENTIVE_AXES: BowtieAxisDef[] = [
  { id: 'course', label: 'Kurs', kinds: ['course_system', 'course_org'] },
  { id: 'document', label: 'Dokument', kinds: ['document', 'document_template'] },
  { id: 'checklist', label: 'Sjekkliste', kinds: ['checklist_template', 'checklist_item'] },
  { id: 'survey', label: 'Undersøkelse', kinds: ['survey'] },
  { id: 'meeting', label: 'Møte', kinds: ['meeting_template'] },
]
const BOWTIE_THREATS = ['Manglende kunnskap', 'Manglende rutine', 'Manglende kontroll']

function bowtieAxisCount(r: BowtieRow, axis: BowtieAxisDef): number {
  if (!r.byKind) return 0
  return axis.kinds.reduce((s, k) => s + (r.byKind?.[k] ?? 0), 0)
}
function bowtieAxisCls(r: BowtieRow, axis: BowtieAxisDef): string {
  const n = bowtieAxisCount(r, axis)
  if (n === 0) return 'border-dashed border-red-300 bg-red-50/50 text-red-700'
  if ((r.proof?.freshInstances ?? 0) > 0) return 'border-emerald-300 bg-emerald-50 text-emerald-900'
  if (r.status === 'partial' || (r.proof?.staleInstances ?? 0) > 0) return 'border-amber-300 bg-amber-50 text-amber-900'
  return 'border-sky-200 bg-sky-50 text-sky-900'
}
function bowtieTaskCount(r: BowtieRow): number {
  return r.byKind?.task ?? 0
}
function bowtieConsequencesFor(o: BowtieRow['obligation']): { label: string; sub: string; tone: 'severe' | 'medium' | 'low' }[] {
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
function bowtieConsequenceCls(tone: 'severe' | 'medium' | 'low'): string {
  return tone === 'severe'
    ? 'bg-red-50 text-red-900 ring-red-200'
    : tone === 'medium'
      ? 'bg-amber-50 text-amber-900 ring-amber-200'
      : 'bg-neutral-50 text-neutral-700 ring-neutral-200'
}

export const renderBowtie: WidgetRenderer = (m, ctx): WidgetRendererResult => {
  if (m.kind !== 'bowtie') return { node: null }
  const bt: ReportModuleBowtie = m
  const { ds, accent, onDrillDown, emptyLabel, titleBlock } = ctx
  const raw = bt.groupsPath ? getAtPath(ds, bt.groupsPath) : ds
  const groups: BowtieGroup[] = Array.isArray(raw) ? (raw as BowtieGroup[]) : []
  const drillable = !!(bt.drillDimensionId && onDrillDown)

  return {
    node: (
      <>
        {titleBlock}
        {groups.length === 0 ? (
          <EmptyWidget label={emptyLabel ?? 'Ingen krav matcher filteret.'} />
        ) : (
          <div className="mt-4 space-y-6">
            <p className="text-[11px] text-neutral-500">
              Venstre side: preventive barrierer (kurs · dokument · sjekkliste · undersøkelse · møte).
              Sentralt: brudd på §. Høyre side: mitigerende barrierer (avvik · ROS) og konsekvenser
              etter AML kap. 18–19.
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
                      const tasks = bowtieTaskCount(r)
                      const cons = bowtieConsequencesFor(r.obligation)
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
                            <Button
                              variant="ghost"
                              onClick={() =>
                                onDrillDown?.({
                                  module: bt,
                                  segmentLabel: r.id!,
                                  dimensionId: bt.drillDimensionId!,
                                })
                              }
                              className="mb-2 w-full justify-start rounded-none p-0 text-left font-normal transition hover:bg-transparent hover:opacity-80"
                            >
                              {titleEl}
                            </Button>
                          ) : (
                            <div className="mb-2">{titleEl}</div>
                          )}
                          <div className="grid gap-2 lg:grid-cols-[110px_1fr_60px_1fr_140px] lg:items-center">
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                                Trusler
                              </p>
                              {BOWTIE_THREATS.map((t) => (
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
                                {BOWTIE_PREVENTIVE_AXES.map((axis) => {
                                  const n = bowtieAxisCount(r, axis)
                                  return (
                                    <span
                                      key={axis.id}
                                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${bowtieAxisCls(r, axis)}`}
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
                                {r.obligation === 'mandatory' ? 'Konsekvens ved brudd' : 'Mulig konsekvens'}
                              </p>
                              {cons.map((c) => (
                                <div
                                  key={c.label}
                                  className={`rounded border px-1.5 py-0.5 text-[10px] ring-1 ring-inset ${bowtieConsequenceCls(c.tone)}`}
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
      </>
    ),
  }
}

export const renderBenchmark: WidgetRenderer = (m, ctx): WidgetRendererResult => {
  if (m.kind !== 'benchmark') return { node: null }
  const bm: ReportModuleBenchmark = m
  const { ds, accent } = ctx
  // BenchmarkWidget renders its own card, so signal skipWrap=true to the
  // caller. This mirrors the pre-refactor branch which manually built
  // <div ref={wrapRef} className={`${colSpanClass} ${rowBreakClass}`}>...
  // around BenchmarkWidget. The caller (ReportModuleWidget) handles the
  // colSpan + rowBreak wrapping when skipWrap is set.
  const series = Array.isArray(ds) ? (ds as BenchmarkPoint[]) : []
  return {
    skipWrap: true,
    node: (
      <BenchmarkWidget
        orgId={null}
        metric={bm.metric}
        label={bm.title}
        valueLabel={bm.valueLabel ?? bm.subtitle}
        goalDirection={bm.goalDirection ?? 'decrease'}
        series={series}
        accent={accent}
      />
    ),
  }
}
