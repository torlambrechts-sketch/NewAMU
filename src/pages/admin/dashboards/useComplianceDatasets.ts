// useComplianceDatasets — fôrer både compliance_company og
// compliance_personal scopes. Leser org_role_requirement_instances +
// role_compliance_status_view.
//
// Inkluderer ærlig «ikke-dekkede lovkrav»-liste fra inventory-specen
// (specs/aml-requirements-inventory.md §11). Listen er statisk fordi den
// representerer arkitektoniske gap, ikke per-org-data.

import { useEffect, useMemo, useState } from 'react'
import type { DashboardFilter } from '../../../lib/dashboards/dashboardFilters'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

type Instance = {
  id: string
  user_id: string
  role_slug: string
  requirement_kind: string
  resource_id: string
  resource_label: string
  hjemmel: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'waived' | 'superseded'
  severity: 'low' | 'medium' | 'high' | 'critical' | null
  due_at: string | null
  completed_at: string | null
}

type Profile = { id: string; display_name: string | null }

const KIND_LABELS: Record<string, string> = {
  course: 'Kurs',
  document_ack: 'Dokument-kvittering',
  document_sign: 'Dokument-signatur',
  meeting_invite: 'Møte',
  survey_response: 'Undersøkelse',
  checklist_item: 'Sjekkliste',
  task_owner: 'Oppgave',
  ros_signature: 'ROS-signatur',
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Oppfylt',
  pending: 'Venter',
  in_progress: 'Pågår',
  overdue: 'Forfalt',
  waived: 'Frafalt',
  superseded: 'Overtatt',
}

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Kritisk',
  high: 'Høy',
  medium: 'Middels',
  low: 'Lav',
}

// Ærlig liste over IKKE-dekkede krav — fra specs/aml-requirements-inventory.md §11
// Sprint 3 lukket 11 av 13 gaps. Gjenstår 2 som krever HR/ekstern­integrasjon:
export const UNMAPPED_REQUIREMENTS = [
  { lovkrav: 'AML § 14-1 (info om ledig stilling)', omrade: 'Rekruttering', foreslattMal: 'Egen rekrutterings-modul med stillings­annonse-mal', prioritet: 'Lav' },
  { lovkrav: 'AML kap. 10-5 til 10-12 (arbeidstid — automatisk overvåking)', omrade: 'Arbeidstid', foreslattMal: 'HR-system-integrasjon (Visma) — fase 6 B2b', prioritet: 'Høy' },
  { lovkrav: 'Stoff-kartotek (Forskr. utf. § 1-7) — auto-synk', omrade: 'Kjemikalier', foreslattMal: 'Eco-Online-sync edge function — fase 6 A4', prioritet: 'Middels' },
]

