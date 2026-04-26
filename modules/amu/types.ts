import { z } from 'zod'

export const amuSideSchema = z.enum(['employer', 'employee', 'bht'])
export const amuRoleSchema = z.enum(['leader', 'deputy_leader', 'member', 'bht_observer'])
export const amuMeetingStatusSchema = z.enum([
  'draft', 'scheduled', 'in_progress', 'completed', 'signed', 'archived'
])
export const amuAgendaSourceSchema = z.enum([
  'standard', 'auto_deviation', 'auto_sick_leave', 'auto_whistleblowing',
  'auto_inspection', 'auto_hms_plan', 'manual', 'employee_proposal'
])
export const amuAgendaStatusSchema = z.enum(['pending', 'active', 'decided', 'deferred'])
export const amuAttendanceStatusSchema = z.enum(['present', 'absent', 'excused', 'digital'])
export const amuReportStatusSchema = z.enum(['draft', 'signed', 'archived'])

export const amuCommitteeSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string().min(1, 'Påkrevd'),
  term_start: z.string(),
  term_end: z.string(),
  chair_side: z.enum(['employer', 'employee']),
  min_meetings_per_year: z.number().int().min(4).default(4),
  bht_provider: z.string().nullable(),
})

export const amuMemberSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  committee_id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  display_name: z.string().min(1, 'Påkrevd'),
  side: amuSideSchema,
  role: amuRoleSchema,
  function_label: z.string().nullable(),
  voting: z.boolean(),
  hms_training_valid_until: z.string().nullable(),
  term_start: z.string(),
  term_end: z.string(),
  active: z.boolean(),
})

export const amuMeetingSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  committee_id: z.string().uuid(),
  sequence_no: z.number().int(),
  year: z.number().int(),
  title: z.string().min(1, 'Påkrevd'),
  scheduled_at: z.string(),
  location: z.string().nullable(),
  is_hybrid: z.boolean(),
  status: amuMeetingStatusSchema,
  signed_at: z.string().nullable(),
  signed_by_leader: z.string().uuid().nullable(),
  signed_by_deputy: z.string().uuid().nullable(),
})

export const amuAgendaItemSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  meeting_id: z.string().uuid(),
  position: z.number().int(),
  title: z.string().min(1, 'Påkrevd'),
  source_type: amuAgendaSourceSchema,
  source_ref_id: z.string().uuid().nullable(),
  legal_ref: z.string().nullable(),
  presenter_id: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  status: amuAgendaStatusSchema,
})

export const amuDecisionSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  agenda_item_id: z.string().uuid(),
  decision_text: z.string().min(1, 'Påkrevd'),
  votes_for: z.number().int().nonnegative(),
  votes_against: z.number().int().nonnegative(),
  votes_abstained: z.number().int().nonnegative(),
  responsible_member_id: z.string().uuid().nullable(),
  due_date: z.string().nullable(),
  linked_action_id: z.string().uuid().nullable(),
})

export const amuComplianceStatusSchema = z.object({
  committee_id: z.string().uuid(),
  year: z.number().int(),
  meetings_required: z.number().int(),
  meetings_held: z.number().int(),
  parity_ok: z.boolean(),
  bht_present: z.boolean(),
  hms_training_all_valid: z.boolean(),
  annual_report_signed: z.boolean(),
  legal_refs_satisfied: z.array(z.string()),
  legal_refs_missing: z.array(z.string()),
})

export type AmuCommittee = z.infer<typeof amuCommitteeSchema>
export type AmuMember = z.infer<typeof amuMemberSchema>
export type AmuMeeting = z.infer<typeof amuMeetingSchema>
export type AmuAgendaItem = z.infer<typeof amuAgendaItemSchema>
export type AmuDecision = z.infer<typeof amuDecisionSchema>
export type AmuComplianceStatus = z.infer<typeof amuComplianceStatusSchema>

