import { useCallback, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type {
  SurveyAmuReviewRow,
  SurveyActionPlanRow,
  SurveyPillar,
  SurveyActionPlanStatus,
} from './types'
import { parseSurveyAmuReviewRow, parseSurveyActionPlanRow } from './types'

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
}

export function useSurveyAmuAndActions({ supabase, assertOrg, requireManage, setError }: Params) {
  const [amuReview, setAmuReview] = useState<SurveyAmuReviewRow | null>(null)
  const [actionPlans, setActionPlans] = useState<SurveyActionPlanRow[]>([])

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
    [supabase, assertOrg, setError],
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
    [supabase, assertOrg, setError],
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
          .upsert({ survey_id: surveyId, organization_id: oid, ...patch }, { onConflict: 'survey_id' })
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
    [supabase, assertOrg, requireManage, setError],
  )

  const signAmuChair = useCallback(
    async (reviewId: string): Promise<boolean> => {
      if (!supabase) return false
      const oid = assertOrg()
      if (!oid) return false
      setError(null)
      try {
        const { data, error: e } = await supabase.rpc('survey_amu_review_sign_as_chair', {
          p_review_id: reviewId,
        })
        if (e) throw e
        const raw = Array.isArray(data) ? data[0] : data
        const p = parseSurveyAmuReviewRow(raw)
        if (p.success) setAmuReview(p.data)
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, assertOrg, setError],
  )

  const signVo = useCallback(
    async (reviewId: string): Promise<boolean> => {
      if (!supabase) return false
      const oid = assertOrg()
      if (!oid) return false
      setError(null)
      try {
        const { data, error: e } = await supabase.rpc('survey_amu_review_sign_as_vo', {
          p_review_id: reviewId,
        })
        if (e) throw e
        const raw = Array.isArray(data) ? data[0] : data
        const p = parseSurveyAmuReviewRow(raw)
        if (p.success) setAmuReview(p.data)
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, assertOrg, setError],
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
    [supabase, assertOrg, requireManage, setError],
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
    [supabase, assertOrg, requireManage, setError],
  )

  const clearAmuState = useCallback(() => {
    setAmuReview(null)
    setActionPlans([])
  }, [])

  return {
    amuReview,
    actionPlans,
    clearAmuState,
    setAmuReview,
    setActionPlans,
    loadAmuReview,
    loadActionPlans,
    upsertAmuReview,
    signAmuChair,
    signVo,
    upsertActionPlan,
    updateActionPlanStatus,
  }
}
