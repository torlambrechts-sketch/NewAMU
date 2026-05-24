// Loads workflow_rules + workflow_runs aggregates for the
// Arbeidsflyt section. Maps the verbose substrate fields to the
// summary shape used by the section list.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type {
  WorkflowAction,
  WorkflowRuleRow,
  WorkflowXorActionsEnvelope,
} from '../../../types/workflow'

export interface AdminWorkflowSummary {
  id: string
  name: string
  description: string
  enabled: boolean
  triggerEventLabel: string
  triggerEvent: string
  sourceModule: string
  actionCount: number
  lawRefs: string[]
  runs: number
  failed: number
  lastRun: string | null
}

interface WorkflowRunCount {
  rule_id: string | null
  status: string
}

function countActions(json: WorkflowAction[] | WorkflowXorActionsEnvelope | undefined): number {
  if (!json) return 0
  if (Array.isArray(json)) return json.length
  const env = json as WorkflowXorActionsEnvelope & Record<string, unknown>
  if (Array.isArray(env.branches)) {
    let n = 0
    for (const b of env.branches as { actions?: WorkflowAction[] }[]) {
      if (Array.isArray(b.actions)) n += b.actions.length
    }
    return n
  }
  return 0
}

const MODULE_LABELS: Record<string, string> = {
  hse: 'HMS',
  deviations: 'Avvik',
  inspection: 'Sjekklister',
  tasks: 'Oppgaver',
  documents: 'Dokumenter',
  learning: 'Opplæring',
  meetings: 'Møter',
  survey: 'Undersøkelser',
  registers: 'Register',
  compliance: 'Etterlevelse',
  alerts: 'Varslinger',
  workflow: 'System',
}

function formatTriggerLabel(rule: WorkflowRuleRow): string {
  if (rule.trigger_event_name) {
    return `${MODULE_LABELS[rule.source_module] ?? rule.source_module} · ${rule.trigger_event_name}`
  }
  if (rule.trigger_type === 'schedule' && rule.schedule_cron) {
    return `Planlagt (${rule.schedule_cron})`
  }
  const triggerOn = rule.trigger_on === 'both' ? 'opprettelse + endring' : rule.trigger_on
  return `${MODULE_LABELS[rule.source_module] ?? rule.source_module} · ved ${triggerOn}`
}

export interface AdminWorkflowsResult {
  rules: WorkflowRuleRow[]
  summaries: AdminWorkflowSummary[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  toggleActive: (id: string, nextActive: boolean) => Promise<void>
}

export function useAdminWorkflows(): AdminWorkflowsResult {
  const { supabase, organization } = useOrgSetupContext()
  const [rules, setRules] = useState<WorkflowRuleRow[]>([])
  const [summaries, setSummaries] = useState<AdminWorkflowSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const [ruleRes, runRes] = await Promise.all([
        supabase
          .from('workflow_rules')
          .select('*')
          .eq('organization_id', organization.id)
          .order('priority', { ascending: false })
          .order('name'),
        supabase
          .from('workflow_runs')
          .select('rule_id, status, created_at')
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false })
          .limit(500),
      ])
      if (ruleRes.error) throw ruleRes.error

      const rows = (ruleRes.data ?? []) as WorkflowRuleRow[]
      const runs = (runRes.error ? [] : (runRes.data ?? [])) as (WorkflowRunCount & {
        created_at: string
      })[]

      const runStats = new Map<string, { total: number; failed: number; lastRun: string | null }>()
      for (const r of runs) {
        if (!r.rule_id) continue
        const s = runStats.get(r.rule_id) ?? { total: 0, failed: 0, lastRun: null }
        s.total += 1
        if (r.status === 'failed' || r.status === 'error') s.failed += 1
        if (!s.lastRun || r.created_at > s.lastRun) s.lastRun = r.created_at
        runStats.set(r.rule_id, s)
      }

      setRules(rows)
      setSummaries(
        rows.map((rule) => {
          const stat = runStats.get(rule.id) ?? { total: 0, failed: 0, lastRun: null }
          return {
            id: rule.id,
            name: rule.name,
            description: rule.description || '',
            enabled: rule.is_active,
            triggerEventLabel: formatTriggerLabel(rule),
            triggerEvent: rule.trigger_event_name ?? rule.trigger_type ?? 'event',
            sourceModule: rule.source_module,
            actionCount: countActions(rule.actions_json),
            lawRefs: rule.law_refs ?? [],
            runs: stat.total,
            failed: stat.failed,
            lastRun: stat.lastRun,
          }
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste arbeidsflyter')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggleActive = useCallback(
    async (id: string, nextActive: boolean) => {
      if (!supabase) return
      const { error: e } = await supabase
        .from('workflow_rules')
        .update({ is_active: nextActive })
        .eq('id', id)
      if (e) {
        setError(e.message)
        return
      }
      await refresh()
    },
    [supabase, refresh],
  )

  return { rules, summaries, loading, error, refresh, toggleActive }
}
