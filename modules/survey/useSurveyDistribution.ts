import { useCallback, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import { randomSurveyInvitationToken } from './surveyInviteLink'
import type { SurveyDistributionRow, SurveyInvitationRow } from './types'
import { parseSurveyDistributionRow, parseSurveyInvitationRow } from './types'

type Supabase = SupabaseClient

function collect<T>(rows: unknown[] | null | undefined, parse: (r: unknown) => { success: true; data: T } | { success: false }): T[] {
  const out: T[] = []
  for (const raw of rows ?? []) {
    const p = parse(raw)
    if (p.success && p.data !== undefined) out.push(p.data)
  }
  return out
}

type Params = {
  supabase: Supabase | null
  assertOrg: () => string | null
  requireManage: () => boolean
  setError: (msg: string | null) => void
  user: User | null
}

export function useSurveyDistribution({ supabase, assertOrg, requireManage, setError, user }: Params) {
  const [distributions, setDistributions] = useState<SurveyDistributionRow[]>([])
  const [invitations, setInvitations] = useState<SurveyInvitationRow[]>([])
  const [distributionsLoading, setDistributionsLoading] = useState(false)

  const clearDistributionState = useCallback(() => {
    setDistributions([])
    setInvitations([])
  }, [])

  const loadDistributions = useCallback(
    async (surveyId: string) => {
      if (!supabase) return
      const oid = assertOrg()
      if (!oid) return
      setDistributionsLoading(true)
      try {
        const { data, error: e } = await supabase
          .from('survey_distributions')
          .select('*')
          .eq('survey_id', surveyId)
          .eq('organization_id', oid)
          .order('created_at', { ascending: false })
        if (e) throw e
        const rows = collect(data, parseSurveyDistributionRow)
        setDistributions(rows)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        setDistributions([])
      } finally {
        setDistributionsLoading(false)
      }
    },
    [supabase, assertOrg, setError],
  )

  const loadInvitations = useCallback(
    async (surveyId: string) => {
      if (!supabase) return
      const oid = assertOrg()
      if (!oid) return
      try {
        const { data, error: e } = await supabase
          .from('survey_invitations')
          .select('*')
          .eq('survey_id', surveyId)
          .eq('organization_id', oid)
          .order('created_at', { ascending: true })
        if (e) throw e
        setInvitations(collect(data, parseSurveyInvitationRow))
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        setInvitations([])
      }
    },
    [supabase, assertOrg, setError],
  )

  const normEmail = (e: string | null | undefined) => (e ?? '').trim().toLowerCase()

  const createDistribution = useCallback(
    async (input: {
      surveyId: string
      label?: string | null
      audienceType: 'all' | 'departments' | 'teams' | 'locations'
      departmentIds?: string[]
      teamIds?: string[]
      locationIds?: string[]
      scheduledInitialSendAt?: string | null
    }): Promise<SurveyDistributionRow | null> => {
      if (!supabase) return null
      if (!requireManage()) return null
      const oid = assertOrg()
      if (!oid) return null
      setError(null)
      try {
        const audience_department_ids =
          input.audienceType === 'departments' ? (input.departmentIds ?? []).filter(Boolean) : []
        const audience_team_ids = input.audienceType === 'teams' ? (input.teamIds ?? []).filter(Boolean) : []
        const audience_location_ids =
          input.audienceType === 'locations' ? (input.locationIds ?? []).filter(Boolean) : []
        const row = {
          organization_id: oid,
          survey_id: input.surveyId,
          label: input.label?.trim() || null,
          audience_type: input.audienceType,
          audience_department_ids: audience_department_ids.length > 0 ? audience_department_ids : [],
          audience_team_ids: audience_team_ids.length > 0 ? audience_team_ids : [],
          audience_location_ids: audience_location_ids.length > 0 ? audience_location_ids : [],
          scheduled_initial_send_at: input.scheduledInitialSendAt?.trim() || null,
          status: 'draft' as const,
          invite_count: 0,
          created_by: user?.id ?? null,
        }
        const { data, error: e } = await supabase.from('survey_distributions').insert(row).select().single()
        if (e) throw e
        const p = parseSurveyDistributionRow(data)
        if (!p.success) throw new Error('Ugyldig svar fra database')
        setDistributions((prev) => [p.data, ...prev])
        return p.data
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, assertOrg, requireManage, setError, user?.id],
  )

  const generateInvitations = useCallback(
    async (distributionId: string, surveyId: string): Promise<boolean> => {
      if (!supabase) return false
      if (!requireManage()) return false
      const oid = assertOrg()
      if (!oid) return false
      setError(null)
      try {
        const { data: distRaw, error: de } = await supabase
          .from('survey_distributions')
          .select('*')
          .eq('id', distributionId)
          .eq('survey_id', surveyId)
          .eq('organization_id', oid)
          .single()
        if (de) throw de
        const dist = parseSurveyDistributionRow(distRaw)
        if (!dist.success) throw new Error('Ugyldig distribusjon')
        if (dist.data.status !== 'draft') {
          setError('Distribusjonen er allerede generert.')
          return false
        }

        const { data: profRows, error: pe } = await supabase
          .from('profiles')
          .select('id, email, department_id')
          .eq('organization_id', oid)
        if (pe) throw pe

        type P = { id: string; email: string | null; department_id: string | null }
        const profiles = (profRows ?? []) as P[]
        const profileById = new Map(profiles.map((p) => [p.id, p]))
        const profileByEmail = new Map<string, P>()
        for (const p of profiles) {
          const k = normEmail(p.email)
          if (k && !profileByEmail.has(k)) profileByEmail.set(k, p)
        }

        let filtered: P[]

        const resolveMembersToProfiles = (
          members: Array<{ email: string | null; user_id: string | null }>,
        ): P[] => {
          const seen = new Set<string>()
          const out: P[] = []
          for (const m of members) {
            let prof: P | undefined
            if (m.user_id) {
              prof = profileById.get(m.user_id)
            }
            if (!prof) {
              const k = normEmail(m.email)
              if (k) prof = profileByEmail.get(k)
            }
            if (!prof || seen.has(prof.id)) continue
            seen.add(prof.id)
            out.push(prof)
          }
          return out
        }

        if (dist.data.audience_type === 'teams') {
          const teamIds = new Set(dist.data.audience_team_ids ?? [])
          if (teamIds.size === 0) {
            setError('Ingen team valgt.')
            return false
          }
          const { data: memRows, error: me } = await supabase
            .from('organization_members')
            .select('email, team_id, user_id')
            .eq('organization_id', oid)
          if (me) throw me
          type M = { email: string | null; team_id: string | null; user_id: string | null }
          const members = ((memRows ?? []) as M[]).filter(
            (m) => m.team_id != null && teamIds.has(m.team_id) && (Boolean(m.email?.trim()) || Boolean(m.user_id)),
          )
          filtered = resolveMembersToProfiles(members)
        } else if (dist.data.audience_type === 'locations') {
          const locIds = new Set(dist.data.audience_location_ids ?? [])
          if (locIds.size === 0) {
            setError('Ingen lokasjon valgt.')
            return false
          }
          const { data: memRows, error: me } = await supabase
            .from('organization_members')
            .select('email, location_id, user_id')
            .eq('organization_id', oid)
          if (me) throw me
          type M = { email: string | null; location_id: string | null; user_id: string | null }
          const members = ((memRows ?? []) as M[]).filter(
            (m) =>
              m.location_id != null &&
              locIds.has(m.location_id) &&
              (Boolean(m.email?.trim()) || Boolean(m.user_id)),
          )
          filtered = resolveMembersToProfiles(members)
        } else {
          const deptIds = new Set(dist.data.audience_department_ids ?? [])
          filtered =
            dist.data.audience_type === 'all'
              ? profiles
              : profiles.filter((p) => p.department_id && deptIds.has(p.department_id))
        }

        if (filtered.length === 0) {
          setError(
            dist.data.audience_type === 'teams'
              ? 'Ingen innloggede brukere matcher utvalgte team (kobling via bruker-ID eller e-post i katalog og profil).'
              : dist.data.audience_type === 'locations'
                ? 'Ingen innloggede brukere matcher utvalgte lokasjoner (kobling via bruker-ID eller e-post).'
                : 'Ingen mottakere matcher målgruppen.',
          )
          return false
        }

        const invitationRows = filtered.map((p) => ({
          organization_id: oid,
          survey_id: surveyId,
          distribution_id: distributionId,
          profile_id: p.id,
          department_id: p.department_id,
          email_snapshot: p.email,
          status: 'pending' as const,
          access_token: randomSurveyInvitationToken(),
        }))

        const { error: insErr } = await supabase.from('survey_invitations').insert(invitationRows)
        if (insErr) throw insErr

        const { error: upErr } = await supabase
          .from('survey_distributions')
          .update({
            status: 'generated',
            invite_count: filtered.length,
          })
          .eq('id', distributionId)
          .eq('organization_id', oid)
        if (upErr) throw upErr

        await loadDistributions(surveyId)
        await loadInvitations(surveyId)
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, assertOrg, requireManage, setError, loadDistributions, loadInvitations],
  )

  const addManualInvitations = useCallback(
    async (distributionId: string, surveyId: string, profileIds: string[]): Promise<boolean> => {
      if (!supabase) return false
      if (!requireManage()) return false
      const oid = assertOrg()
      if (!oid) return false
      const ids = [...new Set(profileIds.filter(Boolean))]
      if (ids.length === 0) return false
      setError(null)
      try {
        const { data: distRaw, error: de } = await supabase
          .from('survey_distributions')
          .select('*')
          .eq('id', distributionId)
          .eq('survey_id', surveyId)
          .eq('organization_id', oid)
          .single()
        if (de) throw de
        const dist = parseSurveyDistributionRow(distRaw)
        if (!dist.success) throw new Error('Ugyldig distribusjon')
        if (dist.data.status === 'cancelled') {
          setError('Distribusjonen er avbrutt.')
          return false
        }

        const { data: existingRows, error: exErr } = await supabase
          .from('survey_invitations')
          .select('profile_id')
          .eq('distribution_id', distributionId)
        if (exErr) throw exErr
        const existing = new Set((existingRows ?? []).map((r: { profile_id: string }) => r.profile_id))

        const { data: profRows, error: pe } = await supabase
          .from('profiles')
          .select('id, email, department_id')
          .eq('organization_id', oid)
          .in('id', ids)
        if (pe) throw pe
        const profiles = (profRows ?? []) as Array<{ id: string; email: string | null; department_id: string | null }>
        const toAdd = profiles.filter((p) => !existing.has(p.id))
        if (toAdd.length === 0) {
          setError('Alle valgte er allerede på listen.')
          return false
        }

        const invitationRows = toAdd.map((p) => ({
          organization_id: oid,
          survey_id: surveyId,
          distribution_id: distributionId,
          profile_id: p.id,
          department_id: p.department_id,
          email_snapshot: p.email,
          status: 'pending' as const,
          access_token: randomSurveyInvitationToken(),
        }))
        const { error: insErr } = await supabase.from('survey_invitations').insert(invitationRows)
        if (insErr) throw insErr

        const { count, error: cErr } = await supabase
          .from('survey_invitations')
          .select('*', { count: 'exact', head: true })
          .eq('distribution_id', distributionId)
        if (cErr) throw cErr

        const { error: upErr } = await supabase
          .from('survey_distributions')
          .update({
            invite_count: count ?? dist.data.invite_count + toAdd.length,
            status: 'generated',
          })
          .eq('id', distributionId)
          .eq('organization_id', oid)
        if (upErr) throw upErr

        await loadDistributions(surveyId)
        await loadInvitations(surveyId)
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, assertOrg, requireManage, setError, loadDistributions, loadInvitations],
  )

  const exportDistributionCsv = useCallback(
    async (surveyId: string, distributionId: string) => {
      const invs = invitations.filter((i) => i.distribution_id === distributionId && i.survey_id === surveyId)
      const dist = distributions.find((d) => d.id === distributionId)
      const header = [
        'distribution_label',
        'profile_id',
        'email',
        'department_id',
        'status',
        'email_sent_at',
        'reminder_sent_at',
        'reminder_count',
        'email_delivery_status',
        'completed',
      ]
      const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
      const lines = [
        header.join(','),
        ...invs.map((i) =>
          [
            escape(dist?.label?.trim() ?? ''),
            i.profile_id,
            escape(i.email_snapshot ?? ''),
            i.department_id ?? '',
            i.status,
            i.email_sent_at ?? '',
            i.reminder_sent_at ?? '',
            String(i.reminder_count ?? 0),
            escape(i.email_delivery_status ?? ''),
            i.status === 'completed' ? 'yes' : 'no',
          ].join(','),
        ),
      ]
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `survey-distribusjon-${distributionId.slice(0, 8)}.csv`
      a.rel = 'noopener'
      a.click()
      URL.revokeObjectURL(url)
    },
    [invitations, distributions],
  )

  const sendInvitationEmails = useCallback(
    async (distributionId: string, surveyId: string): Promise<{ sent: number; failed: number } | null> => {
      if (!supabase) return null
      if (!requireManage()) return null
      const oid = assertOrg()
      if (!oid) return null
      setError(null)
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('send-survey-invites', {
          body: { distribution_id: distributionId, survey_id: surveyId, mode: 'initial' },
        })
        if (fnErr) throw fnErr
        const summary = data as { summary?: { sent?: number; failed?: number } } | null
        const sent = summary?.summary?.sent ?? 0
        const failed = summary?.summary?.failed ?? 0
        await loadInvitations(surveyId)
        return { sent, failed }
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, assertOrg, requireManage, setError, loadInvitations],
  )

  const sendInvitationReminders = useCallback(
    async (distributionId: string, surveyId: string): Promise<{ sent: number; failed: number } | null> => {
      if (!supabase) return null
      if (!requireManage()) return null
      const oid = assertOrg()
      if (!oid) return null
      setError(null)
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('send-survey-invites', {
          body: { distribution_id: distributionId, survey_id: surveyId, mode: 'reminder' },
        })
        if (fnErr) throw fnErr
        const summary = data as { summary?: { sent?: number; failed?: number } } | null
        const sent = summary?.summary?.sent ?? 0
        const failed = summary?.summary?.failed ?? 0
        await loadInvitations(surveyId)
        return { sent, failed }
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, assertOrg, requireManage, setError, loadInvitations],
  )

  return {
    distributions,
    invitations,
    distributionsLoading,
    clearDistributionState,
    loadDistributions,
    loadInvitations,
    createDistribution,
    generateInvitations,
    addManualInvitations,
    exportDistributionCsv,
    sendInvitationEmails,
    sendInvitationReminders,
  }
}
