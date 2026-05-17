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
}

// ────────────────────────────────────────────────────────────────────
// 2. The 9 widget kinds — labels + compatibility matched to existing code
// ────────────────────────────────────────────────────────────────────
// Labels mirror src/components/module/dashboard/DashboardEditWidgetPanel.tsx
// KIND_LABELS. Compatibility matrix mirrors
// src/components/module/dashboard/dashboardWidgetKinds.ts defaultCompatibleKinds.

export const WIDGET_KIND_ENTRIES: WidgetKindEntry[] = [
  {
    id: 'kpi',
    label: 'KPI-tile',
    group: 'KPI',
    description: 'Ett tall, med valgfri sammenligning og sparkline.',
    defaultCompatibleKinds: ['kpi', 'scorecard'],
  },
  {
    id: 'scorecard',
    label: 'Scorecard',
    group: 'KPI',
    description: 'Stort tall i kort med valgfri kontekst-rad.',
    defaultCompatibleKinds: ['scorecard', 'kpi'],
  },
  {
    id: 'table',
    label: 'Tabell',
    group: 'Tabell',
    description: 'Radbasert tabell med valgfri søyle/lenke per rad.',
    defaultCompatibleKinds: ['table'],
  },
  {
    id: 'bar',
    label: 'Søylediagram',
    group: 'Diagram',
    description: 'Horisontale eller vertikale søyler.',
    defaultCompatibleKinds: ['bar', 'donut'],
  },
  {
    id: 'donut',
    label: 'Sektordiagram',
    group: 'Diagram',
    description: 'Andelsfordeling som donut/sektor.',
    defaultCompatibleKinds: ['donut', 'bar'],
  },
  {
    id: 'line',
    label: 'Linjediagram',
    group: 'Diagram',
    description: 'Tidsserie eller trend.',
    defaultCompatibleKinds: ['line'],
  },
  {
    id: 'heatmap',
    label: 'Heatmap',
    group: 'Spesial',
    description: 'Matrise (f.eks. lokasjon × kategori).',
    defaultCompatibleKinds: ['heatmap'],
  },
  {
    id: 'bowtie',
    label: 'Sløyfediagram (bowtie)',
    group: 'Spesial',
    description: 'Risiko-bowtie — venstre årsaker, høyre konsekvenser.',
    defaultCompatibleKinds: ['bowtie'],
  },
  {
    id: 'benchmark',
    label: 'Benchmark',
    group: 'Spesial',
    description: 'Sammenligning mot referansegruppe (industri, fjorår).',
    defaultCompatibleKinds: ['benchmark'],
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
