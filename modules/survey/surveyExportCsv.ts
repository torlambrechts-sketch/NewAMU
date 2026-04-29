import type { OrgSurveyAnswerRow, OrgSurveyQuestionRow, SurveyRow, SurveySectionRow } from './types'
import type { NumericStatsRow } from './surveyAnalyticsRpc'
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
  /** Når satt (f.eks. fra RPC under k-anonymitet), overstyr valgtelling for eksport */
  analyticsOverride?: Record<string, Record<string, number> | null | undefined>
  numericOverride?: Record<string, NumericStatsRow | null | 'error' | undefined>
}): string {
  const { survey, questions, answers, sections, analyticsOverride, numericOverride } = params
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
    const rpcChoice = analyticsOverride?.[qid]
    const rpcNum = numericOverride?.[qid]
    let metric = ''
    let note = ''
    if (
      q.question_type === 'rating_1_to_5' ||
      q.question_type === 'rating_1_to_10' ||
      q.question_type === 'nps' ||
      q.question_type === 'rating_visual' ||
      q.question_type === 'likert_scale' ||
      q.question_type === 'slider'
    ) {
      const st = rpcNum && rpcNum !== 'error' ? rpcNum : null
      const nums = a?.numbers ?? []
      const n = st?.n ?? nums.length
      const avg =
        st?.avg_val != null ? Number(st.avg_val) : n > 0 ? nums.reduce((x, y) => x + y, 0) / n : 0
      metric = n > 0 ? `Snitt ${avg.toFixed(2)} (n=${n})` : 'Ingen tall'
      note = 'Gjennomsnitt av numeriske svar.'
    } else if (q.question_type === 'number') {
      const st = rpcNum && rpcNum !== 'error' ? rpcNum : null
      const nums = a?.numbers ?? []
      const n = st?.n ?? nums.length
      const avg =
        st?.avg_val != null ? Number(st.avg_val) : n > 0 ? nums.reduce((x, y) => x + y, 0) / n : 0
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
      note = 'Per rad: hyppigste kolonne (aggregert). Full matrise: ekstra rader under.'
      lines.push([q.question_text, q.question_type, sectionLabel, metric, note].map(csvEscapeCell).join(';'))
      for (const [row, cols] of Object.entries(rowCounts)) {
        const rowTotal = Object.values(cols).reduce((s, v) => s + v, 0) || 1
        for (const [col, cnt] of Object.entries(cols)) {
          lines.push(
            [`${q.question_text} · ${row}`, 'matrise_celle', sectionLabel, `${col}: ${Math.round((cnt / rowTotal) * 100)}%`, 'Andel innen rad']
              .map(csvEscapeCell)
              .join(';'),
          )
        }
      }
      continue
    } else if (q.question_type === 'ranking') {
      const rankCounts = a?.rankingPositionCounts ?? {}
      const avgMap = a?.rankingAverageByItem ?? {}
      const parts: string[] = []
      for (const [item, posMap] of Object.entries(rankCounts)) {
        const total = Object.values(posMap).reduce((s, v) => s + v, 0) || 1
        const topPos = Object.entries(posMap).sort((x, y) => y[1] - x[1])[0]
        const avgItem = avgMap[item]
        const avgStr =
          avgItem != null && Number.isFinite(avgItem) ? ` · gj.sn.plass ${avgItem.toFixed(2)}` : ''
        if (topPos) parts.push(`${item}: oftest plass ${topPos[0]} (${Math.round((topPos[1] / total) * 100)}%)${avgStr}`)
      }
      metric = parts.length ? parts.slice(0, 8).join(' · ') : 'Ingen rangering'
      note = 'Per element: vanligste rangering + gj.sn. plass der tilgjengelig.'
    } else if (
      q.question_type === 'multiple_choice' ||
      q.question_type === 'yes_no' ||
      q.question_type === 'single_select' ||
      q.question_type === 'multi_select' ||
      q.question_type === 'dropdown' ||
      q.question_type === 'image_choice'
    ) {
      const choiceSrc =
        rpcChoice != null && Object.keys(rpcChoice).length > 0 ? rpcChoice : (a?.choiceCounts ?? {})
      const entries = Object.entries(choiceSrc)
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
