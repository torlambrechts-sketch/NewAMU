// Alerts (Varslinger) module — row types + zod parsers.
//
// Unifies AML kap. 2A varsling + GDPR Art. 33 brudd + HMS-avvik +
// sikkerhets-hendelser + etiske bekymringer as a single template-driven
// engine. Replaces legacy whistleblowing_cases + gdpr_breach_incidents.
//
// Every row type ships with a forgiving `parseXxxRow(raw)` so the loader
// tolerates partial schema drift without crashing.

import { z } from 'zod'

// ── Enums ─────────────────────────────────────────────────────────────────

export const ALERT_KIND_VALUES = [
  'whistleblowing',
  'gdpr_breach',
  'hms_incident',
  'security_incident',
  'ethical_concern',
] as const
export type AlertKind = (typeof ALERT_KIND_VALUES)[number]

export const ALERT_STATUS_VALUES = [
  'received',
  'triage',
  'investigation',
  'internal_review',
  'closed',
  'dismissed',
  // v1.1 additions
  'assigned',
  'under_investigation',
  'awaiting_reporter_response',
  'on_hold',
  'decision',
  'rejected',
  'escalated',
  'reopened',
  'withdrawn',
] as const
export type AlertStatus = (typeof ALERT_STATUS_VALUES)[number]

// v1.1 — anonymity mode (replaces is_anonymous boolean as the modelling primitive).
export const ALERT_ANONYMITY_MODE_VALUES = [
  'fully_anonymous',
  'pseudonymous',
  'confidential',
  'open',
] as const
export type AlertAnonymityMode = (typeof ALERT_ANONYMITY_MODE_VALUES)[number]

export const ALERT_CONFIDENTIALITY_VALUES = ['standard', 'restricted', 'confidential'] as const
export type AlertConfidentialityLevel = (typeof ALERT_CONFIDENTIALITY_VALUES)[number]

export const ALERT_SEVERITY_VALUES = ['low', 'medium', 'high', 'critical'] as const
export type AlertSeverity = (typeof ALERT_SEVERITY_VALUES)[number]

export const ALERT_SOURCE_KIND_VALUES = ['system', 'org'] as const
export type AlertSourceKind = (typeof ALERT_SOURCE_KIND_VALUES)[number]

export const ALERT_BREACH_TYPE_VALUES = [
  'confidentiality',
  'integrity',
  'availability',
  'combined',
] as const
export type AlertBreachType = (typeof ALERT_BREACH_TYPE_VALUES)[number]

export const ALERT_CLOSING_OUTCOME_VALUES = [
  'substantiated',
  'unsubstantiated',
  'inconclusive',
  'referred',
] as const
export type AlertClosingOutcome = (typeof ALERT_CLOSING_OUTCOME_VALUES)[number]

export const ALERT_NOTE_KIND_VALUES = [
  'internal',
  'communication_to_reporter',
  'communication_from_reporter',
  'system',
] as const
export type AlertNoteKind = (typeof ALERT_NOTE_KIND_VALUES)[number]

export const ALERT_TIMELINE_EVENT_VALUES = [
  'submitted',
  'acknowledged',
  'assigned',
  'escalated',
  'status_changed',
  'severity_set',
  'attachment_added',
  'note_added_public',
  'note_added_internal',
  'closed',
  'reopened',
  'retention_purged',
  'erased',
] as const
export type AlertTimelineEventKind = (typeof ALERT_TIMELINE_EVENT_VALUES)[number]

export const ALERT_PII_HINT_VALUES = ['low', 'medium', 'high'] as const
export type AlertPiiHint = (typeof ALERT_PII_HINT_VALUES)[number]

// ── Template definition jsonb shape ───────────────────────────────────────

export type AlertPublicFormField = {
  key: string
  label: string
  kind: 'text' | 'longtext' | 'select' | 'date_text' | 'attachment'
  required: boolean
  options?: string[]
  helpText?: string
  piiHint?: AlertPiiHint
}

export type AlertCommitteeChecklistItem = {
  key: string
  label: string
  isMandatory: boolean
  lawRef?: string
}

export type AlertWorkflowStage = {
  status: AlertStatus
  slaHours?: number
  requiresRoles?: Array<'committee' | 'dpo' | 'verneombud' | 'tillitsvalgt'>
}

export type AlertEscalation = {
  onAcknowledgementOverdue?: { action: 'notify_committee' | 'notify_dpo' | 'notify_management' }
  onInvestigationOverdue?: { action: 'notify_committee' | 'notify_dpo' | 'notify_management' }
}

