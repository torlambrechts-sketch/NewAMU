import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type {
  RosAnalysisRow,
  RosConsequenceCategoryRow,
  RosHazardCategoryRow,
  RosHazardRow,
  RosMeasureRow,
  RosModuleSettingsRow,
  RosParticipantRow,
  RosProbabilityScaleLevelRow,
  RosSignatureRow,
  RosLawDomain,
  RosType,
} from './types'
import { riskScore } from './types'
import {
  parseRosAnalysisRow,
  parseRosConsequenceCategoryRow,
  parseRosHazardCategoryRow,
  parseRosHazardRow,
  parseRosMeasureRow,
  parseRosParticipantRow,
  parseRosProbabilityScaleLevelRow,
  parseRosSignatureRow,
  parseRosModuleSettingsRow,
  parseRosTemplateRow,
} from './schema'
import type { ParsedRosTemplateRow } from './schema'

export type RosState = ReturnType<typeof useRos>

function collectParsed<T>(rows: unknown[] | null | undefined, parse: (raw: unknown) => { success: boolean; data?: T }): T[] {
  const out: T[] = []
  for (const raw of rows ?? []) {
    const r = parse(raw)
    if (r.success && r.data !== undefined) out.push(r.data)
  }
  return out
}

function isRosImmutableStatus(status: RosAnalysisRow['status']): boolean {
  return status === 'approved' || status === 'archived'
}

