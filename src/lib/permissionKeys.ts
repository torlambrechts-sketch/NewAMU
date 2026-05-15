/** Must match keys in DB role_permissions and RPC user_has_permission checks. */
export const PERMISSION_KEYS = [
  'users.invite',
  'users.manage',
  'roles.manage',
  'delegation.manage',
  'module.view.dashboard',
  /** Organisasjonsundersøkelser (QPSNordic/ARK, AMU, tiltak) */
  'module.view.survey',
  /** Redigere compliance-sjekklister (maler, utførelser, signering) — pack-agnostisk primitiv */
  'checklist.manage',
  /** Konfigurere/kjøre organisasjonsundersøkelser (ny modul) */
  'survey.manage',
  /** Varslingsmottak — full innsyn i whistleblowing_cases (AML kap. 2A). Legacy — use alerts.committee. */
  'whistleblowing.committee',
  /** Alerts (Varslinger) — top-level module view */
  'module.view.alerts',
  /** Alerts — manage system templates, categories, committee roster, retention overrides */
  'alerts.manage',
  /** Alerts — committee membership: read + write non-confidential cases */
  'alerts.committee',
  /** Alerts — confidential cases (seksuell trakassering, gjengjeldelse). Strict subset of committee. */
  'alerts.committee_confidential',
  /** Alerts — escalated cases (aml-varsel-mot-leder). Separate roster so the normal committee can't see leader-targeted varslinger. */
  'alerts.committee_escalated',
  /** Alerts — DPO role for GDPR-brudd handling + Art. 17 erasure path */
  'alerts.dpo',
  'module.view.tasks',
  'module.view.learning',
  /** Workflow automation — view rules & run log */
  'module.view.workflow',
  /** Legacy umbrella: configure workflow rules and compliance templates */
  'workflows.manage',
  /** Author + edit workflow rule definitions (no activation) */
  'workflows.compose',
  /** Toggle is_active on internal workflow rules */
  'workflows.activate',
  /** Toggle is_active on rules with government-reporting actions (Arbeidstilsynet/Datatilsynet/NAV/LDO/Altinn) */
  'workflows.activate_external',
  /** See body of restricted/confidential workflow runs (whistleblower, sick leave, …) */
  'workflows.view_confidential',
  /** Create/edit/publish courses; view org-wide learning progress in admin views */
  'learning.manage',
  /** Delete (or archive) courses; gated separately from create/edit so a senior admin can revoke without granting full edit */
  'learning.delete',
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

  // ─── Meetings (Møter) ─────────────────────────────────────────────────────
  /** Møter — lese møter, agenda, protokoll og vedtak */
  'module.view.meetings',
  /** Møter — opprette, redigere og signere møter, samt administrere maler */
  'meetings.manage',
  /** Møter — innsyn i konfidensielle / begrensede møter (drøftelsessamtaler, varslingsutvalg) */
  'meetings.manage_confidential',

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
  'module.view.survey': 'Organisasjonsundersøkelse',
  'checklist.manage': 'Compliance-sjekklister — opprette, besvare og signere',
  'survey.manage': 'Undersøkelse — administrasjon',
  'whistleblowing.committee': 'Varslingsmottak (legacy)',
  'module.view.alerts': 'Varslinger',
  'alerts.manage': 'Varslinger — administrasjon',
  'alerts.committee': 'Varslinger — utvalg (mottak)',
  'alerts.committee_confidential': 'Varslinger — konfidensielle saker',
  'alerts.committee_escalated': 'Varslinger — eskalert utvalg (mot leder)',
  'alerts.dpo': 'Varslinger — personvernombud (GDPR + Art. 17)',
  'module.view.tasks': 'Tasks',
  'module.view.learning': 'E-learning',
  'module.view.workflow': 'Arbeidsflyt',
  'workflows.manage': 'Arbeidsflyt — konfigurasjon (eldre nøkkel)',
  'workflows.compose': 'Arbeidsflyt — komponere regler',
  'workflows.activate': 'Arbeidsflyt — aktivere interne regler',
  'workflows.activate_external': 'Arbeidsflyt — aktivere statlige meldinger (Altinn/Arbeidstilsynet/Datatilsynet/NAV/LDO)',
  'workflows.view_confidential': 'Arbeidsflyt — se konfidensielle kjøringer (varsling, sykefravær)',
  'learning.manage': 'E-learning — opprette og redigere kurs',
  'learning.delete': 'E-learning — slette eller arkivere kurs',
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
  'module.view.meetings': 'Møter — lese møter, agenda og vedtak',
  'meetings.manage': 'Møter — administrere møter, agenda, protokoll og maler',
  'meetings.manage_confidential': 'Møter — innsyn i konfidensielle møter (drøfting, varsling)',
  'org.export': 'Organisasjon — eksportere ansatt- og org-data (GDPR Art. 20)',
}

/** Route prefix → permission (primary nav). Index route checked separately. */
export const ROUTE_PERMISSION: { pathPrefix: string; permission: PermissionKey }[] = [
  { pathPrefix: '/meetings', permission: 'module.view.meetings' },
  { pathPrefix: '/survey', permission: 'module.view.survey' },
  { pathPrefix: '/tasks', permission: 'module.view.tasks' },
  { pathPrefix: '/learning', permission: 'module.view.learning' },
  { pathPrefix: '/workflow', permission: 'module.view.workflow' },
  { pathPrefix: '/organisation/admin', permission: 'module.view.admin' },
]

/** Paths that need any one of several permissions (e.g. hub + underlying module). */
export const ROUTE_PERMISSION_ANY: { pathPrefix: string; permissions: PermissionKey[] }[] = [
  {
    pathPrefix: '/compliance',
    permissions: [
      'module.view.dashboard',
      'checklist.manage',
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
  if (pathname === '/' || pathname === '' || pathname === '/app') return WORKPLACE_HOME_PERMISSIONS
  if (pathname === '/profile') return DASHBOARD_PERMISSION
  const anyHit = ROUTE_PERMISSION_ANY.find(
    (r) => pathname === r.pathPrefix || pathname.startsWith(`${r.pathPrefix}/`),
  )
  if (anyHit) return anyHit.permissions
  const hit = ROUTE_PERMISSION.find((r) => pathname === r.pathPrefix || pathname.startsWith(`${r.pathPrefix}/`))
  return hit?.permission ?? DASHBOARD_PERMISSION
}
