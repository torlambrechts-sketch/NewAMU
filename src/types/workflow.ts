/** Matches DB workflow_rules.condition_json */
export type WorkflowCondition =
  | { match: 'always' }
  | { match: 'array_any'; path: string; where: Record<string, unknown> }
  | { match: 'field_equals'; path: string; value: string }
  | { match: 'and'; conditions: WorkflowCondition[] }
  | { match: 'or'; conditions: WorkflowCondition[] }
  /** Eksakt én under-betingelse må være sann (for grenvis handlinger) */
  | { match: 'xor'; conditions: WorkflowCondition[] }

export type WorkflowActionCreateTask = {
  type: 'create_task'
  title: string
  description?: string
  assignee?: string
  ownerRole?: string
  dueInDays?: number
  module?: string
  sourceType?: string
  sourceLabel?: string
  requiresManagementSignOff?: boolean
}

/** Logges i workflow_runs — faktisk e-post krever server/Edge Function (se roadmap). */
export type WorkflowActionSendEmail = {
  type: 'send_email'
  fromAddress: string
  toAddress: string
  /** Comma-separated CC addresses. Optional. */
  ccAddress?: string
  subject: string
  body: string
  contentType?: 'text/plain' | 'text/html'
}

/** Logges som planlagt in-app / kategorisert varsel (klientvarsler bruker egne prefs). */
export type WorkflowActionSendNotification = {
  type: 'send_notification'
  title: string
  body: string
  category?: string
  channels?: string[]
}

/** Logges med URL — HTTP-kall krever server (ikke fra Postgres). */
export type WorkflowActionCallWebhook = {
  type: 'call_webhook'
  url: string
  method?: 'POST' | 'PUT' | 'GET'
  /** JSON-streng for ekstra headers, f.eks. {"Authorization":"Bearer …"} */
  headersJson?: string
  body?: string
}

/** Creates a deviation row in `public.deviations`. Only evaluated for source_module = 'inspection'. */
export type WorkflowActionCreateDeviation = {
  type: 'create_deviation'
  /** Optional title prefix — appended with " — inspeksjonsfunn". Defaults to round title. */
  titlePrefix?: string
  /** Days until due from trigger time. Default: 1. */
  dueInDays?: number
  /** Inherit assigned_to from the inspection round. Default: true. */
  assignFromRound?: boolean
}

export type WorkflowActionCreateTaskItem = {
  type: 'create_task_item'
  pack: string
  sourceCategory: string
  pdcaPhase: string
  title: string
  priority?: string
  dueInDays?: number
}

export type WorkflowActionCreateRosDraft = {
  type: 'create_ros_draft'
  template: string
  linkSource: boolean
}

export type WorkflowActionAddAmuAgendaItem = {
  type: 'add_amu_agenda_item'
  agendaItem: string
  priority: 'lav' | 'normal' | 'høy' | 'kritisk'
}

export type WorkflowActionRequestSignature = {
  type: 'request_signature'
  document: string
  deadlineDays: number
}

export type WorkflowActionWaitDelay = {
  type: 'wait_delay'
  amount: number
  unit: 'minutes' | 'hours' | 'days' | 'weeks'
}

/** Pause until a specific absolute time (cron-driven) or relative delay. */
export type WorkflowActionWaitUntil = {
  type: 'wait_until'
  /** ISO timestamp. Mutually exclusive with `delay`. */
  at?: string
  /** Relative offset from the queue insertion time. */
  delay?: { amount: number; unit: 'minutes' | 'hours' | 'days' | 'weeks' }
}

/** Pauses the queue row in workflow_approvals.awaiting_approval until decided. */
export type WorkflowActionRequestApproval = {
  type: 'request_approval'
  approverRole?: 'hms_leder' | 'amu_leder' | 'daglig_leder' | 'verneombud' | 'personvernombud'
  approverUserId?: string
  /** Sent in the approval notification body. */
  message?: string
  /** Auto-escalate to escalateToRole if not decided within this many hours. */
  escalateAfterHours?: number
  escalateToRole?: 'hms_leder' | 'amu_leder' | 'daglig_leder'
}

