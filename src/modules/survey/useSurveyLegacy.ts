import { useCallback, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SurveyCampaignRow,
  SurveyQuestionRow,
  SurveyResultRow,
  SurveyActionPlanRow,
  SurveyAmuReviewRow,
  SurveyPillar,
} from '../../data/survey'
import { normaliseLikert5, normaliseLikert7 } from '../../data/survey'
import {
  SurveyCampaignRowSchema,
  SurveyQuestionRowSchema,
  SurveyResultRowSchema,
  SurveyActionPlanRowSchema,
  SurveyAmuReviewRowSchema,
} from './schema'

type Input = { supabase: SupabaseClient | null }

export type SurveyModuleState = {
  loading: boolean
  error: string | null
  campaigns: SurveyCampaignRow[]
  questions: SurveyQuestionRow[]
  results: SurveyResultRow[]
  actionPlans: SurveyActionPlanRow[]
  amuReview: SurveyAmuReviewRow | null
  selectedCampaign: SurveyCampaignRow | null
  respondentCount: number
  loadList: () => Promise<void>
  loadCampaign: (campaignId: string) => Promise<void>
  createCampaign: (payload: CreateCampaignPayload) => Promise<SurveyCampaignRow | null>
  updateCampaign: (campaignId: string, patch: Partial<SurveyCampaignRow>) => Promise<void>
  openCampaign: (campaignId: string) => Promise<void>
  closeCampaign: (campaignId: string) => Promise<void>
  upsertQuestion: (payload: UpsertQuestionPayload) => Promise<SurveyQuestionRow | null>
  deleteQuestion: (questionId: string) => Promise<void>
  seedQpsNordic: (campaignId: string, pillar?: SurveyPillar) => Promise<void>
  computeResults: (campaignId: string) => Promise<void>
  updateActionPlan: (planId: string, patch: Partial<SurveyActionPlanRow>) => Promise<void>
  signAmuChair: (reviewId: string, name: string) => Promise<void>
  signVo: (reviewId: string, name: string) => Promise<void>
  upsertAmuReview: (campaignId: string, patch: Partial<SurveyAmuReviewRow>) => Promise<void>
  clearError: () => void
}

export type CreateCampaignPayload = {
  title: string
  description?: string
  pillar: SurveyPillar
  questionSet?: 'qpsnordic' | 'ark' | 'custom'
  opensAt?: string
  closesAt?: string
  recurrenceMonths?: number
  actionThreshold?: number
}

export type UpsertQuestionPayload = {
  id?: string
  campaignId: string
  pillar: SurveyPillar
  category: string
  questionText: string
  questionType: 'likert5' | 'likert7' | 'yesno' | 'text' | 'nps'
  sourceKey?: string
  isMandatory?: boolean
  mandatoryLaw?: string
  sortOrder?: number
}

function parseCampaign(r: unknown): SurveyCampaignRow | null {
  const p = SurveyCampaignRowSchema.safeParse(r)
  return p.success ? p.data : null
}
function parseQuestion(r: unknown): SurveyQuestionRow | null {
  const p = SurveyQuestionRowSchema.safeParse(r)
  return p.success ? p.data : null
}
function parseResult(r: unknown): SurveyResultRow | null {
  const p = SurveyResultRowSchema.safeParse(r)
  return p.success ? p.data : null
}
function parseActionPlan(r: unknown): SurveyActionPlanRow | null {
  const p = SurveyActionPlanRowSchema.safeParse(r)
  return p.success ? p.data : null
}
function parseAmuReview(r: unknown): SurveyAmuReviewRow | null {
  const p = SurveyAmuReviewRowSchema.safeParse(r)
  return p.success ? p.data : null
}

