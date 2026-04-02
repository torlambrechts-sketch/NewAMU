import type { PsykosocialDimension, Survey, SurveyResponse } from '../types/orgHealth'

/** 1–5 Likert → høyere er bedre (belastningsspørsmål snus). */
export function normalizedLikert(raw: number, reverseScored?: boolean): number {
  if (reverseScored) return 6 - raw
  return raw
}

export function dimensionMeansForResponses(
  survey: Survey,
  responses: SurveyResponse[],
): {
  dimensionMeans: Partial<Record<PsykosocialDimension, number>>
  psykosocialIndex: number | null
} {
  const likertQs = survey.questions.filter((q) => q.type === 'likert_5' && q.dimension)
  if (likertQs.length === 0 || responses.length === 0) {
    return { dimensionMeans: {}, psykosocialIndex: null }
  }

  const dims = [...new Set(likertQs.map((q) => q.dimension!))]

  const perPersonDim: Partial<Record<PsykosocialDimension, number>>[] = []

  for (const r of responses) {
    const row: Partial<Record<PsykosocialDimension, number>> = {}
    for (const d of dims) {
      const items = likertQs.filter((q) => q.dimension === d)
      const vals: number[] = []
      for (const q of items) {
        const v = r.answers[q.id]
        if (typeof v === 'number' && v >= 1 && v <= 5) {
          vals.push(normalizedLikert(v, q.reverseScored))
        }
      }
      if (vals.length > 0) {
        row[d] = vals.reduce((a, b) => a + b, 0) / vals.length
      }
    }
    perPersonDim.push(row)
  }

  const dimensionMeans: Partial<Record<PsykosocialDimension, number>> = {}
  for (const d of dims) {
    const nums = perPersonDim.map((p) => p[d]).filter((x): x is number => typeof x === 'number')
    if (nums.length > 0) {
      dimensionMeans[d] = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
    }
  }

  const dmVals = Object.values(dimensionMeans).filter((x): x is number => typeof x === 'number')
  const psykosocialIndex =
    dmVals.length > 0 ? Math.round((dmVals.reduce((a, b) => a + b, 0) / dmVals.length) * 100) / 100 : null

  return { dimensionMeans, psykosocialIndex }
}

export function itemNormalizedMeans(
  survey: Survey,
  responses: SurveyResponse[],
): Record<string, number> {
  const out: Record<string, number> = {}
  const likertQs = survey.questions.filter((q) => q.type === 'likert_5')
  for (const q of likertQs) {
    const vals: number[] = []
    for (const r of responses) {
      const v = r.answers[q.id]
      if (typeof v === 'number' && v >= 1 && v <= 5) {
        vals.push(normalizedLikert(v, q.reverseScored))
      }
    }
    if (vals.length > 0) {
      out[q.id] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
    }
  }
  return out
}
