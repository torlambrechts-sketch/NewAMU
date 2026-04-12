import { CheckCircle2, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { WORKPLACE_LAYOUT_BOX_CARD, WORKPLACE_LAYOUT_BOX_SHADOW } from './workplaceLayoutKit'

export type WorkplaceTodoItem = {
  id: string
  title: string
  description?: string
  /** Short due label, e.g. «I dag», «3 d», «29. apr.» */
  dueLabel?: string
  href?: string
  onClick?: () => void
  done?: boolean
}

export type WorkplaceTodosCardProps = {
  title?: string
  items: WorkplaceTodoItem[]
  /** Primary CTA — e.g. `AddTaskLink` or link to `/tasks?quickNew=task` */
  addTaskSlot?: ReactNode
  emptyHint?: string
  className?: string
}

/**
 * To-do list card (boxed rows, due on the right) — workplace «boks» shell.
 * Map `Task` rows: title, description, dueLabel from `dueDate`, `href` to task detail.
 */
export function WorkplaceTodosCard({
  title = 'Oppgaver',
  items,
  addTaskSlot,
  emptyHint = 'Ingen oppgaver. Opprett en ny oppgave eller koble til Samsvar.',
  className = '',
}: WorkplaceTodosCardProps) {
  return (
    <div className={`${WORKPLACE_LAYOUT_BOX_CARD} ${className}`} style={WORKPLACE_LAYOUT_BOX_SHADOW}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1a3d32]/10 text-[#1a3d32]">
            <CheckCircle2 className="size-4" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-neutral-900">{title}</p>
        </div>
        {addTaskSlot ?? (
          <Link
            to="/tasks?quickNew=task"
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1a3d32] shadow-sm hover:bg-neutral-50"
          >
            <Plus className="size-3.5" aria-hidden />
            Ny oppgave
          </Link>
        )}
      </div>

      <div className="max-h-[min(420px,55vh)] space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-neutral-500">{emptyHint}</p>
        ) : (
          items.map((it) => {
            const inner = (
              <div
                className={`flex gap-3 rounded-lg border border-neutral-200/90 bg-white px-3 py-3 shadow-sm transition ${
                  it.href || it.onClick ? 'cursor-pointer hover:border-neutral-300 hover:bg-neutral-50/80' : ''
                } ${it.done ? 'opacity-75' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold text-neutral-900 ${it.done ? 'line-through' : ''}`}>{it.title}</p>
                  {it.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">{it.description}</p>
                  ) : null}
                </div>
                {it.dueLabel ? (
                  <div className="shrink-0 pt-0.5 text-right">
                    <p className="text-xs tabular-nums text-neutral-400">{it.dueLabel}</p>
                  </div>
                ) : null}
              </div>
            )

            if (it.href) {
              return (
                <Link key={it.id} to={it.href} className="block" onClick={it.onClick}>
                  {inner}
                </Link>
              )
            }
            if (it.onClick) {
              return (
                <button key={it.id} type="button" className="block w-full text-left" onClick={it.onClick}>
                  {inner}
                </button>
              )
            }
            return <div key={it.id}>{inner}</div>
          })
        )}
      </div>
    </div>
  )
}
