import { ListTodo, Plus } from 'lucide-react'
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
  /** Uppercase header label (same as agenda list title row) */
  title?: string
  /** Badge count — default: number of items */
  badge?: string | number
  items: WorkplaceTodoItem[]
  /** Primary CTA — e.g. `AddTaskLink` or link to `/tasks?quickNew=task` */
  addTaskSlot?: ReactNode
  emptyHint?: string
  className?: string
}

/**
 * To-do list — samme mønster som {@link WorkplaceEditableNoticeList}: uppercase tittel + badge,
 * verktøyrad (Ny oppgave), divide-y-rader med ikon-sirkel, tittel + undertekst.
 */
export function WorkplaceTodosCard({
  title = 'Oppgaver',
  badge: badgeProp,
  items,
  addTaskSlot,
  emptyHint = 'Ingen oppgaver. Opprett en ny oppgave eller koble til Samsvar.',
  className = '',
}: WorkplaceTodosCardProps) {
  const badge = badgeProp ?? items.length

  return (
    <div className={`${WORKPLACE_LAYOUT_BOX_CARD} ${className}`} style={WORKPLACE_LAYOUT_BOX_SHADOW}>
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{title}</p>
        {badge != null && badge !== '' ? (
          <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-800">{badge}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-neutral-100 bg-neutral-50/60 px-4 py-2.5">
        {addTaskSlot ?? (
          <Link
            to="/tasks?quickNew=task"
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50"
          >
            <Plus className="size-3.5" aria-hidden />
            Ny oppgave
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-neutral-500">{emptyHint}</p>
      ) : (
        <ul className="max-h-[min(420px,55vh)] divide-y divide-neutral-100 overflow-y-auto">
          {items.map((it) => {
            const row = (
              <div className={`flex gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 ${it.done ? 'opacity-75' : ''}`}>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                  <ListTodo className="size-4 shrink-0" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm text-neutral-800 ${it.done ? 'line-through' : ''}`}>{it.title}</p>
                  {it.description ? <p className="mt-1 text-xs text-neutral-400">{it.description}</p> : null}
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
                <li key={it.id}>
                  <Link to={it.href} className="block transition hover:bg-neutral-50/80" onClick={it.onClick}>
                    {row}
                  </Link>
                </li>
              )
            }
            if (it.onClick) {
              return (
                <li key={it.id}>
                  <button type="button" className="block w-full text-left transition hover:bg-neutral-50/80" onClick={it.onClick}>
                    {row}
                  </button>
                </li>
              )
            }
            return <li key={it.id}>{row}</li>
          })}
        </ul>
      )}
    </div>
  )
}
