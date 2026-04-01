import type { TaskModule, TaskSourceType } from '../types/task'

export const MODULE_LABELS: Record<TaskModule, string> = {
  general: 'Generelt',
  council: 'Arbeidsmiljøråd',
  members: 'Representasjon',
  org_health: 'Organisasjonshelse',
  hse: 'HMS',
  hrm: 'Personal',
  learning: 'Læring',
}

export function buildTaskPrefillQuery(params: {
  title: string
  description?: string
  module: TaskModule
  sourceType: TaskSourceType
  sourceId?: string
  sourceLabel?: string
  ownerRole?: string
  requiresManagementSignOff?: boolean
}): string {
  const q = new URLSearchParams()
  q.set('title', params.title.slice(0, 200))
  if (params.description) q.set('desc', params.description.slice(0, 2000))
  q.set('module', params.module)
  q.set('source', params.sourceType)
  if (params.sourceId) q.set('sourceId', params.sourceId)
  if (params.sourceLabel) q.set('sourceLabel', params.sourceLabel.slice(0, 200))
  if (params.ownerRole) q.set('role', params.ownerRole.slice(0, 80))
  if (params.requiresManagementSignOff) q.set('mgmt', '1')
  return q.toString()
}
