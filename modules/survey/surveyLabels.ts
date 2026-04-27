import type { BadgeVariant } from '../../src/components/ui/Badge'
import type { SurveyQuestionType, SurveyStatus, SurveyType } from './types'

export function surveyStatusBadgeVariant(status: SurveyStatus): BadgeVariant {
  if (status === 'draft') return 'neutral'
  if (status === 'active') return 'success'
  if (status === 'archived') return 'neutral'
  return 'warning'
}

export function surveyStatusLabel(status: SurveyStatus): string {
  if (status === 'draft') return 'Kladd'
  if (status === 'active') return 'Aktiv'
  if (status === 'archived') return 'Arkivert'
  return 'Lukket'
}

export function surveyTypeBadgeVariant(type: SurveyType): BadgeVariant {
  if (type === 'external') return 'warning'
  if (type === 'pulse') return 'info'
  if (type === 'exit') return 'neutral'
  if (type === 'onboarding') return 'info'
  return 'neutral'
}

export function surveyTypeLabel(type: SurveyType): string {
  if (type === 'external') return 'Leverandør'
  if (type === 'pulse') return 'Puls'
  if (type === 'exit') return 'Sluttsamtale'
  if (type === 'onboarding') return 'Onboarding'
  return 'Ansatte'
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

export const SURVEY_TYPE_OPTIONS: { value: SurveyType; label: string }[] = [
  { value: 'internal', label: 'Ansatte (intern)' },
  { value: 'pulse', label: 'Pulsmåling' },
  { value: 'exit', label: 'Sluttsamtale' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'external', label: 'Leverandør / ekstern' },
]
