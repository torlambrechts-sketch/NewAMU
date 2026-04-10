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
  /** Varslingsmottak — full innsyn i whistleblowing_cases (AML kap. 2A) */
  'whistleblowing.committee',
  'module.view.tasks',
  'module.view.learning',
  /** Cross-module reporting & compliance exports */
  'module.view.reports',
  /** Arbeidsplassrapportering — hub for workplace / HSE reporting entry points */
  'module.view.workplace_reporting',
  /** Workflow automation — view rules & run log */
  'module.view.workflow',
  /** Configure workflow rules and compliance templates */
  'workflows.manage',
  /** HR compliance hub (AML § 15-1, kap. 8, O-ROS overview) */
  'module.view.hr_compliance',
  'hr.discussion.manage',
  'hr.consultation.manage',
  'hr.o_ros.manage',
  'hr.o_ros.view',
  'hr.o_ros.sign',
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
  'whistleblowing.committee': 'Varslingsmottak',
  'module.view.tasks': 'Tasks',
  'module.view.learning': 'E-learning',
  'module.view.reports': 'Rapporter',
  'module.view.workplace_reporting': 'Arbeidsplassrapportering',
  'module.view.workflow': 'Arbeidsflyt',
  'workflows.manage': 'Arbeidsflyt — konfigurasjon',
  'module.view.hr_compliance': 'HR & rettssikkerhet',
  'hr.discussion.manage': 'HR — drøftelsessamtaler (§ 15-1)',
  'hr.consultation.manage': 'HR — informasjon/drøfting (kap. 8)',
  'hr.o_ros.manage': 'HR — O-ROS administrasjon',
  'hr.o_ros.view': 'HR — O-ROS innsyn',
  'hr.o_ros.sign': 'HR — O-ROS signatur (AMU/VO)',
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
  /** Same gate as workspace — report data is still scoped per org in RPCs */
  { pathPrefix: '/reports', permission: 'module.view.dashboard' },
  { pathPrefix: '/workplace-reporting', permission: 'module.view.workplace_reporting' },
  { pathPrefix: '/workflow', permission: 'module.view.workflow' },
  { pathPrefix: '/hr', permission: 'module.view.hr_compliance' },
  { pathPrefix: '/admin', permission: 'module.view.admin' },
]

/** Paths that need any one of several permissions (e.g. hub + underlying module). */
export const ROUTE_PERMISSION_ANY: { pathPrefix: string; permissions: PermissionKey[] }[] = [
  {
    pathPrefix: '/workplace-reporting/incidents',
    permissions: ['module.view.workplace_reporting', 'module.view.hse'],
  },
  {
    pathPrefix: '/compliance',
    permissions: [
      'module.view.internal_control',
      'module.view.hse',
      'module.view.org_health',
      'module.view.hr_compliance',
    ],
  },
]

export const DASHBOARD_PERMISSION: PermissionKey = 'module.view.dashboard'

export type RoutePermissionRequirement = PermissionKey | PermissionKey[]

export function permissionForPath(pathname: string): RoutePermissionRequirement {
  if (pathname === '/workspace/revisjonslogg') return DASHBOARD_PERMISSION
  if (pathname === '/' || pathname === '' || pathname === '/profile') return DASHBOARD_PERMISSION
  const anyHit = ROUTE_PERMISSION_ANY.find(
    (r) => pathname === r.pathPrefix || pathname.startsWith(`${r.pathPrefix}/`),
  )
  if (anyHit) return anyHit.permissions
  const hit = ROUTE_PERMISSION.find((r) => pathname === r.pathPrefix || pathname.startsWith(`${r.pathPrefix}/`))
  return hit?.permission ?? DASHBOARD_PERMISSION
}
