import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { WORKPLACE_FOREST } from './WorkplaceChrome'

export type HubMenu1Item = {
  key: string
  label: string
  icon: LucideIcon
  active: boolean
  /** Icon-only control (label becomes screen-reader + title). */
  iconOnly?: boolean
  /** Optional count badge (same styling as Organisasjon → Ansatte). */
  badgeCount?: number
  /** Use NavLink when `to` is set; otherwise a button with `onClick`. */
  to?: string
  end?: boolean
  replace?: boolean
  onClick?: () => void
}

type Props = {
  ariaLabel: string
  items: HubMenu1Item[]
}

const TAB_BASE =
  'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a3d32]/30'
const TAB_ICON_ONLY =
  '!h-9 !w-9 !min-h-0 !min-w-0 !max-h-9 !max-w-9 !shrink-0 !justify-center !gap-0 !p-0 !px-0'
const TAB_ACTIVE = 'border-[#142e26] text-white shadow-sm'
const TAB_INACTIVE = 'border-transparent text-neutral-600 hover:bg-white/70 hover:text-neutral-900'

/**
 * Horizontal hub menu — same interaction pattern as Action Board tabs (forest active, light inactive).
 * Works with NavLink (`to`) or buttons (`onClick`).
 */
export function HubMenu1Bar({ ariaLabel, items }: Props) {
  return (
    <nav aria-label={ariaLabel} className="w-full">
      <div className="flex flex-wrap gap-2 border-b border-neutral-200/80 pb-4">
        {items.map((item) => {
          const Icon = item.icon
          const compact = item.iconOnly === true
          const tabClass = `${TAB_BASE} ${compact ? TAB_ICON_ONLY : ''}`

          if (item.to != null) {
            return (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.end}
                replace={item.replace}
                title={compact ? item.label : undefined}
                aria-label={compact ? item.label : undefined}
                className={({ isActive }) => `${tabClass} ${isActive ? TAB_ACTIVE : TAB_INACTIVE}`}
                style={({ isActive }) => (isActive ? { backgroundColor: WORKPLACE_FOREST } : undefined)}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`size-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-500'}`} aria-hidden={compact} />
                    {compact ? <span className="sr-only">{item.label}</span> : <span className="whitespace-nowrap">{item.label}</span>}
                    {!compact && item.badgeCount != null && item.badgeCount > 0 ? (
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                          isActive ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                        }`}
                      >
                        {item.badgeCount}
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            )
          }

          const on = item.active
          const badge =
            !compact && item.badgeCount != null && item.badgeCount > 0 ? (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                  on ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {item.badgeCount}
              </span>
            ) : null

          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              title={compact ? item.label : undefined}
              aria-label={compact ? item.label : undefined}
              className={`${tabClass} ${on ? TAB_ACTIVE : TAB_INACTIVE}`}
              style={on ? { backgroundColor: WORKPLACE_FOREST } : undefined}
            >
              <Icon className={`size-4 shrink-0 ${on ? 'text-white' : 'text-neutral-500'}`} aria-hidden={compact} />
              {compact ? <span className="sr-only">{item.label}</span> : <span className="whitespace-nowrap">{item.label}</span>}
              {badge}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
