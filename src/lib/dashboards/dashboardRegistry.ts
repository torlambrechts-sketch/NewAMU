// Module dashboard registry.
//
// Each module that exposes an analytics page registers a "scope" here:
//   - scopeId: stable string that ties default layouts, saved
//     dashboard_layouts rows and the widget catalog together
//     (e.g. 'compliance_checklist', 'survey').
//   - defaultLayout: the ReportModule[] rendered when no custom layout
//     has been saved for this org/user yet. Same shape as the existing
//     report-builder primitives so the renderer is shared.
//   - widgetCatalog: full set of widgets the user can pick from in the
//     "Add Widget" UI. Each catalog entry is a template that the editor
//     stamps a unique id onto when added to a layout.
//
// Phase 1 — registry + default layout consumption only. Phase 2 layers
// persistence (dashboard_layouts table) and Phase 3 the editor UX on top.
// The public surface is therefore intentionally narrow: register at
// module load, look up at render.

import type { ReportModule } from '../../types/reportBuilder'

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

export type DashboardScope = {
  scopeId: string
  /** User-facing title used by ModuleAnalyticsDashboard when a page-level title isn't provided. */
  label: string
  /** Layout used when the user has no saved dashboard for this scope. */
  defaultLayout: ReportModule[]
  /** Picker options for "Add Widget". */
  widgetCatalog: WidgetCatalogEntry[]
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
  const cryptoLike = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  const id =
    typeof cryptoLike?.randomUUID === 'function'
      ? cryptoLike.randomUUID()
      : `w_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
  return { ...(entry.template as ReportModule), id } as ReportModule
}