export function useSurveyLegacy({ supabase }: Input): SurveyModuleState {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<SurveyCampaignRow[]>([])
  const [questions, setQuestions] = useState<SurveyQuestionRow[]>([])
  const [results, setResults] = useState<SurveyResultRow[]>([])
  const [actionPlans, setActionPlans] = useState<SurveyActionPlanRow[]>([])
  const [amuReview, setAmuReview] = useState<SurveyAmuReviewRow | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<SurveyCampaignRow | null>(null)
  const [respondentCount, setRespondentCount] = useState(0)

  const clearError = useCallback(() => setError(null), [])

  const loadList = useCallback(async () => {
    if (!supabase) {
      setError('Supabase er ikke konfigurert.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('survey_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
      if (e) throw e
      setCampaigns((data ?? []).map(parseCampaign).filter((r): r is SurveyCampaignRow => r !== null))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste undersøkelser.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const loadCampaign = useCallback(
    async (campaignId: string) => {
      if (!supabase) return
      setLoading(true)
      setError(null)
      try {
        const [campRes, qRes, resRes, actRes, amuRes, countRes] = await Promise.all([
          supabase.from('survey_campaigns').select('*').eq('id', campaignId).single(),
          supabase
            .from('survey_questions')
            .select('*')
            .eq('campaign_id', campaignId)
            .is('deleted_at', null)
            .order('sort_order'),
          supabase.from('survey_results_cache').select('*').eq('campaign_id', campaignId),
          supabase
            .from('survey_action_plans')
            .select('*')
            .eq('campaign_id', campaignId)
            .order('created_at', { ascending: false }),
          supabase.from('survey_amu_reviews').select('*').eq('campaign_id', campaignId).maybeSingle(),
          supabase.from('survey_responses').select('respondent_token').eq('campaign_id', campaignId),
        ])
        if (campRes.error) throw campRes.error
        if (qRes.error) throw qRes.error
        if (resRes.error) throw resRes.error
        if (actRes.error) throw actRes.error
        if (amuRes.error) throw amuRes.error
        if (countRes.error) throw countRes.error

        setSelectedCampaign(parseCampaign(campRes.data))
        setQuestions((qRes.data ?? []).map(parseQuestion).filter((r): r is SurveyQuestionRow => r !== null))
        setResults((resRes.data ?? []).map(parseResult).filter((r): r is SurveyResultRow => r !== null))
        setActionPlans((actRes.data ?? []).map(parseActionPlan).filter((r): r is SurveyActionPlanRow => r !== null))
        setAmuReview(amuRes.data ? parseAmuReview(amuRes.data) : null)
        const tokens = new Set((countRes.data ?? []).map((r: { respondent_token: string }) => r.respondent_token))
        setRespondentCount(tokens.size)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke laste undersøkelse.')
      } finally {
        setLoading(false)
      }
    },
    [supabase],
  )

  const createCampaign = useCallback(
    async (payload: CreateCampaignPayload): Promise<SurveyCampaignRow | null> => {
      if (!supabase) {
        setError('Supabase er ikke konfigurert.')
        return null
      }
      try {
        const { data, error: e } = await supabase
          .from('survey_campaigns')
          .insert({
            title: payload.title,
            description: payload.description ?? null,
            pillar: payload.pillar,
            question_set: payload.questionSet ?? 'qpsnordic',
            opens_at: payload.opensAt ?? null,
            closes_at: payload.closesAt ? `${payload.closesAt}T23:59:59.999Z` : null,
            recurrence_months: payload.recurrenceMonths ?? null,
            action_threshold: payload.actionThreshold ?? 60,
          })
          .select()
          .single()
        if (e) throw e
        const parsed = parseCampaign(data)
        if (parsed) setCampaigns((prev) => [parsed, ...prev])
        return parsed
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke opprette undersøkelse.')
        return null
      }
    },
    [supabase],
  )

  const updateCampaign = useCallback(
    async (campaignId: string, patch: Partial<SurveyCampaignRow>) => {
      if (!supabase) return
      try {
        const { error: e } = await supabase.from('survey_campaigns').update(patch).eq('id', campaignId)
        if (e) throw e
        setSelectedCampaign((prev) => (prev?.id === campaignId ? { ...prev, ...patch } : prev))
        setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, ...patch } : c)))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke oppdatere undersøkelse.')
      }
    },
    [supabase],
  )

  const openCampaign = useCallback(
    async (campaignId: string) => {
      await updateCampaign(campaignId, { status: 'open', opens_at: new Date().toISOString() })
    },
    [updateCampaign],
  )

  const closeCampaign = useCallback(
    async (campaignId: string) => {
      await updateCampaign(campaignId, { status: 'closed', closes_at: new Date().toISOString() })
    },
    [updateCampaign],
  )

  const upsertQuestion = useCallback(
    async (payload: UpsertQuestionPayload): Promise<SurveyQuestionRow | null> => {
      if (!supabase) return null
      try {
        const row = {
          campaign_id: payload.campaignId,
          pillar: payload.pillar,
          category: payload.category,
          question_text: payload.questionText,
          question_type: payload.questionType,
          source_key: payload.sourceKey ?? null,
          is_mandatory: payload.isMandatory ?? false,
          mandatory_law: payload.mandatoryLaw ?? null,
          sort_order: payload.sortOrder ?? 0,
        }
        const query = payload.id
          ? supabase.from('survey_questions').update(row).eq('id', payload.id).select().single()
          : supabase.from('survey_questions').insert(row).select().single()
        const { data, error: e } = await query
        if (e) throw e
        const parsed = parseQuestion(data)
        if (parsed) {
          setQuestions((prev) => {
            const idx = prev.findIndex((q) => q.id === parsed.id)
            return idx >= 0 ? prev.map((q, i) => (i === idx ? parsed : q)) : [...prev, parsed]
          })
        }
        return parsed
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke lagre spørsmål.')
        return null
      }
    },
    [supabase],
  )

  const deleteQuestion = useCallback(
    async (questionId: string) => {
      if (!supabase) return
      try {
        const { error: e } = await supabase
          .from('survey_questions')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', questionId)
        if (e) throw e
        setQuestions((prev) => prev.filter((q) => q.id !== questionId))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke slette spørsmål.')
      }
    },
    [supabase],
  )

  const seedQpsNordic = useCallback(
    async (campaignId: string, pillar?: SurveyPillar) => {
      if (!supabase) return
      const { QPS_NORDIC_QUESTIONS } = await import('../../data/survey')
      const filtered = pillar ? QPS_NORDIC_QUESTIONS.filter((q) => q.pillar === pillar) : QPS_NORDIC_QUESTIONS
      for (let i = 0; i < filtered.length; i++) {
        const q = filtered[i]
        await upsertQuestion({
          campaignId,
          pillar: q.pillar,
          category: q.category,
          questionText: q.question_text,
          questionType: q.question_type,
          sourceKey: q.source_key,
          isMandatory: q.is_mandatory,
          mandatoryLaw: q.mandatory_law ?? undefined,
          sortOrder: i,
        })
      }
    },
    [supabase, upsertQuestion],
  )

  const computeResults = useCallback(
    async (campaignId: string) => {
      if (!supabase) return
      setLoading(true)
      try {
        const { data: responses, error: rErr } = await supabase
          .from('survey_responses')
          .select('department, answer_numeric, answer_bool, survey_questions(pillar, category, question_type)')
          .eq('campaign_id', campaignId)
        if (rErr) throw rErr

        let campaign = selectedCampaign?.id === campaignId ? selectedCampaign : null
        if (!campaign) {
          const { data: cRow, error: cErr } = await supabase
            .from('survey_campaigns')
            .select('*')
            .eq('id', campaignId)
            .single()
          if (cErr) throw cErr
          campaign = parseCampaign(cRow)
        }
        const threshold = campaign?.anonymity_threshold ?? 5
        const actionThr = campaign?.action_threshold ?? 60

        type AccVal = { scores: number[]; pillar: SurveyPillar; category: string; department: string | null }
        const acc: Record<string, AccVal> = {}

        for (const r of responses ?? []) {
          const rawQ = r.survey_questions
          const q = Array.isArray(rawQ) ? rawQ[0] : rawQ
          const typed = q as { pillar: SurveyPillar; category: string; question_type: string } | null
          if (!typed) continue
          if (typed.question_type === 'text') continue
          let score: number | null = null
          if (typed.question_type === 'likert5' && r.answer_numeric != null)
            score = normaliseLikert5(r.answer_numeric)
          if (typed.question_type === 'likert7' && r.answer_numeric != null)
            score = normaliseLikert7(r.answer_numeric)
          if (typed.question_type === 'yesno' && r.answer_bool != null) score = r.answer_bool ? 100 : 0
          if (typed.question_type === 'nps' && r.answer_numeric != null)
            score = Math.round((r.answer_numeric / 10) * 100)
          if (score === null) continue

          const orgKey = `org:${typed.pillar}:${typed.category}`
          if (!acc[orgKey])
            acc[orgKey] = { scores: [], pillar: typed.pillar, category: typed.category, department: null }
          acc[orgKey].scores.push(score)

          const dept = r.department as string | null
          if (dept) {
            const dk = `dept:${dept}:${typed.pillar}:${typed.category}`
            if (!acc[dk]) acc[dk] = { scores: [], pillar: typed.pillar, category: typed.category, department: dept }
            acc[dk].scores.push(score)
          }
        }

        await supabase.from('survey_results_cache').delete().eq('campaign_id', campaignId)

        const toInsert: Record<string, unknown>[] = []
        const lowScoreCategories: Array<{ pillar: SurveyPillar; category: string; score: number }> = []

        for (const [, v] of Object.entries(acc)) {
          const count = v.scores.length
          const suppressed = count < threshold
          const avg = suppressed ? null : Math.round(v.scores.reduce((a, b) => a + b, 0) / count)
          toInsert.push({
            campaign_id: campaignId,
            department: v.department,
            pillar: v.pillar,
            category: v.category,
            score: avg,
            response_count: count,
            is_suppressed: suppressed,
          })
          if (!suppressed && avg !== null && avg < actionThr && v.department === null) {
            lowScoreCategories.push({ pillar: v.pillar, category: v.category, score: avg })
          }
        }

        if (toInsert.length > 0) {
          const { error: insErr } = await supabase.from('survey_results_cache').insert(toInsert)
          if (insErr) throw insErr
        }

        for (const ls of lowScoreCategories) {
          const { data: existing } = await supabase
            .from('survey_action_plans')
            .select('id')
            .eq('campaign_id', campaignId)
            .eq('category', ls.category)
            .maybeSingle()
          if (!existing) {
            await supabase.from('survey_action_plans').insert({
              campaign_id: campaignId,
              pillar: ls.pillar,
              category: ls.category,
              score: ls.score,
              trigger_threshold: actionThr,
              title: `Handlingsplan: ${ls.category}`,
              description: `Automatisk opprettet. Score ${ls.score}/100 er under terskel ${actionThr}. Kilde: organisasjonsundersøkelse.`,
              status: 'open',
            })
          }
        }

        await loadCampaign(campaignId)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke beregne resultater.')
      } finally {
        setLoading(false)
      }
    },
    [supabase, selectedCampaign, loadCampaign],
  )

  const updateActionPlan = useCallback(
    async (planId: string, patch: Partial<SurveyActionPlanRow>) => {
      if (!supabase) return
      try {
        const update =
          patch.status === 'closed'
            ? { ...patch, closed_at: patch.closed_at ?? new Date().toISOString() }
            : patch
        const { error: e } = await supabase.from('survey_action_plans').update(update).eq('id', planId)
        if (e) throw e
        setActionPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, ...update } : p)))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke oppdatere handlingsplan.')
      }
    },
    [supabase],
  )

  const upsertAmuReview = useCallback(
    async (campaignId: string, patch: Partial<SurveyAmuReviewRow>) => {
      if (!supabase) return
      try {
        const current = amuReview
        if (current) {
          const { error: e } = await supabase.from('survey_amu_reviews').update(patch).eq('id', current.id)
          if (e) throw e
          setAmuReview((prev) => (prev ? { ...prev, ...patch } : prev))
        } else {
          const { data, error: e } = await supabase
            .from('survey_amu_reviews')
            .insert({ campaign_id: campaignId, ...patch })
            .select()
            .single()
          if (e) throw e
          setAmuReview(parseAmuReview(data))
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke lagre AMU-gjennomgang.')
      }
    },
    [supabase, amuReview],
  )

  const refreshAmuReview = useCallback(
    async (reviewId: string) => {
      if (!supabase) return
      const { data, error: e } = await supabase.from('survey_amu_reviews').select('*').eq('id', reviewId).single()
      if (!e && data) setAmuReview(parseAmuReview(data))
    },
    [supabase],
  )

  const signAmuChair = useCallback(
    async (reviewId: string, name: string) => {
      if (!supabase) return
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Ikke innlogget.')
        return
      }
      try {
        const patch = {
          amu_chair_signed_at: new Date().toISOString(),
          amu_chair_signed_by: user.id,
          amu_chair_name: name,
        }
        const { error: e } = await supabase.from('survey_amu_reviews').update(patch).eq('id', reviewId)
        if (e) throw e
        await refreshAmuReview(reviewId)
        const { data: row } = await supabase.from('survey_amu_reviews').select('*').eq('id', reviewId).single()
        const parsed = parseAmuReview(row)
        if (parsed?.vo_signed_at) {
          await supabase.from('survey_amu_reviews').update({ status: 'signed' }).eq('id', reviewId)
          await refreshAmuReview(reviewId)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Signering feilet.')
      }
    },
    [supabase, refreshAmuReview],
  )

  const signVo = useCallback(
    async (reviewId: string, name: string) => {
      if (!supabase) return
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Ikke innlogget.')
        return
      }
      try {
        const patch = { vo_signed_at: new Date().toISOString(), vo_signed_by: user.id, vo_name: name }
        const { error: e } = await supabase.from('survey_amu_reviews').update(patch).eq('id', reviewId)
        if (e) throw e
        await refreshAmuReview(reviewId)
        const { data: row } = await supabase.from('survey_amu_reviews').select('*').eq('id', reviewId).single()
        const parsed = parseAmuReview(row)
        if (parsed?.amu_chair_signed_at) {
          await supabase.from('survey_amu_reviews').update({ status: 'signed' }).eq('id', reviewId)
          await refreshAmuReview(reviewId)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Signering feilet.')
      }
    },
    [supabase, refreshAmuReview],
  )

  return {
    loading,
    error,
    campaigns,
    questions,
    results,
    actionPlans,
    amuReview,
    selectedCampaign,
    respondentCount,
    loadList,
    loadCampaign,
    createCampaign,
    updateCampaign,
    openCampaign,
    closeCampaign,
    upsertQuestion,
    deleteQuestion,
    seedQpsNordic,
    computeResults,
    updateActionPlan,
    signAmuChair,
    signVo,
    upsertAmuReview,
    clearError,
  }
}
