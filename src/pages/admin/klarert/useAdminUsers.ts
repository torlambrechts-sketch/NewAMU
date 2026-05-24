// Loads the user catalogue for the Brukere section.
// Joins profiles ↔ user_roles ↔ role_definitions and calls the
// SECURITY DEFINER RPC `users_admin_overview()` to surface MFA / SSO /
// last_sign_in_at from auth.users. The RPC is gated to org-admin /
// users.manage and returns an empty set otherwise — the hook treats
// that as "auth metadata unavailable" and renders "—" in the table.

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
  /**
   * True when the admin overview RPC returned auth metadata (caller is
   * org-admin or has users.manage). False when the RPC came back empty
   * — UI should render "—" instead of false/zero for MFA / SSO.
   */
  authMetaAvailable: boolean
}

export function useAdminUsers(): AdminUsersResult {
  const { supabase, organization } = useOrgSetupContext()
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authMetaAvailable, setAuthMetaAvailable] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const [profileRes, roleRes, userRoleRes, overviewRes] = await Promise.all([
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
        // SECURITY DEFINER RPC — returns empty set for non-admin callers.
        supabase.rpc('users_admin_overview'),
      ])

      if (profileRes.error) throw profileRes.error
      if (roleRes.error) throw roleRes.error
      if (userRoleRes.error) throw userRoleRes.error
      // Auth metadata is best-effort — surface error but keep page rendering.
      const overviewError = overviewRes.error?.message ?? null

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

      // Index auth metadata by user_id (empty if non-admin caller).
      const overviewByUser = new Map<
        string,
        { last_sign_in_at: string | null; has_verified_mfa: boolean; is_sso: boolean }
      >()
      for (const row of (overviewRes.data ?? []) as {
        user_id: string
        last_sign_in_at: string | null
        has_verified_mfa: boolean
        is_sso: boolean
      }[]) {
        overviewByUser.set(row.user_id, {
          last_sign_in_at: row.last_sign_in_at,
          has_verified_mfa: row.has_verified_mfa,
          is_sso: row.is_sso,
        })
      }
      setAuthMetaAvailable(overviewByUser.size > 0)

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
        const auth = overviewByUser.get(p.id)
        return {
          id: p.id,
          displayName: p.display_name,
          email: p.email,
          roleNames: userRoles.map((r) => r.name),
          primaryRoleSlug: primarySlug,
          primaryRoleLaw: law,
          status: 'aktiv',
          mfa: auth?.has_verified_mfa ?? false,
          sso: auth?.is_sso ?? false,
          // Prefer real last_sign_in_at when available; fall back to
          // profile updated_at otherwise (best non-auth proxy).
          lastLogin: auth?.last_sign_in_at ?? p.updated_at,
          locationId: null,
          locationName: null,
          external,
        }
      })

      setUsers(summaries)
      if (overviewError && overviewByUser.size === 0) {
        // Don't fail the whole load — just leave authMetaAvailable=false.
        // The error itself is logged for debugging.
        console.warn('users_admin_overview RPC failed:', overviewError)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste brukere')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { users, loading, error, refresh, authMetaAvailable }
}
