// ISO IMS datasets hook — computes dataset maps for the IsoImsAnalysePage.
//
// Queries: latest gap sessions per standard (score), SoA implementation
// count, open tasks per standard, legal compliance status distribution,
// upcoming audit checklist executions, and recent checklist findings.
//
// Returns an empty/zero record when data hasn't loaded yet so the
// dashboard renders placeholder KPIs immediately without flicker.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

type GapScores = {
  iso_9001: number | null
  iso_14001: number | null
  iso_45001: number | null
  iso_27001: number | null
}

type SoAStats = {
  implementedCount: number
  totalCount: number
  implementationRate: number
}

type StandardSegment = {
  label: string
  value: number
}

type AuditRow = {
  title: string
  standard: string
  scheduledFor: string | null
  status: string
}

type FindingRow = {
  title: string
  standard: string
  severity: string
  createdAt: string
}

type IsoImsDatasetsResult = {
  iso_gap_scores: GapScores
  iso_soa_implementation: SoAStats
  iso_open_capas_by_standard: StandardSegment[]
  iso_legal_compliance: StandardSegment[]
  iso_audit_schedule: AuditRow[]
  iso_recent_findings: FindingRow[]
}

function empty(): IsoImsDatasetsResult {
  return {
    iso_gap_scores: { iso_9001: null, iso_14001: null, iso_45001: null, iso_27001: null },
    iso_soa_implementation: { implementedCount: 0, totalCount: 93, implementationRate: 0 },
    iso_open_capas_by_standard: [],
    iso_legal_compliance: [],
    iso_audit_schedule: [],
    iso_recent_findings: [],
  }
}

export function useIsoImsDatasets(): IsoImsDatasetsResult & { loading: boolean } {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [data, setData] = useState<IsoImsDatasetsResult>(empty())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)

    try {
      // Gap scores — latest completed session per standard.
      const { data: gapRows } = await supabase
        .from('iso_gap_analysis_sessions')
        .select('standard, score_pct')
        .eq('organization_id', orgId)
        .eq('status', 'completed')
        .not('score_pct', 'is', null)
        .order('updated_at', { ascending: false })

      const gapScores: GapScores = {
        iso_9001: null,
        iso_14001: null,
        iso_45001: null,
        iso_27001: null,
      }
      for (const row of gapRows ?? []) {
        const key = row.standard?.replace('-', '_') as keyof GapScores
        if (key in gapScores && gapScores[key] === null) {
          gapScores[key] = row.score_pct
        }
      }

      // SoA implementation stats.
      const { data: soaRows } = await supabase
        .from('iso_27001_soa')
        .select('implementation_status')
        .eq('organization_id', orgId)

      const total = soaRows?.length ?? 0
      const implemented = (soaRows as Array<{ implementation_status: string }> | null)
        ?.filter((r) => r.implementation_status === 'implemented').length ?? 0
      const soaStats: SoAStats = {
        implementedCount: implemented,
        totalCount: total || 93,
        implementationRate: total > 0 ? Math.round((implemented / total) * 100) : 0,
      }

      // Open tasks sourced from ISO gap findings — grouped by standard via law_refs prefix.
      // law_refs format: ['ISO 9001:2015 § 9.2.2a'] — extract standard from prefix.
      const { data: taskRows } = await supabase
        .from('task_items')
        .select('source_type, law_refs')
        .eq('organization_id', orgId)
        .eq('source_type', 'iso_gap')
        .in('status', ['open', 'in_progress'])
        .is('deleted_at', null)

      const capaCounts: Record<string, number> = {}
      for (const row of taskRows ?? []) {
        const refs: string[] = (row.law_refs as string[] | null) ?? []
        const standard = refs[0]?.startsWith('ISO 9001') ? 'iso-9001'
          : refs[0]?.startsWith('ISO 14001') ? 'iso-14001'
          : refs[0]?.startsWith('ISO 45001') ? 'iso-45001'
          : refs[0]?.startsWith('ISO 27001') ? 'iso-27001'
          : 'andre'
        capaCounts[standard] = (capaCounts[standard] ?? 0) + 1
      }
      const openCapas: StandardSegment[] = Object.entries(capaCounts).map(([label, value]) => ({
        label,
        value,
      }))

      // Legal compliance status — from legal_compliance register records.
      // register_records stores field values in the `values` jsonb column.
      const { data: legalRows } = await supabase
        .from('register_records')
        .select('values')
        .eq('organization_id', orgId)
        .eq('register_type_id', 'legal_compliance')
        .neq('status', 'archived')
        .is('deleted_at', null)

      const legalCounts: Record<string, number> = {}
      for (const row of legalRows ?? []) {
        const status: string = (row.values as Record<string, unknown>)?.compliance_status as string ?? 'ukjent'
        legalCounts[status] = (legalCounts[status] ?? 0) + 1
      }
      const legalCompliance: StandardSegment[] = Object.entries(legalCounts).map(([label, value]) => ({
        label,
        value,
      }))

      // Upcoming audit checklist executions (ISO packs, status=draft/active, scheduled_for upcoming).
      const { data: auditRows } = await supabase
        .from('compliance_checklist_executions')
        .select('title, pack, status, scheduled_for')
        .eq('organization_id', orgId)
        .in('pack', ['iso-9001', 'iso-14001', 'iso-45001', 'iso-27001'])
        .in('status', ['draft', 'active'])
        .is('deleted_at', null)
        .order('scheduled_for', { ascending: true })
        .limit(10)

      type AuditQueryRow = { title: string; pack: string; status: string; scheduled_for: string | null }
      const auditSchedule: AuditRow[] = (auditRows as AuditQueryRow[] ?? []).map((r) => ({
        title: r.title,
        standard: r.pack,
        scheduledFor: r.scheduled_for,
        status: r.status,
      }))

      // Recent findings from ISO checklist executions.
      const { data: findingRows } = await supabase
        .from('compliance_checklist_responses')
        .select('item_key, severity, created_at, executions:execution_id(pack, title)')
        .eq('organization_id', orgId)
        .eq('is_finding', true)
        .order('created_at', { ascending: false })
        .limit(10)

      type FindingQueryRow = { item_key: string; severity: string | null; created_at: string; executions: { pack: string; title: string } | null }
      const recentFindings: FindingRow[] = (findingRows as FindingQueryRow[] ?? [])
        .filter((r) => {
          const exec = r.executions
          return exec !== null && ['iso-9001', 'iso-14001', 'iso-45001', 'iso-27001'].includes(exec.pack)
        })
        .map((r) => {
          const exec = r.executions as { pack: string; title: string }
          return {
            title: exec.title,
            standard: exec.pack,
            severity: r.severity ?? 'low',
            createdAt: r.created_at,
          }
        })

      setData({
        iso_gap_scores: gapScores,
        iso_soa_implementation: soaStats,
        iso_open_capas_by_standard: openCapas,
        iso_legal_compliance: legalCompliance,
        iso_audit_schedule: auditSchedule,
        iso_recent_findings: recentFindings,
      })
    } catch {
      // On error keep previous data — the page stays functional.
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => { void load() }, [load])

  return useMemo(() => ({ ...data, loading }), [data, loading])
}
