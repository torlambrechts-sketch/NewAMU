import { parseMatrixRankingJson } from './surveyRespondValidation'
import type { OrgSurveyAnswerRow, OrgSurveyQuestionRow, SurveyQuestionType } from './types'

const CHOICE_TYPES: SurveyQuestionType[] = [
  'multiple_choice',
  'yes_no',
  'single_select',
  'multi_select',
  'dropdown',
  'image_choice',
]

const NUMERIC_TYPES: SurveyQuestionType[] = [
  'rating_1_to_5',
  'rating_1_to_10',
  'nps',
  'rating_visual',
  'likert_scale',
  'slider',
  'number',
]

/** Single-cell display for admin view of one stored answer row. */
export function formatSurveyAnswerDisplay(
  q: OrgSurveyQuestionRow,
  a: OrgSurveyAnswerRow | undefined,
): string {
  if (!a) return '—'
  const t = (a.answer_text ?? '').trim()
  const v = a.answer_value

  if (q.question_type === 'matrix' && t) {
    const o = parseMatrixRankingJson(a.answer_text)
    if (o && Object.keys(o).length > 0) {
      return Object.entries(o)
        .map(([row, col]) => `${row}: ${typeof col === 'string' ? col : String(col)}`)
        .join('\n')
    }
  }
  if (q.question_type === 'ranking' && t) {
    const o = parseMatrixRankingJson(a.answer_text)
    if (o && Object.keys(o).length > 0) {
      return Object.entries(o)
        .sort(([, pa], [, pb]) => Number(pa) - Number(pb))
        .map(([item, pos]) => `${pos}. ${item}`)
        .join('\n')
    }
  }

  if (NUMERIC_TYPES.includes(q.question_type)) {
    if (v != null && Number.isFinite(Number(v))) return String(v)
    if (t && !Number.isNaN(Number(t))) return t
  }

  if (CHOICE_TYPES.includes(q.question_type)) {
    if (t) return t
    if (v != null) return String(v)
  }

  if (t) return t
  if (v != null) return String(v)
  return '—'
}
