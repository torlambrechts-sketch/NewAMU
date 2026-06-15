/* Data hook for Strategy Tools — Assessments. Persists per-org diagnostic runs
   (strategy_assessment_runs), team campaigns (strategy_assessment_campaigns) and
   their per-respondent responses (strategy_assessment_responses). The diagnostic
   library + scoring is static config (assessmentDefs); only outcomes are stored. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import type {
  AssessmentCampaign,
  AssessmentResult,
  AssessmentRun,
  CampaignRespondent,
  RespondentStatus,
  RunMode,
} from '../types/strategyTools'

type DbRun = {
  id: string
  organization_id: string
  assessment_id: string
  name: string
  mode: string
  composite: number
  result: AssessmentResult | null
  created_at: string
}
type DbCampaign = {
  id: string
  organization_id: string
  assessment_id: string
  title: string
  owner_user_id: string | null
  owner_name: string | null
  message: string | null
  due_date: string | null
  created_at: string
}
type DbResponse = {
  id: string
  campaign_id: string
  respondent_user_id: string | null
  respondent_name: string | null
  status: string
  result: AssessmentResult | null
  completed_at: string | null
}

function mapRun(r: DbRun): AssessmentRun {
  return {
    id: String(r.id),
    organizationId: r.organization_id,
    assessmentId: r.assessment_id,
    name: r.name,
    ts: r.created_at,
    mode: (r.mode as RunMode) || 'self',
    composite: r.composite,
    result: r.result ?? { composite: r.composite, dims: [] },
  }
}

export type UseStrategyAssessmentsReturn = {
  loading: boolean
  error: string | null
  results: Record<string, AssessmentRun[]>
  campaigns: AssessmentCampaign[]
  reload: () => void
  complete: (aid: string, name: string, mode: RunMode, composite: number, result: AssessmentResult) => Promise<void>
  renameRun: (aid: string, runId: string, name: string) => Promise<void>
  deleteRun: (aid: string, runId: string) => Promise<void>
  launchCampaign: (
    aid: string, title: string, ownerId: string, ownerName: string, msg: string, due: string,
    respondents: Array<{ pid: string; name: string }>,
  ) => Promise<string | null>
  recordResp: (campaignId: string, pid: string, name: string, result: AssessmentResult) => Promise<void>
  deleteCampaign: (id: string) => Promise<void>
}

export function useStrategyAssessments(): UseStrategyAssessmentsReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [results, setResults] = useState<Record<string, AssessmentRun[]>>({})
  const [campaigns, setCampaigns] = useState<AssessmentCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase || !orgId) { setLoading(false); return }
      setLoading(true)
      setError(null)
      try {
        const [runRes, campRes, respRes] = await Promise.all([
          supabase.from('strategy_assessment_runs').select('*').order('created_at', { ascending: false }),
          supabase.from('strategy_assessment_campaigns').select('*').order('created_at', { ascending: false }),
          supabase.from('strategy_assessment_responses').select('*'),
        ])
        if (cancelled) return
        if (runRes.error) throw runRes.error
        if (campRes.error) throw campRes.error
        const byAid: Record<string, AssessmentRun[]> = {}
        for (const r of (runRes.data as DbRun[] | null) || []) {
          ;(byAid[r.assessment_id] ||= []).push(mapRun(r))
        }
        const respByCampaign: Record<string, CampaignRespondent[]> = {}
        for (const r of (respRes.data as DbResponse[] | null) || []) {
          ;(respByCampaign[r.campaign_id] ||= []).push({
            pid: r.respondent_user_id ?? r.id,
            name: r.respondent_name ?? undefined,
            status: (r.status as RespondentStatus) || 'sent',
            result: r.result ?? null,
            ts: r.completed_at,
          })
        }
        const camps = ((campRes.data as DbCampaign[] | null) || []).map<AssessmentCampaign>((c) => ({
          id: String(c.id),
          organizationId: c.organization_id,
          aid: c.assessment_id,
          title: c.title,
          owner: c.owner_user_id ?? '',
          ts: c.created_at,
          due: c.due_date ?? '',
          msg: c.message ?? '',
          respondents: respByCampaign[c.id] || [],
        }))
        setResults(byAid)
        setCampaigns(camps)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste vurderinger.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [supabase, orgId, tick])

  const complete = useCallback<UseStrategyAssessmentsReturn['complete']>(
    async (aid, name, mode, composite, result) => {
      if (!supabase || !orgId) return
      const { data, error: insErr } = await supabase
        .from('strategy_assessment_runs')
        .insert({ organization_id: orgId, assessment_id: aid, name, mode, composite, result })
        .select('*')
        .single()
      if (insErr || !data) { setError(insErr?.message ?? 'Kunne ikke lagre resultat.'); return }
      const run = mapRun(data as DbRun)
      setResults((p) => ({ ...p, [aid]: [run, ...(p[aid] || [])] }))
    },
    [supabase, orgId],
  )

  const renameRun = useCallback<UseStrategyAssessmentsReturn['renameRun']>(
    async (aid, runId, name) => {
      setResults((p) => ({ ...p, [aid]: (p[aid] || []).map((r) => (r.id === runId ? { ...r, name } : r)) }))
      if (!supabase) return
      const { error: upErr } = await supabase.from('strategy_assessment_runs').update({ name }).eq('id', runId)
      if (upErr) setError(upErr.message)
    },
    [supabase],
  )

  const deleteRun = useCallback<UseStrategyAssessmentsReturn['deleteRun']>(
    async (aid, runId) => {
      setResults((p) => ({ ...p, [aid]: (p[aid] || []).filter((r) => r.id !== runId) }))
      if (!supabase) return
      const { error: delErr } = await supabase.from('strategy_assessment_runs').delete().eq('id', runId)
      if (delErr) { setError(delErr.message); reload() }
    },
    [supabase, reload],
  )

  const launchCampaign = useCallback<UseStrategyAssessmentsReturn['launchCampaign']>(
    async (aid, title, ownerId, ownerName, msg, due, respondents) => {
      if (!supabase || !orgId) return null
      const { data, error: insErr } = await supabase
        .from('strategy_assessment_campaigns')
        .insert({
          organization_id: orgId,
          assessment_id: aid,
          title,
          owner_user_id: ownerId || null,
          owner_name: ownerName || null,
          message: msg,
          due_date: due || null,
        })
        .select('*')
        .single()
      if (insErr || !data) { setError(insErr?.message ?? 'Kunne ikke sende kampanje.'); return null }
      const camp = data as DbCampaign
      const rows = respondents.map((r) => ({
        organization_id: orgId,
        campaign_id: camp.id,
        respondent_user_id: r.pid || null,
        respondent_name: r.name,
        status: 'sent' as RespondentStatus,
      }))
      const { error: respErr } = await supabase.from('strategy_assessment_responses').insert(rows)
      if (respErr) setError(respErr.message)
      const newCamp: AssessmentCampaign = {
        id: String(camp.id),
        organizationId: orgId,
        aid,
        title,
        owner: ownerId,
        ts: camp.created_at,
        due,
        msg,
        respondents: respondents.map((r) => ({ pid: r.pid, name: r.name, status: 'sent', result: null, ts: null })),
      }
      setCampaigns((cs) => [newCamp, ...cs])
      return String(camp.id)
    },
    [supabase, orgId],
  )

  const recordResp = useCallback<UseStrategyAssessmentsReturn['recordResp']>(
    async (campaignId, pid, name, result) => {
      const now = new Date().toISOString()
      setCampaigns((cs) =>
        cs.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                respondents: c.respondents.map((r) =>
                  r.pid === pid ? { ...r, status: 'done', result, ts: now } : r,
                ),
              }
            : c,
        ),
      )
      if (!supabase) return
      const { error: upErr } = await supabase
        .from('strategy_assessment_responses')
        .update({ status: 'done', result, completed_at: now, respondent_name: name })
        .eq('campaign_id', campaignId)
        .eq('respondent_user_id', pid)
      if (upErr) { setError(upErr.message); reload() }
    },
    [supabase, reload],
  )

  const deleteCampaign = useCallback<UseStrategyAssessmentsReturn['deleteCampaign']>(
    async (id) => {
      setCampaigns((cs) => cs.filter((c) => c.id !== id))
      if (!supabase) return
      const { error: delErr } = await supabase.from('strategy_assessment_campaigns').delete().eq('id', id)
      if (delErr) { setError(delErr.message); reload() }
    },
    [supabase, reload],
  )

  return useMemo(
    () => ({ loading, error, results, campaigns, reload, complete, renameRun, deleteRun, launchCampaign, recordResp, deleteCampaign }),
    [loading, error, results, campaigns, reload, complete, renameRun, deleteRun, launchCampaign, recordResp, deleteCampaign],
  )
}
