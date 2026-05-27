// Label maps for the meetings module — keep alongside types so callers
// import once. Norwegian (nb) only — these strings drive the UI.

import type {
  MeetingActionStatus,
  MeetingAmuLeaderParty,
  MeetingAttendeeRole,
  MeetingCadence,
  MeetingConfidentialityLevel,
  MeetingDecisionStatus,
  MeetingFramework,
  MeetingSignerRole,
  MeetingStatus,
  MeetingVotingModel,
} from './types'

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  planned: 'Planlagt',
  in_progress: 'Pågår',
  completed: 'Gjennomført',
  cancelled: 'Avlyst',
}

export const MEETING_CONFIDENTIALITY_LABEL: Record<MeetingConfidentialityLevel, string> = {
  standard: 'Standard',
  restricted: 'Begrenset',
  confidential: 'Konfidensielt',
  akan: 'AKAN (taushetsplikt)',
}

export const MEETING_DECISION_STATUS_LABEL: Record<MeetingDecisionStatus, string> = {
  open: 'Åpent',
  implemented: 'Iverksatt',
  dropped: 'Avvist',
}

export const MEETING_ACTION_STATUS_LABEL: Record<MeetingActionStatus, string> = {
  open: 'Åpen',
  in_progress: 'Pågår',
  done: 'Utført',
  dropped: 'Avvist',
}

export const MEETING_ATTENDEE_ROLE_LABEL: Record<MeetingAttendeeRole, string> = {
  chair: 'Møteleder',
  secretary: 'Sekretær',
  member: 'Medlem',
  observer: 'Observatør',
  guest: 'Gjest',
  verneombud: 'Verneombud',
  hovedverneombud: 'Hovedverneombud',
  employer_rep: 'Arbeidsgiverrepr.',
  employee_rep: 'Ansattrepr.',
  tillitsvalgt: 'Tillitsvalgt',
}

export const MEETING_SIGNER_ROLE_LABEL: Record<MeetingSignerRole, string> = {
  chair: 'Møteleder',
  secretary: 'Sekretær',
  management: 'Ledelse',
  member: 'Medlem',
  other: 'Annet',
}

export const MEETING_CADENCE_LABEL: Record<MeetingCadence, string> = {
  monthly: 'Månedlig',
  quarterly: 'Kvartalsvis',
  semiannual: 'Halvårlig',
  annual: 'Årlig',
  ad_hoc: 'Ved behov',
}

export const MEETING_FRAMEWORK_LABEL: Record<MeetingFramework, string> = {
  INTERNAL: 'Internt',
  AML: 'AML',
  'IK-f': 'IK-forskriften',
  Hovedavtalen: 'Hovedavtalen',
  Likestillingsloven: 'Likestillingsloven',
  Aksjeloven: 'Aksjeloven',
  Folketrygdloven: 'Folketrygdloven',
  'AKAN-modellen': 'AKAN-modellen',
  Arbeidstvistloven: 'Arbeidstvistloven',
  Arbeidsmarkedsloven: 'Arbeidsmarkedsloven',
  Byggherreforskriften: 'Byggherreforskriften',
  ISO_9001: 'ISO 9001',
  ISO_14001: 'ISO 14001',
  ISO_27001: 'ISO 27001',
  ISO_45001: 'ISO 45001',
  GDPR: 'GDPR',
}

export function frameworkLabel(framework: string): string {
  return MEETING_FRAMEWORK_LABEL[framework as MeetingFramework] ?? framework
}

/** Stemmegivnings-modell labels — vist på agenda-item-rad + voting panel.
 *  Holdes konsistent med `meeting_vote_result()` i migration 20261005120000. */
export const MEETING_VOTING_MODEL_LABEL: Record<MeetingVotingModel, string> = {
  simple: 'Simpelt flertall',
  qualified: 'Kvalifisert flertall (2/3)',
  parity: 'AMU partssammensatt (parity)',
  consensus: 'Konsensus',
  anonymous: 'Anonym — simpelt flertall',
  aksje_simple_majority_one_third_floor:
    'Aksjeloven § 6-25 — flertall blant møtende + ≥ 1/3 av samtlige',
  weighted: 'Vektet (aksjeantall)',
}

