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

// Administrasjon group — the admin scopes.
// "Organisasjon" is intentionally NOT a registered scope: its sidebar
// subs deep-link to the existing OrganisationPage tabs (real surface,
// no placeholder hop). The other four scopes register real or planned
// admin sections that live in the unified hub.
import '../../components/admin/settings/scopes/usersRolesSettingsScope'
import '../../components/admin/settings/scopes/integrationsSettingsScope'
import '../../components/admin/settings/scopes/workflowsSettingsScope'
import '../../components/admin/settings/scopes/systemSettingsScope'

// Module group — added as each module migrates.
import '../../../modules/compliance/settings/complianceSettingsScope'
import '../../../modules/tasks/settings/tasksSettingsScope'
import '../../components/documents/settings/documentsSettingsScope'
import '../../components/survey/settings/surveySettingsScope'
import '../../pages/learning/learningSettingsScope'
import '../../pages/registers/registersSettingsScope'
import '../../pages/meetings/meetingsSettingsScope'
