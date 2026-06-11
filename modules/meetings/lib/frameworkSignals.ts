// frameworkSignals — per-framework catalog of "newsworthy" data sources.
//
// Why
//   Templates carry `dataBinding` per agenda item, but real life surfaces
//   signals the template doesn't anticipate (e.g. an AMU Q1 template
//   covers vernerunder + sykefravær, but maybe THIS quarter also has
//   3 critical incidents in a department the template doesn't reserve
//   an item for — those should still surface in the chair's pre-read).
//
//   This module declares which data sources are RELEVANT to which
//   framework. The Datapakke tab renders every relevant source as a
//   widget, regardless of whether the template binds to it. The Agenda
//   tab uses the same catalog to suggest topics for signals that have
//   data but no matching agenda item.
//
// Severity rules (lightweight — resolvers stay framework-agnostic)
//   - 'info'    — data exists but neutral (e.g. 2 vernerunder, both clean)
//   - 'warn'    — data warrants discussion (e.g. open ROS ≥ 12)
//   - 'critical'— immediate concern (e.g. critical incident not closed)
//
//   The resolver itself doesn't tag severity — this catalog computes it
//   downstream from the snapshot's dataRows.

import type {
  MeetingDataBinding,
  MeetingFramework,
  RenderedBindingResult,
} from '../types'

export type SignalSeverity = 'info' | 'warn' | 'critical'

/** Sources each framework considers relevant for a meeting context. */
export const FRAMEWORK_SIGNAL_SOURCES: Record<
  MeetingFramework,
  Array<MeetingDataBinding['source']>
> = {
  AML: [
    'sick_leave_stats',
    'incidents',
    'vernerunde_findings',
    'open_ros_high',
    'training_completion',
    'open_decisions',
    'whistleblowing_anonymized',
    'headcount_and_amu_composition',
  ],
  'IK-f': ['open_ros_high', 'incidents', 'vernerunde_findings'],
  Hovedavtalen: ['headcount_and_amu_composition', 'open_decisions', 'survey_results'],
  Likestillingsloven: [
    'headcount_and_amu_composition',
    'survey_results',
    'open_decisions',
  ],
  ISO_9001: [
    'compliance_checklist_status',
    'incidents',
    'open_ros_high',
    'training_completion',
    'open_decisions',
  ],
  ISO_14001: [
    'compliance_checklist_status',
    'incidents',
    'open_decisions',
    'open_ros_high',
  ],
  ISO_45001: [
    'incidents',
    'sick_leave_stats',
    'vernerunde_findings',
    'open_ros_high',
    'training_completion',
    'compliance_checklist_status',
    'open_decisions',
  ],
  ISO_27001: [
    'incidents',
    'open_ros_high',
    'compliance_checklist_status',
    'open_decisions',
  ],
  GDPR: ['open_decisions', 'open_ros_high'],
  // New frameworks added in the v2 research-report extension. Most are
  // governance/legal frameworks that don't depend on cross-module signal
  // sources (their meetings are document-driven, not data-binding-driven).
  Aksjeloven: ['open_decisions'],
  Folketrygdloven: ['sick_leave_stats'],
  'AKAN-modellen': [],
  Arbeidstvistloven: [],
  Arbeidsmarkedsloven: ['headcount_and_amu_composition'],
  Byggherreforskriften: ['incidents', 'open_ros_high'],
  INTERNAL: [],
}

/** Norwegian label per source — used for widget titles and suggestion copy. */
export const SIGNAL_LABEL: Record<
  MeetingDataBinding['source'],
  { title: string; topic: string }
