import type { ElementType, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

export interface TabItem {
  id: string
  label: ReactNode
  icon?: ElementType
  badgeCount?: number
  /** When true, tab is non-interactive. */
  disabled?: boolean
  /** `danger` — e.g. critical count badge on inactive tab. */
  badgeVariant?: 'default' | 'danger'
}

interface TabsProps {
  items: TabItem[]
  activeId: string
  onChange: (id: string) => void
  className?: string
  /**
   * How the tab row handles horizontal overflow.
   *
   * - `wrap` (default, back-compat): tabs wrap onto multiple lines once they
   *   run out of horizontal space. Good for detail-page tab rows (≤ 5 tabs).
   * - `scroll`: tabs stay on one line and the row scrolls horizontally.
   *   Good for admin pages with many tabs on narrow screens — replaces the
   *   legacy `ModuleAdminShell` mobile pill-strip.
   */
  overflow?: 'wrap' | 'scroll'
}

export function Tabs({ items, activeId, onChange, className, overflow = 'wrap' }: TabsProps) {
  const overflowClass =
    overflow === 'scroll'
      ? 'flex flex-nowrap items-center gap-1 overflow-x-auto'
      : 'flex flex-wrap items-center gap-1'

  return (
    <nav className={twMerge(overflowClass, className)} aria-label="Tabs">
      {items.map((tab) => {
        const isActive = activeId === tab.id
        const Icon = tab.icon

        const dangerBadge = tab.badgeVariant === 'danger'

        return (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            onClick={() => {
              if (tab.disabled) return
              onChange(tab.id)
            }}
            aria-current={isActive ? 'page' : undefined}
            className={twMerge(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              overflow === 'scroll' ? 'shrink-0 whitespace-nowrap' : '',
              tab.disabled
                ? 'cursor-not-allowed text-neutral-400 opacity-60'
                : isActive
                  ? 'bg-[#1a3d32] text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
            <span>{tab.label}</span>
            {tab.badgeCount !== undefined && tab.badgeCount > 0 ? (
              <span
                className={twMerge(
                  'ml-1.5 rounded-full px-2 py-0.5 text-xs',
                  isActive
                    ? 'bg-white/20 text-white'
                    : dangerBadge
                      ? 'bg-red-100 text-red-800'
                      : 'bg-neutral-200 text-neutral-700',
                )}
              >
                {tab.badgeCount}
              </span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