/** Branch executed when the previous action failed. */
export type WorkflowActionOnError = {
  type: 'on_error'
  actions: WorkflowAction[]
}

/** Run the contained actions in parallel; this rule's run completes when all branches complete. */
export type WorkflowActionParallel = {
  type: 'parallel'
  branches: { label?: string; actions: WorkflowAction[] }[]
}

/** Bump the approver / owner to a fallback role / user. */
export type WorkflowActionEscalate = {
  type: 'escalate'
  toRole?: 'hms_leder' | 'amu_leder' | 'daglig_leder'
  toUserId?: string
  note?: string
}

// ─── Government-reporting actions (Phase E, gated by workflows.activate_external)

/** Arbeidstilsynet — alvorlig skade-melding (AML § 5-2). 24h deadline. */
export type WorkflowActionArbeidstilsynetReport = {
  type: 'rapporter_alvorlig_skade_arbeidstilsynet'
  melderRolle: 'arbeidsgiver' | 'verneombud' | 'lege'
  /** Falls back to the org's registered orgnr when omitted. */
  arbeidsgiverOrgnr?: string
  hendelseDato?: string
  skadetype?: string
  personskadeKategori?: string
  fritekst?: string
  /** Pre-72h reminder cadence in hours before the 24h deadline. Defaults to [12, 4, 1]. */
  reminderHoursBeforeDeadline?: number[]
}

/** Datatilsynet — personvernbrudd (GDPR Art. 33). 72h from awareness. */
export type WorkflowActionDatatilsynetBreach = {
  type: 'meld_personvernbrudd_datatilsynet'
  awareAt?: string // ISO; defaults to event.created_at when omitted
  occurredAt?: string
  natureOfBreach?: string
  affectedCategories?: string[]
  approximateAffected?: number
  measuresTaken?: string
  /** Reminder cadence in hours before the 72h deadline. Defaults to [24, 4, 1]. */
  reminderHoursBeforeDeadline?: number[]
}

/** LDO — discrimination report. No API; generates evidence pack for manual submission. */
export type WorkflowActionLdoExport = {
  type: 'varsel_ldo_export'
  category?: string
  affectedRole?: string
  description?: string
}

/** NAV sykefraværsoppfølging via Altinn DSOP. */
export type WorkflowActionNavSykefravar = {
  type: 'nav_sykefravar_oppfolging'
  triggerWeek?: 4 | 8 | 12 | 26
  affectedUserId?: string
}

/** Generic Altinn 3 envelope — used by org-specific integrations. */
export type WorkflowActionAltinnSendMelding = {
  type: 'altinn_send_melding'
  tjeneste: string
  skjema: string
  recipientOrgnr?: string
  bodyJson?: string
  attachments?: { name: string; storagePath: string }[]
  /** TT02 sandbox vs prod (org-level override). */
  environment?: 'tt02' | 'prod'
}

export type WorkflowGovernmentAction =
  | WorkflowActionArbeidstilsynetReport
  | WorkflowActionDatatilsynetBreach
  | WorkflowActionLdoExport
  | WorkflowActionNavSykefravar
  | WorkflowActionAltinnSendMelding

export type WorkflowAction =
  | WorkflowActionCreateTask
  | WorkflowActionCreateTaskItem
  | WorkflowActionCreateDeviation
  | WorkflowActionCreateRosDraft
  | WorkflowActionAddAmuAgendaItem
  | WorkflowActionRequestSignature
  | WorkflowActionWaitDelay
  | WorkflowActionWaitUntil
  | WorkflowActionRequestApproval
  | WorkflowActionOnError
  | WorkflowActionParallel
  | WorkflowActionEscalate
  | WorkflowActionSendEmail
  | WorkflowActionSendNotification
  | WorkflowActionCallWebhook
  | WorkflowGovernmentAction
  | { type: 'log_only'; note?: string }

