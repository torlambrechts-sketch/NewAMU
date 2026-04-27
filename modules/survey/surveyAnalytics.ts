import type { OrgSurveyAnswerRow, OrgSurveyQuestionRow, SurveyQuestionType } from './types'

/** One pass over answers; use in useMemo for stable references when questions/answers change. */
export function buildAnalyticsByQuestionId(
  questions: OrgSurveyQuestionRow[],
  answers: OrgSurveyAnswerRow[],
): Record<
  string,
  {
    type: SurveyQuestionType
    label: string
    numbers: number[]
    textCount: number
    choiceCounts: Record<string, number>
  }
> {
  const byQ: Record<
    string,
    {
      type: SurveyQuestionType
      label: string
      numbers: number[]
      textCount: number
      choiceCounts: Record<string, number>
    }
  > = {}
  for (const q of questions) {
    byQ[q.id] = {
      type: q.question_type,
      label: q.question_text,
      numbers: [],
      textCount: 0,
      choiceCounts: {},
    }
  }
  for (const a of answers) {
    const bucket = byQ[a.question_id]
    if (!bucket) continue
    if (
      (bucket.type === 'rating_1_to_5' || bucket.type === 'rating_1_to_10') &&
      a.answer_value != null
    ) {
      bucket.numbers.push(Number(a.answer_value))
    } else if (bucket.type === 'text' && a.answer_text && a.answer_text.trim()) {
      bucket.textCount += 1
    } else if (
      (bucket.type === 'multiple_choice' ||
        bucket.type === 'yes_no' ||
        bucket.type === 'single_select' ||
        bucket.type === 'multi_select') &&
      a.answer_text
    ) {
      const k = a.answer_text.trim() || '(tomt)'
      bucket.choiceCounts[k] = (bucket.choiceCounts[k] ?? 0) + 1
    }
  }
  return byQ
}
