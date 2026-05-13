// Workflow scope registry.
//
// Mirrors src/lib/dashboards/dashboardRegistry.ts. Each module registers
// one scope on import. The unified builder reads only from this registry —
// the execution engine (Postgres) never sees TypeScript scope definitions,
// it just matches workflow_rules.source_module against the scope id.
//
// Important: scope files MUST be imported as a side effect. CLAUDE.md's
// "Things easy to get wrong" calls this out explicitly — without the side-
// effect import, registration silently does not happen. The aggregator in
// registerScopes.ts pulls in every scope so consumers can do a single
// `import './lib/workflows/registerScopes'` at app start-up.

import type {
  WorkflowScope,
  WorkflowEventDescriptor,
  WorkflowActionDescriptor,
  ConditionFieldDescriptor,
} from './workflowTypes'

const registry = new Map<string, WorkflowScope>()

/**
 * Module-init registration. Idempotent — re-registering the same scopeId
 * replaces the entry (handy for HMR during dev).
 */
export function registerWorkflowScope(scope: WorkflowScope): void {
  registry.set(scope.scopeId, scope)
}

/** Lookup a scope by id. */
export function getWorkflowScope(scopeId: string): WorkflowScope | null {
  return registry.get(scopeId) ?? null
}

/** All registered scopes (diagnostics, picker). */
export function listWorkflowScopes(): WorkflowScope[] {
  return [...registry.values()]
}

/**
 * Aggregate every event across every scope, optionally filtered to one
 * scope. Builder uses this for the trigger picker.
 */
export function listWorkflowEvents(scopeId?: string): Array<{
  scope: WorkflowScope
  event: WorkflowEventDescriptor
}> {
  const scopes = scopeId
    ? ([getWorkflowScope(scopeId)].filter(Boolean) as WorkflowScope[])
    : listWorkflowScopes()
  return scopes.flatMap((scope) => scope.events.map((event) => ({ scope, event })))
}

/**
 * Aggregate every action across every scope. Builder uses this for the
 * action picker and to detect gov-reporting actions.
 */
export function listWorkflowActions(scopeId?: string): Array<{
  scope: WorkflowScope
  action: WorkflowActionDescriptor
}> {
  const scopes = scopeId
    ? ([getWorkflowScope(scopeId)].filter(Boolean) as WorkflowScope[])
    : listWorkflowScopes()
  return scopes.flatMap((scope) => scope.actions.map((action) => ({ scope, action })))
}

/**
 * Condition fields the builder offers when authoring a rule for scopeId.
 * Includes cross-scope fields (e.g. severity) when those scopes share the
 * shape — that's the responsibility of the scope file (declare the field
 * locally if you want it to show up).
 */
export function listConditionFields(scopeId: string): ConditionFieldDescriptor[] {
  return getWorkflowScope(scopeId)?.conditionFields ?? []
}

/** Find an action descriptor by its discriminant type across all scopes. */
export function findActionDescriptor(actionType: string): WorkflowActionDescriptor | null {
  for (const scope of listWorkflowScopes()) {
    const match = scope.actions.find((a) => a.type === actionType)
    if (match) return match
  }
  return null
}

/** TRUE if any action with this type is marked isGovernment. */
export function isGovernmentAction(actionType: string): boolean {
  return findActionDescriptor(actionType)?.isGovernment === true
}

/** Re-export for convenience (single import at the call site). */
export { freshId } from './freshId'
