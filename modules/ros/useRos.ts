import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type {
  RosAnalysisRow, RosHazardRow, RosMeasureRow,
  RosParticipantRow, RosSignatureRow,
} from './types'
import { riskScore } from './types'
import type { RosLawDomain, RosType } from './types'

export type RosState = ReturnType<typeof useRos>

export function useRos({ supabase }: { supabase: SupabaseClient | null }) {
  const { organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('ros.manage')

  const [analyses,     setAnalyses]     = useState<RosAnalysisRow[]>([])
  const [hazardsByRos, setHazardsByRos] = useState<Record<string, RosHazardRow[]>>({})
  const [measuresByRos,setMeasuresByRos]= useState<Record<string, RosMeasureRow[]>>({})
  const [participants, setParticipants] = useState<Record<string, RosParticipantRow[]>>({})
  const [signatures,   setSignatures]   = useState<Record<string, RosSignatureRow[]>>({})
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // ── Load list ─────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true); setError(null)
    try {
      const { data, error: e } = await supabase
        .from('ros_analyses')
        .select('*')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (e) throw e
      setAnalyses((data ?? []) as RosAnalysisRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => { void loadList() }, [loadList])

  // ── Load detail for one analysis ─────────────────────────────────────────
  const loadDetail = useCallback(async (rosId: string) => {
    if (!supabase) return
    try {
      const [aRes, hRes, mRes, pRes, sRes] = await Promise.all([
        supabase.from('ros_analyses').select('*').eq('id', rosId).maybeSingle(),
        supabase.from('ros_hazards').select('*').eq('ros_id', rosId).order('position'),
        supabase.from('ros_measures').select('*').eq('ros_id', rosId).order('position'),
        supabase.from('ros_participants').select('*').eq('ros_id', rosId),
        supabase.from('ros_signatures').select('*').eq('ros_id', rosId),
      ])
      if (aRes.error) throw aRes.error
      if (hRes.error) throw hRes.error
      if (mRes.error) throw mRes.error
      if (pRes.error) throw pRes.error
      if (sRes.error) throw sRes.error
      if (aRes.data) {
        const row = aRes.data as RosAnalysisRow
        setAnalyses((prev) => {
          const i = prev.findIndex((a) => a.id === row.id)
          if (i < 0) return [row, ...prev]
          const next = [...prev]
          next[i] = row
          return next
        })
      }
      setHazardsByRos((p) => ({ ...p, [rosId]: (hRes.data ?? []) as RosHazardRow[] }))
      setMeasuresByRos((p) => ({ ...p, [rosId]: (mRes.data ?? []) as RosMeasureRow[] }))
      setParticipants((p) => ({ ...p, [rosId]: (pRes.data ?? []) as RosParticipantRow[] }))
      setSignatures((p) => ({ ...p, [rosId]: (sRes.data ?? []) as RosSignatureRow[] }))
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    }
  }, [supabase])

  // ── Create analysis ───────────────────────────────────────────────────────
  const createAnalysis = useCallback(async (input: {
    title: string; ros_type: RosType; law_domains: RosLawDomain[]
    description?: string; scope?: string; assessor_name?: string
  }) => {
    if (!supabase || !orgId || !canManage) return null
    try {
      const { data, error: e } = await supabase
        .from('ros_analyses')
        .insert({ ...input, organization_id: orgId })
        .select()
        .single()
      if (e) throw e
      await loadList()
      return (data as RosAnalysisRow).id
    } catch (err) {
      setError(getSupabaseErrorMessage(err)); return null
    }
  }, [supabase, orgId, canManage, loadList])

  // ── Update analysis ───────────────────────────────────────────────────────
  const updateAnalysis = useCallback(async (id: string, patch: Partial<RosAnalysisRow>) => {
    if (!supabase || !canManage) return
    try {
      const { error: e } = await supabase.from('ros_analyses').update(patch).eq('id', id)
      if (e) throw e
      setAnalyses((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a))
    } catch (err) { setError(getSupabaseErrorMessage(err)) }
  }, [supabase, canManage])

  // ── Upsert hazard ─────────────────────────────────────────────────────────
  const upsertHazard = useCallback(async (rosId: string, hazard: Partial<RosHazardRow> & { description: string; law_domain: string }) => {
    if (!supabase || !orgId || !canManage) return null
    try {
      const payload = { ...hazard, ros_id: rosId, organization_id: orgId }
      const { data, error: e } = hazard.id
        ? await supabase.from('ros_hazards').update(payload).eq('id', hazard.id).select().single()
        : await supabase.from('ros_hazards').insert(payload).select().single()
      if (e) throw e
      await loadDetail(rosId)
      // Auto-create action plan if residual risk ≥ 15
      const score = riskScore(hazard.residual_probability ?? null, hazard.residual_consequence ?? null)
      if (score != null && score >= 15 && !hazard.action_plan_id) {
        const { data: ap } = await supabase.from('ik_action_plans').insert({
          organization_id: orgId,
          title: `ROS: ${hazard.description}`,
          source: 'ros',
          source_id: (data as RosHazardRow).id,
          priority: 'critical',
          law_pillar: hazard.law_domain,
        }).select().single()
        if (ap) {
          await supabase.from('ros_hazards').update({ action_plan_id: ap.id }).eq('id', (data as RosHazardRow).id)
          await loadDetail(rosId)
        }
      }
      return (data as RosHazardRow)
    } catch (err) { setError(getSupabaseErrorMessage(err)); return null }
  }, [supabase, orgId, canManage, loadDetail])

  // ── Delete hazard ─────────────────────────────────────────────────────────
  const deleteHazard = useCallback(async (rosId: string, hazardId: string) => {
    if (!supabase || !canManage) return
    try {
      const { error: e } = await supabase.from('ros_hazards').delete().eq('id', hazardId)
      if (e) throw e
      await loadDetail(rosId)
    } catch (err) { setError(getSupabaseErrorMessage(err)) }
  }, [supabase, canManage, loadDetail])

  // ── Upsert measure ────────────────────────────────────────────────────────
  const upsertMeasure = useCallback(async (rosId: string, hazardId: string, measure: Partial<RosMeasureRow> & { description: string }) => {
    if (!supabase || !orgId || !canManage) return
    try {
      const payload = { ...measure, ros_id: rosId, hazard_id: hazardId, organization_id: orgId }
      const { error: e } = measure.id
        ? await supabase.from('ros_measures').update(payload).eq('id', measure.id)
        : await supabase.from('ros_measures').insert(payload)
      if (e) throw e
      await loadDetail(rosId)
    } catch (err) { setError(getSupabaseErrorMessage(err)) }
  }, [supabase, orgId, canManage, loadDetail])

  // ── Sign ──────────────────────────────────────────────────────────────────
  const signAnalysis = useCallback(async (rosId: string, role: 'responsible' | 'verneombud', signerName: string) => {
    if (!supabase) return false
    try {
      const { error: e } = await supabase.from('ros_signatures').insert({ ros_id: rosId, role, signer_name: signerName })
      if (e) throw e
      // Check if both required signatures are present → approve
      const { data: sigs } = await supabase.from('ros_signatures').select('role').eq('ros_id', rosId)
      const roles = (sigs ?? []).map((s: { role: string }) => s.role)
      if (roles.includes('responsible') && roles.includes('verneombud')) {
        await supabase.from('ros_analyses').update({ status: 'approved' }).eq('id', rosId)
        await loadList()
      }
      await loadDetail(rosId)
      return true
    } catch (err) { setError(getSupabaseErrorMessage(err)); return false }
  }, [supabase, loadList, loadDetail])

  return {
    analyses, hazardsByRos, measuresByRos, participants, signatures,
    loading, error, canManage,
    loadList, loadDetail, createAnalysis, updateAnalysis,
    upsertHazard, deleteHazard, upsertMeasure, signAnalysis,
  }
}
