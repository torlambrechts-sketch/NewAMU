import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type {
  CertStatus,
  IkActionPlanRow,
  IkCompetenceRecordRow,
  IkCompetenceRecordWithStatus,
  IkCompetenceRequirementRow,
  IkHseGoalMeasurementRow,
  IkHseGoalRow,
  IkLegalRegisterRow,
  IkOrgRoleRow,
  IkPillarStatus,
  IkStatus,
} from './types'

function certStatus(record: IkCompetenceRecordRow): CertStatus {
  if (!record.expires_at) return 'valid'
  const daysLeft = (new Date(record.expires_at).getTime() - Date.now()) / 86_400_000
  if (daysLeft < 0) return 'expired'
  if (daysLeft < 60) return 'expiring_soon'
  return 'valid'
}

function overallStatus(statuses: IkStatus[]): IkStatus {
  if (statuses.includes('critical')) return 'critical'
  if (statuses.includes('attention')) return 'attention'
  if (statuses.every((s) => s === 'ok')) return 'ok'
  return 'unassessed'
}

export function useInternkontroll() {
  const { supabase, organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('internkontroll.manage')

  const [legalRegister, setLegalRegister] = useState<IkLegalRegisterRow[]>([])
  const [orgRoles, setOrgRoles] = useState<IkOrgRoleRow[]>([])
  const [competenceReqs, setCompetenceReqs] = useState<IkCompetenceRequirementRow[]>([])
  const [competenceRecords, setCompetenceRecords] = useState<IkCompetenceRecordRow[]>([])
  const [goals, setGoals] = useState<IkHseGoalRow[]>([])
  const [goalMeasurements, setGoalMeasurements] = useState<IkHseGoalMeasurementRow[]>([])
  const [actionPlans, setActionPlans] = useState<IkActionPlanRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const [lr, roles, reqs, records, gl, ap] = await Promise.all([
        supabase.from('ik_legal_register').select('*').eq('organization_id', orgId).order('law_code').order('paragraph'),
        supabase.from('ik_org_roles').select('*').eq('organization_id', orgId).order('role_key'),
        supabase.from('ik_competence_requirements').select('*').eq('organization_id', orgId).order('role_key'),
        supabase.from('ik_competence_records').select('*').eq('organization_id', orgId).order('expires_at'),
        supabase.from('ik_hse_goals').select('*').eq('organization_id', orgId).order('year', { ascending: false }),
        supabase.from('ik_action_plans').select('*').eq('organization_id', orgId).order('due_date'),
      ])
      if (lr.error) throw lr.error
      if (roles.error) throw roles.error
      if (reqs.error) throw reqs.error
      if (records.error) throw records.error
      if (gl.error) throw gl.error
      if (ap.error) throw ap.error

      const goalIds = (gl.data ?? []).map((g) => g.id)
      const gm =
        goalIds.length > 0
          ? await supabase.from('ik_hse_goal_measurements').select('*').in('goal_id', goalIds)
          : { data: [] as IkHseGoalMeasurementRow[], error: null }
      if (gm.error) throw gm.error

      setLegalRegister((lr.data ?? []) as IkLegalRegisterRow[])
      setOrgRoles((roles.data ?? []) as IkOrgRoleRow[])
      setCompetenceReqs((reqs.data ?? []) as IkCompetenceRequirementRow[])
      setCompetenceRecords((records.data ?? []) as IkCompetenceRecordRow[])
      setGoals((gl.data ?? []) as IkHseGoalRow[])
      setGoalMeasurements((gm.data ?? []) as IkHseGoalMeasurementRow[])
      setActionPlans((ap.data ?? []) as IkActionPlanRow[])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Annotate records with computed cert_status
  const competenceRecordsWithStatus = useMemo<IkCompetenceRecordWithStatus[]>(
    () => competenceRecords.map((r) => ({ ...r, cert_status: certStatus(r) })),
    [competenceRecords],
  )

  // Compute per-pillar traffic-light status
  const pillarStatuses = useMemo<IkPillarStatus[]>(() => {
    const today = new Date()

    // Pillar 1 – Legal register reviewed in past 12 months?
    const staleReviews = legalRegister.filter((r) => {
      if (!r.reviewed_at) return true
      return today.getTime() - new Date(r.reviewed_at).getTime() > 365 * 86_400_000
    })
    const p1: IkStatus =
      legalRegister.length === 0 ? 'unassessed' : staleReviews.length > 0 ? 'attention' : 'ok'

    // Pillar 2 – Any expired hard-gate certs?
    const expiredHardGate = competenceRecordsWithStatus.filter((r) => {
      const req = competenceReqs.find((q) => q.id === r.requirement_id)
      return req?.is_hard_gate && r.cert_status === 'expired'
    })
    const expiringSoon = competenceRecordsWithStatus.filter((r) => r.cert_status === 'expiring_soon').length
    const p2: IkStatus =
      expiredHardGate.length > 0 ? 'critical' : expiringSoon > 0 ? 'attention' : 'ok'

    // Pillar 3 – All mandatory roles assigned and not expired?
    const unassigned = orgRoles.filter((r) => r.is_mandatory && !r.assigned_to).length
    const expiredRole = orgRoles.filter((r) => r.valid_until && new Date(r.valid_until) < today).length
    const p3: IkStatus =
      unassigned > 0 ? 'critical' : expiredRole > 0 ? 'attention' : orgRoles.length === 0 ? 'unassessed' : 'ok'

    // Pillar 4 – Any active goals?
    const activeGoals = goals.filter((g) => g.status === 'active').length
    const p4: IkStatus = goals.length === 0 ? 'unassessed' : activeGoals === 0 ? 'attention' : 'ok'

    // Pillar 5 – Overdue open action plans?
    const overdue = actionPlans.filter(
      (a) => ['open', 'in_progress'].includes(a.status) && a.due_date && new Date(a.due_date) < today,
    ).length
    const p5: IkStatus = overdue > 2 ? 'critical' : overdue > 0 ? 'attention' : 'ok'

    // Pillar 6 – ROS (delegate to internal-control existing module) — always 'unassessed' here
    const p6: IkStatus = 'unassessed'

    // Pillar 7 – Annual review (link to existing module)
    const p7: IkStatus = 'unassessed'

    // Pillar 8 – Continuous improvement (action plans closed this year)
    const closedThisYear = actionPlans.filter(
      (a) =>
        a.status === 'completed' &&
        a.completed_at &&
        new Date(a.completed_at).getFullYear() === today.getFullYear(),
    ).length
    const p8: IkStatus = closedThisYear > 0 ? 'ok' : 'attention'

    return [
      {
        pillar: 1,
        status: p1,
        label: 'Lovregister',
        details:
          staleReviews.length > 0
            ? `${staleReviews.length} paragrafer ikke revidert siste 12 mnd`
            : 'Alle paragrafer revidert',
      },
      {
        pillar: 2,
        status: p2,
        label: 'Kompetanse',
        details:
          expiredHardGate.length > 0
            ? `${expiredHardGate.length} kritiske sertifikater utløpt`
            : expiringSoon > 0
              ? `${expiringSoon} sertifikater utløper snart`
              : 'Alt gyldig',
      },
      {
        pillar: 3,
        status: p3,
        label: 'Medvirkning & roller',
        details: unassigned > 0 ? `${unassigned} påkrevde roller ikke besatt` : 'Alle roller besatt',
      },
      {
        pillar: 4,
        status: p4,
        label: 'Mål & KPI',
        details: activeGoals > 0 ? `${activeGoals} aktive HMS-mål` : 'Ingen aktive mål',
      },
      {
        pillar: 5,
        status: p5,
        label: 'Tiltaksplan',
        details: overdue > 0 ? `${overdue} tiltak forfalt` : 'Ingen forfalte tiltak',
      },
      { pillar: 6, status: p6, label: 'ROS-analyse', details: 'Se ROS-modul' },
      { pillar: 7, status: p7, label: 'Årsgjennomgang', details: 'Se årsgjennomgang' },
      {
        pillar: 8,
        status: p8,
        label: 'Kontinuerlig forbedring',
        details: closedThisYear > 0 ? `${closedThisYear} tiltak lukket i år` : 'Ingen tiltak lukket i år',
      },
    ]
  }, [legalRegister, competenceRecordsWithStatus, competenceReqs, orgRoles, goals, actionPlans])

  const overallIkStatus = useMemo(() => overallStatus(pillarStatuses.map((p) => p.status)), [pillarStatuses])

  return {
    legalRegister,
    orgRoles,
    competenceReqs,
    competenceRecordsWithStatus,
    goals,
    goalMeasurements,
    actionPlans,
    loading,
    error,
    canManage,
    refresh,
    pillarStatuses,
    overallIkStatus,
  }
}
