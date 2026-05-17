// Studio Builder — single source of truth for scope + kind registration.
//
// Mirrors src/lib/dashboards/dashboardRegistry.ts and
// src/lib/workflows/workflowRegistry.ts. Per spec §4:
// "Registry pattern + side-effect import discipline." Each scope file
// MUST be imported as a side effect — without it, registration silently
// does not happen and the kind is invisible at runtime.
//
// Aggregator pattern: modules/<scope>/studio/<scope>StudioScope.ts files
// are imported once from a single `registerScopes.ts` aggregator that the
// studio shell pulls in at module-load time. See spec §4 architecture
// diagram for the full data flow.

import type { StudioScope, StudioKindRegistration } from './studioTypes'

// ────────────────────────────────────────────────────────────────────
// Internal stores — Maps keyed by scopeId / (scopeId, kindId)
// ────────────────────────────────────────────────────────────────────

const scopeRegistry = new Map<string, StudioScope>()
const kindRegistry = new Map<string, StudioKindRegistration>()

const kindKey = (scopeId: string, kindId: string) => `${scopeId}::${kindId}`

// ────────────────────────────────────────────────────────────────────
// Public API — register / get / list
// ────────────────────────────────────────────────────────────────────

/**
 * Register a studio scope. Idempotent — re-registering replaces the entry
 * (handy for HMR during dev).
 */
export function registerStudioScope(scope: StudioScope): void {
  scopeRegistry.set(scope.scopeId, scope)
}

/**
 * Register a studio kind. The scope must already be registered. The
 * prebuild assertion in scripts/assert-studio-registry.ts verifies that
 * every registered kind has ≥1 simplePreset AND ≥1 advancedSchema field.
 */
export function registerStudioKind(kind: StudioKindRegistration): void {
  if (!scopeRegistry.has(kind.scopeId)) {
    // Don't throw at registration time — scope file order is not
    // guaranteed in dev with HMR. Just log; the prebuild script catches
    // missing scopes properly.
    // eslint-disable-next-line no-console
    if (typeof console !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.warn(
        `[studio] kind "${kind.kindId}" registered before scope "${kind.scopeId}" — check side-effect import order`,
      )
    }
  }
  kindRegistry.set(kindKey(kind.scopeId, kind.kindId), kind)
}

export function getStudioScope(scopeId: string): StudioScope | null {
  return scopeRegistry.get(scopeId) ?? null
}

export function getStudioKind(scopeId: string, kindId: string): StudioKindRegistration | null {
  return kindRegistry.get(kindKey(scopeId, kindId)) ?? null
}

export function listStudioScopes(): StudioScope[] {
  return [...scopeRegistry.values()].sort((a, b) => a.order - b.order)
}

export function listStudioKinds(scopeId?: string): StudioKindRegistration[] {
  const all = [...kindRegistry.values()]
  return scopeId == null ? all : all.filter((k) => k.scopeId === scopeId)
}

// ────────────────────────────────────────────────────────────────────
// STUDIO_SOURCE_MODULES — known scope ids
// ────────────────────────────────────────────────────────────────────
// The 8 scopes the spec promises: 7 content scopes + workflows
// (absorbed from workflow-engine-review.md Phase B per §3 decisions).
// Adding a new scope means adding it here AND shipping the scope file.

export const STUDIO_SOURCE_MODULES = [
  'compliance',
  'survey',
  'documents',
  'learning',
  'meetings',
  'registers',
  'dashboards',
  'workflows',
] as const

export type StudioSourceModule = (typeof STUDIO_SOURCE_MODULES)[number]

// ────────────────────────────────────────────────────────────────────
// Dev-mode startup assertion
// ────────────────────────────────────────────────────────────────────
// Logs a warning when a known scope is missing — catches the
// side-effect-import-forgotten footgun called out in CLAUDE.md §
// "Things easy to get wrong". Production silently skips this check; the
// prebuild script (Task 0.7) is the hard gate.

let assertionRan = false
export function assertStudioScopesRegistered(): void {
  if (assertionRan) return
  assertionRan = true
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return
  const missing = STUDIO_SOURCE_MODULES.filter((m) => !scopeRegistry.has(m))
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[studio] ${missing.length} scope(s) missing from registry — did you forget the side-effect import?\n` +
        missing.map((m) => `  · ${m}  →  modules/${m}/studio/${m}StudioScope.ts`).join('\n'),
    )
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `[studio] ${scopeRegistry.size} scopes / ${kindRegistry.size} kinds registered`,
    )
  }
}

// ────────────────────────────────────────────────────────────────────
// Helpers for the prebuild assertion script (Task 0.7)
// ────────────────────────────────────────────────────────────────────

/** Used by scripts/assert-studio-registry.ts to validate kind invariants. */
export function _internalEnumerateKindsForAssertion(): StudioKindRegistration[] {
  return [...kindRegistry.values()]
}
