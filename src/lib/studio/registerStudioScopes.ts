// Studio Builder — side-effect import aggregator.
//
// Importing this file once causes every per-scope file to register its
// scope + kinds with studioRegistry. The studio shell imports this at
// module-load time. CLAUDE.md §"Things easy to get wrong" lists this as
// the #1 footgun for adding a new scope.
//
// Order is arbitrary — registry uses Maps; reads come after all imports
// have completed. Order only matters for the home-card sort (`order`
// field on each scope), not for registration.

import '../../../modules/compliance/studio/complianceStudioScope'
import '../../../modules/survey/studio/surveyStudioScope'
import '../../../modules/documents/studio/documentsStudioScope'
import '../../../modules/learning/studio/learningStudioScope'
import '../../../modules/meetings/studio/meetingsStudioScope'
import '../../../modules/registers/studio/registersStudioScope'
import '../../../modules/dashboards/studio/dashboardsStudioScope'
import '../../../modules/workflows/studio/workflowsStudioScope'

import { assertStudioScopesRegistered } from './studioRegistry'

// Re-run on every import; the assertion has an internal idempotent flag.
assertStudioScopesRegistered()