export const amuTopicProposalSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  proposed_by: z.string().uuid().nullable(),
  target_meeting_id: z.string().uuid().nullable(),
  description: z.string().min(1, 'Påkrevd'),
  status: z.enum(['submitted', 'accepted', 'rejected', 'deferred']),
})
export type AmuTopicProposal = z.infer<typeof amuTopicProposalSchema>

export const amuAttendanceSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  meeting_id: z.string().uuid(),
  member_id: z.string().uuid(),
  status: amuAttendanceStatusSchema,
  joined_at: z.string().nullable(),
})
export type AmuAttendance = z.infer<typeof amuAttendanceSchema>

export const amuAnnualReportSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  committee_id: z.string().uuid(),
  year: z.number().int(),
  body: z.record(z.string(), z.unknown()),
  status: amuReportStatusSchema,
  signed_by_leader: z.string().uuid().nullable(),
  signed_by_deputy: z.string().uuid().nullable(),
  signed_at: z.string().nullable(),
})
export type AmuAnnualReport = z.infer<typeof amuAnnualReportSchema>

export interface AmuCriticalItem {
  item_type: 'unsigned_meeting' | 'draft_annual_report' | 'missing_meeting' | 'hms_training_expired'
  source_id: string
  organization_id: string
  label: string
  source_date: string | null
  severity: 'high' | 'medium' | 'low'
}

export const amuCommitteeRowSchema = amuCommitteeSchema.extend({
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().uuid().nullable().optional(),
})

export const amuMemberRowSchema = amuMemberSchema.extend({
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().uuid().nullable().optional(),
  term_start: z
    .union([z.string(), z.null()])
    .transform((v) => (v == null || v === '' ? '1900-01-01' : String(v).slice(0, 10))),
  term_end: z
    .union([z.string(), z.null()])
    .transform((v) => (v == null || v === '' ? '2099-12-31' : String(v).slice(0, 10))),
  hms_training_valid_until: z
    .union([z.string(), z.null()])
    .transform((v) => (v == null || v === '' ? null : String(v).slice(0, 10))),
})

export const amuMeetingRowSchema = z
  .object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    committee_id: z.string().uuid().nullable(),
    sequence_no: z.number().int().nullable(),
    year: z.number().int().nullable(),
    title: z.string().min(1, 'Påkrevd'),
    scheduled_at: z.string().nullable(),
    meeting_date: z.string().nullable(),
    location: z.string().nullable(),
    is_hybrid: z.boolean().optional().default(false),
    status: amuMeetingStatusSchema,
    signed_at: z.string().nullable(),
    signed_by_leader: z.string().uuid().nullable(),
    signed_by_deputy: z.string().uuid().nullable(),
  })
  .transform((row) => {
    const scheduled =
      row.scheduled_at ??
      (row.meeting_date ? `${row.meeting_date}T12:00:00.000Z` : new Date().toISOString())
    const committeeId = row.committee_id ?? '00000000-0000-0000-0000-000000000000'
    const y = row.year ?? new Date(scheduled).getFullYear()
    return {
      id: row.id,
      organization_id: row.organization_id,
      committee_id: committeeId,
      sequence_no: row.sequence_no ?? 0,
      year: y,
      title: row.title,
      scheduled_at: scheduled,
      location: row.location,
      is_hybrid: row.is_hybrid,
      status: row.status,
      signed_at: row.signed_at,
      signed_by_leader: row.signed_by_leader,
      signed_by_deputy: row.signed_by_deputy,
    } satisfies AmuMeeting
  })

export const amuComplianceStatusRowSchema = amuComplianceStatusSchema.extend({
  organization_id: z.string().uuid().optional(),
})

