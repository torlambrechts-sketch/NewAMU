import type { CatalogTemplateQuestion } from './surveyTemplateCatalogTypes'
import type { OrgSurveyQuestionRow, SurveyQuestionType } from './types'

/**
 * Best-effort mapping from persisted `org_survey_questions` rows to catalog body format.
 * Used when saving a survey as an org template (round-trip is approximate for edge cases).
 */
export function orgQuestionToCatalogQuestion(q: OrgSurveyQuestionRow, orderIndex: number): CatalogTemplateQuestion {
  const cfg = (q.config && typeof q.config === 'object' ? q.config : {}) as Record<string, unknown>
  const id = `q-${orderIndex}-${q.id.slice(0, 8)}`
  const base = {
    id,
    text: q.question_text,
    required: q.is_required,
  }

  const t: SurveyQuestionType = q.question_type

  if (t === 'text') {
    return { ...base, type: 'text' }
  }
  if (t === 'yes_no') {
    return { ...base, type: 'yes_no' }
  }

  if (t === 'multiple_choice' || t === 'single_select' || t === 'multi_select') {
    const options = Array.isArray(cfg.options) ? (cfg.options as string[]).filter((x) => typeof x === 'string') : []
    const catalogType =
      t === 'single_select' ? 'single_select' : t === 'multi_select' ? 'multi_select' : 'multiple_choice'
    return {
      ...base,
      type: catalogType,
      options: options.length > 0 ? options : undefined,
    }
  }

  if (t === 'rating_1_to_10') {
    const low = typeof cfg.anchors === 'object' && cfg.anchors && 'low' in (cfg.anchors as object)
      ? String((cfg.anchors as { low?: string }).low ?? '0')
      : '0'
    const high = typeof cfg.anchors === 'object' && cfg.anchors && 'high' in (cfg.anchors as object)
      ? String((cfg.anchors as { high?: string }).high ?? '10')
      : '10'
    return {
      ...base,
      type: 'scale_10',
      scale: '0-10',
      anchors: { low, high },
    }
  }

  if (t === 'rating_1_to_5') {
    const smax = typeof cfg.scaleMax === 'number' ? cfg.scaleMax : 5
    const smin = typeof cfg.scaleMin === 'number' ? cfg.scaleMin : 1
    const subscale = typeof cfg.subscale === 'string' ? cfg.subscale : undefined
    const anchors =
      typeof cfg.anchors === 'object' && cfg.anchors && 'low' in (cfg.anchors as object)
        ? {
            low: String((cfg.anchors as { low?: string }).low ?? ''),
            high: String((cfg.anchors as { high?: string }).high ?? ''),
          }
        : undefined

    if (smax >= 7 && smin <= 1) {
      return {
        ...base,
        type: 'likert_7',
        subscale,
        anchors: anchors ?? { low: 'Aldri', high: 'Alltid' },
      }
    }
    return {
      ...base,
      type: 'likert_5',
      subscale,
      anchors: anchors ?? { low: 'Svært uenig', high: 'Svært enig' },
    }
  }

  return { ...base, type: 'text' }
}
