// useMeetingsDatasets — bucketer for the meetings dashboard scope.
// Takes the active filters + the source data the analyse page already
// owns and produces the scope's Record<datasetKey, unknown> map.

import { useMemo } from 'react'
import type { DashboardFilter } from '../../../src/lib/dashboards/dashboardFilters'
import type {
  DepartmentRow,
  LocationRow,
} from '../../../src/types/organization'
import type {
  MeetingDecisionRow,
  MeetingRow,
  MeetingStatus,
  MeetingTemplateAgendaItem,
  ResolvedMeetingTemplate,
} from '../types'
import { MEETING_STATUS_LABEL, frameworkLabel } from '../meetingsLabels'

export const MEETINGS_STATUS_OPTIONS: { id: MeetingStatus; label: string }[] = [
  { id: 'planned', label: MEETING_STATUS_LABEL.planned },
  { id: 'in_progress', label: MEETING_STATUS_LABEL.in_progress },
  { id: 'completed', label: MEETING_STATUS_LABEL.completed },
  { id: 'cancelled', label: MEETING_STATUS_LABEL.cancelled },
]

type Selectors = {
  templates: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  frameworks: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  statuses: { ids: Set<MeetingStatus>; mode: 'include' | 'exclude' } | null
  categories: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  locations: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  departments: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  from: Date | null
  to: Date | null
}

function buildSelectors(filters: DashboardFilter[]): Selectors {
  const out: Selectors = {
    templates: null,
    frameworks: null,
    statuses: null,
    categories: null,
    locations: null,
    departments: null,
    from: null,
    to: null,
  }
  const setOf = <T extends string>(v: unknown): Set<T> =>
    new Set(Array.isArray(v) ? (v as T[]) : typeof v === 'string' && v ? [v as T] : [])

  for (const f of filters) {
    const mode = f.operator === 'is_not' ? 'exclude' : 'include'
    if (f.dimensionId === 'template') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.templates = { ids, mode }
    } else if (f.dimensionId === 'framework') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.frameworks = { ids, mode }
    } else if (f.dimensionId === 'status') {
      const ids = setOf<MeetingStatus>(f.value)
      if (ids.size) out.statuses = { ids, mode }
    } else if (f.dimensionId === 'category') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.categories = { ids, mode }
    } else if (f.dimensionId === 'location') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.locations = { ids, mode }
    } else if (f.dimensionId === 'department') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.departments = { ids, mode }
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

type Segment = { id: string; label: string; value: number }
type Point = { id: string; label: string; value: number }

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  return `${m}.${y}`
}
function last12Months(now: Date): string[] {
  const out: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(monthKey(d))
  }
  return out
}

export type MeetingsDatasetsArgs = {
  filters: DashboardFilter[]
  meetings: MeetingRow[]
  decisions: MeetingDecisionRow[]
  templates: ResolvedMeetingTemplate[]
  locations: LocationRow[]
  departments: DepartmentRow[]
  /** Resolved at the call site: meetingId → categoryId via the template lookup. */
  categoryByMeetingId: Map<string, string | null>
}

