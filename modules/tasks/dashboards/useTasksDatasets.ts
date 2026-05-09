// useTasksDatasets — computes the tasks scope's dataset map from a flat
// task_items snapshot. Called by TasksAnalysePage; filters are applied
// client-side so switching chips is instant with no round-trips.
//
// Dataset keys mirror tasksDashboardScope.ts DATASETS array.

import { useMemo } from 'react'
import type { DashboardFilter } from '../../../src/lib/dashboards/dashboardFilters'
import type { TaskItemStatus, TaskItemPriority, TaskTemplateKind } from '../../../src/types/task'

export type TaskItemSnapshot = {
  id: string
  status: TaskItemStatus
  priority: TaskItemPriority
  templateKind: TaskTemplateKind | null
  templateSlug: string | null
  templateName: string | null
  dueDate: string | null
  slaDueAt: string | null
  closedAt: string | null
  createdAt: string
}

const CAPA_PHASES: TaskItemStatus[] = [
  'open',
  'in_progress',
  'root_cause_identified',
  'action_defined',
  'action_implemented',
  'effectiveness_pending',
  'effectiveness_verified',
]

const STATUS_LABEL: Record<TaskItemStatus, string> = {
  open: 'Åpen',
  in_progress: 'Under behandling',
  root_cause_identified: 'Rotårsak identifisert',
  action_defined: 'Tiltak definert',
  action_implemented: 'Tiltak implementert',
  effectiveness_pending: 'Venter på verifikasjon',
  effectiveness_verified: 'Verifisert effektiv',
  closed: 'Lukket',
  cancelled: 'Kansellert',
}

const PRIORITY_LABEL: Record<TaskItemPriority, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
}

const KIND_LABEL: Record<string, string> = {
  oppgave: 'Generell oppgave',
  avvik: 'Avvik / Hendelse',
  nestenulykke: 'Nestenulykke',
  tiltak: 'Tiltak',
  risiko: 'Risikovurdering',
  forslag: 'Forslag',
  'sykefravær': 'Sykefravær-oppfølging',
}

function monthKey(iso: string): string {
  return iso.slice(0, 7) // "YYYY-MM"
}

