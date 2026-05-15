// Bucketer for the alerts dashboard scope. Takes active filters + cases
// + templates + categories and produces Record<datasetKey, unknown>.

import { useMemo } from 'react'
import type { DashboardFilter } from '../../../src/lib/dashboards/dashboardFilters'
import type { AlertCaseRow, AlertCategoryRow, AlertKind, AlertSeverity, AlertStatus, AlertSystemTemplateRow } from '../types'
import { deriveAnonymityTier } from '../types'
import {
  ALERT_KIND_LABEL,
  ALERT_STATUS_LABEL,
  ALERT_SEVERITY_LABEL,
  ALERT_ANONYMITY_LABEL,
} from '../alertsLabels'

type Selectors = {
  kinds: Set<AlertKind> | null
  templates: Set<string> | null
  categories: Set<string> | null
  statuses: Set<AlertStatus> | null
  severities: Set<AlertSeverity> | null
  anonymity: Set<string> | null
  locations: Set<string> | null
  departments: Set<string> | null
  from: Date | null
  to: Date | null
}

function buildSelectors(filters: DashboardFilter[]): Selectors {
  const out: Selectors = {
    kinds: null, templates: null, categories: null, statuses: null,
    severities: null, anonymity: null, locations: null, departments: null,
    from: null, to: null,
  }
  const setOf = <T extends string>(v: unknown): Set<T> =>
    new Set(Array.isArray(v) ? (v as T[]) : typeof v === 'string' && v ? [v as T] : [])
  for (const f of filters) {
    if (f.dimensionId === 'kind') {
      const s = setOf<AlertKind>(f.value)
      if (s.size) out.kinds = s
    } else if (f.dimensionId === 'template') {
      const s = setOf<string>(f.value)
      if (s.size) out.templates = s
    } else if (f.dimensionId === 'category') {
      const s = setOf<string>(f.value)
      if (s.size) out.categories = s
    } else if (f.dimensionId === 'status') {
      const s = setOf<AlertStatus>(f.value)
      if (s.size) out.statuses = s
    } else if (f.dimensionId === 'severity') {
      const s = setOf<AlertSeverity>(f.value)
      if (s.size) out.severities = s
    } else if (f.dimensionId === 'anonymity') {
      const s = setOf<string>(f.value)
      if (s.size) out.anonymity = s
    } else if (f.dimensionId === 'location') {
      const s = setOf<string>(f.value)
      if (s.size) out.locations = s
    } else if (f.dimensionId === 'department') {
      const s = setOf<string>(f.value)
      if (s.size) out.departments = s
    } else if (f.dimensionId === 'date') {
      if (f.operator === 'between' && f.value && typeof f.value === 'object') {
        const r = f.value as { from?: string; to?: string }
        if (r.from) out.from = new Date(r.from)
        if (r.to) out.to = new Date(r.to + 'T23:59:59')
      } else if (f.operator === 'after' && typeof f.value === 'string') out.from = new Date(f.value)
      else if (f.operator === 'before' && typeof f.value === 'string') out.to = new Date(f.value + 'T23:59:59')
    }
  }
  return out
}

function applyFilters(rows: AlertCaseRow[], sel: Selectors): AlertCaseRow[] {
  return rows.filter((c) => {
    if (sel.kinds && !sel.kinds.has(c.kind)) return false
    if (sel.templates && !sel.templates.has(c.system_template_id ?? '') && !sel.templates.has(c.org_template_id ?? '')) return false
    if (sel.categories && !sel.categories.has(c.category_id ?? '')) return false
    if (sel.statuses && !sel.statuses.has(c.status)) return false
    if (sel.severities && (!c.severity || !sel.severities.has(c.severity))) return false
    if (sel.anonymity && !sel.anonymity.has(deriveAnonymityTier(c))) return false
    if (sel.locations && !sel.locations.has(c.location_id ?? '')) return false
    if (sel.departments && !sel.departments.has(c.department_id ?? '')) return false
    const received = new Date(c.received_at)
    if (sel.from && received < sel.from) return false
    if (sel.to && received > sel.to) return false
    return true
  })
}

function monthBuckets(rows: AlertCaseRow[], pick: (c: AlertCaseRow) => string | null): { x: string; y: number }[] {
  const counts = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i, 1)
    counts.set(d.toISOString().slice(0, 7), 0)
  }
  for (const r of rows) {
    const ts = pick(r)
    if (!ts) continue
    const k = ts.slice(0, 7)
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([k, v]) => ({ x: k, y: v }))
}

function distrib<T extends string | null>(rows: AlertCaseRow[], pick: (c: AlertCaseRow) => T, label: (k: NonNullable<T>) => string): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const k = pick(r)
    if (!k) continue
    counts.set(k as string, (counts.get(k as string) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: label(k as NonNullable<T>), value: v }))
}

export type UseAlertsDatasetsArgs = {
  filters: DashboardFilter[]
  cases: AlertCaseRow[]
  templates: AlertSystemTemplateRow[]
  categories: AlertCategoryRow[]
}

