import type { OrgSurveyAnswerRow, OrgSurveyQuestionRow, SurveyQuestionType } from './types'
import { parseMatrixRankingJson } from './surveyRespondValidation'

export type QuestionAnalyticsBucket = {
  type: SurveyQuestionType
  label: string
  numbers: number[]
  textCount: number
  choiceCounts: Record<string, number>
  /** Matrise: rad → valgt kolonne → antall svar */
  matrixRowChoiceCounts: Record<string, Record<string, number>> | null
  /** Rangering: element → plassering (1,2,…) → antall */
  rankingPositionCounts: Record<string, Record<string, number>> | null
  /** Gjennomsnittlig plass per element (lavere = viktigere) */
  rankingAverageByItem: Record<string, number> | null
}

function bumpNested(
  outer: Record<string, Record<string, number>>,
  key1: string,
  key2: string,
): void {
  if (!outer[key1]) outer[key1] = {}
  const inner = outer[key1]!
  inner[key2] = (inner[key2] ?? 0) + 1
}

/** Aggregate answers by question type — extended types fall back to text/choice patterns where applicable */
export function buildAnalyticsByQuestionId(
  questions: OrgSurveyQuestionRow[],
  answers: OrgSurveyAnswerRow[],
): Record<string, QuestionAnalyticsBucket> {
  const byQ: Record<string, QuestionAnalyticsBucket> = {}
  for (const q of questions) {
    byQ[q.id] = {
      type: q.question_type,
      label: q.question_text,
      numbers: [],
      textCount: 0,
      choiceCounts: {},
      matrixRowChoiceCounts: q.question_type === 'matrix' ? {} : null,
      rankingPositionCounts: q.question_type === 'ranking' ? {} : null,
      rankingAverageByItem: q.question_type === 'ranking' ? {} : null,
    }
  }
  const qById = new Map(questions.map((q) => [q.id, q]))
  for (const a of answers) {
    const bucket = byQ[a.question_id]
    if (!bucket) continue
    const qDef = qById.get(a.question_id)

    if (bucket.type === 'matrix' && a.answer_text?.trim()) {
      const o = parseMatrixRankingJson(a.answer_text)
      if (o && Object.keys(o).length > 0) {
        bucket.textCount += 1
        const cfg = qDef?.config as { rows?: string[] } | undefined
        const rows = Array.isArray(cfg?.rows) ? cfg.rows : Object.keys(o)
        for (const row of rows) {
          const col = o[row]
          if (typeof col === 'string' && col.trim()) {
            if (bucket.matrixRowChoiceCounts) bumpNested(bucket.matrixRowChoiceCounts, row, col.trim())
          }
        }
      }
      continue
    }

    if (bucket.type === 'ranking' && a.answer_text?.trim()) {
      const o = parseMatrixRankingJson(a.answer_text)
      if (o && Object.keys(o).length > 0) {
        bucket.textCount += 1
        const cfg = qDef?.config as { items?: string[] } | undefined
        const items = Array.isArray(cfg?.items) ? cfg.items : Object.keys(o)
        for (const it of items) {
          const pos = o[it]
          if (pos != null && String(pos).trim() !== '') {
            if (bucket.rankingPositionCounts) bumpNested(bucket.rankingPositionCounts, it, String(pos).trim())
          }
        }
      }
      continue
    }

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
        bucket.type === 'file_upload') &&
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

  for (const q of questions) {
    const b = byQ[q.id]
    if (!b || b.type !== 'ranking' || !b.rankingPositionCounts || !b.rankingAverageByItem) continue
    for (const [item, posMap] of Object.entries(b.rankingPositionCounts)) {
      let sum = 0
      let w = 0
      for (const [posStr, cnt] of Object.entries(posMap)) {
        const pos = Number(posStr)
        if (!Number.isFinite(pos) || cnt <= 0) continue
        sum += pos * cnt
        w += cnt
      }
      if (w > 0) b.rankingAverageByItem[item] = sum / w
    }
  }

  return byQ
}