export type AlertExternalReporting = {
  target: 'datatilsynet' | 'arbeidstilsynet'
  deadlineHours: number
  lawRef?: string
} | null

export type AlertRetaliationProtection = {
  enabled: boolean
  lawRefs?: string[]
} | null

export type AlertTemplateDefinition = {
  preparationGuidance?: string
  publicFormFields?: AlertPublicFormField[]
  defaultCategorySlug?: string
  defaultSeverity?: AlertSeverity
  committeeChecklistItems?: AlertCommitteeChecklistItem[]
  workflowStages?: AlertWorkflowStage[]
  escalation?: AlertEscalation
  externalReporting?: AlertExternalReporting
  retaliationProtection?: AlertRetaliationProtection
}

// ── Metadata schema (shared with compliance / meetings / documents) ───────

export type AlertMetadataFieldKind =
  | 'location'
  | 'department'
  | 'team'
  | 'text'
  | 'longtext'
  | 'number'
  | 'select'
  | 'date'
  | 'severity'
  | 'breach_type'
  | 'affected_categories'
  | 'boolean'

export type AlertMetadataField = {
  key: string
  kind: AlertMetadataFieldKind
  label?: string
  help?: string
  required?: boolean
  options?: Array<{ id: string; label: string } | string>
}

export type AlertMetadataSchema = {
  fields: AlertMetadataField[]
}

// ── Row types ─────────────────────────────────────────────────────────────

