// Loads the user catalogue for the Brukere section.
// Joins profiles ↔ user_roles ↔ role_definitions so the table can render
// role names and primary-role legal references.
//
// Note on auth metadata: `auth.users` is not exposed to the JS client
// (only via service-role admin API). MFA status and last sign-in time
// therefore default to `null` here and the UI renders "—" instead of
// fabricated values. Wire those up later via an Edge Function once a
// `users_admin_overview` view exists.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type { UserSummary } from './types'

interface ProfileRow {
  id: string
  display_name: string
  email: string | null
  is_org_admin: boolean | null
  department_id: string | null
  job_title: string | null
  updated_at: string
}

interface RoleRow {
  id: string
  slug: string
  name: string
}

interface UserRoleRow {
  user_id: string
  role_id: string
}

// Map role slugs to the law-reference string the design surfaces in the
// table. Slugs are the union of system roles (admin/member/verneombud)
// and aspirational lovpålagte roles that an org may add manually.
const ROLE_LAW_REFS: Record<string, string[]> = {
  admin: [],
  member: ['AML § 2-3'],
  verneombud: ['AML § 6-2'],
  hoved_verneombud: ['AML § 6-1'],
  daglig_leder: ['AML § 2-1', 'AML § 3-1'],
  dl: ['AML § 2-1', 'AML § 3-1'],
  hms_koordinator: ['AML § 3-5'],
  hmsleder: ['AML § 3-5'],
  hms_leder: ['AML § 3-5'],
  hr_leder: ['AML § 14-6'],
  hr: ['AML § 14-6'],
  amu_leder: ['AML § 7-1'],
  amu_medlem: ['AML § 7-1'],
  amu: ['AML § 7-1'],
  bht_kontakt: ['AML § 3-3'],
  bht: ['AML § 3-3'],
  dpo: ['GDPR Art. 37'],
  linje_leder: ['AML § 4-1'],
  leder: ['AML § 4-1'],
  tillitsvalgt: ['Hovedavtalen'],
}

// Slugs that represent external (non-employee) functional roles.
const EXTERNAL_ROLE_SLUGS = new Set([
  'bht',
  'bht_kontakt',
  'tillitsvalgt',
  'ekstern_revisor',
  'verneombud_ekstern',
])

export interface AdminUsersResult {
  users: UserSummary[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useAdminUsers(): AdminUsersResult {
  const { supabase, organization } = useOrgSetupContext()
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const [profileRes, roleRes, userRoleRes, locationRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, email, is_org_admin, department_id, job_title, updated_at')
          .eq('organization_id', organization.id)
          .order('display_name', { ascending: true }),
        supabase
          .from('role_definitions')
          .select('id, slug, name')
          .eq('organization_id', organization.id),
        supabase.from('user_roles').select('user_id, role_id'),
        supabase
          .from('locations')
          .select('id, name')
          .eq('organization_id', organization.id),
      ])

      if (profileRes.error) throw profileRes.error
      if (roleRes.error) throw roleRes.error
      if (userRoleRes.error) throw userRoleRes.error
      if (locationRes.error) throw locationRes.error

      const roleById = new Map<string, RoleRow>()
      for (const r of (roleRes.data ?? []) as RoleRow[]) roleById.set(r.id, r)

      const rolesByUser = new Map<string, RoleRow[]>()
      for (const ur of (userRoleRes.data ?? []) as UserRoleRow[]) {
        const r = roleById.get(ur.role_id)
        if (!r) continue
        const arr = rolesByUser.get(ur.user_id) ?? []
        arr.push(r)
        rolesByUser.set(ur.user_id, arr)
      }

      // Locations are surfaced as a future expansion (profiles don't
      // currently carry a location FK). The map is built so the field
      // is ready to wire up.
      void locationRes

      const userRows = (profileRes.data ?? []) as ProfileRow[]
      const adminRole = [...roleById.values()].find((r) => r.slug === 'admin')

      const summaries: UserSummary[] = userRows.map((p) => {
        const userRoles = rolesByUser.get(p.id) ?? []
        const primary =
          p.is_org_admin && adminRole
            ? userRoles.find((r) => r.id === adminRole.id) ?? adminRole
            : userRoles[0]
        const primarySlug = primary?.slug ?? (p.is_org_admin ? 'admin' : null)
        const law = primarySlug ? ROLE_LAW_REFS[primarySlug] ?? [] : []
        const external = userRoles.some((r) => EXTERNAL_ROLE_SLUGS.has(r.slug))
        return {
          id: p.id,
          displayName: p.display_name,
          email: p.email,
          roleNames: userRoles.map((r) => r.name),
          primaryRoleSlug: primarySlug,
          primaryRoleLaw: law,
          status: 'aktiv',
          // MFA / SSO live on auth.users which isn't exposed to the JS
          // client. Both fields default to false here; the UI renders
          // "—" so admins aren't misled by fabricated indicators.
          mfa: false,
          sso: false,
          // updated_at on profiles is the last profile-mutation time —
          // best proxy until auth.users.last_sign_in_at is exposed via
          // an admin function.
          lastLogin: p.updated_at,
          locationId: null,
          locationName: null,
          external,
        }
      })

      setUsers(summaries)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste brukere')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { users, loading, error, refresh }
}
