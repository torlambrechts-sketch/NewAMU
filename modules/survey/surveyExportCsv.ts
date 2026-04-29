import type { OrgSurveyAnswerRow, OrgSurveyQuestionRow, SurveyRow, SurveySectionRow } from './types'
import { buildAnalyticsByQuestionId } from './surveyAnalytics'
import { globalQuestionIdOrder } from './surveyQuestionGlobalOrder'

function csvEscapeCell(s: string): string {
  const t = s.replace(/"/g, '""')
  if (/[",\n\r;]/.test(t)) return `"${t}"`
  return t
}

/** Aggregerte tall til semikolon-separert CSV (Excel-vennlig med norsk locale). */
export function buildSurveyAnalyticsCsv(params: {
  survey: SurveyRow
  questions: OrgSurveyQuestionRow[]
  answers: OrgSurveyAnswerRow[]
  sections: SurveySectionRow[]
}): string {
  const { survey, questions, answers, sections } = params
  const analyticsByQuestion = buildAnalyticsByQuestionId(questions, answers)
  const order = globalQuestionIdOrder(questions, survey.id, sections)
  const qMap = new Map(questions.map((q) => [q.id, q]))
  const secTitle: Record<string, string> = {}
  for (const s of sections) secTitle[s.id] = s.title

  const lines: string[] = []
  lines.push(['Spørsmål', 'Type', 'Seksjon', 'Nøkkeltall', 'Merknad'].map(csvEscapeCell).join(';'))

  for (const qid of order) {
    const q = qMap.get(qid)
    if (!q) continue
    const a = analyticsByQuestion[qid]
    const sectionLabel = q.section_id ? secTitle[q.section_id] ?? '' : 'Uten seksjon'
    let metric = ''
    let note = ''
    const nums = a?.numbers ?? []
    const n = nums.length
    if (
      q.question_type === 'rating_1_to_5' ||
      q.question_type === 'rating_1_to_10' ||
      q.question_type === 'nps' ||
      q.question_type === 'rating_visual' ||
      q.question_type === 'likert_scale' ||
      q.question_type === 'slider'
    ) {
      const avg = n > 0 ? nums.reduce((x, y) => x + y, 0) / n : 0
      metric = n > 0 ? `Snitt ${avg.toFixed(2)} (n=${n})` : 'Ingen tall'
      note = 'Gjennomsnitt av numeriske svar.'
    } else if (q.question_type === 'number') {
      const nums = a?.numbers ?? []
      const n = nums.length
      const avg = n > 0 ? nums.reduce((x, y) => x + y, 0) / n : 0
      metric = n > 0 ? `Snitt ${avg.toFixed(2)} (n=${n})` : 'Ingen tall'
      note = 'Gjennomsnitt av numeriske svar.'
    } else if (q.question_type === 'matrix') {
      const rowCounts = a?.matrixRowChoiceCounts ?? {}
      const parts: string[] = []
      for (const [row, cols] of Object.entries(rowCounts)) {
        const total = Object.values(cols).reduce((s, v) => s + v, 0) || 1
        const top = Object.entries(cols).sort((x, y) => y[1] - x[1])[0]
        if (top) parts.push(`${row}: mest "${top[0]}" (${Math.round((top[1] / total) * 100)}%)`)
      }
      metric = parts.length ? parts.slice(0, 6).join(' · ') : 'Ingen matrisesvar'
      note = 'Per rad: hyppigste kolonne (aggregert).'
    } else if (q.question_type === 'ranking') {
      const rankCounts = a?.rankingPositionCounts ?? {}
      const parts: string[] = []
      for (const [item, posMap] of Object.entries(rankCounts)) {
        const total = Object.values(posMap).reduce((s, v) => s + v, 0) || 1
        const topPos = Object.entries(posMap).sort((x, y) => y[1] - x[1])[0]
        if (topPos) parts.push(`${item}: oftest plass ${topPos[0]} (${Math.round((topPos[1] / total) * 100)}%)`)
      }
      metric = parts.length ? parts.slice(0, 6).join(' · ') : 'Ingen rangering'
      note = 'Per element: vanligste rangering (aggregert).'
    } else if (
      q.question_type === 'multiple_choice' ||
      q.question_type === 'yes_no' ||
      q.question_type === 'single_select' ||
      q.question_type === 'multi_select' ||
      q.question_type === 'dropdown' ||
      q.question_type === 'image_choice'
    ) {
      const entries = Object.entries(a?.choiceCounts ?? {})
      const total = entries.reduce((s, [, v]) => s + v, 0)
      metric =
        total > 0
          ? entries
              .map(([k, v]) => `${k}: ${Math.round((v / total) * 100)}%`)
              .slice(0, 8)
              .join(' · ')
          : 'Ingen valg'
      note = 'Andel av svar per alternativ (toppvisning).'
    } else {
      metric = `${a?.textCount ?? 0} utfylte svar`
      note = 'Tekst ikke eksportert (personvern).'
    }
    lines.push(
      [q.question_text, q.question_type, sectionLabel, metric, note].map(csvEscapeCell).join(';'),
    )
  }

  return lines.join('\r\n')
}
