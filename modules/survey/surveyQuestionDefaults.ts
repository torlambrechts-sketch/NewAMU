import type { SurveyQuestionType } from './types'

/** Default spørsmålstekst og config når bruker legger til fra palett (bygger). */
export function defaultQuestionPayload(type: SurveyQuestionType): {
  questionText: string
  config: Record<string, unknown>
} {
  switch (type) {
    case 'text':
      return { questionText: 'Nytt fritekstspørsmål', config: {} }
    case 'yes_no':
      return { questionText: 'Ja eller nei?', config: {} }
    case 'rating_1_to_5':
      return {
        questionText: 'Vurder på skala 1–5',
        config: {
          scaleMin: 1,
          scaleMax: 5,
          anchors: { low: 'Svært uenig', high: 'Svært enig' },
        },
      }
    case 'rating_1_to_10':
      return {
        questionText: 'Vurder på skala 0–10',
        config: {
          scaleMin: 0,
          scaleMax: 10,
          anchors: { low: '0', high: '10' },
        },
      }
    case 'multiple_choice':
      return {
        questionText: 'Velg ett alternativ',
        config: { options: ['Ja', 'Nei', 'Vet ikke'] },
      }
    case 'single_select':
      return {
        questionText: 'Velg ett alternativ',
        config: { options: ['Alternativ 1', 'Alternativ 2', 'Alternativ 3'] },
      }
    case 'multi_select':
      return {
        questionText: 'Velg ett eller flere',
        config: { options: ['A', 'B', 'C'], minSelections: 0 },
      }
    default:
      return { questionText: 'Nytt spørsmål', config: {} }
  }
}
