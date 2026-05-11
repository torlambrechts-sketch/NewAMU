// useMeetingBriefingDatasets — feeds the briefing dashboard scope.
//
// Templates carry a `definition.dashboard` block whose widgets reference
// dataset keys this hook produces. The hook reuses
// `useMeetingDataBindings` (which already pulls cross-module data scoped
// to the meeting's reporting period) and reshapes the rendered binding
// results into the named dataset map the briefing scope expects.

import { useMemo } from 'react'
import { useMeetingDataBindings } from '../useMeetingDataBindings'
import type {
  MeetingAgendaItemRow,
  MeetingDataBinding,
  MeetingRow,
  MeetingTemplateAgendaItem,
  RenderedBindingResult,
} from '../types'

type Source = MeetingDataBinding['source']

export type MeetingBriefingDatasets = Record<string, unknown>

/**
 * Resolve the briefing-scope datasets for a given meeting.
 * Returns a `Record<datasetKey, unknown>` keyed by the dataset keys
 * declared in {@link meetingBriefingDashboardScope}.
 */
export function useMeetingBriefingDatasets(
  meeting: MeetingRow | null,
  agendaItems: MeetingAgendaItemRow[],
): { datasets: MeetingBriefingDatasets; loading: boolean } {
  const bindings = useMeetingDataBindings({ meeting, agendaItems })

  const datasets = useMemo<MeetingBriefingDatasets>(() => {
    if (!meeting) return {}
    const bySource = unionBySource(meeting, agendaItems, bindings.resolvedByAgendaItemId, bindings.extraSignalsBySource)
    return shapeDatasets(bySource)
  }, [meeting, agendaItems, bindings.resolvedByAgendaItemId, bindings.extraSignalsBySource])

  return { datasets, loading: bindings.loading }
}

/** Combine agenda-bound + framework-extra results into a single
 *  `source → result` lookup. Last write wins per source. */
function unionBySource(
  meeting: MeetingRow,
  agendaItems: MeetingAgendaItemRow[],
  resolvedByAgendaItemId: Map<string, RenderedBindingResult>,
  extraSignalsBySource: Map<Source, RenderedBindingResult>,
): Map<Source, RenderedBindingResult> {
  const out = new Map<Source, RenderedBindingResult>()

  // Agenda-bound: walk the snapshot to map agenda item id → source, then
  // pull from resolvedByAgendaItemId.
  const snap = meeting.definition_snapshot
  const sourceByAgendaItemKey = new Map<string, Source>()
  if (snap?.agendaItems?.length) {
    for (const tpl of snap.agendaItems as MeetingTemplateAgendaItem[]) {
      if (tpl.dataBinding) sourceByAgendaItemKey.set(tpl.key, tpl.dataBinding.source)
    }
  }
  for (const item of agendaItems) {
    if (!item.template_item_key) continue
    const source = sourceByAgendaItemKey.get(item.template_item_key)
    if (!source) continue
    const result = resolvedByAgendaItemId.get(item.id)
    if (result) out.set(source, result)
  }

  // Extra framework signals — anything the agenda did not already cover.
  for (const [source, result] of extraSignalsBySource) {
    if (!out.has(source)) out.set(source, result)
  }

  return out
}

function shapeDatasets(bySource: Map<Source, RenderedBindingResult>): MeetingBriefingDatasets {
  const out: MeetingBriefingDatasets = {}

  // KPI summary — count specific values from various sources.
  const incidents = bySource.get('incidents')
  const incidentsRows = (incidents?.dataRows ?? []) as Array<{ status?: string; count?: number }>
  const incidentsOpen =
    incidentsRows
      .filter((r) => ['Meldt', 'Under utredning', 'Venter tiltak'].includes(String(r.status ?? '')))
      .reduce((s, r) => s + (Number(r.count) || 0), 0)
  const incidentsTotal = incidentsRows.reduce((s, r) => s + (Number(r.count) || 0), 0)
  const incidentsCritical = extractCriticalFromSummary(incidents)

  const sickLeave = bySource.get('sick_leave_stats')
  const sickLeaveRows = (sickLeave?.dataRows ?? []) as Array<{ department?: string; count?: number }>
  const sickLeaveCases = sickLeaveRows.reduce((s, r) => s + (Number(r.count) || 0), 0)

  const ros = bySource.get('open_ros_high')
  const rosRows = (ros?.dataRows ?? []) as Array<Record<string, unknown>>
  const openHighRos = rosRows.length

  const decisions = bySource.get('open_decisions')
  const decisionRows = (decisions?.dataRows ?? []) as Array<Record<string, unknown>>
  const openDecisions = decisionRows.length

  const vernerunder = bySource.get('vernerunde_findings')
  const vernerunderRows = (vernerunder?.dataRows ?? []) as Array<{ status?: string; count?: number }>
  const vernerunderInPeriod = vernerunderRows.reduce((s, r) => s + (Number(r.count) || 0), 0)

  out.briefing_kpi_summary = {
    incidentsTotal,
    incidentsOpen,
    incidentsCritical,
    sickLeaveCases,
    openHighRos,
    openDecisions,
    vernerunderInPeriod,
  }

  // Distribution datasets — `{segments: [{label, value}]}` shape per
  // the existing donut/bar widget convention.
  out.briefing_incidents_by_status = {
    segments: incidentsRows.map((r) => ({ label: r.status ?? '—', value: Number(r.count) || 0 })),
  }
  out.briefing_vernerunder_by_status = {
    segments: vernerunderRows.map((r) => ({ label: r.status ?? '—', value: Number(r.count) || 0 })),
  }
  out.briefing_sick_leave_by_dept = {
    segments: sickLeaveRows.map((r) => ({ label: r.department ?? '—', value: Number(r.count) || 0 })),
  }
  const wb = bySource.get('whistleblowing_anonymized')
  const wbRows = (wb?.dataRows ?? []) as Array<{ status?: string; count?: number }>
  out.briefing_whistleblowing_status = {
    segments: wbRows.map((r) => ({ label: r.status ?? '—', value: Number(r.count) || 0 })),
  }
  const training = bySource.get('training_completion')
  const trainingRows = (training?.dataRows ?? []) as Array<{ trainingKind?: string; count?: number }>
  out.briefing_training_by_kind = {
    segments: trainingRows.map((r) => ({ label: r.trainingKind ?? '—', value: Number(r.count) || 0 })),
  }

  // Row-shaped datasets — passed through unchanged.
  out.briefing_open_ros_high = rosRows
  out.briefing_open_decisions = decisionRows

  return out
}

/** Pull a critical-count from the human summary string when available.
 *  The resolver emits "**N** av disse er klassifisert som kritiske." */
function extractCriticalFromSummary(snap: RenderedBindingResult | undefined): number {
  if (!snap?.summaryMarkdown) return 0
  const m = snap.summaryMarkdown.match(/\*\*(\d+)\*\* av disse er klassifisert som kritiske/)
  if (!m) return 0
  return Number(m[1]) || 0
}
