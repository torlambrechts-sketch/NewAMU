// useChecklistDatasets — extracted from ChecklistsAnalysePage (3.5.1).
// Computes the datasets map consumed by the compliance-checklist
// dashboard, given the active filter chips and the source data already
// loaded by useChecklistModule + useLicensedPacks + useOrgSetup.
//
// Same separation as useLearningDatasets: pulling the inline useMemo
// out of the page makes the compute trivially testable in isolation
// and lets composite scopes (3.3.1) call it from a different host.

import { useMemo } from 'react'
import type { DashboardFilter } from '../../../src/lib/dashboards/dashboardFilters'
import type {
  DepartmentRow,
  LocationRow,
} from '../../../src/types/organization'
import type { CompliancePack } from '../../../src/lib/compliance/packs'
import type {
  ComplianceExecutionRow,
  ComplianceResponseRow,
  ComplianceSeverity,
  ComplianceTemplateRow,
} from '../types'

export const STATUS_OPTIONS = [
  { id: 'draft', label: 'Kladd' },
  { id: 'active', label: 'Aktiv' },
  { id: 'signed', label: 'Signert' },
] as const

export const SEVERITY_OPTIONS: { id: ComplianceSeverity; label: string }[] = [
  { id: 'low', label: 'Lav' },
  { id: 'medium', label: 'Middels' },
  { id: 'high', label: 'Høy' },
  { id: 'critical', label: 'Kritisk' },
]

type FilterSelectors = {
  packs: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  templates: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  statuses: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  severities: { ids: Set<ComplianceSeverity>; mode: 'include' | 'exclude' } | null
  locations: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  departments: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  participants: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  from: Date | null
  to: Date | null
}

function buildSelectors(filters: DashboardFilter[]): FilterSelectors {
  const out: FilterSelectors = {
    packs: null,
    templates: null,
    statuses: null,
    severities: null,
    locations: null,
    departments: null,
    participants: null,
    from: null,
    to: null,
  }
  const setOf = <T extends string>(v: unknown): Set<T> =>
    new Set(Array.isArray(v) ? (v as T[]) : typeof v === 'string' && v ? [v as T] : [])

  for (const f of filters) {
    const mode = f.operator === 'is_not' ? 'exclude' : 'include'
    if (f.dimensionId === 'pack') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.packs = { ids, mode }
    } else if (f.dimensionId === 'template') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.templates = { ids, mode }
    } else if (f.dimensionId === 'status') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.statuses = { ids, mode }
    } else if (f.dimensionId === 'severity') {
      const ids = setOf<ComplianceSeverity>(f.value)
      if (ids.size) out.severities = { ids, mode }
    } else if (f.dimensionId === 'location') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.locations = { ids, mode }
    } else if (f.dimensionId === 'department') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.departments = { ids, mode }
    } else if (f.dimensionId === 'participant') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.participants = { ids, mode }
    } else if (f.dimensionId === 'date') {
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
  }
  return out
}

const matchesSet = <T,>(s: { ids: Set<T>; mode: 'include' | 'exclude' } | null, v: T): boolean => {
  if (!s) return true
  return s.mode === 'include' ? s.ids.has(v) : !s.ids.has(v)
}

