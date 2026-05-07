// Module dashboard registry.
//
// Each module that exposes an analytics page registers a "scope" here.
// The registry holds three things per scope:
//   - the default ReportModule[] layout shown when no saved row exists
//   - the widget catalog ("Add Widget" picker)
//   - the dimension catalog used by the filter chip bar
//   - dataset metadata (id + label + shape hint) so the registry can
//     answer "what keys does this scope publish?" without the runtime
//     knowing module-specific details
//
// The page that owns the source data is still responsible for actually
// computing the dataset values — the registry doesn't pull from
// Supabase. Compute happens via a `computeDatasets(filters)` callback
// the page hands in to ModuleAnalyticsDashboard. That keeps "what data
// exists" co-located with the data hook (useChecklistModule etc.) while
// "how to display it" lives in the registry.

import type { ReportModule } from '../../types/reportBuilder'
import type { DashboardFilter, DashboardDimension } from './dashboardFilters'
import { freshId } from './freshId'

/**
 * One picker entry in the "Add Widget" catalog. Carries everything
 * needed to add a fresh ReportModule to a layout — except the id,
 * which the editor mints fresh per insertion.
 */
export type WidgetCatalogEntry = {
  /** Stable id for the catalog entry (not the inserted module id). */
  catalogId: string
  /** Group label in the picker (e.g. "Volum", "Funn"). */
  category: string
  /** Display name + optional sentence describing what the widget shows. */
  label: string
  description?: string
  /**
   * Template ReportModule. The editor copies it into the layout and
   * assigns a fresh `id` (e.g. via crypto.randomUUID()). The template's
   * own id is ignored at insertion time.
   */
  template: Omit<ReportModule, 'id'>
}

/**
 * Dataset metadata declared by a scope. Used by the widget editor to
 * label the "Datakilde" line and (later) to drive the Add Widget UI's
 * shape-aware kind choices.
 */
export type DatasetMeta = {
  /** Lookup key used at runtime in `datasets[key]`. */
  key: string
  /** User-facing label (Norwegian). */
  label: string
  /**
   * Hint about the dataset's value shape so widgets can reject
   * incompatible kinds:
   *   - 'kpi-record' : Record<string, number>
   *   - 'segments'   : Record<label, number>  (donut/bar/table)
   *   - 'series'     : Array<{x, y}>          (line)
   *   - 'rows'       : Array<Record<string, unknown>>  (table only)
   */
  shape: 'kpi-record' | 'segments' | 'series' | 'rows'
}

export type DashboardScope = {
  scopeId: string
  /** User-facing title used by ModuleAnalyticsDashboard when a page-level title isn't provided. */
  label: string
  /** Layout used when the user has no saved dashboard for this scope. */
  defaultLayout: ReportModule[]
  /** Picker options for "Add Widget". */
  widgetCatalog: WidgetCatalogEntry[]
  /** Datasets the scope publishes (used by the widget editor). */
  datasets?: DatasetMeta[]
  /** Filter dimensions exposed in the filter chip bar. */
  dimensions?: DashboardDimension[]
  /**
   * Default accent colour for this scope's dashboards. Used by
   * `ModuleAnalyticsDashboard` when the host page doesn't pass an
   * explicit `accent` prop. Pages may still override per-render
   * (e.g. compliance flips accent based on the active `?pack=` focus).
   */
  accent?: string
}

const registry = new Map<string, DashboardScope>()

/**
 * Module-init registration. Idempotent — re-registering with the same
 * scopeId replaces the entry, which is what HMR wants during dev.
 */
export function registerDashboardScope(scope: DashboardScope): void {
  registry.set(scope.scopeId, scope)
}

/** Runtime lookup — returns null if the scope isn't registered yet. */
export function getDashboardScope(scopeId: string): DashboardScope | null {
  return registry.get(scopeId) ?? null
}

/** All registered scopes (mainly for diagnostics). */
export function listDashboardScopes(): DashboardScope[] {
  return [...registry.values()]
}

/**
 * Convenience: stamp a fresh id onto a catalog template so it can be
 * appended to a layout. Uses crypto.randomUUID() when available with a
 * fallback for older runtimes.
 */
export function instantiateWidget(entry: WidgetCatalogEntry): ReportModule {
  return { ...(entry.template as ReportModule), id: freshId('w') } as ReportModule
}

/** Re-export so consumers don't have to import from two places. */
export type { DashboardFilter, DashboardDimension }
export { freshId } from './freshId'