> = {
  sick_leave_stats: {
    title: 'Sykefravær',
    topic: 'Sykefraværsutvikling',
  },
  incidents: {
    title: 'Avvik og hendelser',
    topic: 'Avvik og hendelser — gjennomgang',
  },
  vernerunde_findings: {
    title: 'Vernerunder',
    topic: 'Vernerunder — status og funn',
  },
  open_ros_high: {
    title: 'ROS — høy restrisiko',
    topic: 'ROS-status (åpne høyrisiko-saker)',
  },
  training_completion: {
    title: 'Opplæring',
    topic: 'Opplæringsstatus',
  },
  headcount_and_amu_composition: {
    title: 'Bemanning og AMU-sammensetning',
    topic: 'Bemanning og AMU-sammensetning',
  },
  open_decisions: {
    title: 'Åpne vedtak fra tidligere møter',
    topic: 'Oppfølging av åpne vedtak',
  },
  whistleblowing_anonymized: {
    title: 'Varslingssaker (anonymisert)',
    topic: 'Varslingssaker — anonymisert oversikt',
  },
  survey_results: {
    title: 'Arbeidsmiljøundersøkelse',
    topic: 'Arbeidsmiljøundersøkelse — siste resultater',
  },
  compliance_checklist_status: {
    title: 'Sjekklister — status',
    topic: 'Sjekklister og samsvarsstatus',
  },
  bht_annual_report: {
    title: 'BHT-årsrapport',
    topic: 'BHT-årsrapport',
  },
  ik_annual_review_status: {
    title: 'IK-årsgjennomgang',
    topic: 'IK-årsgjennomgang',
  },
  okr_status: {
    title: 'Strategi & OKR — status',
    topic: 'OKR-gjennomgang — nøkkelresultater og tillit',
  },
}

/**
 * Compute severity from a resolved snapshot. Treat resolver errors as 'info'
 * (manual prep needed). dataRows > 0 with specific keys → escalate.
 */
export function severityFor(snapshot: RenderedBindingResult): SignalSeverity {
  if (snapshot.error) return 'info'
  const rows = snapshot.dataRows ?? []
  switch (snapshot.source) {
    case 'incidents': {
      // critical when any "kritisk" rows or > 5 open
      const open = rows
        .filter((r) =>
          ['Meldt', 'Under utredning', 'Venter tiltak'].includes(
            String((r as { status?: string }).status ?? ''),
          ),
        )
        .reduce((s, r) => s + (Number((r as { count?: number }).count) || 0), 0)
      if (open >= 5) return 'critical'
      if (open >= 1) return 'warn'
      return 'info'
    }
    case 'open_ros_high':
      return rows.length >= 5 ? 'critical' : rows.length > 0 ? 'warn' : 'info'
    case 'sick_leave_stats':
      return rows.length >= 3 ? 'warn' : 'info'
    case 'vernerunde_findings': {
      const pending = rows
        .filter((r) =>
          ['Venter signatur', 'Pågående'].includes(
            String((r as { status?: string }).status ?? ''),
          ),
        )
        .reduce((s, r) => s + (Number((r as { count?: number }).count) || 0), 0)
      return pending >= 3 ? 'warn' : 'info'
    }
    case 'whistleblowing_anonymized': {
      const open = rows
        .filter((r) =>
          ['Mottatt', 'Triage', 'Undersøkelse', 'Intern gjennomgang'].includes(
            String((r as { status?: string }).status ?? ''),
          ),
        )
        .reduce((s, r) => s + (Number((r as { count?: number }).count) || 0), 0)
      return open >= 3 ? 'critical' : open > 0 ? 'warn' : 'info'
    }
    case 'open_decisions':
      return rows.length >= 5 ? 'warn' : 'info'
    case 'compliance_checklist_status': {
      const crit =
        rows.find((r) => (r as { kategori?: string }).kategori === 'Kritiske funn')
      const critValue = Number((crit as { antall?: number } | undefined)?.antall) || 0
      return critValue >= 1 ? 'critical' : 'info'
    }
    default:
      return 'info'
  }
}

/**
 * Decide whether a signal warrants a "suggested agenda item" — i.e. data
 * exists AND severity > 'info' AND no agenda item already covers it.
 *
 * `coveredKeys` is the set of `source` strings that the agenda already
 * binds (template_item_key → dataBinding.source).
 */
export function shouldSuggestTopic(
  source: MeetingDataBinding['source'],
  snapshot: RenderedBindingResult,
  coveredSources: Set<MeetingDataBinding['source']>,
): boolean {
  if (coveredSources.has(source)) return false
  if (snapshot.error) return false
  const sev = severityFor(snapshot)
  return sev !== 'info'
}
