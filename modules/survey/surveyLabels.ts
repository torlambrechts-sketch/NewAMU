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
      return 'Fritekst (lang)'
    case 'yes_no':
      return 'Ja / nei'
    case 'multiple_choice':
      return 'Flervalg (knapper)'
    case 'single_select':
      return 'Enkeltvalg'
    case 'multi_select':
      return 'Flervalg (flere)'
    case 'short_text':
      return 'Kort tekst'
    case 'long_text':
      return 'Lang tekst'
    case 'email':
      return 'E-post'
    case 'number':
      return 'Tall'
    case 'rating_visual':
      return 'Vurdering (stjerner/ikoner)'
    case 'slider':
      return 'Glider'
    case 'dropdown':
      return 'Rullegardin'
    case 'image_choice':
      return 'Bildevalg'
    case 'likert_scale':
      return 'Likert'
    case 'matrix':
      return 'Matrise'
    case 'ranking':
      return 'Rangering'
    case 'nps':
      return 'NPS (0–10)'
    case 'file_upload':
      return 'Filopplasting'
    case 'datetime':
      return 'Dato / tid'
    case 'signature':
      return 'Signatur'
    default:
      return t
  }
}

export const QUESTION_TYPE_OPTIONS: { value: SurveyQuestionType; label: string }[] = [
  { value: 'short_text', label: 'Kort tekst' },
  { value: 'long_text', label: 'Lang tekst' },
  { value: 'text', label: 'Fritekst (klassisk)' },
  { value: 'email', label: 'E-post' },
  { value: 'number', label: 'Tall' },
  { value: 'rating_1_to_5', label: 'Vurdering 1–5' },
  { value: 'rating_1_to_10', label: 'Vurdering 0–10' },
  { value: 'rating_visual', label: 'Vurdering (stjerner/ikoner)' },
  { value: 'slider', label: 'Glider' },
  { value: 'yes_no', label: 'Ja / nei' },
  { value: 'multiple_choice', label: 'Flervalg (knapper)' },
  { value: 'single_select', label: 'Enkeltvalg (radio)' },
  { value: 'multi_select', label: 'Flervalg (avkryssing)' },
  { value: 'dropdown', label: 'Rullegardin' },
  { value: 'image_choice', label: 'Bildevalg' },
  { value: 'likert_scale', label: 'Likert (etiketter)' },
  { value: 'matrix', label: 'Matrise (rader × kolonner)' },
  { value: 'ranking', label: 'Rangering' },
  { value: 'nps', label: 'NPS' },
  { value: 'file_upload', label: 'Filopplasting' },
  { value: 'datetime', label: 'Dato / tid' },
  { value: 'signature', label: 'Signatur' },
]

/** Spørsmålstyper som kan trekkes inn fra paletten i byggeren (rekkefølge = UI). */
export const SURVEY_BUILDER_PALETTE: { type: SurveyQuestionType; label: string; hint: string }[] = [
  { type: 'short_text', label: 'Kort tekst', hint: 'Navn, kort svar' },
  { type: 'long_text', label: 'Lang tekst', hint: 'Utdyping' },
  { type: 'text', label: 'Fritekst', hint: 'Klassisk lang tekst' },
  { type: 'email', label: 'E-post', hint: 'Kontakt' },
  { type: 'number', label: 'Tall', hint: 'Min/maks/steg' },
  { type: 'multiple_choice', label: 'Flervalg', hint: 'Knapper' },
  { type: 'single_select', label: 'Enkeltvalg', hint: 'Radio' },
  { type: 'multi_select', label: 'Flervalg flere', hint: 'Avkryssing' },
  { type: 'dropdown', label: 'Rullegardin', hint: 'Lang liste' },
  { type: 'image_choice', label: 'Bildevalg', hint: 'Bilde + label' },
  { type: 'yes_no', label: 'Ja / nei', hint: 'To knapper' },
  { type: 'rating_1_to_5', label: 'Skala 1–5', hint: 'Tallrekke' },
  { type: 'rating_1_to_10', label: 'Skala 0–10', hint: 'Tallrekke' },
  { type: 'rating_visual', label: 'Stjerner/ikoner', hint: 'Visuell skala' },
  { type: 'slider', label: 'Glider', hint: 'Kontinuerlig' },
  { type: 'likert_scale', label: 'Likert', hint: 'Egne etiketter' },
  { type: 'matrix', label: 'Matrise', hint: 'Flere rader, samme skala' },
  { type: 'ranking', label: 'Rangering', hint: 'Sorter prioritet' },
  { type: 'nps', label: 'NPS', hint: '0–10 lojalitet' },
  { type: 'file_upload', label: 'Fil', hint: 'Vedlegg' },
  { type: 'datetime', label: 'Dato/tid', hint: 'Planlegging' },
  { type: 'signature', label: 'Signatur', hint: 'Samtykke' },
]

export const SURVEY_TYPE_OPTIONS: { value: SurveyType; label: string }[] = [
  { value: 'internal', label: 'Ansatte (intern)' },
  { value: 'pulse', label: 'Pulsmåling' },
  { value: 'exit', label: 'Sluttsamtale' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'external', label: 'Leverandør / ekstern' },
]
