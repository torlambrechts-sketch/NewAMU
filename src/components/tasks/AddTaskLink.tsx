import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { buildTaskPrefillQuery } from '../../lib/taskNavigation'
import type { TaskModule, TaskSourceType } from '../../types/task'

type Props = {
  title: string
  description?: string
  module: TaskModule
  sourceType: TaskSourceType
  sourceId?: string
  sourceLabel?: string
  ownerRole?: string
  requiresManagementSignOff?: boolean
  className?: string
  children?: React.ReactNode
}

export function AddTaskLink({
  title,
  description,
  module,
  sourceType,
  sourceId,
  sourceLabel,
  ownerRole,
  requiresManagementSignOff,
  className = 'inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-[#1a3d32] shadow-sm hover:bg-neutral-50',
  children,
}: Props) {
  const qs = buildTaskPrefillQuery({
    title,
    description,
    module,
    sourceType,
    sourceId,
    sourceLabel,
    ownerRole,
    requiresManagementSignOff,
  })
  return (
    <Link to={`/tasks?${qs}`} className={className}>
      <Plus className="size-3.5" />
      {children ?? 'Oppfølgingsoppgave'}
    </Link>
  )
}
