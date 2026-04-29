import { z } from 'zod'

// Enterprise survey (AML Kap. 4) — row types mirroring Supabase.
// tabeller: `org_survey_questions`, `org_survey_responses`, `org_survey_answers` (i motsetning til eldre QPS-tabeller)

export type SurveyStatus = 'draft' | 'active' | 'closed' | 'archived'

export type SurveyType = 'internal' | 'external' | 'pulse' | 'exit' | 'onboarding'

export type SurveyQuestionType =
  | 'rating_1_to_5'
  | 'rating_1_to_10'
  | 'text'
  | 'yes_no'
  | 'single_select'
  | 'multi_select'
  | 'multiple_choice'
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'number'
  | 'rating_visual'
  | 'slider'
  | 'dropdown'
  | 'image_choice'
  | 'likert_scale'
  | 'matrix'
  | 'ranking'
  | 'nps'
  | 'file_upload'
  | 'datetime'
  | 'signature'

export type SurveyActionPlanStatus = 'open' | 'in_progress' | 'closed'

export type SurveyPillar =
  | 'psychosocial'
  | 'physical'
  | 'organization'
  | 'safety_culture'
  | 'custom'

const SurveyStatusSchema = z.enum(['draft', 'active', 'closed', 'archived'])
const SurveyTypeSchema = z.enum(['internal', 'external', 'pulse', 'exit', 'onboarding'])
const SurveyQuestionTypeSchema = z.enum([
  'rating_1_to_5',
  'rating_1_to_10',
  'text',
  'yes_no',
  'single_select',
  'multi_select',
  'multiple_choice',
  'short_text',
  'long_text',
  'email',
  'number',
  'rating_visual',
  'slider',
  'dropdown',
  'image_choice',
  'likert_scale',
  'matrix',
  'ranking',
  'nps',
  'file_upload',
  'datetime',
  'signature',
])
const SurveyActionPlanStatusSchema = z.enum(['open', 'in_progress', 'closed'])
const SurveyPillarSchema = z.enum(['psychosocial', 'physical', 'organization', 'safety_culture', 'custom'])
const MandatoryLawSchema = z.enum(['AML_4_3', 'AML_4_4', 'AML_6_2']).nullable()

export type SurveyRow = {
  id: string
  organization_id: string
  title: string
  description: string | null
  status: SurveyStatus
  survey_type: SurveyType
  is_anonymous: boolean
  published_at: string | null
  closed_at: string | null
  start_date: string | null
  end_date: string | null
  vendor_name: string | null
  vendor_org_number: string | null
  anonymity_threshold: number
  amu_review_required: boolean
  action_threshold: number
  recurrence_months: number | null
  next_scheduled_at: string | null
  created_at: string
  updated_at: string
  /** Hvorfor undersøkelsen kjøres — styrer forslag i byggeren */
  survey_purpose: string | null
  /** Kort oppsummering til AMU / rapport (valgfritt) */
  survey_amu_summary: string | null
}

export const SurveyRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: SurveyStatusSchema,
  survey_type: SurveyTypeSchema.default('internal'),
  is_anonymous: z.boolean(),
  published_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  start_date: z.string().nullable().default(null),
  end_date: z.string().nullable().default(null),
  vendor_name: z.string().nullable().default(null),
  vendor_org_number: z.string().nullable().default(null),
  anonymity_threshold: z.number().int().positive().default(5),
  amu_review_required: z.boolean().default(true),
  action_threshold: z.number().int().min(0).max(100).default(60),
  recurrence_months: z.number().int().min(1).max(120).nullable().default(null),
  next_scheduled_at: z.string().nullable().default(null),
  created_at: z.string(),
  updated_at: z.string(),
  survey_purpose: z.string().nullable().optional(),
  survey_amu_summary: z.string().nullable().optional(),
}).transform((row) => ({
  ...row,
  survey_purpose: row.survey_purpose ?? null,
  survey_amu_summary: row.survey_amu_summary ?? null,
}))

export function parseSurveyRow(
  raw: unknown,
): { success: true; data: SurveyRow } | { success: false } {
  const r = SurveyRowSchema.safeParse(raw)
  if (r.success) return { success: true, data: r.data as SurveyRow }
  return { success: false }
}

