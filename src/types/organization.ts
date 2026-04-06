export type OrganizationRow = {
  id: string
  organization_number: string
  name: string
  brreg_snapshot: Record<string, unknown> | null
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}

export type ProfileRow = {
  id: string
  organization_id: string | null
  display_name: string
  email?: string | null
  is_org_admin?: boolean
  /** UI locale: nb | en (requires DB migration profiles_locale). */
  locale?: string | null
  /** Optional link for department-level learning stats */
  department_id?: string | null
  /** Flags for learning paths (e.g. is_safety_rep) — synced with `profiles.learning_metadata` */
  learning_metadata?: Record<string, unknown> | null
  /** Public URL for profile photo (storage or HTTPS) */
  avatar_url?: string | null
  phone?: string | null
  job_title?: string | null
  created_at: string
  updated_at: string
}

export type DepartmentRow = {
  id: string
  organization_id: string
  name: string
  sort_order: number
  created_at: string
}

export type TeamRow = {
  id: string
  organization_id: string
  department_id: string | null
  name: string
  sort_order: number
  created_at: string
}

export type LocationRow = {
  id: string
  organization_id: string
  name: string
  address: string | null
  sort_order: number
  created_at: string
}

export type OrganizationMemberRow = {
  id: string
  organization_id: string
  display_name: string
  email: string | null
  department_id: string | null
  team_id: string | null
  location_id: string | null
  created_at: string
}
