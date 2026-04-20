import type { BadgeVariant } from '../../src/components/ui/Badge'
import type { SurveyQuestionType, SurveyStatus } from './types'

export function surveyStatusBadgeVariant(status: SurveyStatus): BadgeVariant {
  if (status === 'draft') return 'neutral'
  if (status === 'active') return 'success'
  return 'warning'
}

export function surveyStatusLabel(status: SurveyStatus): string {
  if (status === 'draft') return 'Kladd'
  if (status === 'active') return 'Aktiv'
  return 'Lukket'
}

export function questionTypeLabel(t: SurveyQuestionType): string {
  if (t === 'rating_1_to_5') return 'Vurdering 1–5'
  if (t === 'text') return 'Fritekst'
  return 'Flervalg'
}

export const QUESTION_TYPE_OPTIONS: { value: SurveyQuestionType; label: string }[] = [
  { value: 'rating_1_to_5', label: 'Vurdering 1–5' },
  { value: 'text', label: 'Fritekst' },
  { value: 'multiple_choice', label: 'Flervalg' },
]
