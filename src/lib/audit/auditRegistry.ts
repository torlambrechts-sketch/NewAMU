// Scope registry — mirrors src/lib/dashboards/dashboardRegistry.ts.
// Each module that ships an Endringslogg surface declares an AuditScope
// in a side-effect file (e.g. src/modules/compliance/audit/...AuditScope.ts).
// The host page imports the file once at the top so registration happens
// before the first render. See specs/endringslogg-spec.md §5.

export type AuditScope = {
  scopeId: string
  label: string
  /** Entity kinds owned by this scope. UI uses the first as the room subject. */
  entityKinds: string[]
  /** Tailwind hex used by the panel header. Defaults to compliance green. */
  accent?: string
  /** Tables this scope writes to. Consumed by the recon SQL + the lint rule. */
  auditableTables?: string[]
}

const REGISTRY = new Map<string, AuditScope>()

export function registerAuditScope(scope: AuditScope): void {
  REGISTRY.set(scope.scopeId, scope)
}

export function getAuditScope(scopeId: string): AuditScope | undefined {
  return REGISTRY.get(scopeId)
}

export function listAuditScopes(): AuditScope[] {
  return Array.from(REGISTRY.values())
}

/** Reverse lookup — find a scope by an entityKind it owns. Used by
 *  `<EntityTimeline>` so callers can pass only `entityKind` (no
 *  redundant `scopeId`). */
export function findScopeForEntityKind(entityKind: string): AuditScope | undefined {
  for (const scope of REGISTRY.values()) {
    if (scope.entityKinds.includes(entityKind)) return scope
  }
  return undefined
}
