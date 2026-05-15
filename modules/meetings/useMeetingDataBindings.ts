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

import { useEffect, useMemo, useState } from 'react'
import { useHse } from '../../src/hooks/useHse'
import { useInternalControl } from '../../src/hooks/useInternalControl'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useRepresentatives } from '../../src/hooks/useRepresentatives'
import { useOrgHealth } from '../../src/hooks/useOrgHealth'
import type {
  MeetingAgendaItemRow,
  MeetingDataBinding,
  MeetingRow,
  MeetingTemplateAgendaItem,
  RenderedBindingResult,
} from './types'
import { FRAMEWORK_SIGNAL_SOURCES } from './lib/frameworkSignals'

export type UseMeetingDataBindingsArgs = {
  meeting: MeetingRow | null
  agendaItems: MeetingAgendaItemRow[]
}

export type UseMeetingDataBindingsReturn = {
  /** Resolved snapshot per agenda-item id. Missing key = no binding. */
  resolvedByAgendaItemId: Map<string, RenderedBindingResult>
  /** Framework-relevant signals NOT mapped to an agenda item yet. The
   *  Datapakke tab renders these as additional widgets, and the Agenda
   *  tab uses them to suggest new agenda items. Keyed by source. */
  extraSignalsBySource: Map<MeetingDataBinding['source'], RenderedBindingResult>
  /** True while underlying module data is loading. */
  loading: boolean
}

export type WindowRange = { start: Date; end: Date }

/**
 * Resolves the {start, end} bounds for a binding's `window`.
 *
 * When `meeting.reporting_period_start` AND `reporting_period_end` are both
 * set (filled by the user in the create dialog or Datapakke "Endre periode"
 * modal), they OVERRIDE the relative window — this is how AMU Q1 2026 can
 * lock to Oct-Dec 2025 instead of "last quarter from now".
 *
 * When the meeting has no explicit period, we fall back to a relative
 * window anchored on `now`.
 */
export function pickWindowRange(
  window: MeetingDataBinding['window'],
  meeting: Pick<MeetingRow, 'reporting_period_start' | 'reporting_period_end'> | null,
): WindowRange {
  if (meeting?.reporting_period_start && meeting?.reporting_period_end) {
    return {
      start: new Date(meeting.reporting_period_start),
      // Include the full end day — periods are date-only (no time).
      end: new Date(`${meeting.reporting_period_end}T23:59:59.999`),
    }
  }
  const now = Date.now()
  const end = new Date(now)
  switch (window) {
    case 'last_month':
      return { start: new Date(now - 31 * 86400000), end }
    case 'last_quarter':
      return { start: new Date(now - 93 * 86400000), end }
    case 'last_half_year':
      return { start: new Date(now - 186 * 86400000), end }
    case 'last_year':
      return { start: new Date(now - 366 * 86400000), end }
    case 'current':
    case 'all_open':
    default:
      // 10 years back = de facto all-time without sorting headaches.
      return { start: new Date(now - 10 * 365 * 86400000), end }
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
  const ic = useInternalControl()
  const orgSetup = useOrgSetupContext()
  const rep = useRepresentatives()
  const orgHealth = useOrgHealth()

  // Resolve the effective range up front so the cross-module hook keys on it.
  const range = useMemo(
    () =>
      pickWindowRange(
        // Default to 'last_quarter' when no agenda binding is set — the
        // hook still queries cross-module data for whatever range the
        // meeting itself prescribes (it's idempotent if unused).
        'last_quarter',
        meeting,
      ),
    [meeting],
  )
  const crossModule = useCrossModuleCounts(meeting?.organization_id ?? null, range)

  const ctxObj = useMemo<ResolveCtx>(
    () => ({ hse, ic, orgSetup, rep, orgHealth, crossModule, meeting }),
    [hse, ic, orgSetup, rep, orgHealth, crossModule, meeting],
  )

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

      const result = resolveBinding(binding, resolvedAt, ctxObj)
      if (result) out.set(item.id, result)
    }
    return out
  }, [meeting, agendaItems, ctxObj])

  // Framework-relevant signals NOT bound to any agenda item.
  // The Datapakke tab uses these as additional widgets; the Agenda tab
  // uses them to suggest new topics when something newsworthy surfaces
  // (e.g. 5 critical incidents but no `incidents` agenda item).
  const extraSignalsBySource = useMemo(() => {
    const out = new Map<MeetingDataBinding['source'], RenderedBindingResult>()
    if (!meeting) return out

    const framework = meeting.definition_snapshot?.framework
    if (!framework) return out

    const frameworkSources =
      (FRAMEWORK_SIGNAL_SOURCES as Record<string, Array<MeetingDataBinding['source']>>)[
        framework
      ] ?? []
    if (frameworkSources.length === 0) return out

    // Sources already covered by the template's agenda bindings.
    const covered = new Set<MeetingDataBinding['source']>()
    const snapshot = meeting.definition_snapshot
    if (snapshot?.agendaItems?.length) {
      for (const tpl of snapshot.agendaItems as MeetingTemplateAgendaItem[]) {
        if (tpl.dataBinding) covered.add(tpl.dataBinding.source)
      }
    }

    const resolvedAt = new Date().toISOString()

    for (const source of frameworkSources) {
      if (covered.has(source)) continue
      // Use the same default `window` per source as the templates do —
      // pickWindowRange will still prefer meeting.reporting_period_* when set.
      const defaultWindow: MeetingDataBinding['window'] =
        source === 'open_decisions' || source === 'open_ros_high'
          ? 'all_open'
          : source === 'headcount_and_amu_composition'
            ? 'current'
            : 'last_quarter'
      const binding: MeetingDataBinding = {
        source,
        window: defaultWindow,
        presentation: 'summary',
      }
      const result = resolveBinding(binding, resolvedAt, ctxObj)
      if (result && !result.error) out.set(source, result)
    }
    return out
  }, [meeting, ctxObj])

  return {
    resolvedByAgendaItemId,
    extraSignalsBySource,
    loading: (hse.loading ?? false) || crossModule.loading,
  }
}

