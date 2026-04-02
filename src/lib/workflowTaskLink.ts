import { buildTaskPrefillQuery } from './taskNavigation'
import type { TaskModule } from '../types/task'
import type { WorkflowDefinition, WorkflowStep, WorkflowStepLinkType } from '../types/workflow'

export function taskModuleForWorkflowLink(linkType: WorkflowStepLinkType): TaskModule {
  switch (linkType) {
    case 'org_health':
      return 'org_health'
    case 'internal_control':
    case 'hse':
      return 'hse'
    case 'council':
    case 'members':
      return 'council'
    default:
      return 'general'
  }
}

export function buildWorkflowStepTaskQuery(workflow: WorkflowDefinition, step: WorkflowStep) {
  const desc = [
    `Prosess: ${workflow.title}`,
    step.description,
    step.linkPath ? `Lenke i app: ${step.linkPath}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

  return buildTaskPrefillQuery({
    title: `${step.title} — ${workflow.title}`.slice(0, 200),
    description: desc.slice(0, 2000),
    module: taskModuleForWorkflowLink(step.linkType),
    sourceType: 'workflow_step',
    sourceId: `${workflow.id}:${step.id}`,
    sourceLabel: workflow.title.slice(0, 200),
    ownerRole: step.roleHint,
  })
}
