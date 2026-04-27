import { useCallback, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import { fetchOrgModulePayload } from '../../src/lib/orgModulePayload'
import { parseSurveyModuleSettings } from './surveyAdminSettingsSchema'
import type {
  SurveyRow,
  SurveyStatus,
  SurveyType,
  OrgSurveyQuestionRow,
  OrgSurveyResponseRow,
  OrgSurveyAnswerRow,
  SurveyQuestionBankRow,
  SurveyQuestionType,
  SurveyAmuReviewRow,
  SurveyActionPlanRow,
  SurveyPillar,
  SurveyActionPlanStatus,
} from './types'
import {
  parseSurveyRow,
  parseOrgSurveyQuestionRow,
  parseOrgSurveyResponseRow,
  parseOrgSurveyAnswerRow,
  parseSurveyQuestionBankRow,
  parseSurveyAmuReviewRow,
  parseSurveyActionPlanRow,
} from './types'
import { parseCatalogRow } from './surveyTemplateCatalogTypes'
import type { SurveyTemplateCatalogRow } from './surveyTemplateCatalogTypes'
import { catalogQuestionToUpsert } from './surveyTemplateApply'

type Supabase = SupabaseClient

function collect<T>(rows: unknown[] | null | undefined, parse: (r: unknown) => { success: true; data: T } | { success: false }): T[] {
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
  survey_type?: SurveyType
  start_date?: string | null
  end_date?: string | null
  vendor_name?: string | null
  vendor_org_number?: string | null
}

type UpsertQuestionInput = {
  id?: string
  surveyId: string
  questionText: string
  questionType: SurveyQuestionType
  orderIndex: number
  isRequired: boolean
  isMandatory?: boolean
  mandatoryLaw?: 'AML_4_3' | 'AML_4_4' | 'AML_6_2' | null
  config?: Record<string, unknown>
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
  /** Laster kun aktiv undersøkelse + spørsmål (for svarside uten org-kontekst, f.eks. /survey-respond). */
  loadActiveSurveyForRespondent: (surveyId: string) => Promise<void>
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
    config?: Record<string, unknown>
  }) => Promise<SurveyQuestionBankRow | null>
  deleteQuestionBank: (id: string) => Promise<void>
  submitResponse: (args: { surveyId: string; userId: string | null; answers: Array<{ questionId: string; answerValue: number | null; answerText: string | null }> }) => Promise<OrgSurveyResponseRow | null>
  dispatchOnSurveyPublished: (surveyId: string) => Promise<void>
  dispatchOnSurveyClosed: (surveyId: string) => Promise<void>
  clearError: () => void
  refresh: () => Promise<void>
  loadQuestionBank: () => Promise<void>
  dispatchOnSurveyResponseSubmitted: (surveyId: string) => Promise<void>
  amuReview: SurveyAmuReviewRow | null
  actionPlans: SurveyActionPlanRow[]
  loadAmuReview: (surveyId: string) => Promise<void>
  upsertAmuReview: (
    surveyId: string,
    patch: Partial<Pick<SurveyAmuReviewRow, 'meeting_date' | 'agenda_item' | 'protocol_text'>>,
  ) => Promise<SurveyAmuReviewRow | null>
  signAmuChair: (reviewId: string, name: string) => Promise<boolean>
  signVo: (reviewId: string, name: string) => Promise<boolean>
  loadActionPlans: (surveyId: string) => Promise<void>
  upsertActionPlan: (input: {
    id?: string
    surveyId: string
    category: string
    pillar: SurveyPillar
    title: string
    description?: string | null
    score?: number | null
    responsible?: string | null
    due_date?: string | null
  }) => Promise<SurveyActionPlanRow | null>
  updateActionPlanStatus: (id: string, status: SurveyActionPlanStatus) => Promise<void>
  /** System + org templates from `survey_template_catalog` */
  templateCatalog: SurveyTemplateCatalogRow[]
  templateCatalogLoading: boolean
  loadTemplateCatalog: () => Promise<void>
  /** Legg til spørsmål fra database-mal (kladd-undersøkelse). */
  applyTemplateToSurvey: (surveyId: string, templateId: string) => Promise<boolean>
  /** Lagre organisasjonsspesifikk mal (for import / egen definisjon). */
  saveOrgTemplate: (input: {
    id?: string
    name: string
    shortName?: string | null
    description?: string | null
    category?: string
    audience?: SurveyTemplateCatalogRow['audience']
    body: SurveyTemplateCatalogRow['body']
  }) => Promise<SurveyTemplateCatalogRow | null>
  deleteOrgTemplate: (templateId: string) => Promise<void>
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
  const [amuReview, setAmuReview] = useState<SurveyAmuReviewRow | null>(null)
  const [actionPlans, setActionPlans] = useState<SurveyActionPlanRow[]>([])
  const [templateCatalog, setTemplateCatalog] = useState<SurveyTemplateCatalogRow[]>([])
  const [templateCatalogLoading, setTemplateCatalogLoading] = useState(false)

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

  const loadAmuReview = useCallback(
    async (surveyId: string) => {
      if (!supabase) return
      const oid = assertOrg()
      if (!oid) return
      const { data, error: e } = await supabase
        .from('survey_amu_reviews')
        .select('*')
        .eq('survey_id', surveyId)
        .eq('organization_id', oid)
        .maybeSingle()
      if (e) {
        setError(getSupabaseErrorMessage(e))
        return
      }
      if (!data) {
        setAmuReview(null)
        return
      }
      const p = parseSurveyAmuReviewRow(data)
      setAmuReview(p.success ? p.data : null)
    },
    [supabase, assertOrg],
  )

  const loadActionPlans = useCallback(
    async (surveyId: string) => {
      if (!supabase) return
      const oid = assertOrg()
      if (!oid) return
      const { data, error: e } = await supabase
        .from('survey_action_plans')
        .select('*')
        .eq('survey_id', surveyId)
        .eq('organization_id', oid)
        .order('created_at', { ascending: true })
      if (e) {
        setError(getSupabaseErrorMessage(e))
        return
      }
      setActionPlans(collect(data, parseSurveyActionPlanRow))
    },
    [supabase, assertOrg],
  )

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
        await loadAmuReview(surveyId)
        await loadActionPlans(surveyId)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [supabase, assertOrg, loadAmuReview, loadActionPlans],
  )

  const loadActiveSurveyForRespondent = useCallback(
    async (surveyId: string) => {
      if (!supabase) {
        setError('Supabase er ikke konfigurert.')
        return
      }
      if (orgId) {
        await loadSurveyDetail(surveyId)
        return
      }
      setLoading(true)
      setError(null)
      setSelectedSurveyId(surveyId)
      setAmuReview(null)
      setActionPlans([])
      setResponses([])
      setAnswers([])
      try {
        const { data: s, error: se } = await supabase
          .from('surveys')
          .select('*')
          .eq('id', surveyId)
          .eq('status', 'active')
          .single()
        if (se) throw se
        const p = parseSurveyRow(s)
        if (!p.success) throw new Error('Ugyldig svar fra database')
        setSelectedSurvey(p.data)

        const { data: qData, error: qe } = await supabase
          .from('org_survey_questions')
          .select('*')
          .eq('survey_id', surveyId)
          .eq('organization_id', p.data.organization_id)
          .order('order_index', { ascending: true })
        if (qe) throw qe
        setQuestions(collect(qData, parseOrgSurveyQuestionRow))
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        setSelectedSurvey(null)
        setQuestions([])
      } finally {
        setLoading(false)
      }
    },
    [supabase, orgId, loadSurveyDetail],
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
            survey_type: input.survey_type ?? 'internal',
            start_date: input.start_date ?? null,
            end_date: input.end_date ?? null,
            vendor_name: input.vendor_name ?? null,
            vendor_org_number: input.vendor_org_number ?? null,
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
    async (surveyId: string, patch: Partial<Pick<SurveyRow, 'title' | 'description' | 'is_anonymous' | 'status' | 'published_at' | 'closed_at' | 'survey_type' | 'start_date' | 'end_date' | 'vendor_name' | 'vendor_org_number'>>) => {
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
          is_mandatory: input.isMandatory ?? false,
          mandatory_law: input.mandatoryLaw ?? null,
          config: input.config ?? {},
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
      const qToDelete = questions.find((q) => q.id === questionId)
      if (qToDelete?.is_mandatory) {
        setError('Dette spørsmålet er lovpålagt (AML § 4-3) og kan ikke slettes.')
        return
      }
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
    [supabase, assertOrg, requireManage, ensureQuestionEditable, questions],
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
          config: br.data.config ?? {},
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
      config?: Record<string, unknown>
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
          config: row.config ?? {},
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

  const upsertAmuReview = useCallback(
    async (
      surveyId: string,
      patch: Partial<Pick<SurveyAmuReviewRow, 'meeting_date' | 'agenda_item' | 'protocol_text'>>,
    ): Promise<SurveyAmuReviewRow | null> => {
      if (!supabase) return null
      if (!requireManage()) return null
      const oid = assertOrg()
      if (!oid) return null
      setError(null)
      try {
        const { data, error: e } = await supabase
          .from('survey_amu_reviews')
          .upsert(
            { survey_id: surveyId, organization_id: oid, ...patch },
            { onConflict: 'survey_id' },
          )
          .select()
          .single()
        if (e) throw e
        const pr = parseSurveyAmuReviewRow(data)
        if (!pr.success) throw new Error('Ugyldig svar fra database')
        setAmuReview(pr.data)
        return pr.data
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, assertOrg, requireManage],
  )

  const signAmuChair = useCallback(
    async (reviewId: string, name: string): Promise<boolean> => {
      if (!supabase) return false
      const oid = assertOrg()
      if (!oid) return false
      setError(null)
      try {
        const { data, error: e } = await supabase
          .from('survey_amu_reviews')
          .update({
            amu_chair_name: name.trim(),
            amu_chair_signed_at: new Date().toISOString(),
          })
          .eq('id', reviewId)
          .eq('organization_id', oid)
          .select()
          .single()
        if (e) throw e
        const p = parseSurveyAmuReviewRow(data)
        if (p.success) setAmuReview(p.data)
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, assertOrg],
  )

  const signVo = useCallback(
    async (reviewId: string, name: string): Promise<boolean> => {
      if (!supabase) return false
      const oid = assertOrg()
      if (!oid) return false
      setError(null)
      try {
        const { data, error: e } = await supabase
          .from('survey_amu_reviews')
          .update({
            vo_name: name.trim(),
            vo_signed_at: new Date().toISOString(),
          })
          .eq('id', reviewId)
          .eq('organization_id', oid)
          .select()
          .single()
        if (e) throw e
        const p = parseSurveyAmuReviewRow(data)
        if (p.success) setAmuReview(p.data)
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, assertOrg],
  )

  const upsertActionPlan = useCallback(
    async (input: {
      id?: string
      surveyId: string
      category: string
      pillar: SurveyPillar
      title: string
      description?: string | null
      score?: number | null
      responsible?: string | null
      due_date?: string | null
    }): Promise<SurveyActionPlanRow | null> => {
      if (!supabase) return null
      if (!requireManage()) return null
      const oid = assertOrg()
      if (!oid) return null
      setError(null)
      try {
        const body = {
          organization_id: oid,
          survey_id: input.surveyId,
          category: input.category,
          pillar: input.pillar,
          title: input.title,
          description: input.description ?? null,
          score: input.score ?? null,
          responsible: input.responsible ?? null,
          due_date: input.due_date ?? null,
        }
        const q = input.id
          ? supabase
              .from('survey_action_plans')
              .update(body)
              .eq('id', input.id)
              .eq('organization_id', oid)
              .select()
              .single()
          : supabase.from('survey_action_plans').insert(body).select().single()
        const { data, error: e } = await q
        if (e) throw e
        const p = parseSurveyActionPlanRow(data)
        if (!p.success) throw new Error('Ugyldig svar fra database')
        setActionPlans((prev) => {
          const i = prev.findIndex((x) => x.id === p.data.id)
          if (i < 0) return [...prev, p.data].sort((a, b) => a.created_at.localeCompare(b.created_at))
          return prev.map((x) => (x.id === p.data.id ? p.data : x))
        })
        return p.data
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, assertOrg, requireManage],
  )

  const updateActionPlanStatus = useCallback(
    async (id: string, status: SurveyActionPlanStatus) => {
      if (!supabase) return
      if (!requireManage()) return
      const oid = assertOrg()
      if (!oid) return
      setError(null)
      try {
        const { error: e } = await supabase
          .from('survey_action_plans')
          .update({ status })
          .eq('id', id)
          .eq('organization_id', oid)
        if (e) throw e
        setActionPlans((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
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
      setError(null)
      try {
        let surveyRow: SurveyRow
        let oid: string
        if (orgId) {
          const { data: s, error: se } = await supabase
            .from('surveys')
            .select('*')
            .eq('id', args.surveyId)
            .eq('organization_id', orgId)
            .single()
          if (se) throw se
          const parsed = parseSurveyRow(s)
          if (!parsed.success) throw new Error('Ugyldig svar fra database')
          surveyRow = parsed.data
          oid = orgId
        } else {
          const { data: s, error: se } = await supabase
            .from('surveys')
            .select('*')
            .eq('id', args.surveyId)
            .eq('status', 'active')
            .single()
          if (se) throw se
          const parsed = parseSurveyRow(s)
          if (!parsed.success) throw new Error('Ugyldig svar fra database')
          surveyRow = parsed.data
          oid = surveyRow.organization_id
        }

        if (surveyRow.status !== 'active') {
          setError('Undersøkelsen er ikke åpen for svar.')
          return null
        }

        const effectiveUserId = surveyRow.is_anonymous ? null : args.userId

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

        if (orgId) {
          setResponses((p) => [pr.data, ...p])
          await loadSurveyDetail(args.surveyId)
        }
        return pr.data
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, loadSurveyDetail],
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

  const loadTemplateCatalog = useCallback(async () => {
    if (!supabase) return
    const oid = assertOrg()
    if (!oid) return
    setError(null)
    setTemplateCatalogLoading(true)
    try {
      const { data: sys, error: e1 } = await supabase
        .from('survey_template_catalog')
        .select('*')
        .eq('is_system', true)
        .eq('is_active', true)
        .is('organization_id', null)
        .order('category', { ascending: true })
        .order('name', { ascending: true })
      if (e1) throw e1
      const { data: orgRows, error: e2 } = await supabase
        .from('survey_template_catalog')
        .select('*')
        .eq('organization_id', oid)
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true })
      if (e2) throw e2
      const merged = [...(sys ?? []), ...(orgRows ?? [])]
      setTemplateCatalog(collect(merged, parseCatalogRow))
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setTemplateCatalogLoading(false)
    }
  }, [supabase, assertOrg])

  const applyTemplateToSurvey = useCallback(
    async (surveyId: string, templateId: string): Promise<boolean> => {
      if (!supabase) return false
      if (!requireManage()) return false
      const oid = assertOrg()
      if (!oid) return false
      setError(null)
      try {
        const { data: t, error: te } = await supabase
          .from('survey_template_catalog')
          .select('*')
          .eq('id', templateId)
          .maybeSingle()
        if (te) throw te
        if (!t) {
          setError('Mal ikke funnet.')
          return false
        }
        if (t.organization_id != null && t.organization_id !== oid) {
          setError('Ingen tilgang til denne malen.')
          return false
        }
        if (t.organization_id == null && !t.is_system) {
          setError('Ugyldig mal.')
          return false
        }
        const pr = parseCatalogRow(t)
        if (!pr.success) {
          setError('Ugyldig maldata.')
          return false
        }
        const { data: s, error: se } = await supabase
          .from('surveys')
          .select('*')
          .eq('id', surveyId)
          .eq('organization_id', oid)
          .single()
        if (se) throw se
        const sp = parseSurveyRow(s)
        if (!sp.success) throw new Error('Ugyldig undersøkelse')
        if (sp.data.status !== 'draft') {
          setError('Mal kan bare brukes på undersøkelser i kladd.')
          return false
        }
        const questions = pr.data.body.questions ?? []
        for (let i = 0; i < questions.length; i++) {
          const cq = questions[i]!
          const map = catalogQuestionToUpsert(cq, i)
          const lower = cq.text.toLowerCase()
          const mandatory =
            ['trakassering', 'integritet', 'medvirkning', 'sikkerhet', 'psykososial'].some((k) => lower.includes(k))
          const row = await upsertQuestion({
            surveyId,
            questionText: map.questionText,
            questionType: map.questionType,
            orderIndex: map.orderIndex,
            isRequired: map.isRequired,
            isMandatory: mandatory,
            mandatoryLaw: mandatory ? 'AML_4_3' : null,
            config: map.config,
          })
          if (!row) return false
        }
        await loadSurveyDetail(surveyId)
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, assertOrg, requireManage, upsertQuestion, loadSurveyDetail],
  )

  const saveOrgTemplate = useCallback(
    async (input: {
      id?: string
      name: string
      shortName?: string | null
      description?: string | null
      category?: string
      audience?: SurveyTemplateCatalogRow['audience']
      body: SurveyTemplateCatalogRow['body']
    }): Promise<SurveyTemplateCatalogRow | null> => {
      if (!supabase) return null
      if (!requireManage()) return null
      const oid = assertOrg()
      if (!oid) return null
      setError(null)
      try {
        const base = {
          organization_id: oid,
          is_system: false,
          name: input.name,
          short_name: input.shortName ?? null,
          description: input.description ?? null,
          source: 'Organisasjon',
          use_case: 'Egen mal',
          category: input.category ?? 'custom',
          audience: input.audience ?? 'internal',
          estimated_minutes: 5,
          recommend_anonymous: true,
          scoring_note: null,
          law_ref: null,
          body: input.body,
          is_active: true,
        }
        const newId =
          typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
            ? globalThis.crypto.randomUUID()
            : `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
        const q = input.id
          ? supabase
              .from('survey_template_catalog')
              .update(base)
              .eq('id', input.id)
              .eq('organization_id', oid)
              .select()
              .single()
          : supabase.from('survey_template_catalog').insert({ ...base, id: newId }).select().single()
        const { data, error: e } = await q
        if (e) throw e
        const p = parseCatalogRow(data)
        if (!p.success) throw new Error('Ugyldig svar')
        await loadTemplateCatalog()
        return p.data
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, assertOrg, requireManage, loadTemplateCatalog],
  )

  const deleteOrgTemplate = useCallback(
    async (templateId: string) => {
      if (!supabase) return
      if (!requireManage()) return
      const oid = assertOrg()
      if (!oid) return
      setError(null)
      try {
        const { error: e } = await supabase
          .from('survey_template_catalog')
          .delete()
          .eq('id', templateId)
          .eq('organization_id', oid)
        if (e) throw e
        setTemplateCatalog((prev) => prev.filter((t) => t.id !== templateId))
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
    loadActiveSurveyForRespondent,
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
    amuReview,
    actionPlans,
    loadAmuReview,
    upsertAmuReview,
    signAmuChair,
    signVo,
    loadActionPlans,
    upsertActionPlan,
    updateActionPlanStatus,
    templateCatalog,
    templateCatalogLoading,
    loadTemplateCatalog,
    applyTemplateToSurvey,
    saveOrgTemplate,
    deleteOrgTemplate,
  }
}
