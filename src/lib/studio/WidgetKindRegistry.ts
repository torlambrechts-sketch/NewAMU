// Studio Builder — widget kind registry for dashboard layouts.
//
// Task 0.3 (additive half). Registers the 9 existing widget kinds —
// kpi, table, bar, donut, line, heatmap, scorecard, bowtie, benchmark —
// with their metadata: label, default config, default compatible kinds,
// and a stable kind id consumers can look up.
//
// What this commit ships (additive only):
//   - The registry definition + 9 kind entries
//   - Label + default-compatible-kinds lookups
//   - A `WIDGET_KIND_IDS` const that downstream Zod schemas can derive
//     their enum from
//
// What's deferred to a follow-up commit (the DESTRUCTIVE half of Task 0.3):
//   - Replacing the 9-branch if-chain in ReportModuleWidget.tsx with
//     registry.get(kind).renderer(m, ctx)
//   - Moving each branch's JSX into the registry as a `renderer` function
//   - Deriving ReportModuleKind from `keyof WIDGET_KIND_REGISTRY`
//   - Replacing KIND_LABELS / defaultCompatibleKinds in
//     dashboardWidgetKinds.ts with registry lookups
//
// The destructive refactor needs visual diff verification (the spec's
// "pixel-diff <0.5%" acceptance) which requires a running dev server +
// screenshot tooling. Splitting into additive + destructive halves lets
// the safe pieces ship now without bottlenecking on visual QA.
//
// Spec: specs/studio-builder.md §5 Phase 0 Task 0.3.

import type { ReportModuleKind } from '../../types/reportBuilder'
import {
  renderKpi,
  renderTable,
  renderBar,
  renderDonut,
  renderHeatmap,
  renderLine,
  renderScorecard,
  renderBowtie,
  renderBenchmark,
  type WidgetRenderer,
} from '../../components/reports/widgetRenderers'

// ────────────────────────────────────────────────────────────────────
// 1. Registry entry shape
// ────────────────────────────────────────────────────────────────────

export type WidgetKindEntry = {
  /** Stable kind id. */
  id: ReportModuleKind
  /** Norwegian label shown in pickers (matches KIND_LABELS today). */
  label: string
  /**
   * Compatible kinds for "convert to" / "add as" UX. Matches the current
   * defaultCompatibleKinds() output so the additive refactor is
   * behaviour-preserving.
   */
  defaultCompatibleKinds: ReportModuleKind[]
  /** Group label for the widget catalog picker. */
  group: 'KPI' | 'Tabell' | 'Diagram' | 'Spesial'
  /** Brief description (1 sentence) shown as a hint in the picker. */
  description: string
  /**
   * Renderer function for the widget runtime. Takes the typed module
   * config + a WidgetRenderContext, returns the inner JSX (with an
   * optional `skipWrap` flag for kinds that emit their own card chrome).
   * Migrated out of ReportModuleWidget's if-chain in Task 0.3 Stage B.
   */
  renderer: WidgetRenderer
}

// ────────────────────────────────────────────────────────────────────
// 2. The 9 widget kinds — labels + compatibility EXACTLY matched to the
//    pre-refactor behaviour (DashboardEditWidgetPanel KIND_LABELS,
//    dashboardWidgetKinds defaultCompatibleKinds). Do NOT edit these
//    values to "improve" them — they are the contract consumers read
//    from. A label/compat change here changes user-visible UI in every
//    widget-edit panel and shape-aware kind picker.

