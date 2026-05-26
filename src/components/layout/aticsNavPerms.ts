// Permission-key gates for the sidebar nav groups. Centralised here so
// AticsShell.tsx no longer carries 150 lines of role definitions and so
// that any new module can be wired up by adding one entry rather than
// editing the shell file.
//
// Pattern: each module exports a "broad permAny" set covering both the
// power-user permissions (manage, etc.) and the view-only fallbacks
// (`module.view.dashboard`, `module.view.<module>`). Hiding the menu
// from view-only roles would be a confusing inconsistency since they
// can still reach the page itself.

import type { PermissionKey } from '../../lib/permissionKeys'

export const ADMINISTRASJON_NAV_PERMS: PermissionKey[] = [
  'module.view.admin',
  'users.manage',
  'users.invite',
  'roles.manage',
  'employee.manage',
  'workflows.manage',
  'module.view.workflow',
]

export const COMPLIANCE_NAV_PERMS: PermissionKey[] = [
  'module.view.dashboard',
  'checklist.manage',
]

export const SURVEY_NAV_PERMS: PermissionKey[] = [
  'module.view.survey',
  'module.view.dashboard',
  'survey.manage',
  'survey.results.view',
]

export const LEARNING_NAV_PERMS: PermissionKey[] = [
  'module.view.learning',
  'module.view.dashboard',
  'learning.manage',
  'learning.delete',
]

export const TASKS_NAV_PERMS: PermissionKey[] = [
  'module.view.tasks',
  'module.view.dashboard',
]

export const DOCUMENTS_NAV_PERMS: PermissionKey[] = [
  'documents.view',
  'documents.edit',
  'documents.manage',
  'module.view.dashboard',
]

export const REGISTERS_NAV_PERMS: PermissionKey[] = [
  'module.view.dashboard',
  'internkontroll.manage',
]

export const MEETINGS_NAV_PERMS: PermissionKey[] = [
  'module.view.meetings',
  'meetings.manage',
  'module.view.dashboard',
]

export const ALERTS_NAV_PERMS: PermissionKey[] = [
  'module.view.alerts',
  'alerts.committee',
  'alerts.committee_confidential',
  'alerts.committee_escalated',
  'alerts.dpo',
  'alerts.manage',
  'module.view.dashboard',
]

// Aggregate dashboard reads — compliance findings, tasks (avvik etc.),
// deviations, alerts. Any role that can see those modules gets the
// risk view; admins use module-level `is_active` to disable.
export const RISK_NAV_PERMS: PermissionKey[] = [
  'module.view.dashboard',
  'checklist.manage',
  'incident.view',
  'incident.manage',
  'module.view.tasks',
]
