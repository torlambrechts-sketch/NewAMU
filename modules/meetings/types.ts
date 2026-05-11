// Meetings (Møter) module — row types + zod parsers.
//
// New top-level module. Mirrors compliance + documents architecture:
// `meeting_system_templates` (global catalog) + `meeting_org_template_settings`
// (per-org toggle/override/pin) + `meeting_org_templates` (per-org custom) +
// `meetings` (instances) + child tables for agenda / attendees / decisions /
// actions / signatures.
//
// Every type ships with a forgiving `parseXxxRow(raw)` helper so the loader
// can tolerate partial schema drift without crashing the page.

import { z } from 'zod'

// ── Enums ─────────────────────────────────────────────────────────────────

export const MEETING_STATUS_VALUES = ['planned', 'in_progress', 'completed', 'cancelled'] as const
export type MeetingStatus = (typeof MEETING_STATUS_VALUES)[number]

export const MEETING_CONFIDENTIALITY_VALUES = ['standard', 'restricted', 'confidential'] as const
export type MeetingConfidentialityLevel = (typeof MEETING_CONFIDENTIALITY_VALUES)[number]

export const MEETING_SOURCE_KIND_VALUES = ['system', 'org'] as const
export type MeetingSourceKind = (typeof MEETING_SOURCE_KIND_VALUES)[number]

export const MEETING_DECISION_STATUS_VALUES = ['open', 'implemented', 'dropped'] as const
export type MeetingDecisionStatus = (typeof MEETING_DECISION_STATUS_VALUES)[number]

export const MEETING_ACTION_STATUS_VALUES = ['open', 'in_progress', 'done', 'dropped'] as const
export type MeetingActionStatus = (typeof MEETING_ACTION_STATUS_VALUES)[number]

export const MEETING_ATTENDEE_ROLE_VALUES = [
  'chair',
  'secretary',
  'member',
  'observer',
  'guest',
  'verneombud',
  'hovedverneombud',
  'employer_rep',
  'employee_rep',
  'tillitsvalgt',
] as const
export type MeetingAttendeeRole = (typeof MEETING_ATTENDEE_ROLE_VALUES)[number]

export const MEETING_SIGNER_ROLE_VALUES = ['chair', 'secretary', 'management', 'member', 'other'] as const
export type MeetingSignerRole = (typeof MEETING_SIGNER_ROLE_VALUES)[number]

export const MEETING_CADENCE_VALUES = [
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'ad_hoc',
] as const
export type MeetingCadence = (typeof MEETING_CADENCE_VALUES)[number]

export const MEETING_FRAMEWORK_VALUES = [
  'INTERNAL',
  'AML',
  'IK-f',
  'Hovedavtalen',
  'Likestillingsloven',
  'ISO_9001',
  'ISO_14001',
  'ISO_27001',
  'ISO_45001',
  'GDPR',
] as const
export type MeetingFramework = (typeof MEETING_FRAMEWORK_VALUES)[number]

// ── Definition jsonb shapes (system + org template body) ──────────────────

/** Data sources the resolver hook (useMeetingDataBindings) can fan out
 *  to. Each value maps to a switch arm in the resolver that returns a
 *  RenderedBindingResult. Adding a value here = adding an arm. */
export const MEETING_DATA_BINDING_SOURCES = [
  'sick_leave_stats',
  'vernerunde_findings',
  'incidents',
  'open_ros_high',
  'training_completion',
  'open_decisions',
  'whistleblowing_anonymized',
  'survey_results',
  'compliance_checklist_status',
  'bht_annual_report',
  'ik_annual_review_status',
  'headcount_and_amu_composition',
] as const
export type MeetingDataBindingSource = (typeof MEETING_DATA_BINDING_SOURCES)[number]

export const MEETING_DATA_BINDING_WINDOWS = [
  'last_month',
  'last_quarter',
  'last_half_year',
  'last_year',
  'current',
  'all_open',
] as const
export type MeetingDataBindingWindow = (typeof MEETING_DATA_BINDING_WINDOWS)[number]

