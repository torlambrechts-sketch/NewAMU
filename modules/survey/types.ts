// Enterprise survey (AML Kap. 4) — row types mirroring Supabase.
// Note: table names in DB are `org_survey_questions`, `org_survey_responses`, `org_survey_answers`
// to avoid collision with legacy `survey_questions` / `survey_responses` (QPS/psykososial modul).

export type SurveyStatus = 'draft' | 'active' | 'closed'

export type SurveyQuestionType = 'rating_1_to_5' | 'text' | 'multiple_choice'

export type SurveyRow = {
  id: string
  organization_id: string
  title: string
  description: string | null
  status: SurveyStatus
  is_anonymous: boolean
  published_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export type OrgSurveyQuestionRow = {
  id: string
  survey_id: string
  organization_id: string
  question_text: string
  question_type: SurveyQuestionType
  order_index: number
  is_required: boolean
  created_at: string
  updated_at: string
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

export type SurveyQuestionBankRow = {
  id: string
  organization_id: string
  category: string
  question_text: string
  question_type: SurveyQuestionType
  created_at: string
  updated_at: string
}
