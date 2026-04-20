/** AMU møter — `date` tilsvarer kolonnen `meeting_date` i databasen. */
export type AmuMeetingStatus = 'scheduled' | 'active' | 'completed' | 'signed'

export type AmuParticipantRole =
  | 'employer_rep'
  | 'employee_rep'
  | 'safety_deputy'
  | 'bht'
  | 'secretary'

export interface AmuMeeting {
  id: string
  organization_id: string
  title: string
  /** ISO-dato (YYYY-MM-DD) */
  date: string
  location: string
  status: AmuMeetingStatus
  /** Utkast til referat (markdown/ren tekst) */
  minutes_draft: string | null
  /** Valgt møteleder (referat / signatur) */
  meeting_chair_user_id: string | null
  /** Møteleders signaturtidspunkt */
  chair_signed_at: string | null
  created_at: string
  updated_at: string
}

export interface AmuParticipant {
  meeting_id: string
  user_id: string
  organization_id: string
  role: AmuParticipantRole
  present: boolean
  signed_at: string | null
}

export interface AmuAgendaItem {
  id: string
  meeting_id: string
  organization_id: string
  title: string
  description: string
  order_index: number
  source_module: string | null
  source_id: string | null
  created_at: string
  updated_at: string
}

export interface AmuDecision {
  id: string
  agenda_item_id: string
  organization_id: string
  decision_text: string
  action_plan_item_id: string | null
  created_at: string
  updated_at: string
}

/** Virksomhetens standard saksliste (admin) — kopieres til `amu_agenda_items` ved generering */
export interface AmuDefaultAgendaItem {
  id: string
  organization_id: string
  title: string
  description: string
  order_index: number
  source_module: string | null
  /** Polymorf lenke til kildepost (f.eks. avvik-id) når kilde er satt */
  source_id: string | null
  created_at: string
  updated_at: string
}

/** Aggregert teller — ingen PII (RPC `amu_privacy_whistleblowing_stats`) */
export interface AmuWhistleblowingPrivacyStats {
  open: number
  closed: number
}

/** Aggregert teller — sykefravær fra HSE-modulens payload (statusfordeling) */
export interface AmuSickLeavePrivacyStats {
  active: number
  partial: number
  other: number
}

/** Rå rad fra `amu_meetings` (brukes til mapping mot `AmuMeeting`) */
export type AmuMeetingDbRow = Omit<AmuMeeting, 'date' | 'minutes_draft' | 'meeting_chair_user_id' | 'chair_signed_at'> & {
  meeting_date: string
  minutes_draft: string | null
  meeting_chair_user_id: string | null
  chair_signed_at: string | null
}
