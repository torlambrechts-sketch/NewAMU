// TaskProjectCard — draggable card for kanban/PDCA board columns.
// HTML5 drag API — no extra dependency.

import { Calendar, User } from 'lucide-react'
import { TaskPriorityBadge } from './TaskPriorityBadge'
import { TaskStatusBadge } from './TaskStatusBadge'
import type { TaskItemRow } from '../useTaskItemsData'

type Props = {
  item: TaskItemRow
  onClick: () => void
  onDragStart: (id: string) => void
}

function fmtDate(s: string | null) {
  if (!s) return null
  try {
    return new Date(s).toLocaleDateString('nb-NO', { dateStyle: 'short' })
  } catch {
    return s
  }
}

function isOverdue(dueDate: string | null, status: string) {
  if (!dueDate || status === 'closed' || status === 'cancelled') return false
  return new Date(dueDate) < new Date()
}

export function TaskProjectCard({ item, onClick, onDragStart }: Props) {
  const overdue = isOverdue(item.dueDate, item.status)
  const personName = item.ownerName ?? item.assigneeName

  return (
    <div
      draggable
      onDragStart={() => onDragStart(item.id)}
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-[#c2410c]/30 hover:shadow-md active:opacity-60 select-none"
    >
      <p className="text-sm font-medium leading-snug text-neutral-900">{item.title}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TaskStatusBadge status={item.status} />
        <TaskPriorityBadge priority={item.priority} />
      </div>

      {(item.dueDate || personName) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          {item.dueDate && (
            <span
              className={`flex items-center gap-1 text-[11px] ${
                overdue ? 'font-semibold text-red-600' : 'text-neutral-500'
              }`}
            >
              <Calendar className="h-3 w-3" />
              {fmtDate(item.dueDate)}
              {overdue && ' — forfalt'}
            </span>
          )}
          {personName && (
            <span className="flex items-center gap-1 text-[11px] text-neutral-500">
              <User className="h-3 w-3" />
              {personName}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
