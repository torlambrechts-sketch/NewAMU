// CategoryReorderList — reusable drag/touch reorder for the per-module
// category admin lists (compliance, survey, learning). Mirrors the
// pattern from DashboardEditLayoutPanel + the 4.5 mobile pass: native
// HTML5 drag-and-drop with a grip handle on `sm+`, plus up/down arrow
// buttons on `<sm` for touch devices where HTML5 DnD doesn't fire.
//
// Generic over the row shape — the only requirements are `id` and
// `position`. The parent renders the row body via `renderItem`; this
// component supplies the chrome (handle + arrows) and the reorder
// callback.
//
// On reorder, fires `onReorder(orderedIds)` with the full new id order.
// Parents typically translate that into a sequence of
// `updateCategory({ id, position: (idx + 1) * 10 })` calls.

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'

export type CategoryReorderItem = { id: string; position: number }

export function CategoryReorderList<T extends CategoryReorderItem>({
  items,
  renderItem,
  onReorder,
  emptyState,
}: {
  /** Already-sorted items. The component never re-sorts; it relies on the parent's view. */
  items: T[]
  renderItem: (item: T) => ReactNode
  /** Called with the new id order when a drag-and-drop or arrow-tap reorders the list. */
  onReorder: (orderedIds: string[]) => Promise<void> | void
  emptyState?: ReactNode
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  if (items.length === 0) {
    return <>{emptyState ?? null}</>
  }

  const reorder = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return
    const next = items.slice()
    const [picked] = next.splice(from, 1)
    if (!picked) return
    next.splice(to, 0, picked)
    void onReorder(next.map((i) => i.id))
  }

  return (
    <ul className="space-y-3">
      {items.map((item, idx) => {
        const isOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx
        const isDragging = dragIdx === idx
        return (
          <li
            key={item.id}
            draggable
            onDragStart={(e) => {
              setDragIdx(idx)
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', item.id)
            }}
            onDragOver={(e) => {
              if (dragIdx === null) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (dragOverIdx !== idx) setDragOverIdx(idx)
            }}
            onDragLeave={() => {
              if (dragOverIdx === idx) setDragOverIdx(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragIdx !== null) reorder(dragIdx, idx)
              setDragIdx(null)
              setDragOverIdx(null)
            }}
            onDragEnd={() => {
              setDragIdx(null)
              setDragOverIdx(null)
            }}
            className={
              'flex items-stretch gap-2 rounded-lg border bg-neutral-50/50 transition-colors ' +
              (isOver
                ? 'border-[#1a3d32] ring-2 ring-[#1a3d32]/20'
                : isDragging
                  ? 'border-neutral-300 opacity-60'
                  : 'border-neutral-200/80')
            }
          >
            <span
              aria-hidden
              className="hidden shrink-0 cursor-grab items-center px-2 text-neutral-400 hover:text-neutral-700 active:cursor-grabbing sm:flex"
              title="Dra for å endre rekkefølge"
            >
              <GripVertical className="h-5 w-5" />
            </span>
            <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 px-1 sm:hidden">
              <button
                type="button"
                onClick={() => reorder(idx, idx - 1)}
                disabled={idx === 0}
                aria-label="Flytt opp"
                className="rounded-sm p-1 text-neutral-400 hover:bg-white hover:text-neutral-700 disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => reorder(idx, idx + 1)}
                disabled={idx === items.length - 1}
                aria-label="Flytt ned"
                className="rounded-sm p-1 text-neutral-400 hover:bg-white hover:text-neutral-700 disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="min-w-0 flex-1 p-4 pl-0">{renderItem(item)}</div>
          </li>
        )
      })}
    </ul>
  )
}
