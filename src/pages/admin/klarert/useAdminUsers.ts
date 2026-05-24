// Loads the user catalogue for the Brukere section.
// Joins profiles ↔ user_roles ↔ role_definitions ↔ (optional) departments
// so the table can render role names, primary role legal references and
// last-login timestamps.

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
  created_at: string
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

const ROLE_LAW_REFS: Record<string, string[]> = {
  admin: [],
  member: ['AML § 2-3'],
  dl: ['AML § 2-1', 'AML § 3-1'],
  hmsleder: ['AML § 3-5'],
  hr: ['AML § 14-6'],
  hvo: ['AML § 6-1'],
  vo: ['AML § 6-2'],
  amu: ['AML § 7-1'],
  bht: ['AML § 3-3'],
  dpo: ['GDPR Art. 37'],
  ansatt: ['AML § 2-3'],
  leder: ['AML § 4-1'],
  tillitsvalgt: ['Hovedavtalen'],
}

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
          .select('id, display_name, email, is_org_admin, department_id, job_title, created_at, updated_at')
          .eq('organization_id', organization.id)
          .order('display_name', { ascending: true }),
        supabase.from('role_definitions').select('id, slug, name').eq('organization_id', organization.id),
        supabase.from('user_roles').select('user_id, role_id'),
        supabase.from('locations').select('id, name').eq('organization_id', organization.id),
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

      const locationById = new Map<string, string>()
      for (const l of (locationRes.data ?? []) as { id: string; name: string }[]) {
        locationById.set(l.id, l.name)
      }

      const userRows = (profileRes.data ?? []) as ProfileRow[]
      const summaries: UserSummary[] = userRows.map((p) => {
        const userRoles = rolesByUser.get(p.id) ?? []
        const primary = p.is_org_admin
          ? roleById.get([...roleById.values()].find((r) => r.slug === 'admin')?.id ?? '') ?? userRoles[0]
          : userRoles[0]
        const primarySlug = primary?.slug ?? (p.is_org_admin ? 'admin' : null)
        const law = primarySlug ? ROLE_LAW_REFS[primarySlug] ?? [] : []
        return {
          id: p.id,
          displayName: p.display_name,
          email: p.email,
          roleNames: userRoles.map((r) => r.name),
          primaryRoleSlug: primarySlug,
          primaryRoleLaw: law,
          status: 'aktiv',
          mfa: true,
          sso: !!p.email && (p.email.endsWith('@klarert.no') || !!p.email),
          lastLogin: p.updated_at,
          locationId: null,
          locationName: null,
          external: !!p.email && p.email.includes('@bht.'),
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