function last12Months(): string[] {
  const months: string[] = []
  const d = new Date()
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function buildSelectors(filters: DashboardFilter[]) {
  const out = {
    kinds: null as Set<string> | null,
    statuses: null as Set<string> | null,
    priorities: null as Set<string> | null,
    templates: null as Set<string> | null,
    from: null as Date | null,
    to: null as Date | null,
  }
  const asSet = (v: unknown): Set<string> =>
    new Set(Array.isArray(v) ? (v as string[]) : typeof v === 'string' && v ? [v] : [])

  for (const f of filters) {
    if (f.dimensionId === 'kind') out.kinds = asSet(f.value)
    else if (f.dimensionId === 'status') out.statuses = asSet(f.value)
    else if (f.dimensionId === 'priority') out.priorities = asSet(f.value)
    else if (f.dimensionId === 'template') out.templates = asSet(f.value)
    else if (f.dimensionId === 'date' && f.operator === 'between' && f.value && typeof f.value === 'object') {
      const r = f.value as { from?: string; to?: string }
      if (r.from) out.from = new Date(r.from)
      if (r.to) out.to = new Date(r.to)
    }
  }
  return out
}

function applyFilters(items: TaskItemSnapshot[], filters: DashboardFilter[]): TaskItemSnapshot[] {
  if (filters.length === 0) return items
  const sel = buildSelectors(filters)
  return items.filter((item) => {
    if (sel.kinds?.size && !(sel.kinds.has(item.templateKind ?? ''))) return false
    if (sel.statuses?.size && !sel.statuses.has(item.status)) return false
    if (sel.priorities?.size && !sel.priorities.has(item.priority)) return false
    if (sel.templates?.size && !(sel.templates.has(item.templateSlug ?? ''))) return false
    if (sel.from && new Date(item.createdAt) < sel.from) return false
    if (sel.to && new Date(item.createdAt) > sel.to) return false
    return true
  })
}

function segments(map: Map<string, number>): Array<{ id: string; label: string; value: number }> {
  return Array.from(map.entries())
    .map(([id, value]) => ({ id, label: id, value }))
    .sort((a, b) => b.value - a.value)
}

export function useTasksDatasets(
  items: TaskItemSnapshot[],
  filters: DashboardFilter[],
): Record<string, unknown> {
  return useMemo(() => {
    const filtered = applyFilters(items, filters)
    const now = new Date()
    const ytdStart = new Date(now.getFullYear(), 0, 1)

    // KPIs
    const total = filtered.length
    const open = filtered.filter((t) => t.status === 'open' || t.status === 'in_progress').length
    const overdue = filtered.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) < now &&
        t.status !== 'closed' &&
        t.status !== 'cancelled',
    ).length
    const closedYtd = filtered.filter(
      (t) => t.closedAt && new Date(t.closedAt) >= ytdStart,
    ).length
    const avvikOpen = filtered.filter(
      (t) =>
        t.templateKind === 'avvik' &&
        t.status !== 'closed' &&
        t.status !== 'cancelled',
    ).length
    const criticalOpen = filtered.filter(
      (t) => t.priority === 'critical' && t.status !== 'closed' && t.status !== 'cancelled',
    ).length

    // Status distribution
    const statusMap = new Map<string, number>()
    for (const t of filtered) {
      const lbl = STATUS_LABEL[t.status] ?? t.status
      statusMap.set(lbl, (statusMap.get(lbl) ?? 0) + 1)
    }

    // Priority distribution
    const priorityMap = new Map<string, number>()
    for (const t of filtered) {
      const lbl = PRIORITY_LABEL[t.priority] ?? t.priority
      priorityMap.set(lbl, (priorityMap.get(lbl) ?? 0) + 1)
    }

    // Template kind distribution
    const kindMap = new Map<string, number>()
    for (const t of filtered) {
      const k = t.templateKind ?? 'oppgave'
      const lbl = KIND_LABEL[k] ?? k
      kindMap.set(lbl, (kindMap.get(lbl) ?? 0) + 1)
    }

    // Template name distribution (top 10)
    const tplMap = new Map<string, number>()
    for (const t of filtered) {
      const k = t.templateName ?? t.templateSlug ?? '(ukjent)'
      tplMap.set(k, (tplMap.get(k) ?? 0) + 1)
    }
    const tplSegs = Array.from(tplMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, value]) => ({ id, label: id, value }))

    // CAPA funnel — only items with CAPA-relevant statuses
    const capaItems = filtered.filter((t) =>
      t.templateKind === 'avvik' || t.templateKind === 'nestenulykke' || t.templateKind === 'risiko',
    )
    const capaMap = new Map<string, number>()
    for (const s of CAPA_PHASES) {
      capaMap.set(STATUS_LABEL[s], 0)
    }
    for (const t of capaItems) {
      if (CAPA_PHASES.includes(t.status)) {
        const lbl = STATUS_LABEL[t.status]
        capaMap.set(lbl, (capaMap.get(lbl) ?? 0) + 1)
      }
    }
    const capaFunnel = Array.from(capaMap.entries()).map(([id, value]) => ({
      id, label: id, value,
    }))

    // SLA compliance
    const slaItems = filtered.filter((t) => t.slaDueAt)
    const slaOnTime = slaItems.filter(
      (t) => t.closedAt && new Date(t.closedAt) <= new Date(t.slaDueAt!),
    ).length
    const slaBreached = slaItems.filter(
      (t) => new Date(t.slaDueAt!) < now && t.status !== 'closed' && t.status !== 'cancelled',
    ).length
    const slaClosed = slaItems.filter(
      (t) => t.closedAt && new Date(t.closedAt) > new Date(t.slaDueAt!),
    ).length

    // Overdue by priority
    const overdueItems = filtered.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'closed' && t.status !== 'cancelled',
    )
    const overdueByPriority = new Map<string, number>()
    for (const t of overdueItems) {
      const lbl = PRIORITY_LABEL[t.priority] ?? t.priority
      overdueByPriority.set(lbl, (overdueByPriority.get(lbl) ?? 0) + 1)
    }

    // Trend: items created over time (last 12 months)
    const months = last12Months()
    const createdByMonth = new Map<string, number>(months.map((m) => [m, 0]))
    for (const t of filtered) {
      const m = monthKey(t.createdAt)
      if (createdByMonth.has(m)) createdByMonth.set(m, (createdByMonth.get(m) ?? 0) + 1)
    }
    const closedByMonth = new Map<string, number>(months.map((m) => [m, 0]))
    for (const t of filtered) {
      if (!t.closedAt) continue
      const m = monthKey(t.closedAt)
      if (closedByMonth.has(m)) closedByMonth.set(m, (closedByMonth.get(m) ?? 0) + 1)
    }
    const toSeries = (map: Map<string, number>) =>
      Array.from(map.entries()).map(([label, value]) => ({ label, value }))

    return {
      tasks_kpi_summary: { total, open, overdue, closedYtd, avvikOpen, criticalOpen },
      tasks_status_distribution: segments(statusMap),
      tasks_priority_distribution: segments(priorityMap),
      tasks_kind_distribution: segments(kindMap),
      tasks_template_distribution: tplSegs,
      tasks_capa_funnel: capaFunnel,
      tasks_created_over_time: toSeries(createdByMonth),
      tasks_closed_over_time: toSeries(closedByMonth),
      tasks_sla_compliance: [
        { id: 'within_sla', label: 'Lukket innen SLA', value: slaOnTime },
        { id: 'sla_breached', label: 'SLA brutt (åpen)', value: slaBreached },
        { id: 'closed_late', label: 'Lukket etter SLA', value: slaClosed },
      ],
      tasks_overdue_by_priority: segments(overdueByPriority),
    }
  }, [items, filters])
}
