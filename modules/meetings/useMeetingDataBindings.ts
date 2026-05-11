// useMeetingDataBindings — resolver hook for Møteforberedelse-pakke (H9b).
//
// Reads meeting.definition_snapshot.agendaItems[] to find dataBindings,
// fans out to existing module hooks (useHse, useInternalControl, ...),
// applies the window filter, and produces a RenderedBindingResult per
// agenda item. UI consumers render the summary above the minutes
// textarea and offer a "Bruk forberedelse" button to copy the summary
// into the minutes field.
//
// H9b ships with bindings for `sick_leave_stats` and `incidents` only.
// H9d extends the catalog to the remaining 10 sources.

import { useMemo } from 'react'
import { useHse } from '../../src/hooks/useHse'
import type {
  MeetingAgendaItemRow,
  MeetingDataBinding,
  MeetingRow,
  MeetingTemplateAgendaItem,
  RenderedBindingResult,
} from './types'

export type UseMeetingDataBindingsArgs = {
  meeting: MeetingRow | null
  agendaItems: MeetingAgendaItemRow[]
}

export type UseMeetingDataBindingsReturn = {
  /** Resolved snapshot per agenda-item id. Missing key = no binding. */
  resolvedByAgendaItemId: Map<string, RenderedBindingResult>
  /** True while underlying module data is loading. */
  loading: boolean
}

function pickWindowStart(window: MeetingDataBinding['window']): Date {
  const now = Date.now()
  switch (window) {
    case 'last_month':
      return new Date(now - 31 * 86400000)
    case 'last_quarter':
      return new Date(now - 93 * 86400000)
    case 'last_half_year':
      return new Date(now - 186 * 86400000)
    case 'last_year':
      return new Date(now - 366 * 86400000)
    case 'current':
    case 'all_open':
    default:
      // 10 years back = de facto all-time without sorting headaches.
      return new Date(now - 10 * 365 * 86400000)
  }
}

function windowLabel(window: MeetingDataBinding['window']): string {
  switch (window) {
    case 'last_month':
      return 'siste 30 dager'
    case 'last_quarter':
      return 'siste kvartal'
    case 'last_half_year':
      return 'siste halvår'
    case 'last_year':
      return 'siste 12 måneder'
    case 'current':
      return 'nåværende status'
    case 'all_open':
      return 'alle åpne'
    default:
      return 'alle'
  }
}

export function useMeetingDataBindings({
  meeting,
  agendaItems,
}: UseMeetingDataBindingsArgs): UseMeetingDataBindingsReturn {
  const hse = useHse()

  const resolvedByAgendaItemId = useMemo(() => {
    const out = new Map<string, RenderedBindingResult>()
    if (!meeting) return out

    // Build a lookup of template-item-key → dataBinding from the
    // snapshotted definition.
    const snapshot = meeting.definition_snapshot
    if (!snapshot?.agendaItems?.length) return out
    const bindingByKey = new Map<string, MeetingDataBinding>()
    for (const tpl of snapshot.agendaItems as MeetingTemplateAgendaItem[]) {
      if (tpl.dataBinding) bindingByKey.set(tpl.key, tpl.dataBinding)
    }
    if (bindingByKey.size === 0) return out

    const resolvedAt = new Date().toISOString()

    for (const item of agendaItems) {
      if (!item.template_item_key) continue
      const binding = bindingByKey.get(item.template_item_key)
      if (!binding) continue

      const result = resolveBinding(binding, resolvedAt, { hse })
      if (result) out.set(item.id, result)
    }
    return out
  }, [meeting, agendaItems, hse])

  return {
    resolvedByAgendaItemId,
    loading: hse.loading ?? false,
  }
}

// ── Per-source resolvers ──────────────────────────────────────────────────

type ResolveCtx = {
  hse: ReturnType<typeof useHse>
}

