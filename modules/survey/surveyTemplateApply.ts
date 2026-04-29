import type { SurveyQuestionType } from './types'
import type { CatalogTemplateQuestion } from './surveyTemplateCatalogTypes'
import { defaultQuestionPayload } from './surveyQuestionDefaults'

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
    case 'short_text':
      return {
        questionText: q.text,
        questionType: 'short_text',
        orderIndex,
        isRequired: q.required,
        config: defaultQuestionPayload('short_text').config,
      }
    case 'long_text':
      return {
        questionText: q.text,
        questionType: 'long_text',
        orderIndex,
        isRequired: q.required,
        config: defaultQuestionPayload('long_text').config,
      }
    case 'email':
      return {
        questionText: q.text,
        questionType: 'email',
        orderIndex,
        isRequired: q.required,
        config: {},
      }
    case 'number':
      return {
        questionText: q.text,
        questionType: 'number',
        orderIndex,
        isRequired: q.required,
        config: defaultQuestionPayload('number').config,
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
    case 'dropdown':
      return {
        questionText: q.text,
        questionType: 'dropdown',
        orderIndex,
        isRequired: q.required,
        config: {
          options: Array.isArray(q.options) ? q.options : ['Alternativ 1', 'Alternativ 2'],
          searchable: false,
          allowOther: false,
        },
      }
    case 'image_choice':
      return {
        questionText: q.text,
        questionType: 'image_choice',
        orderIndex,
        isRequired: q.required,
        config: defaultQuestionPayload('image_choice').config,
      }
    case 'rating_visual':
      return {
        questionText: q.text,
        questionType: 'rating_visual',
        orderIndex,
        isRequired: q.required,
        config: defaultQuestionPayload('rating_visual').config,
      }
    case 'slider':
      return {
        questionText: q.text,
        questionType: 'slider',
        orderIndex,
        isRequired: q.required,
        config: defaultQuestionPayload('slider').config,
      }
    case 'likert_scale':
      return {
        questionText: q.text,
        questionType: 'likert_scale',
        orderIndex,
        isRequired: q.required,
        config: defaultQuestionPayload('likert_scale').config,
      }
    case 'matrix':
      return {
        questionText: q.text,
        questionType: 'matrix',
        orderIndex,
        isRequired: q.required,
        config: {
          rows: Array.isArray(q.rows) && q.rows.length > 0 ? q.rows : ['Påstand 1', 'Påstand 2'],
          columns: Array.isArray(q.columns) && q.columns.length > 0 ? q.columns : ['1', '2', '3', '4', '5'],
        },
      }
    case 'ranking':
      return {
        questionText: q.text,
        questionType: 'ranking',
        orderIndex,
        isRequired: q.required,
        config: {
          items: Array.isArray(q.items) && q.items.length > 0 ? q.items : ['A', 'B', 'C'],
          fixedOrder: false,
        },
      }
    case 'nps':
      return {
        questionText: q.text,
        questionType: 'nps',
        orderIndex,
        isRequired: q.required,
        config: defaultQuestionPayload('nps').config,
      }
    case 'file_upload':
      return {
        questionText: q.text,
        questionType: 'file_upload',
        orderIndex,
        isRequired: q.required,
        config: defaultQuestionPayload('file_upload').config,
      }
    case 'datetime':
      return {
        questionText: q.text,
        questionType: 'datetime',
        orderIndex,
        isRequired: q.required,
        config: defaultQuestionPayload('datetime').config,
      }
    case 'signature':
      return {
        questionText: q.text,
        questionType: 'signature',
        orderIndex,
        isRequired: q.required,
        config: {},
      }
      return {
        questionText: q.text,
        questionType: 'text',
        orderIndex,
        isRequired: q.required,
        config: {},
      }
  }
}
