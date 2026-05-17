// useWorkflowHealth — aggregated KPIs + widget data for /automatisering/
// Helsesjekk-fanen. One hook, four parallel queries, 30 s refresh
// (visibility-gated). The page shouldn't fan out to four hooks: that
// quadruples the request count when the tab refreshes and makes the
// "is the engine working?" answer harder to reason about.
//
// Queries:
//   1. KPIs — counts of: active rules, silent active rules (no run in
//      30 d), failed runs (last 7 d), pending approvals.
//   2. Silent rules list — id + name + trigger_event_name +
//      last_fired_at (max workflow_runs.created_at per rule).
//   3. Queue health — group by status + oldest pending age (minutes).
//   4. Deadline risks — workflow_approvals.pending where
//      metadata.deadline_at < now() + 4 h (gov-action regulator info
//      lives in workflow_rules.actions_json / metadata).
//
// All queries hit RLS'd tables and are filtered by organization_id
// client-side via .eq() — the existing `workflow_runs_select_org` etc.
// policies treat current_org_id() as the authority, but the extra .eq
// is belt-and-braces in case a viewer somehow has multi-org RLS scope.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import { useIntervalWhenVisible } from './useIntervalWhenVisible'
import { withTimeout } from '../lib/withTimeout'
import { getSupabaseErrorMessage } from '../lib/supabaseError'

const HEALTH_QUERY_TIMEOUT_MS = 15_000
const REFRESH_INTERVAL_MS = 30_000
const SILENT_RULE_WINDOW_DAYS = 30
const FAILED_RUNS_WINDOW_DAYS = 7
const DEADLINE_WARNING_HOURS = 4
const SILENT_RULES_LIMIT = 20
const DEADLINE_RISKS_LIMIT = 20

export type WorkflowHealthKpis = {
  activeRules: number
  silentRules: number
  failedRuns7d: number
  pendingApprovals: number
}

export type SilentRule = {
  ruleId: string
  name: string
  triggerEventName: string | null
  triggerOn: 'insert' | 'update' | 'both'
  lastFiredAt: string | null
}

export type QueueHealthBucket = {
  status: string
  count: number
}

export type QueueHealth = {
  buckets: QueueHealthBucket[]
  oldestPendingAgeMinutes: number | null
}

export type DeadlineRisk = {
  approvalId: string
  ruleId: string
  ruleName: string
  deadlineAt: string | null
  regulator: string | null
  assignee: string | null
  approverRole: string | null
}

export type UseWorkflowHealthResult = {
  kpis: WorkflowHealthKpis
  silentRules: SilentRule[]
  queueHealth: QueueHealth
  deadlineRisks: DeadlineRisk[]
  loading: boolean
  error: string | null
  refresh: () => void
  forceQueueTick: () => Promise<{ ok: boolean; leased?: number; error?: string }>
}

const EMPTY_KPIS: WorkflowHealthKpis = {
  activeRules: 0,
  silentRules: 0,
  failedRuns7d: 0,
  pendingApprovals: 0,
}

const EMPTY_QUEUE_HEALTH: QueueHealth = {
  buckets: [],
  oldestPendingAgeMinutes: null,
}

type RuleRowSlim = {
  id: string
  name: string
  trigger_event_name: string | null
  trigger_on: 'insert' | 'update' | 'both'
  is_active: boolean
}

type RunRowSlim = {
  rule_id: string | null
  status: string
  created_at: string
}

type QueueRowSlim = {
  id: string
  status: string
  execute_after: string | null
  created_at: string
}

type ApprovalRowSlim = {
  id: string
  rule_id: string
  approver_role: string | null
  approver_user_id: string | null
  status: string
  requested_at: string
  metadata: Record<string, unknown> | null
}

