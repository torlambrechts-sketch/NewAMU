import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { usePermissions } from './usePermissions'
import { ensureProfileRowExists } from '../lib/ensureProfile'
import {
  DEMO_ORGANIZATION_ID,
  isDemoRouteSearch,
  persistDemoSessionFlag,
  readDemoSessionFlag,
} from '../lib/demoOrg'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { fetchEnhetByOrgnr, normalizeOrgNumber } from '../lib/brreg'
import type { BrregEnhet } from '../types/brreg'
import type { AppLocale } from '../i18n/strings'
import type { NotificationPreferences } from '../types/notifications'
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
  /** Must not be 'idle' when Supabase is on — OrgGate would redirect before getSession() restores from storage */
  const [loadState, setLoadState] = useState<LoadState>(() => (supabase ? 'loading' : 'ready'))
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

  const wantsDemoSession = useCallback(() => {
    return isDemoRouteSearch(location.search) || readDemoSessionFlag()
  }, [location.search])

  const attachDemoTenantIfNeeded = useCallback(async () => {
    if (!supabase || !wantsDemoSession()) return
    const { error } = await supabase.rpc('ensure_demo_org_profile_for_anonymous')
    if (error) console.warn('ensure_demo_org_profile_for_anonymous', error.message)
  }, [supabase, wantsDemoSession])

  const loadProfileAndOrg = useCallback(
    async (uid: string) => {
      if (!supabase) return
      const { data: prof, error: pe } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      if (pe) {
        console.warn('profiles select:', pe.message)
        setProfile(null)
        setOrganization(null)
        return
      }
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
      if (oe) {
        console.warn('organizations select:', oe.message)
        setOrganization(null)
        return
      }
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
    const first = await supabase.auth.getSession()
    if (first.error) return
    let session = first.data.session
    if (!session?.user && wantsDemoSession()) {
      const { error: anonErr } = await supabase.auth.signInAnonymously()
      if (!anonErr) {
        const next = await supabase.auth.getSession()
        if (!next.error) session = next.data.session
      }
    }
    const u = session?.user ?? null
    setUser(u)
    if (u) {
      try {
        if (wantsDemoSession()) {
          persistDemoSessionFlag(true)
          await attachDemoTenantIfNeeded()
        }
        await ensureProfileRowExists(supabase, u.id)
        await loadProfileAndOrg(u.id)
        setError(null)
        /* Permissions refresh only on auth events — avoid full-screen flicker on every navigation */
      } catch {
        /* ignore */
      }
    } else {
      setProfile(null)
      setOrganization(null)
    }
  }, [supabase, loadProfileAndOrg, wantsDemoSession, attachDemoTenantIfNeeded])

  /* Do not depend on location.pathname — re-reading session on every navigation caused flicker. */
  useEffect(() => {
    if (!supabase) return
    void syncSessionForRoute()
  }, [supabase, syncSessionForRoute])

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
      if (wantsDemoSession()) {
        persistDemoSessionFlag(true)
        await attachDemoTenantIfNeeded()
      }
      await ensureProfileRow(uid)
      await loadProfileAndOrg(uid)
      setError(null)
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

      if (next && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        void (async () => {
          try {
            await hydrateUser(next.id)
          } catch {
            /* ignore */
          }
        })()
      }
      if (event === 'TOKEN_REFRESHED' && next) {
        void refreshPermissions()
      }
    })

    void (async () => {
      try {
        const initial = await supabase.auth.getSession()
        if (initial.error) throw initial.error
        let sessionData = initial.data
        let u = sessionData.session?.user ?? null
        if (!u && wantsDemoSession()) {
          const { error: anonErr } = await supabase.auth.signInAnonymously()
          if (anonErr) {
            console.warn('signInAnonymously', anonErr.message)
          } else {
            const next = await supabase.auth.getSession()
            if (next.error) throw next.error
            sessionData = next.data
            u = sessionData.session?.user ?? null
          }
        }
        if (cancelled) return
        setUser(u)
        if (u) {
          try {
            await hydrateUser(u.id)
          } catch (e) {
            if (!cancelled) {
              console.warn('hydrateUser', e)
              setError(
                e instanceof Error
                  ? e.message
                  : 'Kunne ikke synkronisere profil. Du kan fortsatt fortsette oppsett — kjør SQL-migrasjon for profiles RLS hvis feilen vedvarer.',
              )
            }
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
  }, [supabase, loadProfileAndOrg, refreshPermissions, wantsDemoSession, attachDemoTenantIfNeeded])

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
      if (rpcErr) {
        throw new Error(getSupabaseErrorMessage(rpcErr))
      }
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
      if (e) throw new Error(getSupabaseErrorMessage(e))
      setProfile((p) => (p ? { ...p, display_name: displayName.trim() } : p))
    },
    [supabase, user],
  )

  const updateLocale = useCallback(
    async (locale: AppLocale) => {
      if (!supabase || !user) throw new Error('Ikke innlogget.')
      const { error: e } = await supabase.from('profiles').update({ locale }).eq('id', user.id)
      if (e) throw new Error(getSupabaseErrorMessage(e))
      setProfile((p) => (p ? { ...p, locale } : p))
    },
    [supabase, user],
  )

  const updateDepartmentId = useCallback(
    async (departmentId: string | null) => {
      if (!supabase || !user) throw new Error('Ikke innlogget.')
      const { error: e } = await supabase.from('profiles').update({ department_id: departmentId }).eq('id', user.id)
      if (e) throw new Error(getSupabaseErrorMessage(e))
      setProfile((p) => (p ? { ...p, department_id: departmentId } : p))
    },
    [supabase, user],
  )

  const updateNotificationPreferences = useCallback(
    async (next: NotificationPreferences) => {
      if (!supabase || !user) throw new Error('Ikke innlogget.')
      const { error: e } = await supabase
        .from('profiles')
        .update({ notification_preferences: next as unknown as Record<string, unknown> })
        .eq('id', user.id)
      if (e) throw new Error(getSupabaseErrorMessage(e))
      setProfile((p) => (p ? { ...p, notification_preferences: next as unknown as Record<string, unknown> } : p))
    },
    [supabase, user],
  )

  const updateLearningMetadata = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!supabase || !user) throw new Error('Ikke innlogget.')
      const base = (profile?.learning_metadata as Record<string, unknown> | undefined) ?? {}
      const next = { ...base, ...patch }
      const { error: e } = await supabase
        .from('profiles')
        .update({ learning_metadata: next })
        .eq('id', user.id)
      if (e) throw new Error(getSupabaseErrorMessage(e))
      setProfile((p) => (p ? { ...p, learning_metadata: next } : p))
      const { error: rpcErr } = await supabase.rpc('learning_refresh_path_enrollments_for_user', {
        p_user_id: user.id,
      })
      if (rpcErr) console.warn('learning_refresh_path_enrollments_for_user', rpcErr.message)
    },
    [supabase, user, profile?.learning_metadata],
  )

  const updateProfileFields = useCallback(
    async (patch: {
      display_name?: string
      phone?: string | null
      job_title?: string | null
      avatar_url?: string | null
      doc_font_size?: 'normal' | 'large' | 'xlarge' | null
      doc_high_contrast?: boolean | null
    }) => {
      if (!supabase || !user) throw new Error('Ikke innlogget.')
      const row: Record<string, unknown> = {}
      if (patch.display_name !== undefined) row.display_name = patch.display_name.trim() || 'Bruker'
      if (patch.phone !== undefined) row.phone = patch.phone?.trim() || null
      if (patch.job_title !== undefined) row.job_title = patch.job_title?.trim() || null
      if (patch.avatar_url !== undefined) row.avatar_url = patch.avatar_url?.trim() || null
      if (patch.doc_font_size !== undefined) {
        const v = patch.doc_font_size
        row.doc_font_size = v && ['normal', 'large', 'xlarge'].includes(v) ? v : 'normal'
      }
      if (patch.doc_high_contrast !== undefined) row.doc_high_contrast = Boolean(patch.doc_high_contrast)
      if (Object.keys(row).length === 0) return
      const { error: e } = await supabase.from('profiles').update(row).eq('id', user.id)
      if (e) throw new Error(getSupabaseErrorMessage(e))
      setProfile((p) => {
        if (!p) return p
        return {
          ...p,
          ...(row.display_name !== undefined ? { display_name: String(row.display_name) } : {}),
          ...(row.phone !== undefined ? { phone: row.phone as string | null } : {}),
          ...(row.job_title !== undefined ? { job_title: row.job_title as string | null } : {}),
          ...(row.avatar_url !== undefined ? { avatar_url: row.avatar_url as string | null } : {}),
          ...(row.doc_font_size !== undefined ? { doc_font_size: String(row.doc_font_size) } : {}),
          ...(row.doc_high_contrast !== undefined ? { doc_high_contrast: Boolean(row.doc_high_contrast) } : {}),
        }
      })
    },
    [supabase, user],
  )

  const updatePassword = useCallback(
    async (newPassword: string) => {
      if (!supabase || !user) throw new Error('Ikke innlogget.')
      if (newPassword.length < 8) throw new Error('Passordet må være minst 8 tegn.')
      const { error: e } = await supabase.auth.updateUser({ password: newPassword })
      if (e) throw new Error(getSupabaseErrorMessage(e))
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
    persistDemoSessionFlag(false)
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

  const isPlatformAdminRoute =
    location.pathname.startsWith('/platform-admin') && location.pathname !== '/platform-admin/login'

  const needsOnboarding = useMemo(() => {
    if (isPlatformAdminRoute) return false
    if (!supabase) return false
    if (!user) return false
    if (profile?.organization_id === DEMO_ORGANIZATION_ID) return false
    if (!profile?.organization_id) return true
    if (!organization?.onboarding_completed_at) return true
    return false
  }, [
    isPlatformAdminRoute,
    supabase,
    user,
    profile?.organization_id,
    organization?.onboarding_completed_at,
  ])

  const ready = loadState === 'ready' || loadState === 'idle'

  const isDemoMode = useMemo(
    () => profile?.organization_id === DEMO_ORGANIZATION_ID && user?.is_anonymous === true,
    [profile?.organization_id, user?.is_anonymous],
  )

  return {
    supabase,
    supabaseConfigured: !!supabase,
    loadState,
    ready,
    error,
    isDemoMode,
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
    updateLocale,
    updateDepartmentId,
    updateLearningMetadata,
    updateProfileFields,
    updateNotificationPreferences,
    updatePassword,
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
