import { useMemo } from 'react'
import { useInternalControl } from '../../hooks/useInternalControl'
import { useHse } from '../../hooks/useHse'
import { useInternkontroll } from '../../../modules/internkontroll/useInternkontroll'
import { useHrCompliance } from '../../hooks/useHrCompliance'
import { useOrgHealth } from '../../hooks/useOrgHealth'
import type { IkActionPlanRow, IkActionPlanSource, IkLawCode } from '../../../modules/internkontroll/types'

export type ComplianceItemStatus =
  | 'open'
  | 'in_progress'
  | 'awaiting_signature'
  | 'overdue'
  | 'completed'

export type ComplianceItemSource =
  | 'action_plan'
  | 'ros'
  | 'inspection'
  | 'sja'
  | 'annual_review'
  | 'training'
  | 'hr_discussion'
  | 'hr_consultation'
  | 'survey'

export type ComplianceItem = {
  id: string
  title: string
  status: ComplianceItemStatus
  source: ComplianceItemSource
  /** Top-level law citation, e.g. `AML § 3-1` or `IK-f § 5 nr. 6` */
  legalRef?: string
  lawPillar?: IkLawCode | null
  priority?: 'critical' | 'high' | 'medium' | 'low'
  assigneeName?: string | null
  dueDate?: string | null
  href?: string
}

const SOURCE_TO_LEGAL: Record<ComplianceItemSource, string> = {
  action_plan: 'IK-f § 5 nr. 6',
  ros: 'AML § 3-1 / IK-f § 5 nr. 6',
  inspection: 'IK-f § 5 nr. 6',
  sja: 'AML § 3-1 / IK-f § 5 nr. 6',
  annual_review: 'IK-f § 5 nr. 8',
  training: 'AML § 3-2 / § 3-5',
  hr_discussion: 'AML § 15-1',
  hr_consultation: 'AML kap. 8',
  survey: 'AML § 3-1 / § 4-3',
}

function mapActionPlan(p: IkActionPlanRow, today: string): ComplianceItem {
  const overdue =
    (p.status === 'open' || p.status === 'in_progress') && p.due_date != null && p.due_date < today
  let status: ComplianceItemStatus
  if (p.status === 'completed') status = 'completed'
  else if (p.status === 'cancelled') status = 'completed'
  else if (overdue) status = 'overdue'
  else if (p.status === 'in_progress') status = 'in_progress'
  else status = 'open'

  const sourceMap: Record<IkActionPlanSource, ComplianceItemSource> = {
    manual: 'action_plan',
    ros: 'ros',
    avvik: 'action_plan',
    inspection: 'inspection',
    annual_review: 'annual_review',
  }
  return {
    id: `ap-${p.id}`,
    title: p.title,
    status,
    source: sourceMap[p.source] ?? 'action_plan',
    legalRef: SOURCE_TO_LEGAL[sourceMap[p.source] ?? 'action_plan'],
    lawPillar: p.law_pillar,
    priority: p.priority,
    assigneeName: p.assigned_name,
    dueDate: p.due_date,
    href: '/internkontroll/tiltaksplan',
  }
}

export type ComplianceCounts = {
  open: number
  in_progress: number
  awaiting_signature: number
  overdue: number
  completed: number
  total: number
}

/**
 * Aggregates compliance work items across modules into a single, kanban-ready list.
 *
 * Reuses existing hooks rather than duplicating data access:
 *   - useInternkontroll().actionPlans
 *   - useInternalControl().rosAssessments / annualReviews
 *   - useHse() open inspections, open SJA, expired training
 *   - useHrCompliance() drøftelse / drøfting cases
 *   - useOrgHealth() open surveys
 */