export type AlertSystemTemplateRow = {
  id: string
  slug: string
  label: string
  description: string | null
  kind: AlertKind
  frameworks: string[]
  law_refs: string[]
  default_category_slug: string | null
  default_confidentiality_level: AlertConfidentialityLevel
  default_retention_years: number
  acknowledgement_due_days: number
  investigation_due_days: number | null
  requires_dpo: boolean
  allows_anonymous: boolean
  definition: AlertTemplateDefinition
  metadata_schema: AlertMetadataSchema
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type AlertCategoryRow = {
  id: string
  organization_id: string
  slug: string
  name: string
  description: string | null
  position: number
  is_active: boolean
  is_system: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type AlertOrgTemplateSettingRow = {
  organization_id: string
  system_template_id: string
  enabled: boolean
  nav_pinned: boolean
  position: number
  category_id: string | null
  override_name: string | null
  override_description: string | null
  override_definition: AlertTemplateDefinition | null
  override_metadata_schema: AlertMetadataSchema | null
  override_retention_years: number | null
  created_at: string
  updated_at: string
}

export type AlertOrgTemplateRow = {
  id: string
  organization_id: string
  slug: string
  name: string
  description: string | null
  kind: AlertKind
  category_id: string | null
  frameworks: string[]
  law_refs: string[]
  default_confidentiality_level: AlertConfidentialityLevel
  default_retention_years: number
  acknowledgement_due_days: number
  investigation_due_days: number | null
  requires_dpo: boolean
  allows_anonymous: boolean
  definition: AlertTemplateDefinition
  metadata_schema: AlertMetadataSchema
  nav_pinned: boolean
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type AlertCaseRow = {
  id: string
  organization_id: string
  access_key: string
  kind: AlertKind
  source_kind: AlertSourceKind
  system_template_id: string | null
  org_template_id: string | null
  title: string
  description: string
  category: string | null
  category_id: string | null
  occurred_at_text: string | null
  is_anonymous: boolean
  /** v1.1 — anonymity mode (canonical). Derived from is_anonymous for legacy rows. */
  anonymity_mode: AlertAnonymityMode
  reporter_contact: string | null
  reporter_user_id: string | null
  reporter_display_name: string | null
  /** v1.1 — encrypted reporter identity blob (postgrest returns as \\x-hex). */
  reporter_identifier_encrypted: string | null
  reporter_identifier_key_version: number | null
  /** v1.1 — HMAC of reporter email for lookup without storing the email. */
  reporter_email_for_notification_hashed: string | null
  /** v1.1 — encrypted free-text fields (postgrest \\x-hex). */
  title_encrypted: string | null
  title_key_version: number | null
  description_encrypted: string | null
  description_key_version: number | null
  /** v1.1 — case linking. */
  parent_case_id: string | null
  /** v1.1 — snooze. */
  snoozed_until: string | null
  snooze_reason: string | null
  /** v1.1 — intake form version snapshot. */
  intake_form_version_id: string | null
  location_id: string | null
  department_id: string | null
  team_id: string | null
  assigned_committee_member_ids: string[]
  metadata: Record<string, unknown>
  status: AlertStatus
  confidentiality_level: AlertConfidentialityLevel
  severity: AlertSeverity | null
  received_at: string
  acknowledgement_due_at: string
  investigation_due_at: string | null
  acknowledged_at: string | null
  closed_at: string | null
  closing_summary: string | null
  closing_outcome: AlertClosingOutcome | null
  breach_type: AlertBreachType | null
  affected_categories: string[] | null
  affected_subjects_estimate: number | null
  affected_subjects_actual: number | null
  risk_assessment: string | null
  mitigation_actions: string | null
  datatilsynet_reported_at: string | null
  datatilsynet_reference: string | null
  data_subjects_notified_at: string | null
  retention_until: string | null
  redacted_at: string | null
  definition_snapshot: AlertTemplateDefinition | null
  metadata_schema_snapshot: AlertMetadataSchema | null
  submission_user_agent: string | null
  submission_locale: string | null
  created_at: string
  updated_at: string
}

export type AlertCaseNoteRow = {
  id: string
  case_id: string
  organization_id: string
  author_id: string | null
  body: string
  note_kind: AlertNoteKind
  visible_to_reporter: boolean
  created_at: string
}

export type AlertCaseAttachmentRow = {
  id: string
  case_id: string
  organization_id: string
  storage_bucket: string
  storage_path: string | null
  uploaded_by_user_id: string | null
  filename: string
  content_type: string | null
  size_bytes: number | null
  sha256_hex: string | null
  is_redacted: boolean
  created_at: string
}

export type AlertCaseTimelineEventRow = {
  id: string
  case_id: string
  organization_id: string
  event_kind: AlertTimelineEventKind
  actor_kind: 'reporter' | 'committee' | 'system' | null
  actor_user_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

/** Anonymity tier derived from is_anonymous + reporter_user_id + reporter_contact. */
export type AlertAnonymityTier =
  | 'full_anonymous'
  | 'pseudonymous'
  | 'identified_public'
  | 'identified_auth'

export function deriveAnonymityTier(c: Pick<AlertCaseRow, 'is_anonymous' | 'reporter_contact' | 'reporter_user_id'>): AlertAnonymityTier {
  if (c.reporter_user_id) return 'identified_auth'
  if (!c.is_anonymous) return 'identified_public'
  if (c.reporter_contact) return 'pseudonymous'
  return 'full_anonymous'
}

// ── Zod parsers ───────────────────────────────────────────────────────────

const lenientString = z.union([z.string(), z.null(), z.undefined()]).transform((v) => v ?? null)
const lenientStringArray = z
  .union([z.array(z.string()), z.null(), z.undefined()])
  .transform((v) => v ?? [])

const PublicFormFieldSchema: z.ZodType<AlertPublicFormField> = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(['text', 'longtext', 'select', 'date_text', 'attachment']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  helpText: z.string().optional(),
  piiHint: z.enum(ALERT_PII_HINT_VALUES).optional(),
})

const CommitteeChecklistItemSchema: z.ZodType<AlertCommitteeChecklistItem> = z.object({
  key: z.string(),
  label: z.string(),
  isMandatory: z.boolean(),
  lawRef: z.string().optional(),
})

const WorkflowStageSchema: z.ZodType<AlertWorkflowStage> = z.object({
  status: z.enum(ALERT_STATUS_VALUES),
  slaHours: z.number().optional(),
  requiresRoles: z.array(z.enum(['committee', 'dpo', 'verneombud', 'tillitsvalgt'])).optional(),
})

const DefinitionSchema: z.ZodType<AlertTemplateDefinition> = z
  .object({
    preparationGuidance: z.string().optional(),
    publicFormFields: z.array(PublicFormFieldSchema).optional(),
    defaultCategorySlug: z.string().optional(),
    defaultSeverity: z.enum(ALERT_SEVERITY_VALUES).optional(),
    committeeChecklistItems: z.array(CommitteeChecklistItemSchema).optional(),
    workflowStages: z.array(WorkflowStageSchema).optional(),
    escalation: z
      .object({
        onAcknowledgementOverdue: z.object({ action: z.enum(['notify_committee', 'notify_dpo', 'notify_management']) }).optional(),
        onInvestigationOverdue: z.object({ action: z.enum(['notify_committee', 'notify_dpo', 'notify_management']) }).optional(),
      })
      .optional(),
    externalReporting: z
      .union([
        z.object({
          target: z.enum(['datatilsynet', 'arbeidstilsynet']),
          deadlineHours: z.number(),
          lawRef: z.string().optional(),
        }),
        z.null(),
      ])
      .optional(),
    retaliationProtection: z
      .union([
        z.object({ enabled: z.boolean(), lawRefs: z.array(z.string()).optional() }),
        z.null(),
      ])
      .optional(),
  })
  .passthrough()

const MetadataFieldSchema: z.ZodType<AlertMetadataField> = z.object({
  key: z.string(),
  kind: z.enum([
    'location', 'department', 'team', 'text', 'longtext', 'number', 'select',
    'date', 'severity', 'breach_type', 'affected_categories', 'boolean',
  ]),
  label: z.string().optional(),
  help: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.union([z.string(), z.object({ id: z.string(), label: z.string() })])).optional(),
})

const MetadataSchemaSchema: z.ZodType<AlertMetadataSchema> = z
  .object({ fields: z.array(MetadataFieldSchema) })
  .catch({ fields: [] })

export function parseTemplateDefinition(raw: unknown): AlertTemplateDefinition {
  const r = DefinitionSchema.safeParse(raw)
  return r.success ? r.data : {}
}

export function parseMetadataSchema(raw: unknown): AlertMetadataSchema {
  const r = MetadataSchemaSchema.safeParse(raw)
  return r.success ? r.data : { fields: [] }
}

const SystemTemplateSchema = z.object({
  id: z.string(),
  slug: z.string(),
  label: z.string(),
  description: lenientString,
  kind: z.enum(ALERT_KIND_VALUES),
  frameworks: lenientStringArray,
  law_refs: lenientStringArray,
  default_category_slug: lenientString,
  default_confidentiality_level: z.enum(ALERT_CONFIDENTIALITY_VALUES).catch('restricted'),
  default_retention_years: z.number().catch(5),
  acknowledgement_due_days: z.number().catch(7),
  investigation_due_days: z.number().nullable().catch(null),
  requires_dpo: z.boolean().catch(false),
  allows_anonymous: z.boolean().catch(true),
  definition: z.unknown().transform(parseTemplateDefinition),
  metadata_schema: z.unknown().transform(parseMetadataSchema),
  is_active: z.boolean().catch(true),
  sort_order: z.number().catch(100),
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseSystemTemplateRow(raw: unknown): AlertSystemTemplateRow | null {
  const r = SystemTemplateSchema.safeParse(raw)
  return r.success ? (r.data as AlertSystemTemplateRow) : null
}

const CategorySchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: lenientString,
  position: z.number().catch(100),
  is_active: z.boolean().catch(true),
  is_system: z.boolean().catch(false),
  deleted_at: lenientString,
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseCategoryRow(raw: unknown): AlertCategoryRow | null {
  const r = CategorySchema.safeParse(raw)
  return r.success ? (r.data as AlertCategoryRow) : null
}

const OrgTemplateSettingSchema = z.object({
  organization_id: z.string(),
  system_template_id: z.string(),
  enabled: z.boolean().catch(true),
  nav_pinned: z.boolean().catch(false),
  position: z.number().catch(100),
  category_id: lenientString,
  override_name: lenientString,
  override_description: lenientString,
  override_definition: z.unknown().nullable().transform((v) => (v == null ? null : parseTemplateDefinition(v))),
  override_metadata_schema: z.unknown().nullable().transform((v) => (v == null ? null : parseMetadataSchema(v))),
  override_retention_years: z.number().nullable().catch(null),
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseOrgTemplateSettingRow(raw: unknown): AlertOrgTemplateSettingRow | null {
  const r = OrgTemplateSettingSchema.safeParse(raw)
  return r.success ? (r.data as AlertOrgTemplateSettingRow) : null
}

const OrgTemplateSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: lenientString,
  kind: z.enum(ALERT_KIND_VALUES),
  category_id: lenientString,
  frameworks: lenientStringArray,
  law_refs: lenientStringArray,
  default_confidentiality_level: z.enum(ALERT_CONFIDENTIALITY_VALUES).catch('restricted'),
  default_retention_years: z.number().catch(5),
  acknowledgement_due_days: z.number().catch(7),
  investigation_due_days: z.number().nullable().catch(null),
  requires_dpo: z.boolean().catch(false),
  allows_anonymous: z.boolean().catch(true),
  definition: z.unknown().transform(parseTemplateDefinition),
  metadata_schema: z.unknown().transform(parseMetadataSchema),
  nav_pinned: z.boolean().catch(false),
  is_active: z.boolean().catch(true),
  deleted_at: lenientString,
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseOrgTemplateRow(raw: unknown): AlertOrgTemplateRow | null {
  const r = OrgTemplateSchema.safeParse(raw)
  return r.success ? (r.data as AlertOrgTemplateRow) : null
}

const CaseSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  access_key: z.string(),
  kind: z.enum(ALERT_KIND_VALUES),
  source_kind: z.enum(ALERT_SOURCE_KIND_VALUES).catch('system'),
  system_template_id: lenientString,
  org_template_id: lenientString,
  title: z.string(),
  description: z.string().catch(''),
  category: lenientString,
  category_id: lenientString,
  occurred_at_text: lenientString,
  is_anonymous: z.boolean().catch(true),
  anonymity_mode: z.enum(ALERT_ANONYMITY_MODE_VALUES).catch('fully_anonymous'),
  reporter_contact: lenientString,
  reporter_user_id: lenientString,
  reporter_display_name: lenientString,
  reporter_identifier_encrypted: lenientString,
  reporter_identifier_key_version: z.number().nullable().catch(null),
  reporter_email_for_notification_hashed: lenientString,
  title_encrypted: lenientString,
  title_key_version: z.number().nullable().catch(null),
  description_encrypted: lenientString,
  description_key_version: z.number().nullable().catch(null),
  parent_case_id: lenientString,
  snoozed_until: lenientString,
  snooze_reason: lenientString,
  intake_form_version_id: lenientString,
  location_id: lenientString,
  department_id: lenientString,
  team_id: lenientString,
  assigned_committee_member_ids: lenientStringArray,
  metadata: z.record(z.string(), z.unknown()).catch({}),
  status: z.enum(ALERT_STATUS_VALUES).catch('received'),
  confidentiality_level: z.enum(ALERT_CONFIDENTIALITY_VALUES).catch('restricted'),
  severity: z.enum(ALERT_SEVERITY_VALUES).nullable().catch(null),
  received_at: z.string(),
  acknowledgement_due_at: z.string(),
  investigation_due_at: lenientString,
  acknowledged_at: lenientString,
  closed_at: lenientString,
  closing_summary: lenientString,
  closing_outcome: z.enum(ALERT_CLOSING_OUTCOME_VALUES).nullable().catch(null),
  breach_type: z.enum(ALERT_BREACH_TYPE_VALUES).nullable().catch(null),
  affected_categories: z.array(z.string()).nullable().catch(null),
  affected_subjects_estimate: z.number().nullable().catch(null),
  affected_subjects_actual: z.number().nullable().catch(null),
  risk_assessment: lenientString,
  mitigation_actions: lenientString,
  datatilsynet_reported_at: lenientString,
  datatilsynet_reference: lenientString,
  data_subjects_notified_at: lenientString,
  retention_until: lenientString,
  redacted_at: lenientString,
  definition_snapshot: z.unknown().nullable().transform((v) => (v == null ? null : parseTemplateDefinition(v))),
  metadata_schema_snapshot: z.unknown().nullable().transform((v) => (v == null ? null : parseMetadataSchema(v))),
  submission_user_agent: lenientString,
  submission_locale: lenientString,
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseCaseRow(raw: unknown): AlertCaseRow | null {
  const r = CaseSchema.safeParse(raw)
  return r.success ? (r.data as AlertCaseRow) : null
}

const CaseNoteSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  organization_id: z.string(),
  author_id: lenientString,
  body: z.string(),
  note_kind: z.enum(ALERT_NOTE_KIND_VALUES).catch('internal'),
  visible_to_reporter: z.boolean().catch(false),
  created_at: z.string(),
})

export function parseCaseNoteRow(raw: unknown): AlertCaseNoteRow | null {
  const r = CaseNoteSchema.safeParse(raw)
  return r.success ? (r.data as AlertCaseNoteRow) : null
}

const AttachmentSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  organization_id: z.string(),
  storage_bucket: z.string(),
  storage_path: lenientString,
  uploaded_by_user_id: lenientString,
  filename: z.string(),
  content_type: lenientString,
  size_bytes: z.number().nullable().catch(null),
  sha256_hex: lenientString,
  is_redacted: z.boolean().catch(false),
  created_at: z.string(),
})

export function parseAttachmentRow(raw: unknown): AlertCaseAttachmentRow | null {
  const r = AttachmentSchema.safeParse(raw)
  return r.success ? (r.data as AlertCaseAttachmentRow) : null
}

const TimelineEventSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  organization_id: z.string(),
  event_kind: z.enum(ALERT_TIMELINE_EVENT_VALUES),
  actor_kind: z.enum(['reporter', 'committee', 'system']).nullable().catch(null),
  actor_user_id: lenientString,
  payload: z.record(z.string(), z.unknown()).catch({}),
  created_at: z.string(),
})