export function useMeetingsDatasets({
  filters,
  meetings,
  decisions,
  templates,
  locations,
  departments,
  categoryByMeetingId,
}: MeetingsDatasetsArgs): Record<string, unknown> {
  const selectors = useMemo(() => buildSelectors(filters), [filters])

  return useMemo(() => {
    // Pin a single `now` reference inside the memo body so the deps
    // array doesn't depend on a fresh Date each render.
    const now = new Date()
    const templateLabelByKey = new Map<string, string>()
    const templateCategoryByKey = new Map<string, string | null>()
    for (const t of templates) {
      const id = t.systemTemplateId ?? t.orgTemplateId
      if (!id) continue
      templateLabelByKey.set(id, t.name)
      templateCategoryByKey.set(id, t.categoryId)
    }

    const filtered = meetings.filter((m) => {
      const tplId = m.system_template_id ?? m.org_template_id
      if (selectors.templates && tplId && !matchesSet(selectors.templates, tplId)) return false
      if (selectors.statuses && !matchesSet(selectors.statuses, m.status)) return false
      if (selectors.locations && m.location_id && !matchesSet(selectors.locations, m.location_id)) return false
      if (selectors.departments && m.department_id && !matchesSet(selectors.departments, m.department_id)) return false
      if (selectors.categories) {
        const catId = categoryByMeetingId.get(m.id) ?? null
        if (!catId || !matchesSet(selectors.categories, catId)) return false
      }
      if (selectors.frameworks) {
        const tpl = tplId ? templates.find((t) => t.systemTemplateId === tplId || t.orgTemplateId === tplId) : null
        const fw = tpl?.framework ?? 'INTERNAL'
        if (!matchesSet(selectors.frameworks, fw)) return false
      }
      const d = m.scheduled_at ? new Date(m.scheduled_at) : m.completed_at ? new Date(m.completed_at) : null
      if (!dateInRange(d, selectors.from, selectors.to)) return false
      return true
    })

    const filteredIds = new Set(filtered.map((m) => m.id))
    const filteredDecisions = decisions.filter((d) => filteredIds.has(d.meeting_id))

    // KPI summary
    const planned = filtered.filter((m) => m.status === 'planned' || m.status === 'in_progress').length
    const completed = filtered.filter((m) => m.status === 'completed').length
    const cancelled = filtered.filter((m) => m.status === 'cancelled').length
    const overdueSign = filtered.filter((m) => m.status === 'completed' && !m.protocol_signed_at).length
    const decisionsOpen = filteredDecisions.filter((d) => d.status === 'open').length
    const yearStart = new Date(now.getFullYear(), 0, 1)
    const decisionsImplementedYtd = filteredDecisions.filter(
      (d) => d.status === 'implemented' && d.decision_at && new Date(d.decision_at) >= yearStart,
    ).length
    const mandatoryMissing = filtered.filter((m) => {
      const snap = m.definition_snapshot
      if (!snap?.agendaItems?.length) return false
      const mandatory = snap.agendaItems.filter((a: MeetingTemplateAgendaItem) => a.isMandatory)
      return mandatory.length > 0 && m.status === 'completed' && !m.protocol_signed_at
    }).length

    const meeting_kpi_summary = {
      total: filtered.length,
      planned,
      completed,
      cancelled,
      overdueSign,
      mandatoryMissing,
      decisionsOpen,
      decisionsImplementedYtd,
    }

    // Status distribution
    const statusCounts = new Map<MeetingStatus, number>()
    for (const m of filtered) statusCounts.set(m.status, (statusCounts.get(m.status) ?? 0) + 1)
    const meeting_status_distribution: Segment[] = MEETINGS_STATUS_OPTIONS.map((s) => ({
      id: s.id,
      label: s.label,
      value: statusCounts.get(s.id) ?? 0,
    })).filter((s) => s.value > 0)

    // Framework distribution
    const fwCounts = new Map<string, number>()
    for (const m of filtered) {
      const tplId = m.system_template_id ?? m.org_template_id
      const tpl = tplId ? templates.find((t) => t.systemTemplateId === tplId || t.orgTemplateId === tplId) : null
      const fw = tpl?.framework ?? 'INTERNAL'
      fwCounts.set(fw, (fwCounts.get(fw) ?? 0) + 1)
    }
    const meeting_framework_distribution: Segment[] = [...fwCounts.entries()]
      .map(([id, value]) => ({ id, label: frameworkLabel(id), value }))
      .sort((a, b) => b.value - a.value)

    // Template distribution
    const tplCounts = new Map<string, number>()
    for (const m of filtered) {
      const tplId = m.system_template_id ?? m.org_template_id
      if (!tplId) continue
      tplCounts.set(tplId, (tplCounts.get(tplId) ?? 0) + 1)
    }
    const meeting_template_distribution: Segment[] = [...tplCounts.entries()]
      .map(([id, value]) => ({ id, label: templateLabelByKey.get(id) ?? id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)

    // Category distribution
    const catCounts = new Map<string | null, number>()
    for (const m of filtered) {
      const cat = categoryByMeetingId.get(m.id) ?? null
      catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1)
    }
    const meeting_category_distribution: Segment[] = [...catCounts.entries()]
      .map(([id, value]) => ({ id: id ?? '__uncat__', label: id ?? 'Uten kategori', value }))
      .sort((a, b) => b.value - a.value)

    // Completion / decisions over time
    const monthBuckets = last12Months(now)
    const completionCounts = new Map<string, number>(monthBuckets.map((k) => [k, 0]))
    for (const m of filtered) {
      if (m.status !== 'completed' || !m.completed_at) continue
      const k = monthKey(new Date(m.completed_at))
      if (completionCounts.has(k)) completionCounts.set(k, (completionCounts.get(k) ?? 0) + 1)
    }
    const meeting_completion_over_time: Point[] = monthBuckets.map((k) => ({
      id: k,
      label: monthLabel(k),
      value: completionCounts.get(k) ?? 0,
    }))

    const decisionCounts = new Map<string, number>(monthBuckets.map((k) => [k, 0]))
    for (const d of filteredDecisions) {
      if (!d.decision_at) continue
      const k = monthKey(new Date(d.decision_at))
      if (decisionCounts.has(k)) decisionCounts.set(k, (decisionCounts.get(k) ?? 0) + 1)
    }
    const meeting_decisions_over_time: Point[] = monthBuckets.map((k) => ({
      id: k,
      label: monthLabel(k),
      value: decisionCounts.get(k) ?? 0,
    }))

    // Quorum distribution
    const qPos = filtered.filter((m) => m.quorum_met === true).length
    const qNeg = filtered.filter((m) => m.quorum_met === false).length
    const qUnk = filtered.length - qPos - qNeg
    const meeting_quorum_distribution: Segment[] = [
      { id: 'met', label: 'Beslutningsdyktig', value: qPos },
      { id: 'not_met', label: 'Ikke beslutningsdyktig', value: qNeg },
      { id: 'unknown', label: 'Ukjent', value: qUnk },
    ].filter((s) => s.value > 0)

    // Location / department distribution
    const locLabel = new Map(locations.map((l) => [l.id, l.name]))
    const depLabel = new Map(departments.map((d) => [d.id, d.name]))
    const locCounts = new Map<string, number>()
    const depCounts = new Map<string, number>()
    for (const m of filtered) {
      if (m.location_id) locCounts.set(m.location_id, (locCounts.get(m.location_id) ?? 0) + 1)
      if (m.department_id) depCounts.set(m.department_id, (depCounts.get(m.department_id) ?? 0) + 1)
    }
    const meeting_instances_by_location: Segment[] = [...locCounts.entries()]
      .map(([id, value]) => ({ id, label: locLabel.get(id) ?? id, value }))
      .sort((a, b) => b.value - a.value)
    const meeting_instances_by_department: Segment[] = [...depCounts.entries()]
      .map(([id, value]) => ({ id, label: depLabel.get(id) ?? id, value }))
      .sort((a, b) => b.value - a.value)

    // Law-ref coverage
    const lawRefCounts = new Map<string, number>()
    for (const m of filtered) {
      const snap = m.definition_snapshot
      if (!snap?.agendaItems) continue
      const seen = new Set<string>()
      for (const item of snap.agendaItems as MeetingTemplateAgendaItem[]) {
        if (item.lawRef && !seen.has(item.lawRef)) {
          seen.add(item.lawRef)
          lawRefCounts.set(item.lawRef, (lawRefCounts.get(item.lawRef) ?? 0) + 1)
        }
      }
    }
    const meeting_law_ref_coverage: Segment[] = [...lawRefCounts.entries()]
      .map(([id, value]) => ({ id, label: id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 24)

    // Invitation compliance: per meeting with both `invitationLeadDays`
    // (from definition_snapshot) and `scheduled_at`, classify as on-time
    // (sent at least leadDays before), late (sent but < leadDays), or
    // unsent. Meetings without a leadDays default are excluded so the
    // chart doesn't get noisy from ad-hoc templates.
    let invOnTime = 0
    let invLate = 0
    let invMissing = 0
    for (const m of filtered) {
      const lead = m.definition_snapshot?.invitationLeadDays
      if (!lead || !m.scheduled_at) continue
      if (!m.invitation_sent_at) {
        invMissing += 1
        continue
      }
      const diffDays = Math.floor(
        (new Date(m.scheduled_at).getTime() - new Date(m.invitation_sent_at).getTime()) /
          (1000 * 60 * 60 * 24),
      )
      if (diffDays >= lead) invOnTime += 1
      else invLate += 1
    }
    const meeting_invitation_compliance: Segment[] = [
      { id: 'on_time', label: 'I tide', value: invOnTime },
      { id: 'late', label: 'For sent', value: invLate },
      { id: 'missing', label: 'Ikke sendt', value: invMissing },
    ].filter((s) => s.value > 0)

    return {
      meeting_kpi_summary,
      meeting_status_distribution,
      meeting_framework_distribution,
      meeting_template_distribution,
      meeting_category_distribution,
      meeting_completion_over_time,
      meeting_decisions_over_time,
      meeting_quorum_distribution,
      meeting_instances_by_location,
      meeting_instances_by_department,
      meeting_law_ref_coverage,
      meeting_invitation_compliance,
    }
  }, [selectors, meetings, decisions, templates, locations, departments, categoryByMeetingId])
}
