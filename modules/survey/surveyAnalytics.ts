import type { OrgSurveyAnswerRow, OrgSurveyQuestionRow, SurveyQuestionType } from './types'

/** Aggregate answers by question type — extended types fall back to text/choice patterns where applicable */
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
      (bucket.type === 'rating_1_to_5' ||
        bucket.type === 'rating_1_to_10' ||
        bucket.type === 'nps' ||
        bucket.type === 'rating_visual' ||
        bucket.type === 'likert_scale') &&
      a.answer_value != null
    ) {
      bucket.numbers.push(Number(a.answer_value))
    } else if (
      bucket.type === 'slider' &&
      a.answer_value != null &&
      Number.isFinite(Number(a.answer_value))
    ) {
      bucket.numbers.push(Number(a.answer_value))
    } else if (bucket.type === 'slider' && a.answer_text?.trim()) {
      const sn = Number(a.answer_text.trim())
      if (!Number.isNaN(sn)) bucket.numbers.push(sn)
    } else if (
      bucket.type === 'number' &&
      a.answer_value != null &&
      Number.isFinite(Number(a.answer_value))
    ) {
      bucket.numbers.push(Number(a.answer_value))
    } else if (
      (bucket.type === 'text' ||
        bucket.type === 'long_text' ||
        bucket.type === 'short_text' ||
        bucket.type === 'email' ||
        bucket.type === 'datetime' ||
        bucket.type === 'signature' ||
        bucket.type === 'file_upload' ||
        bucket.type === 'matrix' ||
        bucket.type === 'ranking') &&
      a.answer_text &&
      a.answer_text.trim()
    ) {
      bucket.textCount += 1
    } else if (
      (bucket.type === 'multiple_choice' ||
        bucket.type === 'yes_no' ||
        bucket.type === 'single_select' ||
        bucket.type === 'multi_select' ||
        bucket.type === 'dropdown' ||
        bucket.type === 'image_choice') &&
      a.answer_text
    ) {
      const k = a.answer_text.trim() || '(tomt)'
      bucket.choiceCounts[k] = (bucket.choiceCounts[k] ?? 0) + 1
    }
  }
  return byQ
}