export function parseTimelineEventRow(raw: unknown): AlertCaseTimelineEventRow | null {
  const r = TimelineEventSchema.safeParse(raw)
  return r.success ? (r.data as AlertCaseTimelineEventRow) : null
}

// ── v1.1 — Row types for the new entities ─────────────────────────────────

export type AlertOrgKeyRow = {
  organization_id: string
  kek_provider: 'supabase_vault' | 'aws_kms' | 'azure_keyvault' | 'gcp_kms' | 'customer_managed'
  kms_key_id: string
  wrapped_dek: string                              // \x-hex
  dek_version: number
  rotated_at: string | null
  created_at: string
  updated_at: string
  notes: string | null
}

export type AlertAccusedRow = {
  id: string
  case_id: string
  organization_id: string
  display_name_encrypted: string                   // \x-hex
  display_name_key_version: number
  role_or_title: string | null
  reporter_relationship: string | null
  notified_at: string | null
  notification_method: string | null
  right_of_reply_encrypted: string | null
  right_of_reply_key_version: number | null
  right_of_reply_received_at: string | null
  redacted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AlertWitnessRow = {
  id: string
  case_id: string
  organization_id: string
  display_name_encrypted: string | null
  display_name_key_version: number | null
  role_or_title: string | null
  relationship_to_case: string | null
  interview_at: string | null
  interview_step_id: string | null
  consented: boolean
  consent_recorded_at: string | null
  redacted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type AlertCoiOutcome = 'cleared' | 'blocked' | 'requires_review'

export type AlertCoiDeclarationRow = {
  id: string
  case_id: string
  organization_id: string
  handler_user_id: string
  questions: Record<string, unknown>
  answers: Record<string, unknown>
  outcome: AlertCoiOutcome
  outcome_reason: string | null
  ip_hash: string | null
  ua_hash: string | null
  declared_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_outcome: 'cleared' | 'blocked' | null
}

export type AlertIntakeFormVersionRow = {
  id: string
  organization_id: string
  system_template_id: string | null
  org_template_id: string | null
  version: number
  schema: unknown
  privacy_notice_nb: string | null
  privacy_notice_en: string | null
  active: boolean
  published_at: string
  published_by: string | null
  retired_at: string | null
  created_at: string
}

export type AlertLegalHoldReason = 'criminal' | 'litigation' | 'regulatory' | 'internal_review'

export type AlertLegalHoldRow = {
  id: string
  case_id: string
  organization_id: string
  reason: AlertLegalHoldReason
  reference: string
  imposed_by: string
  imposed_at: string
  released_by: string | null
  released_at: string | null
  notes: string | null
  created_at: string
}

export type AlertDsarSubjectType = 'reporter' | 'accused' | 'witness' | 'other'

export type AlertDsarState =
  | 'received'
  | 'in_legal_review'
  | 'redacting'
  | 'fulfilled'
  | 'rejected_rights'
  | 'rejected_excessive'

export type AlertDsarRequestRow = {
  id: string
  organization_id: string
  subject_type: AlertDsarSubjectType
  subject_identifier_hash: string                  // \x-hex
  case_ids: string[]
  state: AlertDsarState
  legal_review_notes_encrypted: string | null
  legal_review_notes_key_version: number | null
  response_due_at: string
  outcome: string | null
  outcome_at: string | null
  received_at: string
  received_by: string | null
  updated_at: string
  created_at: string
}

export type AlertExportType =
  | 'full_case_pdf'
  | 'audit_log'
  | 'redacted_disclosure'
  | 'evidence_zip'
  | 'dsar_response'

export type AlertExportRow = {
  id: string
  case_id: string | null
  organization_id: string
  exported_by: string
  export_type: AlertExportType
  purpose: string
  recipient: string
  file_hash: string | null
  file_size: number | null
  expires_at: string | null
  dsar_request_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type AlertBreakGlassState = 'pending' | 'active' | 'expired' | 'denied' | 'revoked'

export type AlertBreakGlassSessionRow = {
  id: string
  organization_id: string
  initiated_by: string
  justification_encrypted: string
  justification_key_version: number
  approved_by: string | null
  approved_at: string | null
  state: AlertBreakGlassState
  initiated_at: string
  expires_at: string | null
  revoked_at: string | null
  revoked_by: string | null
  revoke_reason: string | null
  metadata: Record<string, unknown>
}

export type AlertWorkflowTransitionRow = {
  id: string
  organization_id: string | null
  from_state: AlertStatus
  to_state: AlertStatus
  allowed_roles: string[]
  preconditions: Record<string, unknown>
  side_effects: Record<string, unknown>
  sla_action: 'noop' | 'start_feedback' | 'start_interim' | 'pause_feedback' | 'stop_all'
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AlertExternalInvestigatorGrantRow = {
  id: string
  case_id: string
  organization_id: string
  investigator_user_id: string
  granted_by: string
  granted_at: string
  expires_at: string
  revoked_at: string | null
  revoked_by: string | null
  scope_notes: string | null
}

export type AlertAccusedRepresentativeGrantRow = {
  id: string
  case_id: string
  accused_id: string
  organization_id: string
  representative_user_id: string
  granted_by: string
  granted_at: string
  expires_at: string
  revoked_at: string | null
  revoked_by: string | null
  notes: string | null
}

// ── v1.1 zod parsers ──────────────────────────────────────────────────────

const AccusedSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  organization_id: z.string(),
  display_name_encrypted: z.string(),
  display_name_key_version: z.number().catch(1),
  role_or_title: lenientString,
  reporter_relationship: lenientString,
  notified_at: lenientString,
  notification_method: lenientString,
  right_of_reply_encrypted: lenientString,
  right_of_reply_key_version: z.number().nullable().catch(null),
  right_of_reply_received_at: lenientString,
  redacted_at: lenientString,
  created_by: lenientString,
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseAccusedRow(raw: unknown): AlertAccusedRow | null {
  const r = AccusedSchema.safeParse(raw)
  return r.success ? (r.data as AlertAccusedRow) : null
}

const WitnessSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  organization_id: z.string(),
  display_name_encrypted: lenientString,
  display_name_key_version: z.number().nullable().catch(null),
  role_or_title: lenientString,
  relationship_to_case: lenientString,
  interview_at: lenientString,
  interview_step_id: lenientString,
  consented: z.boolean().catch(false),
  consent_recorded_at: lenientString,
  redacted_at: lenientString,
  created_by: lenientString,
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseWitnessRow(raw: unknown): AlertWitnessRow | null {
  const r = WitnessSchema.safeParse(raw)
  return r.success ? (r.data as AlertWitnessRow) : null
}

const CoiSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  organization_id: z.string(),
  handler_user_id: z.string(),
  questions: z.record(z.string(), z.unknown()).catch({}),
  answers: z.record(z.string(), z.unknown()).catch({}),
  outcome: z.enum(['cleared', 'blocked', 'requires_review']).catch('requires_review'),
  outcome_reason: lenientString,
  ip_hash: lenientString,
  ua_hash: lenientString,
  declared_at: z.string(),
  reviewed_by: lenientString,
  reviewed_at: lenientString,
  review_outcome: z.enum(['cleared', 'blocked']).nullable().catch(null),
})

export function parseCoiDeclarationRow(raw: unknown): AlertCoiDeclarationRow | null {
  const r = CoiSchema.safeParse(raw)
  return r.success ? (r.data as AlertCoiDeclarationRow) : null
}

const LegalHoldSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  organization_id: z.string(),
  reason: z.enum(['criminal', 'litigation', 'regulatory', 'internal_review']),
  reference: z.string(),
  imposed_by: z.string(),
  imposed_at: z.string(),
  released_by: lenientString,
  released_at: lenientString,
  notes: lenientString,
  created_at: z.string(),
})