/**
 * Pure resolver — same fan-out as the hook, but takes pre-loaded module
 * data + cross-module counts as arguments instead of mounting hooks.
 * Used by `useMeetings.createMeeting` to eagerly resolve every binding
 * and persist `binding_snapshot` at meeting creation time.
 */
export function resolveAllForMeeting(
  meeting: MeetingRow,
  agendaItems: MeetingAgendaItemRow[],
  ctx: ResolveCtx,
): Map<string, RenderedBindingResult> {
  const out = new Map<string, RenderedBindingResult>()
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
    const result = resolveBinding(binding, resolvedAt, ctx)
    if (result) out.set(item.id, result)
  }
  return out
}

// ── Per-source resolvers ──────────────────────────────────────────────────

type ResolveCtx = {
  hse: ReturnType<typeof useHse>
  ic: ReturnType<typeof useInternalControl>
  orgSetup: ReturnType<typeof useOrgSetupContext>
  rep: ReturnType<typeof useRepresentatives>
  orgHealth: ReturnType<typeof useOrgHealth>
  crossModule: CrossModuleCounts
  /**
   * The meeting the bindings resolve against. Pulled in so resolvers
   * can call `pickWindowRange(binding.window, meeting)` and respect the
   * user-chosen reporting period (preferred over relative windows).
   */
  meeting: MeetingRow | null
}

/**
 * Cross-module aggregates that need a supabase round-trip to compute.
 * Cached in {@link useCrossModuleCounts} and refreshed whenever the
 * meeting's reporting period changes.
 */
export type CrossModuleCounts = {
  loading: boolean
  openDecisions: Array<{
    id: string
    meeting_id: string
    decision_text: string
    decision_at: string | null
    status: 'open' | 'implemented' | 'dropped'
  }>
  complianceChecklist: {
    openCount: number
    criticalFindings: number
    ytdCompleted: number
  }
  whistleblowing: {
    received: number
    triage: number
    investigation: number
    internal_review: number
    closed: number
    total: number
  }
}

const EMPTY_CROSS_MODULE: CrossModuleCounts = {
  loading: false,
  openDecisions: [],
  complianceChecklist: { openCount: 0, criticalFindings: 0, ytdCompleted: 0 },
  whistleblowing: {
    received: 0,
    triage: 0,
    investigation: 0,
    internal_review: 0,
    closed: 0,
    total: 0,
  },
}

/**
 * Internal hook — pulls supabase counts the in-memory module hooks don't
 * already expose. Used for `compliance_checklist_status`,
 * `whistleblowing_anonymized`, and `open_decisions` resolvers.
 *
 * Caches by [orgId, range.start, range.end] — re-fetches when the user
 * changes the reporting period on a meeting.
 */
