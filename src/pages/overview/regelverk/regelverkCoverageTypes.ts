// Felles typer for Regelverk-dekning dashbordet.

import type { CoverageEntry } from '../../../hooks/useRegelverkCoverage'
import type { Requirement } from '../../../data/regelverkRequirements'

export type CoverageStatus = 'covered' | 'partial' | 'uncovered'

export type RequirementWithCoverage = Requirement & {
  coverage: CoverageEntry[]
  status: CoverageStatus
  byKind: Record<CoverageEntry['kind'], number>
}

export const MODULE_KINDS: CoverageEntry['kind'][] = [
  'course_system',
  'course_org',
  'document',
  'survey',
  'checklist_template',
  'checklist_item',
  'ros',
  'task',
  'meeting_template',
]

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

// Aggregerte modul-akser for kompakte chips i tabellen.
// Vi slår sammen course_system + course_org → "kurs", og
// checklist_template + checklist_item → "sjekkliste".
export type ModuleAxis = 'course' | 'document' | 'survey' | 'checklist' | 'ros' | 'task' | 'meeting'

export const MODULE_AXES: { id: ModuleAxis; label: string; kinds: CoverageEntry['kind'][] }[] = [
  { id: 'course', label: 'Kurs', kinds: ['course_system', 'course_org'] },
  { id: 'document', label: 'Dokument', kinds: ['document'] },
  { id: 'checklist', label: 'Sjekkliste', kinds: ['checklist_template', 'checklist_item'] },
  { id: 'survey', label: 'Undersøkelse', kinds: ['survey'] },
  { id: 'ros', label: 'ROS', kinds: ['ros'] },
  { id: 'task', label: 'Avvik', kinds: ['task'] },
  { id: 'meeting', label: 'Møte', kinds: ['meeting_template'] },
]

export function obligationLabel(o: Requirement['obligation']): string {
  return o === 'mandatory' ? 'Pliktig' : o === 'recommended' ? 'Anbefalt' : 'Betinget'
}