/** Action types that require workflows.activate_external + second approver. */
export const GOVERNMENT_ACTION_TYPES = [
  'rapporter_alvorlig_skade_arbeidstilsynet',
  'meld_personvernbrudd_datatilsynet',
  'varsel_ldo_export',
  'nav_sykefravar_oppfolging',
  'altinn_send_melding',
] as const

export function isGovernmentActionType(t: string): t is (typeof GOVERNMENT_ACTION_TYPES)[number] {
  return (GOVERNMENT_ACTION_TYPES as readonly string[]).includes(t)
}

/** actions_json når XOR-grener har hver sine handlinger */
export type WorkflowXorActionsEnvelope = {
  mode: 'xor_branches'
  branches: { actions: WorkflowAction[] }[]
}

export type WorkflowI18nText = { nb: string; en?: string }

export type WorkflowConfidentialityLevel = 'standard' | 'restricted' | 'confidential'

export type WorkflowTriggerType =
  | 'payload_change'
  | 'db_event'
  | 'schedule'
  | 'manual'
  | 'webhook_in'

export type WorkflowRuleRow = {
  id: string
  organization_id: string
  slug: string
  name: string
  description: string
  source_module: string
  trigger_on: 'insert' | 'update' | 'both'
  trigger_type?: WorkflowTriggerType
  trigger_event_name?: string | null
  schedule_cron?: string | null
  schedule_timezone?: string
  next_run_at?: string | null
  last_run_at?: string | null
  is_active: boolean
  condition_json: WorkflowCondition
  actions_json: WorkflowAction[] | WorkflowXorActionsEnvelope
  flow_graph_json?: Record<string, unknown> | null
  priority: number
  is_template: boolean
  // ─── Substrate fields (added in _20260905120100) ───────────────────────
  law_refs?: string[]
  frameworks?: string[]
  confidentiality_level?: WorkflowConfidentialityLevel
  name_i18n?: WorkflowI18nText | null
  description_i18n?: WorkflowI18nText | null
  idempotency_template?: string | null
  catalog_slug?: string | null
  catalog_version?: number
  last_reviewed_at?: string | null
  last_reviewed_by?: string | null
  next_review_due?: string | null
  // ──────────────────────────────────────────────────────────────────────
  /**
   * UX Run 2 — per-rule sandbox/prod toggle (migration _127600). Even when
   * the org has a production-active integration, a rule pinned to 'test'
   * dispatches to TT02 sandbox endpoints. Promotion to 'prod' requires an
   * explicit typed-confirmation in the canvas UI.
   */
  runtime_environment?: 'test' | 'prod'
  created_at: string
  updated_at: string
}

