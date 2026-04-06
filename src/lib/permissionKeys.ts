/** Must match keys in DB role_permissions and RPC user_has_permission checks. */
export const PERMISSION_KEYS = [
  'users.invite',
  'users.manage',
  'roles.manage',
  'delegation.manage',
  'module.view.dashboard',
  'module.view.council',
  'module.view.members',
  'module.view.org_health',
  'module.view.hse',
  'module.view.internal_control',
  'module.view.tasks',
  'module.view.learning',
  /** Cross-module reporting & compliance exports */
  'module.view.reports',
  /** Create/edit/publish courses; view org-wide learning progress in admin views */
  'learning.manage',
  /** Documents & wiki — folders, pages, compliance, template settings */
  'documents.manage',
  'module.view.admin',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'users.invite': 'Invitere brukere',
  'users.manage': 'Administrere brukere',
  'roles.manage': 'Administrere roller og tilganger',
  'delegation.manage': 'Delegere roller',
  'module.view.dashboard': 'Dashboard / prosjekt',
  'module.view.council': 'Council',
  'module.view.members': 'Members',
  'module.view.org_health': 'Org health',
  'module.view.hse': 'HSE',
  'module.view.internal_control': 'Internkontroll',
  'module.view.tasks': 'Tasks',
  'module.view.learning': 'E-learning',
  'module.view.reports': 'Rapporter',
  'learning.manage': 'E-learning — opprette og redigere kurs',
  'documents.manage': 'Documents & wiki — redigere innhold og maler',
  'module.view.admin': 'Admin (brukere & roller)',
}

/** Route prefix → permission (primary nav). Index route checked separately. */
export const ROUTE_PERMISSION: { pathPrefix: string; permission: PermissionKey }[] = [
  { pathPrefix: '/council', permission: 'module.view.council' },
  { pathPrefix: '/members', permission: 'module.view.members' },
  { pathPrefix: '/org-health', permission: 'module.view.org_health' },
  { pathPrefix: '/hse', permission: 'module.view.hse' },
  { pathPrefix: '/internal-control', permission: 'module.view.internal_control' },
  { pathPrefix: '/tasks', permission: 'module.view.tasks' },
  { pathPrefix: '/learning', permission: 'module.view.learning' },
  { pathPrefix: '/reports', permission: 'module.view.reports' },
  { pathPrefix: '/admin', permission: 'module.view.admin' },
]

export const DASHBOARD_PERMISSION: PermissionKey = 'module.view.dashboard'

export function permissionForPath(pathname: string): PermissionKey {
  if (pathname === '/' || pathname === '' || pathname === '/profile') return DASHBOARD_PERMISSION
  const hit = ROUTE_PERMISSION.find((r) => pathname === r.pathPrefix || pathname.startsWith(`${r.pathPrefix}/`))
  return hit?.permission ?? DASHBOARD_PERMISSION
}
