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
  SurveyDistributionRow,
  SurveyInvitationRow,
  SurveySectionRow,
} from './types'
import {
  parseSurveyRow,
  parseOrgSurveyQuestionRow,
  parseOrgSurveyResponseRow,
  parseOrgSurveyAnswerRow,
  parseSurveyQuestionBankRow,
  parseSurveySectionRow,
} from './types'
import { parseCatalogRow } from './surveyTemplateCatalogTypes'
import type { SurveyTemplateCatalogRow } from './surveyTemplateCatalogTypes'
import { catalogQuestionToUpsert } from './surveyTemplateApply'
import { mandatoryFromCatalogQuestion } from './surveyMandatoryLaw'
import { useSurveyDistribution } from './useSurveyDistribution'
import { useSurveyAmuAndActions } from './useSurveyAmuAndActions'
import { submitSurveyResponse } from './submitSurveyResponse'

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
  survey_purpose?: string | null
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
  sectionId?: string | null
}

export type UseSurveyState = {
  loading: boolean
  error: string | null
  canManage: boolean
  orgId: string | undefined
  surveys: SurveyRow[]
  /** Questions for currently loaded survey (see `selectedSurveyId`) */
  questions: OrgSurveyQuestionRow[]
  /** Builder sections (folders) for the loaded survey */
  surveySections: SurveySectionRow[]
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
  updateSurvey: (
    surveyId: string,
    patch: Partial<
      Pick<
        SurveyRow,
        | 'title'
        | 'description'
        | 'is_anonymous'
        | 'status'
        | 'published_at'
        | 'closed_at'
        | 'survey_type'
        | 'start_date'
        | 'end_date'
        | 'vendor_name'
        | 'vendor_org_number'
        | 'survey_purpose'
        | 'survey_amu_summary'
      >
    >,
  ) => Promise<boolean>
  publishSurvey: (surveyId: string) => Promise<void>
  closeSurvey: (surveyId: string) => Promise<void>
  upsertQuestion: (input: UpsertQuestionInput) => Promise<OrgSurveyQuestionRow | null>
  /** Oppdater kun rekkefølge (indeks 0..n-1) — kladd-undersøkelser. */
  reorderQuestions: (surveyId: string, orderedQuestionIds: string[]) => Promise<boolean>
  upsertSection: (input: {
    id?: string
    surveyId: string
    title: string
    description?: string | null
    orderIndex: number
  }) => Promise<SurveySectionRow | null>
  deleteSection: (sectionId: string, surveyId: string) => Promise<void>
  reorderSections: (surveyId: string, orderedSectionIds: string[]) => Promise<boolean>
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
  submitResponse: (args: {
    surveyId: string
    userId: string | null
    answers: Array<{ questionId: string; answerValue: number | null; answerText: string | null }>
    /** When provided, skips a DB fetch for validation (respond page). */
    questions?: OrgSurveyQuestionRow[]
    /** Personal invitation token from ?invite= — links this response to the correct invitation row */
    invitationToken?: string | null
  }) => Promise<OrgSurveyResponseRow | null>
  dispatchOnSurveyPublished: (surveyId: string) => Promise<void>
  dispatchOnSurveyClosed: (surveyId: string) => Promise<void>
  clearError: () => void
  refresh: () => Promise<void>
  loadQuestionBank: () => Promise<void>
  dispatchOnSurveyResponseSubmitted: (surveyId: string) => Promise<void>
  /** Når svarandel mot distribusjonsinvitasjoner når terskel i modulinnstillinger — én arbeidsflyt per økt. */
  maybeDispatchSurveyResponseThreshold: (surveyId: string) => Promise<void>
  amuReview: SurveyAmuReviewRow | null
  actionPlans: SurveyActionPlanRow[]
  loadAmuReview: (surveyId: string) => Promise<void>
  upsertAmuReview: (
    surveyId: string,
    patch: Partial<Pick<SurveyAmuReviewRow, 'meeting_date' | 'agenda_item' | 'protocol_text'>>,
  ) => Promise<SurveyAmuReviewRow | null>
  signAmuChair: (reviewId: string) => Promise<boolean>
  signVo: (reviewId: string) => Promise<boolean>
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
    estimatedMinutes?: number
    recommendAnonymous?: boolean
    scoringNote?: string | null
    lawRef?: string | null
  }) => Promise<SurveyTemplateCatalogRow | null>
  deleteOrgTemplate: (templateId: string) => Promise<void>
  distributions: SurveyDistributionRow[]
  invitations: SurveyInvitationRow[]
  distributionsLoading: boolean
  loadDistributions: (surveyId: string) => Promise<void>
  loadInvitations: (surveyId: string) => Promise<void>
  createDistribution: (input: {
    surveyId: string
    label?: string | null
    audienceType: 'all' | 'departments' | 'teams' | 'locations'
    departmentIds?: string[]
    teamIds?: string[]
    locationIds?: string[]
    scheduledInitialSendAt?: string | null
  }) => Promise<SurveyDistributionRow | null>
  generateInvitations: (distributionId: string, surveyId: string) => Promise<boolean>
  addManualInvitations: (distributionId: string, surveyId: string, profileIds: string[]) => Promise<boolean>
  exportDistributionCsv: (surveyId: string, distributionId: string) => Promise<void>
  /** Sender ventende invitasjoner på e-post via Edge Function `send-survey-invites` (krever Resend). */
  sendInvitationEmails: (distributionId: string, surveyId: string) => Promise<{ sent: number; failed: number } | null>
  /** Påminnelse kun til de som fortsatt har status «venter» og som har fått første e-post. */
  sendInvitationReminders: (distributionId: string, surveyId: string) => Promise<{ sent: number; failed: number } | null>
}

