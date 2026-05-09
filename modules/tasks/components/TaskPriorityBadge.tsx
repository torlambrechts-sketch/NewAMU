// TaskPriorityBadge — priority chip used in list rows and detail panel.

import { Badge } from '../../../src/components/ui/Badge'
import type { BadgeVariant } from '../../../src/components/ui/Badge'
import type { TaskItemPriority } from '../../../src/types/task'

export const TASK_PRIORITY_LABEL: Record<TaskItemPriority, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
}

const PRIORITY_VARIANT: Record<TaskItemPriority, BadgeVariant> = {
  low: 'neutral',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
}

export function TaskPriorityBadge({ priority }: { priority: TaskItemPriority }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]}>
      {TASK_PRIORITY_LABEL[priority]}
    </Badge>
  )
}