export const MEETING_VOTING_MODEL_HINT: Record<MeetingVotingModel, string> = {
  simple: 'Flertall (ja > nei) av avgitte stemmer.',
  qualified: 'Minst 2/3 av avgitte stemmer må stemme ja (ekskl. avholdene).',
  parity:
    'AML § 7-1 (2): begge sider (arbeidsgiver + arbeidstaker) må ha flertall for ja. Forskriftens § 3-15 — leder dobbeltstemme ved likhet.',
  consensus: 'Vedtaket går igjennom bare hvis ingen stemmer mot (nei = 0).',
  anonymous:
    'Anonymisert stemming — individuelle stemmer logges uten medlemsnavn. Bare tellingen vises.',
  aksje_simple_majority_one_third_floor:
    'Aksjeloven § 6-25: flertall blant møtende OG flertallet må alltid utgjøre > 1/3 av samtlige styremedlemmer. Møtelederens stemme avgjør ved likhet.',
  weighted:
    'Generalforsamling: stemmer vektes etter aksjeantall (ballot_weight). Simpelt flertall av vektet sum.',
}

/** Veldig kort label for voting-result reason-strings fra meeting_vote_result.
 *  Brukes for å vise menneskelig forklaring under voting-tabellen i live-rommet. */
export const MEETING_VOTE_REASON_LABEL: Record<string, string> = {
  no_votes: 'Ingen stemmer avgitt',
  simple_majority_passed: 'Vedtatt — simpelt flertall',
  simple_majority_not_reached: 'Forkastet — ikke flertall',
  qualified_two_thirds_passed: 'Vedtatt — 2/3 flertall',
  qualified_two_thirds_not_reached: 'Forkastet — ikke 2/3 flertall',
  parity_both_sides_passed: 'Vedtatt — flertall på begge sider',
  parity_both_sides_not_reached: 'Forkastet — manglende flertall på begge sider',
  parity_missing_employer_majority: 'Forkastet — arbeidsgiversiden mangler flertall',
  parity_missing_employee_majority: 'Forkastet — arbeidstakersiden mangler flertall',
  parity_tie_no_leader_party:
    'Likhet — AMU-leder-rotasjon ikke registrert på møtet; sett leder-party for å bryte likheten',
  tie_broken_by_amu_leader_arbeidsgiver:
    'Vedtatt — likhet brutt av AMU-leders dobbeltstemme (arbeidsgiver)',
  tie_broken_by_amu_leader_arbeidstaker:
    'Vedtatt — likhet brutt av AMU-leders dobbeltstemme (arbeidstaker)',
  consensus_no_opposition: 'Vedtatt — konsensus (ingen imot)',
  consensus_opposition_present: 'Forkastet — opposisjon til stede',
  simple_majority_anon_passed: 'Vedtatt — flertall (anonymt)',
  simple_majority_anon_not_reached: 'Forkastet — ikke flertall (anonymt)',
  aksje_majority_and_third_floor_passed:
    'Vedtatt — flertall blant møtende + ≥ 1/3 av samtlige styremedlemmer',
  aksje_third_floor_not_met:
    'Forkastet — flertall blant møtende, men under 1/3-gulvet (§ 6-25)',
  aksje_majority_not_reached: 'Forkastet — ikke flertall blant møtende',
  aksje_tie_broken_by_chair:
    'Vedtatt — likhet brutt av møtelederens stemme (§ 6-25)',
  weighted_majority_passed: 'Vedtatt — vektet flertall',
  weighted_majority_not_reached: 'Forkastet — vektet flertall ikke nådd',
  unknown_model: 'Ukjent stemmegivnings-modell',
}

export function voteReasonLabel(reason: string | null | undefined): string {
  if (!reason) return ''
  return MEETING_VOTE_REASON_LABEL[reason] ?? reason
}

/** AMU leder-rotasjons-party — vises som badge i live-rommet når
 *  meeting.amu_leader_period_party er satt. Klikkbar i Deltakere-tab. */
export const MEETING_AMU_LEADER_PARTY_LABEL: Record<MeetingAmuLeaderParty, string> = {
  arbeidsgiver: 'Arbeidsgiversiden',
  arbeidstaker: 'Arbeidstakersiden',
}
