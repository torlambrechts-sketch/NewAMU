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
import { useInternalControl } from '../../src/hooks/useInternalControl'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useRepresentatives } from '../../src/hooks/useRepresentatives'
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
  const ic = useInternalControl()
  const orgSetup = useOrgSetupContext()
  const rep = useRepresentatives()

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

      const result = resolveBinding(binding, resolvedAt, { hse, ic, orgSetup, rep })
      if (result) out.set(item.id, result)
    }
    return out
  }, [meeting, agendaItems, hse, ic, orgSetup, rep])

  return {
    resolvedByAgendaItemId,
    loading: hse.loading ?? false,
  }
}

// ── Per-source resolvers ──────────────────────────────────────────────────

type ResolveCtx = {
  hse: ReturnType<typeof useHse>
  ic: ReturnType<typeof useInternalControl>
  orgSetup: ReturnType<typeof useOrgSetupContext>
  rep: ReturnType<typeof useRepresentatives>
}

const MANUAL_PREP_MESSAGES: Partial<Record<MeetingDataBinding['source'], string>> = {
  whistleblowing_anonymized:
    'Vedlegg anonymisert oversikt fra varslingsmodulen (§ 2A-7 (5)). Husk taushetsplikt.',
  survey_results:
    'Hent siste arbeidsmiljøundersøkelsesrapport fra undersøkelsesmodulen og oppsummer hovedfunn.',
  compliance_checklist_status:
    'Hent siste status fra Sjekklister-modulen (samsvarsoversikt og åpne tiltak).',
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
      return resolveOpenDecisions(binding, resolvedAt)
    case 'whistleblowing_anonymized':
    case 'survey_results':
    case 'compliance_checklist_status':
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

function resolveVernerundeFindings(
  binding: MeetingDataBinding,
  resolvedAt: string,
  { hse }: ResolveCtx,
): RenderedBindingResult {
  const windowStart = pickWindowStart(binding.window)
  const rounds = (hse.safetyRounds ?? []) as Array<{
    status?: string
    conductedAt?: string
    plannedAt?: string
    createdAt?: string
  }>
  const inWindow = rounds.filter((r) => {
    const at = r.conductedAt ?? r.plannedAt ?? r.createdAt
    if (!at) return false
    return new Date(at) >= windowStart
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
  { hse }: ResolveCtx,
): RenderedBindingResult {
  const windowStart = pickWindowStart(binding.window)
  const inWindow = (hse.trainingRecords ?? []).filter((r) => {
    if (!r.completedAt) return false
    return new Date(r.completedAt) >= windowStart
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
): RenderedBindingResult {
  // The decisions register is per-meeting in the current detail view.
  // A cross-meeting decisions feed lives in `meeting_decisions` table —
  // the resolver would need supabase access. For now, surface as a
  // manual-prep nudge so the chair pulls the latest vedtak from the
  // Vedtak tab on the previous meeting.
  return {
    source: 'open_decisions',
    window: binding.window,
    resolvedAt,
    summaryMarkdown:
      'Hent åpne vedtak fra forrige møte (Vedtak-fanen) og legg status i sammendraget.',
    error: 'Cross-meeting vedtaksregister kommer i en senere fase.',
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
