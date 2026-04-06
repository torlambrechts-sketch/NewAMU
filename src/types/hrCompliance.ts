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
  created_at: string
  updated_at: string
}
