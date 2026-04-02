import type { Survey, SurveyResponse } from '../types/orgHealth'

export type NpsBreakdown = {
  promoters: number
  passives: number
  detractors: number
  /** -100 to 100 */
  score: number | null
  average: number | null
  /** count per 0-10 */
  distribution: Record<number, number>
}

export function computeNpsBreakdown(questionId: string, responses: SurveyResponse[]): NpsBreakdown {
  const scores: number[] = []
  const distribution: Record<number, number> = {}
  for (let i = 0; i <= 10; i++) distribution[i] = 0

  for (const r of responses) {
    const v = r.answers[questionId]
    if (typeof v !== 'number' || v < 0 || v > 10) continue
    const n = Math.round(v)
    scores.push(n)
    distribution[n] = (distribution[n] ?? 0) + 1
  }

  if (scores.length === 0) {
    return {
      promoters: 0,
      passives: 0,
      detractors: 0,
      score: null,
      average: null,
      distribution,
    }
  }

  let promoters = 0
  let passives = 0
  let detractors = 0
  for (const s of scores) {
    if (s >= 9) promoters++
    else if (s <= 6) detractors++
    else passives++
  }
  const n = scores.length
  const score = Math.round(((promoters / n) * 100 - (detractors / n) * 100) * 10) / 10
  const average = Math.round((scores.reduce((a, b) => a + b, 0) / n) * 100) / 100

  return { promoters, passives, detractors, score, average, distribution }
}

export function choiceDistribution(
  questionId: string,
  options: string[],
  responses: SurveyResponse[],
): { option: string; count: number; pct: number }[] {
  const counts: Record<string, number> = {}
  for (const o of options) counts[o] = 0
  let total = 0
  for (const r of responses) {
    const v = r.answers[questionId]
    if (typeof v !== 'string') continue
    const key = options.includes(v) ? v : v
    if (counts[key] === undefined) counts[key] = 0
    counts[key]++
    total++
  }
  return options.map((option) => ({
    option,
    count: counts[option] ?? 0,
    pct: total > 0 ? Math.round(((counts[option] ?? 0) / total) * 1000) / 10 : 0,
  }))
}

export function surveyFollowUpTaskDescription(survey: Survey, summaryLines: string[]): string {
  const lines = [
    `Undersøkelse: ${survey.title}`,
    survey.targetAudienceNote ? `Målgruppe: ${survey.targetAudienceNote}` : null,
    survey.followUpPlan ? `Planlagt oppfølging: ${survey.followUpPlan}` : null,
    ...summaryLines,
    '',
    'Anbefalt oppfølging: gjennomgå resultater i ledergruppe, kommuniser hovedfunn til ansatte, og dokumenter tiltak i internkontroll.',
  ].filter(Boolean)
  return lines.join('\n')
}
