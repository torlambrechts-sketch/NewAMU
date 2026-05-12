// Felles typer for Regelverk-dekning dashbordet.

import type { CoverageEntry } from '../../../hooks/useRegelverkCoverage'
import type { Requirement } from '../../../data/regelverkRequirements'

// Status etter compliance-officer-revisjon:
//  - covered:     ≥1 *innholds*-ressurs (kurs/dok/sjekkliste/survey/møte)
//                 tagget med eksakt lawRef
//  - only_avvik:  0 innhold, ≥1 task (avvik) tagget med eksakt lawRef.
//                 Verdt å rope opp — registrert brudd uten preventiv rutine.
//  - uncovered:   ingen innholds-ressurs og ingen avvik.
//
// ROS tagges på `law_domains` (bredt domene, eks: 'AML'), ikke per-§.
// Vi tar derfor ALDRI med ROS i per-krav-dekning — vises som domene-
// kontekst på toppen av siden.
export type CoverageStatus = 'covered' | 'only_avvik' | 'uncovered'

export type RequirementWithCoverage = Requirement & {
  coverage: CoverageEntry[]
  status: CoverageStatus
  byKind: Record<CoverageEntry['kind'], number>
}

// Innholds-akser: preventive kontroller. Disse teller som dekning.
export type ContentAxis = 'course' | 'document' | 'checklist' | 'survey' | 'meeting'
export const CONTENT_AXES: { id: ContentAxis; label: string; kinds: CoverageEntry['kind'][] }[] = [
  { id: 'course', label: 'Kurs', kinds: ['course_system', 'course_org'] },
  { id: 'document', label: 'Dokument', kinds: ['document'] },
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

export function obligationLabel(o: Requirement['obligation']): string {
  return o === 'mandatory' ? 'Pliktig' : o === 'recommended' ? 'Anbefalt' : 'Betinget'
}

