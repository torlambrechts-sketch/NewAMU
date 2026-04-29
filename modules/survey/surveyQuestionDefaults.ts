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
        config: { options: ['A', 'B', 'C'], minSelections: 0, maxSelections: null },
      }
    case 'short_text':
      return {
        questionText: 'Kort svar',
        config: { minLength: null, maxLength: 255, regexPattern: null },
      }
    case 'long_text':
      return {
        questionText: 'Utdyp gjerne',
        config: { wordCountLimit: null },
      }
    case 'email':
      return {
        questionText: 'E-postadresse',
        config: {},
      }
    case 'number':
      return {
        questionText: 'Angi et tall',
        config: { minValue: null, maxValue: null, step: null, integerOnly: false },
      }
    case 'rating_visual':
      return {
        questionText: 'Gi en vurdering',
        config: {
          scaleMax: 5,
          shapeType: 'star',
          anchors: { low: 'Dårlig', high: 'Utmerket' },
        },
      }
    case 'slider':
      return {
        questionText: 'Skyv markøren',
        config: {
          rangeStart: 0,
          rangeEnd: 100,
          stepIncrement: 1,
          labels: { low: 'Lite', high: 'Mye' },
        },
      }
    case 'dropdown':
      return {
        questionText: 'Velg fra listen',
        config: {
          options: ['Alternativ 1', 'Alternativ 2'],
          searchable: false,
          allowOther: false,
        },
      }
    case 'image_choice':
      return {
        questionText: 'Velg et bilde',
        config: {
          choices: [
            { label: 'A', image_url: '' },
            { label: 'B', image_url: '' },
          ],
          allowOther: false,
        },
      }
    case 'likert_scale':
      return {
        questionText: 'I hvilken grad er du enig?',
        config: {
          scaleMin: 1,
          scaleMax: 5,
          labels: ['Helt uenig', 'Uenig', 'Nøytral', 'Enig', 'Helt enig'],
        },
      }
    case 'matrix':
      return {
        questionText: 'Vurder hver rad',
        config: {
          rows: ['Påstand 1', 'Påstand 2'],
          columns: ['1', '2', '3', '4', '5'],
        },
      }
    case 'ranking':
      return {
        questionText: 'Ranger etter viktighet',
        config: { items: ['A', 'B', 'C'], fixedOrder: false },
      }
    case 'nps':
      return {
        questionText: 'Hvor sannsynlig er det at du anbefaler oss?',
        config: {
          leftLabel: 'Ikke sannsynlig',
          rightLabel: 'Svært sannsynlig',
        },
      }
    case 'file_upload':
      return {
        questionText: 'Last opp fil',
        config: {
          maxFileSizeMb: 10,
          allowedExtensions: ['pdf', 'jpg', 'png'],
        },
      }
    case 'datetime':
      return {
        questionText: 'Velg dato og klokkeslett',
        config: {
          mode: 'datetime-local',
          dateFormat: null,
          timezone: null,
        },
      }
    case 'signature':
      return {
        questionText: 'Signer her',
        config: {},
      }
    default:
      return { questionText: 'Nytt spørsmål', config: {} }
  }
}