export type OrgSurveyQuestionRow = {
  id: string
  survey_id: string
  organization_id: string
  question_text: string
  question_type: SurveyQuestionType
  order_index: number
  is_required: boolean
  is_mandatory: boolean
  mandatory_law: 'AML_4_3' | 'AML_4_4' | 'AML_6_2' | null
  /** Optional builder section (folder); null = root / legacy */
  section_id: string | null
  /** UI/skjema (skala, alternativer, underkategori) */
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type SurveySectionRow = {
  id: string
  organization_id: string
  survey_id: string
  title: string
  description: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export const SurveySectionRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  survey_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  order_index: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseSurveySectionRow(raw: unknown): { success: true; data: SurveySectionRow } | { success: false } {
  const r = SurveySectionRowSchema.safeParse(raw)
  if (r.success) return { success: true, data: r.data }
  return { success: false }
}

export const OrgSurveyQuestionRowSchema = z.object({
  id: z.string().uuid(),
  survey_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  question_text: z.string(),
  question_type: SurveyQuestionTypeSchema,
  order_index: z.number().int(),
  is_required: z.boolean(),
  is_mandatory: z.boolean().default(false),
  mandatory_law: MandatoryLawSchema.default(null),
  section_id: z.string().uuid().nullable().optional(),
  config: z.preprocess((v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}), z.record(z.string(), z.unknown())),
  created_at: z.string(),
  updated_at: z.string(),
}).transform((row) => ({
  ...row,
  section_id: row.section_id ?? null,
}))

export function parseOrgSurveyQuestionRow(
  raw: unknown,
): { success: true; data: OrgSurveyQuestionRow } | { success: false } {
  const r = OrgSurveyQuestionRowSchema.safeParse(raw)
  if (r.success) return { success: true, data: r.data }
  return { success: false }
}

export type OrgSurveyResponseRow = {
  id: string
  survey_id: string
  organization_id: string
  user_id: string | null
  submitted_at: string
  created_at: string
  updated_at: string
}

export const OrgSurveyResponseRowSchema = z.object({
  id: z.string().uuid(),
  survey_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  submitted_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseOrgSurveyResponseRow(
  raw: unknown,
): { success: true; data: OrgSurveyResponseRow } | { success: false } {
  const r = OrgSurveyResponseRowSchema.safeParse(raw)
  if (r.success) return { success: true, data: r.data }
  return { success: false }
}

export type OrgSurveyAnswerRow = {
  id: string
  response_id: string
  question_id: string
  organization_id: string
  answer_value: number | null
  answer_text: string | null
  created_at: string
  updated_at: string
}

export const OrgSurveyAnswerRowSchema = z.object({
  id: z.string().uuid(),
  response_id: z.string().uuid(),
  question_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  answer_value: z.number().nullable(),
  answer_text: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseOrgSurveyAnswerRow(
  raw: unknown,
): { success: true; data: OrgSurveyAnswerRow } | { success: false } {
  const r = OrgSurveyAnswerRowSchema.safeParse(raw)
  if (r.success) return { success: true, data: r.data }
  return { success: false }
}

export type SurveyQuestionBankRow = {
  id: string
  organization_id: string
  category: string
  question_text: string
  question_type: SurveyQuestionType
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const SurveyQuestionBankRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  category: z.string(),
  question_text: z.string(),
  question_type: SurveyQuestionTypeSchema,
  config: z.preprocess((v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}), z.record(z.string(), z.unknown())),
  created_at: z.string(),
  updated_at: z.string(),
})

export function parseSurveyQuestionBankRow(
  raw: unknown,
): { success: true; data: SurveyQuestionBankRow } | { success: false } {
  const r = SurveyQuestionBankRowSchema.safeParse(raw)
  if (r.success) return { success: true, data: r.data }
  return { success: false }
}

export type SurveyAmuReviewRow = {
  id: string
  organization_id: string
  survey_id: string
  meeting_date: string | null
  agenda_item: string | null
  protocol_text: string | null
  amu_chair_name: string | null
  amu_chair_signed_at: string | null
  vo_name: string | null
  vo_signed_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export const SurveyAmuReviewRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  survey_id: z.string().uuid(),
  meeting_date: z.string().nullable(),
  agenda_item: z.string().nullable(),
  protocol_text: z.string().nullable(),
  amu_chair_name: z.string().nullable(),
  amu_chair_signed_at: z.string().nullable(),
  vo_name: z.string().nullable(),
  vo_signed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid().nullable(),
})

export function parseSurveyAmuReviewRow(
  raw: unknown,
): { success: true; data: SurveyAmuReviewRow } | { success: false } {
  const r = SurveyAmuReviewRowSchema.safeParse(raw)
  if (r.success) return { success: true, data: r.data }
  return { success: false }
}

export type SurveyActionPlanRow = {
  id: string
  organization_id: string
  survey_id: string
  category: string
  pillar: SurveyPillar
  title: string
  description: string | null
  score: number | null
  status: SurveyActionPlanStatus
  responsible: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export const SurveyActionPlanRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  survey_id: z.string().uuid(),
  category: z.string(),
  pillar: SurveyPillarSchema,
  title: z.string(),
  description: z.string().nullable(),
  score: z.number().nullable(),
  status: SurveyActionPlanStatusSchema,
  responsible: z.string().nullable(),
  due_date: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid().nullable(),
})

export function parseSurveyActionPlanRow(
  raw: unknown,
): { success: true; data: SurveyActionPlanRow } | { success: false } {
  const r = SurveyActionPlanRowSchema.safeParse(raw)
  if (r.success) return { success: true, data: r.data }
  return { success: false }
}

export type SurveyAudienceType = 'all' | 'departments' | 'teams' | 'locations'

export type SurveyDistributionStatus = 'draft' | 'generated' | 'completed' | 'cancelled'

export type SurveyDistributionRow = {
  id: string
  organization_id: string
  survey_id: string
  label: string | null
  audience_type: SurveyAudienceType
  audience_department_ids: string[] | null
  audience_team_ids: string[]
  audience_location_ids: string[]
  scheduled_initial_send_at: string | null
  initial_send_started_at: string | null
  status: SurveyDistributionStatus
  invite_count: number
  created_at: string
  updated_at: string
  created_by: string | null
}

const SurveyDistributionRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  survey_id: z.string().uuid(),
  label: z.string().nullable(),
  audience_type: z.enum(['all', 'departments', 'teams', 'locations']),
  audience_department_ids: z.array(z.string().uuid()).nullable(),
  audience_team_ids: z.array(z.string().uuid()).nullable().optional(),
  audience_location_ids: z.array(z.string().uuid()).nullable().optional(),
  scheduled_initial_send_at: z.string().nullable().optional(),
  initial_send_started_at: z.string().nullable().optional(),
  status: z.enum(['draft', 'generated', 'completed', 'cancelled']),
  invite_count: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid().nullable(),
}).transform((row) => ({
  ...row,
  audience_team_ids: row.audience_team_ids ?? [],
  audience_location_ids: row.audience_location_ids ?? [],
  scheduled_initial_send_at: row.scheduled_initial_send_at ?? null,
  initial_send_started_at: row.initial_send_started_at ?? null,
}))