export const amuAgendaItemRowSchema = z
  .object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    meeting_id: z.string().uuid(),
    position: z.number().int().nullable(),
    order_index: z.number().int().nullable(),
    title: z.string().min(1, 'Påkrevd'),
    source_type: amuAgendaSourceSchema.nullable(),
    source_module: z.string().nullable(),
    source_ref_id: z.string().uuid().nullable(),
    source_id: z.string().uuid().nullable(),
    legal_ref: z.string().nullable(),
    presenter_id: z.string().uuid().nullable(),
    notes: z.string().nullable(),
    description: z.string().nullable(),
    status: amuAgendaStatusSchema,
  })
  .transform((row) => {
    const pos = row.position ?? row.order_index ?? 0
    const st =
      row.source_type ??
      (row.source_module && row.source_module.trim() === 'avvik' ? 'auto_deviation' : 'manual')
    return {
      id: row.id,
      organization_id: row.organization_id,
      meeting_id: row.meeting_id,
      position: pos,
      title: row.title,
      source_type: st,
      source_ref_id: row.source_ref_id ?? row.source_id,
      legal_ref: row.legal_ref,
      presenter_id: row.presenter_id,
      notes: row.notes ?? row.description,
      status: row.status,
    } satisfies AmuAgendaItem
  })

export const amuDecisionRowSchema = z
  .object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    agenda_item_id: z.string().uuid(),
    decision_text: z.string().min(1, 'Påkrevd'),
    votes_for: z.number().int().nonnegative().nullable(),
    votes_against: z.number().int().nonnegative().nullable(),
    votes_abstained: z.number().int().nonnegative().nullable(),
    responsible_member_id: z.string().uuid().nullable(),
    due_date: z.string().nullable(),
    linked_action_id: z.string().uuid().nullable(),
    action_plan_item_id: z.string().uuid().nullable(),
  })
  .transform((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    agenda_item_id: row.agenda_item_id,
    decision_text: row.decision_text,
    votes_for: row.votes_for ?? 0,
    votes_against: row.votes_against ?? 0,
    votes_abstained: row.votes_abstained ?? 0,
    responsible_member_id: row.responsible_member_id,
    due_date: row.due_date,
    linked_action_id: row.linked_action_id ?? row.action_plan_item_id,
  }))

export const amuAttendanceRowSchema = z
  .object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    meeting_id: z.string().uuid(),
    member_id: z.string().uuid(),
    status: amuAttendanceStatusSchema,
    joined_at: z.string().nullable().optional(),
  })
  .transform((row) => ({
    ...row,
    joined_at: row.joined_at ?? null,
  }))

export const amuCriticalItemSchema = z.object({
  item_type: z.enum(['unsigned_meeting', 'draft_annual_report', 'missing_meeting', 'hms_training_expired']),
  source_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  label: z.string(),
  source_date: z.string().nullable(),
  severity: z.enum(['high', 'medium', 'low']),
})

export const amuAnnualReportRowSchema = amuAnnualReportSchema.extend({
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().uuid().nullable().optional(),
})

/** Standard saksliste (admin) — kopieres til møteagenda via RPC */
export const AmuDefaultAgendaItemSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  order_index: z.number().int(),
  source_module: z.string().min(1).nullable(),
  source_id: z.preprocess(
    (v) => (v === undefined || v === '' || v === null ? null : v),
    z.string().uuid().nullable(),
  ),
  created_at: z.string(),
  updated_at: z.string(),
})
export type AmuDefaultAgendaItem = z.infer<typeof AmuDefaultAgendaItemSchema>

/** Avvik som AMU bør følge opp (fra deviations) */
export const amuDeviationForAmuSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  risk_score: z.number().int().nullable(),
  status: z.string(),
  created_at: z.string(),
})
export type AmuDeviationForAmu = z.infer<typeof amuDeviationForAmuSchema>

/** Aggregert teller — ingen PII (RPC `amu_privacy_whistleblowing_stats`) */
export const AmuWhistleblowingPrivacyStatsSchema = z.object({
  open: z.number().int().nonnegative(),
  closed: z.number().int().nonnegative(),
})
export type AmuWhistleblowingPrivacyStats = z.infer<typeof AmuWhistleblowingPrivacyStatsSchema>

/** Aggregert teller — sykefravær fra HSE-modulens payload */
export const AmuSickLeavePrivacyStatsSchema = z.object({
  active: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  other: z.number().int().nonnegative(),
})
export type AmuSickLeavePrivacyStats = z.infer<typeof AmuSickLeavePrivacyStatsSchema>