export function useRos({ supabase }: { supabase: SupabaseClient | null }) {
  const { organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('ros.manage')

  const [analyses, setAnalyses] = useState<RosAnalysisRow[]>([])
  const [hazardsByRos, setHazardsByRos] = useState<Record<string, RosHazardRow[]>>({})
  const [measuresByRos, setMeasuresByRos] = useState<Record<string, RosMeasureRow[]>>({})
  const [participants, setParticipants] = useState<Record<string, RosParticipantRow[]>>({})
  const [signatures, setSignatures] = useState<Record<string, RosSignatureRow[]>>({})

  const [probabilityScale, setProbabilityScale] = useState<RosProbabilityScaleLevelRow[]>([])
  const [consequenceCategories, setConsequenceCategories] = useState<RosConsequenceCategoryRow[]>([])
  const [hazardCategories, setHazardCategories] = useState<RosHazardCategoryRow[]>([])
  const [templates, setTemplates] = useState<ParsedRosTemplateRow[]>([])
  const [moduleSettings, setModuleSettings] = useState<RosModuleSettingsRow | null>(null)

  const [loading, setLoading] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Farekilder med risikoskår ≥ 15 (residual, ellers initial) i organisasjonen */
  const [criticalHazardCount, setCriticalHazardCount] = useState(0)

  const setClientError = useCallback((msg: string | null) => {
    setError(msg)
  }, [])

  const loadRosSettings = useCallback(async () => {
    if (!supabase || !orgId) return
    setSettingsLoading(true)
    setError(null)
    try {
      const [pRes, cRes, hRes, tRes, mRes] = await Promise.all([
        supabase
          .from('ros_probability_scale_levels')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('sort_order', { ascending: true }),
        supabase
          .from('ros_consequence_categories')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('sort_order', { ascending: true }),
        supabase
          .from('ros_hazard_categories')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('sort_order', { ascending: true }),
        supabase
          .from('ros_templates')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false }),
        supabase.from('ros_module_settings').select('*').eq('organization_id', orgId).maybeSingle(),
      ])
      if (pRes.error) throw pRes.error
      if (cRes.error) throw cRes.error
      if (hRes.error) throw hRes.error
      if (tRes.error) throw tRes.error
      if (mRes.error) throw mRes.error

      const parsedSettings = mRes.data ? parseRosModuleSettingsRow(mRes.data) : null
      setModuleSettings(parsedSettings?.success ? parsedSettings.data : null)

      setProbabilityScale(collectParsed(pRes.data, parseRosProbabilityScaleLevelRow))
      setConsequenceCategories(collectParsed(cRes.data, parseRosConsequenceCategoryRow))
      setHazardCategories(collectParsed(hRes.data, parseRosHazardCategoryRow))
      const tplRows: ParsedRosTemplateRow[] = []
      for (const raw of tRes.data ?? []) {
        const parsed = parseRosTemplateRow(raw)
        if (parsed) tplRows.push(parsed)
      }
      setTemplates(tplRows)
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setSettingsLoading(false)
    }
  }, [supabase, orgId])

  const loadList = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('ros_analyses')
        .select('*')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (e) throw e
      setAnalyses(collectParsed(data, parseRosAnalysisRow))

      const { data: hz, error: hzErr } = await supabase
        .from('ros_hazards')
        .select('residual_probability, residual_consequence, initial_probability, initial_consequence')
        .eq('organization_id', orgId)
      if (hzErr) throw hzErr
      let crit = 0
      for (const row of hz ?? []) {
        const r = row as {
          residual_probability: number | null
          residual_consequence: number | null
          initial_probability: number | null
          initial_consequence: number | null
        }
        const s =
          riskScore(r.residual_probability, r.residual_consequence) ??
          riskScore(r.initial_probability, r.initial_consequence)
        if (s != null && s >= 15) crit++
      }
      setCriticalHazardCount(crit)
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    void loadRosSettings()
  }, [loadRosSettings])

  const loadDetail = useCallback(
    async (rosId: string) => {
      if (!supabase || !orgId) return
      setError(null)
      try {
        const [aRes, hRes, mRes, pRes, sRes] = await Promise.all([
          supabase
            .from('ros_analyses')
            .select('*')
            .eq('id', rosId)
            .eq('organization_id', orgId)
            .maybeSingle(),
          supabase.from('ros_hazards').select('*').eq('ros_id', rosId).eq('organization_id', orgId).order('position'),
          supabase.from('ros_measures').select('*').eq('ros_id', rosId).eq('organization_id', orgId).order('position'),
          supabase.from('ros_participants').select('*').eq('ros_id', rosId),
          supabase.from('ros_signatures').select('*').eq('ros_id', rosId),
        ])
        if (aRes.error) throw aRes.error
        if (hRes.error) throw hRes.error
        if (mRes.error) throw mRes.error
        if (pRes.error) throw pRes.error
        if (sRes.error) throw sRes.error

        if (aRes.data) {
          const parsed = parseRosAnalysisRow(aRes.data)
          if (!parsed.success) throw new Error('Ugyldig ROS-data fra databasen')
          const row = parsed.data
          setAnalyses((prev) => {
            const i = prev.findIndex((a) => a.id === row.id)
            if (i < 0) return [row, ...prev]
            const next = [...prev]
            next[i] = row
            return next
          })
        }
        setHazardsByRos((p) => ({ ...p, [rosId]: collectParsed(hRes.data, parseRosHazardRow) }))
        setMeasuresByRos((p) => ({ ...p, [rosId]: collectParsed(mRes.data, parseRosMeasureRow) }))
        setParticipants((p) => ({ ...p, [rosId]: collectParsed(pRes.data, parseRosParticipantRow) }))
        setSignatures((p) => ({ ...p, [rosId]: collectParsed(sRes.data, parseRosSignatureRow) }))
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId],
  )

  const assertMutable = useCallback((analysisId: string) => {
    const a = analyses.find((x) => x.id === analysisId)
    if (!a) throw new Error('Fant ikke analysen')
    if (isRosImmutableStatus(a.status)) {
      throw new Error('Analysen er låst (signert eller godkjent) og kan ikke endres.')
    }
  }, [analyses])

  const createAnalysis = useCallback(
    async (input: {
      title: string
      ros_type: RosType
      law_domains: RosLawDomain[]
      description?: string
      scope?: string
      assessor_name?: string
    }) => {
      if (!supabase || !orgId || !canManage) return null
      setError(null)
      try {
        const { data, error: e } = await supabase
          .from('ros_analyses')
          .insert({ ...input, organization_id: orgId })
          .select()
          .single()
        if (e) throw e
        const parsed = parseRosAnalysisRow(data)
        if (!parsed.success) throw new Error('Ugyldig svar ved opprettelse av ROS')
        await loadList()
        return parsed.data.id
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage, loadList],
  )

  const updateAnalysis = useCallback(
    async (id: string, patch: Partial<RosAnalysisRow>) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        assertMutable(id)
        const { error: e } = await supabase
          .from('ros_analyses')
          .update(patch)
          .eq('id', id)
          .eq('organization_id', orgId)
        if (e) throw e
        setAnalyses((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, assertMutable],
  )

  const upsertHazard = useCallback(
    async (
      rosId: string,
      hazard: Partial<RosHazardRow> & { description: string; law_domain: string },
    ) => {
      if (!supabase || !orgId || !canManage) return null
      setError(null)
      try {
        assertMutable(rosId)
        const payload = { ...hazard, ros_id: rosId, organization_id: orgId }
        const { data, error: e } = hazard.id
          ? await supabase
              .from('ros_hazards')
              .update(payload)
              .eq('id', hazard.id)
              .eq('organization_id', orgId)
              .select()
              .single()
          : await supabase.from('ros_hazards').insert(payload).select().single()
        if (e) throw e
        const parsed = parseRosHazardRow(data)
        if (!parsed.success) throw new Error('Ugyldig farekilde-data')
        await loadDetail(rosId)
        const score = riskScore(hazard.residual_probability ?? null, hazard.residual_consequence ?? null)
        if (score != null && score >= 15 && !hazard.action_plan_id) {
          const { data: ap, error: apErr } = await supabase
            .from('ik_action_plans')
            .insert({
              organization_id: orgId,
              title: `ROS: ${hazard.description}`,
              source: 'ros',
              source_id: parsed.data.id,
              priority: 'critical',
              law_pillar: hazard.law_domain,
            })
            .select()
            .single()
          if (apErr) throw apErr
          if (ap) {
            await supabase
              .from('ros_hazards')
              .update({ action_plan_id: ap.id })
              .eq('id', parsed.data.id)
              .eq('organization_id', orgId)
            await loadDetail(rosId)
          }
        }
        return parsed.data
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage, assertMutable, loadDetail],
  )

  const deleteHazard = useCallback(
    async (rosId: string, hazardId: string) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        assertMutable(rosId)
        const { error: e } = await supabase
          .from('ros_hazards')
          .delete()
          .eq('id', hazardId)
          .eq('organization_id', orgId)
        if (e) throw e
        await loadDetail(rosId)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, assertMutable, loadDetail],
  )

  const upsertMeasure = useCallback(
    async (rosId: string, hazardId: string, measure: Partial<RosMeasureRow> & { description: string }) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        assertMutable(rosId)
        const payload = { ...measure, ros_id: rosId, hazard_id: hazardId, organization_id: orgId }
        const { error: e } = measure.id
          ? await supabase
              .from('ros_measures')
              .update(payload)
              .eq('id', measure.id)
              .eq('organization_id', orgId)
          : await supabase.from('ros_measures').insert(payload)
        if (e) throw e
        await loadDetail(rosId)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, assertMutable, loadDetail],
  )

  const deleteMeasure = useCallback(
    async (rosId: string, measureId: string) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        assertMutable(rosId)
        const { error: e } = await supabase.from('ros_measures').delete().eq('id', measureId).eq('organization_id', orgId)
        if (e) throw e
        await loadDetail(rosId)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, assertMutable, loadDetail],
  )

  const updateMeasure = useCallback(
    async (rosId: string, measureId: string, updates: Partial<RosMeasureRow>) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        const analysisRow = analyses.find((a) => a.id === rosId)
        if (!analysisRow) throw new Error('Fant ikke analysen')
        const status = analysisRow.status as string
        if (status === 'signed' || status === 'approved') {
          throw new Error('Analysen er signert eller godkjent og kan ikke endres.')
        }
        assertMutable(rosId)

        const patch: Record<string, unknown> = {}
        const skip = new Set(['id', 'ros_id', 'organization_id', 'created_at', 'updated_at'])
        for (const [key, val] of Object.entries(updates)) {
          if (skip.has(key)) continue
          if (val === undefined) continue
          patch[key] = val
        }
        if (Object.keys(patch).length === 0) return

        const { error: e } = await supabase
          .from('ros_measures')
          .update(patch)
          .eq('id', measureId)
          .eq('organization_id', orgId)
        if (e) throw e
        await loadDetail(rosId)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, analyses, assertMutable, loadDetail],
  )

  const signAnalysis = useCallback(
    async (rosId: string, role: 'responsible' | 'verneombud', signerName: string) => {
      if (!supabase || !orgId) return false
      setError(null)
      try {
        const analysis = analyses.find((a) => a.id === rosId)
        if (analysis && isRosImmutableStatus(analysis.status)) {
          throw new Error('Analysen er allerede låst.')
        }
        const { error: e } = await supabase.from('ros_signatures').insert({ ros_id: rosId, role, signer_name: signerName })
        if (e) throw e
        await loadList()
        await loadDetail(rosId)
        return true
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return false
      }
    },
    [supabase, orgId, analyses, loadList, loadDetail],
  )

  // ── Settings CRUD (admin) ──────────────────────────────────────────────────

  const upsertProbabilityLevel = useCallback(
    async (row: Partial<RosProbabilityScaleLevelRow> & { level: number; label: string }) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        const payload = {
          ...row,
          organization_id: orgId,
        }
        const { error: e } = row.id
          ? await supabase
              .from('ros_probability_scale_levels')
              .update(payload)
              .eq('id', row.id)
              .eq('organization_id', orgId)
          : await supabase.from('ros_probability_scale_levels').insert(payload)
        if (e) throw e
        await loadRosSettings()
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, loadRosSettings],
  )

  const softDeleteProbabilityLevel = useCallback(
    async (id: string) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        const { error: e } = await supabase
          .from('ros_probability_scale_levels')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('organization_id', orgId)
        if (e) throw e
        await loadRosSettings()
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, loadRosSettings],
  )

  const upsertConsequenceCategory = useCallback(
    async (row: Partial<RosConsequenceCategoryRow> & { code: string; label: string; matrix_column: number }) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        const payload = { ...row, organization_id: orgId }
        const { error: e } = row.id
          ? await supabase
              .from('ros_consequence_categories')
              .update(payload)
              .eq('id', row.id)
              .eq('organization_id', orgId)
          : await supabase.from('ros_consequence_categories').insert(payload)
        if (e) throw e
        await loadRosSettings()
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, loadRosSettings],
  )

  const softDeleteConsequenceCategory = useCallback(
    async (id: string) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        const { error: e } = await supabase
          .from('ros_consequence_categories')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('organization_id', orgId)
        if (e) throw e
        await loadRosSettings()
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, loadRosSettings],
  )

  const upsertHazardCategory = useCallback(
    async (row: Partial<RosHazardCategoryRow> & { code: string; label: string }) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        const payload = { ...row, organization_id: orgId }
        const { error: e } = row.id
          ? await supabase
              .from('ros_hazard_categories')
              .update(payload)
              .eq('id', row.id)
              .eq('organization_id', orgId)
          : await supabase.from('ros_hazard_categories').insert(payload)
        if (e) throw e
        await loadRosSettings()
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, loadRosSettings],
  )

  const softDeleteHazardCategory = useCallback(
    async (id: string) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        const { error: e } = await supabase
          .from('ros_hazard_categories')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('organization_id', orgId)
        if (e) throw e
        await loadRosSettings()
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, loadRosSettings],
  )

  const upsertTemplate = useCallback(
    async (row: { id?: string; name: string; definition: ParsedRosTemplateRow['definition']; is_active?: boolean }) => {
      if (!supabase || !orgId || !canManage) return null
      setError(null)
      try {
        const payload = {
          name: row.name,
          definition: row.definition,
          is_active: row.is_active ?? true,
          organization_id: orgId,
        }
        if (row.id) {
          const { error: e } = await supabase.from('ros_templates').update(payload).eq('id', row.id).eq('organization_id', orgId)
          if (e) throw e
          await loadRosSettings()
          return row.id
        }
        const { data, error: e } = await supabase.from('ros_templates').insert(payload).select('id').single()
        if (e) throw e
        await loadRosSettings()
        return (data as { id: string }).id
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return null
      }
    },
    [supabase, orgId, canManage, loadRosSettings],
  )

  const applyTemplateToAnalysis = useCallback(
    async (rosId: string, templateId: string) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        assertMutable(rosId)
        const tpl = templates.find((t) => t.id === templateId)
        if (!tpl?.definition?.hazard_stubs?.length) return
        for (let i = 0; i < tpl.definition.hazard_stubs.length; i++) {
          const stub = tpl.definition.hazard_stubs[i]!
          const { error: e } = await supabase.from('ros_hazards').insert({
            ros_id: rosId,
            organization_id: orgId,
            description: stub.description,
            category: stub.category_code,
            law_domain: stub.law_domain,
            existing_controls: stub.existing_controls ?? null,
            position: i,
          })
          if (e) throw e
        }
        await loadDetail(rosId)
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, templates, assertMutable, loadDetail],
  )

  const updateRosModuleSettings = useCallback(
    async (patch: Partial<Pick<RosModuleSettingsRow, 'require_dual_signature' | 'default_matrix_size'>>) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        const { error: e } = await supabase
          .from('ros_module_settings')
          .upsert(
            { organization_id: orgId, ...patch, updated_at: new Date().toISOString() },
            { onConflict: 'organization_id' },
          )
        if (e) throw e
        await loadRosSettings()
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, loadRosSettings],
  )

  const softDeleteTemplate = useCallback(
    async (id: string) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      try {
        const { error: e } = await supabase
          .from('ros_templates')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id)
          .eq('organization_id', orgId)
        if (e) throw e
        await loadRosSettings()
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
      }
    },
    [supabase, orgId, canManage, loadRosSettings],
  )

  return {
    analyses,
    criticalHazardCount,
    hazardsByRos,
    measuresByRos,
    participants,
    signatures,
    probabilityScale,
    consequenceCategories,
    hazardCategories,
    moduleSettings,
    templates,
    loading,
    settingsLoading,
    error,
    setClientError,
    canManage,
    loadList,
    loadDetail,
    loadRosSettings,
    createAnalysis,
    updateAnalysis,
    upsertHazard,
    deleteHazard,
    upsertMeasure,
    updateMeasure,
    deleteMeasure,
    signAnalysis,
    upsertProbabilityLevel,
    softDeleteProbabilityLevel,
    upsertConsequenceCategory,
    softDeleteConsequenceCategory,
    upsertHazardCategory,
    softDeleteHazardCategory,
    upsertTemplate,
    softDeleteTemplate,
    applyTemplateToAnalysis,
    updateRosModuleSettings,
    /** Admin aliases (same backing as upsert/softDelete*) */
    addHazardCategory: upsertHazardCategory,
    deleteHazardCategory: softDeleteHazardCategory,
    addConsequenceCategory: upsertConsequenceCategory,
    deleteConsequenceCategory: softDeleteConsequenceCategory,
    addTemplate: upsertTemplate,
    deleteTemplate: softDeleteTemplate,
  }
}
