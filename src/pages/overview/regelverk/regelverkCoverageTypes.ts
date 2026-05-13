// Felles typer for Regelverk-dekning dashbordet.

import type { CoverageEntry } from '../../../hooks/useRegelverkCoverage'
import type { Requirement } from '../../../data/regelverkRequirements'

// Status etter compliance-officer-revisjon (v2 — krever reell proof):
//  - covered:     ≥1 publisert INSTANCE-ressurs (kurs eller dokument) som er
//                 fersk nok (oppdatert siste 12 mnd). En tilgjengelig mal er
//                 IKKE bevis — Arbeidstilsynet aksepterer ikke "vi har en
//                 mal" som dokumentasjon på at kravet er etterlevd.
//  - partial:     Det finnes mal/innhold tilknyttet kravet, men ingen fersk
//                 publisert instans. Typisk: system-mal seedet via baseline
//                 men aldri aktivert som faktisk rutine i orgen, eller en
//                 publisert side som ikke er gjennomgått innen perioden.
//  - only_avvik:  0 innhold, ≥1 task (avvik) tagget med eksakt lawRef.
//                 Verdt å rope opp — registrert brudd uten preventiv rutine.
//  - uncovered:   ingen innholds-ressurs og ingen avvik.
//
// ROS tagges på `law_domains` (bredt domene, eks: 'AML'), ikke per-§.
// Vi tar derfor ALDRI med ROS i per-krav-dekning — vises som domene-
// kontekst på toppen av siden.
export type CoverageStatus = 'covered' | 'partial' | 'only_avvik' | 'uncovered'

/** Krav om at proof er nyere enn dette for å telle som «dekket». 12 mnd
 *  speiler årshjul i IK-f § 5 nr. 8 (årlig gjennomgang) og dekker også
 *  raskere kadenser (kvartalsvis møte → forrige løp er alltid <12 mnd). */
export const COVERAGE_FRESHNESS_MONTHS = 12

export type RequirementWithCoverage = Requirement & {
  coverage: CoverageEntry[]
  status: CoverageStatus
  byKind: Record<CoverageEntry['kind'], number>
  /** Counts of resources that meet the «reell proof» bar (fresh, published
   *  instances) vs the broader pool. Surfaced in drill-down + KPIs so the
   *  user can see *why* a krav was downgraded from covered → partial. */
  proof: {
    freshInstances: number
    staleInstances: number
    templatesOnly: number
  }
}

// Innholds-akser: preventive kontroller. Disse teller som dekning.
// Vi inkluderer både system-templates og org-instanser i samme akse —
// dashbordet bruker source-feltet for å skille hvor det trengs.
export type ContentAxis = 'course' | 'document' | 'checklist' | 'survey' | 'meeting'
export const CONTENT_AXES: { id: ContentAxis; label: string; kinds: CoverageEntry['kind'][] }[] = [
  { id: 'course', label: 'Kurs', kinds: ['course_system', 'course_org'] },
  { id: 'document', label: 'Dokument', kinds: ['document', 'document_template'] },
  { id: 'checklist', label: 'Sjekkliste', kinds: ['checklist_template', 'checklist_item'] },
  { id: 'survey', label: 'Undersøkelse', kinds: ['survey'] },
  { id: 'meeting', label: 'Møte', kinds: ['meeting_template'] },
]

// Operasjonelle akser: vises i drill-down som signal, men teller ikke som dekning.
export type OperationalAxis = 'task'
export const OPERATIONAL_AXES: {
  id: OperationalAxis
  label: string
  kinds: CoverageEntry['kind'][]
}[] = [{ id: 'task', label: 'Avvik', kinds: ['task'] }]

export const KIND_LABEL: Record<CoverageEntry['kind'], string> = {
  course_system: 'Kurs',
  course_org: 'Kurs (org)',
  document: 'Dokument',
  document_template: 'Dokument-mal',
  survey: 'Undersøkelse',
  checklist_template: 'Sjekkliste',
  checklist_item: 'Sjekkliste-item',
  ros: 'ROS',
  task: 'Avvik',
  meeting_template: 'Møte',
}

const CONTENT_KINDS = new Set<CoverageEntry['kind']>(CONTENT_AXES.flatMap((a) => a.kinds))
const OPERATIONAL_KINDS = new Set<CoverageEntry['kind']>(OPERATIONAL_AXES.flatMap((a) => a.kinds))

export function isContentKind(kind: CoverageEntry['kind']): boolean {
  return CONTENT_KINDS.has(kind)
}

export function isOperationalKind(kind: CoverageEntry['kind']): boolean {
  return OPERATIONAL_KINDS.has(kind)
}

/** Real proof = published instance updated within the freshness window.
 *  Templates (system + per-org-bibliotek) never qualify — de er tilgjengelig
 *  innhold, ikke gjennomført rutine. Draft/archive-instanser teller heller
 *  ikke som etterlevelse. */
export function isFreshProof(
  e: CoverageEntry,
  now: Date = new Date(),
  windowMonths: number = COVERAGE_FRESHNESS_MONTHS,
): boolean {
  if (e.source !== 'instance') return false
  if (!isContentKind(e.kind)) return false
  if (e.status && e.status !== 'published' && e.status !== 'active') return false
  if (!e.lastSeenAt) return false
  const ts = Date.parse(e.lastSeenAt)
  if (!Number.isFinite(ts)) return false
  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - windowMonths)
  return ts >= cutoff.getTime()
}

/** Stale = instance, but failed freshness or status check. Templates are
 *  filed under "templatesOnly", not stale. */
export function isStaleInstance(
  e: CoverageEntry,
  now: Date = new Date(),
  windowMonths: number = COVERAGE_FRESHNESS_MONTHS,
): boolean {
  if (e.source !== 'instance') return false
  if (!isContentKind(e.kind)) return false
  return !isFreshProof(e, now, windowMonths)
}

export function obligationLabel(o: Requirement['obligation']): string {
  return o === 'mandatory' ? 'Pliktig' : o === 'recommended' ? 'Anbefalt' : 'Betinget'
}