export const MEETING_DATA_BINDING_PRESENTATIONS = [
  'summary',
  'table',
  'trend',
  'sparkline',
] as const
export type MeetingDataBindingPresentation = (typeof MEETING_DATA_BINDING_PRESENTATIONS)[number]

export type MeetingDataBinding = {
  source: MeetingDataBindingSource
  window?: MeetingDataBindingWindow
  presentation?: MeetingDataBindingPresentation
  scope?: { locationId?: string; departmentId?: string; teamId?: string }
}

/** Resolver output — stored as `meeting_agenda_items.binding_snapshot` jsonb. */
export type RenderedBindingResult = {
  source: MeetingDataBindingSource
  window?: MeetingDataBindingWindow
  resolvedAt: string
  /** Markdown-friendly summary string the UI shows above the minutes textarea. */
  summaryMarkdown: string
  /** Optional tabular data the UI can render as a small table. */
  dataRows?: Array<Record<string, unknown>>
  /** Set when the resolver couldn't produce a summary. The UI shows it as a soft warning. */
  error?: string
}

export type MeetingTemplateAgendaItem = {
  key: string
  title: string
  description?: string
  lawRef?: string
  isMandatory: boolean
  voteRequired?: boolean
  conflictCheck?: boolean
  defaultPosition: number
  /** Optional binding to a cross-module data source. Resolver populates
   *  `meeting_agenda_items.binding_snapshot` from this at meeting creation. */
  dataBinding?: MeetingDataBinding
  /** Marker for honesty pass (H2b) — used by UI to label "Anbefalt, ikke lov-grunnet". */
  recommended?: boolean
  /** Optional override of the meeting-level cadence for this specific item
   *  (e.g. biennial lønnskartlegging within an annual likestillings-møte). */
  cadenceOverride?: MeetingCadence
}

export type MeetingTemplatePrepItem = {
  key: string
  label: string
  isMandatory: boolean
  lawRef?: string
}

export type MeetingTemplateRequiredAttendee = {
  role: MeetingAttendeeRole | 'management'
  count?: number
}

export type MeetingTemplateQuorum =
  | { kind: 'percent'; value: number }
  | { kind: 'count'; value: number }

export type MeetingTemplateDefinition = {
  preparationChecklist: MeetingTemplatePrepItem[]
  agendaItems: MeetingTemplateAgendaItem[]
  requiredAttendees: MeetingTemplateRequiredAttendee[]
  minimumQuorum?: MeetingTemplateQuorum
  invitationLeadDays?: number
  protocolRoles: Array<'chair' | 'secretary' | 'management'>
  defaultActionTaskModule?: string
}

// ── Metadata schema (shared with compliance / survey / documents) ─────────

export type TemplateMetadataFieldKind =
  | 'location'
  | 'department'
  | 'team'
  | 'participants'
  | 'text'
  | 'number'
  | 'select'
  | 'date'

export type TemplateMetadataField = {
  key: string
  kind: TemplateMetadataFieldKind
  label?: string
  help?: string
  required?: boolean
  options?: Array<{ id: string; label: string }>
}

export type TemplateMetadataSchema = {
  fields: TemplateMetadataField[]
}

// ── Row types — system templates ──────────────────────────────────────────