function pickStringField(metadata: Record<string, unknown> | null, key: string): string | null {
  if (!metadata) return null
  const v = metadata[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

function metadataDeadline(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null
  for (const key of ['deadline_at', 'deadline', 'wait_until', 'frist_at']) {
    const v = (metadata as Record<string, unknown>)[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

function metadataRegulator(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null
  for (const key of ['regulator', 'authority', 'destination']) {
    const v = (metadata as Record<string, unknown>)[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

export function useWorkflowHealth(): UseWorkflowHealthResult {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [kpis, setKpis] = useState<WorkflowHealthKpis>(EMPTY_KPIS)
  const [silentRules, setSilentRules] = useState<SilentRule[]>([])
  const [queueHealth, setQueueHealth] = useState<QueueHealth>(EMPTY_QUEUE_HEALTH)
  const [deadlineRisks, setDeadlineRisks] = useState<DeadlineRisk[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    const nowMs = Date.now()
    const silentCutoffIso = new Date(nowMs - SILENT_RULE_WINDOW_DAYS * 86_400_000).toISOString()
    const failedCutoffIso = new Date(nowMs - FAILED_RUNS_WINDOW_DAYS * 86_400_000).toISOString()
    const deadlineCutoffIso = new Date(nowMs + DEADLINE_WARNING_HOURS * 3_600_000).toISOString()

    const rulesQuery = withTimeout(
      supabase
        .from('workflow_rules')
        .select('id,name,trigger_event_name,trigger_on,is_active')
        .eq('organization_id', orgId)
        .eq('is_active', true),
      HEALTH_QUERY_TIMEOUT_MS,
      'workflow_rules slim',
    )

    const recentRunsQuery = withTimeout(
      supabase
        .from('workflow_runs')
        .select('rule_id,status,created_at')
        .eq('organization_id', orgId)
        .gte('created_at', silentCutoffIso)
        .limit(2000),
      HEALTH_QUERY_TIMEOUT_MS,
      'workflow_runs window',
    )

    const queueQuery = withTimeout(
      supabase
        .from('workflow_action_queue')
        .select('id,status,execute_after,created_at')
        .eq('organization_id', orgId)
        .limit(1000),
      HEALTH_QUERY_TIMEOUT_MS,
      'workflow_action_queue slim',
    )

    const approvalsQuery = withTimeout(
      supabase
        .from('workflow_approvals')
        .select('id,rule_id,approver_role,approver_user_id,status,requested_at,metadata')
        .eq('organization_id', orgId)
        .eq('status', 'pending')
        .order('requested_at', { ascending: true })
        .limit(200),
      HEALTH_QUERY_TIMEOUT_MS,
      'workflow_approvals pending',
    )

    Promise.all([rulesQuery, recentRunsQuery, queueQuery, approvalsQuery])
      .then(([rulesRes, runsRes, queueRes, approvalsRes]) => {
        if (cancelled) return
        const rulesErr = (rulesRes as { error: unknown }).error
        const runsErr = (runsRes as { error: unknown }).error
        const queueErr = (queueRes as { error: unknown }).error
        const approvalsErr = (approvalsRes as { error: unknown }).error
        const firstErr = rulesErr || runsErr || queueErr || approvalsErr
        if (firstErr) {
          throw firstErr
        }

        const rules = ((rulesRes as { data: RuleRowSlim[] | null }).data ?? []) as RuleRowSlim[]
        const runs = ((runsRes as { data: RunRowSlim[] | null }).data ?? []) as RunRowSlim[]
        const queue = ((queueRes as { data: QueueRowSlim[] | null }).data ?? []) as QueueRowSlim[]
        const approvals = ((approvalsRes as { data: ApprovalRowSlim[] | null }).data ?? []) as ApprovalRowSlim[]

        const ruleById = new Map(rules.map((r) => [r.id, r]))

        // Map rule_id -> latest run created_at within window.
        const lastFiredByRule = new Map<string, string>()
        let failedRuns7d = 0
        const failedCutoffMs = new Date(failedCutoffIso).getTime()
        for (const run of runs) {
          if (run.rule_id) {
            const prev = lastFiredByRule.get(run.rule_id)
            if (!prev || prev < run.created_at) {
              lastFiredByRule.set(run.rule_id, run.created_at)
            }
          }
          if (run.status === 'failed') {
            const t = Date.parse(run.created_at)
            if (!Number.isNaN(t) && t >= failedCutoffMs) failedRuns7d += 1
          }
        }

        // Silent rules: is_active and no run in last 30 days.
        const silent: SilentRule[] = []
        for (const rule of rules) {
          if (!rule.is_active) continue
          const lastFired = lastFiredByRule.get(rule.id) ?? null
          if (lastFired) continue
          silent.push({
            ruleId: rule.id,
            name: rule.name,
            triggerEventName: rule.trigger_event_name ?? null,
            triggerOn: rule.trigger_on,
            lastFiredAt: null,
          })
        }
        // Note: we treat any rule with no run in the 30 d window as silent.
        // "lastFiredAt" stays null because we don't fetch beyond the
        // window — UI renders "Aldri (innen 30 dager)" for that case.
        silent.sort((a, b) => a.name.localeCompare(b.name))

        // Queue buckets + oldest pending age.
        const bucketMap = new Map<string, number>()
        let oldestPendingMs: number | null = null
        for (const row of queue) {
          bucketMap.set(row.status, (bucketMap.get(row.status) ?? 0) + 1)
          if (row.status === 'pending') {
            const tsRaw = row.execute_after ?? row.created_at
            if (tsRaw) {
              const t = Date.parse(tsRaw)
              if (!Number.isNaN(t)) {
                if (oldestPendingMs === null || t < oldestPendingMs) oldestPendingMs = t
              }
            }
          }
        }
        const buckets: QueueHealthBucket[] = Array.from(bucketMap.entries())
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => a.status.localeCompare(b.status))
        const oldestPendingAgeMinutes =
          oldestPendingMs === null ? null : Math.max(0, Math.round((nowMs - oldestPendingMs) / 60_000))

        // Deadline risks: pending approvals whose metadata.deadline_at <
        // now + 4 h. We filter client-side because the deadline field is
        // a string in jsonb metadata and not all rules carry it.
        const cutoffMs = Date.parse(deadlineCutoffIso)
        const risks: DeadlineRisk[] = []
        for (const a of approvals) {
          const deadline = metadataDeadline(a.metadata ?? null)
          if (!deadline) continue
          const dlMs = Date.parse(deadline)
          if (Number.isNaN(dlMs)) continue
          if (dlMs > cutoffMs) continue
          risks.push({
            approvalId: a.id,
            ruleId: a.rule_id,
            ruleName: ruleById.get(a.rule_id)?.name ?? a.rule_id,
            deadlineAt: deadline,
            regulator: metadataRegulator(a.metadata ?? null),
            assignee: a.approver_user_id ?? pickStringField(a.metadata ?? null, 'assignee'),
            approverRole: a.approver_role,
          })
        }
        risks.sort((a, b) => {
          const aMs = a.deadlineAt ? Date.parse(a.deadlineAt) : Number.POSITIVE_INFINITY
          const bMs = b.deadlineAt ? Date.parse(b.deadlineAt) : Number.POSITIVE_INFINITY
          return aMs - bMs
        })

        const pendingApprovals = approvals.length

        setKpis({
          activeRules: rules.length,
          silentRules: silent.length,
          failedRuns7d,
          pendingApprovals,
        })
        setSilentRules(silent.slice(0, SILENT_RULES_LIMIT))
        setQueueHealth({ buckets, oldestPendingAgeMinutes })
        setDeadlineRisks(risks.slice(0, DEADLINE_RISKS_LIMIT))
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(getSupabaseErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  useEffect(() => {
    const cleanup = refresh()
    return cleanup
  }, [refresh])

  useIntervalWhenVisible(() => {
    refresh()
  }, REFRESH_INTERVAL_MS, !!supabase && !!orgId)

  const forceQueueTick = useCallback(async () => {
    if (!supabase) return { ok: false as const, error: 'Supabase ikke tilkoblet' }
    try {
      const { data, error: e } = await supabase.rpc('workflow_queue_force_tick')
      if (e) throw e
      // Refresh once after the worker has had a moment to flip rows.
      refresh()
      return { ok: true as const, leased: typeof data === 'number' ? data : 0 }
    } catch (err) {
      const msg = getSupabaseErrorMessage(err)
      setError(msg)
      return { ok: false as const, error: msg }
    }
  }, [supabase, refresh])

  return {
    kpis,
    silentRules,
    queueHealth,
    deadlineRisks,
    loading,
    error,
    refresh,
    forceQueueTick,
  }
}
