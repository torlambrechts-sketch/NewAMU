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
  /** Internkontroll — opprette/redigere registre (register_types) og register-innstillinger */
  'internkontroll.manage',
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

  // ─── Tilsynsbrev (Arbeidstilsynet/Datatilsynet inspeksjonsbrev) ──────────
  /** Last opp et tilsynsbrev (PDF) og kjør parser. */
  'tilsynsbrev.upload',
  /** Se konfidensielle tilsynsbrev (default-confidentiality = restricted). */
  'tilsynsbrev.view_confidential',

  // ─── Tasks confidentiality (tilsynsbrev spawns restricted/confidential tasks) ─
  /** Se konfidensielle oppgaver — speiles på workflow.view_confidential-mønsteret. */
  'tasks.view_confidential',

  // ─── Gov-outbox triage (manual_* rader i gov_notifications_outbox) ─────
  /** Triagér rader i gov_notifications_outbox som krever menneskelig behandling
   *  (manuelle innsendinger til Datatilsynet/Arbeidstilsynet/LDO). */
  'gov.outbox_triage',

  // ─── Integrations — cert rotation (NSM Grunnprinsipper 2.4) ─────────────
  /** Rotere virksomhetssertifikat for gov-integrasjoner (Altinn / RegInt /
   *  Datatilsynet / NAV). Gir tilgang til /admin/integrations/sertifikat-rotasjon
   *  + workflow_record_cert_rotation RPC. Seedet til admin-rollen kun. */
  'integrations.cert_rotate',

  // ─── Compliance Layer (Tier 2 — internal controls) ──────────────────────
  /** Kontroller-modulen — lese internkontroller, lovkrav-koblinger,
   *  bindinger og bevisjournal. Top-level NavGroup `/controls`. */
  'module.view.compliance_layer',
  /** Compliance Layer — opprette/endre kontroller, klausul-koblinger,
   *  bindinger og manuelle bevisrader. Systemkontroller forblir
   *  read-only via RLS uavhengig av denne nøkkelen. */
  'compliance_layer.manage',
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
  'internkontroll.manage': 'Internkontroll — administrere registre og innstillinger',
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
  'tilsynsbrev.upload': 'Tilsynsbrev — laste opp og parse inspeksjonsbrev',
  'tilsynsbrev.view_confidential': 'Tilsynsbrev — se konfidensielle saker',
  'tasks.view_confidential': 'Se konfidensielle oppgaver',
  'gov.outbox_triage': 'Triagér utgående statlige meldinger',
  'integrations.cert_rotate': 'Integrasjoner — rotere virksomhetssertifikat',
  'module.view.compliance_layer': 'Kontroller — lese internkontroller og bevisjournal',
  'compliance_layer.manage': 'Kontroller — administrere internkontroller, bindinger og koblinger',
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
    pathPrefix: '/controls',
    permissions: [
      'module.view.compliance_layer',
      'compliance_layer.manage',
      'module.view.dashboard',
    ],
  },
  {
    pathPrefix: '/compliance',
    permissions: [
      'module.view.dashboard',
      'checklist.manage',
    ],
  },
  // May 2026 menu restructure — these surfaces are chooser landings
  // that link to module-gated detail flates. The sidebar uses a wider
  // permAny; the route gate uses the same so a deep-link can't bypass
  // the nav-level gate.
  {
    pathPrefix: '/innboks',
    permissions: ['module.view.dashboard'],
  },
  {
    pathPrefix: '/mitt-arbeid',
    permissions: ['module.view.dashboard'],
  },
  {
    pathPrefix: '/bevisjournal',
    permissions: [
      'module.view.dashboard',
      'module.view.admin',
      'users.manage',
    ],
  },
  {
    pathPrefix: '/rammeverk',
    permissions: [
      'module.view.dashboard',
      'checklist.manage',
      'module.view.admin',
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
