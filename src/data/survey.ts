// ─────────────────────────────────────────────────────────────────────────────
// SURVEY MODULE — Types, constants, and helpers
// AML § 3-1, § 4-1, § 4-3, § 4-4, Kap 6&7 | IK-forskriften § 5 | GDPR n≥5
// ─────────────────────────────────────────────────────────────────────────────

export type SurveyPillar =
  | 'psychosocial'
  | 'physical'
  | 'organization'
  | 'safety_culture'
  | 'custom'

export type SurveyQuestionSet = 'qpsnordic' | 'ark' | 'custom'

export type SurveyCampaignStatus = 'draft' | 'open' | 'closed' | 'archived'

export type SurveyQuestionType = 'likert5' | 'likert7' | 'yesno' | 'text' | 'nps'

export type SurveyActionStatus = 'open' | 'in_progress' | 'closed'

export type SurveyAmuStatus = 'pending' | 'reviewed' | 'signed'

// ── DB row types ──────────────────────────────────────────────────────────

export type SurveyCampaignRow = {
  id: string
  organization_id: string
  title: string
  description: string | null
  pillar: SurveyPillar
  question_set: SurveyQuestionSet
  status: SurveyCampaignStatus
  opens_at: string | null
  closes_at: string | null
  anonymity_threshold: number
  recurrence_months: number | null
  next_scheduled_at: string | null
  amu_review_required: boolean
  action_threshold: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SurveyQuestionRow = {
  id: string
  campaign_id: string
  organization_id: string
  pillar: SurveyPillar
  category: string
  question_text: string
  question_type: SurveyQuestionType
  source_key: string | null
  is_mandatory: boolean
  mandatory_law: string | null
  sort_order: number
  deleted_at: string | null
  created_at: string
}

export type SurveyResponseRow = {
  id: string
  campaign_id: string
  organization_id: string
  question_id: string
  respondent_token: string
  department: string | null
  answer_numeric: number | null
  answer_text: string | null
  answer_bool: boolean | null
  submitted_at: string
}

export type SurveyResultRow = {
  id: string
  campaign_id: string
  organization_id: string
  department: string | null
  pillar: SurveyPillar
  category: string
  question_id: string | null
  score: number | null
  response_count: number
  is_suppressed: boolean
  computed_at: string
}

export type SurveyActionPlanRow = {
  id: string
  campaign_id: string
  organization_id: string
  ik_action_plan_id: string | null
  pillar: SurveyPillar
  category: string
  score: number | null
  trigger_threshold: number
  title: string
  description: string | null
  status: SurveyActionStatus
  assigned_to: string | null
  due_at: string | null
  closed_at: string | null
  closed_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SurveyAmuReviewRow = {
  id: string
  campaign_id: string
  organization_id: string
  meeting_date: string | null
  agenda_item: string | null
  amu_chair_signed_at: string | null
  amu_chair_signed_by: string | null
  amu_chair_name: string | null
  vo_signed_at: string | null
  vo_signed_by: string | null
  vo_name: string | null
  protocol_text: string | null
  status: SurveyAmuStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── Display constants ─────────────────────────────────────────────────────

export const PILLAR_LABEL: Record<SurveyPillar, string> = {
  psychosocial:   'Psykososialt arbeidsmiljø',
  physical:       'Fysisk arbeidsmiljø',
  organization:   'Organisatorisk arbeidsmiljø',
  safety_culture: 'Sikkerhetskultur',
  custom:         'Egendefinert',
}

export const PILLAR_COLOR: Record<SurveyPillar, string> = {
  psychosocial:   'border-violet-400 bg-violet-50 text-violet-800',
  physical:       'border-blue-400 bg-blue-50 text-blue-800',
  organization:   'border-amber-400 bg-amber-50 text-amber-800',
  safety_culture: 'border-emerald-400 bg-emerald-50 text-emerald-800',
  custom:         'border-neutral-400 bg-neutral-50 text-neutral-700',
}

export const PILLAR_LAW: Record<SurveyPillar, string> = {
  psychosocial:   'AML § 4-3',
  physical:       'AML § 4-4',
  organization:   'AML § 4-1',
  safety_culture: 'AML Kap. 6 & 7',
  custom:         '',
}

export const STATUS_LABEL: Record<SurveyCampaignStatus, string> = {
  draft:    'Kladd',
  open:     'Åpen',
  closed:   'Avsluttet',
  archived: 'Arkivert',
}

export const STATUS_COLOR: Record<SurveyCampaignStatus, string> = {
  draft:    'border-neutral-300 bg-neutral-50 text-neutral-700',
  open:     'border-emerald-300 bg-emerald-50 text-emerald-800',
  closed:   'border-blue-300 bg-blue-50 text-blue-800',
  archived: 'border-neutral-200 bg-neutral-100 text-neutral-500',
}

export const ACTION_STATUS_LABEL: Record<SurveyActionStatus, string> = {
  open:        'Åpen',
  in_progress: 'Under arbeid',
  closed:      'Lukket',
}

export const ACTION_STATUS_COLOR: Record<SurveyActionStatus, string> = {
  open:        'border-red-200 bg-red-50 text-red-800',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-800',
  closed:      'border-emerald-200 bg-emerald-50 text-emerald-800',
}

// ── Score thresholds (traffic light) ─────────────────────────────────────
// Red < 40 | Amber 40-69 | Green ≥ 70 (QPSNordic/ARK convention)

export function scoreColor(score: number | null): string {
  if (score === null) return 'text-neutral-400'
  if (score < 40) return 'text-red-600'
  if (score < 70) return 'text-amber-600'
  return 'text-emerald-600'
}

export function scoreBg(score: number | null): string {
  if (score === null) return 'bg-neutral-100'
  if (score < 40) return 'bg-red-100'
  if (score < 70) return 'bg-amber-100'
  return 'bg-emerald-100'
}

export function scoreLabel(score: number | null): string {
  if (score === null) return '–'
  if (score < 40) return 'Kritisk'
  if (score < 70) return 'Forbedringspotensial'
  return 'Tilfredsstillende'
}

// Normalise likert-5 (1-5) to 0-100
export function normaliseLikert5(raw: number): number {
  return Math.round(((raw - 1) / 4) * 100)
}

// Normalise likert-7 (1-7) to 0-100
export function normaliseLikert7(raw: number): number {
  return Math.round(((raw - 1) / 6) * 100)
}

// ── QPSNordic pre-built question bank ───────────────────────────────────
// Source: QPSNordic manual (Dallner et al., 2000) — 26 validated items
// Mandatory AML § 4-3 questions are flagged is_mandatory=true

export type QpsQuestion = {
  source_key: string
  pillar: SurveyPillar
  category: string
  question_text: string
  question_type: SurveyQuestionType
  is_mandatory: boolean
  mandatory_law: string | null
}

export const QPS_NORDIC_QUESTIONS: QpsQuestion[] = [
  // Psykososialt — Jobbkrav (AML § 4-3)
  { source_key: 'QPS_JOBBKRAV_1', pillar: 'psychosocial', category: 'Jobbkrav', question_text: 'Har du for mye å gjøre på jobben?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  { source_key: 'QPS_JOBBKRAV_2', pillar: 'psychosocial', category: 'Jobbkrav', question_text: 'Opplever du at arbeidet er for krevende mentalt?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  // Autonomi (AML § 4-1)
  { source_key: 'QPS_AUTONOMI_1', pillar: 'psychosocial', category: 'Autonomi', question_text: 'Kan du bestemme din egen arbeidsplan (start/slutt, pauser)?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  { source_key: 'QPS_AUTONOMI_2', pillar: 'psychosocial', category: 'Autonomi', question_text: 'Kan du påvirke hvilke oppgaver du får?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  // Sosial støtte (AML § 4-3)
  { source_key: 'QPS_SOSIALT_1', pillar: 'psychosocial', category: 'Sosial støtte', question_text: 'Får du støtte fra din nærmeste leder når du trenger det?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  { source_key: 'QPS_SOSIALT_2', pillar: 'psychosocial', category: 'Sosial støtte', question_text: 'Får du støtte fra kollegene dine når du trenger det?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  // Rolleklarhet (AML § 4-1)
  { source_key: 'QPS_ROLLE_1', pillar: 'organization', category: 'Rolleklarhet', question_text: 'Er det klart definert hva som er dine arbeidsoppgaver?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  { source_key: 'QPS_ROLLE_2', pillar: 'organization', category: 'Rolleklarhet', question_text: 'Vet du hva som er dine mål og prioriteringer?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  // ── MANDATORY § 4-3 questions ──────────────────────────────────────────
  { source_key: 'QPS_MANDATORY_INTEGRITY',   pillar: 'psychosocial', category: 'Verdighet og integritet', question_text: 'Opplever du at du behandles med respekt og verdighet på jobb?', question_type: 'likert5', is_mandatory: true, mandatory_law: 'AML_4_3' },
  { source_key: 'QPS_MANDATORY_INFLUENCE',   pillar: 'psychosocial', category: 'Medvirkning', question_text: 'Har du mulighet til å medvirke i beslutninger som angår din arbeidssituasjon?', question_type: 'likert5', is_mandatory: true, mandatory_law: 'AML_4_3' },
  { source_key: 'QPS_MANDATORY_SAFETY',      pillar: 'safety_culture', category: 'Sikkerhet', question_text: 'Opplever du at sikkerheten på din arbeidsplass er ivaretatt?', question_type: 'likert5', is_mandatory: true, mandatory_law: 'AML_4_3' },
  { source_key: 'QPS_MANDATORY_HEALTH',      pillar: 'physical', category: 'Helse og arbeidsforhold', question_text: 'Opplever du at de fysiske arbeidsforholdene (lys, lyd, luft, ergonomi) er tilfredsstillende?', question_type: 'likert5', is_mandatory: true, mandatory_law: 'AML_4_4' },
  { source_key: 'QPS_MANDATORY_BULLYING',    pillar: 'psychosocial', category: 'Trakassering og mobbing', question_text: 'Har du det siste året opplevd trakassering, mobbing eller uønsket seksuell oppmerksomhet på arbeidsplassen?', question_type: 'yesno', is_mandatory: true, mandatory_law: 'AML_4_3' },
  // Fysisk arbeidsmiljø (AML § 4-4)
  { source_key: 'QPS_FYSISK_1', pillar: 'physical', category: 'Fysiske belastninger', question_text: 'Utsettes du for tunge løft eller ensidig gjentakelsesarbeid?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  { source_key: 'QPS_FYSISK_2', pillar: 'physical', category: 'Fysiske belastninger', question_text: 'Er du utsatt for støy som gjør det vanskelig å kommunisere normalt?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  // Sikkerhetskultur (AML Kap 6&7)
  { source_key: 'QPS_SIKKERT_1', pillar: 'safety_culture', category: 'Rapporteringskultur', question_text: 'Rapporterer du uønskede hendelser og nesten-ulykker på jobben?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  { source_key: 'QPS_SIKKERT_2', pillar: 'safety_culture', category: 'Ledelsesengasjement', question_text: 'Er din leder et godt forbilde for HMS-arbeid?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  { source_key: 'QPS_SIKKERT_3', pillar: 'safety_culture', category: 'Vernombud', question_text: 'Kjenner du til hvem som er verneombud på din arbeidsplass?', question_type: 'yesno', is_mandatory: false, mandatory_law: null },
  // NPS — Overall
  { source_key: 'QPS_NPS', pillar: 'psychosocial', category: 'Helhetsvurdering', question_text: 'Hvor sannsynlig er det at du vil anbefale denne arbeidsplassen til andre? (0-10)', question_type: 'nps', is_mandatory: false, mandatory_law: null },
  // Open-ended
  { source_key: 'QPS_OPEN_1', pillar: 'psychosocial', category: 'Åpne kommentarer', question_text: 'Hva er det beste med arbeidsmiljøet på din arbeidsplass?', question_type: 'text', is_mandatory: false, mandatory_law: null },
  { source_key: 'QPS_OPEN_2', pillar: 'psychosocial', category: 'Åpne kommentarer', question_text: 'Hva bør forbedres for at arbeidsmiljøet skal bli bedre?', question_type: 'text', is_mandatory: false, mandatory_law: null },
]

// ARK (Arbeidsforskningsinstituttet) supplementary questions
export const ARK_QUESTIONS: QpsQuestion[] = [
  { source_key: 'ARK_MESTRING_1', pillar: 'psychosocial', category: 'Mestring', question_text: 'Opplever du at du mestrer arbeidsoppgavene dine?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  { source_key: 'ARK_MESTRING_2', pillar: 'psychosocial', category: 'Mestring', question_text: 'Har du den kompetansen som kreves for å gjøre jobben din?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  { source_key: 'ARK_TILLIT_1', pillar: 'organization', category: 'Tillit til ledelse', question_text: 'Har du tillit til måten organisasjonen ledes på?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  { source_key: 'ARK_UTVIKLING_1', pillar: 'organization', category: 'Faglig utvikling', question_text: 'Får du mulighet til faglig og personlig utvikling i jobben?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
  { source_key: 'ARK_TILHØRIGHET_1', pillar: 'psychosocial', category: 'Tilhørighet', question_text: 'Opplever du at du hører til i arbeidsfellesskapet?', question_type: 'likert5', is_mandatory: false, mandatory_law: null },
]

// ── n≥5 GDPR anonymity check ──────────────────────────────────────────────
export function isAnonymised(responseCount: number, threshold = 5): boolean {
  return responseCount < threshold
}