export function useComplianceWorkItems() {
  const ic = useInternalControl()
  const hse = useHse()
  const ik = useInternkontroll()
  const hr = useHrCompliance()
  const oh = useOrgHealth()

  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const items: ComplianceItem[] = []

    // 1) IK action plans (tiltak)
    for (const p of ik.actionPlans) {
      items.push(mapActionPlan(p, today))
    }

    // 2) ROS assessments — unsigned drafts are open compliance work
    for (const r of ic.rosAssessments) {
      if (r.locked) continue
      const sigCount = r.signatures?.length ?? 0
      const status: ComplianceItemStatus = sigCount > 0 ? 'awaiting_signature' : 'open'
      items.push({
        id: `ros-${r.id}`,
        title: r.title || 'ROS (uten tittel)',
        status,
        source: 'ros',
        legalRef: SOURCE_TO_LEGAL.ros,
        lawPillar: 'AML',
        href: '/internal-control?tab=ros',
      })
    }

    // 3) Annual review — open year-reviews (IK-f § 5 nr. 8)
    for (const a of ic.annualReviews) {
      if (a.locked) continue
      const status: ComplianceItemStatus =
        a.status === 'pending_safety_rep' ? 'awaiting_signature' : 'open'
      items.push({
        id: `ar-${a.id}`,
        title: `Årlig gjennomgang ${a.year ?? ''}`.trim(),
        status,
        source: 'annual_review',
        legalRef: SOURCE_TO_LEGAL.annual_review,
        lawPillar: 'AML',
        href: '/internkontroll/arsgjenomgang',
      })
    }

    // 4) Open inspections (one synthetic item per round bucket so the column is meaningful)
    if (hse.stats.openInspections > 0) {
      items.push({
        id: 'hse-open-inspections',
        title: `${hse.stats.openInspections} åpne inspeksjoner`,
        status: 'open',
        source: 'inspection',
        legalRef: SOURCE_TO_LEGAL.inspection,
        href: '/hse',
      })
    }

    // 5) Open SJA
    if (hse.stats.openSja > 0) {
      items.push({
        id: 'hse-open-sja',
        title: `${hse.stats.openSja} SJA-utkast`,
        status: 'open',
        source: 'sja',
        legalRef: SOURCE_TO_LEGAL.sja,
        href: '/hse',
      })
    }

    // 6) Expired training
    if (hse.stats.expiredTraining > 0) {
      items.push({
        id: 'hse-expired-training',
        title: `${hse.stats.expiredTraining} sertifikat/opplæring utløpt`,
        status: 'overdue',
        source: 'training',
        legalRef: SOURCE_TO_LEGAL.training,
        priority: 'high',
        href: '/internkontroll/kompetanse',
      })
    }

    // 7) HR drøftelsessamtaler (AML § 15-1) — open until signed/locked
    for (const m of hr.meetings) {
      if (m.status === 'locked') continue
      const status: ComplianceItemStatus =
        m.status === 'pending_signatures' ? 'awaiting_signature' : 'open'
      const subject = m.employee_display_name ?? 'ansatt'
      items.push({
        id: `hr-disc-${m.id}`,
        title: `Drøftelsessamtale — ${subject}`,
        status,
        source: 'hr_discussion',
        legalRef: SOURCE_TO_LEGAL.hr_discussion,
        dueDate: m.meeting_at,
        href: '/hr/discussion',
      })
    }

    // 8) HR consultation cases (drøfting AML kap. 8) — open cases
    for (const c of hr.cases) {
      if (c.status === 'closed') continue
      items.push({
        id: `hr-con-${c.id}`,
        title: `Drøfting — ${c.title}`,
        status: 'open',
        source: 'hr_consultation',
        legalRef: SOURCE_TO_LEGAL.hr_consultation,
        href: '/hr/consultation',
      })
    }

    // 9) Open surveys (organisasjonshelse)
    for (const s of oh.surveys) {
      if (s.status !== 'open') continue
      items.push({
        id: `survey-${s.id}`,
        title: s.title,
        status: 'in_progress',
        source: 'survey',
        legalRef: SOURCE_TO_LEGAL.survey,
        href: `/org-health`,
      })
    }

    const counts: ComplianceCounts = {
      open: 0,
      in_progress: 0,
      awaiting_signature: 0,
      overdue: 0,
      completed: 0,
      total: items.length,
    }
    for (const it of items) counts[it.status] += 1

    return { items, counts, loading: ik.loading || hr.loading }
  }, [
    ic.rosAssessments,
    ic.annualReviews,
    hse.stats,
    ik.actionPlans,
    ik.loading,
    hr.meetings,
    hr.cases,
    hr.loading,
    oh.surveys,
  ])
}
