// Module settings registry.
//
// Mirror of `src/lib/dashboards/dashboardRegistry.ts`. Each module (and the
// org-level admin surface) registers a "scope" here; the unified
// `/admin/settings/:scope?/:section?` shell renders whichever scope is
// active. The registry is the single source of truth for:
//   - which scopes exist
//   - which sections (tabs) each scope publishes
//   - which permissions gate visibility
//   - which "capabilities" each section declares (templates / categories /
//     workflow / etc.) so cross-cutting features (template browser,
//     settings search, future bulk-export) don't have to special-case modules
//
// Scopes are registered via side-effect imports in
// `src/lib/settings/registerAll.ts`. Registration is idempotent — HMR
// re-registers with the same `scopeId` and replaces the entry.

import type { ComponentType, LazyExoticComponent } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { PermissionKey } from '../permissionKeys'

/**
 * Closed union of cross-cutting capabilities a section can advertise.
 * Keep this CLOSED — every consumer (template browser, search facets,
 * future bulk-export, audit-log filtering) reads it. Adding a new value
 * means updating every consumer. Don't let it drift.
 */
export type SectionCapability =
  | 'general'
  | 'templates'
  | 'categories'
  | 'packs'
  | 'requirements'
  | 'workflow'
  | 'integrations'
  | 'import-export'
  | 'statistics'

export type SettingsSectionComponentProps = {
  scopeId: string
}

/**
 * One tab inside a scope.
 *
 * `component` MUST be a `React.lazy(...)` import. Eager imports would
 * pull every module's settings code into the shell's chunk, ballooning
 * the admin bundle.
 */
export type SettingsSection = {
  /** Stable id used in the URL segment. */
  id: string
  /** Norwegian (nb) display label. */
  label: string
  /** Icon (lucide-react) shown next to the tab label. */
  icon?: LucideIcon
  /**
   * Optional narrower permission gate than the scope's. Omit to
   * inherit `scope.permAny`. `isAdmin` short-circuits regardless.
   */
  permAny?: PermissionKey[]
  /**
   * Cross-cutting capabilities this section advertises. Required —
   * pass `['general']` if the section is plain config and nothing more.
   */
  capabilities: SectionCapability[]
  /** Free-form search keywords; matched by the settings search box. */
  searchKeywords?: string[]
  /** Lazy-loaded section component. */
  component: LazyExoticComponent<ComponentType<SettingsSectionComponentProps>>
}

export type SettingsScopeGroup = 'org' | 'module' | 'system'

export type SettingsScope = {
  scopeId: string
  /** Norwegian (nb) display label shown in the left rail. */
  label: string
  /**
   * Which left-rail group this scope belongs to. `org` = the
   * Organisasjon group (users, roles, GDPR, …); `module` = a per-module
   * settings scope (compliance, survey, …); `system` = platform-level
   * sections (module enablement, audit log, template browser).
   */
  group: SettingsScopeGroup
  /** Display order inside its group (ascending). Ties broken by `scopeId`. */
  order?: number
  /** Icon (lucide-react). */
  icon?: LucideIcon
  /** Accent colour — see CLAUDE.md "Accent palette". */
  accent?: string
  /**
   * Scope-level visibility gate. Inherited as the default by every
   * section that doesn't declare its own `permAny`.
   */
  permAny?: PermissionKey[]
  sections: SettingsSection[]
  /**
   * Optional reset hook. Shell renders a "Tilbakestill til standard"
   * button ONLY when this is declared. Half-implementing (declare but
   * leave it as a no-op) is worse than not declaring — the button
   * appears but does nothing.
   */
  resetToDefaults?: () => Promise<void>
}

const registry = new Map<string, SettingsScope>()

/** Module-init registration. Idempotent — re-registering replaces. */
export function registerSettingsScope(scope: SettingsScope): void {
  registry.set(scope.scopeId, scope)
}

/** Runtime lookup — returns null if the scope isn't registered yet. */
export function getSettingsScope(scopeId: string): SettingsScope | null {
  return registry.get(scopeId) ?? null
}

/** All registered scopes, sorted by `group` then `order` then `scopeId`. */
export function listSettingsScopes(): SettingsScope[] {
  const all = [...registry.values()]
  const groupOrder: Record<SettingsScopeGroup, number> = { org: 0, module: 1, system: 2 }
  return all.sort((a, b) => {
    const g = groupOrder[a.group] - groupOrder[b.group]
    if (g !== 0) return g
    const o = (a.order ?? 100) - (b.order ?? 100)
    if (o !== 0) return o
    return a.scopeId.localeCompare(b.scopeId)
  })
}

/**
 * Returns true when the current user can see `permAny` (any-of semantics).
 * Mirrors `<MODULE>_NAV_PERMS` use in `AticsShell.tsx`. `isAdmin` is the
 * short-circuit. An empty/undefined `permAny` means "no gate".
 */
export function canSeePermAny(
  permAny: PermissionKey[] | undefined,
  can: (key: PermissionKey) => boolean,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true
  if (!permAny || permAny.length === 0) return true
  return permAny.some((k) => can(k))
}
