export type IkAnnualReviewStatus = 'draft' | 'signed' | 'archived'

export type IkAnnualReviewRow = {
  id: string
  organization_id: string
  year: number
  status: IkAnnualReviewStatus
  summary: string | null
  evaluation_json: Record<string, unknown>
  new_goals_json: Record<string, unknown>
  conducted_by: string | null
  manager_signed_at: string | null
  manager_signed_by: string | null
  deputy_signed_at: string | null
  deputy_signed_by: string | null
  created_at: string
  updated_at: string
}
