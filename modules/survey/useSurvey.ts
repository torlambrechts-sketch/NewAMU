import { useCallback, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import { fetchOrgModulePayload } from '../../src/lib/orgModulePayload'
import { parseSurveyModuleSettings } from './surveyAdminSettingsSchema'
import type {
  SurveyRow,
  SurveyStatus,
  OrgSurveyQuestionRow,
  OrgSurveyResponseRow,
  OrgSurveyAnswerRow,
  SurveyQuestionBankRow,
  SurveyQuestionType,
} from './types'
import {
  parseSurveyRow,
  parseOrgSurveyQuestionRow,
  parseOrgSurveyResponseRow,
  parseOrgSurveyAnswerRow,
  parseSurveyQuestionBankRow,
} from './schema'

type Supabase = SupabaseClient

function collect<T>(rows: unknown[] | null | undefined, parse: (r: unknown) => { success: boolean; data?: T }): T[] {
  const out: T[] = []
  for (const raw of rows ?? []) {
    const p = parse(raw)
    if (p.success && p.data !== undefined) out.push(p.data)
  }
  return out
}

function isQuestionLockedStatus(status: SurveyStatus): boolean {
  return status === 'active' || status === 'closed'
}

type CreateSurveyInput = {
  title: string
  description?: string | null
  is_anonymous?: boolean
}

type UpsertQuestionInput = {
  id?: string
  surveyId: string
  questionText: string
  questionType: SurveyQuestionType
  orderIndex: number
  isRequired: boolean
}

export type UseSurveyState = {
  loading: boolean
  error: string | null
  canManage: boolean
  orgId: string | undefined
  surveys: SurveyRow[]
  /** Questions for currently loaded survey (see `selectedSurveyId`) */
  questions: OrgSurveyQuestionRow[]
  responses: OrgSurveyResponseRow[]
  answers: OrgSurveyAnswerRow[]
  questionBank: SurveyQuestionBankRow[]
  selectedSurvey: SurveyRow | null
  selectedSurveyId: string | null
  loadSurveys: () => Promise<void>
  loadSurveyDetail: (surveyId: string) => Promise<void>
  setSelectedSurveyId: (id: string | null) => void
  createSurvey: (input: CreateSurveyInput) => Promise<SurveyRow | null>
  updateSurvey: (surveyId: string, patch: Partial<Pick<SurveyRow, 'title' | 'description' | 'is_anonymous' | 'status' | 'published_at' | 'closed_at'>>) => Promise<boolean>
  publishSurvey: (surveyId: string) => Promise<void>
  closeSurvey: (surveyId: string) => Promise<void>
  upsertQuestion: (input: UpsertQuestionInput) => Promise<OrgSurveyQuestionRow | null>
  deleteQuestion: (questionId: string, surveyId: string) => Promise<void>
  insertQuestionFromBank: (bankId: string, surveyId: string) => Promise<OrgSurveyQuestionRow | null>
  upsertQuestionBank: (row: {
    id?: string
    category: string
    questionText: string
    questionType: SurveyQuestionType
  }) => Promise<SurveyQuestionBankRow | null>
  deleteQuestionBank: (id: string) => Promise<void>
  submitResponse: (args: { surveyId: string; userId: string | null; answers: Array<{ questionId: string; answerValue: number | null; answerText: string | null }> }) => Promise<OrgSurveyResponseRow | null>
  dispatchOnSurveyPublished: (surveyId: string) => Promise<void>
  dispatchOnSurveyClosed: (surveyId: string) => Promise<void>
  clearError: () => void
  refresh: () => Promise<void>
  loadQuestionBank: () => Promise<void>
  dispatchOnSurveyResponseSubmitted: (surveyId: string) => Promise<void>
}

type UseSurveyInput = { supabase: Supabase | null }

export function useSurvey({ supabase }: UseSurveyInput): UseSurveyState {
  const { organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('survey.manage')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [surveys, setSurveys] = useState<SurveyRow[]>([])
  const [questions, setQuestions] = useState<OrgSurveyQuestionRow[]>([])
  const [responses, setResponses] = useState<OrgSurveyResponseRow[]>([])
  const [answers, setAnswers] = useState<OrgSurveyAnswerRow[]>([])
  const [questionBank, setQuestionBank] = useState<SurveyQuestionBankRow[]>([])
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyRow | null>(null)
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const assertOrg = useCallback((): string | null => {
    if (!orgId) {
      setError('Mangler organisasjon.')
      return null
    }
    return orgId
  }, [orgId])

  const requireManage = useCallback((): boolean => {
    if (!canManage) {
      setError('Du har ikke tilgang til å administrere undersøkelser.')
      return false
    }
    return true
  }, [canManage])

  const loadSurveys = useCallback(async () => {
    if (!supabase) {
      setError('Supabase er ikke konfigurert.')
      return
    }
    const oid = assertOrg()
    if (!oid) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('surveys')
        .select('*')
        .eq('organization_id', oid)
        .order('updated_at', { ascending: false })
      if (e) throw e
      setSurveys(collect(data, parseSurveyRow))
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, assertOrg])

  const loadQuestionBank = useCallback(async () => {
    if (!supabase) return
    const oid = assertOrg()
    if (!oid) return
    try {
      const { data, error: e } = await supabase
        .from('survey_question_bank')
        .select('*')
        .eq('organization_id', oid)
        .order('category', { ascending: true })
      if (e) throw e
      setQuestionBank(collect(data, parseSurveyQuestionBankRow))
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    }
  }, [supabase, assertOrg])

  const loadSurveyDetail = useCallback(
    async (surveyId: string) => {
      if (!supabase) return
      const oid = assertOrg()
      if (!oid) return
      setLoading(true)
      setError(null)
      setSelectedSurveyId(surveyId)
      try {
        const { data: s, error: se } = await supabase
          .from('surveys')
          .select('*')
          .eq('id', surveyId)
          .eq('organization_id', oid)
          .single()
        if (se) throw se
        const p = parseSurveyRow(s)
        if (!p.success) throw new Error('Ugyldig svar fra database')
        setSelectedSurvey(p.data)

        const [qRes, rRes] = await Promise.all([
          supabase
            .from('org_survey_questions')
            .select('*')
            .eq('survey_id', surveyId)
            .eq('organization_id', oid)
            .order('order_index', { ascending: true }),
          supabase
            .from('org_survey_responses')
            .select('*')
            .eq('survey_id', surveyId)
            .eq('organization_id', oid)
            .order('submitted_at', { ascending: false }),
        ])
        if (qRes.error) throw qRes.error
        if (rRes.error) throw rRes.error

        const qRows = collect(qRes.data, parseOrgSurveyQuestionRow)
        setQuestions(qRows)

        const respRows = collect(rRes.data, parseOrgSurveyResponseRow)
        setResponses(respRows)

        if (respRows.length === 0) {
          setAnswers([])
        } else {
          const ids = respRows.map((r) => r.id)
          const { data: aData, error: aErr } = await supabase
            .from('org_survey_answers')
            .select('*')
            .eq('organization_id', oid)
            .in('response_id', ids)
          if (aErr) throw aErr
          setAnswers(collect(aData, parseOrgSurveyAnswerRow))
        }
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [supabase, assertOrg],
  )

  const refresh = useCallback(async () => {
    if (selectedSurveyId) await loadSurveyDetail(selectedSurveyId)
    await loadSurveys()
    if (canManage) await loadQuestionBank()
  }, [selectedSurveyId, loadSurveyDetail, loadSurveys, loadQuestionBank, canManage])

  const createSurvey = useCallback(
    async (input: CreateSurveyInput): Promise<SurveyRow | null> => {
      if (!supabase) {
        setError('Supabase er ikke konfigurert.')
        return null
      }
      if (!requireManage()) return null
      const oid = assertOrg()
      if (!oid) return null
      setError(null)
      try {
        let anonymous = input.is_anonymous
        if (anonymous === undefined) {
          try {
            const raw = await fetchOrgModulePayload<Record<string, unknown>>(supabase, oid, 'survey_settings')
            const st = parseSurveyModuleSettings(raw)
            if (st.default_anonymous != null) anonymous = st.default_anonymous
          } catch (fetchErr) {
            setError(getSupabaseErrorMessage(fetchErr))
            return null
          }
        }
        const { data, error: e } = await supabase
          .from('surveys')
          .insert({
            organization_id: oid,
            title: input.title,
            description: input.description ?? null,
            is_anonymous: anonymous ?? false,
            status: 'draft',
          })
          .select()
          .single()
        if (e) throw e
        const p = parseSurveyRow(data)
        if (!p.success) throw new Error('Ugyldig svar fra database')
        setSurveys((prev) => [p.data, ...prev])
        return p.data
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, assertOrg, requireManage],
  )

  const updateSurvey = useCallback(
    async (surveyId: string, patch: Partial<Pick<SurveyRow, 'title' | 'description' | 'is_anonymous' | 'status' | 'published_at' | 'closed_at'>>) => {
      if (!supabase) return false
      if (!requireManage()) return false
      const oid = assertOrg()
      if (!oid) return false
      setError(null)
      try {
        const { error: e } = await supabase
          .from('surveys')
          .update(patch)
          .eq('id', surveyId)
          .eq('organization_id', oid)
        if (e) throw e
        setSurveys((prev) => prev.map((s) => (s.id === surveyId ? { ...s, ...patch } : s)))
        setSelectedSurvey((prev) => (prev?.id === surveyId ? { ...prev, ...patch } : prev))
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, assertOrg, requireManage],
  )

  const publishSurvey = useCallback(
    async (surveyId: string) => {
      void (await updateSurvey(surveyId, {
        status: 'active',
        published_at: new Date().toISOString(),
      }))
    },
    [updateSurvey],
  )

  const closeSurvey = useCallback(
    async (surveyId: string) => {
      void (await updateSurvey(surveyId, {
        status: 'closed',
        closed_at: new Date().toISOString(),
      }))
    },
    [updateSurvey],
  )

  const ensureQuestionEditable = useCallback(
    (survey: SurveyRow | null): boolean => {
      if (!survey) {
        setError('Ingen undersøkelse valgt.')
        return false
      }
      if (isQuestionLockedStatus(survey.status)) {
        setError('Spørsmål kan ikke endres når undersøkelsen er publisert eller lukket.')
        return false
      }
      return true
    },
    [],
  )

  const upsertQuestion = useCallback(
    async (input: UpsertQuestionInput): Promise<OrgSurveyQuestionRow | null> => {
      if (!supabase) return null
      if (!requireManage()) return null
      const oid = assertOrg()
      if (!oid) return null
      if (!ensureQuestionEditable(selectedSurvey) || selectedSurvey?.id !== input.surveyId) {
        const { data: s, error: se } = await supabase
          .from('surveys')
          .select('*')
          .eq('id', input.surveyId)
          .eq('organization_id', oid)
          .single()
        if (se) {
          setError(getSupabaseErrorMessage(se))
          return null
        }
        const parsed = parseSurveyRow(s)
        if (!parsed.success) {
          setError('Ugyldig svar fra database')
          return null
        }
        if (!ensureQuestionEditable(parsed.data)) return null
      }
      setError(null)
      try {
        const row = {
          survey_id: input.surveyId,
          organization_id: oid,
          question_text: input.questionText,
          question_type: input.questionType,
          order_index: input.orderIndex,
          is_required: input.isRequired,
        }
        const q = input.id
          ? supabase
              .from('org_survey_questions')
              .update(row)
              .eq('id', input.id)
              .eq('organization_id', oid)
              .select()
              .single()
          : supabase.from('org_survey_questions').insert(row).select().single()
        const { data, error: e } = await q
        if (e) throw e
        const p = parseOrgSurveyQuestionRow(data)
        if (!p.success) throw new Error('Ugyldig svar fra database')
        setQuestions((prev) => {
          const i = prev.findIndex((q) => q.id === p.data.id)
          if (i < 0) return [...prev, p.data].sort((a, b) => a.order_index - b.order_index)
          return prev.map((x) => (x.id === p.data.id ? p.data : x)).sort((a, b) => a.order_index - b.order_index)
        })
        return p.data
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, assertOrg, requireManage, ensureQuestionEditable, selectedSurvey],
  )

  const deleteQuestion = useCallback(
    async (questionId: string, surveyId: string) => {
      if (!supabase) return
      if (!requireManage()) return
      const oid = assertOrg()
      if (!oid) return
      const { data: s, error: se } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .eq('organization_id', oid)
        .single()
      if (se) {
        setError(getSupabaseErrorMessage(se))
        return
      }
      const parsed = parseSurveyRow(s)
      if (!parsed.success) {
        setError('Ugyldig svar fra database')
        return
      }
      if (!ensureQuestionEditable(parsed.data)) return
      setError(null)
      try {
        const { error: e } = await supabase
          .from('org_survey_questions')
          .delete()
          .eq('id', questionId)
          .eq('organization_id', oid)
        if (e) throw e
        setQuestions((prev) => prev.filter((q) => q.id !== questionId))
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, assertOrg, requireManage, ensureQuestionEditable],
  )

  const insertQuestionFromBank = useCallback(
    async (bankId: string, surveyId: string): Promise<OrgSurveyQuestionRow | null> => {
      if (!supabase) return null
      if (!requireManage()) return null
      const oid = assertOrg()
      if (!oid) return null
      setError(null)
      try {
        const { data: b, error: be } = await supabase
          .from('survey_question_bank')
          .select('*')
          .eq('id', bankId)
          .eq('organization_id', oid)
          .single()
        if (be) throw be
        const br = parseSurveyQuestionBankRow(b)
        if (!br.success) throw new Error('Ugyldig mal')
        const maxRes = await supabase
          .from('org_survey_questions')
          .select('order_index')
          .eq('survey_id', surveyId)
          .eq('organization_id', oid)
          .order('order_index', { ascending: false })
          .limit(1)
        if (maxRes.error) throw maxRes.error
        const nextOrder = (maxRes.data?.[0]?.order_index ?? -1) + 1
        return await upsertQuestion({
          surveyId,
          questionText: br.data.question_text,
          questionType: br.data.question_type,
          orderIndex: nextOrder,
          isRequired: true,
        })
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, assertOrg, requireManage, upsertQuestion],
  )

  const upsertQuestionBank = useCallback(
    async (row: {
      id?: string
      category: string
      questionText: string
      questionType: SurveyQuestionType
    }): Promise<SurveyQuestionBankRow | null> => {
      if (!supabase) return null
      if (!requireManage()) return null
      const oid = assertOrg()
      if (!oid) return null
      setError(null)
      try {
        const body = {
          organization_id: oid,
          category: row.category,
          question_text: row.questionText,
          question_type: row.questionType,
        }
        const q = row.id
          ? supabase
              .from('survey_question_bank')
              .update(body)
              .eq('id', row.id)
              .eq('organization_id', oid)
              .select()
              .single()
          : supabase.from('survey_question_bank').insert(body).select().single()
        const { data, error: e } = await q
        if (e) throw e
        const p = parseSurveyQuestionBankRow(data)
        if (!p.success) throw new Error('Ugyldig svar fra database')
        await loadQuestionBank()
        return p.data
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, assertOrg, requireManage, loadQuestionBank],
  )

  const deleteQuestionBank = useCallback(
    async (id: string) => {
      if (!supabase) return
      if (!requireManage()) return
      const oid = assertOrg()
      if (!oid) return
      setError(null)
      try {
        const { error: e } = await supabase
          .from('survey_question_bank')
          .delete()
          .eq('id', id)
          .eq('organization_id', oid)
        if (e) throw e
        setQuestionBank((prev) => prev.filter((b) => b.id !== id))
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, assertOrg, requireManage],
  )

  const submitResponse = useCallback(
    async (args: {
      surveyId: string
      userId: string | null
      answers: Array<{ questionId: string; answerValue: number | null; answerText: string | null }>
    }): Promise<OrgSurveyResponseRow | null> => {
      if (!supabase) return null
      const oid = assertOrg()
      if (!oid) return null
      setError(null)
      try {
        const { data: s, error: se } = await supabase
          .from('surveys')
          .select('*')
          .eq('id', args.surveyId)
          .eq('organization_id', oid)
          .single()
        if (se) throw se
        const survey = parseSurveyRow(s)
        if (!survey.success) throw new Error('Ugyldig svar fra database')
        if (survey.data.status !== 'active') {
          setError('Undersøkelsen er ikke åpen for svar.')
          return null
        }

        const effectiveUserId = survey.data.is_anonymous ? null : args.userId

        const { data: resp, error: re } = await supabase
          .from('org_survey_responses')
          .insert({
            survey_id: args.surveyId,
            organization_id: oid,
            user_id: effectiveUserId,
          })
          .select()
          .single()
        if (re) throw re
        const pr = parseOrgSurveyResponseRow(resp)
        if (!pr.success) throw new Error('Ugyldig svar fra database')

        const answerRows = args.answers.map((a) => ({
          response_id: pr.data.id,
          question_id: a.questionId,
          organization_id: oid,
          answer_value: a.answerValue,
          answer_text: a.answerText,
        }))
        const { error: ae } = await supabase.from('org_survey_answers').insert(answerRows)
        if (ae) throw ae

        setResponses((p) => [pr.data, ...p])
        await loadSurveyDetail(args.surveyId)
        return pr.data
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, assertOrg, loadSurveyDetail],
  )

  const dispatchOnSurveyPublished = useCallback(
    async (surveyId: string) => {
      if (!supabase) return
      if (!requireManage()) return
      const oid = assertOrg()
      if (!oid) return
      setError(null)
      try {
        const { error: e } = await supabase.rpc('workflow_dispatch_survey_event', {
          p_organization_id: oid,
          p_event: 'ON_SURVEY_PUBLISHED',
          p_survey_id: surveyId,
        })
        if (e) throw e
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, assertOrg, requireManage],
  )

  const dispatchOnSurveyClosed = useCallback(
    async (surveyId: string) => {
      if (!supabase) return
      if (!requireManage()) return
      const oid = assertOrg()
      if (!oid) return
      setError(null)
      try {
        const { error: e } = await supabase.rpc('workflow_dispatch_survey_event', {
          p_organization_id: oid,
          p_event: 'ON_SURVEY_CLOSED',
          p_survey_id: surveyId,
        })
        if (e) throw e
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, assertOrg, requireManage],
  )

  const dispatchOnSurveyResponseSubmitted = useCallback(
    async (surveyId: string) => {
      if (!supabase) return
      if (!requireManage()) return
      const oid = assertOrg()
      if (!oid) return
      setError(null)
      try {
        const { error: e } = await supabase.rpc('workflow_dispatch_survey_event', {
          p_organization_id: oid,
          p_event: 'ON_SURVEY_RESPONSE_SUBMITTED',
          p_survey_id: surveyId,
        })
        if (e) throw e
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, assertOrg, requireManage],
  )

  return {
    loading,
    error,
    canManage,
    orgId,
    surveys,
    questions,
    responses,
    answers,
    questionBank,
    selectedSurvey,
    selectedSurveyId,
    loadSurveys,
    loadSurveyDetail,
    setSelectedSurveyId,
    createSurvey,
    updateSurvey,
    publishSurvey,
    closeSurvey,
    upsertQuestion,
    deleteQuestion,
    insertQuestionFromBank,
    upsertQuestionBank,
    deleteQuestionBank,
    submitResponse,
    dispatchOnSurveyPublished,
    dispatchOnSurveyClosed,
    dispatchOnSurveyResponseSubmitted,
    clearError,
    refresh,
    loadQuestionBank,
  }
}