export function useComplianceCompanyDatasets(filters: DashboardFilter[]): Record<string, unknown> {
  const { supabase, organization } = useOrgSetupContext()
  const [instances, setInstances] = useState<Instance[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [breachStatus, setBreachStatus] = useState<{
    detected_count?: number
    investigating_count?: number
    reported_count?: number
    overdue_count?: number
    due_within_24h_count?: number
    nearest_deadline_at?: string | null
  } | null>(null)
  // Cross-modul-aggregat (selskap-bredt, uavhengig av rolle-tildelinger)
  const [moduleStats, setModuleStats] = useState<{
    learningTotal: number
    learningCompleted: number
    learningExpired: number
    docsTotal: number
    docsRequiringAck: number
    docsAcked: number
    checklistsTotal: number
    checklistsSigned: number
    checklistsOpen: number
    rosTotal: number
    rosApproved: number
    rosDraft: number
    tasksOpen: number
    tasksOverdue: number
    surveysActive: number
    surveysClosed: number
    meetingsTotal: number
    meetingsCompleted: number
    employeeCount: number
  }>({
    learningTotal: 0, learningCompleted: 0, learningExpired: 0,
    docsTotal: 0, docsRequiringAck: 0, docsAcked: 0,
    checklistsTotal: 0, checklistsSigned: 0, checklistsOpen: 0,
    rosTotal: 0, rosApproved: 0, rosDraft: 0,
    tasksOpen: 0, tasksOverdue: 0,
    surveysActive: 0, surveysClosed: 0,
    meetingsTotal: 0, meetingsCompleted: 0,
    employeeCount: 0,
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!supabase || !organization?.id) return
    let cancelled = false
    const orgId = organization.id

    void Promise.all([
      // Rolle-baserte instanser (eksisterende)
      supabase
        .from('org_role_requirement_instances')
        .select('id, user_id, role_slug, requirement_kind, resource_id, resource_label, hjemmel, status, severity, due_at, completed_at')
        .eq('organization_id', orgId),
      supabase.from('profiles').select('id, display_name').eq('organization_id', orgId),
      supabase.from('gdpr_breach_status_view').select('*').eq('organization_id', orgId).maybeSingle(),
      // ── Cross-modul-aggregat ──
      // Læring: alle org-kurs + fullføringer
      supabase.from('learning_courses').select('id, recertification_months', { count: 'exact', head: false })
        .eq('organization_id', orgId).eq('status', 'published'),
      supabase.from('learning_course_progress')
        .select('course_id, completed_at')
        .eq('organization_id', orgId),
      // Dokumenter: publiserte sider med ack-krav + receipts
      supabase.from('wiki_pages')
        .select('id, requires_acknowledgement', { count: 'exact', head: false })
        .eq('organization_id', orgId).eq('status', 'published'),
      supabase.from('wiki_compliance_receipts')
        .select('page_id, user_id', { count: 'exact', head: true })
        .eq('organization_id', orgId),
      // Compliance-sjekklister
      supabase.from('compliance_checklist_executions')
        .select('id, status, signed_at')
        .eq('organization_id', orgId),
      // ROS
      supabase.from('ros_analyses').select('id, status').eq('organization_id', orgId),
      // Tasks (avvik)
      supabase.from('task_items').select('id, status, due_date').eq('organization_id', orgId),
      // Surveys
      supabase.from('surveys').select('id, status').eq('organization_id', orgId),
      // Meetings
      supabase.from('meetings').select('id, status').eq('organization_id', orgId),
      // Employee-count
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
    ]).then(([
      iRes, pRes, bRes,
      learnCourseRes, learnProgRes,
      docsRes, docsReceiptsRes,
      checklistsRes, rosRes, tasksRes, surveysRes, meetingsRes, empRes,
    ]) => {
      if (cancelled) return
      setInstances(((iRes.data ?? []) as Instance[]))
      setProfiles(((pRes.data ?? []) as Profile[]))
      setBreachStatus(bRes.data as typeof breachStatus)

      // Læring
      const learnCourses = (learnCourseRes.data ?? []) as { id: string; recertification_months: number | null }[]
      const learnProg = (learnProgRes.data ?? []) as { course_id: string; completed_at: string | null }[]
      const now = Date.now()
      const oneMonth = 1000 * 60 * 60 * 24 * 30
      let learningExpired = 0
      const courseRecert = new Map(learnCourses.map((c) => [c.id, c.recertification_months]))
      for (const p of learnProg) {
        if (!p.completed_at) continue
        const recert = courseRecert.get(p.course_id)
        if (recert && new Date(p.completed_at).getTime() + recert * oneMonth < now) learningExpired += 1
      }

      // Sjekklister
      const checklists = (checklistsRes.data ?? []) as { status: string; signed_at: string | null }[]
      const checklistsSigned = checklists.filter((c) => c.signed_at != null).length
      const checklistsOpen = checklists.filter((c) => !c.signed_at && c.status !== 'cancelled').length

      // ROS
      const ros = (rosRes.data ?? []) as { status: string }[]
      const rosApproved = ros.filter((r) => r.status === 'approved').length
      const rosDraft = ros.filter((r) => r.status === 'draft' || r.status === 'in_review').length

      // Tasks
      const tasks = (tasksRes.data ?? []) as { status: string; due_date: string | null }[]
      const tasksOpen = tasks.filter((t) => t.status !== 'done').length
      const tasksOverdue = tasks.filter((t) => t.status !== 'done' && t.due_date && new Date(t.due_date).getTime() < now).length

      // Surveys
      const surveys = (surveysRes.data ?? []) as { status: string }[]
      const surveysActive = surveys.filter((s) => s.status === 'active').length
      const surveysClosed = surveys.filter((s) => s.status === 'closed').length

      // Meetings
      const meetings = (meetingsRes.data ?? []) as { status: string }[]
      const meetingsCompleted = meetings.filter((m) => m.status === 'completed').length

      // Documents requiring ack
      const docs = (docsRes.data ?? []) as { id: string; requires_acknowledgement: boolean }[]
      const docsRequiringAck = docs.filter((d) => d.requires_acknowledgement).length

      setModuleStats({
        learningTotal: learnCourses.length,
        learningCompleted: learnProg.filter((p) => p.completed_at != null).length,
        learningExpired,
        docsTotal: docsRes.count ?? docs.length,
        docsRequiringAck,
        docsAcked: docsReceiptsRes.count ?? 0,
        checklistsTotal: checklists.length,
        checklistsSigned,
        checklistsOpen,
        rosTotal: ros.length,
        rosApproved,
        rosDraft,
        tasksOpen,
        tasksOverdue,
        surveysActive,
        surveysClosed,
        meetingsTotal: meetings.length,
        meetingsCompleted,
        employeeCount: empRes.count ?? 0,
      })

      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [supabase, organization?.id])

  return useMemo(() => {
    const profileMap = new Map(profiles.map((p) => [p.id, p.display_name ?? '—']))
    const total = instances.length
    const completed = instances.filter((i) => i.status === 'completed').length
    const overdue = instances.filter((i) => i.status === 'overdue').length
    const pending = instances.filter((i) => i.status === 'pending' || i.status === 'in_progress').length
    const criticalOpen = instances.filter(
      (i) => (i.severity === 'high' || i.severity === 'critical') &&
             i.status !== 'completed' && i.status !== 'waived' && i.status !== 'superseded',
    ).length
    const unmappedCount = UNMAPPED_REQUIREMENTS.length
    const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 0

    const statusDist: Record<string, number> = {}
    for (const i of instances) {
      const k = STATUS_LABELS[i.status] ?? i.status
      statusDist[k] = (statusDist[k] ?? 0) + 1
    }

    const kindDist: Record<string, number> = {}
    for (const i of instances) {
      const k = KIND_LABELS[i.requirement_kind] ?? i.requirement_kind
      kindDist[k] = (kindDist[k] ?? 0) + 1
    }

    const sevDist: Record<string, number> = {}
    for (const i of instances) {
      const s = i.severity ?? 'medium'
      const k = SEVERITY_LABELS[s] ?? s
      sevDist[k] = (sevDist[k] ?? 0) + 1
    }

    // Heatmap rolle × status — antall instanser per celle
    const heatmapCells = new Map<string, { row: string; column: string; count: number }>()
    for (const i of instances) {
      const key = `${i.role_slug}|${i.status}`
      const cur = heatmapCells.get(key) ?? {
        row: i.role_slug,
        column: STATUS_LABELS[i.status] ?? i.status,
        count: 0,
      }
      cur.count += 1
      heatmapCells.set(key, cur)
    }
    const heatmapRows = [...heatmapCells.values()].map((c) => ({
      row: c.row,
      column: c.column,
      value: c.count,
    }))

    const overdueRows = instances
      .filter((i) => i.status === 'overdue')
      .map((i) => {
        const due = i.due_at ? new Date(i.due_at) : null
        return {
          user: profileMap.get(i.user_id) ?? '—',
          role: i.role_slug,
          kind: KIND_LABELS[i.requirement_kind] ?? i.requirement_kind,
          resource: i.resource_label,
          daysOverdue: due ? Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24)) : 0,
          hjemmel: i.hjemmel ?? '',
        }
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 50)

    // Per-modul-dekning
    const moduleRows = Object.keys(KIND_LABELS).map((kind) => {
      const sub = instances.filter((i) => i.requirement_kind === kind)
      const tComp = sub.filter((i) => i.status === 'completed').length
      const tOver = sub.filter((i) => i.status === 'overdue').length
      const owners = new Map<string, number>()
      for (const i of sub) {
        const name = profileMap.get(i.user_id) ?? '—'
        owners.set(name, (owners.get(name) ?? 0) + 1)
      }
      const topOwners = [...owners.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([n]) => n)
        .join(', ')
      return {
        kind: KIND_LABELS[kind],
        totalRequirements: sub.length,
        completed: tComp,
        overdue: tOver,
        topOwners: topOwners || '—',
      }
    }).filter((r) => r.totalRequirements > 0)

    const breachActive = (breachStatus?.detected_count ?? 0) + (breachStatus?.investigating_count ?? 0)
    const breachOverdue = breachStatus?.overdue_count ?? 0
    const breachDueWithin24h = breachStatus?.due_within_24h_count ?? 0

    // ── Cross-modul-aggregat — selskap-bredt ─────────────────────────────
    // Beregn coverage rates på tvers av moduler, ikke bare rolle-instanser.
    const ms = moduleStats
    const learningRate = ms.learningTotal > 0 && ms.employeeCount > 0
      ? Math.round((ms.learningCompleted / (ms.learningTotal * ms.employeeCount)) * 100)
      : 0
    const docsAckRate = ms.docsRequiringAck > 0 && ms.employeeCount > 0
      ? Math.round((ms.docsAcked / (ms.docsRequiringAck * ms.employeeCount)) * 100)
      : 0
    const checklistsCompletionRate = ms.checklistsTotal > 0
      ? Math.round((ms.checklistsSigned / ms.checklistsTotal) * 100)
      : 0
    const rosApprovalRate = ms.rosTotal > 0
      ? Math.round((ms.rosApproved / ms.rosTotal) * 100)
      : 0

    // Modul-health-tabell: viser status per HMS-modul org-bredt
    const modulesHealth = [
      {
        module: 'Læring (kurs)',
        total: ms.learningTotal * ms.employeeCount,
        completed: ms.learningCompleted,
        gap: ms.learningTotal * ms.employeeCount - ms.learningCompleted,
        overdueOrExpired: ms.learningExpired,
        coveragePct: learningRate,
      },
      {
        module: 'Dokumenter (kvittering)',
        total: ms.docsRequiringAck * ms.employeeCount,
        completed: ms.docsAcked,
        gap: Math.max(0, ms.docsRequiringAck * ms.employeeCount - ms.docsAcked),
        overdueOrExpired: 0,
        coveragePct: docsAckRate,
      },
      {
        module: 'Compliance-sjekklister',
        total: ms.checklistsTotal,
        completed: ms.checklistsSigned,
        gap: ms.checklistsOpen,
        overdueOrExpired: 0,
        coveragePct: checklistsCompletionRate,
      },
      {
        module: 'ROS / risikovurdering',
        total: ms.rosTotal,
        completed: ms.rosApproved,
        gap: ms.rosDraft,
        overdueOrExpired: 0,
        coveragePct: rosApprovalRate,
      },
      {
        module: 'Avvik (tasks)',
        total: ms.tasksOpen,
        completed: 0,
        gap: ms.tasksOpen,
        overdueOrExpired: ms.tasksOverdue,
        coveragePct: 0,
      },
      {
        module: 'Møter (AMU/styre)',
        total: ms.meetingsTotal,
        completed: ms.meetingsCompleted,
        gap: ms.meetingsTotal - ms.meetingsCompleted,
        overdueOrExpired: 0,
        coveragePct: ms.meetingsTotal > 0 ? Math.round((ms.meetingsCompleted / ms.meetingsTotal) * 100) : 0,
      },
      {
        module: 'Undersøkelser',
        total: ms.surveysActive + ms.surveysClosed,
        completed: ms.surveysClosed,
        gap: ms.surveysActive,
        overdueOrExpired: 0,
        coveragePct: (ms.surveysActive + ms.surveysClosed) > 0
          ? Math.round((ms.surveysClosed / (ms.surveysActive + ms.surveysClosed)) * 100) : 0,
      },
      {
        module: 'Funksjonelle roller',
        total,
        completed,
        gap: pending,
        overdueOrExpired: overdue,
        coveragePct: complianceRate,
      },
    ]

    // Total cross-modul compliance (vektet aggregat)
    const totalCrossModule =
      ms.learningTotal * ms.employeeCount +
      ms.docsRequiringAck * ms.employeeCount +
      ms.checklistsTotal +
      ms.rosTotal +
      ms.meetingsTotal +
      total
    const completedCrossModule =
      ms.learningCompleted +
      ms.docsAcked +
      ms.checklistsSigned +
      ms.rosApproved +
      ms.meetingsCompleted +
      completed
    const overdueCrossModule = overdue + ms.tasksOverdue + ms.learningExpired
    const overallComplianceRate = totalCrossModule > 0
      ? Math.round((completedCrossModule / totalCrossModule) * 100)
      : 0

    return {
      cc_kpi_summary: {
        // Cross-modul aggregert
        total: totalCrossModule,
        completed: completedCrossModule,
        overdue: overdueCrossModule,
        pending: totalCrossModule - completedCrossModule - overdueCrossModule,
        criticalOpen,
        unmappedCount,
        complianceRate: overallComplianceRate,
        breachActive,
        breachOverdue,
        breachDueWithin24h,
        // Per-modul detalj
        learningRate,
        docsAckRate,
        checklistsCompletionRate,
        rosApprovalRate,
        tasksOpen: ms.tasksOpen,
        tasksOverdue: ms.tasksOverdue,
        employeeCount: ms.employeeCount,
        // Rolle-spesifikt (det gamle)
        roleInstancesTotal: total,
        roleInstancesCompleted: completed,
      },
      cc_status_distribution: statusDist,
      cc_kind_distribution: kindDist,
      cc_severity_distribution: sevDist,
      cc_role_status_heatmap: heatmapRows,
      cc_overdue_table: overdueRows,
      cc_modules_coverage: moduleRows,
      cc_modules_health: modulesHealth,
      cc_unmapped_requirements: UNMAPPED_REQUIREMENTS,
    }
  }, [instances, profiles, breachStatus, moduleStats, loaded, filters])
}

export function useCompliancePersonalDatasets(): Record<string, unknown> {
  const { supabase, user } = useOrgSetupContext()
  const [instances, setInstances] = useState<Instance[]>([])

  useEffect(() => {
    if (!supabase || !user?.id) return
    let cancelled = false
    void supabase
      .from('org_role_requirement_instances')
      .select('id, user_id, role_slug, requirement_kind, resource_id, resource_label, hjemmel, status, severity, due_at, completed_at')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!cancelled) setInstances((data ?? []) as Instance[])
      })
    return () => { cancelled = true }
  }, [supabase, user?.id])

  return useMemo(() => {
    const now = Date.now()
    const oneDay = 1000 * 60 * 60 * 24
    const open = instances.filter((i) => i.status === 'pending' || i.status === 'in_progress').length
    const overdue = instances.filter((i) => i.status === 'overdue').length
    const completed = instances.filter((i) => i.status === 'completed').length
    const dueSoon = instances.filter((i) => {
      if (i.status !== 'pending' && i.status !== 'in_progress') return false
      if (!i.due_at) return false
      const days = (new Date(i.due_at).getTime() - now) / oneDay
      return days >= 0 && days < 14
    }).length

    const statusDist: Record<string, number> = {}
    for (const i of instances) {
      const k = STATUS_LABELS[i.status] ?? i.status
      statusDist[k] = (statusDist[k] ?? 0) + 1
    }

    const kindDist: Record<string, number> = {}
    for (const i of instances) {
      const k = KIND_LABELS[i.requirement_kind] ?? i.requirement_kind
      kindDist[k] = (kindDist[k] ?? 0) + 1
    }

    const roleCounts: Record<string, number> = {}
    for (const i of instances) {
      roleCounts[i.role_slug] = (roleCounts[i.role_slug] ?? 0) + 1
    }

    const openRows = instances
      .filter((i) => i.status === 'pending' || i.status === 'in_progress' || i.status === 'overdue')
      .map((i) => {
        const due = i.due_at ? new Date(i.due_at) : null
        return {
          role: i.role_slug,
          kind: KIND_LABELS[i.requirement_kind] ?? i.requirement_kind,
          resource: i.resource_label,
          dueAt: due ? due.toLocaleDateString('nb-NO') : '—',
          daysUntilDue: due ? Math.ceil((due.getTime() - now) / oneDay) : null,
          severity: SEVERITY_LABELS[i.severity ?? 'medium'] ?? '—',
        }
      })
      .sort((a, b) => (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999))

    const completedRows = instances
      .filter((i) => i.status === 'completed')
      .map((i) => ({
        role: i.role_slug,
        kind: KIND_LABELS[i.requirement_kind] ?? i.requirement_kind,
        resource: i.resource_label,
        completedAt: i.completed_at ? new Date(i.completed_at).toLocaleDateString('nb-NO') : '—',
      }))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))

    return {
      cp_kpi_summary: { open, overdue, dueSoon, completed },
      cp_status_distribution: statusDist,
      cp_kind_distribution: kindDist,
      cp_my_roles: roleCounts,
      cp_open_table: openRows,
      cp_completed_table: completedRows,
    }
  }, [instances])
}