function useCrossModuleCounts(
  orgId: string | null,
  range: WindowRange,
): CrossModuleCounts {
  const { supabase } = useOrgSetupContext()
  const [state, setState] = useState<CrossModuleCounts>(EMPTY_CROSS_MODULE)
  const startIso = range.start.toISOString()
  const endIso = range.end.toISOString()

  useEffect(() => {
    // Skip the fetch when prerequisites missing — state stays at its initial
    // EMPTY value (or whatever was last set for the previous org). Synchronous
    // setState in the empty branch trips eslint's react-hooks/set-state-in-effect.
    if (!supabase || !orgId) return
    let cancelled = false

    void (async () => {
      // Loading flag is set asynchronously to avoid a synchronous setState
      // inside the effect body (react-hooks/set-state-in-effect).
      setState((prev) => ({ ...prev, loading: true }))
      const [decisionsRes, checklistOpenRes, checklistCritRes, checklistYtdRes, wbRes] =
        await Promise.all([
          supabase
            .from('meeting_decisions')
            .select('id, meeting_id, decision_text, decision_at, status')
            .eq('organization_id', orgId)
            .eq('status', 'open')
            .order('decision_at', { ascending: false, nullsFirst: false })
            .limit(50),
          supabase
            .from('compliance_checklist_executions')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .in('status', ['draft', 'in_progress']),
          supabase
            .from('compliance_checklist_findings')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .eq('severity', 'critical'),
          supabase
            .from('compliance_checklist_executions')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .eq('status', 'signed')
            .gte('completed_at', new Date(`${new Date().getFullYear()}-01-01`).toISOString()),
          supabase
            .from('alert_cases')
            .select('id, status', { count: 'exact' })
            .eq('organization_id', orgId)
            .eq('kind', 'whistleblowing')
            .gte('received_at', startIso)
            .lte('received_at', endIso),
        ])

      if (cancelled) return

      const wbByStatus = {
        received: 0,
        triage: 0,
        investigation: 0,
        internal_review: 0,
        closed: 0,
      }
      for (const row of (wbRes.data ?? []) as Array<{ status: string }>) {
        if (row.status && row.status in wbByStatus) {
          wbByStatus[row.status as keyof typeof wbByStatus] += 1
        }
      }

      setState({
        loading: false,
        openDecisions: ((decisionsRes.data ?? []) as Array<{
          id: string
          meeting_id: string
          decision_text: string
          decision_at: string | null
          status: 'open' | 'implemented' | 'dropped'
        }>),
        complianceChecklist: {
          openCount: checklistOpenRes.count ?? 0,
          criticalFindings: checklistCritRes.count ?? 0,
          ytdCompleted: checklistYtdRes.count ?? 0,
        },
        whistleblowing: { ...wbByStatus, total: wbRes.count ?? 0 },
      })
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, orgId, startIso, endIso])

  return state
}

const MANUAL_PREP_MESSAGES: Partial<Record<MeetingDataBinding['source'], string>> = {
  // Surface remaining manual-prep sources whose module rollups aren't yet
  // stable enough to bind automatically.
  bht_annual_report:
    'Vedlegg eller link bedriftshelsetjenestens årsrapport. Manuell vedlegg-prosess inntil BHT-integrasjon ferdig.',
  ik_annual_review_status:
    'Hent siste IK-årsgjennomgang fra internkontrollmodulen og oppsummer status + gjenstående tiltak.',
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
    case 'vernerunde_findings':
      return resolveVernerundeFindings(binding, resolvedAt, ctx)
    case 'open_ros_high':
      return resolveOpenRosHigh(binding, resolvedAt, ctx)
    case 'training_completion':
      return resolveTrainingCompletion(binding, resolvedAt, ctx)
    case 'headcount_and_amu_composition':
      return resolveHeadcountAmu(binding, resolvedAt, ctx)
    case 'open_decisions':
      return resolveOpenDecisions(binding, resolvedAt, ctx)
    case 'survey_results':
      return resolveSurveyResults(binding, resolvedAt, ctx)
    case 'compliance_checklist_status':
      return resolveComplianceChecklistStatus(binding, resolvedAt, ctx)
    case 'whistleblowing_anonymized':
      return resolveWhistleblowingAnonymized(binding, resolvedAt, ctx)
    case 'bht_annual_report':
    case 'ik_annual_review_status':
      return {
        source: binding.source,
        window: binding.window,
        resolvedAt,
        summaryMarkdown:
          MANUAL_PREP_MESSAGES[binding.source] ??
          'Manuell forberedelse — hent data fra relevant modul.',
        error: 'Automatisk binding ikke tilgjengelig — manuell forberedelse kreves.',
      }
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
  { hse, meeting }: ResolveCtx,
): RenderedBindingResult {
  const range = pickWindowRange(binding.window, meeting)
  const windowStart = range.start
  const windowEnd = range.end
  const inWindow = hse.sickLeaveCases.filter((c) => {
    if (!c.sickFrom) return false
    const d = new Date(c.sickFrom)
    return d >= windowStart && d <= windowEnd
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

function resolveVernerundeFindings(
  binding: MeetingDataBinding,
  resolvedAt: string,
  { hse, meeting }: ResolveCtx,
): RenderedBindingResult {
  const range = pickWindowRange(binding.window, meeting)
  const windowStart = range.start
  const windowEnd = range.end
  const rounds = (hse.safetyRounds ?? []) as Array<{
    status?: string
    conductedAt?: string
    plannedAt?: string
    createdAt?: string
  }>
  const inWindow = rounds.filter((r) => {
    const at = r.conductedAt ?? r.plannedAt ?? r.createdAt
    if (!at) return false
    const d = new Date(at)
    return d >= windowStart && d <= windowEnd
  })
  const approved = inWindow.filter((r) => r.status === 'approved').length
  const pending = inWindow.filter(
    (r) => r.status === 'pending_verneombud' || r.status === 'pending_approval',
  ).length
  const ongoing = inWindow.filter((r) => r.status === 'in_progress').length

  const summary =
    inWindow.length === 0
      ? `Ingen vernerunder registrert i ${windowLabel(binding.window)}.`
      : `${inWindow.length} vernerunder i ${windowLabel(binding.window)} — ${approved} signerte, ${pending} venter på verneombud, ${ongoing} pågående.`

  return {
    source: 'vernerunde_findings',
    window: binding.window,
    resolvedAt,
    summaryMarkdown: summary,
    dataRows: [
      { status: 'Signert', count: approved },
      { status: 'Venter signatur', count: pending },
      { status: 'Pågående', count: ongoing },
    ],
  }
}

function resolveOpenRosHigh(
  binding: MeetingDataBinding,
  resolvedAt: string,
  { ic }: ResolveCtx,
): RenderedBindingResult {
  const highRiskRows = (ic.rosAssessments ?? []).flatMap((r) =>
    (r.rows ?? [])
      .filter((row) => {
        const s = row.status ?? 'draft'
        const done = s === 'finished' || s === 'closed' || s === 'cancelled' || row.done
        return !done && (row.riskScore ?? 0) >= 12
      })
      .map((row) => ({ ...row, assessmentTitle: r.title })),
  )
  highRiskRows.sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
  const top = highRiskRows.slice(0, 5)

  const summary =
    highRiskRows.length === 0
      ? 'Ingen åpne ROS-risikoer med risikoskår ≥ 12.'
      : `${highRiskRows.length} åpne ROS-risikoer med risikoskår ≥ 12. Topp ${top.length}: ${top
          .map((r) => `${r.assessmentTitle} (skår ${r.riskScore})`)
          .join('; ')}.`

  return {
    source: 'open_ros_high',
    window: binding.window,
    resolvedAt,
    summaryMarkdown: summary,
    dataRows: top.map((r) => ({
      assessment: r.assessmentTitle,
      riskScore: r.riskScore,
      hazard: (r as { hazard?: string }).hazard ?? '',
    })),
  }
}

function resolveTrainingCompletion(
  binding: MeetingDataBinding,
  resolvedAt: string,
  { hse, meeting }: ResolveCtx,
): RenderedBindingResult {
  const range = pickWindowRange(binding.window, meeting)
  const windowStart = range.start
  const windowEnd = range.end
  const inWindow = (hse.trainingRecords ?? []).filter((r) => {
    if (!r.completedAt) return false
    const d = new Date(r.completedAt)
    return d >= windowStart && d <= windowEnd
  })
  const total = inWindow.length
  const expiringSoon = (hse.trainingRecords ?? []).filter((r) => {
    if (!r.expiresAt) return false
    const expires = new Date(r.expiresAt).getTime()
    const now = Date.now()
    return expires > now && expires - now < 90 * 86400000
  }).length

  const byKind = new Map<string, number>()
  for (const r of inWindow) {
    const k = r.trainingKind || 'annet'
    byKind.set(k, (byKind.get(k) ?? 0) + 1)
  }
  const topKinds = [...byKind.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const summary =
    total === 0 && expiringSoon === 0
      ? `Ingen registrert opplæring i ${windowLabel(binding.window)} og ingen utløpende kompetanse de neste 90 dagene.`
      : [
          `${total} opplæringspost(er) registrert i ${windowLabel(binding.window)}.`,
          topKinds.length
            ? `Mest registrert: ${topKinds.map(([k, n]) => `${k} (${n})`).join(', ')}.`
            : '',
          expiringSoon > 0 ? `**${expiringSoon}** sertifikat(er) utløper innen 90 dager.` : '',
        ]
          .filter(Boolean)
          .join('\n')

  return {
    source: 'training_completion',
    window: binding.window,
    resolvedAt,
    summaryMarkdown: summary,
    dataRows: topKinds.map(([trainingKind, count]) => ({ trainingKind, count })),
  }
}

function resolveHeadcountAmu(
  binding: MeetingDataBinding,
  resolvedAt: string,
  { orgSetup, rep }: ResolveCtx,
): RenderedBindingResult {
  const headcount = orgSetup.members?.length ?? 0
  const repMembers = rep.members ?? []
  const employerReps = repMembers.filter((m) =>
    ['leadership_chair', 'leadership_deputy', 'leadership_member'].includes(m.officeRole),
  )
  const employeeReps = repMembers.filter((m) =>
    ['employee_chair', 'employee_deputy', 'employee_member'].includes(m.officeRole),
  )
  const verneombud = repMembers.filter((m) => m.isVerneombud)

  const amuMandatory = headcount >= 30
  const amuOnRequest = headcount >= 10 && headcount < 30
  const thresholdSummary = amuMandatory
    ? 'AMU er **lovpålagt** (AML § 7-1 — minst 30 ansatte).'
    : amuOnRequest
      ? 'AMU **på krav fra én part** (AML § 7-1 — mellom 10 og 30 ansatte).'
      : 'AMU-terskelen er ikke nådd (AML § 7-1 — under 10 ansatte).'

  const balance =
    employerReps.length === employeeReps.length && employerReps.length > 0
      ? 'AMU har **balansert sammensetning** (likt antall arbeidsgiver- og arbeidstakerrepresentanter, jf. § 7-1).'
      : 'AMU har **ubalansert sammensetning** — likt antall arbeidsgiver- og arbeidstakerrepresentanter kreves jf. § 7-1.'

  const summary = [
    `Antall ansatte: **${headcount}**.`,
    thresholdSummary,
    `AMU-medlemmer: ${employerReps.length} arbeidsgiverrepresentant(er), ${employeeReps.length} arbeidstakerrepresentant(er), ${verneombud.length} verneombud.`,
    employerReps.length + employeeReps.length > 0 ? balance : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    source: 'headcount_and_amu_composition',
    window: binding.window,
    resolvedAt,
    summaryMarkdown: summary,
    dataRows: [
      { kategori: 'Ansatte totalt', antall: headcount },
      { kategori: 'Arbeidsgiverrepr.', antall: employerReps.length },
      { kategori: 'Ansattrepr.', antall: employeeReps.length },
      { kategori: 'Verneombud', antall: verneombud.length },
    ],
  }
}

function resolveOpenDecisions(
  binding: MeetingDataBinding,
  resolvedAt: string,
  { crossModule }: ResolveCtx,
): RenderedBindingResult {
  const openDecisions = crossModule.openDecisions
  if (openDecisions.length === 0) {
    return {
      source: 'open_decisions',
      window: binding.window,
      resolvedAt,
      summaryMarkdown: 'Ingen åpne vedtak fra tidligere møter i denne organisasjonen.',
    }
  }
  const top = openDecisions.slice(0, 5)
  const summary = [
    `**${openDecisions.length}** åpne vedtak fra tidligere møter venter på oppfølging.`,
    top.length
      ? `Eldste 5: ${top
          .map((d) => {
            const at = d.decision_at ? new Date(d.decision_at).toLocaleDateString('nb-NO') : '—'
            return `«${d.decision_text.slice(0, 60)}» (${at})`
          })
          .join('; ')}.`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
  return {
    source: 'open_decisions',
    window: binding.window,
    resolvedAt,
    summaryMarkdown: summary,
    dataRows: top.map((d) => ({
      decisionText: d.decision_text,
      decisionAt: d.decision_at,
    })),
  }
}

function resolveSurveyResults(
  binding: MeetingDataBinding,
  resolvedAt: string,
  { orgHealth, meeting }: ResolveCtx,
): RenderedBindingResult {
  const range = pickWindowRange(binding.window, meeting)
  // useOrgHealth returns surveys with a schedule + summary; we don't know
  // the exact internal shape so we keep this defensive.
  const surveys = (orgHealth.surveys ?? []) as Array<{
    id?: string
    title?: string
    status?: string
    updatedAt?: string
    completedAt?: string | null
    responses?: Array<unknown>
    amuSharedSummaryAt?: string | null
  }>
  const inWindow = surveys.filter((s) => {
    const at = s.completedAt ?? s.updatedAt
    if (!at) return false
    const d = new Date(at)
    return d >= range.start && d <= range.end
  })
  if (inWindow.length === 0) {
    return {
      source: 'survey_results',
      window: binding.window,
      resolvedAt,
      summaryMarkdown: `Ingen fullførte arbeidsmiljøundersøkelser i perioden. Vurder å bestille en ny.`,
    }
  }
  const latest = inWindow[0]
  const responses = Array.isArray(latest.responses) ? latest.responses.length : 0
  const summary = [
    `Siste arbeidsmiljøundersøkelse: «${latest.title ?? 'Uten tittel'}».`,
    `${responses} svar registrert.`,
    latest.amuSharedSummaryAt ? 'Sammendrag allerede delt med AMU.' : 'Sammendrag enda ikke delt med AMU.',
  ].join('\n')
  return {
    source: 'survey_results',
    window: binding.window,
    resolvedAt,
    summaryMarkdown: summary,
    dataRows: inWindow.map((s) => ({
      title: s.title,
      status: s.status,
      responses: Array.isArray(s.responses) ? s.responses.length : 0,
    })),
  }
}

function resolveComplianceChecklistStatus(
  binding: MeetingDataBinding,
  resolvedAt: string,
  { crossModule }: ResolveCtx,
): RenderedBindingResult {
  const c = crossModule.complianceChecklist
  const summary = [
    `**${c.openCount}** sjekklister under behandling.`,
    c.criticalFindings > 0
      ? `**${c.criticalFindings}** kritiske funn krever oppfølging.`
      : 'Ingen kritiske funn.',
    `${c.ytdCompleted} sjekklister signert hittil i år.`,
  ].join('\n')
  return {
    source: 'compliance_checklist_status',
    window: binding.window,
    resolvedAt,
    summaryMarkdown: summary,
    dataRows: [
      { kategori: 'Åpne', antall: c.openCount },
      { kategori: 'Kritiske funn', antall: c.criticalFindings },
      { kategori: 'Signert i år', antall: c.ytdCompleted },
    ],
  }
}

function resolveWhistleblowingAnonymized(
  binding: MeetingDataBinding,
  resolvedAt: string,
  { crossModule }: ResolveCtx,
): RenderedBindingResult {
  const w = crossModule.whistleblowing
  const open = w.received + w.triage + w.investigation + w.internal_review
  if (w.total === 0) {
    return {
      source: 'whistleblowing_anonymized',
      window: binding.window,
      resolvedAt,
      summaryMarkdown: 'Ingen varslingssaker registrert i perioden.',
    }
  }
  // § 2A-7 (5) — anonymized rollup. Never expose individual case identifiers
  // here; the resolver consciously emits counts only.
  const summary = [
    `**${w.total}** varslingssaker registrert i perioden — ${open} åpne, ${w.closed} lukket.`,
    `Fordeling: ${w.received} mottatt, ${w.triage} under triage, ${w.investigation} under undersøkelse, ${w.internal_review} under intern gjennomgang.`,
    `Iht. AML § 2A-7 (5) presenteres kun aggregerte tall — ingen identifiserende detaljer.`,
  ].join('\n')
  return {
    source: 'whistleblowing_anonymized',
    window: binding.window,
    resolvedAt,
    summaryMarkdown: summary,
    dataRows: [
      { status: 'Mottatt', count: w.received },
      { status: 'Triage', count: w.triage },
      { status: 'Undersøkelse', count: w.investigation },
      { status: 'Intern gjennomgang', count: w.internal_review },
      { status: 'Lukket', count: w.closed },
    ],
  }
}

function resolveIncidents(
  binding: MeetingDataBinding,
  resolvedAt: string,
  { hse, meeting }: ResolveCtx,
): RenderedBindingResult {
  const range = pickWindowRange(binding.window, meeting)
  const windowStart = range.start
  const windowEnd = range.end
  const inWindow = hse.incidents.filter((i) => {
    if (!i.occurredAt) return false
    const d = new Date(i.occurredAt)
    return d >= windowStart && d <= windowEnd
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