export function parseLegalHoldRow(raw: unknown): AlertLegalHoldRow | null {
  const r = LegalHoldSchema.safeParse(raw)
  return r.success ? (r.data as AlertLegalHoldRow) : null
}

const DsarSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  subject_type: z.enum(['reporter', 'accused', 'witness', 'other']),
  subject_identifier_hash: z.string(),
  case_ids: lenientStringArray,
  state: z.enum(['received', 'in_legal_review', 'redacting', 'fulfilled', 'rejected_rights', 'rejected_excessive']).catch('received'),
  legal_review_notes_encrypted: lenientString,
  legal_review_notes_key_version: z.number().nullable().catch(null),
  response_due_at: z.string(),
  outcome: lenientString,
  outcome_at: lenientString,
  received_at: z.string(),
  received_by: lenientString,
  updated_at: z.string(),
  created_at: z.string(),
})

export function parseDsarRequestRow(raw: unknown): AlertDsarRequestRow | null {
  const r = DsarSchema.safeParse(raw)
  return r.success ? (r.data as AlertDsarRequestRow) : null
}

const ExportSchema = z.object({
  id: z.string(),
  case_id: lenientString,
  organization_id: z.string(),
  exported_by: z.string(),
  export_type: z.enum(['full_case_pdf', 'audit_log', 'redacted_disclosure', 'evidence_zip', 'dsar_response']),
  purpose: z.string(),
  recipient: z.string(),
  file_hash: lenientString,
  file_size: z.number().nullable().catch(null),
  expires_at: lenientString,
  dsar_request_id: lenientString,
  metadata: z.record(z.string(), z.unknown()).catch({}),
  created_at: z.string(),
})