function resolveBinding(
  binding: MeetingDataBinding,
  resolvedAt: string,
  ctx: ResolveCtx,
): RenderedBindingResult | null {
  switch (binding.source) {
    case 'sick_leave_stats':
      return resolveSickLeaveStats(binding, resolvedAt, ctx)
    case 'incidents':
      return resolveIncidents(binding, resolvedAt, ctx)
    // Other sources land in H9d.
    default:
      return {
        source: binding.source,
        window: binding.window,
        resolvedAt,
        summaryMarkdown: `_Forberedelse for «${binding.source}» kommer i en senere oppdatering._`,
        error: 'Binding-kilden er ikke implementert ennå.',
      }
  }
}

function resolveSickLeaveStats(
  binding: MeetingDataBinding,
  resolvedAt: string,
  { hse }: ResolveCtx,
): RenderedBindingResult {
  const windowStart = pickWindowStart(binding.window)
  const inWindow = hse.sickLeaveCases.filter((c) => {
    if (!c.sickFrom) return false
    return new Date(c.sickFrom) >= windowStart
  })
  const active = inWindow.filter((c) => c.status === 'active' || c.status === 'partial')
  const closed = inWindow.filter((c) => c.status === 'closed')
  const total = inWindow.length
  const avgDegree =
    active.length > 0
      ? Math.round(active.reduce((s, c) => s + (c.sicknessDegree ?? 0), 0) / active.length)
      : 0

  const byDept = new Map<string, number>()
  for (const c of inWindow) {
    const d = c.department || '— ukjent —'
    byDept.set(d, (byDept.get(d) ?? 0) + 1)
  }
  const topDept = [...byDept.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const summary =
    total === 0
      ? `Ingen sykefraværssaker registrert i ${windowLabel(binding.window)}.`
      : [
          `${total} sykefraværssaker i ${windowLabel(binding.window)} — ${active.length} aktive (snitt gradering ${avgDegree} %), ${closed.length} avsluttet.`,
          topDept.length
            ? `Topp avdelinger: ${topDept.map(([d, n]) => `${d} (${n})`).join(', ')}.`
            : '',
        ]
          .filter(Boolean)
          .join('\n')

  return {
    source: 'sick_leave_stats',
    window: binding.window,
    resolvedAt,
    summaryMarkdown: summary,
    dataRows: topDept.map(([department, count]) => ({ department, count })),
  }
}

function resolveIncidents(
  binding: MeetingDataBinding,
  resolvedAt: string,
  { hse }: ResolveCtx,
): RenderedBindingResult {
  const windowStart = pickWindowStart(binding.window)
  const inWindow = hse.incidents.filter((i) => {
    if (!i.occurredAt) return false
    return new Date(i.occurredAt) >= windowStart
  })
  const byStatus = {
    reported: 0,
    investigating: 0,
    action_pending: 0,
    closed: 0,
  }
  for (const i of inWindow) {
    if (i.status && i.status in byStatus) byStatus[i.status] += 1
  }
  const open = byStatus.reported + byStatus.investigating + byStatus.action_pending
  const critical = inWindow.filter((i) => i.severity === 'critical').length

  const summary =
    inWindow.length === 0
      ? `Ingen hendelser registrert i ${windowLabel(binding.window)}.`
      : [
          `${inWindow.length} hendelser i ${windowLabel(binding.window)} — ${open} åpne (${byStatus.reported} meldt, ${byStatus.investigating} under utredning, ${byStatus.action_pending} venter tiltak), ${byStatus.closed} lukket.`,
          critical > 0 ? `**${critical}** av disse er klassifisert som kritiske.` : '',
        ]
          .filter(Boolean)
          .join('\n')

  return {
    source: 'incidents',
    window: binding.window,
    resolvedAt,
    summaryMarkdown: summary,
    dataRows: [
      { status: 'Meldt', count: byStatus.reported },
      { status: 'Under utredning', count: byStatus.investigating },
      { status: 'Venter tiltak', count: byStatus.action_pending },
      { status: 'Lukket', count: byStatus.closed },
    ],
  }
}