const dateInRange = (d: Date | null, from: Date | null, to: Date | null): boolean => {
  if (!d) return true
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

export type ChecklistDatasetsArgs = {
  filters: DashboardFilter[]
  executions: ComplianceExecutionRow[]
  responsesByExecutionId: Record<string, ComplianceResponseRow[]>
  templates: ComplianceTemplateRow[]
  packs: CompliancePack[]
  locations: LocationRow[]
  departments: DepartmentRow[]
}

export function useChecklistDatasets({
  filters,
  executions: rawExecutions,
  responsesByExecutionId,
  templates,
  packs,
  locations,
  departments,
}: ChecklistDatasetsArgs): Record<string, unknown> {
  return useMemo(() => {
    const sel = buildSelectors(filters)

    // Filter executions first; nearly every dataset is downstream of
    // this set. Apply pack / template / status / date filters.
    const executions = rawExecutions.filter((e: ComplianceExecutionRow) => {
      if (!matchesSet(sel.packs, e.pack)) return false
      if (!matchesSet(sel.templates, e.template_id)) return false
      if (!matchesSet(sel.statuses, e.status)) return false
      // Org-context filters: a null FK on the execution flunks an
      // include-mode filter (match nothing) and passes an exclude-mode
      // filter (not in set).
      if (sel.locations) {
        if (!e.location_id) {
          if (sel.locations.mode === 'include') return false
        } else if (!matchesSet(sel.locations, e.location_id)) {
          return false
        }
      }
      if (sel.departments) {
        if (!e.department_id) {
          if (sel.departments.mode === 'include') return false
        } else if (!matchesSet(sel.departments, e.department_id)) {
          return false
        }
      }
      if (sel.participants) {
        const intersects = e.participant_member_ids.some((id) => sel.participants!.ids.has(id))
        if (sel.participants.mode === 'include' ? !intersects : intersects) return false
      }
      if (sel.from || sel.to) {
        const at = e.signed_at ? new Date(e.signed_at) : e.created_at ? new Date(e.created_at) : null
        if (!dateInRange(at, sel.from, sel.to)) return false
      }
      return true
    })
    const execIds = new Set(executions.map((e) => e.id))

    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    let total = 0
    let open = 0
    let signed = 0
    let ytd = 0
    /** Signed-in-equivalent-window-last-year — drives the comparison delta on the YTD KPI. */
    let prevYtd = 0
    let prevCritical = 0
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1)
    const prevYearCutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const statusCounts: Record<string, number> = { Kladd: 0, Aktiv: 0, Signert: 0 }
    const packCounts: Record<string, number> = {}
    const templateCounts = new Map<string, number>()
    const locationCounts = new Map<string, number>()
    const departmentCounts = new Map<string, number>()
    const locationById = new Map(locations.map((l) => [l.id, l.name]))
    const departmentById = new Map(departments.map((d) => [d.id, d.name]))

    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = (d: Date) =>
      d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })
    const months: { key: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: monthKey(d), label: monthLabel(d) })
    }
    const execByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))
    const findByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))
    // Previous-period series (months 23..12 ago) drives the line widget's
    // comparison overlay so signers can see year-over-year cadence.
    const prevMonths: { key: string; label: string }[] = []
    for (let i = 23; i >= 12; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      prevMonths.push({ key: monthKey(d), label: monthLabel(d) })
    }
    const execByMonthPrev = new Map<string, number>(prevMonths.map((m) => [m.key, 0]))
    const findByMonthPrev = new Map<string, number>(prevMonths.map((m) => [m.key, 0]))

    for (const e of executions) {
      total += 1
      if (e.status === 'signed') {
        signed += 1
        statusCounts.Signert = (statusCounts.Signert ?? 0) + 1
        if (e.signed_at) {
          const signedAt = new Date(e.signed_at)
          if (signedAt >= yearStart) ytd += 1
          if (signedAt >= prevYearStart && signedAt <= prevYearCutoff) prevYtd += 1
        }
      } else if (e.status === 'active') {
        open += 1
        statusCounts.Aktiv = (statusCounts.Aktiv ?? 0) + 1
      } else {
        open += 1
        statusCounts.Kladd = (statusCounts.Kladd ?? 0) + 1
      }

      const packLabel = packs.find((p) => p.slug === e.pack)?.shortName ?? e.pack
      packCounts[packLabel] = (packCounts[packLabel] ?? 0) + 1

      const tpl = templates.find((t) => t.id === e.template_id)
      const tplName = tpl?.name ?? 'Ukjent mal'
      templateCounts.set(tplName, (templateCounts.get(tplName) ?? 0) + 1)

      const locName = e.location_id ? locationById.get(e.location_id) ?? '(ukjent)' : '(uten lokasjon)'
      locationCounts.set(locName, (locationCounts.get(locName) ?? 0) + 1)

      const depName = e.department_id
        ? departmentById.get(e.department_id) ?? '(ukjent)'
        : '(uten avdeling)'
      departmentCounts.set(depName, (departmentCounts.get(depName) ?? 0) + 1)

      const created = e.created_at ? new Date(e.created_at) : null
      if (created) {
        const k = monthKey(created)
        if (execByMonth.has(k)) execByMonth.set(k, (execByMonth.get(k) ?? 0) + 1)
        else if (execByMonthPrev.has(k)) execByMonthPrev.set(k, (execByMonthPrev.get(k) ?? 0) + 1)
      }
    }

    const sev: Record<ComplianceSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }
    let findings = 0
    let critical = 0
    for (const [execId, list] of Object.entries(responsesByExecutionId)) {
      if (!execIds.has(execId)) continue
      for (const r of list) {
        if (!r.is_finding) continue
        if (r.severity && !matchesSet(sel.severities, r.severity)) continue
        findings += 1
        if (r.severity) sev[r.severity] = (sev[r.severity] ?? 0) + 1
        if (r.severity === 'critical') critical += 1
        const at = r.created_at ? new Date(r.created_at) : null
        if (at) {
          const k = monthKey(at)
          if (findByMonth.has(k)) findByMonth.set(k, (findByMonth.get(k) ?? 0) + 1)
          else if (findByMonthPrev.has(k)) findByMonthPrev.set(k, (findByMonthPrev.get(k) ?? 0) + 1)
          if (r.severity === 'critical' && at >= prevYearStart && at <= prevYearCutoff) {
            prevCritical += 1
          }
        }
      }
    }

    const topTemplates = [...templateCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    const templateBar: Record<string, number> = {}
    for (const [name, count] of topTemplates) templateBar[name] = count

    return {
      checklist_kpi_summary: {
        total,
        open,
        signed,
        ytd,
        findings,
        critical,
      },
      checklist_kpi_summary_prev: {
        ytd: prevYtd,
        critical: prevCritical,
      },
      checklist_executions_by_status: statusCounts,
      checklist_findings_by_severity: {
        Lav: sev.low,
        Middels: sev.medium,
        Høy: sev.high,
        Kritisk: sev.critical,
      },
      checklist_executions_by_template: templateBar,
      checklist_executions_by_pack: packCounts,
      checklist_executions_by_location: Object.fromEntries(locationCounts),
      checklist_executions_by_department: Object.fromEntries(departmentCounts),
      checklist_executions_over_time: months.map((m) => ({
        x: m.label,
        y: execByMonth.get(m.key) ?? 0,
      })),
      checklist_executions_over_time_prev: prevMonths.map((m) => ({
        x: m.label,
        y: execByMonthPrev.get(m.key) ?? 0,
      })),
      checklist_findings_over_time: months.map((m) => ({
        x: m.label,
        y: findByMonth.get(m.key) ?? 0,
      })),
      checklist_findings_over_time_prev: prevMonths.map((m) => ({
        x: m.label,
        y: findByMonthPrev.get(m.key) ?? 0,
      })),
    } as Record<string, unknown>
  }, [filters, rawExecutions, responsesByExecutionId, templates, packs, locations, departments])
}