type UseSurveyInput = { supabase: Supabase | null }

export function useSurvey({ supabase }: UseSurveyInput): UseSurveyState {
  const { organization, can, isAdmin, user } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('survey.manage')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [surveys, setSurveys] = useState<SurveyRow[]>([])
  const [questions, setQuestions] = useState<OrgSurveyQuestionRow[]>([])
  const [surveySections, setSurveySections] = useState<SurveySectionRow[]>([])
  const [responses, setResponses] = useState<OrgSurveyResponseRow[]>([])
  const [answers, setAnswers] = useState<OrgSurveyAnswerRow[]>([])
  const [questionBank, setQuestionBank] = useState<SurveyQuestionBankRow[]>([])
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyRow | null>(null)
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null)
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

  const {
    amuReview,
    actionPlans,
    clearAmuState,
    loadAmuReview,
    loadActionPlans,
    upsertAmuReview,
    signAmuChair,
    signVo,
    upsertActionPlan,
    updateActionPlanStatus,
  } = useSurveyAmuAndActions({ supabase, assertOrg, requireManage, setError })

  const {
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
  } = useSurveyDistribution({ supabase, assertOrg, requireManage, setError, user })

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

  const maybeDispatchSurveyResponseThreshold = useCallback(
    async (surveyId: string) => {
      if (!supabase) return
      if (!requireManage()) return
      const oid = assertOrg()
      if (!oid) return
      try {
        const raw = await fetchOrgModulePayload<Record<string, unknown>>(supabase, oid, 'survey_settings')
        const st = parseSurveyModuleSettings(raw ?? {})
        const threshold = st.response_rate_threshold_pct ?? 0
        if (!threshold || threshold <= 0) return

        const { count: total, error: te } = await supabase
          .from('survey_invitations')
          .select('*', { count: 'exact', head: true })
          .eq('survey_id', surveyId)
          .eq('organization_id', oid)
        if (te || !total || total === 0) return

        const { count: done, error: de } = await supabase
          .from('survey_invitations')
          .select('*', { count: 'exact', head: true })
          .eq('survey_id', surveyId)
          .eq('organization_id', oid)
          .eq('status', 'completed')
        if (de || done == null) return

        const pct = Math.floor((done / total) * 100)
        if (pct < threshold) return

        const sessKey = `survey_threshold_evt:${surveyId}:${threshold}`
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessKey)) return

        const { error: e } = await supabase.rpc('workflow_dispatch_survey_event', {
          p_organization_id: oid,
          p_event: 'ON_SURVEY_RESPONSE_RATE_THRESHOLD',
          p_survey_id: surveyId,
        })
        if (e) throw e
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessKey, '1')
      } catch {
        /* non-blocking */
      }
    },
    [supabase, assertOrg, requireManage],
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

        const [qRes, rRes, secRes] = await Promise.all([
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
          supabase
            .from('survey_sections')
            .select('*')
            .eq('survey_id', surveyId)
            .eq('organization_id', oid)
            .order('order_index', { ascending: true }),
        ])
        if (qRes.error) throw qRes.error
        if (rRes.error) throw rRes.error
        if (secRes.error) {
          setSurveySections([])
        } else {
          setSurveySections(collect(secRes.data, parseSurveySectionRow))
        }

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

        await Promise.all([
          loadAmuReview(surveyId),
          loadActionPlans(surveyId),
          loadDistributions(surveyId),
          loadInvitations(surveyId),
        ])
        void maybeDispatchSurveyResponseThreshold(surveyId)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [supabase, assertOrg, loadAmuReview, loadActionPlans, loadDistributions, loadInvitations, maybeDispatchSurveyResponseThreshold],
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
      clearAmuState()
      clearDistributionState()
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

        const { data: secData, error: secErr } = await supabase
          .from('survey_sections')
          .select('*')
          .eq('survey_id', surveyId)
          .eq('organization_id', p.data.organization_id)
          .order('order_index', { ascending: true })
        if (!secErr && secData) {
          setSurveySections(collect(secData, parseSurveySectionRow))
        } else {
          setSurveySections([])
        }
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        setSelectedSurvey(null)
        setQuestions([])
        setSurveySections([])
      } finally {
        setLoading(false)
      }
    },
    [supabase, orgId, loadSurveyDetail, clearDistributionState, clearAmuState],
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
            survey_purpose: input.survey_purpose?.trim() || null,
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
    async (
      surveyId: string,
      patch: Partial<
        Pick<
          SurveyRow,
          | 'title'
          | 'description'
          | 'is_anonymous'
          | 'status'
          | 'published_at'
          | 'closed_at'
          | 'survey_type'
          | 'start_date'
          | 'end_date'
          | 'vendor_name'
          | 'vendor_org_number'
          | 'survey_purpose'
          | 'survey_amu_summary'
        >
      >,
    ) => {
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
          section_id: input.sectionId === undefined ? null : input.sectionId,
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

  const reorderQuestions = useCallback(
    async (surveyId: string, orderedQuestionIds: string[]): Promise<boolean> => {
      if (!supabase) return false
      if (!requireManage()) return false
      const oid = assertOrg()
      if (!oid) return false
      const { data: s, error: se } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .eq('organization_id', oid)
        .single()
      if (se) {
        setError(getSupabaseErrorMessage(se))
        return false
      }
      const parsed = parseSurveyRow(s)
      if (!parsed.success) {
        setError('Ugyldig svar fra database')
        return false
      }
      if (!ensureQuestionEditable(parsed.data)) return false
      const { data: qRows, error: qe } = await supabase
        .from('org_survey_questions')
        .select('id')
        .eq('survey_id', surveyId)
        .eq('organization_id', oid)
      if (qe) {
        setError(getSupabaseErrorMessage(qe))
        return false
      }
      const dbIds = new Set((qRows ?? []).map((r: { id: string }) => r.id))
      if (orderedQuestionIds.length !== dbIds.size) return false
      for (const id of orderedQuestionIds) {
        if (!dbIds.has(id)) return false
      }
      setError(null)
      try {
        const updates = orderedQuestionIds.map((id, i) =>
          supabase
            .from('org_survey_questions')
            .update({ order_index: i })
            .eq('id', id)
            .eq('survey_id', surveyId)
            .eq('organization_id', oid),
        )
        const results = await Promise.all(updates.map((q) => q))
        for (const res of results) {
          if (res.error) throw res.error
        }
        setQuestions((prev) => {
          const pos = new Map(orderedQuestionIds.map((id, idx) => [id, idx]))
          const others = prev.filter((q) => q.survey_id !== surveyId)
          const mine = prev
            .filter((q) => q.survey_id === surveyId)
            .map((q) => {
              const p = pos.get(q.id)
              return p === undefined ? q : { ...q, order_index: p }
            })
            .sort((a, b) => a.order_index - b.order_index)
          return [...others, ...mine]
        })
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, assertOrg, requireManage, ensureQuestionEditable],
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

  const upsertSection = useCallback(
    async (input: {
      id?: string
      surveyId: string
      title: string
      description?: string | null
      orderIndex: number
    }): Promise<SurveySectionRow | null> => {
      if (!supabase) return null
      if (!requireManage()) return null
      const oid = assertOrg()
      if (!oid) return null
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
      setError(null)
      try {
        const body = {
          organization_id: oid,
          survey_id: input.surveyId,
          title: input.title.trim() || 'Seksjon',
          description: input.description?.trim() || null,
          order_index: input.orderIndex,
        }
        const q = input.id
          ? supabase
              .from('survey_sections')
              .update(body)
              .eq('id', input.id)
              .eq('organization_id', oid)
              .select()
              .single()
          : supabase.from('survey_sections').insert(body).select().single()
        const { data, error: e } = await q
        if (e) throw e
        const p = parseSurveySectionRow(data)
        if (!p.success) throw new Error('Ugyldig svar fra database')
        setSurveySections((prev) => {
          const i = prev.findIndex((x) => x.id === p.data.id)
          if (i < 0) return [...prev, p.data].sort((a, b) => a.order_index - b.order_index)
          return prev.map((x) => (x.id === p.data.id ? p.data : x)).sort((a, b) => a.order_index - b.order_index)
        })
        return p.data
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, assertOrg, requireManage, ensureQuestionEditable],
  )

  const deleteSection = useCallback(
    async (sectionId: string, surveyId: string) => {
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
          .from('survey_sections')
          .delete()
          .eq('id', sectionId)
          .eq('survey_id', surveyId)
          .eq('organization_id', oid)
        if (e) throw e
        setSurveySections((prev) => prev.filter((x) => x.id !== sectionId))
        setQuestions((prev) =>
          prev.map((q) => (q.section_id === sectionId ? { ...q, section_id: null } : q)),
        )
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, assertOrg, requireManage, ensureQuestionEditable],
  )

  const reorderSections = useCallback(
    async (surveyId: string, orderedSectionIds: string[]): Promise<boolean> => {
      if (!supabase) return false
      if (!requireManage()) return false
      const oid = assertOrg()
      if (!oid) return false
      const { data: s, error: se } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .eq('organization_id', oid)
        .single()
      if (se) {
        setError(getSupabaseErrorMessage(se))
        return false
      }
      const parsed = parseSurveyRow(s)
      if (!parsed.success) {
        setError('Ugyldig svar fra database')
        return false
      }
      if (!ensureQuestionEditable(parsed.data)) return false
      const { data: rows, error: re } = await supabase
        .from('survey_sections')
        .select('id')
        .eq('survey_id', surveyId)
        .eq('organization_id', oid)
      if (re) {
        setError(getSupabaseErrorMessage(re))
        return false
      }
      const dbIds = new Set((rows ?? []).map((r: { id: string }) => r.id))
      if (orderedSectionIds.length !== dbIds.size) return false
      for (const id of orderedSectionIds) {
        if (!dbIds.has(id)) return false
      }
      setError(null)
      try {
        const updates = orderedSectionIds.map((id, i) =>
          supabase
            .from('survey_sections')
            .update({ order_index: i })
            .eq('id', id)
            .eq('survey_id', surveyId)
            .eq('organization_id', oid),
        )
        const results = await Promise.all(updates.map((q) => q))
        for (const res of results) {
          if (res.error) throw res.error
        }
        setSurveySections((prev) => {
          const pos = new Map(orderedSectionIds.map((id, idx) => [id, idx]))
          const mine = prev
            .filter((x) => x.survey_id === surveyId)
            .map((x) => {
              const p = pos.get(x.id)
              return p === undefined ? x : { ...x, order_index: p }
            })
            .sort((a, b) => a.order_index - b.order_index)
          const others = prev.filter((x) => x.survey_id !== surveyId)
          return [...others, ...mine]
        })
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
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

  const submitResponse = useCallback(
    async (args: {
      surveyId: string
      userId: string | null
      answers: Array<{ questionId: string; answerValue: number | null; answerText: string | null }>
      questions?: OrgSurveyQuestionRow[]
      invitationToken?: string | null
    }): Promise<OrgSurveyResponseRow | null> => {
      if (!supabase) return null
      setError(null)
      const result = await submitSurveyResponse({ supabase, orgId }, args)
      if (!result.ok) {
        setError(result.message ?? 'Noe gikk galt.')
        return null
      }
      if (orgId) {
        setResponses((p) => [result.response, ...p])
        await loadSurveyDetail(args.surveyId)
      }
      return result.response
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
          const law = mandatoryFromCatalogQuestion(cq)
          const row = await upsertQuestion({
            surveyId,
            questionText: map.questionText,
            questionType: map.questionType,
            orderIndex: map.orderIndex,
            isRequired: map.isRequired,
            isMandatory: law.isMandatory,
            mandatoryLaw: law.mandatoryLaw,
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
      estimatedMinutes?: number
      recommendAnonymous?: boolean
      scoringNote?: string | null
      lawRef?: string | null
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
          estimated_minutes: input.estimatedMinutes ?? 5,
          recommend_anonymous: input.recommendAnonymous ?? true,
          scoring_note: input.scoringNote ?? null,
          law_ref: input.lawRef ?? null,
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
    surveySections,
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
    reorderQuestions,
    upsertSection,
    deleteSection,
    reorderSections,
    deleteQuestion,
    insertQuestionFromBank,
    upsertQuestionBank,
    deleteQuestionBank,
    submitResponse,
    dispatchOnSurveyPublished,
    dispatchOnSurveyClosed,
    dispatchOnSurveyResponseSubmitted,
    maybeDispatchSurveyResponseThreshold,
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
    distributions,
    invitations,
    distributionsLoading,
    loadDistributions,
    loadInvitations,
    createDistribution,
    generateInvitations,
    sendInvitationEmails,
    sendInvitationReminders,
    addManualInvitations,
    exportDistributionCsv,
  }
}
