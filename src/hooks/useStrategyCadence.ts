/* Data hook for Strategy v2 — Cadence (check-ins, nudges, reviews, decision log).
   Loads the signal-layer cadence tables (RLS-scoped) + the key mutators the
   Cadence workspace needs. Mirrors the established optimistic pattern. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type CheckinStatus = 'on' | 'risk' | 'off' | 'done'
export type StrategyCheckin = {
  id: string
  initiativeId: string | null
  who: string
  status: CheckinStatus
  confidence: number
  note: string
  checkedAt: string
}
export type NudgeStatus = 'PENDING' | 'SENT' | 'ACTIONED' | 'SNOOZED' | 'DISMISSED'
export type StrategyNudge = {
  id: string
  nudgeType: string
  priority: 'NORMAL' | 'PRIORITY' | 'CRITICAL'
  channel: string
  status: NudgeStatus
  subjectKind: string
  subjectId: string | null
  title: string
  rationale: string
  importance: number
  createdAt: string
}
export type DecisionType = 'decision' | 'milestone' | 'risk' | 'update' | 'edit'
export type DecisionEntry = {
  id: string
  date: string
  who: string
  type: DecisionType
  initiativeId: string | null
  title: string
  detail: string
}
export type ReviewType = 'weekly' | 'mbr' | 'qbr' | 'one_on_one'
export type ReviewItem = { id: string; kind: 'decision' | 'action'; text: string; who: string }
export type StrategyReview = {
  id: string
  reviewType: ReviewType
  title: string
  heldAt: string
  facilitator: string
  subject: string
  mood: number | null
  notes: string
  items: ReviewItem[]
}

export type UseStrategyCadenceReturn = {
  loading: boolean
  error: string | null
  checkins: StrategyCheckin[]
  nudges: StrategyNudge[]
  decisions: DecisionEntry[]
  reviews: StrategyReview[]
  reload: () => void
  createCheckin: (initiativeId: string, status: CheckinStatus, confidence: number, note: string, whoName: string) => Promise<void>
  updateNudge: (id: string, status: NudgeStatus) => Promise<void>
  postDecision: (e: { type: DecisionType; title: string; detail: string; whoName: string; initiativeId?: string | null }) => Promise<void>
  createReview: (input: { reviewType: ReviewType; title: string; facilitatorName: string; subjectName?: string; mood?: number | null; notes?: string }) => Promise<string | null>
  addReviewItem: (reviewId: string, kind: 'decision' | 'action', text: string, whoName: string) => Promise<void>
  deleteReview: (id: string) => Promise<void>
}

export function useStrategyCadence(): UseStrategyCadenceReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [checkins, setCheckins] = useState<StrategyCheckin[]>([])
  const [nudges, setNudges] = useState<StrategyNudge[]>([])
  const [decisions, setDecisions] = useState<DecisionEntry[]>([])
  const [reviews, setReviews] = useState<StrategyReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase || !orgId) { setLoading(false); return }
      setLoading(true); setError(null)
      try {
        await supabase.rpc('provision_strategy_signal_for_org', { p_org_id: orgId })
        const [ciRes, nuRes, deRes, rvRes, riRes] = await Promise.all([
          supabase.from('strategy_checkins').select('*').order('checked_at', { ascending: false }),
          supabase.from('strategy_nudges').select('*').order('created_at', { ascending: false }),
          supabase.from('strategy_decision_log').select('*').order('entry_date', { ascending: false }),
          supabase.from('strategy_reviews').select('*').order('held_at', { ascending: false }),
          supabase.from('strategy_review_items').select('*'),
        ])
        if (cancelled) return
        for (const res of [ciRes, nuRes, deRes, rvRes, riRes]) if (res.error) throw res.error
        setCheckins(((ciRes.data as Record<string, unknown>[] | null) || []).map((r) => ({
          id: String(r.id), initiativeId: (r.initiative_id as string) ?? null, who: (r.who_name as string) ?? '',
          status: (r.status as CheckinStatus) || 'on', confidence: (r.confidence as number) ?? 3,
          note: (r.note as string) ?? '', checkedAt: r.checked_at as string,
        })))
        setNudges(((nuRes.data as Record<string, unknown>[] | null) || []).map((r) => ({
          id: String(r.id), nudgeType: (r.nudge_type as string) ?? '', priority: (r.priority as StrategyNudge['priority']) || 'NORMAL',
          channel: (r.channel as string) ?? 'IN_APP', status: (r.status as NudgeStatus) || 'PENDING',
          subjectKind: (r.subject_kind as string) ?? '', subjectId: (r.subject_id as string) ?? null,
          title: (r.title as string) ?? '', rationale: (r.rationale as string) ?? '', importance: Number(r.importance ?? 0.5),
          createdAt: r.created_at as string,
        })))
        setDecisions(((deRes.data as Record<string, unknown>[] | null) || []).map((r) => ({
          id: String(r.id), date: r.entry_date as string, who: (r.who_name as string) ?? '',
          type: (r.entry_type as DecisionType) || 'decision', initiativeId: (r.initiative_id as string) ?? null,
          title: (r.title as string) ?? '', detail: (r.detail as string) ?? '',
        })))
        const itemsByReview: Record<string, ReviewItem[]> = {}
        for (const r of (riRes.data as Record<string, unknown>[] | null) || []) {
          ;(itemsByReview[r.review_id as string] ||= []).push({
            id: String(r.id), kind: (r.kind as 'decision' | 'action') || 'action', text: (r.text as string) ?? '', who: (r.who_name as string) ?? '',
          })
        }
        setReviews(((rvRes.data as Record<string, unknown>[] | null) || []).map((r) => ({
          id: String(r.id), reviewType: (r.review_type as ReviewType) || 'weekly', title: (r.title as string) ?? '',
          heldAt: r.held_at as string, facilitator: (r.facilitator_name as string) ?? '', subject: (r.subject_name as string) ?? '',
          mood: (r.mood as number) ?? null, notes: (r.notes as string) ?? '', items: itemsByReview[String(r.id)] || [],
        })))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste kadens.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [supabase, orgId, tick])

  const createCheckin = useCallback<UseStrategyCadenceReturn['createCheckin']>(
    async (initiativeId, status, confidence, note, whoName) => {
      if (!supabase || !orgId) return
      const { data, error: e } = await supabase.from('strategy_checkins')
        .insert({ organization_id: orgId, initiative_id: initiativeId, who_name: whoName, status, confidence, note })
        .select('*').single()
      if (e || !data) { setError(e?.message ?? 'Kunne ikke lagre innsjekk.'); return }
      const d = data as Record<string, unknown>
      setCheckins((arr) => [{ id: String(d.id), initiativeId, who: whoName, status, confidence, note, checkedAt: d.checked_at as string }, ...arr])
    },
    [supabase, orgId],
  )

  const updateNudge = useCallback<UseStrategyCadenceReturn['updateNudge']>(
    async (id, status) => {
      setNudges((arr) => arr.map((n) => (n.id === id ? { ...n, status } : n)))
      if (!supabase) return
      const { error: e } = await supabase.from('strategy_nudges').update({ status }).eq('id', id)
      if (e) { setError(e.message); reload() }
    },
    [supabase, reload],
  )

  const postDecision = useCallback<UseStrategyCadenceReturn['postDecision']>(
    async (entry) => {
      if (!supabase || !orgId) return
      const { data, error: e } = await supabase.from('strategy_decision_log')
        .insert({ organization_id: orgId, entry_type: entry.type, title: entry.title, detail: entry.detail, who_name: entry.whoName, initiative_id: entry.initiativeId ?? null })
        .select('*').single()
      if (e || !data) { setError(e?.message ?? 'Kunne ikke lagre beslutning.'); return }
      const d = data as Record<string, unknown>
      setDecisions((arr) => [{ id: String(d.id), date: d.entry_date as string, who: entry.whoName, type: entry.type, initiativeId: entry.initiativeId ?? null, title: entry.title, detail: entry.detail }, ...arr])
    },
    [supabase, orgId],
  )

  const createReview = useCallback<UseStrategyCadenceReturn['createReview']>(
    async (input) => {
      if (!supabase || !orgId) return null
      const { data, error: e } = await supabase.from('strategy_reviews')
        .insert({ organization_id: orgId, review_type: input.reviewType, title: input.title, facilitator_name: input.facilitatorName, subject_name: input.subjectName ?? null, mood: input.mood ?? null, notes: input.notes ?? '' })
        .select('*').single()
      if (e || !data) { setError(e?.message ?? 'Kunne ikke opprette gjennomgang.'); return null }
      const d = data as Record<string, unknown>
      setReviews((arr) => [{ id: String(d.id), reviewType: input.reviewType, title: input.title, heldAt: d.held_at as string, facilitator: input.facilitatorName, subject: input.subjectName ?? '', mood: input.mood ?? null, notes: input.notes ?? '', items: [] }, ...arr])
      return String(d.id)
    },
    [supabase, orgId],
  )

  const addReviewItem = useCallback<UseStrategyCadenceReturn['addReviewItem']>(
    async (reviewId, kind, text, whoName) => {
      if (!supabase || !orgId) return
      const { data, error: e } = await supabase.from('strategy_review_items')
        .insert({ organization_id: orgId, review_id: reviewId, kind, text, who_name: whoName })
        .select('*').single()
      if (e || !data) { setError(e?.message ?? 'Kunne ikke lagre punkt.'); return }
      const d = data as Record<string, unknown>
      setReviews((arr) => arr.map((rv) => (rv.id === reviewId ? { ...rv, items: [...rv.items, { id: String(d.id), kind, text, who: whoName }] } : rv)))
    },
    [supabase, orgId],
  )

  const deleteReview = useCallback<UseStrategyCadenceReturn['deleteReview']>(
    async (id) => {
      setReviews((arr) => arr.filter((r) => r.id !== id))
      if (!supabase) return
      const { error: e } = await supabase.from('strategy_reviews').delete().eq('id', id)
      if (e) { setError(e.message); reload() }
    },
    [supabase, reload],
  )

  return useMemo(
    () => ({ loading, error, checkins, nudges, decisions, reviews, reload, createCheckin, updateNudge, postDecision, createReview, addReviewItem, deleteReview }),
    [loading, error, checkins, nudges, decisions, reviews, reload, createCheckin, updateNudge, postDecision, createReview, addReviewItem, deleteReview],
  )
}
