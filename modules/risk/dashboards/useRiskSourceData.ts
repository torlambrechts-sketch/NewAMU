// useRiskSourceData — loads the five risk source tables for the current
// org and returns flat snapshots ready for useRiskDatasets.
//
// Shared between RiskAnalysePage and HmsOverviewPage. P2 will replace
// the five separate queries with a single SELECT from
// `risk_register_unified_v`; consumers continue to pass the same shapes
// to useRiskDatasets so widgets don't change.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import type {
  AlertCaseSnapshot,
  ComplianceFindingSnapshot,
  DeviationSnapshot,
  InspectionFindingSnapshot,
  RiskTaskSnapshot,
} from './useRiskDatasets'
import type { SourceSeverity } from './hazardCategories'
import type { TaskItemPriority, TaskItemStatus, TaskTemplateKind } from '../../../src/types/task'

const RISK_TASK_KINDS: TaskTemplateKind[] = ['avvik', 'nestenulykke', 'risiko', 'tiltak']

export type RiskSourceData = {
  loading: boolean
  error: string | null
  findings: ComplianceFindingSnapshot[]
  tasks: RiskTaskSnapshot[]
  deviations: DeviationSnapshot[]
  inspectionFindings: InspectionFindingSnapshot[]
  alerts: AlertCaseSnapshot[]
  reload: () => Promise<void>
}

export function useRiskSourceData(): RiskSourceData {
  const { supabase, organization, departments } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [findings, setFindings] = useState<ComplianceFindingSnapshot[]>([])
  const [tasks, setTasks] = useState<RiskTaskSnapshot[]>([])
  const [deviations, setDeviations] = useState<DeviationSnapshot[]>([])
  const [inspectionFindings, setInspectionFindings] = useState<InspectionFindingSnapshot[]>([])
  const [alerts, setAlerts] = useState<AlertCaseSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deptLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of departments) m.set(d.id, d.name)
    return m
  }, [departments])

  const reload = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const respPromise = supabase
        .from('compliance_checklist_responses')
        .select('id, execution_id, item_key, severity, is_finding, created_at, updated_at, compliance_checklist_executions!inner(template_slug, location_id, department_id)')
        .eq('organization_id', orgId)
        .eq('is_finding', true)
        .limit(2000)

      const taskPromise = supabase
        .from('task_items')
        .select('id, title, template_kind, template_slug, priority, status, due_date, sla_due_at, closed_at, created_at, law_refs, residual_risk_score, assignee_user_id')
        .eq('organization_id', orgId)
        .in('template_kind', RISK_TASK_KINDS)
        .is('deleted_at', null)
        .limit(2000)

      const devPromise = supabase
        .from('deviations')
        .select('id, title, severity, status, due_at, created_at, updated_at')
        .eq('organization_id', orgId)
        .limit(2000)

      const inspPromise = supabase
        .from('inspection_findings')
        .select('id, round_id, description, severity, deviation_id, created_at')
        .eq('organization_id', orgId)
        .limit(2000)

      const alertPromise = supabase
        .from('alert_cases')
        .select('id, kind, category, severity, status, created_at, closed_at')
        .eq('organization_id', orgId)
        .limit(500)

      const [respRes, taskRes, devRes, inspRes, alertRes] = await Promise.all([
        respPromise, taskPromise, devPromise, inspPromise, alertPromise,
      ])

      const errors = [respRes, taskRes, devRes, inspRes, alertRes]
        .map((r) => r.error?.message)
        .filter(Boolean) as string[]

      setFindings(
        (respRes.data ?? []).map((r: Record<string, unknown>) => {
          const exec = (r.compliance_checklist_executions as Record<string, unknown> | null) ?? null
          const deptId = (exec?.department_id as string | null) ?? null
          return {
            id: String(r.id),
            executionId: String(r.execution_id),
            templateSlug: (exec?.template_slug as string | null) ?? null,
            severity: (r.severity as SourceSeverity | null) ?? null,
            isFinding: Boolean(r.is_finding),
            itemKey: String(r.item_key ?? ''),
            lawRefs: [],
            hazardCategory: null,
            departmentId: deptId,
            departmentLabel: deptId ? deptLabelById.get(deptId) ?? null : null,
            locationId: (exec?.location_id as string | null) ?? null,
            hasOpenAction: false,
            createdAt: String(r.created_at),
            updatedAt: String(r.updated_at ?? r.created_at),
          }
        }),
      )

      setTasks(
        (taskRes.data ?? []).map((r: Record<string, unknown>) => ({
          id: String(r.id),
          title: String(r.title ?? ''),
          templateKind: (r.template_kind as RiskTaskSnapshot['templateKind']) ?? null,
          templateSlug: (r.template_slug as string | null) ?? null,
          priority: (r.priority as TaskItemPriority | undefined) ?? 'medium',
          status: (r.status as TaskItemStatus | string | undefined) ?? 'open',
          closedAt: (r.closed_at as string | null) ?? null,
          createdAt: String(r.created_at),
          lawRefs: Array.isArray(r.law_refs) ? (r.law_refs as string[]) : [],
          residualRiskScore: (r.residual_risk_score as number | null) ?? null,
          residualJustification: null,
          ownerUserId: (r.assignee_user_id as string | null) ?? null,
          departmentId: null,
          departmentLabel: null,
          hazardCategory: null,
          hasOpenAction: false,
        })),
      )

      setDeviations(
        (devRes.data ?? []).map((r: Record<string, unknown>) => ({
          id: String(r.id),
          title: String(r.title ?? ''),
          severity: (r.severity as SourceSeverity) ?? 'medium',
          status: String(r.status ?? 'open'),
          dueAt: (r.due_at as string | null) ?? null,
          closedAt: null,
          createdAt: String(r.created_at),
          updatedAt: String(r.updated_at ?? r.created_at),
          departmentId: null,
          departmentLabel: null,
        })),
      )

      setInspectionFindings(
        (inspRes.data ?? []).map((r: Record<string, unknown>) => ({
          id: String(r.id),
          roundId: String(r.round_id),
          description: String(r.description ?? ''),
          severity: (r.severity as SourceSeverity) ?? 'medium',
          deviationId: (r.deviation_id as string | null) ?? null,
          createdAt: String(r.created_at),
          departmentId: null,
          departmentLabel: null,
        })),
      )

      setAlerts(
        (alertRes.data ?? []).map((r: Record<string, unknown>) => ({
          id: String(r.id),
          category: String(r.category ?? r.kind ?? ''),
          severity: (r.severity as SourceSeverity | null) ?? null,
          status: String(r.status ?? 'received'),
          createdAt: String(r.created_at),
          closedAt: (r.closed_at as string | null) ?? null,
          lawRefs: [],
        })),
      )

      if (errors.length > 0) setError(errors[0]!)
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, deptLabelById])

  useEffect(() => { void reload() }, [reload])

  return { loading, error, findings, tasks, deviations, inspectionFindings, alerts, reload }
}
