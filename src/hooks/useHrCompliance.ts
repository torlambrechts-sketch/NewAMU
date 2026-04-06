import { useCallback, useEffect, useState } from 'react'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { useOrgSetupContext } from './useOrgSetupContext'
import type { HrConsultationCaseRow, HrDiscussionMeetingRow } from '../types/hrCompliance'

export function useHrCompliance() {
  const { supabase, organization, user, can } = useOrgSetupContext()
  const orgId = organization?.id

  const canDiscussion = can('hr.discussion.manage')
  const canConsultation = can('hr.consultation.manage')
  const canORos = can('hr.o_ros.manage') || can('hr.o_ros.view')

  const [meetings, setMeetings] = useState<HrDiscussionMeetingRow[]>([])
  const [cases, setCases] = useState<HrConsultationCaseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshMeetings = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('hr_discussion_meetings')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (e) throw e
      setMeetings((data ?? []) as HrDiscussionMeetingRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  const refreshCases = useCallback(async () => {
    if (!supabase || !orgId) return
    try {
      const { data, error: e } = await supabase
        .from('hr_consultation_cases')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (e) throw e
      setCases((data ?? []) as HrConsultationCaseRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    }
  }, [supabase, orgId])

  useEffect(() => {
    void refreshMeetings()
    void refreshCases()
  }, [refreshMeetings, refreshCases])

  const createDiscussionDraft = useCallback(
    async (input: {
      employeeUserId: string
      unionRepUserId?: string | null
      unionRepInvited: boolean
    }) => {
      if (!supabase || !orgId || !user || !canDiscussion) return { ok: false as const }
      try {
        const { error: e } = await supabase.from('hr_discussion_meetings').insert({
          organization_id: orgId,
          employee_user_id: input.employeeUserId,
          manager_user_id: user.id,
          union_rep_user_id: input.unionRepUserId ?? null,
          union_rep_invited: input.unionRepInvited,
          informed_union_accompaniment_right: false,
          union_rep_present: false,
          checklist_completed: false,
          summary_text: '',
          status: 'draft',
        })
        if (e) throw e
        await refreshMeetings()
        return { ok: true as const }
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return { ok: false as const }
      }
    },
    [supabase, orgId, user, canDiscussion, refreshMeetings],
  )

  const updateDiscussion = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          HrDiscussionMeetingRow,
          | 'informed_union_accompaniment_right'
          | 'union_rep_present'
          | 'checklist_completed'
          | 'summary_text'
          | 'status'
        >
      >,
    ) => {
      if (!supabase) return
      const { error: e } = await supabase.from('hr_discussion_meetings').update(patch).eq('id', id)
      if (e) setError(getSupabaseErrorMessage(e))
      else void refreshMeetings()
    },
    [supabase, refreshMeetings],
  )

  const signDiscussion = useCallback(
    async (id: string, role: 'manager' | 'employee' | 'union') => {
      if (!supabase) return
      const now = new Date().toISOString()
      const patch: Record<string, string> = {}
      if (role === 'manager') patch.manager_signed_at = now
      if (role === 'employee') patch.employee_signed_at = now
      if (role === 'union') patch.union_rep_signed_at = now
      if (Object.keys(patch).length) {
        patch.status = 'pending_signatures'
        const { error: e } = await supabase.from('hr_discussion_meetings').update(patch).eq('id', id)
        if (e) setError(getSupabaseErrorMessage(e))
        else void refreshMeetings()
      }
    },
    [supabase, refreshMeetings],
  )

  const lockDiscussion = useCallback(
    async (id: string) => {
      if (!supabase) return
      const { error: e } = await supabase.rpc('hr_discussion_apply_lock', { p_meeting_id: id })
      if (e) setError(getSupabaseErrorMessage(e))
      else void refreshMeetings()
    },
    [supabase, refreshMeetings],
  )

  const createConsultationCase = useCallback(
    async (title: string, description: string) => {
      if (!supabase || !orgId || !user || !canConsultation) return { ok: false as const }
      try {
        const { error: e } = await supabase.from('hr_consultation_cases').insert({
          organization_id: orgId,
          title: title.trim(),
          description: description.trim(),
          created_by: user.id,
        })
        if (e) throw e
        await refreshCases()
        return { ok: true as const }
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return { ok: false as const }
      }
    },
    [supabase, orgId, user, canConsultation, refreshCases],
  )

  return {
    meetings,
    cases,
    loading,
    error,
    canDiscussion,
    canConsultation,
    canORos,
    refreshMeetings,
    refreshCases,
    createDiscussionDraft,
    updateDiscussion,
    signDiscussion,
    lockDiscussion,
    createConsultationCase,
  }
}
