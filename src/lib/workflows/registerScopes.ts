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
// TODO Phase B: import scope files for the remaining 11 modules:
//   - src/pages/survey/workflows/surveyWorkflowScope
//   - src/pages/tasks/workflows/tasksWorkflowScope
//   - src/pages/documents/workflows/documentsWorkflowScope
//   - src/pages/meetings/workflows/meetingsWorkflowScope
//   - src/pages/learning/workflows/learningWorkflowScope
//   - src/pages/registers/workflows/registersWorkflowScope
//   - src/pages/inspection/workflows/inspectionWorkflowScope
//   - src/pages/ros/workflows/rosWorkflowScope
//   - src/pages/action-plan/workflows/actionPlanWorkflowScope
//   - src/pages/vernerunder/workflows/vernerunderWorkflowScope
//   - src/pages/internal-control/workflows/internalControlWorkflowScope
//   - src/lib/workflows/gov/govWorkflowScope (cross-cutting)
//
// Each new scope file ALSO adds its line above. The startup assertion
// below flags missing registrations in dev so this list stays honest.

if (import.meta.env?.DEV) {
  // Defer until microtask so module-init side effects have a chance to fire.
  queueMicrotask(() => {
    const registered = new Set(listWorkflowScopes().map((s) => s.scopeId))
    const expected = WORKFLOW_SOURCE_MODULES.map((m) => m.value)
    const missing = expected.filter(
      (m) =>
        !registered.has(m) &&
        // Excluded from the assertion until their scope files land:
        ![
          'survey',
          'tasks',
          'documents',
          'meetings',
          'learning',
          'registers',
          'inspection',
          'ros',
          'action_plan',
          'internal_control',
          'vernerunder',
          'workplace_reporting',
          'org_health',
          'hse',
          'wiki_published',
          'gov',
        ].includes(m),
    )
    if (missing.length > 0) {
      console.warn(
        '[workflows] Missing scope registrations:',
        missing.join(', '),
        '— add the import to src/lib/workflows/registerScopes.ts.',
      )
    }
  })
}
