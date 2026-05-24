// Shared types for the Klarert Admin sections.
// These mirror what the design seed described while binding to
// the actual Supabase tables that back each surface.

import type { ElementType } from 'react'

export type AdminSectionId =
  | 'org'
  | 'users'
  | 'roles'
  | 'packs'
  | 'workflows'
  | 'integrations'
  | 'audit'

export type AdminMode = 'easy' | 'advanced'

export interface AdminNavItem {
  id: AdminSectionId
  label: string
  icon: ElementType
}

export interface AdminSectionProps {
  easy: boolean
}

// Pack rendering metadata. Sourced per-row from the various
// system / per-org template tables; the icon + accent comes from a
// framework-keyed registry kept in `packMetadata.ts`.
export interface PackSummary {
  id: string
  framework: string
  name: string
  shortName: string
  description: string
  icon: ElementType
  color: string
  installed: boolean
  official: boolean
  version: string
  lastUpdated: string | null
  lawRefs: string[]
  contents: {
    checklist: number
    survey: number
    document: number
    meeting: number
    register: number
    course: number
  }
}

export interface IntegrationSummary {
  id: string
  name: string
  category: string
  description: string
  icon: ElementType
  status: 'koblet' | 'venter' | 'tilgjengelig'
  dataFlow: string
  authMethod: string
  lastSync: string | null
  connector: string
  scopes: string[]
}

export interface RoleSummary {
  id: string
  slug: string
  name: string
  description: string | null
  isSystem: boolean
  permissionCount: number
  userCount: number
  riskLevel: 'lav' | 'middels' | 'høy'
  lawRefs: string[]
  scope: string
}

export interface UserSummary {
  id: string
  displayName: string
  email: string | null
  roleNames: string[]
  primaryRoleSlug: string | null
  primaryRoleLaw: string[]
  status: 'aktiv' | 'permittert'
  mfa: boolean
  sso: boolean
  lastLogin: string | null
  locationId: string | null
  locationName: string | null
  external: boolean
}

export interface AuditEntry {
  id: string
  when: string
  who: string
  action: string
  detail: string
  table: string
}

export type RouteName =
  | { name: 'list' }
  | { name: 'pack-detail'; packId: string }
  | { name: 'pack-template-edit'; packId: string; templateId: string }
  | { name: 'pack-tilpass'; packId: string }
  | { name: 'wf-edit'; ruleId: string | 'new' }
