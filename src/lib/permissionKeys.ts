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
  /** AMU / arbeidsmiljøutvalg — full redigering av møter, agenda og vedtak */
  'amu.manage',
  /** AMU — signere referat og årsrapport (møteleder / nestleder) */
  'amu.chair',
  /** Organisasjonsundersøkelser (QPSNordic/ARK, AMU, tiltak) */
  'module.view.survey',
  'module.view.inspection',
  'module.view.internal_control',
  /** Redigere IK-tabeller (lovregister, roller, kompetanse, mål, tiltak) */
  'internkontroll.manage',
  /** Alias for internkontroll.manage (årsgjennomgang / IK-oppfølging) */
  'ik.manage',
  /** Redigere vernerunder (dette modulære grensesnittet) */
  'vernerunder.manage',
  /** Redigere ROS (risikovurderinger) */
  'ros.manage',
  /** Redigere SJA (sikker jobbanalyse) */
  'sja.manage',
  /** Redigere inspeksjonsmodul (maler, lokasjoner, runder) */
  'inspection.manage',
  /** Redigere tiltaksplan, kategorier og arbeidsflyt (IK) */
  'action_plan.manage',
  /** AMU-valg — administrere valg, kandidater og stemmeberettigede */
  'amu_election.manage',
  /** Konfigurere/kjøre organisasjonsundersøkelser (ny modul) */
  'survey.manage',
  /** Varslingsmottak — full innsyn i whistleblowing_cases (AML kap. 2A) */
  'whistleblowing.committee',
  'module.view.tasks',
  'module.view.learning',
  /** Cross-module reporting & compliance exports */
  'module.view.reports',
  /** Edit ARP snapshots and other report-admin surfaces (matches DB `reports.manage`) */
  'reports.manage',
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
  /** Documents & wiki — opprette og redigere sider (ikke malbibliotek-admin) */
  'documents.edit',
  /** Documents & wiki — lese mapper og sider (ikke redigere eller publisere) */
  'documents.view',
  'module.view.admin',

  // ─── Employee data ────────────────────────────────────────────────────────
  /** Se kontaktinfo (e-post, telefon, startdato) for andre ansatte enn seg selv */
  'employee.pii.read',
  /** Se sensitiv ansattinfo (ansettelsestype, lønnsband, kontraktsdetaljer) */
  'employee.sensitive.read',
  /** Opprette/oppdatere/deaktivere ansattoppføringer */
  'employee.manage',

  // ─── Sick leave ───────────────────────────────────────────────────────────
  /** Se sykefravær for egne direkte rapporterende (aggregat for VO) */
  'sick_leave.view',
  /** Opprette/oppdatere/slette sykefraværssaker */
  'sick_leave.manage',

  // ─── Incidents ────────────────────────────────────────────────────────────
  /** Se hendelser scoped etter involvering */
  'incident.view',
  /** Opprette/oppdatere/lukke hendelser og tildele saksbehandler */
  'incident.manage',

  // ─── HR discussions ───────────────────────────────────────────────────────
  /** Se møter der du er deltaker (§ 15-1 drøftelsessamtaler) */
  'hr.discussion.view',
  /** Se alle møter i organisasjonen (HR-direktør-tilgang) */
  'hr.discussion.admin',

  // ─── Whistleblowing ───────────────────────────────────────────────────────
  /** Se saksliste (status, ingen detaljer) – komité-lite */
  'whistleblowing.view',
  /** Tildele/omfordele saksbehandlere */
  'whistleblowing.assign',

  // ─── Survey ───────────────────────────────────────────────────────────────
  /** Se undersøkelsesresultater (gated av k-anonymitet) */
  'survey.results.view',
  /** Last ned rådata/aggregerte undersøkelsesdata */
  'survey.results.export',

  // ─── Organisation ─────────────────────────────────────────────────────────
  /** Eksporter ansatt/org-data (GDPR Art. 20 forespørsler) */
  'org.export',
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
  'amu.manage': 'AMU — redigere møter og protokoll',
  'amu.chair': 'AMU — signere referat og årsrapport',
  'module.view.survey': 'Organisasjonsundersøkelse',
  'module.view.inspection': 'Inspeksjonsmodul',
  'module.view.internal_control': 'Internkontroll',
  'internkontroll.manage': 'Internkontroll — redigere data',
  'ik.manage': 'Internkontroll — redigere data (alias)',
  'vernerunder.manage': 'Vernerunder — opprette og følge opp runder',
  'ros.manage': 'ROS — redigere risikovurderinger',
  'sja.manage': 'SJA — redigere analyser og maler',
  'inspection.manage': 'Inspeksjonsmodul — redigere runder og innstillinger',
  'action_plan.manage': 'Tiltaksplan — kategorier og arbeidsflyt',
  'amu_election.manage': 'AMU-valg — administrasjon',
  'survey.manage': 'Undersøkelse — administrasjon',
  'whistleblowing.committee': 'Varslingsmottak',
  'module.view.tasks': 'Tasks',
  'module.view.learning': 'E-learning',
  'module.view.reports': 'Rapporter',
  'reports.manage': 'Rapporter — administrasjon',
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
  'documents.manage': 'Documents & wiki — administrere maler og mapper',
  'documents.edit': 'Documents & wiki — redigere og publisere dokumenter',
  'documents.view': 'Documents & wiki — lese innhold (visning)',
  'module.view.admin': 'Admin (brukere & roller)',
  'employee.pii.read': 'Ansatte — lese kontaktopplysninger (e-post, telefon)',
  'employee.sensitive.read': 'Ansatte — lese sensitiv informasjon (ansettelsestype, kontrakt)',
  'employee.manage': 'Ansatte — administrere ansattoppføringer',
  'sick_leave.view': 'Sykefravær — innsyn for egne direkte rapporterende',
  'sick_leave.manage': 'Sykefravær — administrere alle saker',
  'incident.view': 'Hendelser — se hendelser (scoped etter involvering)',
  'incident.manage': 'Hendelser — administrere og lukke saker',
  'hr.discussion.view': 'HR — se egne drøftelsesmøter (§ 15-1)',
  'hr.discussion.admin': 'HR — full innsyn i alle drøftelsesmøter',
  'whistleblowing.view': 'Varsling — se saksstatus (ingen persondetaljer)',
  'whistleblowing.assign': 'Varsling — tildele saksbehandlere',
  'survey.results.view': 'Undersøkelse — se resultater (k-anonymitet)',
  'survey.results.export': 'Undersøkelse — eksportere data',
  'org.export': 'Organisasjon — eksportere ansatt- og org-data (GDPR Art. 20)',
}