export type WorkflowRuleCatalogRow = {
  id: string
  slug: string
  scope_id: string
  name_i18n: WorkflowI18nText
  description_i18n: WorkflowI18nText | Record<string, never>
  source_module: string
  trigger_type: WorkflowTriggerType
  trigger_event_name: string | null
  schedule_cron: string | null
  trigger_on: 'insert' | 'update' | 'both'
  condition_json: WorkflowCondition
  actions_json: WorkflowAction[] | WorkflowXorActionsEnvelope
  flow_graph_json?: Record<string, unknown> | null
  steps_json: unknown[]
  law_refs: string[]
  frameworks: string[]
  pack: string | null
  cadence_hint: string | null
  recommended_for: string[]
  confidentiality_level: WorkflowConfidentialityLevel
  contains_gov_action: boolean
  idempotency_template: string | null
  catalog_version: number
  is_published: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type WorkflowRunRow = {
  id: string
  organization_id: string
  rule_id: string | null
  source_module: string
  event: string
  status: string
  detail: Record<string, unknown>
  // ─── Substrate fields (added in _20260905120400) ───────────────────────
  input_snapshot?: Record<string, unknown> | null
  output_snapshot?: Record<string, unknown> | null
  input_checksum?: string | null
  dry_run?: boolean
  actor_id?: string | null
  confidentiality_level?: WorkflowConfidentialityLevel
  sealed_at?: string | null
  // ──────────────────────────────────────────────────────────────────────
  created_at: string
}

export type WorkflowRunEvidenceRow = {
  id: string
  run_id: string
  rule_id: string | null
  organization_id: string
  artefact_kind:
    | 'regulator_receipt'
    | 'signed_manifest'
    | 'generated_pdf'
    | 'gov_submission_body'
    | 'evidence_pack'
    | 'screenshot'
    | 'attachment'
    | 'other'
  storage_path: string
  storage_bucket: string
  bytes_size: number | null
  mime_type: string | null
  sha256_checksum: string
  prev_checksum: string | null
  chain_root_checksum: string | null
  signed_at: string | null
  signed_by: string | null
  law_refs: string[]
  frameworks: string[]
  metadata: Record<string, unknown>
  created_at: string
}

export type WorkflowMissedFireTriageStatus =
  | 'open'
  | 'investigating'
  | 'resolved'
  | 'accepted_as_correct'

export type WorkflowMissedFireSeverity = 'low' | 'medium' | 'high' | 'critical'

export type WorkflowMissedFireLogRow = {
  id: string
  organization_id: string
  rule_id: string | null
  system_rule_slug: string | null
  event_id: string | null
  source_module: string | null
  event_name: string | null
  detected_at: string
  expected_fire_at: string | null
  reason: string
  severity: WorkflowMissedFireSeverity
  triage_status: WorkflowMissedFireTriageStatus
  triaged_by: string | null
  triaged_at: string | null
  triage_note: string | null
}

export type WorkflowDispatchEventRow = {
  id: string
  organization_id: string
  source_module: string
  event_name: string
  payload: Record<string, unknown>
  dispatched_at: string
  matched_count: number
}

export type WorkflowApprovalRow = {
  id: string
  organization_id: string
  rule_id: string
  run_id: string | null
  queue_id: string | null
  requested_at: string
  approver_role: string | null
  approver_user_id: string | null
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'
  decided_at: string | null
  decision_note: string | null
  escalate_after: string | null
  escalated_at: string | null
  escalated_to_role: string | null
  reminder_sent_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type WorkflowRuleRevisionRow = {
  id: string
  rule_id: string
  organization_id: string
  prev_name: string
  prev_description: string
  prev_is_active: boolean
  prev_condition: WorkflowCondition
  prev_actions: WorkflowAction[] | WorkflowXorActionsEnvelope
  prev_law_refs: string[]
  prev_frameworks: string[]
  prev_confidentiality_level: WorkflowConfidentialityLevel | null
  prev_catalog_slug: string | null
  prev_catalog_version: number | null
  changed_by: string | null
  changed_at: string
  change_reason: string | null
  diff_summary: string | null
}

export const WORKFLOW_SOURCE_MODULES = [
  { value: 'compliance_checklist', label: 'Sjekklister (compliance)' },
  { value: 'survey', label: 'Undersøkelser' },
  { value: 'documents', label: 'Dokumenter' },
  { value: 'meetings', label: 'Møter (AMU, vernerunder, MUS, …)' },
  { value: 'tasks', label: 'Oppgaver' },
  { value: 'learning', label: 'E-læring (kurs, sertifikater)' },
  { value: 'registers', label: 'Registre (kjemikalier, maskiner, lovkrav, …)' },
  { value: 'inspection', label: 'Inspeksjon (legacy — DB-trigger)' },
  { value: 'ros', label: 'Risikovurdering (ROS)' },
  { value: 'action_plan', label: 'Handlingsplan / tiltak' },
  { value: 'vernerunder', label: 'Vernerunder' },
  { value: 'internkontroll', label: 'Internkontroll — årlig gjennomgang' },
  { value: 'wiki_published', label: 'Wiki — side publisert' },
  { value: 'gov', label: 'Statlig rapportering (Altinn, Arbeidstilsynet, Datatilsynet, NAV, LDO)' },
  { value: 'workflow', label: 'Workflow-motor (meta-events: ON_EVIDENCE_TAMPER_DETECTED, …)' },
] as const

export type WorkflowSourceModule = (typeof WORKFLOW_SOURCE_MODULES)[number]['value']
