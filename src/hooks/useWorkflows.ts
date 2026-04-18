import { useCallback, useEffect, useState } from 'react'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { useOrgSetupContext } from './useOrgSetupContext'
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowRuleRow,
  WorkflowRunRow,
  WorkflowXorActionsEnvelope,
} from '../types/workflow'

export function useWorkflows() {
  const { supabase, organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('workflows.manage')

  const [rules, setRules] = useState<WorkflowRuleRow[]>([])
  const [runs, setRuns] = useState<WorkflowRunRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshRules = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('workflow_rules')
        .select('*')
        .eq('organization_id', orgId)
        .order('priority', { ascending: false })
        .order('name')
      if (e) throw e
      setRules((data ?? []) as WorkflowRuleRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  const refreshRuns = useCallback(async () => {
    if (!supabase || !orgId) return
    try {
      const { data, error: e } = await supabase
        .from('workflow_runs')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(80)
      if (e) throw e
      setRuns((data ?? []) as WorkflowRunRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    }
  }, [supabase, orgId])

  useEffect(() => {
    void refreshRules()
    void refreshRuns()
  }, [refreshRules, refreshRuns])

  const setRuleActive = useCallback(
    async (id: string, isActive: boolean) => {
      if (!supabase || !canManage) return
      const { error: e } = await supabase.from('workflow_rules').update({ is_active: isActive }).eq('id', id)
      if (e) setError(getSupabaseErrorMessage(e))
      else void refreshRules()
    },
    [supabase, canManage, refreshRules],
  )

  const upsertRule = useCallback(
    async (input: {
      id?: string
      slug: string
      name: string
      description?: string
      source_module: string
      trigger_on: 'insert' | 'update' | 'both'
      is_active: boolean
      condition_json: WorkflowCondition
      actions_json: WorkflowAction[] | WorkflowXorActionsEnvelope
      flow_graph_json?: Record<string, unknown> | null
      priority?: number
    }) => {
      if (!supabase || !orgId) return { ok: false as const }
      if (!canManage) {
        setError('Du har ikke tilgang til å administrere arbeidsflytregler. Kontakt administrator.')
        return { ok: false as const }
      }
      try {
        if (input.id) {
          const { error: e } = await supabase
            .from('workflow_rules')
            .update({
              slug: input.slug,
              name: input.name,
              description: input.description ?? '',
              source_module: input.source_module,
              trigger_on: input.trigger_on,
              is_active: input.is_active,
              condition_json: input.condition_json as unknown as Record<string, unknown>,
              actions_json: input.actions_json as unknown as Record<string, unknown>,
              flow_graph_json: input.flow_graph_json ?? null,
              priority: input.priority ?? 0,
            })
            .eq('id', input.id)
          if (e) throw e
        } else {
          const { error: e } = await supabase.from('workflow_rules').insert({
            organization_id: orgId,
            slug: input.slug,
            name: input.name,
            description: input.description ?? '',
            source_module: input.source_module,
            trigger_on: input.trigger_on,
            is_active: input.is_active,
            condition_json: input.condition_json,
            actions_json: input.actions_json as unknown as Record<string, unknown>,
            flow_graph_json: input.flow_graph_json ?? null,
            priority: input.priority ?? 0,
            is_template: false,
          })
          if (e) throw e
        }
        await refreshRules()
        return { ok: true as const }
      } catch (err) {
        setError(getSupabaseErrorMessage(err))
        return { ok: false as const }
      }
    },
    [supabase, orgId, canManage, refreshRules],
  )

  const deleteRule = useCallback(
    async (id: string) => {
      if (!supabase || !canManage) return
      const { error: e } = await supabase.from('workflow_rules').delete().eq('id', id)
      if (e) setError(getSupabaseErrorMessage(e))
      else void refreshRules()
    },
    [supabase, canManage, refreshRules],
  )

  const seedComplianceTemplates = useCallback(async () => {
    if (!supabase || !orgId || !canManage) return { ok: false as const, error: 'Ingen tilgang' }
    try {
      const { data, error: e } = await supabase.rpc('workflow_seed_compliance_templates', {
        p_org_id: orgId,
      })
      if (e) throw e
      await refreshRules()
      return { ok: true as const, inserted: typeof data === 'number' ? data : null }
    } catch (err) {
      const msg = getSupabaseErrorMessage(err)
      setError(msg)
      return { ok: false as const, error: msg }
    }
  }, [supabase, orgId, canManage, refreshRules])

  return {
    rules,
    runs,
    loading,
    error,
    canManage,
    refreshRules,
    refreshRuns,
    setRuleActive,
    upsertRule,
    deleteRule,
    seedComplianceTemplates,
  }
}
