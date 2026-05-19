// Hook for the Studio workflow template editor.
//
// Entry modes:
//   ruleId='new'               → blank template
//   ruleId='new' + fromId      → fork from workflow_rule_catalog (system) or workflow_rules (org)
//   ruleId=<uuid>              → edit an existing org-owned template (is_template=true)
//
// Writes to workflow_rules with is_template=true.
// System catalog rows (workflow_rule_catalog) are read-only — fork only.
// Auto-saves to workflow_rules with a 2 s debounce; publishTemplate flushes immediately.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { freshId } from '../../../src/lib/dashboards/freshId'
import {
  compileWorkflowFlow,
  defaultWorkflowFlowDocument,
  parseFlowDocument,
  type WorkflowFlowDocument,
} from '../../../src/lib/workflowFlowTypes'
import {
  isGovernmentActionType,
  type WorkflowAction,
  type WorkflowConfidentialityLevel,
  type WorkflowRuleCatalogRow,
  type WorkflowRuleRow,
  type WorkflowRuleStudioRevisionRow,
  type WorkflowTriggerType,
  type WorkflowXorActionsEnvelope,
} from '../../../src/types/workflow'

const AUTOSAVE_DELAY_MS = 2000

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveContainsGovAction(
  actionsJson: WorkflowAction[] | WorkflowXorActionsEnvelope,
): boolean {
  if (Array.isArray(actionsJson)) {
    return actionsJson.some((a) => isGovernmentActionType((a as { type: string }).type))
  }
  return actionsJson.branches.some((b) =>
    b.actions.some((a) => isGovernmentActionType((a as { type: string }).type)),
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type WorkflowTemplateStudioHook = ReturnType<typeof useWorkflowTemplateStudio>

export function useWorkflowTemplateStudio(ruleId: string, fromId?: string) {
  const { supabase, organization } = useOrgSetupContext()

  // ── Template metadata ──────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sourceModule, setSourceModule] = useState('compliance_checklist')
  const [triggerEventName, setTriggerEventName] = useState<string | null>(null)
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>('db_event')
  const [triggerOn, setTriggerOn] = useState<'insert' | 'update' | 'both'>('both')
  const [lawRefs, setLawRefs] = useState<string[]>([])
  const [frameworks, setFrameworks] = useState<string[]>([])
  const [pack, setPack] = useState<string | null>(null)
  const [cadenceHint, setCadenceHint] = useState('')
  const [confidentialityLevel, setConfidentialityLevel] =
    useState<WorkflowConfidentialityLevel>('standard')
  const [flowDoc, setFlowDoc] = useState<WorkflowFlowDocument>(defaultWorkflowFlowDocument)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [runtimeEnvironment, setRuntimeEnvironment] = useState<'test' | 'prod'>('test')

  // ── Load / save state ──────────────────────────────────────────────────────
  const [isSystemTemplate, setIsSystemTemplate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [rowId, setRowId] = useState<string | null>(ruleId === 'new' ? null : ruleId)

  const rowIdRef = useRef<string | null>(ruleId === 'new' ? null : ruleId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const revisionNumberRef = useRef(0)

  const [revisions, setRevisions] = useState<WorkflowRuleStudioRevisionRow[]>([])
  const [revisionsLoading, setRevisionsLoading] = useState(false)

  // Stale-closure-safe refs for persist
  const flowDocRef = useRef<WorkflowFlowDocument>(flowDoc)
  const metaRef = useRef({
    name,
    description,
    sourceModule,
    triggerEventName,
    triggerType,
    triggerOn,
    lawRefs,
    frameworks,
    pack,
    cadenceHint,
    confidentialityLevel,
  })

  // ─── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase || !organization?.id) return

    if (ruleId === 'new' && !fromId) {
      setLoading(false)
      return
    }

    setLoading(true)
    const isFork = ruleId === 'new' && !!fromId

    if (isFork) {
      // Try catalog first (by id), fall back to org template
      void supabase
        .from('workflow_rule_catalog')
        .select('*')
        .eq('id', fromId!)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const row = data as WorkflowRuleCatalogRow
            setName(`${row.name_i18n?.nb ?? ''} (kopi)`)
            setDescription(
              typeof row.description_i18n === 'object' && 'nb' in row.description_i18n
                ? (row.description_i18n as { nb: string }).nb
                : '',
            )
            setSourceModule(row.source_module)
            setTriggerEventName(row.trigger_event_name ?? null)
            setTriggerType(row.trigger_type)
            setTriggerOn(row.trigger_on)
            setLawRefs(row.law_refs ?? [])
            setFrameworks(row.frameworks ?? [])
            setPack(row.pack ?? null)
            setCadenceHint(row.cadence_hint ?? '')
            setConfidentialityLevel(row.confidentiality_level)
            const parsed = row.flow_graph_json
              ? parseFlowDocument(row.flow_graph_json)
              : null
            setFlowDoc(parsed ?? defaultWorkflowFlowDocument())
            setIsSystemTemplate(false)
            setLoading(false)
            return
          }
          // Fall back: fork from org template
          void supabase
            .from('workflow_rules')
            .select('*')
            .eq('id', fromId!)
            .eq('organization_id', organization.id)
            .maybeSingle()
            .then(({ data: orgData, error }) => {
              if (error || !orgData) {
                setLoadError(error?.message ?? 'Fant ikke malen.')
              } else {
                applyOrgRuleToState(orgData as WorkflowRuleRow, true)
              }
              setLoading(false)
            })
        })
      return
    }

    // Edit existing org template — fall back to catalog (read-only view)
    void supabase
      .from('workflow_rules')
      .select('*')
      .eq('id', ruleId)
      .eq('organization_id', organization.id)
      .maybeSingle()
      .then(({ data, error: orgError }) => {
        if (data) {
          applyOrgRuleToState(data as WorkflowRuleRow, false)
          rowIdRef.current = ruleId
          setRowId(ruleId)
          setLoading(false)
          return
        }
        // Not found in org rules — try system catalog (read-only view)
        void supabase
          .from('workflow_rule_catalog')
          .select('*')
          .eq('id', ruleId)
          .maybeSingle()
          .then(({ data: catData, error: catError }) => {
            if (catData) {
              const row = catData as WorkflowRuleCatalogRow
              setName(row.name_i18n?.nb ?? '')
              setDescription(
                typeof row.description_i18n === 'object' && 'nb' in row.description_i18n
                  ? (row.description_i18n as { nb: string }).nb
                  : '',
              )
              setSourceModule(row.source_module)
              setTriggerEventName(row.trigger_event_name ?? null)
              setTriggerType(row.trigger_type)
              setTriggerOn(row.trigger_on)
              setLawRefs(row.law_refs ?? [])
              setFrameworks(row.frameworks ?? [])
              setPack(row.pack ?? null)
              setCadenceHint(row.cadence_hint ?? '')
              setConfidentialityLevel(row.confidentiality_level)
              const parsed = row.flow_graph_json ? parseFlowDocument(row.flow_graph_json) : null
              setFlowDoc(parsed ?? defaultWorkflowFlowDocument())
              setIsSystemTemplate(true)
            } else {
              setLoadError(orgError?.message ?? catError?.message ?? 'Fant ikke malen.')
            }
            setLoading(false)
          })
      })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, organization?.id, ruleId, fromId])

  function applyOrgRuleToState(row: WorkflowRuleRow, isCopy: boolean) {
    setName(isCopy ? `${row.name} (kopi)` : row.name)
    setDescription(row.description ?? '')
    setSourceModule(row.source_module)
    setTriggerEventName(row.trigger_event_name ?? null)
    setTriggerType(row.trigger_type ?? 'db_event')
    setTriggerOn(row.trigger_on)
    setLawRefs(row.law_refs ?? [])
    setFrameworks(row.frameworks ?? [])
    setPack(row.pack ?? null)
    setCadenceHint(row.cadence_hint ?? '')
    setConfidentialityLevel(row.confidentiality_level ?? 'standard')
    setRuntimeEnvironment((row.runtime_environment as 'test' | 'prod' | undefined) === 'prod' ? 'prod' : 'test')
    const parsed = row.flow_graph_json ? parseFlowDocument(row.flow_graph_json) : null
    setFlowDoc(parsed ?? defaultWorkflowFlowDocument())
    setIsSystemTemplate(false)
    // Seed the revision counter so new snapshots continue from the current max
    if (!isCopy) {
      void supabase!
        .from('workflow_rule_revisions')
        .select('revision_number')
        .eq('rule_id', row.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          revisionNumberRef.current = (data as { revision_number: number } | null)?.revision_number ?? 0
        })
    }
  }

  // ─── Sync refs ────────────────────────────────────────────────────────────

  useEffect(() => { flowDocRef.current = flowDoc }, [flowDoc])
  useEffect(() => {
    metaRef.current = {
      name,
      description,
      sourceModule,
      triggerEventName,
      triggerType,
      triggerOn,
      lawRefs,
      frameworks,
      pack,
      cadenceHint,
      confidentialityLevel,
    }
  }, [name, description, sourceModule, triggerEventName, triggerType, triggerOn, lawRefs, frameworks, pack, cadenceHint, confidentialityLevel])
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // Recompute compile error whenever flow doc changes
  useEffect(() => {
    const result = compileWorkflowFlow(flowDoc)
    setCompileError('error' in result ? result.error : null)
  }, [flowDoc])

  // ─── Save ─────────────────────────────────────────────────────────────────

  const persist = useCallback(
    async (publishNow = false) => {
      if (!supabase) return
      if (!organization?.id) {
        setSaveError('Organisasjonsdata mangler – prøv igjen.')
        setSaveStatus('error')
        return
      }
      if (isSystemTemplate) return
      if (savingRef.current) return

      // Compile flow → DB payload; abort on error
      const compiled = compileWorkflowFlow(flowDocRef.current)
      if ('error' in compiled) {
        // Don't treat a transient flow-in-progress compile error as a hard save failure
        // unless the user explicitly publishes
        if (publishNow) {
          setSaveError(compiled.error)
          setSaveStatus('error')
        }
        return
      }

      savingRef.current = true
      setSaveStatus('saving')
      setSaveError(null)

      const { condition_json, actions_json } = compiled
      const {
        name: n,
        description: desc,
        sourceModule: sm,
        triggerEventName: ten,
        triggerType: tt,
        triggerOn: to,
        lawRefs: lr,
        frameworks: fw,
        pack: pk,
        cadenceHint: ch,
        confidentialityLevel: cl,
      } = metaRef.current

      const containsGov = deriveContainsGovAction(actions_json)

      try {
        if (!rowIdRef.current) {
          const newId = freshId('wfl')
          const newSlug = freshId('wfl-s')
          const { error } = await supabase.from('workflow_rules').insert({
            id: newId,
            organization_id: organization.id,
            slug: newSlug,
            name: n.trim() || 'Ny arbeidsflyt-mal',
            description: desc || '',
            source_module: sm,
            trigger_on: to,
            trigger_type: tt,
            trigger_event_name: ten ?? null,
            is_template: true,
            is_active: publishNow,
            condition_json,
            actions_json,
            flow_graph_json: flowDocRef.current,
            law_refs: lr,
            frameworks: fw,
            pack: pk || null,
            cadence_hint: ch || null,
            confidentiality_level: cl,
            priority: 0,
            runtime_environment: 'test',
          })
          if (error) throw error
          rowIdRef.current = newId
          setRowId(newId)
        } else {
          const updatePayload: Record<string, unknown> = {
            name: n.trim() || 'Ny arbeidsflyt-mal',
            description: desc || '',
            source_module: sm,
            trigger_on: to,
            trigger_type: tt,
            trigger_event_name: ten ?? null,
            condition_json,
            actions_json,
            flow_graph_json: flowDocRef.current,
            law_refs: lr,
            frameworks: fw,
            pack: pk || null,
            cadence_hint: ch || null,
            confidentiality_level: cl,
            updated_at: new Date().toISOString(),
          }
          if (publishNow) updatePayload.is_active = true
          const { error } = await supabase
            .from('workflow_rules')
            .update(updatePayload)
            .eq('id', rowIdRef.current)
            .eq('organization_id', organization.id)
            .eq('is_template', true)
          if (error) throw error
        }

        setSaveStatus('saved')
        setLastSavedAt(new Date())
        void containsGov // consumed by derived field — no separate column in workflow_rules

        // Append revision snapshot (best-effort; failure does not block save)
        const targetId = rowIdRef.current
        if (targetId) {
          revisionNumberRef.current += 1
          void supabase.from('workflow_rule_revisions').insert({
            rule_id: targetId,
            organization_id: organization.id,
            revision_number: revisionNumberRef.current,
            name: n.trim() || 'Ny arbeidsflyt-mal',
            description: desc || '',
            source_module: sm,
            trigger_event_name: ten ?? null,
            actions_json,
            flow_doc: flowDocRef.current as unknown as Record<string, unknown>,
            law_refs: lr,
            frameworks: fw,
            pack: pk || null,
            cadence_hint: ch || null,
          } as Record<string, unknown>)
        }
      } catch (err) {
        console.error('[useWorkflowTemplateStudio] persist failed', err)
        const msg = err instanceof Error ? err.message : 'Ukjent feil ved lagring'
        setSaveStatus('error')
        setSaveError(msg)
      } finally {
        savingRef.current = false
      }
    },
    [supabase, organization?.id, isSystemTemplate],
  )

  const scheduleSave = useCallback(() => {
    if (savingRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void persist(false), AUTOSAVE_DELAY_MS)
    setSaveStatus('idle')
  }, [persist])

  const publishTemplate = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    await persist(true)
  }, [persist])

  // ─── Setters that schedule save ───────────────────────────────────────────

  const updateName = useCallback((v: string) => { setName(v); scheduleSave() }, [scheduleSave])
  const updateDescription = useCallback((v: string) => { setDescription(v); scheduleSave() }, [scheduleSave])
  const updateSourceModule = useCallback((v: string) => {
    setSourceModule(v)
    setTriggerEventName(null) // reset event when module changes
    scheduleSave()
  }, [scheduleSave])
  const updateTriggerEventName = useCallback((v: string | null) => { setTriggerEventName(v); scheduleSave() }, [scheduleSave])
  const updateTriggerType = useCallback((v: WorkflowTriggerType) => { setTriggerType(v); scheduleSave() }, [scheduleSave])
  const updateTriggerOn = useCallback((v: 'insert' | 'update' | 'both') => { setTriggerOn(v); scheduleSave() }, [scheduleSave])
  const updateFlowDoc = useCallback((doc: WorkflowFlowDocument) => { setFlowDoc(doc); scheduleSave() }, [scheduleSave])
  const updateLawRefs = useCallback((refs: string[]) => { setLawRefs(refs); scheduleSave() }, [scheduleSave])
  const updateFrameworks = useCallback((fw: string[]) => { setFrameworks(fw); scheduleSave() }, [scheduleSave])
  const updatePack = useCallback((v: string | null) => { setPack(v); scheduleSave() }, [scheduleSave])
  const updateCadenceHint = useCallback((v: string) => { setCadenceHint(v); scheduleSave() }, [scheduleSave])
  const updateConfidentialityLevel = useCallback((v: WorkflowConfidentialityLevel) => { setConfidentialityLevel(v); scheduleSave() }, [scheduleSave])

  const fetchRevisions = useCallback(async () => {
    if (!supabase || !organization?.id || !rowIdRef.current) return
    setRevisionsLoading(true)
    const { data } = await supabase
      .from('workflow_rule_revisions')
      .select('*')
      .eq('rule_id', rowIdRef.current)
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setRevisions((data ?? []) as WorkflowRuleStudioRevisionRow[])
    setRevisionsLoading(false)
  }, [supabase, organization?.id])

  // Promote a published gov-action template from TT02 sandbox to Altinn prod.
  // Requires workflows.activate_external. Guarded in the UI by a typed confirmation.
  const upgradeToProduction = useCallback(async (): Promise<boolean> => {
    if (!supabase || !organization?.id || !rowIdRef.current || isSystemTemplate) return false
    const { error } = await supabase
      .from('workflow_rules')
      .update({ runtime_environment: 'prod' } as Record<string, unknown>)
      .eq('id', rowIdRef.current)
      .eq('organization_id', organization.id)
      .eq('is_template', true)
    if (error) return false
    setRuntimeEnvironment('prod')
    return true
  }, [supabase, organization?.id, isSystemTemplate])

  return {
    // state
    name,
    description,
    sourceModule,
    triggerEventName,
    triggerType,
    triggerOn,
    flowDoc,
    compileError,
    runtimeEnvironment,
    lawRefs,
    frameworks,
    pack,
    cadenceHint,
    confidentialityLevel,
    isSystemTemplate,
    loading,
    loadError,
    saveStatus,
    saveError,
    lastSavedAt,
    rowId,
    // setters
    updateName,
    updateDescription,
    updateSourceModule,
    updateTriggerEventName,
    updateTriggerType,
    updateTriggerOn,
    updateFlowDoc,
    updateLawRefs,
    updateFrameworks,
    updatePack,
    updateCadenceHint,
    updateConfidentialityLevel,
    publishTemplate,
    upgradeToProduction,
    revisions,
    revisionsLoading,
    fetchRevisions,
  }
}
