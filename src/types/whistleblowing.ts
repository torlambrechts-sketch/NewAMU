export type WhistleblowingCaseStatus =
  | 'received'
  | 'triage'
  | 'investigation'
  | 'internal_review'
  | 'closed'

export type WhistleblowingCaseRow = {
  id: string
  organization_id: string
  access_key: string
  category: string
  title: string
  description: string
  who_what_where: string
  occurred_at_text: string | null
  is_anonymous: boolean
  reporter_contact: string | null
  reporter_user_id: string | null
  attachment_paths: string[]
  status: WhistleblowingCaseStatus
  received_at: string
  acknowledgement_due_at: string
  closed_at: string | null
  closing_summary: string | null
  created_at: string
  updated_at: string
}

export type WhistleblowingNoteRow = {
  id: string
  case_id: string
  organization_id: string
  author_id: string | null
  body: string
  created_at: string
}

export const WHISTLE_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'corruption', label: 'Korrupsjon / økonomisk misbruk' },
  { value: 'harassment', label: 'Trakassering / diskriminering' },
  { value: 'hms', label: 'Brudd på HMS-regler / fare for liv og helse' },
  { value: 'environment', label: 'Miljøkriminalitet' },
  { value: 'privacy', label: 'Brudd på personvern' },
  { value: 'other', label: 'Annet kritikkverdig forhold' },
]
