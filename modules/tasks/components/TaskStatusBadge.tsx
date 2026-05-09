// TaskStatusBadge — maps 9-state CAPA lifecycle status to a coloured badge.
// Also exports TASK_STATUS_LABEL for display strings throughout the module.

import { Badge } from '../../../src/components/ui/Badge'
import type { BadgeVariant } from '../../../src/components/ui/Badge'
import type { TaskItemStatus } from '../../../src/types/task'

export const TASK_STATUS_LABEL: Record<TaskItemStatus, string> = {
  open: 'Åpen',
  in_progress: 'Under behandling',
  root_cause_identified: 'Rotårsak identifisert',
  action_defined: 'Tiltak definert',
  action_implemented: 'Tiltak implementert',
  effectiveness_pending: 'Venter på verifikasjon',
  effectiveness_verified: 'Verifisert effektiv',
  closed: 'Lukket',
  cancelled: 'Kansellert',
}

const STATUS_VARIANT: Record<TaskItemStatus, BadgeVariant> = {
  open: 'neutral',
  in_progress: 'active',
  root_cause_identified: 'info',
  action_defined: 'medium',
  action_implemented: 'high',
  effectiveness_pending: 'warning',
  effectiveness_verified: 'success',
  closed: 'signed',
  cancelled: 'draft',
}

export function TaskStatusBadge({ status }: { status: TaskItemStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {TASK_STATUS_LABEL[status]}
    </Badge>
  )
}
