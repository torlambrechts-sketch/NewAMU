// useRoleComplianceDatasets — datasets for role_compliance dashboard scope.
//
// Pragmatisk fase 1-implementasjon: bruker eksisterende
// training_matrix_view (innført i 20260902120400) + functional_roles +
// org_active_role_holders + organisations.employee-count for terskel-
// brudd-deteksjon.
//
// Når fase 2 av role-compliance-arkitekturen leverer
// org_role_requirement_instances (jf. specs/role-compliance-architecture.md),
// utvides denne hooken til å lese derfra og dekke ack/sign/møte/survey/
// checklist/ros-krav også. Foreløpig dekker vi bare opplærings-aksen.

import { useEffect, useMemo, useState } from 'react'
import type { DashboardFilter } from '../../../lib/dashboards/dashboardFilters'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

type TrainingRow = {
  role_slug: string
  role_label: string
  user_id: string
  user_name: string | null
  course_id: string
  course_title: string
  completed_at: string | null
  completion_status: 'not_started' | 'completed' | 'expired' | 'expiring_soon'
}

type RoleCatalog = {
  slug: string
  label: string
  required_from_employees: number | null
}

type RoleHolder = {
  role_slug: string
  user_id: string
}

type Selectors = {
  roles: Set<string> | null
  courses: Set<string> | null
}

function buildSelectors(filters: DashboardFilter[]): Selectors {
  const out: Selectors = { roles: null, courses: null }
  for (const f of filters) {
    if (f.dimensionId === 'role') {
      out.roles = new Set(Array.isArray(f.value) ? (f.value as string[]) : f.value ? [String(f.value)] : [])
      if (out.roles.size === 0) out.roles = null
    } else if (f.dimensionId === 'course') {
      out.courses = new Set(Array.isArray(f.value) ? (f.value as string[]) : f.value ? [String(f.value)] : [])
      if (out.courses.size === 0) out.courses = null
    }
  }
  return out
}

