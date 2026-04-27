import type { SurveyQuestionType } from './types'
import type { CatalogTemplateQuestion } from './surveyTemplateCatalogTypes'

export type QuestionUpsertFromCatalog = {
  questionText: string
  questionType: SurveyQuestionType
  orderIndex: number
  isRequired: boolean
  config: Record<string, unknown>
}

/**
 * Maps catalog question definitions (JSON body) to persisted org_survey_questions rows.
 */
export function catalogQuestionToUpsert(q: CatalogTemplateQuestion, orderIndex: number): QuestionUpsertFromCatalog {
  const scaleAnchors = q.anchors ? { low: q.anchors.low, high: q.anchors.high } : undefined

  switch (q.type) {
    case 'text':
      return {
        questionText: q.text,
        questionType: 'text',
        orderIndex,
        isRequired: q.required,
        config: {},
      }
    case 'yes_no':
      return {
        questionText: q.text,
        questionType: 'yes_no',
        orderIndex,
        isRequired: q.required,
        config: {},
      }
    case 'likert_5':
      return {
        questionText: q.text,
        questionType: 'rating_1_to_5',
        orderIndex,
        isRequired: q.required,
        config: {
          scaleMin: 1,
          scaleMax: 5,
          subscale: q.subscale,
          anchors: scaleAnchors ?? { low: 'Svært uenig', high: 'Svært enig' },
        },
      }
    case 'likert_7':
      return {
        questionText: q.text,
        questionType: 'rating_1_to_5',
        orderIndex,
        isRequired: q.required,
        config: {
          scaleMin: 1,
          scaleMax: 7,
          subscale: q.subscale,
          anchors: scaleAnchors ?? { low: 'Aldri', high: 'Alltid' },
        },
      }
    case 'scale_10':
      return {
        questionText: q.text,
        questionType: 'rating_1_to_10',
        orderIndex,
        isRequired: q.required,
        config: {
          scaleMin: 0,
          scaleMax: 10,
          anchors: scaleAnchors ?? { low: '0', high: '10' },
        },
      }
    case 'single_select':
      return {
        questionText: q.text,
        questionType: 'single_select',
        orderIndex,
        isRequired: q.required,
        config: {
          options: Array.isArray(q.options) ? q.options : [],
          allowOther: false,
        },
      }
    case 'multi_select':
      return {
        questionText: q.text,
        questionType: 'multi_select',
        orderIndex,
        isRequired: q.required,
        config: {
          options: Array.isArray(q.options) ? q.options : [],
          minSelections: q.required ? 1 : 0,
        },
      }
    case 'multiple_choice':
      return {
        questionText: q.text,
        questionType: 'multiple_choice',
        orderIndex,
        isRequired: q.required,
        config: {
          options: Array.isArray(q.options) && q.options.length > 0 ? q.options : ['Ja', 'Nei', 'Vet ikke'],
        },
      }
    default:
      return {
        questionText: q.text,
        questionType: 'text',
        orderIndex,
        isRequired: q.required,
        config: {},
      }
  }
}
