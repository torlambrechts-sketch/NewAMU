// Map a TaskSourceType (the source enum tasks uses in lieu of a category
// table) to a regulation id. Pure lookup — used by the
// RegulationFilterContext fan-out (category-architecture §T3 + §T8) so a
// regulation toggle in the top bar narrows the tasks inbox the same way
// it narrows the four other modules.
//
// When a source has no clean single-regulation home (`manual`,
// `task_cosign_request`, …), the resolver returns null. The filter
// treats null sources as "no regulation membership" — narrowing by any
// regulation excludes them.

import type { TaskSourceType, TaskModule } from '../../types/task'
import { REGULATION_IDS, type RegulationId } from '../../types/regulations'

export function regulationForSource(source: TaskSourceType): RegulationId | null {
  switch (source) {
    case 'manual':
    case 'task_cosign_request':
      return null
    case 'council_meeting':
    case 'council_compliance':
    case 'representatives':
      return REGULATION_IDS.aml
    case 'survey':
      // Surveys span vendor (Åpenhetsloven), arbeidsmiljo (AML),
      // compliance (IK-f), engagement, exit — without the source survey's
      // pack we can't disambiguate. Leave null; the regulation filter
      // narrows via the survey scope, not the task inbox, when surveys
      // are the operative concern.
      return null
    case 'hse_safety_round':
    case 'hse_inspection':
    case 'hse_inspection_finding':
    case 'hse_incident':
    case 'hse_sja':
    case 'hse_sick_leave_milestone':
      return REGULATION_IDS.aml
    case 'nav_report':
      return REGULATION_IDS.aml
    case 'labor_metric':
      return REGULATION_IDS.aml
    case 'learning_course':
      return REGULATION_IDS.aml
    case 'ros_measure':
      return REGULATION_IDS.ikF
    case 'annual_review_action':
      return REGULATION_IDS.ikF
  }
}

/** Fallback for the `module` field — coarser than the source enum but
 *  covers tasks that arrived without a typed source. */
export function regulationForTaskModule(mod: TaskModule): RegulationId | null {
  switch (mod) {
    case 'general':
      return null
    case 'council':
    case 'org_health':
    case 'hse':
      return REGULATION_IDS.aml
    case 'members':
      return null
    case 'hrm':
      return REGULATION_IDS.likestilling
    case 'learning':
      return REGULATION_IDS.aml
  }
}
