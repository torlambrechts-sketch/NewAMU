/* Data hook for Strategy Tools — framework analyses + whiteboard boards and
   their version snapshots, persisted per-org in strategy_tool_analyses /
   strategy_tool_versions. Mirrors the usePlanningOkr pattern: load on mount,
   optimistic local state, snake_case column mapping. Content edits (typing in
   a cell) are debounced before they hit the DB so a guided walkthrough doesn't
   spam writes. Examples are seeded once via provision_strategy_tools_baseline_for_org. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { toolContent } from '../pages/strategy-tools/frameworkSchemas'
import type {
  FwKind,
  SectionData,
  ToolAnalysis,
  ToolContent,
  ToolStatus,
  ToolVersion,
  WbElement,
} from '../types/strategyTools'

type DbAnalysis = {
  id: string
  organization_id: string
  fw: string
  title: string
  owner_user_id: string | null
  owner_name: string | null
  status: string
  content: ToolContent | null
  created_at: string
}
type DbVersion = {
  id: string
  analysis_id: string
  label: string
  note: string | null
  by_user_id: string | null
  by_name: string | null
  point_count: string | null
  content: ToolContent | null
  created_at: string
}

function mapVersion(v: DbVersion): ToolVersion {
  return {
    id: String(v.id),
    label: v.label,
    note: v.note ?? '',
    by: v.by_user_id ?? '',
    byName: v.by_name ?? undefined,
    ts: v.created_at,
    count: v.point_count ?? '',
    content: v.content ?? {},
  }
}
function mapAnalysis(row: DbAnalysis, versions: ToolVersion[]): ToolAnalysis {
  const c = row.content ?? {}
  return {
    id: String(row.id),
    organizationId: row.organization_id,
    fw: row.fw as FwKind,
    title: row.title,
    owner: row.owner_user_id ?? '',
    ownerName: row.owner_name ?? undefined,
    status: (row.status as ToolStatus) || 'draft',
    created: row.created_at,
    sections: (c.sections as Record<string, SectionData>) || {},
    elements: (c.elements as WbElement[]) || undefined,
    versions,
  }
}

export type UseStrategyToolAnalysesReturn = {
  loading: boolean
  error: string | null
  analyses: ToolAnalysis[]
  reload: () => void
  create: (fw: FwKind, title: string, ownerId: string, ownerName: string, content: ToolContent) => Promise<ToolAnalysis | null>
  update: (analysis: ToolAnalysis) => void
  remove: (id: string) => Promise<void>
  duplicate: (src: ToolAnalysis, ownerId: string, ownerName: string) => Promise<ToolAnalysis | null>
  saveVersion: (analysisId: string, label: string, note: string, byId: string, byName: string, count: string, content: ToolContent) => Promise<void>
  restoreVersion: (analysisId: string, content: ToolContent) => Promise<void>
  renameVersion: (analysisId: string, versionId: string, label: string) => Promise<void>
  deleteVersion: (analysisId: string, versionId: string) => Promise<void>
}

export function useStrategyToolAnalyses(): UseStrategyToolAnalysesReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [analyses, setAnalyses] = useState<ToolAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase || !orgId) { setLoading(false); return }
      setLoading(true)
      setError(null)
      try {
        // Seed worked examples once (idempotent).
        await supabase.rpc('provision_strategy_tools_baseline_for_org', { p_org_id: orgId })
        const [anRes, verRes] = await Promise.all([
          supabase
            .from('strategy_tool_analyses')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase
            .from('strategy_tool_versions')
            .select('*')
            .order('created_at', { ascending: true }),
        ])
        if (cancelled) return
        if (anRes.error) throw anRes.error
        const versionsByAnalysis: Record<string, ToolVersion[]> = {}
        for (const v of (verRes.data as DbVersion[] | null) || []) {
          ;(versionsByAnalysis[v.analysis_id] ||= []).push(mapVersion(v))
        }
        const rows = (anRes.data as DbAnalysis[] | null) || []
        setAnalyses(rows.map((r) => mapAnalysis(r, versionsByAnalysis[r.id] || [])))
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste strategiverktøy.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [supabase, orgId, tick])

  const create = useCallback<UseStrategyToolAnalysesReturn['create']>(
    async (fw, title, ownerId, ownerName, content) => {
      if (!supabase || !orgId) return null
      const { data, error: insErr } = await supabase
        .from('strategy_tool_analyses')
        .insert({
          organization_id: orgId,
          fw,
          title,
          owner_user_id: ownerId || null,
          owner_name: ownerName || null,
          status: 'draft',
          content,
        })
        .select('*')
        .single()
      if (insErr || !data) { setError(insErr?.message ?? 'Kunne ikke opprette verktøy.'); return null }
      const a = mapAnalysis(data as DbAnalysis, [])
      setAnalyses((arr) => [a, ...arr])
      return a
    },
    [supabase, orgId],
  )

  // Optimistic local update + debounced DB persist of title/owner/content.
  const update = useCallback<UseStrategyToolAnalysesReturn['update']>(
    (analysis) => {
      setAnalyses((arr) => arr.map((x) => (x.id === analysis.id ? analysis : x)))
      if (!supabase) return
      clearTimeout(debounceTimers.current[analysis.id])
      debounceTimers.current[analysis.id] = setTimeout(() => {
        void supabase
          .from('strategy_tool_analyses')
          .update({
            title: analysis.title,
            owner_user_id: analysis.owner || null,
            owner_name: analysis.ownerName || null,
            status: analysis.status,
            content: toolContent(analysis),
          })
          .eq('id', analysis.id)
          .then(({ error: upErr }) => { if (upErr) setError(upErr.message) })
      }, 600)
    },
    [supabase],
  )

  const remove = useCallback<UseStrategyToolAnalysesReturn['remove']>(
    async (id) => {
      if (!supabase) return
      setAnalyses((arr) => arr.filter((x) => x.id !== id))
      const { error: delErr } = await supabase
        .from('strategy_tool_analyses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (delErr) { setError(delErr.message); reload() }
    },
    [supabase, reload],
  )

  const duplicate = useCallback<UseStrategyToolAnalysesReturn['duplicate']>(
    async (src, ownerId, ownerName) => {
      const title = src.title.replace(/ \(copy\)$/, '') + ' (copy)'
      return create(src.fw, title, ownerId || src.owner, ownerName || src.ownerName || '', toolContent(src))
    },
    [create],
  )

  const saveVersion = useCallback<UseStrategyToolAnalysesReturn['saveVersion']>(
    async (analysisId, label, note, byId, byName, count, content) => {
      if (!supabase || !orgId) return
      const { data, error: insErr } = await supabase
        .from('strategy_tool_versions')
        .insert({
          organization_id: orgId,
          analysis_id: analysisId,
          label,
          note,
          by_user_id: byId || null,
          by_name: byName || null,
          point_count: count,
          content,
        })
        .select('*')
        .single()
      if (insErr || !data) { setError(insErr?.message ?? 'Kunne ikke lagre versjon.'); return }
      const v = mapVersion(data as DbVersion)
      setAnalyses((arr) => arr.map((x) => (x.id === analysisId ? { ...x, versions: [...x.versions, v] } : x)))
    },
    [supabase, orgId],
  )

  const restoreVersion = useCallback<UseStrategyToolAnalysesReturn['restoreVersion']>(
    async (analysisId, content) => {
      setAnalyses((arr) =>
        arr.map((x) =>
          x.id === analysisId
            ? { ...x, sections: (content.sections as Record<string, SectionData>) || {}, elements: content.elements }
            : x,
        ),
      )
      if (!supabase) return
      const { error: upErr } = await supabase.from('strategy_tool_analyses').update({ content }).eq('id', analysisId)
      if (upErr) { setError(upErr.message); reload() }
    },
    [supabase, reload],
  )

  const renameVersion = useCallback<UseStrategyToolAnalysesReturn['renameVersion']>(
    async (analysisId, versionId, label) => {
      setAnalyses((arr) =>
        arr.map((x) =>
          x.id === analysisId ? { ...x, versions: x.versions.map((v) => (v.id === versionId ? { ...v, label } : v)) } : x,
        ),
      )
      if (!supabase) return
      const { error: upErr } = await supabase.from('strategy_tool_versions').update({ label }).eq('id', versionId)
      if (upErr) setError(upErr.message)
    },
    [supabase],
  )

  const deleteVersion = useCallback<UseStrategyToolAnalysesReturn['deleteVersion']>(
    async (analysisId, versionId) => {
      setAnalyses((arr) =>
        arr.map((x) => (x.id === analysisId ? { ...x, versions: x.versions.filter((v) => v.id !== versionId) } : x)),
      )
      if (!supabase) return
      const { error: delErr } = await supabase.from('strategy_tool_versions').delete().eq('id', versionId)
      if (delErr) { setError(delErr.message); reload() }
    },
    [supabase, reload],
  )

  return useMemo(
    () => ({ loading, error, analyses, reload, create, update, remove, duplicate, saveVersion, restoreVersion, renameVersion, deleteVersion }),
    [loading, error, analyses, reload, create, update, remove, duplicate, saveVersion, restoreVersion, renameVersion, deleteVersion],
  )
}
