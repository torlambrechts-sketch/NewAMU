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
  switch (t) {
    case 'rating_1_to_5':
      return 'Vurdering 1–5'
    case 'rating_1_to_10':
      return 'Vurdering 0–10'
    case 'text':
      return 'Fritekst'
    case 'yes_no':
      return 'Ja / nei'
    case 'multiple_choice':
      return 'Flervalg (knapper)'
    case 'single_select':
      return 'Enkeltvalg'
    case 'multi_select':
      return 'Flervalg (flere)'
    default:
      return t
  }
}

export const QUESTION_TYPE_OPTIONS: { value: SurveyQuestionType; label: string }[] = [
  { value: 'rating_1_to_5', label: 'Vurdering 1–5' },
  { value: 'rating_1_to_10', label: 'Vurdering 0–10' },
  { value: 'text', label: 'Fritekst' },
  { value: 'yes_no', label: 'Ja / nei' },
  { value: 'multiple_choice', label: 'Flervalg (knapper)' },
  { value: 'single_select', label: 'Enkeltvalg (liste)' },
  { value: 'multi_select', label: 'Flervalg (kryss av flere)' },
]

/** Spørsmålstyper som kan trekkes inn fra paletten i byggeren (rekkefølge = UI). */
export const SURVEY_BUILDER_PALETTE: { type: SurveyQuestionType; label: string; hint: string }[] = [
  { type: 'text', label: 'Fritekst', hint: 'Åpent svar' },
  { type: 'multiple_choice', label: 'Flervalg', hint: 'Ja/Nei eller egne alternativer' },
  { type: 'single_select', label: 'Enkeltvalg', hint: 'Ett av flere' },
  { type: 'multi_select', label: 'Flervalg flere', hint: 'Kryss av flere' },
  { type: 'yes_no', label: 'Ja / nei', hint: 'To knapper' },
  { type: 'rating_1_to_5', label: 'Skala 1–5', hint: 'Likert' },
  { type: 'rating_1_to_10', label: 'Skala 0–10', hint: 'NPS-lignende' },
]

export const SURVEY_TYPE_OPTIONS: { value: SurveyType; label: string }[] = [
  { value: 'internal', label: 'Ansatte (intern)' },
  { value: 'pulse', label: 'Pulsmåling' },
  { value: 'exit', label: 'Sluttsamtale' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'external', label: 'Leverandør / ekstern' },
]