export const WIDGET_KIND_ENTRIES: WidgetKindEntry[] = [
  {
    id: 'kpi',
    label: 'KPI-tall',
    group: 'KPI',
    description: 'Ett tall, med valgfri sammenligning og sparkline.',
    defaultCompatibleKinds: ['kpi'],
    renderer: renderKpi,
  },
  {
    id: 'bar',
    label: 'Søylediagram',
    group: 'Diagram',
    description: 'Horisontale søyler med valgfri drill-down.',
    defaultCompatibleKinds: ['donut', 'bar', 'table'],
    renderer: renderBar,
  },
  {
    id: 'donut',
    label: 'Kakediagram',
    group: 'Diagram',
    description: 'Andelsfordeling som donut/sektor.',
    defaultCompatibleKinds: ['donut', 'bar', 'table'],
    renderer: renderDonut,
  },
  {
    id: 'line',
    label: 'Linjediagram',
    group: 'Diagram',
    description: 'Tidsserie eller trend.',
    defaultCompatibleKinds: ['line'],
    renderer: renderLine,
  },
  {
    id: 'table',
    label: 'Tabell',
    group: 'Tabell',
    description: 'Radbasert tabell med valgfri søyle/lenke per rad.',
    defaultCompatibleKinds: ['donut', 'bar', 'table'],
    renderer: renderTable,
  },
  {
    id: 'heatmap',
    label: 'Heatmap',
    group: 'Spesial',
    description: 'Matrise (f.eks. lokasjon × kategori).',
    defaultCompatibleKinds: ['heatmap'],
    renderer: renderHeatmap,
  },
  {
    id: 'scorecard',
    label: 'Scorecard',
    group: 'KPI',
    description: 'Stort tall i kort med valgfri kontekst-rad.',
    defaultCompatibleKinds: ['scorecard', 'bowtie'],
    renderer: renderScorecard,
  },
  {
    id: 'bowtie',
    label: 'Bowtie',
    group: 'Spesial',
    description: 'Risiko-bowtie — venstre årsaker, høyre konsekvenser.',
    defaultCompatibleKinds: ['scorecard', 'bowtie'],
    renderer: renderBowtie,
  },
  {
    id: 'benchmark',
    label: 'Benchmark (anonymisert)',
    group: 'Spesial',
    description: 'Sammenligning mot referansegruppe (industri, fjorår).',
    defaultCompatibleKinds: ['benchmark'],
    renderer: renderBenchmark,
  },
]

// ────────────────────────────────────────────────────────────────────
// 3. Lookups
// ────────────────────────────────────────────────────────────────────

const REGISTRY = new Map<ReportModuleKind, WidgetKindEntry>(
  WIDGET_KIND_ENTRIES.map((e) => [e.id, e]),
)

export function getWidgetKind(kind: ReportModuleKind): WidgetKindEntry | null {
  return REGISTRY.get(kind) ?? null
}

export function listWidgetKinds(): WidgetKindEntry[] {
  return [...WIDGET_KIND_ENTRIES]
}

/**
 * The 9 widget kind ids as a const tuple. Use this to derive Zod enums
 * and TS unions instead of hand-maintaining a parallel list.
 */
export const WIDGET_KIND_IDS = WIDGET_KIND_ENTRIES.map((e) => e.id) as readonly ReportModuleKind[]

/**
 * Norwegian label lookup. Mirrors the old hand-maintained KIND_LABELS
 * object in DashboardEditWidgetPanel.tsx — that consumer now reads from
 * here instead.
 */
export function getWidgetKindLabel(kind: ReportModuleKind): string {
  return REGISTRY.get(kind)?.label ?? kind
}

/**
 * Compatibility lookup for the widget editor's "convert to" UX. Mirrors
 * the old hand-maintained `defaultCompatibleKinds` function in
 * dashboardWidgetKinds.ts. Unknown kinds fall back to `['kpi']`
 * (the legacy default).
 */
export function defaultCompatibleKindsFor(kind: ReportModuleKind): ReportModuleKind[] {
  return REGISTRY.get(kind)?.defaultCompatibleKinds ?? ['kpi']
}

/**
 * The full KIND_LABELS map as a Record. Provided for consumers that want
 * a plain object lookup. Built once at module load.
 */
export const WIDGET_KIND_LABELS: Record<ReportModuleKind, string> = Object.fromEntries(
  WIDGET_KIND_ENTRIES.map((e) => [e.id, e.label]),
) as Record<ReportModuleKind, string>

// ────────────────────────────────────────────────────────────────────
// 4. Lookup helpers with graceful fallbacks
// ────────────────────────────────────────────────────────────────────
// WIDGET_KIND_ENTRIES is asserted to contain all 9 ReportModuleKind
// values via the consumer-side helpers (getWidgetKindLabel, etc.) which
// fall back gracefully. Missing-entry safety is enforced socially: when
// you add a new kind to ReportModuleKind, add an entry here in the same
// commit.
//
// (A type-level exhaustiveness check would require restructuring this as
// `Record<ReportModuleKind, WidgetKindEntry>` rather than an array; the
// array shape better serves consumers that need ordering for pickers, so
// we keep the array + soft-check pattern.)
