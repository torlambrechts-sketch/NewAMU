export type HrLegalAck = {
  /** Arbeidstaker informert om retten til å ha med tillitsvalgt */
  informed_union_accompaniment_right_ack?: boolean
  /** Tillitsvalgt til stede (bekreftet) */
  union_rep_present_ack?: boolean
  /** Referatet inneholder ikke konklusjon om oppsigelse */
  no_termination_conclusion?: boolean
  /** Arbeidstaker har mottatt kopi av referatet (etter signatur) */
  employee_copy_received?: boolean
}

export type HrDiscussionMeetingRow = {
  id: string
  organization_id: string
  employee_user_id: string
  manager_user_id: string
  union_rep_user_id: string | null
  union_rep_invited: boolean
  informed_union_accompaniment_right: boolean
  union_rep_present: boolean
  checklist_completed: boolean
  summary_text: string
  topics_discussed: string
  meeting_at: string | null
  legal_acknowledgements: HrLegalAck
  employee_display_name: string | null
  manager_display_name: string | null
  union_display_name: string | null
  status: 'draft' | 'pending_signatures' | 'locked'
  manager_signed_at: string | null
  employee_signed_at: string | null
  union_rep_signed_at: string | null
  content_sha256: string | null
  locked_at: string | null
  created_at: string
  updated_at: string
}

export type HrConsultationCaseRow = {
  id: string
  organization_id: string
  title: string
  description: string
  status: 'open' | 'closed'
  created_by: string
  closed_at: string | null
  information_provided_at: string | null
  decision_summary: string
  aml_chapter_8_applies: boolean
  created_at: string
  updated_at: string
}

export type HrOrgUserRow = {
  user_id: string
  display_name: string
  email: string | null
}

export type HrConsultationParticipantRow = {
  case_id: string
  user_id: string
  role: 'union_rep' | 'observer' | 'management'
  invited_at: string
}

export type HrConsultationCommentRow = {
  id: string
  case_id: string
  author_id: string
  body: string
  created_at: string
}

export type HrRosSignoffRow = {
  id: string
  organization_id: string
  ros_assessment_id: string
  category: string
  requires_amu_signoff: boolean
  amu_representative_user_id: string | null
  amu_signed_at: string | null
  amu_assessment_text: string | null
  verneombud_user_id: string | null
  verneombud_signed_at: string | null
  verneombud_assessment_text: string | null
  blocked: boolean
  created_at: string
  updated_at: string
}