export type MeetingSystemTemplateRow = {
  id: string
  slug: string
  label: string
  description: string | null
  framework: MeetingFramework
  frameworks: string[]
  law_refs: string[]
  cadence_hint: MeetingCadence | null
  default_duration_minutes: number | null
  default_category_slug: string | null
  default_confidentiality_level: MeetingConfidentialityLevel
  minimum_employee_count: number | null
  definition: MeetingTemplateDefinition
  metadata_schema: TemplateMetadataSchema
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// ── Row types — categories ────────────────────────────────────────────────

export type MeetingCategoryRow = {
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

// ── Row types — org template settings (toggle / override / pin) ───────────

export type MeetingOrgTemplateSettingRow = {
  organization_id: string
  system_template_id: string
  enabled: boolean
  nav_pinned: boolean
  position: number
  category_id: string | null
  override_name: string | null
  override_description: string | null
  override_definition: MeetingTemplateDefinition | null
  override_metadata_schema: TemplateMetadataSchema | null
  created_at: string
  updated_at: string
}

// ── Row types — org custom templates ──────────────────────────────────────

export type MeetingOrgTemplateRow = {
  id: string
  organization_id: string
  slug: string
  name: string
  description: string | null
  category_id: string | null
  framework: MeetingFramework
  frameworks: string[]
  law_refs: string[]
  cadence_hint: MeetingCadence | null
  default_duration_minutes: number | null
  default_confidentiality_level: MeetingConfidentialityLevel
  minimum_employee_count: number | null
  definition: MeetingTemplateDefinition
  metadata_schema: TemplateMetadataSchema
  nav_pinned: boolean
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

// ── Row types — meetings (instances) ──────────────────────────────────────

export type MeetingRow = {
  id: string
  organization_id: string
  source_kind: MeetingSourceKind
  system_template_id: string | null
  org_template_id: string | null
  title: string
  description: string | null
  status: MeetingStatus
  confidentiality_level: MeetingConfidentialityLevel
  scheduled_at: string | null
  ends_at: string | null
  completed_at: string | null
  location_label: string | null
  location_id: string | null
  department_id: string | null
  team_id: string | null
  participant_member_ids: string[]
  metadata: Record<string, unknown>
  definition_snapshot: MeetingTemplateDefinition | null
  metadata_schema_snapshot: TemplateMetadataSchema | null
  invitation_sent_at: string | null
  invitation_recipients: string[]
  quorum_met: boolean | null
  minutes_summary: string | null
  next_meeting_proposed_at: string | null
  protocol_signed_at: string | null
  protocol_signed_by: string | null
  sign_checksum: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

// ── Row types — child tables ──────────────────────────────────────────────

export type MeetingAgendaItemRow = {
  id: string
  meeting_id: string
  position: number
  template_item_key: string | null
  title: string
  description: string | null
  law_ref: string | null
  prepared_by_member_id: string | null
  is_mandatory: boolean
  minutes_summary: string | null
  decision_text: string | null
  decision_status: MeetingDecisionStatus | null
  vote_for: number | null
  vote_against: number | null
  vote_abstain: number | null
  conflict_of_interest: Array<{ member_id: string; reason: string }> | null
  binding_snapshot: RenderedBindingResult | null
  created_at: string
  updated_at: string
}

export type MeetingAttendeeRow = {
  meeting_id: string
  member_id: string
  role: MeetingAttendeeRole
  invited: boolean
  present: boolean | null
  excused: boolean
  digital: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type MeetingDecisionRow = {
  id: string
  meeting_id: string
  agenda_item_id: string | null
  decision_text: string
  decision_at: string
  status: MeetingDecisionStatus
  follow_up_task_id: string | null
  created_at: string
  updated_at: string
}

export type MeetingActionItemRow = {
  id: string
  meeting_id: string
  agenda_item_id: string | null
  description: string
  responsible_member_id: string | null
  due_date: string | null
  task_id: string | null
  task_module: string | null
  status: MeetingActionStatus
  created_at: string
  updated_at: string
}

export type MeetingSignatureRow = {
  id: string
  meeting_id: string
  signer_member_id: string | null
  signer_name: string
  signer_role: MeetingSignerRole
  signed_at: string
  level1_event_id: string | null
  is_legally_binding: boolean
  created_at: string
}

// ── Zod schemas (forgiving — `.passthrough()` for jsonb columns) ──────────

const MeetingStatusSchema = z.enum(MEETING_STATUS_VALUES)
const MeetingConfidentialitySchema = z.enum(MEETING_CONFIDENTIALITY_VALUES)
const MeetingSourceKindSchema = z.enum(MEETING_SOURCE_KIND_VALUES)
const MeetingDecisionStatusSchema = z.enum(MEETING_DECISION_STATUS_VALUES)
const MeetingActionStatusSchema = z.enum(MEETING_ACTION_STATUS_VALUES)
const MeetingAttendeeRoleSchema = z.enum(MEETING_ATTENDEE_ROLE_VALUES)
const MeetingSignerRoleSchema = z.enum(MEETING_SIGNER_ROLE_VALUES)
const MeetingCadenceSchema = z.enum(MEETING_CADENCE_VALUES)

const MeetingFrameworkSchema = z
  .string()
  .transform((s): MeetingFramework => {
    return (MEETING_FRAMEWORK_VALUES as readonly string[]).includes(s) ? (s as MeetingFramework) : 'INTERNAL'
  })

const TemplateMetadataFieldSchema = z
  .object({
    key: z.string(),
    kind: z.enum(['location', 'department', 'team', 'participants', 'text', 'number', 'select', 'date']),
    label: z.string().optional(),
    help: z.string().optional(),
    required: z.boolean().optional(),
    options: z
      .array(z.object({ id: z.string(), label: z.string() }))
      .optional(),
  })
  .passthrough()

const TemplateMetadataSchemaSchema = z
  .object({
    fields: z.array(TemplateMetadataFieldSchema).default([]),
  })
  .passthrough()

const MeetingDataBindingSchema = z
  .object({
    source: z.enum(MEETING_DATA_BINDING_SOURCES),
    window: z.enum(MEETING_DATA_BINDING_WINDOWS).optional(),
    presentation: z.enum(MEETING_DATA_BINDING_PRESENTATIONS).optional(),
    scope: z
      .object({
        locationId: z.string().optional(),
        departmentId: z.string().optional(),
        teamId: z.string().optional(),
      })
      .optional(),
  })
  .passthrough()

const MeetingTemplateAgendaItemSchema = z
  .object({
    key: z.string(),
    title: z.string(),
    description: z.string().optional(),
    lawRef: z.string().optional(),
    isMandatory: z.boolean().default(false),
    voteRequired: z.boolean().optional(),
    conflictCheck: z.boolean().optional(),
    defaultPosition: z.number().int().default(0),
    dataBinding: MeetingDataBindingSchema.optional(),
    recommended: z.boolean().optional(),
    cadenceOverride: MeetingCadenceSchema.optional(),
  })
  .passthrough()

const MeetingTemplatePrepItemSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    isMandatory: z.boolean().default(false),
    lawRef: z.string().optional(),
  })
  .passthrough()

const MeetingTemplateRequiredAttendeeSchema = z
  .object({
    role: z.string(),
    count: z.number().int().optional(),
  })
  .passthrough()

const MeetingTemplateDefinitionSchema = z
  .object({
    preparationChecklist: z.array(MeetingTemplatePrepItemSchema).default([]),
    agendaItems: z.array(MeetingTemplateAgendaItemSchema).default([]),
    requiredAttendees: z.array(MeetingTemplateRequiredAttendeeSchema).default([]),
    minimumQuorum: z
      .union([
        z.object({ kind: z.literal('percent'), value: z.number() }),
        z.object({ kind: z.literal('count'), value: z.number() }),
      ])
      .optional(),
    invitationLeadDays: z.number().int().optional(),
    protocolRoles: z.array(z.enum(['chair', 'secretary', 'management'])).default(['chair']),
    defaultActionTaskModule: z.string().optional(),
  })
  .passthrough()

export const MeetingSystemTemplateRowSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    label: z.string(),
    description: z.string().nullable(),
    framework: MeetingFrameworkSchema,
    frameworks: z.array(z.string()).default([]),
    law_refs: z.array(z.string()).default([]),
    cadence_hint: MeetingCadenceSchema.nullable(),
    default_duration_minutes: z.number().int().nullable(),
    default_category_slug: z.string().nullable(),
    default_confidentiality_level: MeetingConfidentialitySchema.default('standard'),
    minimum_employee_count: z.number().int().nullable().default(null),
    definition: MeetingTemplateDefinitionSchema,
    metadata_schema: TemplateMetadataSchemaSchema,
    is_active: z.boolean(),
    sort_order: z.number().int(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough()

export const MeetingCategoryRowSchema = z
  .object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    position: z.number().int(),
    is_active: z.boolean(),
    is_system: z.boolean(),
    deleted_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough()

export const MeetingOrgTemplateSettingRowSchema = z
  .object({
    organization_id: z.string().uuid(),
    system_template_id: z.string(),
    enabled: z.boolean(),
    nav_pinned: z.boolean(),
    position: z.number().int(),
    category_id: z.string().uuid().nullable(),
    override_name: z.string().nullable(),
    override_description: z.string().nullable(),
    override_definition: MeetingTemplateDefinitionSchema.nullable(),
    override_metadata_schema: TemplateMetadataSchemaSchema.nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough()

export const MeetingOrgTemplateRowSchema = z
  .object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    category_id: z.string().uuid().nullable(),
    framework: MeetingFrameworkSchema,
    frameworks: z.array(z.string()).default([]),
    law_refs: z.array(z.string()).default([]),
    cadence_hint: MeetingCadenceSchema.nullable(),
    default_duration_minutes: z.number().int().nullable(),
    default_confidentiality_level: MeetingConfidentialitySchema.default('standard'),
    minimum_employee_count: z.number().int().nullable().default(null),
    definition: MeetingTemplateDefinitionSchema,
    metadata_schema: TemplateMetadataSchemaSchema,
    nav_pinned: z.boolean(),
    is_active: z.boolean(),
    deleted_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    created_by: z.string().uuid().nullable(),
  })
  .passthrough()

export const MeetingRowSchema = z
  .object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    source_kind: MeetingSourceKindSchema,
    system_template_id: z.string().nullable(),
    org_template_id: z.string().uuid().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    status: MeetingStatusSchema,
    confidentiality_level: MeetingConfidentialitySchema,
    scheduled_at: z.string().nullable(),
    ends_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    location_label: z.string().nullable(),
    location_id: z.string().uuid().nullable(),
    department_id: z.string().uuid().nullable(),
    team_id: z.string().uuid().nullable(),
    participant_member_ids: z.array(z.string().uuid()).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
    definition_snapshot: MeetingTemplateDefinitionSchema.nullable(),
    metadata_schema_snapshot: TemplateMetadataSchemaSchema.nullable(),
    invitation_sent_at: z.string().nullable(),
    invitation_recipients: z.array(z.string().uuid()).default([]),
    quorum_met: z.boolean().nullable(),
    minutes_summary: z.string().nullable(),
    next_meeting_proposed_at: z.string().nullable(),
    protocol_signed_at: z.string().nullable(),
    protocol_signed_by: z.string().uuid().nullable(),
    sign_checksum: z.string().nullable(),
    archived_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    created_by: z.string().uuid().nullable(),
  })
  .passthrough()

export const MeetingAgendaItemRowSchema = z
  .object({
    id: z.string().uuid(),
    meeting_id: z.string().uuid(),
    position: z.number().int(),
    template_item_key: z.string().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    law_ref: z.string().nullable(),
    prepared_by_member_id: z.string().uuid().nullable(),
    is_mandatory: z.boolean(),
    minutes_summary: z.string().nullable(),
    decision_text: z.string().nullable(),
    decision_status: MeetingDecisionStatusSchema.nullable(),
    vote_for: z.number().int().nullable(),
    vote_against: z.number().int().nullable(),
    vote_abstain: z.number().int().nullable(),
    conflict_of_interest: z
      .array(z.object({ member_id: z.string(), reason: z.string() }))
      .nullable(),
    binding_snapshot: z
      .object({
        source: z.string(),
        window: z.string().optional(),
        resolvedAt: z.string(),
        summaryMarkdown: z.string(),
        dataRows: z.array(z.record(z.string(), z.unknown())).optional(),
        error: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .default(null),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough()

export const MeetingAttendeeRowSchema = z
  .object({
    meeting_id: z.string().uuid(),
    member_id: z.string().uuid(),
    role: MeetingAttendeeRoleSchema,
    invited: z.boolean(),
    present: z.boolean().nullable(),
    excused: z.boolean(),
    digital: z.boolean(),
    notes: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough()

export const MeetingDecisionRowSchema = z
  .object({
    id: z.string().uuid(),
    meeting_id: z.string().uuid(),
    agenda_item_id: z.string().uuid().nullable(),
    decision_text: z.string(),
    decision_at: z.string(),
    status: MeetingDecisionStatusSchema,
    follow_up_task_id: z.string().uuid().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough()

export const MeetingActionItemRowSchema = z
  .object({
    id: z.string().uuid(),
    meeting_id: z.string().uuid(),
    agenda_item_id: z.string().uuid().nullable(),
    description: z.string(),
    responsible_member_id: z.string().uuid().nullable(),
    due_date: z.string().nullable(),
    task_id: z.string().uuid().nullable(),
    task_module: z.string().nullable(),
    status: MeetingActionStatusSchema,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough()

export const MeetingSignatureRowSchema = z
  .object({
    id: z.string().uuid(),
    meeting_id: z.string().uuid(),
    signer_member_id: z.string().uuid().nullable(),
    signer_name: z.string(),
    signer_role: MeetingSignerRoleSchema,
    signed_at: z.string(),
    level1_event_id: z.string().uuid().nullable(),
    is_legally_binding: z.boolean(),
    created_at: z.string(),
  })
  .passthrough()

// ── Parser helpers — forgiving parse ──────────────────────────────────────

type ParseOk<T> = { success: true; data: T }
type ParseFail = { success: false }
type ParseResult<T> = ParseOk<T> | ParseFail

function mk<T>(schema: z.ZodType<T>) {
  return (raw: unknown): ParseResult<T> => {
    const r = schema.safeParse(raw)
    if (r.success) return { success: true, data: r.data }
    return { success: false }
  }
}

export const parseMeetingSystemTemplateRow = mk<MeetingSystemTemplateRow>(
  MeetingSystemTemplateRowSchema as unknown as z.ZodType<MeetingSystemTemplateRow>,
)
export const parseMeetingCategoryRow = mk<MeetingCategoryRow>(
  MeetingCategoryRowSchema as unknown as z.ZodType<MeetingCategoryRow>,
)
export const parseMeetingOrgTemplateSettingRow = mk<MeetingOrgTemplateSettingRow>(
  MeetingOrgTemplateSettingRowSchema as unknown as z.ZodType<MeetingOrgTemplateSettingRow>,
)
export const parseMeetingOrgTemplateRow = mk<MeetingOrgTemplateRow>(
  MeetingOrgTemplateRowSchema as unknown as z.ZodType<MeetingOrgTemplateRow>,
)
export const parseMeetingRow = mk<MeetingRow>(
  MeetingRowSchema as unknown as z.ZodType<MeetingRow>,
)
export const parseMeetingAgendaItemRow = mk<MeetingAgendaItemRow>(
  MeetingAgendaItemRowSchema as unknown as z.ZodType<MeetingAgendaItemRow>,
)
export const parseMeetingAttendeeRow = mk<MeetingAttendeeRow>(
  MeetingAttendeeRowSchema as unknown as z.ZodType<MeetingAttendeeRow>,
)
export const parseMeetingDecisionRow = mk<MeetingDecisionRow>(
  MeetingDecisionRowSchema as unknown as z.ZodType<MeetingDecisionRow>,
)
export const parseMeetingActionItemRow = mk<MeetingActionItemRow>(
  MeetingActionItemRowSchema as unknown as z.ZodType<MeetingActionItemRow>,
)
export const parseMeetingSignatureRow = mk<MeetingSignatureRow>(
  MeetingSignatureRowSchema as unknown as z.ZodType<MeetingSignatureRow>,
)

// ── Resolved template — system + per-org setting overlay or org-custom ───

export type ResolvedMeetingTemplate = {
  key: string                            // either system_template_id or `org:${org_template_id}`
  sourceKind: MeetingSourceKind
  systemTemplateId: string | null
  orgTemplateId: string | null
  name: string
  description: string | null
  framework: MeetingFramework
  frameworks: string[]
  lawRefs: string[]
  cadenceHint: MeetingCadence | null
  defaultDurationMinutes: number | null
  defaultConfidentialityLevel: MeetingConfidentialityLevel
  minimumEmployeeCount: number | null
  categoryId: string | null
  navPinned: boolean
  position: number
  definition: MeetingTemplateDefinition
  metadataSchema: TemplateMetadataSchema
  isSystem: boolean
  isActive: boolean
}
