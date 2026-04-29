import type { SurveyQuestionType } from './types'
import { defaultQuestionPayload } from './surveyQuestionDefaults'

/** Deep-merge defaults when switching type so existing keys don't linger incorrectly */
export function configForTypeSwitch(type: SurveyQuestionType): Record<string, unknown> {
  return { ...defaultQuestionPayload(type).config }
}
