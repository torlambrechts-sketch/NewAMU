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

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReportModule } from '../../types/reportBuilder'
import type {
  DashboardComparisonMode,
  DashboardDimension,
  DashboardFilter,
  DashboardFilterPreset,
} from './dashboardFilters'
import { freshId } from './freshId'

/**
 * Dependencies passed to a scope's optional `datasetsHook` from the
 * cross-scope reporting host. Keeps the contract narrow so scope hooks
 * don't have to know about the broader page context.
 */
export type DatasetsHookDeps = {
  supabase: SupabaseClient | null
  organizationId: string | null
  filters: DashboardFilter[]
}

/**
 * A scope's optional self-fetching dataset hook signature. When registered,
 * the reporting module can mount one adapter per selected scope and merge
 * their dataset maps without the host page knowing each module's data
 * fetcher up-front. Existing per-module analyse pages keep using their
 * own bespoke hooks; this signature is for the registry-driven path only.
 */
export type DatasetsHook = (deps: DatasetsHookDeps) => Record<string, unknown>

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
  /**
   * Shape-aware add-widget hint (3.2.7). When set, the picker shows
   * these as alternative kinds the user can instantiate from the same
   * catalog entry (e.g. a `segments` dataset can be added as either a
   * donut or a bar). When omitted, the picker derives the list via
   * `defaultCompatibleKinds(template.kind)`.
   */
  compatibleKinds?: import('../../types/reportBuilder').ReportModuleKind[]
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
  /**
   * Composite scopes (3.3.1): when set, this scope is a composition of
   * widgets pulled from multiple member scopes (e.g. "HMS Overview"
   * pulling KPIs from compliance + survey + tasks + learning).
   *
   * The composite's `defaultLayout` and `widgetCatalog` reference dataset
   * keys from any of the listed member scopes — host pages compute each
   * member's datasets via its `useXxxDatasets` hook and merge the results
   * into one map. Cross-scope filters work because each per-scope hook
   * picks up the chips it understands and ignores the rest.
   *
   * Member scopeIds must be other registered scopes; the composite
   * itself is just a normal scope row, so saved layouts persist via
   * `dashboard_layouts` exactly like a per-module dashboard.
   */
  compositeMembers?: string[]
  /**
   * Optional self-fetching dataset hook, used only by the reporting
   * module's cross-scope host. Registering this lets a user pick any
   * subset of scopes for a report without the host page having to
   * import each module's hook up-front. Existing analyse pages still
   * call their own dataset hook directly and don't depend on this.
   */
  datasetsHook?: DatasetsHook
  /**
   * Saved filter-set quick-applies rendered in the filter bar. When
   * the user clicks a preset, the active filters (and optionally the
   * comparison mode) are replaced atomically. Useful for opinionated
   * workflows like "Psykososial (AML § 4-3)" or "Røde risikoer".
   */
  presets?: DashboardFilterPreset[]
  /**
   * Set true to render the "Sammenlign" dropdown in the filter bar
   * for this scope. The scope's dataset hook must read the
   * comparison value (received in DatasetsHookDeps or as a hook
   * parameter for non-registry-driven pages) and emit parallel
   * dataset keys for KPI/line widgets to reference via
   * `comparisonDatasetKey`. Scopes that haven't wired comparison
   * leave this off (default).
   */
  supportsComparison?: boolean
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
export type {
  DashboardComparisonMode,
  DashboardDimension,
  DashboardFilter,
  DashboardFilterPreset,
}
export { freshId } from './freshId'
