import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import {
  AmuAgendaItemSchema,
  AmuDefaultAgendaItemSchema,
  AmuDecisionSchema,
  AmuMeetingSchema,
  AmuParticipantSchema,
  AmuSickLeavePrivacyStatsSchema,
  AmuWhistleblowingPrivacyStatsSchema,
  parseAmuMeetingFromDb,
} from './schema'
import type {
  AmuAgendaItem,
  AmuDefaultAgendaItem,
  AmuDecision,
  AmuMeeting,
  AmuParticipant,
  AmuSickLeavePrivacyStats,
  AmuWhistleblowingPrivacyStats,
} from './types'

type AmuPrivacyRpcWhistle = { open?: number; closed?: number }
type AmuPrivacyRpcSick = { active?: number; partial?: number; other?: number }

function isSignedMeeting(status: AmuMeeting['status']): boolean {
  return status === 'signed'
}

export function useAmu() {
  const { supabase, organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id

  const canManage = isAdmin || can('amu.manage')

  const [meetings, setMeetings] = useState<AmuMeeting[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('amu_meetings')
        .select('*')
        .eq('organization_id', orgId)
        .order('meeting_date', { ascending: false })
      if (qErr) throw qErr
      const rows: AmuMeeting[] = []
      for (const raw of data ?? []) {
        rows.push(parseAmuMeetingFromDb(raw))
      }
      setMeetings(rows)
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const assertCanMutateSigned = useCallback(
    (meeting: AmuMeeting | null, actionLabel: string): meeting is AmuMeeting => {
      if (!meeting) {
        setError('Møtet finnes ikke.')
        return false
      }
      if (isSignedMeeting(meeting.status)) {
        setError(`Kan ikke ${actionLabel} når møtet er signert.`)
        return false
      }
      return true
    },
    [],
  )

  const getMeeting = useCallback(
    async (meetingId: string): Promise<AmuMeeting | null> => {
      if (!supabase || !orgId) return null
      const { data, error: qErr } = await supabase
        .from('amu_meetings')
        .select('*')
        .eq('organization_id', orgId)
        .eq('id', meetingId)
        .maybeSingle()
      if (qErr) {
        setError(getSupabaseErrorMessage(qErr))
        return null
      }
      if (!data) return null
      try {
        return parseAmuMeetingFromDb(data)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId],
  )

  const loadAgendaItems = useCallback(
    async (meetingId: string): Promise<AmuAgendaItem[]> => {
      if (!supabase || !orgId) return []
      setError(null)
      try {
        const { data, error: qErr } = await supabase
          .from('amu_agenda_items')
          .select('*')
          .eq('organization_id', orgId)
          .eq('meeting_id', meetingId)
          .order('order_index', { ascending: true })
        if (qErr) throw qErr
        const out: AmuAgendaItem[] = []
        for (const raw of data ?? []) {
          out.push(AmuAgendaItemSchema.parse(raw))
        }
        return out
      } catch (err) {
        const msg = getSupabaseErrorMessage(err)
        setError(msg)
        return []
      }
    },
    [supabase, orgId],
  )

  const loadDecisionsForMeeting = useCallback(
    async (meetingId: string): Promise<AmuDecision[]> => {
      if (!supabase || !orgId) return []
      setError(null)
      try {
        const items = await loadAgendaItems(meetingId)
        const ids = items.map((i) => i.id)
        if (ids.length === 0) return []
        const { data, error: qErr } = await supabase
          .from('amu_decisions')
          .select('*')
          .eq('organization_id', orgId)
          .in('agenda_item_id', ids)
        if (qErr) throw qErr
        const out: AmuDecision[] = []
        for (const raw of data ?? []) {
          out.push(AmuDecisionSchema.parse(raw))
        }
        return out
      } catch (err) {
        const msg = getSupabaseErrorMessage(err)
        setError(msg)
        return []
      }
    },
    [supabase, orgId, loadAgendaItems],
  )

  /**
   * Kun aggregerte tellere — ingen PII fra varslingssaker.
   * Bruk aldri direkte `select` mot varslingstabeller for AMU-deltakere uten særskilt fullmakt.
   */
  const fetchWhistleblowingAgendaStats = useCallback(async (): Promise<AmuWhistleblowingPrivacyStats | null> => {
    if (!supabase) return null
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('amu_privacy_whistleblowing_stats')
      if (rpcErr) throw rpcErr
      const p = data as AmuPrivacyRpcWhistle | null
      return AmuWhistleblowingPrivacyStatsSchema.parse({
        open: Number(p?.open ?? 0),
        closed: Number(p?.closed ?? 0),
      })
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
      return null
    }
  }, [supabase])

  /**
   * Aggregert statusfordeling for sykefravær (JSON i org-modul) — ingen personidentifiserende felt.
   */
  const fetchSickLeaveAgendaStats = useCallback(async (): Promise<AmuSickLeavePrivacyStats | null> => {
    if (!supabase) return null
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('amu_privacy_sick_leave_stats')
      if (rpcErr) throw rpcErr
      const p = data as AmuPrivacyRpcSick | null
      return AmuSickLeavePrivacyStatsSchema.parse({
        active: Number(p?.active ?? 0),
        partial: Number(p?.partial ?? 0),
        other: Number(p?.other ?? 0),
      })
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
      return null
    }
  }, [supabase])

  const loadDefaultAgendaTemplate = useCallback(async (): Promise<AmuDefaultAgendaItem[]> => {
    if (!supabase || !orgId) return []
    try {
      const { data, error: qErr } = await supabase
        .from('amu_default_agenda_items')
        .select('*')
        .eq('organization_id', orgId)
        .order('order_index', { ascending: true })
      if (qErr) throw qErr
      return (data ?? []).map((raw) => AmuDefaultAgendaItemSchema.parse(raw))
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
      return []
    }
  }, [supabase, orgId])

  const createDefaultAgendaTemplateRow = useCallback(
    async (row: Pick<AmuDefaultAgendaItem, 'title' | 'description' | 'order_index' | 'source_module'>) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang.')
        return null
      }
      setError(null)
      try {
        const { data, error: insErr } = await supabase
          .from('amu_default_agenda_items')
          .insert({
            organization_id: orgId,
            title: row.title,
            description: row.description,
            order_index: row.order_index,
            source_module: row.source_module,
          })
          .select('*')
          .single()
        if (insErr) throw insErr
        return AmuDefaultAgendaItemSchema.parse(data)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage],
  )

  const updateDefaultAgendaTemplateRow = useCallback(
    async (id: string, patch: Partial<Pick<AmuDefaultAgendaItem, 'title' | 'description' | 'order_index' | 'source_module'>>) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang.')
        return null
      }
      setError(null)
      try {
        const { data, error: upErr } = await supabase
          .from('amu_default_agenda_items')
          .update(patch)
          .eq('organization_id', orgId)
          .eq('id', id)
          .select('*')
          .single()
        if (upErr) throw upErr
        return AmuDefaultAgendaItemSchema.parse(data)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage],
  )

  const deleteDefaultAgendaTemplateRow = useCallback(
    async (id: string) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return false
      }
      if (!canManage) {
        setError('Du har ikke tilgang.')
        return false
      }
      setError(null)
      try {
        const { error: dErr } = await supabase
          .from('amu_default_agenda_items')
          .delete()
          .eq('organization_id', orgId)
          .eq('id', id)
        if (dErr) throw dErr
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, orgId, canManage],
  )

  const generateDefaultAgenda = useCallback(
    async (meetingId: string): Promise<AmuAgendaItem[] | null> => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å redigere AMU-agenda.')
        return null
      }
      setError(null)
      try {
        const meeting = await getMeeting(meetingId)
        if (!assertCanMutateSigned(meeting, 'oppdatere agenda for')) return null

        const existing = await loadAgendaItems(meetingId)
        if (existing.length > 0) {
          setError('Agenda er allerede opprettet for dette møtet.')
          return null
        }

        const template = await loadDefaultAgendaTemplate()
        if (template.length === 0) {
          setError('Ingen standard saksliste er definert. Gå til AMU — administrasjon og opprett punkter under «Standard saksliste».')
          return null
        }

        const rows = template.map((s) => ({
          meeting_id: meetingId,
          organization_id: orgId,
          title: s.title,
          description: s.description,
          order_index: s.order_index,
          source_module: s.source_module,
          source_id: null as string | null,
        }))

        const { data, error: insErr } = await supabase.from('amu_agenda_items').insert(rows).select('*')
        if (insErr) throw insErr
        const parsed: AmuAgendaItem[] = []
        for (const raw of data ?? []) {
          parsed.push(AmuAgendaItemSchema.parse(raw))
        }
        return parsed
      } catch (err) {
        const msg = getSupabaseErrorMessage(err)
        setError(msg)
        return null
      }
    },
    [supabase, orgId, canManage, getMeeting, loadAgendaItems, assertCanMutateSigned, loadDefaultAgendaTemplate],
  )

  const loadParticipants = useCallback(
    async (meetingId: string): Promise<AmuParticipant[]> => {
      if (!supabase || !orgId) return []
      try {
        const { data, error: qErr } = await supabase
          .from('amu_participants')
          .select('*')
          .eq('organization_id', orgId)
          .eq('meeting_id', meetingId)
          .order('role', { ascending: true })
        if (qErr) throw qErr
        return (data ?? []).map((raw) => AmuParticipantSchema.parse(raw))
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return []
      }
    },
    [supabase, orgId],
  )

  const upsertParticipant = useCallback(
    async (
      meetingId: string,
      userId: string,
      patch: Partial<Pick<AmuParticipant, 'role' | 'present' | 'signed_at'>>,
    ): Promise<AmuParticipant | null> => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å administrere deltakere.')
        return null
      }
      setError(null)
      try {
        const meeting = await getMeeting(meetingId)
        if (!assertCanMutateSigned(meeting, 'oppdatere deltakere for')) return null

        const { data, error: upErr } = await supabase
          .from('amu_participants')
          .upsert(
            {
              meeting_id: meetingId,
              user_id: userId,
              organization_id: orgId,
              role: patch.role ?? 'employer_rep',
              present: patch.present ?? false,
              signed_at: patch.signed_at ?? null,
            },
            { onConflict: 'meeting_id,user_id' },
          )
          .select('*')
          .single()
        if (upErr) throw upErr
        return AmuParticipantSchema.parse(data)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage, getMeeting, assertCanMutateSigned],
  )

  const removeParticipant = useCallback(
    async (meetingId: string, userId: string) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return false
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å fjerne deltakere.')
        return false
      }
      setError(null)
      try {
        const meeting = await getMeeting(meetingId)
        if (!assertCanMutateSigned(meeting, 'fjerne deltakere fra')) return false

        const { error: dErr } = await supabase
          .from('amu_participants')
          .delete()
          .eq('organization_id', orgId)
          .eq('meeting_id', meetingId)
          .eq('user_id', userId)
        if (dErr) throw dErr
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, orgId, canManage, getMeeting, assertCanMutateSigned],
  )

  const insertAgendaItem = useCallback(
    async (meetingId: string, row: Pick<AmuAgendaItem, 'title' | 'description' | 'order_index' | 'source_module' | 'source_id'>) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å legge til agendapunkter.')
        return null
      }
      setError(null)
      try {
        const meeting = await getMeeting(meetingId)
        if (!assertCanMutateSigned(meeting, 'legge til agendapunkter for')) return null

        const { data, error: insErr } = await supabase
          .from('amu_agenda_items')
          .insert({
            meeting_id: meetingId,
            organization_id: orgId,
            title: row.title,
            description: row.description,
            order_index: row.order_index,
            source_module: row.source_module,
            source_id: row.source_id,
          })
          .select('*')
          .single()
        if (insErr) throw insErr
        return AmuAgendaItemSchema.parse(data)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage, getMeeting, assertCanMutateSigned],
  )

  const createActionPlanItemFromAgenda = useCallback(
    async (agendaItemId: string, input: { title: string; description: string; dueAtIso: string; responsibleUserId: string | null }) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å opprette tiltak.')
        return null
      }
      setError(null)
      try {
        const { data: arow, error: aErr } = await supabase
          .from('amu_agenda_items')
          .select('meeting_id')
          .eq('organization_id', orgId)
          .eq('id', agendaItemId)
          .single()
        if (aErr) throw aErr
        const meeting = await getMeeting((arow as { meeting_id: string }).meeting_id)
        if (!assertCanMutateSigned(meeting, 'opprette tiltak for')) return null

        const dueAt = input.dueAtIso
        const { data, error: insErr } = await supabase
          .from('action_plan_items')
          .insert({
            organization_id: orgId,
            source_table: 'amu_agenda_items',
            source_id: agendaItemId,
            source_module: 'amu',
            title: input.title.trim(),
            description: input.description.trim(),
            due_at: dueAt,
            deadline: dueAt,
            responsible_id: input.responsibleUserId,
            assigned_to: input.responsibleUserId,
            status: 'open',
          })
          .select('id')
          .single()
        if (insErr) throw insErr
        return (data as { id: string }).id
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage, getMeeting, assertCanMutateSigned],
  )

  const signMeetingAsChair = useCallback(
    async (meetingId: string, chairUserId: string) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å signere møte.')
        return null
      }
      setError(null)
      try {
        const nowIso = new Date().toISOString()
        const { data, error: upErr } = await supabase
          .from('amu_meetings')
          .update({
            status: 'signed',
            meeting_chair_user_id: chairUserId,
            chair_signed_at: nowIso,
          })
          .eq('organization_id', orgId)
          .eq('id', meetingId)
          .select('*')
          .single()
        if (upErr) throw upErr
        const m = parseAmuMeetingFromDb(data)
        setMeetings((prev) => prev.map((x) => (x.id === m.id ? m : x)))
        return m
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage],
  )

  const createMeeting = useCallback(
    async (input: Pick<AmuMeeting, 'title' | 'date' | 'location' | 'status'>) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å opprette AMU-møter.')
        return null
      }
      setError(null)
      try {
        const payload = {
          organization_id: orgId,
          title: input.title,
          meeting_date: input.date,
          location: input.location ?? '',
          status: input.status,
        }
        const { data, error: insErr } = await supabase.from('amu_meetings').insert(payload).select('*').single()
        if (insErr) throw insErr
        const m = parseAmuMeetingFromDb(data)
        AmuMeetingSchema.parse(m)
        setMeetings((prev) => [m, ...prev.filter((x) => x.id !== m.id)])
        return m
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage],
  )

  const updateMeeting = useCallback(
    async (
      meetingId: string,
      patch: Partial<
        Pick<
          AmuMeeting,
          | 'title'
          | 'date'
          | 'location'
          | 'status'
          | 'minutes_draft'
          | 'meeting_chair_user_id'
          | 'chair_signed_at'
        >
      >,
    ) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre AMU-møter.')
        return null
      }
      setError(null)
      try {
        const current = await getMeeting(meetingId)
        if (!assertCanMutateSigned(current, 'endre')) return null

        const dbPatch: Record<string, unknown> = {}
        if (patch.title !== undefined) dbPatch.title = patch.title
        if (patch.date !== undefined) dbPatch.meeting_date = patch.date
        if (patch.location !== undefined) dbPatch.location = patch.location
        if (patch.status !== undefined) dbPatch.status = patch.status
        if (patch.minutes_draft !== undefined) dbPatch.minutes_draft = patch.minutes_draft
        if (patch.meeting_chair_user_id !== undefined) dbPatch.meeting_chair_user_id = patch.meeting_chair_user_id
        if (patch.chair_signed_at !== undefined) dbPatch.chair_signed_at = patch.chair_signed_at

        const { data, error: upErr } = await supabase
          .from('amu_meetings')
          .update(dbPatch)
          .eq('organization_id', orgId)
          .eq('id', meetingId)
          .select('*')
          .single()
        if (upErr) throw upErr
        const m = parseAmuMeetingFromDb(data)
        setMeetings((prev) => prev.map((x) => (x.id === m.id ? m : x)))
        return m
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage, getMeeting, assertCanMutateSigned],
  )

  const updateAgendaItem = useCallback(
    async (agendaItemId: string, patch: Partial<Pick<AmuAgendaItem, 'title' | 'description' | 'order_index' | 'source_module' | 'source_id'>>) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre agendapunkter.')
        return null
      }
      setError(null)
      try {
        const { data: row, error: fErr } = await supabase
          .from('amu_agenda_items')
          .select('meeting_id')
          .eq('organization_id', orgId)
          .eq('id', agendaItemId)
          .single()
        if (fErr) throw fErr
        const meeting = await getMeeting((row as { meeting_id: string }).meeting_id)
        if (!assertCanMutateSigned(meeting, 'endre agendapunkter for')) return null

        const { data, error: uErr } = await supabase
          .from('amu_agenda_items')
          .update(patch)
          .eq('organization_id', orgId)
          .eq('id', agendaItemId)
          .select('*')
          .single()
        if (uErr) throw uErr
        return AmuAgendaItemSchema.parse(data)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage, getMeeting, assertCanMutateSigned],
  )

  const deleteAgendaItem = useCallback(
    async (agendaItemId: string) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return false
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å slette agendapunkter.')
        return false
      }
      setError(null)
      try {
        const { data: row, error: fErr } = await supabase
          .from('amu_agenda_items')
          .select('meeting_id')
          .eq('organization_id', orgId)
          .eq('id', agendaItemId)
          .single()
        if (fErr) throw fErr
        const meeting = await getMeeting((row as { meeting_id: string }).meeting_id)
        if (!assertCanMutateSigned(meeting, 'slette agendapunkter for')) return false

        const { error: dErr } = await supabase
          .from('amu_agenda_items')
          .delete()
          .eq('organization_id', orgId)
          .eq('id', agendaItemId)
        if (dErr) throw dErr
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, orgId, canManage, getMeeting, assertCanMutateSigned],
  )

  const upsertDecision = useCallback(
    async (
      input:
        | { id: string; patch: Partial<Pick<AmuDecision, 'decision_text' | 'action_plan_item_id'>> }
        | { agenda_item_id: string; decision_text: string; action_plan_item_id?: string | null },
    ) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å lagre vedtak.')
        return null
      }
      setError(null)
      try {
        if ('id' in input) {
          const { data: drow, error: dErr } = await supabase
            .from('amu_decisions')
            .select('agenda_item_id')
            .eq('organization_id', orgId)
            .eq('id', input.id)
            .single()
          if (dErr) throw dErr
          const { data: arow, error: aErr } = await supabase
            .from('amu_agenda_items')
            .select('meeting_id')
            .eq('organization_id', orgId)
            .eq('id', (drow as { agenda_item_id: string }).agenda_item_id)
            .single()
          if (aErr) throw aErr
          const meeting = await getMeeting((arow as { meeting_id: string }).meeting_id)
          if (!assertCanMutateSigned(meeting, 'endre vedtak for')) return null

          const { data, error: uErr } = await supabase
            .from('amu_decisions')
            .update(input.patch)
            .eq('organization_id', orgId)
            .eq('id', input.id)
            .select('*')
            .single()
          if (uErr) throw uErr
          return AmuDecisionSchema.parse(data)
        }

        const { data: arow, error: aErr } = await supabase
          .from('amu_agenda_items')
          .select('meeting_id')
          .eq('organization_id', orgId)
          .eq('id', input.agenda_item_id)
          .single()
        if (aErr) throw aErr
        const meeting = await getMeeting((arow as { meeting_id: string }).meeting_id)
        if (!assertCanMutateSigned(meeting, 'registrere vedtak for')) return null

        const { data, error: insErr } = await supabase
          .from('amu_decisions')
          .insert({
            organization_id: orgId,
            agenda_item_id: input.agenda_item_id,
            decision_text: input.decision_text,
            action_plan_item_id: input.action_plan_item_id ?? null,
          })
          .select('*')
          .single()
        if (insErr) throw insErr
        return AmuDecisionSchema.parse(data)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage, getMeeting, assertCanMutateSigned],
  )

  const deleteDecision = useCallback(
    async (decisionId: string) => {
      if (!supabase || !orgId) {
        setError('Organisasjon er ikke valgt.')
        return false
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å slette vedtak.')
        return false
      }
      setError(null)
      try {
        const { data: drow, error: dErr } = await supabase
          .from('amu_decisions')
          .select('agenda_item_id')
          .eq('organization_id', orgId)
          .eq('id', decisionId)
          .single()
        if (dErr) throw dErr
        const { data: arow, error: aErr } = await supabase
          .from('amu_agenda_items')
          .select('meeting_id')
          .eq('organization_id', orgId)
          .eq('id', (drow as { agenda_item_id: string }).agenda_item_id)
          .single()
        if (aErr) throw aErr
        const meeting = await getMeeting((arow as { meeting_id: string }).meeting_id)
        if (!assertCanMutateSigned(meeting, 'slette vedtak for')) return false

        const { error: delErr } = await supabase.from('amu_decisions').delete().eq('organization_id', orgId).eq('id', decisionId)
        if (delErr) throw delErr
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, orgId, canManage, getMeeting, assertCanMutateSigned],
  )

  return useMemo(
    () => ({
      organizationId: orgId,
      canManage,
      meetings,
      loading,
      error,
      setError,
      refresh,
      getMeeting,
      loadAgendaItems,
      loadDecisionsForMeeting,
      loadParticipants,
      upsertParticipant,
      removeParticipant,
      insertAgendaItem,
      createActionPlanItemFromAgenda,
      signMeetingAsChair,
      loadDefaultAgendaTemplate,
      createDefaultAgendaTemplateRow,
      updateDefaultAgendaTemplateRow,
      deleteDefaultAgendaTemplateRow,
      generateDefaultAgenda,
      fetchWhistleblowingAgendaStats,
      fetchSickLeaveAgendaStats,
      createMeeting,
      updateMeeting,
      updateAgendaItem,
      deleteAgendaItem,
      upsertDecision,
      deleteDecision,
    }),
    [
      orgId,
      canManage,
      meetings,
      loading,
      error,
      refresh,
      getMeeting,
      loadAgendaItems,
      loadDecisionsForMeeting,
      loadParticipants,
      upsertParticipant,
      removeParticipant,
      insertAgendaItem,
      createActionPlanItemFromAgenda,
      signMeetingAsChair,
      loadDefaultAgendaTemplate,
      createDefaultAgendaTemplateRow,
      updateDefaultAgendaTemplateRow,
      deleteDefaultAgendaTemplateRow,
      generateDefaultAgenda,
      fetchWhistleblowingAgendaStats,
      fetchSickLeaveAgendaStats,
      createMeeting,
      updateMeeting,
      updateAgendaItem,
      deleteAgendaItem,
      upsertDecision,
      deleteDecision,
    ],
  )
}

export type AmuHookState = ReturnType<typeof useAmu>
