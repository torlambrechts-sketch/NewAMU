// TaskProjectCard — draggable card for kanban/PDCA board columns.
// HTML5 drag API — no extra dependency.
// Drag is initiated only from the handle (GripVertical) to avoid
// accidental drags when clicking links or text inside the card.

import { Calendar, GripVertical, User } from 'lucide-react'
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
      onClick={onClick}
      className="group relative cursor-pointer rounded-lg border border-neutral-200 bg-white p-3 pl-7 shadow-sm transition hover:border-[#c2410c]/30 hover:shadow-md select-none"
    >
      {/* Drag handle — draggable region only */}
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          onDragStart(item.id)
        }}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 top-0 flex h-full w-7 cursor-grab items-center justify-center rounded-l-lg text-neutral-300 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-50 hover:text-neutral-500 active:cursor-grabbing"
        aria-label="Dra oppgave"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

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