export function useRoleComplianceDatasets(
  filters: DashboardFilter[],
): Record<string, unknown> {
  const { supabase, organization } = useOrgSetupContext()
  const [training, setTraining] = useState<TrainingRow[]>([])
  const [catalog, setCatalog] = useState<RoleCatalog[]>([])
  const [holders, setHolders] = useState<RoleHolder[]>([])
  const [employeeCount, setEmployeeCount] = useState<number>(0)

  useEffect(() => {
    if (!supabase || !organization?.id) return
    let cancelled = false
    void Promise.all([
      supabase
        .from('training_matrix_view')
        .select('role_slug, role_label, user_id, user_name, course_id, course_title, completed_at, completion_status')
        .eq('organization_id', organization.id),
      supabase.from('functional_roles').select('slug, label, required_from_employees').eq('is_active', true),
      supabase
        .from('org_active_role_holders')
        .select('role_slug, user_id')
        .eq('organization_id', organization.id),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id),
    ]).then(([tRes, cRes, hRes, pRes]) => {
      if (cancelled) return
      setTraining(((tRes.data ?? []) as TrainingRow[]))
      setCatalog(((cRes.data ?? []) as RoleCatalog[]))
      setHolders(((hRes.data ?? []) as RoleHolder[]))
      setEmployeeCount(pRes.count ?? 0)
    })
    return () => {
      cancelled = true
    }
  }, [supabase, organization?.id])

  return useMemo(() => {
    const sel = buildSelectors(filters)
    const filteredTraining = training.filter((r) => {
      if (sel.roles && !sel.roles.has(r.role_slug)) return false
      if (sel.courses && !sel.courses.has(r.course_id)) return false
      return true
    })

    // KPI summary
    const activeRoleSlugs = new Set(holders.map((h) => h.role_slug))
    const totalAssignments = holders.length
    const trainingCompleted = filteredTraining.filter((r) => r.completion_status === 'completed').length
    const trainingOverdue = filteredTraining.filter((r) => r.completion_status === 'expired').length
    const trainingExpiringSoon = filteredTraining.filter((r) => r.completion_status === 'expiring_soon').length
    const trainingNotStarted = filteredTraining.filter((r) => r.completion_status === 'not_started').length

    // Terskel-brudd: pliktige roller med required_from_employees ≤ employeeCount
    // som ikke har innehavere
    const thresholdViolations = catalog.filter((r) => {
      if (r.required_from_employees == null) return false
      if (employeeCount < r.required_from_employees) return false
      return !activeRoleSlugs.has(r.slug)
    }).length

    const kpiSummary = {
      activeRoles: activeRoleSlugs.size,
      totalAssignments,
      trainingCompleted,
      trainingOverdue,
      trainingExpiringSoon,
      trainingNotStarted,
      thresholdViolations,
      employeeCount,
    }

    // Status-fordeling (donut)
    const statusDist = {
      Bestått: trainingCompleted,
      'Utløper snart': trainingExpiringSoon,
      Forfalt: trainingOverdue,
      'Ikke startet': trainingNotStarted,
    }

    // Innehavere per rolle (bar)
    const roleCounts = new Map<string, { label: string; count: number }>()
    for (const h of holders) {
      const meta = catalog.find((c) => c.slug === h.role_slug)
      const label = meta?.label ?? h.role_slug
      const cur = roleCounts.get(h.role_slug) ?? { label, count: 0 }
      cur.count += 1
      roleCounts.set(h.role_slug, cur)
    }
    const roleDistribution = Object.fromEntries(
      [...roleCounts.values()]
        .sort((a, b) => b.count - a.count)
        .map((r) => [r.label, r.count]),
    )

    // Krav etter type — i fase 1 har vi bare 'course'; gir illustrasjon
    const kindDistribution = {
      Kurs: filteredTraining.length,
      // Fase 2: legg til ack, sign, meeting, survey, checklist, ros
    }

    // Topp-mangler — per (rolle, kurs) hvor mange mangler
    const gapKey = (r: TrainingRow) => `${r.role_slug}|${r.course_id}`
    const gaps = new Map<string, { role: string; course: string; missingCount: number; totalCount: number }>()
    for (const r of filteredTraining) {
      const k = gapKey(r)
      const cur = gaps.get(k) ?? {
        role: r.role_label,
        course: r.course_title,
        missingCount: 0,
        totalCount: 0,
      }
      cur.totalCount += 1
      if (r.completion_status !== 'completed') cur.missingCount += 1
      gaps.set(k, cur)
    }
    const topGaps = [...gaps.values()]
      .filter((g) => g.missingCount > 0)
      .sort((a, b) => b.missingCount - a.missingCount)
      .slice(0, 10)

    // Forfalt — personer
    const overduePersons = filteredTraining
      .filter((r) => r.completion_status === 'expired')
      .map((r) => {
        const completed = r.completed_at ? new Date(r.completed_at) : null
        const daysOverdue = completed
          ? Math.floor((Date.now() - completed.getTime()) / (1000 * 60 * 60 * 24))
          : 0
        return {
          name: r.user_name ?? '—',
          role: r.role_label,
          course: r.course_title,
          daysOverdue,
        }
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 20)

    // Heatmap rolle × kurs — fullføringsprosent per celle
    const cellsMap = new Map<string, { role: string; course: string; completed: number; total: number }>()
    for (const r of filteredTraining) {
      const k = `${r.role_label}|${r.course_title}`
      const cur = cellsMap.get(k) ?? { role: r.role_label, course: r.course_title, completed: 0, total: 0 }
      cur.total += 1
      if (r.completion_status === 'completed') cur.completed += 1
      cellsMap.set(k, cur)
    }
    const heatmapRows = [...cellsMap.values()].map((c) => ({
      row: c.role,
      column: c.course,
      value: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
      _label: `${c.completed}/${c.total}`,
    }))

    // Terskel-brudd-tabell
    const thresholdRows = catalog
      .filter((r) => r.required_from_employees != null && employeeCount >= (r.required_from_employees ?? 0))
      .map((r) => {
        const currentHolders = holders.filter((h) => h.role_slug === r.slug).length
        return {
          role: r.label,
          requiredFrom: r.required_from_employees,
          currentEmployees: employeeCount,
          currentHolders,
          _violation: currentHolders === 0,
        }
      })
      .filter((r) => r._violation || r.currentHolders === 0)

    return {
      role_compliance_kpi_summary: kpiSummary,
      role_compliance_status_distribution: statusDist,
      role_compliance_role_distribution: roleDistribution,
      role_compliance_kind_distribution: kindDistribution,
      role_compliance_top_gaps: topGaps,
      role_compliance_overdue_persons: overduePersons,
      role_compliance_role_x_course_heatmap: heatmapRows,
      role_compliance_threshold_violations: thresholdRows,
    }
  }, [training, catalog, holders, employeeCount, filters])
}

// Eksporter dimensjoner som AdminPage kan registrere
export function buildRoleComplianceDimensions(
  catalog: { slug: string; label: string }[],
  courses: { id: string; title: string }[],
) {
  return [
    {
      id: 'role',
      label: 'Rolle',
      description: 'Filtrer på funksjonell rolle.',
      kind: 'enum' as const,
      defaultOperator: 'in' as const,
      loadOptions: () => catalog.map((c) => ({ id: c.slug, label: c.label })),
    },
    {
      id: 'course',
      label: 'Kurs',
      description: 'Filtrer på kurs.',
      kind: 'enum' as const,
      defaultOperator: 'in' as const,
      loadOptions: () => courses.map((c) => ({ id: c.id, label: c.title })),
    },
  ]
}
