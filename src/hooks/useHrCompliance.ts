import { useCallback, useEffect, useState } from 'react'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { useOrgSetupContext } from './useOrgSetupContext'
import type {
  HrConsultationCaseRow,
  HrConsultationCommentRow,
  HrConsultationParticipantRow,
  HrDiscussionMeetingRow,
  HrOrgUserRow,
  HrRosSignoffRow,
} from '../types/hrCompliance'

export function useHrCompliance() {
  const { supabase, organization, user, can } = useOrgSetupContext()
  const orgId = organization?.id

  const canDiscussion = can('hr.discussion.manage')
  const canConsultation = can('hr.consultation.manage')
  const canORosManage = can('hr.o_ros.manage')
  const canORosView = can('hr.o_ros.view')
  const canORosSign = can('hr.o_ros.sign')

  const [meetings, setMeetings] = useState<HrDiscussionMeetingRow[]>([])
  const [cases, setCases] = useState<HrConsultationCaseRow[]>([])
  const [orgUsers, setOrgUsers] = useState<HrOrgUserRow[]>([])
  const [rosSignoffs, setRosSignoffs] = useState<HrRosSignoffRow[]>([])
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

  const refreshOrgUsers = useCallback(async () => {
    if (!supabase) return
    try {
      const { data, error: e } = await supabase.rpc('hr_list_org_users')
      if (e) throw e
      setOrgUsers((data ?? []) as HrOrgUserRow[])
    } catch (err) {
      console.warn('hr_list_org_users', getSupabaseErrorMessage(err))
    }
  }, [supabase])

  const refreshRosSignoffs = useCallback(async () => {
    if (!supabase || !orgId) return
    try {
      const { data, error: e } = await supabase
        .from('hr_ros_org_signoffs')
        .select('*')
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: false })
      if (e) throw e
      setRosSignoffs((data ?? []) as HrRosSignoffRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    }
  }, [supabase, orgId])

  useEffect(() => {
    void refreshMeetings()
    void refreshCases()
    void refreshOrgUsers()
    void refreshRosSignoffs()
  }, [refreshMeetings, refreshCases, refreshOrgUsers, refreshRosSignoffs])

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
          topics_discussed: '',
          legal_acknowledgements: {},
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
          | 'topics_discussed'
          | 'meeting_at'
          | 'legal_acknowledgements'
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
    async (id: string, role: 'manager' | 'employee' | 'union', signerName: string) => {
      if (!supabase || !signerName.trim()) return
      const { error: e } = await supabase.rpc('hr_discussion_sign', {
        p_meeting_id: id,
        p_role: role,
        p_signer_name: signerName.trim(),
      })
      if (e) setError(getSupabaseErrorMessage(e))
      else void refreshMeetings()
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
    async (title: string, description: string, amlChapter8Applies: boolean) => {
      if (!supabase || !orgId || !user || !canConsultation) return { ok: false as const }
      try {
        const { data: ins, error: e } = await supabase
          .from('hr_consultation_cases')
          .insert({
            organization_id: orgId,
            title: title.trim(),
            description: description.trim(),
            created_by: user.id,
            aml_chapter_8_applies: amlChapter8Applies,
          })
          .select('id')
          .single()
        if (e) throw e
        if (ins?.id) {
          await supabase.from('hr_consultation_events').insert({
            case_id: ins.id,
            event_type: 'case_created',
            body: `Sak opprettet: ${title.trim()}`,
            created_by: user.id,
          })
        }
        await refreshCases()
        return { ok: true as const }
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return { ok: false as const }
      }
    },
    [supabase, orgId, user, canConsultation, refreshCases],
  )

  const addConsultationParticipant = useCallback(
    async (caseId: string, participantUserId: string, role: HrConsultationParticipantRow['role']) => {
      if (!supabase || !canConsultation) return
      const { error: e } = await supabase.from('hr_consultation_participants').insert({
        case_id: caseId,
        user_id: participantUserId,
        role,
      })
      if (e) setError(getSupabaseErrorMessage(e))
      else {
        await supabase.from('hr_consultation_events').insert({
          case_id: caseId,
          event_type: 'participant_invited',
          body: `Deltaker lagt til (${role})`,
          metadata: { user_id: participantUserId },
        })
      }
    },
    [supabase, canConsultation],
  )

  const addConsultationComment = useCallback(
    async (caseId: string, body: string) => {
      if (!supabase || !user) return
      const { error: e } = await supabase.from('hr_consultation_comments').insert({
        case_id: caseId,
        author_id: user.id,
        body: body.trim(),
      })
      if (e) setError(getSupabaseErrorMessage(e))
    },
    [supabase, user],
  )

  const recordInformationProvided = useCallback(
    async (caseId: string) => {
      if (!supabase) return
      const { error: e } = await supabase.rpc('hr_consultation_record_information', { p_case_id: caseId })
      if (e) setError(getSupabaseErrorMessage(e))
      else void refreshCases()
    },
    [supabase, refreshCases],
  )

  const updateConsultationCase = useCallback(
    async (caseId: string, patch: Partial<Pick<HrConsultationCaseRow, 'decision_summary' | 'status' | 'information_provided_at'>>) => {
      if (!supabase || !canConsultation) return
      const { error: e } = await supabase.from('hr_consultation_cases').update(patch).eq('id', caseId)
      if (e) setError(getSupabaseErrorMessage(e))
      else void refreshCases()
    },
    [supabase, canConsultation, refreshCases],
  )

  const exportConsultationProtocol = useCallback(
    async (caseId: string): Promise<unknown | null> => {
      if (!supabase) return null
      const { data, error: e } = await supabase.rpc('hr_consultation_protocol_json', { p_case_id: caseId })
      if (e) {
        setError(getSupabaseErrorMessage(e))
        return null
      }
      return data
    },
    [supabase],
  )

  const fetchCaseDetail = useCallback(
    async (caseId: string) => {
      if (!supabase) return null
      const [parts, comments, events] = await Promise.all([
        supabase.from('hr_consultation_participants').select('*').eq('case_id', caseId),
        supabase.from('hr_consultation_comments').select('*').eq('case_id', caseId).order('created_at'),
        supabase.from('hr_consultation_events').select('*').eq('case_id', caseId).order('created_at'),
      ])
      return {
        participants: (parts.data ?? []) as HrConsultationParticipantRow[],
        comments: (comments.data ?? []) as HrConsultationCommentRow[],
        events: events.data ?? [],
      }
    },
    [supabase],
  )

  const upsertRosSignoff = useCallback(
    async (rosAssessmentId: string, amuUserId: string | null, voUserId: string | null) => {
      if (!supabase || !orgId || !canORosManage) return
      const { error: e } = await supabase.rpc('hr_ros_org_upsert_assignees', {
        p_org_id: orgId,
        p_ros_assessment_id: rosAssessmentId,
        p_amu_user_id: amuUserId,
        p_verneombud_user_id: voUserId,
      })
      if (e) setError(getSupabaseErrorMessage(e))
      else void refreshRosSignoffs()
    },
    [supabase, orgId, canORosManage, refreshRosSignoffs],
  )

  const signRosOrg = useCallback(
    async (rosAssessmentId: string, role: 'amu' | 'verneombud', assessmentText: string) => {
      if (!supabase || !orgId) return
      const { error: e } = await supabase.rpc('hr_ros_org_sign_as', {
        p_org_id: orgId,
        p_ros_assessment_id: rosAssessmentId,
        p_role: role,
        p_assessment_text: assessmentText,
      })
      if (e) setError(getSupabaseErrorMessage(e))
      else void refreshRosSignoffs()
    },
    [supabase, orgId, refreshRosSignoffs],
  )

  return {
    meetings,
    cases,
    orgUsers,
    rosSignoffs,
    loading,
    error,
    setError,
    canDiscussion,
    canConsultation,
    canORosManage,
    canORosView,
    canORosSign,
    refreshMeetings,
    refreshCases,
    refreshOrgUsers,
    refreshRosSignoffs,
    createDiscussionDraft,
    updateDiscussion,
    signDiscussion,
    lockDiscussion,
    createConsultationCase,
    addConsultationParticipant,
    addConsultationComment,
    recordInformationProvided,
    updateConsultationCase,
    exportConsultationProtocol,
    fetchCaseDetail,
    upsertRosSignoff,
    signRosOrg,
  }
}