export function useAlertsDatasets(args: UseAlertsDatasetsArgs): Record<string, unknown> {
  return useMemo(() => {
    const sel = buildSelectors(args.filters)
    const rows = applyFilters(args.cases, sel)
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
    const now = new Date().toISOString()

    const openRows = rows.filter((r) => !['closed', 'dismissed'].includes(r.status))
    const overdueAck = rows.filter((r) => !r.acknowledged_at && r.acknowledgement_due_at < now && !['closed', 'dismissed'].includes(r.status))
    const overdueInv = rows.filter((r) => r.investigation_due_at && r.investigation_due_at < now && !['closed', 'dismissed'].includes(r.status))
    const closedYtd = rows.filter((r) => r.closed_at && r.closed_at > yearStart)
    const anonymous = rows.filter((r) => r.is_anonymous)
    const critical = rows.filter((r) => r.severity === 'critical')

    const tplLabel = new Map(args.templates.map((t) => [t.id, t.label]))
    const catLabel = new Map(args.categories.map((c) => [c.id, c.name]))

    const kpi_summary = {
      total: rows.length,
      openCases: openRows.length,
      overdueAcknowledgement: overdueAck.length,
      overdueInvestigation: overdueInv.length,
      closedYtd: closedYtd.length,
      anonymousShare: rows.length > 0 ? Math.round((anonymous.length / rows.length) * 100) : 0,
      criticalSeverity: critical.length,
    }

    return {
      alerts_kpi_summary: kpi_summary,
      alerts_status_distribution: distrib(rows, (c) => c.status as string, (s) => ALERT_STATUS_LABEL[s as AlertStatus] ?? s),
      alerts_kind_distribution: distrib(rows, (c) => c.kind as string, (s) => ALERT_KIND_LABEL[s as AlertKind] ?? s),
      alerts_template_distribution: distrib(rows, (c) => c.system_template_id, (s) => tplLabel.get(s) ?? s),
      alerts_category_distribution: distrib(rows, (c) => c.category_id, (s) => catLabel.get(s) ?? s),
      alerts_severity_distribution: distrib(rows, (c) => c.severity as string | null, (s) => ALERT_SEVERITY_LABEL[s as AlertSeverity] ?? s),
      alerts_anonymity_distribution: distrib(rows, (c) => deriveAnonymityTier(c), (s) => ALERT_ANONYMITY_LABEL[s as keyof typeof ALERT_ANONYMITY_LABEL] ?? s),
      alerts_received_over_time: monthBuckets(rows, (r) => r.received_at),
      alerts_closed_over_time: monthBuckets(rows, (r) => r.closed_at),
      alerts_acknowledgement_compliance: [
        { label: 'I tide', value: rows.filter((r) => r.acknowledged_at && r.acknowledged_at <= r.acknowledgement_due_at).length },
        { label: 'For sent', value: rows.filter((r) => r.acknowledged_at && r.acknowledged_at > r.acknowledgement_due_at).length },
        { label: 'Ikke kvittert', value: rows.filter((r) => !r.acknowledged_at && !['closed', 'dismissed'].includes(r.status)).length },
      ],
      alerts_gdpr_72h_compliance: (() => {
        const gdpr = rows.filter((r) => r.kind === 'gdpr_breach' && r.investigation_due_at)
        const inTime = gdpr.filter((r) => r.datatilsynet_reported_at && r.datatilsynet_reported_at <= r.investigation_due_at!).length
        const late = gdpr.filter((r) => r.datatilsynet_reported_at && r.datatilsynet_reported_at > r.investigation_due_at!).length
        const notReported = gdpr.filter((r) => !r.datatilsynet_reported_at).length
        return [
          { label: 'Rapportert i tide', value: inTime },
          { label: 'Rapportert sent', value: late },
          { label: 'Ikke rapportert', value: notReported },
        ]
      })(),
      alerts_by_location: distrib(rows, (c) => c.location_id, (s) => s),
      alerts_by_department: distrib(rows, (c) => c.department_id, (s) => s),
      alerts_law_ref_coverage: (() => {
        const counts = new Map<string, number>()
        for (const r of rows) {
          const tpl = args.templates.find((t) => t.id === r.system_template_id)
          if (!tpl) continue
          for (const ref of tpl.law_refs) counts.set(ref, (counts.get(ref) ?? 0) + 1)
        }
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v }))
      })(),
      alerts_retention_upcoming_purges: (() => {
        const nowT = Date.now()
        const day = 86400000
        const closed = rows.filter((r) => r.retention_until && r.redacted_at == null)
        return [
          { label: '< 30 dager', value: closed.filter((r) => new Date(r.retention_until!).getTime() - nowT < 30 * day).length },
          { label: '30–90 dager', value: closed.filter((r) => { const d = new Date(r.retention_until!).getTime() - nowT; return d >= 30 * day && d < 90 * day }).length },
          { label: '90–365 dager', value: closed.filter((r) => { const d = new Date(r.retention_until!).getTime() - nowT; return d >= 90 * day && d < 365 * day }).length },
          { label: '> 365 dager', value: closed.filter((r) => new Date(r.retention_until!).getTime() - nowT >= 365 * day).length },
        ]
      })(),
    }
  }, [args.filters, args.cases, args.templates, args.categories])
}