/** Route prefix → permission (primary nav). Index route checked separately. */
export const ROUTE_PERMISSION: { pathPrefix: string; permission: PermissionKey }[] = [
  { pathPrefix: '/council/amu', permission: 'module.view.council' },
  { pathPrefix: '/council', permission: 'module.view.council' },
  { pathPrefix: '/members', permission: 'module.view.members' },
  { pathPrefix: '/org-health', permission: 'module.view.org_health' },
  { pathPrefix: '/hse', permission: 'module.view.hse' },
  { pathPrefix: '/sja', permission: 'module.view.hse' },
  { pathPrefix: '/ros', permission: 'module.view.hse' },
  { pathPrefix: '/tiltak', permission: 'module.view.hse' },
  { pathPrefix: '/survey', permission: 'module.view.survey' },
  { pathPrefix: '/inspection-module', permission: 'module.view.inspection' },
  { pathPrefix: '/vernerunder', permission: 'module.view.hse' },
  { pathPrefix: '/internal-control', permission: 'module.view.internal_control' },
  { pathPrefix: '/internkontroll', permission: 'module.view.internal_control' },
  { pathPrefix: '/modules/aarskontroll', permission: 'module.view.internal_control' },
  { pathPrefix: '/modules/ik-annual-review', permission: 'module.view.internal_control' },
  { pathPrefix: '/internkontroll/arsgjenomgang', permission: 'module.view.internal_control' },
  { pathPrefix: '/tasks', permission: 'module.view.tasks' },
  { pathPrefix: '/learning', permission: 'module.view.learning' },
  /** Same gate as workspace — report data is still scoped per org in RPCs */
  { pathPrefix: '/reports', permission: 'module.view.reports' },
  /** Hub gate: see ROUTE_PERMISSION_ANY (`workplace_reporting` ∪ `dashboard`) */
  { pathPrefix: '/workflow', permission: 'module.view.workflow' },
  { pathPrefix: '/hr', permission: 'module.view.hr_compliance' },
  { pathPrefix: '/organisation/admin', permission: 'module.view.admin' },
]

/** Paths that need any one of several permissions (e.g. hub + underlying module). */
export const ROUTE_PERMISSION_ANY: { pathPrefix: string; permissions: PermissionKey[] }[] = [
  {
    pathPrefix: '/workplace-reporting/incidents',
    permissions: ['module.view.workplace_reporting', 'module.view.hse'],
  },
  {
    pathPrefix: '/workplace-reporting/anonymous-aml',
    permissions: ['module.view.workplace_reporting', 'module.view.org_health'],
  },
  {
    pathPrefix: '/workplace-reporting',
    permissions: ['module.view.workplace_reporting', 'module.view.dashboard'],
  },
  {
    pathPrefix: '/compliance',
    permissions: [
      'module.view.internal_control',
      'module.view.hse',
      'module.view.org_health',
      'module.view.hr_compliance',
      'module.view.dashboard',
    ],
  },
]

export const DASHBOARD_PERMISSION: PermissionKey = 'module.view.dashboard'

/** App «home» routes: same gate as `/documents` — users with only document access must reach `/` and `/app`. */
export const WORKPLACE_HOME_PERMISSIONS: PermissionKey[] = [
  'module.view.dashboard',
  'documents.view',
  'documents.edit',
  'documents.manage',
]

export type RoutePermissionRequirement = PermissionKey | PermissionKey[]

export function permissionForPath(pathname: string): RoutePermissionRequirement {
  if (pathname === '/workspace/revisjonslogg') return DASHBOARD_PERMISSION
  if (pathname === '/' || pathname === '' || pathname === '/app') return WORKPLACE_HOME_PERMISSIONS
  if (pathname === '/profile') return DASHBOARD_PERMISSION
  const anyHit = ROUTE_PERMISSION_ANY.find(
    (r) => pathname === r.pathPrefix || pathname.startsWith(`${r.pathPrefix}/`),
  )
  if (anyHit) return anyHit.permissions
  const hit = ROUTE_PERMISSION.find((r) => pathname === r.pathPrefix || pathname.startsWith(`${r.pathPrefix}/`))
  return hit?.permission ?? DASHBOARD_PERMISSION
}