export function parseSurveyDistributionRow(
  raw: unknown,
): { success: true; data: SurveyDistributionRow } | { success: false } {
  const r = SurveyDistributionRowSchema.safeParse(raw)
  if (r.success) return { success: true, data: r.data }
  return { success: false }
}

export type SurveyInvitationStatus = 'pending' | 'completed'

export type SurveyInvitationRow = {
  id: string
  organization_id: string
  survey_id: string
  distribution_id: string
  profile_id: string
  department_id: string | null
  email_snapshot: string | null
  /** Opaque secret for personal survey link (?invite=) — null before migration or legacy rows */
  access_token: string | null
  email_sent_at: string | null
  email_send_error: string | null
  reminder_sent_at: string | null
  reminder_count?: number
  resend_email_id: string | null
  email_delivery_status: string | null
  status: SurveyInvitationStatus
  response_id: string | null
  created_at: string
  updated_at: string
}

const SurveyInvitationRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  survey_id: z.string().uuid(),
  distribution_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  department_id: z.string().uuid().nullable(),
  email_snapshot: z.string().nullable(),
  access_token: z.string().min(1).nullable().optional(),
  email_sent_at: z.string().nullable().optional(),
  email_send_error: z.string().nullable().optional(),
  reminder_sent_at: z.string().nullable().optional(),
  reminder_count: z.number().int().nonnegative().optional(),
  resend_email_id: z.string().nullable().optional(),
  email_delivery_status: z.string().nullable().optional(),
  status: z.enum(['pending', 'completed']),
  response_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).transform((row) => ({
  ...row,
  access_token: row.access_token ?? null,
  email_sent_at: row.email_sent_at ?? null,
  email_send_error: row.email_send_error ?? null,
  reminder_sent_at: row.reminder_sent_at ?? null,
  reminder_count: row.reminder_count ?? 0,
  resend_email_id: row.resend_email_id ?? null,
  email_delivery_status: row.email_delivery_status ?? null,
}))

export function parseSurveyInvitationRow(
  raw: unknown,
): { success: true; data: SurveyInvitationRow } | { success: false } {
  const r = SurveyInvitationRowSchema.safeParse(raw)
  if (r.success) return { success: true, data: r.data }
  return { success: false }
}

export const surveyStatusEnum = SurveyStatusSchema
export const surveyTypeEnum = SurveyTypeSchema
export const questionTypeEnum = SurveyQuestionTypeSchema
export const surveyActionPlanStatusEnum = SurveyActionPlanStatusSchema
export const surveyPillarEnum = SurveyPillarSchema

export const SURVEY_STATUS_LABEL: Record<SurveyStatus, string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  closed: 'Lukket',
  archived: 'Arkivert',
}

export const SURVEY_PILLAR_LABEL: Record<SurveyPillar, string> = {
  psychosocial: 'Psykososialt arbeidsmiljø',
  physical: 'Fysisk arbeidsmiljø',
  organization: 'Organisasjon og samarbeid',
  safety_culture: 'Sikkerhetskultur',
  custom: 'Egendefinert',
}

export const ACTION_PLAN_STATUS_LABEL: Record<SurveyActionPlanStatus, string> = {
  open: 'Åpen',
  in_progress: 'Pågår',
  closed: 'Lukket',
}

export const SURVEY_TYPE_LABEL: Record<SurveyType, string> = {
  internal: 'Ansatte',
  external: 'Leverandør',
  pulse: 'Puls',
  exit: 'Sluttsamtale',
  onboarding: 'Onboarding',
}