export function parseExportRow(raw: unknown): AlertExportRow | null {
  const r = ExportSchema.safeParse(raw)
  return r.success ? (r.data as AlertExportRow) : null
}

const BreakGlassSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  initiated_by: z.string(),
  justification_encrypted: z.string(),
  justification_key_version: z.number().catch(1),
  approved_by: lenientString,
  approved_at: lenientString,
  state: z.enum(['pending', 'active', 'expired', 'denied', 'revoked']).catch('pending'),
  initiated_at: z.string(),
  expires_at: lenientString,
  revoked_at: lenientString,
  revoked_by: lenientString,
  revoke_reason: lenientString,
  metadata: z.record(z.string(), z.unknown()).catch({}),
})

export function parseBreakGlassSessionRow(raw: unknown): AlertBreakGlassSessionRow | null {
  const r = BreakGlassSchema.safeParse(raw)
  return r.success ? (r.data as AlertBreakGlassSessionRow) : null
}

const WorkflowTransitionSchema = z.object({
  id: z.string(),
  organization_id: lenientString,
  from_state: z.enum(ALERT_STATUS_VALUES),
  to_state: z.enum(ALERT_STATUS_VALUES),
  allowed_roles: lenientStringArray,
  preconditions: z.record(z.string(), z.unknown()).catch({}),
  side_effects: z.record(z.string(), z.unknown()).catch({}),
  sla_action: z.enum(['noop', 'start_feedback', 'start_interim', 'pause_feedback', 'stop_all']).catch('noop'),
  is_active: z.boolean().catch(true),
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseWorkflowTransitionRow(raw: unknown): AlertWorkflowTransitionRow | null {
  const r = WorkflowTransitionSchema.safeParse(raw)
  return r.success ? (r.data as AlertWorkflowTransitionRow) : null
}

const IntakeFormVersionSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  system_template_id: lenientString,
  org_template_id: lenientString,
  version: z.number(),
  schema: z.unknown(),
  privacy_notice_nb: lenientString,
  privacy_notice_en: lenientString,
  active: z.boolean().catch(true),
  published_at: z.string(),
  published_by: lenientString,
  retired_at: lenientString,
  created_at: z.string(),
})

export function parseIntakeFormVersionRow(raw: unknown): AlertIntakeFormVersionRow | null {
  const r = IntakeFormVersionSchema.safeParse(raw)
  return r.success ? (r.data as AlertIntakeFormVersionRow) : null
}

/** Resolved template — system or org — with overrides merged. The hub
 *  consumes this; mutations target the underlying row directly. */
export type ResolvedAlertTemplate = {
  kind: 'system' | 'org'
  id: string
  slug: string
  templateKind: AlertKind
  name: string
  description: string | null
  frameworks: string[]
  lawRefs: string[]
  defaultCategorySlug: string | null
  categoryId: string | null
  defaultConfidentialityLevel: AlertConfidentialityLevel
  retentionYears: number
  acknowledgementDueDays: number
  investigationDueDays: number | null
  requiresDpo: boolean
  allowsAnonymous: boolean
  navPinned: boolean
  position: number
  enabled: boolean
  definition: AlertTemplateDefinition
  metadataSchema: AlertMetadataSchema
}
