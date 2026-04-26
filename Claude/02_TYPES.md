# 02 · Types & Zod Schemas

File: `modules/amu/types.ts`

```ts
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
```

All form components must validate against these schemas before submitting.
