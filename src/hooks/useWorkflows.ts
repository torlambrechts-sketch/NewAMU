import { useCallback, useEffect, useState } from 'react'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { withTimeout } from '../lib/withTimeout'
import { useOrgSetupContext } from './useOrgSetupContext'
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowRuleRow,
  WorkflowRunRow,
  WorkflowXorActionsEnvelope,
} from '../types/workflow'

const WORKFLOW_QUERY_TIMEOUT_MS = 20_000

export function useWorkflows() {
  const { supabase, organization, profile, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id
  const isOrgAdminProfile = profile?.is_org_admin === true
  // Legacy single permission still satisfies every capability for back-compat.
  const hasLegacyManage = isOrgAdminProfile || isAdmin || can('workflows.manage')
  // Split permissions (migration _20260905120900). Each is satisfied by the
  // legacy key OR the new dedicated key. Builder UI uses these directly.
  const canCompose = hasLegacyManage || can('workflows.compose')
  const canActivate = hasLegacyManage || can('workflows.activate')
  const canActivateExternal = hasLegacyManage || can('workflows.activate_external')
  const canViewConfidential = hasLegacyManage || can('workflows.view_confidential')
  // Compose is the most permissive — anyone who can compose can also list/edit.
  const canManage = canCompose

  const [rules, setRules] = useState<WorkflowRuleRow[]>([])
  const [runs, setRuns] = useState<WorkflowRunRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshRules = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await withTimeout(
        supabase
          .from('workflow_rules')
          .select('*')
          .eq('organization_id', orgId)
          .order('priority', { ascending: false })
          .order('name'),
        WORKFLOW_QUERY_TIMEOUT_MS,
        'workflow_rules select',
      )
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
      const { data, error: e } = await withTimeout(
        supabase
          .from('workflow_runs')
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(80),
        WORKFLOW_QUERY_TIMEOUT_MS,
        'workflow_runs select',
      )
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

  /**
   * Legacy 4-template starter pack from archive/_20260420120000_workflow_engine.sql.
   * Kept callable for backward compatibility; new code should prefer
   * seedWorkflowBaseline() which reads from workflow_rule_catalog.
   */
  const seedComplianceTemplates = useCallback(async () => {
    if (!supabase || !orgId || !canCompose) return { ok: false as const, error: 'Ingen tilgang' }
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
  }, [supabase, orgId, canCompose, refreshRules])

  /**
   * Install ONE template from workflow_rule_catalog into this org as an
   * inactive workflow_rules row. Returns the new rule_id so the UI can
   * deep-link to the canvas to edit it. If a rule with the same slug
   * already exists, returns that rule_id with action='exists'.
   */
  const seedWorkflowFromCatalog = useCallback(
    async (slug: string) => {
      if (!supabase || !orgId || !canCompose) {
        return { ok: false as const, error: 'Ingen tilgang' }
      }
      try {
        const { data, error: e } = await supabase.rpc('provision_workflow_from_catalog', {
          p_org_id: orgId,
          p_slug: slug,
        })
        if (e) throw e
        const row = ((data ?? []) as Array<{ rule_id: string; action: 'inserted' | 'exists' }>)[0]
        if (!row) {
          return { ok: false as const, error: 'Tom respons fra provision-RPC' }
        }
        await refreshRules()
        return { ok: true as const, ruleId: row.rule_id, action: row.action }
      } catch (err) {
        const msg = getSupabaseErrorMessage(err)
        setError(msg)
        return { ok: false as const, error: msg }
      }
    },
    [supabase, orgId, canCompose, refreshRules],
  )

  /**
   * Provision the workflow_rule_catalog baseline for this org. Optional `pack`
   * narrows down to e.g. 'aml-amu' / 'iso-45001' / 'gdpr'. Set
   * `activateImmediately=true` to flip non-gov-action rules to is_active=true
   * (gov-action rules always require explicit activation by an
   * activate_external permission holder).
   */
  const seedWorkflowBaseline = useCallback(
    async (opts: { pack?: string; activateImmediately?: boolean } = {}) => {
      if (!supabase || !orgId || !canCompose) {
        return { ok: false as const, error: 'Ingen tilgang' }
      }
      try {
        const { data, error: e } = await supabase.rpc('provision_workflows_baseline_for_org', {
          p_org_id: orgId,
          p_pack: opts.pack ?? null,
          p_activate_immediately: opts.activateImmediately ?? false,
        })
        if (e) throw e
        await refreshRules()
        return {
          ok: true as const,
          installed: (data ?? []) as Array<{ installed_slug: string; installed_action: 'inserted' | 'updated' | 'skipped' }>,
        }
      } catch (err) {
        const msg = getSupabaseErrorMessage(err)
        setError(msg)
        return { ok: false as const, error: msg }
      }
    },
    [supabase, orgId, canCompose, refreshRules],
  )

  return {
    rules,
    runs,
    loading,
    error,
    // Legacy aggregate flag — true if the user can compose. Kept for callers
    // that haven't migrated to the split flags yet.
    canManage,
    // Split permissions (Phase A migration _20260905120900).
    canCompose,
    canActivate,
    canActivateExternal,
    canViewConfidential,
    refreshRules,
    refreshRuns,
    setRuleActive,
    upsertRule,
    deleteRule,
    seedComplianceTemplates,
    seedWorkflowBaseline,
    seedWorkflowFromCatalog,
  }
}
