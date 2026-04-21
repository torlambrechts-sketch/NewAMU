import { z } from 'zod'

const uuid = z.string().uuid()

const surveyStatusEnum = z.enum(['draft', 'active', 'closed'])

const questionTypeEnum = z.enum(['rating_1_to_5', 'text', 'multiple_choice'])

export const SurveyRowSchema = z
  .object({
    id: uuid,
    organization_id: uuid,
    title: z.string(),
    description: z.string().nullable(),
    status: surveyStatusEnum,
    is_anonymous: z.boolean(),
    published_at: z.string().nullable(),
    closed_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

export const OrgSurveyQuestionRowSchema = z
  .object({
    id: uuid,
    survey_id: uuid,
    organization_id: uuid,
    question_text: z.string(),
    question_type: questionTypeEnum,
    order_index: z.number().int(),
    is_required: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

export const OrgSurveyResponseRowSchema = z
  .object({
    id: uuid,
    survey_id: uuid,
    organization_id: uuid,
    user_id: uuid.nullable(),
    submitted_at: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

export const OrgSurveyAnswerRowSchema = z
  .object({
    id: uuid,
    response_id: uuid,
    question_id: uuid,
    organization_id: uuid,
    answer_value: z.number().nullable(),
    answer_text: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

export const SurveyQuestionBankRowSchema = z
  .object({
    id: uuid,
    organization_id: uuid,
    category: z.string(),
    question_text: z.string(),
    question_type: questionTypeEnum,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

export { surveyStatusEnum, questionTypeEnum }

export function parseSurveyRow(raw: unknown) {
  return SurveyRowSchema.safeParse(raw)
}

export function parseOrgSurveyQuestionRow(raw: unknown) {
  return OrgSurveyQuestionRowSchema.safeParse(raw)
}

export function parseOrgSurveyResponseRow(raw: unknown) {
  return OrgSurveyResponseRowSchema.safeParse(raw)
}

export function parseOrgSurveyAnswerRow(raw: unknown) {
  return OrgSurveyAnswerRowSchema.safeParse(raw)
}

export function parseSurveyQuestionBankRow(raw: unknown) {
  return SurveyQuestionBankRowSchema.safeParse(raw)
}
