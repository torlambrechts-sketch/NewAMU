import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import {
  AmuDefaultAgendaItemSchema,
  AmuSickLeavePrivacyStatsSchema,
  AmuWhistleblowingPrivacyStatsSchema,
  amuAgendaItemRowSchema,
  amuAnnualReportRowSchema,
  amuAttendanceRowSchema,
  amuCommitteeRowSchema,
  amuComplianceStatusRowSchema,
  amuComplianceStatusSchema,
  amuCriticalItemSchema,
  amuDecisionRowSchema,
  amuDeviationForAmuSchema,
  amuMeetingRowSchema,
  amuMemberRowSchema,
  type AmuAgendaItem,
  type AmuAnnualReport,
  type AmuAttendance,
  type AmuCommittee,
  type AmuComplianceStatus,
  type AmuCriticalItem,
  type AmuDecision,
  type AmuDefaultAgendaItem,
  type AmuDeviationForAmu,
  type AmuMeeting,
  type AmuMember,
  type AmuSickLeavePrivacyStats,
  type AmuWhistleblowingPrivacyStats,
} from './types'

type AmuPrivacyRpcWhistle = { open?: number; closed?: number }
type AmuPrivacyRpcSick = { active?: number; partial?: number; other?: number }

export function useAmu() {
  const { supabase, organization, user, can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('amu.manage')
  const canChair = isAdmin || can('amu.chair')
  const canPropose = true

  const [committee, setCommittee] = useState<AmuCommittee | null>(null)
  const [members, setMembers] = useState<AmuMember[]>([])
  const [meetings, setMeetings] = useState<AmuMeeting[]>([])
  const [agendaItems, setAgendaItems] = useState<AmuAgendaItem[]>([])
  const [decisions, setDecisions] = useState<AmuDecision[]>([])
  const [attendance, setAttendance] = useState<AmuAttendance[]>([])
  const [compliance, setCompliance] = useState<AmuComplianceStatus | null>(null)
  const [criticalQueue, setCriticalQueue] = useState<AmuCriticalItem[]>([])
  const [annualReport, setAnnualReport] = useState<AmuAnnualReport | null>(null)
  const [annualReports, setAnnualReports] = useState<AmuAnnualReport[]>([])
  const [avvik, setAvvik] = useState<AmuDeviationForAmu[]>([])
  const [whistleblowingStats, setWhistleblowingStats] = useState<AmuWhistleblowingPrivacyStats | null>(null)
  const [sickLeaveStats, setSickLeaveStats] = useState<AmuSickLeavePrivacyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const y = new Date().getFullYear()
      const [
        c,
        m,
        mt,
        cs,
        cq,
        ar,
        arAll,
        dev,
        wb,
        sk,
      ] = await Promise.all([
        supabase.from('amu_committees').select('*').eq('organization_id', organization.id).maybeSingle(),
        supabase.from('amu_members').select('*').eq('organization_id', organization.id).eq('active', true),
        supabase
          .from('amu_meetings')
          .select('*')
          .eq('organization_id', organization.id)
          .order('scheduled_at', { ascending: true }),
        supabase.from('amu_compliance_status').select('*').eq('year', y),
        supabase.from('amu_critical_queue').select('*').eq('organization_id', organization.id),
        supabase.from('amu_annual_reports').select('*').eq('organization_id', organization.id).eq('year', y).maybeSingle(),
        supabase.from('amu_annual_reports').select('*').eq('organization_id', organization.id).eq('status', 'signed'),
        supabase
          .from('deviations')
          .select('id,title,risk_score,status,created_at')
          .eq('organization_id', organization.id)
          .not('status', 'eq', 'closed')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.rpc('amu_privacy_whistleblowing_stats'),
        supabase.rpc('amu_privacy_sick_leave_stats'),
      ])

      if (c.error) throw c.error
      if (m.error) throw m.error
      if (mt.error) throw mt.error
      if (cs.error) throw cs.error
      if (cq.error) throw cq.error
      if (ar.error) throw ar.error
      if (arAll.error) throw arAll.error
      if (dev.error) throw dev.error

      const committeeRow = c.data ? amuCommitteeRowSchema.parse(c.data) : null
      setCommittee(committeeRow)
      setMembers((m.data ?? []).map((raw) => amuMemberRowSchema.parse(raw)))
      setMeetings((mt.data ?? []).map((raw) => amuMeetingRowSchema.parse(raw)))

      const committeeId = committeeRow?.id
      let complianceParsed: AmuComplianceStatus | null = null
      for (const row of cs.data ?? []) {
        const extended = amuComplianceStatusRowSchema.parse(row)
        if (committeeId && extended.committee_id !== committeeId) continue
        const { organization_id: _o, ...rest } = extended
        complianceParsed = amuComplianceStatusSchema.parse(rest)
        break
      }
      setCompliance(complianceParsed)

      setCriticalQueue((cq.data ?? []).map((raw) => amuCriticalItemSchema.parse(raw)))
      setAnnualReport(ar.data ? amuAnnualReportRowSchema.parse(ar.data) : null)
      setAnnualReports((arAll.data ?? []).map((raw) => amuAnnualReportRowSchema.parse(raw)))

      setAvvik((dev.data ?? []).map((raw) => amuDeviationForAmuSchema.parse(raw)))

      if (!wb.error && wb.data != null) {
        const p = wb.data as AmuPrivacyRpcWhistle
        setWhistleblowingStats(
          AmuWhistleblowingPrivacyStatsSchema.parse({
            open: Number(p.open ?? 0),
            closed: Number(p.closed ?? 0),
          }),
        )
      } else {
        setWhistleblowingStats(null)
      }

      if (!sk.error && sk.data != null) {
        const p = sk.data as AmuPrivacyRpcSick
        setSickLeaveStats(
          AmuSickLeavePrivacyStatsSchema.parse({
            active: Number(p.active ?? 0),
            partial: Number(p.partial ?? 0),
            other: Number(p.other ?? 0),
          }),
        )
      } else {
        setSickLeaveStats(null)
      }
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const scheduleMeeting = useCallback(
    async (input: Partial<AmuMeeting>) => {
      if (!supabase || !organization?.id) throw new Error('Organisasjon er ikke valgt.')
      const scheduled = input.scheduled_at ?? new Date().toISOString()
      const meetingDate = scheduled.slice(0, 10)
      const { error: insErr } = await supabase.from('amu_meetings').insert({
        organization_id: organization.id,
        committee_id: input.committee_id ?? committee?.id ?? null,
        sequence_no: input.sequence_no ?? null,
        title: input.title ?? 'AMU-møte',
        scheduled_at: scheduled,
        meeting_date: meetingDate,
        location: input.location ?? '',
        is_hybrid: input.is_hybrid ?? false,
        status: 'draft',
      })
      if (insErr) throw insErr
      await refresh()
    },
    [supabase, organization?.id, committee?.id, refresh],
  )

  const startMeeting = useCallback(
    async (id: string) => {
      if (!supabase) throw new Error('Supabase er ikke tilgjengelig.')
      const { error: upErr } = await supabase.from('amu_meetings').update({ status: 'in_progress' }).eq('id', id)
      if (upErr) throw upErr
      await refresh()
    },
    [supabase, refresh],
  )

  const completeMeeting = useCallback(
    async (id: string) => {
      if (!supabase) throw new Error('Supabase er ikke tilgjengelig.')
      const { error: upErr } = await supabase
        .from('amu_meetings')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', id)
      if (upErr) throw upErr
      await refresh()
    },
    [supabase, refresh],
  )

  const signMeeting = useCallback(
    async (id: string, leaderId: string, deputyId: string) => {
      if (!canChair) throw new Error('Ingen tilgang')
      if (!supabase) throw new Error('Supabase er ikke tilgjengelig.')
      const { error: upErr } = await supabase
        .from('amu_meetings')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signed_by_leader: leaderId,
          signed_by_deputy: deputyId,
        })
        .eq('id', id)
      if (upErr) throw upErr
      await refresh()
    },
    [supabase, canChair, refresh],
  )

  const recordDecision = useCallback(
    async (input: Partial<AmuDecision> & { id?: string; agenda_item_id?: string }) => {
      if (!supabase || !organization?.id) throw new Error('Organisasjon er ikke valgt.')
      if (input.id) {
        const { id, ...patch } = input
        const { error: upErr } = await supabase.from('amu_decisions').update(patch).eq('id', id)
        if (upErr) throw upErr
      } else if (input.agenda_item_id) {
        const { agenda_item_id, decision_text, votes_for, votes_against, votes_abstained, responsible_member_id, due_date, linked_action_id } =
          input
        const { error: insErr } = await supabase.from('amu_decisions').insert({
          organization_id: organization.id,
          agenda_item_id,
          decision_text: decision_text ?? '',
          votes_for: votes_for ?? 0,
          votes_against: votes_against ?? 0,
          votes_abstained: votes_abstained ?? 0,
          responsible_member_id: responsible_member_id ?? null,
          due_date: due_date ?? null,
          linked_action_id: linked_action_id ?? null,
        })
        if (insErr) throw insErr
      }
      await refresh()
    },
    [supabase, organization?.id, refresh],
  )

  const updateAgendaItemStatus = useCallback(
    async (id: string, status: AmuAgendaItem['status']) => {
      if (!supabase) throw new Error('Supabase er ikke tilgjengelig.')
      const { error: upErr } = await supabase.from('amu_agenda_items').update({ status }).eq('id', id)
      if (upErr) throw upErr
      setAgendaItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)))
    },
    [supabase],
  )

  const updateAttendance = useCallback(
    async (meetingId: string, memberId: string, status: AmuAttendance['status']) => {
      if (!supabase || !organization?.id) throw new Error('Organisasjon er ikke valgt.')
      const { error: upErr } = await supabase.from('amu_attendance').upsert(
        {
          organization_id: organization.id,
          meeting_id: meetingId,
          member_id: memberId,
          status,
        },
        { onConflict: 'meeting_id,member_id' },
      )
      if (upErr) throw upErr
      await refresh()
    },
    [supabase, organization?.id, refresh],
  )

  const loadMeetingDetail = useCallback(
    async (meetingId: string) => {
      if (!supabase) throw new Error('Supabase er ikke tilgjengelig.')
      const ai = await supabase
        .from('amu_agenda_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('order_index', { ascending: true })
      const att = await supabase.from('amu_attendance').select('*').eq('meeting_id', meetingId)
      if (ai.error) throw ai.error
      if (att.error) throw att.error

      const agendaParsed = (ai.data ?? []).map((raw) => amuAgendaItemRowSchema.parse(raw))
      setAgendaItems(agendaParsed)
      setAttendance(
        (att.data ?? []).map((raw) =>
          amuAttendanceRowSchema.parse({
            ...raw,
            joined_at: (raw as { joined_at?: string | null }).joined_at ?? null,
          }),
        ),
      )

      const ids = agendaParsed.map((x) => x.id)
      if (ids.length === 0) {
        setDecisions([])
        return
      }
      const dec = await supabase.from('amu_decisions').select('*').in('agenda_item_id', ids)
      if (dec.error) throw dec.error
      setDecisions((dec.data ?? []).map((raw) => amuDecisionRowSchema.parse(raw)))
    },
    [supabase],
  )

  const generateAutoAgenda = useCallback(
    async (meetingId: string) => {
      if (!supabase) throw new Error('Supabase er ikke tilgjengelig.')
      const { error: rpcErr } = await supabase.rpc('amu_generate_auto_agenda', { p_meeting_id: meetingId })
      if (rpcErr) throw rpcErr
      await loadMeetingDetail(meetingId)
    },
    [supabase, loadMeetingDetail],
  )

  const proposeTopic = useCallback(
    async (description: string, targetMeetingId?: string) => {
      if (!supabase || !organization?.id) throw new Error('Organisasjon er ikke valgt.')
      const { error: insErr } = await supabase.from('amu_topic_proposals').insert({
        organization_id: organization.id,
        proposed_by: user?.id ?? null,
        description,
        target_meeting_id: targetMeetingId ?? null,
        status: 'submitted',
      })
      if (insErr) throw insErr
    },
    [supabase, organization?.id, user?.id],
  )

  const draftAnnualReport = useCallback(
    async (year: number) => {
      if (!canManage) throw new Error('Ingen tilgang')
      if (!supabase || !organization?.id) throw new Error('Organisasjon er ikke valgt.')
      const { error: rpcErr } = await supabase.rpc('amu_draft_annual_report', {
        p_organization_id: organization.id,
        p_year: year,
      })
      if (rpcErr) throw rpcErr
      await refresh()
    },
    [supabase, organization?.id, canManage, refresh],
  )

  const updateAnnualReportBody = useCallback(
    async (id: string, body: AmuAnnualReport['body']) => {
      if (!supabase) throw new Error('Supabase er ikke tilgjengelig.')
      const { error: upErr } = await supabase.from('amu_annual_reports').update({ body }).eq('id', id)
      if (upErr) throw upErr
    },
    [supabase],
  )

  const signAnnualReport = useCallback(
    async (id: string, leaderId: string, deputyId: string) => {
      if (!canChair) throw new Error('Ingen tilgang')
      if (!supabase) throw new Error('Supabase er ikke tilgjengelig.')
      const { error: upErr } = await supabase
        .from('amu_annual_reports')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signed_by_leader: leaderId,
          signed_by_deputy: deputyId,
        })
        .eq('id', id)
      if (upErr) throw upErr
      await refresh()
    },
    [supabase, canChair, refresh],
  )

  const loadDefaultAgendaTemplate = useCallback(async (): Promise<AmuDefaultAgendaItem[]> => {
    if (!supabase || !organization?.id) return []
    const { data, error: qErr } = await supabase
      .from('amu_default_agenda_items')
      .select('*')
      .eq('organization_id', organization.id)
      .order('order_index', { ascending: true })
    if (qErr) throw qErr
    return (data ?? []).map((raw) => AmuDefaultAgendaItemSchema.parse(raw))
  }, [supabase, organization?.id])

  const createDefaultAgendaTemplateRow = useCallback(
    async (row: Pick<AmuDefaultAgendaItem, 'title' | 'description' | 'order_index' | 'source_module' | 'source_id'>) => {
      if (!supabase || !organization?.id) {
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
            organization_id: organization.id,
            title: row.title,
            description: row.description,
            order_index: row.order_index,
            source_module: row.source_module,
            source_id: row.source_id,
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
    [supabase, organization?.id, canManage],
  )

  const updateDefaultAgendaTemplateRow = useCallback(
    async (
      id: string,
      patch: Partial<Pick<AmuDefaultAgendaItem, 'title' | 'description' | 'order_index' | 'source_module' | 'source_id'>>,
    ) => {
      if (!supabase || !organization?.id) {
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
          .eq('organization_id', organization.id)
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
    [supabase, organization?.id, canManage],
  )

  const deleteDefaultAgendaTemplateRow = useCallback(
    async (id: string) => {
      if (!supabase || !organization?.id) {
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
          .eq('organization_id', organization.id)
          .eq('id', id)
        if (dErr) throw dErr
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, organization?.id, canManage],
  )

  return {
    canManage,
    canChair,
    canPropose,
    committee,
    members,
    meetings,
    agendaItems,
    decisions,
    attendance,
    compliance,
    criticalQueue,
    annualReport,
    annualReports,
    avvik,
    whistleblowingStats,
    sickLeaveStats,
    loading,
    error,
    setError,
    refresh,
    loadMeetingDetail,
    scheduleMeeting,
    startMeeting,
    completeMeeting,
    signMeeting,
    recordDecision,
    updateAgendaItemStatus,
    updateAttendance,
    generateAutoAgenda,
    proposeTopic,
    draftAnnualReport,
    updateAnnualReportBody,
    signAnnualReport,
    loadDefaultAgendaTemplate,
    createDefaultAgendaTemplateRow,
    updateDefaultAgendaTemplateRow,
    deleteDefaultAgendaTemplateRow,
  }
}
