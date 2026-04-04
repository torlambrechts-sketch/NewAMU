import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { usePermissions } from './usePermissions'
import { ensureProfileRowExists } from '../lib/ensureProfile'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { fetchEnhetByOrgnr, normalizeOrgNumber } from '../lib/brreg'
import type { BrregEnhet } from '../types/brreg'
import type {
  DepartmentRow,
  LocationRow,
  OrganizationMemberRow,
  OrganizationRow,
  ProfileRow,
  TeamRow,
} from '../types/organization'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export function useOrgSetup() {
  const location = useLocation()
  const supabase = getSupabaseBrowserClient()
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [organization, setOrganization] = useState<OrganizationRow | null>(null)
  const [departments, setDepartments] = useState<DepartmentRow[]>([])
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [members, setMembers] = useState<OrganizationMemberRow[]>([])

  const {
    can,
    keys: permissionKeys,
    loading: permissionsLoading,
    refresh: refreshPermissions,
    isAdmin,
  } = usePermissions(user?.id)

  const loadProfileAndOrg = useCallback(
    async (uid: string) => {
      if (!supabase) return
      const { data: prof, error: pe } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      if (pe) throw pe
      const p = prof as ProfileRow | null
      setProfile(p)
      if (!p?.organization_id) {
        setOrganization(null)
        return
      }
      const { data: org, error: oe } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', p.organization_id)
        .maybeSingle()
      if (oe) throw oe
      setOrganization(org as OrganizationRow | null)
    },
    [supabase],
  )

  const refreshChildren = useCallback(async () => {
    if (!supabase || !organization?.id) {
      setDepartments([])
      setTeams([])
      setLocations([])
      setMembers([])
      return
    }
    const oid = organization.id
    const [dRes, tRes, lRes, mRes] = await Promise.all([
      supabase.from('departments').select('*').eq('organization_id', oid).order('sort_order'),
      supabase.from('teams').select('*').eq('organization_id', oid).order('sort_order'),
      supabase.from('locations').select('*').eq('organization_id', oid).order('sort_order'),
      supabase.from('organization_members').select('*').eq('organization_id', oid),
    ])
    if (dRes.error) throw dRes.error
    if (tRes.error) throw tRes.error
    if (lRes.error) throw lRes.error
    if (mRes.error) throw mRes.error
    setDepartments((dRes.data ?? []) as DepartmentRow[])
    setTeams((tRes.data ?? []) as TeamRow[])
    setLocations((lRes.data ?? []) as LocationRow[])
    setMembers((mRes.data ?? []) as OrganizationMemberRow[])
  }, [supabase, organization])

  /** Re-read session when the route changes (fixes: login → SPA navigate while user state was still null). */
  const syncSessionForRoute = useCallback(async () => {
    if (!supabase) return
    const {
      data: { session },
      error: sessErr,
    } = await supabase.auth.getSession()
    if (sessErr) return
    const u = session?.user ?? null
    setUser(u)
    if (u) {
      try {
        await ensureProfileRowExists(supabase, u.id)
        await loadProfileAndOrg(u.id)
        void refreshPermissions()
      } catch {
        /* ignore */
      }
    } else {
      setProfile(null)
      setOrganization(null)
    }
  }, [supabase, loadProfileAndOrg, refreshPermissions])

  useEffect(() => {
    if (!supabase) return
    void syncSessionForRoute()
  }, [location.pathname, supabase, syncSessionForRoute])

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => setLoadState('ready'))
      return
    }

    let cancelled = false

    const ensureProfileRow = async (uid: string) => {
      await ensureProfileRowExists(supabase, uid)
    }

    const hydrateUser = async (uid: string) => {
      await ensureProfileRow(uid)
      await loadProfileAndOrg(uid)
      // Ikke await: RPC kan henge eller mangle migrasjon — skal ikke blokkere innlasting
      void refreshPermissions()
    }

    queueMicrotask(() => {
      setLoadState('loading')
      setError(null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return

      const next = session?.user ?? null

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setOrganization(null)
        return
      }

      setUser(next)

      if (next && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED')) {
        if (event === 'TOKEN_REFRESHED') return
        void (async () => {
          try {
            await hydrateUser(next.id)
          } catch {
            /* ignore */
          }
        })()
      }
    })

    void (async () => {
      try {
        const { data: sessionData, error: sessErr } = await supabase.auth.getSession()
        if (sessErr) throw sessErr
        const u = sessionData.session?.user ?? null
        if (cancelled) return
        setUser(u)
        if (u) {
          try {
            await hydrateUser(u.id)
          } catch (e) {
            if (!cancelled) {
              setError(e instanceof Error ? e.message : 'Kunne ikke laste profil')
              setLoadState('error')
            }
            return
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Kunne ikke laste sesjon')
          setLoadState('error')
        }
        return
      }
      if (!cancelled) {
        setLoadState('ready')
      }
    })()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase, loadProfileAndOrg, refreshPermissions])

  useEffect(() => {
    if (!supabase || !organization?.id) {
      queueMicrotask(() => {
        setDepartments([])
        setTeams([])
        setLocations([])
        setMembers([])
      })
      return
    }
    let cancelled = false
    void (async () => {
      try {
        await refreshChildren()
      } catch {
        if (!cancelled) {
          /* RLS or missing tables */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, organization, refreshChildren])

  const createOrganizationFromBrreg = useCallback(
    async (orgnr: string, brreg?: BrregEnhet) => {
      if (!supabase || !user) throw new Error('Ikke klar.')
      const enhet = brreg ?? (await fetchEnhetByOrgnr(orgnr))
      const { data: newId, error: rpcErr } = await supabase.rpc('create_organization_with_brreg', {
        p_orgnr: enhet.organisasjonsnummer,
        p_name: enhet.navn,
        p_brreg: enhet as unknown as Record<string, unknown>,
      })
      if (rpcErr) throw rpcErr
      const id = typeof newId === 'string' ? newId : String(newId)
      await loadProfileAndOrg(user.id)
      await refreshPermissions()
      const { data: org } = await supabase.from('organizations').select('*').eq('id', id).single()
      setOrganization(org as OrganizationRow)
      return org as OrganizationRow
    },
    [supabase, user, loadProfileAndOrg, refreshPermissions],
  )

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (!supabase || !user) throw new Error('Ikke innlogget.')
      const { error: e } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id)
      if (e) throw e
      setProfile((p) => (p ? { ...p, display_name: displayName.trim() } : p))
    },
    [supabase, user],
  )

  const addDepartment = useCallback(
    async (name: string) => {
      if (!supabase || !organization?.id) throw new Error('Mangler organisasjon.')
      const { data, error: e } = await supabase
        .from('departments')
        .insert({
          organization_id: organization.id,
          name: name.trim(),
          sort_order: departments.length,
        })
        .select()
        .single()
      if (e) throw e
      setDepartments((d) => [...d, data as DepartmentRow])
      return data as DepartmentRow
    },
    [supabase, organization, departments.length],
  )

  const addTeam = useCallback(
    async (name: string, departmentId: string | null) => {
      if (!supabase || !organization?.id) throw new Error('Mangler organisasjon.')
      const { data, error: e } = await supabase
        .from('teams')
        .insert({
          organization_id: organization.id,
          department_id: departmentId,
          name: name.trim(),
          sort_order: teams.length,
        })
        .select()
        .single()
      if (e) throw e
      setTeams((t) => [...t, data as TeamRow])
      return data as TeamRow
    },
    [supabase, organization, teams.length],
  )

  const addLocation = useCallback(
    async (name: string, address?: string) => {
      if (!supabase || !organization?.id) throw new Error('Mangler organisasjon.')
      const { data, error: e } = await supabase
        .from('locations')
        .insert({
          organization_id: organization.id,
          name: name.trim(),
          address: address?.trim() || null,
          sort_order: locations.length,
        })
        .select()
        .single()
      if (e) throw e
      setLocations((l) => [...l, data as LocationRow])
      return data as LocationRow
    },
    [supabase, organization, locations.length],
  )

  const addOrgMember = useCallback(
    async (input: {
      displayName: string
      email?: string
      departmentId?: string | null
      teamId?: string | null
      locationId?: string | null
    }) => {
      if (!supabase || !organization?.id) throw new Error('Mangler organisasjon.')
      const { data, error: e } = await supabase
        .from('organization_members')
        .insert({
          organization_id: organization.id,
          display_name: input.displayName.trim(),
          email: input.email?.trim() || null,
          department_id: input.departmentId ?? null,
          team_id: input.teamId ?? null,
          location_id: input.locationId ?? null,
        })
        .select()
        .single()
      if (e) throw e
      setMembers((m) => [...m, data as OrganizationMemberRow])
      return data as OrganizationMemberRow
    },
    [supabase, organization],
  )

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setOrganization(null)
  }, [supabase])

  const completeOnboarding = useCallback(async () => {
    if (!supabase || !organization?.id) throw new Error('Mangler organisasjon.')
    const { error: e } = await supabase
      .from('organizations')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', organization.id)
    if (e) throw e
    setOrganization((o) =>
      o ? { ...o, onboarding_completed_at: new Date().toISOString() } : o,
    )
    await refreshPermissions()
  }, [supabase, organization, refreshPermissions])

  const needsOnboarding = useMemo(() => {
    if (!supabase) return false
    if (!user) return false
    if (!profile?.organization_id) return true
    if (!organization?.onboarding_completed_at) return true
    return false
  }, [supabase, user, profile?.organization_id, organization?.onboarding_completed_at])

  const ready = loadState === 'ready' || loadState === 'idle'

  return {
    supabase,
    supabaseConfigured: !!supabase,
    loadState,
    ready,
    error,
    user,
    can,
    permissionKeys,
    permissionsLoading,
    refreshPermissions,
    isAdmin,
    profile,
    organization,
    departments,
    teams,
    locations,
    members,
    needsOnboarding,
    refreshChildren,
    createOrganizationFromBrreg,
    updateDisplayName,
    addDepartment,
    addTeam,
    addLocation,
    addOrgMember,
    completeOnboarding,
    signOut,
    fetchEnhetByOrgnr,
    normalizeOrgNumber,
  }
}
