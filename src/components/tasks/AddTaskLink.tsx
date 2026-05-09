// AddTaskLink — Phase 0 stub.
// Previously navigated to the legacy task prefill URL. Now navigates to the
// new tasks hub. Consuming modules will be updated to use TaskForm directly
// in later phases.

import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { TaskModule, TaskSourceType } from '../../types/task'

type Props = {
  children: ReactNode
  title?: string
  description?: string
  module?: TaskModule
  sourceType?: TaskSourceType
  sourceId?: string
  sourceLabel?: string
  ownerRole?: string
  requiresManagementSignOff?: boolean
  className?: string
}

export function AddTaskLink({ children, className = '' }: Props) {
  return (
    <Link to="/tasks/management" className={className}>
      {children}
    </Link>
  )
}
