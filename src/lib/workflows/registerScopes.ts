// Single-import side-effect aggregator for workflow scopes.
//
// Importing this module pulls in every scope file as a side effect so the
// registry is fully populated before any consumer (builder, library,
// dry-run, run history) reads it. App entry points do:
//
//   import './lib/workflows/registerScopes'
//
// Per CLAUDE.md's "easy to get wrong" list: a new scope without a side-
// effect import silently fails to register. The dev-mode assertion below
// catches that — it compares the keys of WORKFLOW_SOURCE_MODULES (the
// canonical list) against the registry and warns about any module that
// should be present but isn't.

import { WORKFLOW_SOURCE_MODULES } from '../../types/workflow'
import { listWorkflowScopes } from './workflowRegistry'

// Side-effect imports — one line per scope. New module owners add their
// scope file here. The order doesn't matter; registerWorkflowScope is
// idempotent.
import '../../pages/compliance/workflows/complianceWorkflowScope'
import '../../pages/survey/workflows/surveyWorkflowScope'
import '../../pages/tasks/workflows/tasksWorkflowScope'
import '../../pages/documents/workflows/documentsWorkflowScope'
import '../../pages/meetings/workflows/meetingsWorkflowScope'
import '../../pages/learning/workflows/learningWorkflowScope'
import '../../pages/registers/workflows/registersWorkflowScope'
import '../../pages/inspection/workflows/inspectionWorkflowScope'
import '../../pages/ros/workflows/rosWorkflowScope'
import '../../pages/action-plan/workflows/actionPlanWorkflowScope'
import '../../pages/vernerunder/workflows/vernerunderWorkflowScope'
import '../../pages/internal-control/workflows/internalControlWorkflowScope'
import './gov/govWorkflowScope'

if (import.meta.env?.DEV) {
  // Defer until microtask so module-init side effects have a chance to fire.
  queueMicrotask(() => {
    const registered = new Set(listWorkflowScopes().map((s) => s.scopeId))
    const expected = WORKFLOW_SOURCE_MODULES.map((m) => m.value)
    // Modules we deliberately don't model as a workflow scope yet:
    //   - hse: umbrella key, covered by inspection/ros/vernerunder
    //   - workplace_reporting / org_health / wiki_published: legacy aggregates
    const excluded = new Set(['hse', 'workplace_reporting', 'org_health', 'wiki_published'])
    const missing = expected.filter((m) => !registered.has(m) && !excluded.has(m))
    if (missing.length > 0) {
      console.warn(
        '[workflows] Missing scope registrations:',
        missing.join(', '),
        '— add the import to src/lib/workflows/registerScopes.ts.',
      )
    }
  })
}
