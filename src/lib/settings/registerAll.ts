// Side-effect barrel for every settings scope.
//
// Each line below registers a scope into `settingsRegistry`. The shell
// (`AdminSettingsPage.tsx`) imports THIS file once, which in turn imports
// each scope file for its side effects. Skipping a side-effect import
// means the scope silently doesn't register — same trap called out in
// CLAUDE.md "Things that are easy to get wrong" for dashboards.
//
// Order doesn't matter at runtime (scopes are sorted by group + order in
// `listSettingsScopes`), but keep it human-readable by group.

// Organisasjon group
import '../../components/admin/settings/scopes/orgSettingsScope'

// Module group — added as each module migrates.
import '../../../modules/compliance/settings/complianceSettingsScope'
import '../../../modules/tasks/settings/tasksSettingsScope'
import '../../components/documents/settings/documentsSettingsScope'
import '../../components/survey/settings/surveySettingsScope'
import '../../pages/learning/learningSettingsScope'
import '../../pages/registers/registersSettingsScope'
import '../../pages/meetings/meetingsSettingsScope'
// import '../../pages/meetings/meetingsSettingsScope'
// import '../../../modules/compliance/settings/complianceSettingsScope'
// import '../../../modules/tasks/settings/tasksSettingsScope'
// import '../../../modules/survey/settings/surveySettingsScope'
// import '../../pages/learning/learningSettingsScope'

// System group
// import '../../components/admin/settings/scopes/systemSettingsScope'
