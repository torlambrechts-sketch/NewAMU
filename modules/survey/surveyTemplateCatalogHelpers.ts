import type { CatalogTemplateQuestion } from './surveyTemplateCatalogTypes'
import type { OrgSurveyQuestionRow, SurveyQuestionType } from './types'

/**
 * Best-effort mapping from persisted `org_survey_questions` rows to catalog body format.
 * Used when saving a survey as an org template (round-trip is approximate for edge cases).
 */
export function orgQuestionToCatalogQuestion(q: OrgSurveyQuestionRow, orderIndex: number): CatalogTemplateQuestion {
  const cfg = (q.config && typeof q.config === 'object' ? q.config : {}) as Record<string, unknown>
  const id = `q-${orderIndex}-${q.id.slice(0, 8)}`
  const baseMeta = {
    id,
    text: q.question_text,
    required: q.is_required,
    ...(q.is_mandatory ? { is_mandatory: true as const } : {}),
    ...(q.mandatory_law ? { mandatory_law: q.mandatory_law } : {}),
  }

  const t: SurveyQuestionType = q.question_type

  if (t === 'text') return { ...baseMeta, type: 'text' }
  if (t === 'short_text') return { ...baseMeta, type: 'short_text' }
  if (t === 'long_text') return { ...baseMeta, type: 'long_text' }
  if (t === 'email') return { ...baseMeta, type: 'email' }
  if (t === 'yes_no') return { ...baseMeta, type: 'yes_no' }

  if (t === 'number') return { ...baseMeta, type: 'number' }

  if (t === 'multiple_choice' || t === 'single_select' || t === 'multi_select') {
    const options = Array.isArray(cfg.options) ? (cfg.options as string[]).filter((x) => typeof x === 'string') : []
    const catalogType =
      t === 'single_select' ? 'single_select' : t === 'multi_select' ? 'multi_select' : 'multiple_choice'
    return {
      ...baseMeta,
      type: catalogType,
      options: options.length > 0 ? options : undefined,
    }
  }

  if (t === 'dropdown') {
    const options = Array.isArray(cfg.options) ? (cfg.options as string[]).filter((x) => typeof x === 'string') : []
    return { ...baseMeta, type: 'dropdown', options: options.length > 0 ? options : undefined }
  }

  if (t === 'image_choice') return { ...baseMeta, type: 'image_choice' }

  if (t === 'rating_visual') return { ...baseMeta, type: 'rating_visual' }
  if (t === 'slider') return { ...baseMeta, type: 'slider' }
  if (t === 'likert_scale') return { ...baseMeta, type: 'likert_scale' }
  if (t === 'matrix') {
    const rows = Array.isArray(cfg.rows) ? (cfg.rows as string[]) : []
    const columns = Array.isArray(cfg.columns) ? (cfg.columns as string[]) : []
    return {
      ...baseMeta,
      type: 'matrix',
      rows: rows.length > 0 ? rows : undefined,
      columns: columns.length > 0 ? columns : undefined,
    }
  }
  if (t === 'ranking') {
    const items = Array.isArray(cfg.items) ? (cfg.items as string[]) : []
    return { ...baseMeta, type: 'ranking', items: items.length > 0 ? items : undefined }
  }
  if (t === 'nps') return { ...baseMeta, type: 'nps' }
  if (t === 'file_upload') return { ...baseMeta, type: 'file_upload' }
  if (t === 'datetime') return { ...baseMeta, type: 'datetime' }
  if (t === 'signature') return { ...baseMeta, type: 'signature' }

  if (t === 'rating_1_to_10') {
    const low =
      typeof cfg.anchors === 'object' && cfg.anchors && 'low' in (cfg.anchors as object)
        ? String((cfg.anchors as { low?: string }).low ?? '0')
        : '0'
    const high =
      typeof cfg.anchors === 'object' && cfg.anchors && 'high' in (cfg.anchors as object)
        ? String((cfg.anchors as { high?: string }).high ?? '10')
        : '10'
    return {
      ...baseMeta,
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
        ...baseMeta,
        type: 'likert_7',
        subscale,
        anchors: anchors ?? { low: 'Aldri', high: 'Alltid' },
      }
    }
    return {
      ...baseMeta,
      type: 'likert_5',
      subscale,
      anchors: anchors ?? { low: 'Svært uenig', high: 'Svært enig' },
    }
  }

  return { ...baseMeta, type: 'text' }
}
