import { z } from 'zod'
import type { AmuMeeting } from './types'

export const AmuMeetingStatusSchema = z.enum(['scheduled', 'active', 'completed', 'signed'])

export const AmuParticipantRoleSchema = z.enum([
  'employer_rep',
  'employee_rep',
  'safety_deputy',
  'bht',
  'secretary',
])

export const AmuMeetingSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: z.string(),
  status: AmuMeetingStatusSchema,
  minutes_draft: z.string().nullable(),
  meeting_chair_user_id: z.string().uuid().nullable(),
  chair_side: z.enum(['employer', 'employee']).nullable(),
  chair_signed_at: z.string().nullable(),
  distributed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const AmuParticipantSchema = z.object({
  meeting_id: z.string().uuid(),
  user_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  role: AmuParticipantRoleSchema,
  present: z.boolean(),
  signed_at: z.string().nullable(),
})

export const AmuAgendaItemSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  order_index: z.number().int(),
  source_module: z.string().min(1).nullable(),
  source_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const AmuDecisionSchema = z.object({
  id: z.string().uuid(),
  agenda_item_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  decision_text: z.string().min(1),
  action_plan_item_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

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

/** Én rad fra .select('id').single() etter insert i action_plan_items */
export const ActionPlanItemIdOnlySchema = z.object({
  id: z.string().uuid(),
})

export const AmuWhistleblowingPrivacyStatsSchema = z.object({
  open: z.number().int().nonnegative(),
  closed: z.number().int().nonnegative(),
})

export const AmuSickLeavePrivacyStatsSchema = z.object({
  active: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  other: z.number().int().nonnegative(),
})

export const AmuMeetingDbRowSchema = z
  .object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    title: z.string(),
    meeting_date: z.string(),
    location: z.string(),
    status: AmuMeetingStatusSchema,
    minutes_draft: z.string().nullable().optional(),
    meeting_chair_user_id: z.string().uuid().nullable().optional(),
    chair_side: z.enum(['employer', 'employee']).nullable().optional(),
    chair_signed_at: z.string().nullable().optional(),
    distributed_at: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

export function parseAmuMeetingFromDb(raw: unknown): AmuMeeting {
  const row = AmuMeetingDbRowSchema.parse(raw)
  const side = row.chair_side
  const chair_side =
    side === 'employer' || side === 'employee' ? side : null
  return AmuMeetingSchema.parse({
    ...row,
    date: row.meeting_date,
    minutes_draft: row.minutes_draft ?? null,
    meeting_chair_user_id: row.meeting_chair_user_id ?? null,
    chair_side,
    chair_signed_at: row.chair_signed_at ?? null,
    distributed_at: row.distributed_at ?? null,
  })
}
