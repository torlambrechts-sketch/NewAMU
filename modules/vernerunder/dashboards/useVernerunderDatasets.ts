// useVernerunderDatasets — org-wide vernerunder + funn-aggregat.
//
// Det eksisterende useVernerunde-hooket laster funn lazy per runde
// (for å holde detaljside-fetches lette). For arbeidsmiljøstrategi-
// dashbordet trenger vi en samling på tvers av hele organisasjonen,
// så denne hooken kjører to lettvektige spørringer mot
// `vernerunder` + `vernerunde_findings` og bygger datasets-kartet.
//
// Hooken er trygg å kalle uten en vernerunde-side i kontekst — den
// laster sine egne data og returnerer tomme datasets inntil de
// kommer inn.

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import type { DashboardFilter } from '../../../src/lib/dashboards/dashboardFilters'
import type { VernerunderRow, VernerundeFindingRow } from '../types'

type DateBounds = { from: Date | null; to: Date | null }

function readDateBounds(filters: DashboardFilter[]): DateBounds {
  const out: DateBounds = { from: null, to: null }
  for (const f of filters) {
    if (f.dimensionId !== 'date') continue
    if (f.operator === 'between' && f.value && typeof f.value === 'object') {
      const r = f.value as { from?: string; to?: string }
      if (r.from) out.from = new Date(r.from)
      if (r.to) out.to = new Date(r.to + 'T23:59:59')
    } else if (f.operator === 'after' && typeof f.value === 'string' && f.value) {
      out.from = new Date(f.value)
    } else if (f.operator === 'before' && typeof f.value === 'string' && f.value) {
      out.to = new Date(f.value + 'T23:59:59')
    }
  }
  return out
}

function dateInRange(d: Date | null, { from, to }: DateBounds): boolean {
  if (!d) return true
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  completed: 'Fullført',
  signed: 'Signert',
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Lav',
  medium: 'Medium',
  high: 'Høy',
  critical: 'Kritisk',
}

export type UseVernerunderDatasetsArgs = {
  filters: DashboardFilter[]
}

export function useVernerunderDatasets({
  filters,
}: UseVernerunderDatasetsArgs): Record<string, unknown> {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [rounds, setRounds] = useState<VernerunderRow[]>([])
  const [findings, setFindings] = useState<VernerundeFindingRow[]>([])

  useEffect(() => {
    let cancelled = false
    if (!supabase || !orgId) return
    void (async () => {
      const [r, f] = await Promise.all([
        supabase
          .from('vernerunder')
          .select('id, organization_id, title, status, planned_date, template_id, created_at, updated_at')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('vernerunde_findings')
          .select('id, organization_id, vernerunde_id, checkpoint_id, category_id, description, severity, created_at, updated_at')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(1000),
      ])
      if (cancelled) return
      setRounds(((r.data as VernerunderRow[] | null) ?? []))
      setFindings(((f.data as VernerundeFindingRow[] | null) ?? []))
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  return useMemo(() => {
    const bounds = readDateBounds(filters)
    const filteredRounds = rounds.filter((r) =>
      dateInRange(r.planned_date ? new Date(r.planned_date) : new Date(r.created_at), bounds),
    )
    const filteredFindings = findings.filter((f) => dateInRange(new Date(f.created_at), bounds))

    const total = filteredRounds.length
    const statusCounts: Record<string, number> = {
      Kladd: 0, Aktiv: 0, Fullført: 0, Signert: 0,
    }
    let lastCompleted: Date | null = null
    for (const r of filteredRounds) {
      const label = STATUS_LABELS[r.status] ?? r.status
      statusCounts[label] = (statusCounts[label] ?? 0) + 1
      if ((r.status === 'completed' || r.status === 'signed')) {
        const d = new Date(r.updated_at || r.created_at)
        if (!lastCompleted || d > lastCompleted) lastCompleted = d
      }
    }

    const severityCounts: Record<string, number> = {
      Lav: 0, Medium: 0, Høy: 0, Kritisk: 0,
    }
    for (const f of filteredFindings) {
      const label = SEVERITY_LABELS[f.severity] ?? f.severity
      severityCounts[label] = (severityCounts[label] ?? 0) + 1
    }
    const findingsOpen = filteredFindings.length
    const findingsCritical = severityCounts.Kritisk
    const findingsHigh = severityCounts.Høy

    const now = new Date()
    const daysSinceLast = lastCompleted
      ? Math.max(0, Math.floor((now.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24)))
      : null

    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = (d: Date) =>
      d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })
    const months: { key: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: monthKey(d), label: monthLabel(d) })
    }
    const completedByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))
    for (const r of filteredRounds) {
      if (r.status !== 'completed' && r.status !== 'signed') continue
      const d = new Date(r.updated_at || r.created_at)
      const k = monthKey(d)
      if (completedByMonth.has(k)) {
        completedByMonth.set(k, (completedByMonth.get(k) ?? 0) + 1)
      }
    }

    const roundTitleById = new Map<string, string>(filteredRounds.map((r) => [r.id, r.title]))
    const recent = filteredFindings.slice(0, 25).map((f) => ({
      runde: roundTitleById.get(f.vernerunde_id) ?? '(ukjent)',
      severity: SEVERITY_LABELS[f.severity] ?? f.severity,
      description: f.description,
      createdAt: new Date(f.created_at).toLocaleDateString('nb-NO'),
    }))

    return {
      vernerunde_kpi_summary: {
        total,
        findingsOpen,
        findingsCritical,
        findingsHigh,
        daysSinceLast: daysSinceLast ?? '—',
      },
      vernerunde_status_distribution: statusCounts,
      vernerunde_findings_severity: severityCounts,
      vernerunde_completed_over_time: months.map((m) => ({
        x: m.label,
        y: completedByMonth.get(m.key) ?? 0,
      })),
      vernerunde_recent_findings: recent,
    } as Record<string, unknown>
  }, [filters, rounds, findings])
}
