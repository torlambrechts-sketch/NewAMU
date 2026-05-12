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
// Holdes synkronisert manuelt med inventory.
export const UNMAPPED_REQUIREMENTS = [
  { lovkrav: 'AML § 9-1 til § 9-4 (kontrolltiltak)', omrade: 'Overvåking/kontroll', foreslattMal: 'tpl-kontrolltiltak-policy', prioritet: 'Høy' },
  { lovkrav: 'AML § 9-3 (innsyn i e-post)', omrade: 'Personvern', foreslattMal: 'tpl-epost-innsyn-prosedyre', prioritet: 'Middels' },
  { lovkrav: 'AML § 13-4 / LDL § 19 (rekrutterings-opplysninger)', omrade: 'Rekruttering', foreslattMal: 'tpl-rekrutterings-policy', prioritet: 'Middels' },
  { lovkrav: 'AML § 14-1 (info om ledig stilling)', omrade: 'Rekruttering', foreslattMal: 'Rekrutterings-modul', prioritet: 'Lav' },
  { lovkrav: 'AML § 14-7 (endring i arbeidsforhold)', omrade: 'Personal', foreslattMal: 'tpl-tilleggsavtale', prioritet: 'Middels' },
  { lovkrav: 'AML § 14-10 (åremål)', omrade: 'Personal', foreslattMal: 'tpl-aremaal-avtale', prioritet: 'Lav' },
  { lovkrav: 'AML § 15-2 (masseoppsigelser)', omrade: 'Personal', foreslattMal: 'tpl-massensuoppsigelse-info', prioritet: 'Middels' },
  { lovkrav: 'AML § 15-4, § 15-5 (oppsigelses-brev)', omrade: 'Personal', foreslattMal: 'tpl-oppsigelse-brev', prioritet: 'Høy' },
  { lovkrav: 'AML § 15-10 (verneplikt-vern)', omrade: 'Personal', foreslattMal: 'tpl-verneplikt-tilrettelegging', prioritet: 'Lav' },
  { lovkrav: 'AML § 15-13 (suspensjon)', omrade: 'Personal', foreslattMal: 'tpl-suspensjon-protokoll', prioritet: 'Middels' },
  { lovkrav: 'AML § 15-14 (avskjed)', omrade: 'Personal', foreslattMal: 'tpl-avskjed-brev', prioritet: 'Middels' },
  { lovkrav: 'AML § 15-15 (attest)', omrade: 'Personal', foreslattMal: 'tpl-attest', prioritet: 'Middels' },
  { lovkrav: 'AML kap. 10-5 til 10-12 (arbeidstid)', omrade: 'Arbeidstid', foreslattMal: 'Tasks-modul + HR-integrasjon', prioritet: 'Høy' },
  { lovkrav: 'AML kap. 11 (barn og ungdom)', omrade: 'Læring', foreslattMal: 'c-aml-ungdomsarbeid', prioritet: 'Lav' },
  { lovkrav: 'AML kap. 16 (virksomhetsoverdragelse)', omrade: 'Personal', foreslattMal: 'tpl-virksomhetsoverdragelse', prioritet: 'Lav' },
  { lovkrav: 'LDL § 28 (universell utforming)', omrade: 'Tilrettelegging', foreslattMal: 'tpl-uu-vurdering', prioritet: 'Middels' },
  { lovkrav: 'GDPR Art. 15–21 (individrettigheter)', omrade: 'Personvern', foreslattMal: 'tpl-personvern-individrettigheter-prosedyre', prioritet: 'Høy' },
  { lovkrav: 'GDPR Art. 28 (databehandler-avtale)', omrade: 'Personvern', foreslattMal: 'tpl-dpa', prioritet: 'Høy' },
  // GDPR Art. 33–34 ble lukket i fase 3 — se admin/gdpr_breach + gdpr_breach_incidents
  { lovkrav: 'Stoff-kartotek (Forskr. utf. § 1-7)', omrade: 'Kjemikalier', foreslattMal: 'Eco-Online-sync edge function', prioritet: 'Middels' },
  { lovkrav: 'AML § 5-2 yrkesskade-melding', omrade: 'Skade', foreslattMal: 'NAV-skjema-integrasjon', prioritet: 'Middels' },
  { lovkrav: 'Brannvern § 5–11 (forebyggende)', omrade: 'Beredskap', foreslattMal: 'tpl-brannvern-plan (splitt fra beredskap)', prioritet: 'Lav' },
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
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!supabase || !organization?.id) return
    let cancelled = false
    void Promise.all([
      supabase
        .from('org_role_requirement_instances')
        .select('id, user_id, role_slug, requirement_kind, resource_id, resource_label, hjemmel, status, severity, due_at, completed_at')
        .eq('organization_id', organization.id),
      supabase
        .from('profiles')
        .select('id, display_name')
        .eq('organization_id', organization.id),
      supabase
        .from('gdpr_breach_status_view')
        .select('*')
        .eq('organization_id', organization.id)
        .maybeSingle(),
    ]).then(([iRes, pRes, bRes]) => {
      if (cancelled) return
      setInstances((iRes.data ?? []) as Instance[])
      setProfiles((pRes.data ?? []) as Profile[])
      setBreachStatus(bRes.data as typeof breachStatus)
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

    return {
      cc_kpi_summary: {
        total,
        completed,
        overdue,
        pending,
        criticalOpen,
        unmappedCount,
        complianceRate,
        breachActive,
        breachOverdue,
        breachDueWithin24h,
      },
      cc_status_distribution: statusDist,
      cc_kind_distribution: kindDist,
      cc_severity_distribution: sevDist,
      cc_role_status_heatmap: heatmapRows,
      cc_overdue_table: overdueRows,
      cc_modules_coverage: moduleRows,
      cc_unmapped_requirements: UNMAPPED_REQUIREMENTS,
    }
  }, [instances, profiles, breachStatus, loaded, filters])
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
