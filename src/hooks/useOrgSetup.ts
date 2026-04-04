import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
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
  }, [supabase, organization?.id])

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => setLoadState('ready'))
      return
    }

    let cancelled = false
    let unsubscribe: (() => void) | undefined

    ;(async () => {
      setLoadState('loading')
      setError(null)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        let u = sessionData.session?.user ?? null
        if (!u) {
          const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously()
          if (anonErr) throw anonErr
          if (!anon.user) throw new Error('Anonym innlogging returnerte ingen bruker.')
          u = anon.user
        }
        if (cancelled) return
        setUser(u)

        const { data: existing } = await supabase.from('profiles').select('id').eq('id', u.id).maybeSingle()
        if (!existing) {
          const { error: insErr } = await supabase
            .from('profiles')
            .insert({ id: u.id, display_name: 'Bruker' })
          if (insErr?.code !== '23505') {
            if (insErr) throw insErr
          }
        }

        await loadProfileAndOrg(u.id)
        if (cancelled) return

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null)
        })
        unsubscribe = () => subscription.unsubscribe()

        setLoadState('ready')
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Kunne ikke laste organisasjon')
          setLoadState('error')
        }
      }
    })()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [supabase, loadProfileAndOrg])

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
  }, [supabase, organization?.id, refreshChildren])

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
      const { data: org } = await supabase.from('organizations').select('*').eq('id', id).single()
      setOrganization(org as OrganizationRow)
      return org as OrganizationRow
    },
    [supabase, user, loadProfileAndOrg],
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
    [supabase, organization?.id, departments.length],
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
    [supabase, organization?.id, teams.length],
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
    [supabase, organization?.id, locations.length],
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
    [supabase, organization?.id],
  )

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
  }, [supabase, organization?.id])

  const needsOnboarding = useMemo(() => {
    if (!supabase) return false
    if (!profile?.organization_id) return true
    if (!organization?.onboarding_completed_at) return true
    return false
  }, [supabase, profile?.organization_id, organization?.onboarding_completed_at])

  const ready = loadState === 'ready' || loadState === 'idle'

  return {
    supabaseConfigured: !!supabase,
    loadState,
    ready,
    error,
    user,
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
    fetchEnhetByOrgnr,
    normalizeOrgNumber,
  }
}
