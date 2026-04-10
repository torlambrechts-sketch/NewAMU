import type { ComponentType } from 'react'
import { WORKPLACE_FOREST } from './WorkplaceChrome'

export type WorkplaceBoardTabItem = {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  badgeCount?: number
}

/**
 * Same tab styling as Action Board (Tavle / Kostnader): forest active state, light inactive.
 */
export function WorkplaceBoardTabStrip({
  items,
  activeId,
  onSelect,
  ariaLabel = 'Seksjoner',
}: {
  items: WorkplaceBoardTabItem[]
  activeId: string
  onSelect: (id: string) => void
  ariaLabel?: string
}) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap gap-2 border-b border-neutral-200/80 pb-4">
      {items.map(({ id, label, icon: Icon, badgeCount }) => {
        const active = activeId === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              active
                ? 'border-[#142e26] text-white shadow-sm'
                : 'border-transparent text-neutral-600 hover:bg-white/70 hover:text-neutral-900'
            }`}
            style={active ? { backgroundColor: WORKPLACE_FOREST } : undefined}
          >
            <Icon className={`size-4 shrink-0 ${active ? 'text-white' : 'text-neutral-500'}`} />
            <span className="whitespace-nowrap">{label}</span>
            {badgeCount != null ? (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                  active ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {badgeCount}
              </span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
