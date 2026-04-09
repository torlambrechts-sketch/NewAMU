import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { useOrgMenu1Styles } from '../../hooks/useOrgMenu1Styles'

export type HubMenu1Item = {
  key: string
  label: string
  icon: LucideIcon
  active: boolean
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

/**
 * Horizontal hub menu matching Organisasjon `menu_1`: dark green bar, light active tab, icons + labels.
 */
export function HubMenu1Bar({ ariaLabel, items }: Props) {
  const menu1 = useOrgMenu1Styles()

  return (
    <nav aria-label={ariaLabel} className="w-full">
      <div className={menu1.barOuterClass} style={menu1.barStyle}>
        <div className={menu1.innerRowClass}>
          {items.map((item) => {
            const Icon = item.icon
            const tb = menu1.tabButton(item.active)
            const badge =
              item.badgeCount != null && item.badgeCount > 0 ? (
                <span
                  className={`rounded-none px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                    item.active ? 'bg-neutral-200 text-neutral-700' : 'bg-white/20 text-white'
                  }`}
                >
                  {item.badgeCount}
                </span>
              ) : null

            const inner = (
              <>
                <Icon
                  className={`size-4 shrink-0 ${item.active ? 'text-neutral-800 opacity-100' : 'opacity-90'}`}
                  aria-hidden
                />
                <span className="whitespace-nowrap font-semibold">{item.label}</span>
                {badge}
              </>
            )

            if (item.to != null) {
              return (
                <NavLink
                  key={item.key}
                  to={item.to}
                  end={item.end}
                  replace={item.replace}
                  className={tb.className}
                  style={tb.style}
                >
                  {inner}
                </NavLink>
              )
            }

            return (
              <button key={item.key} type="button" onClick={item.onClick} className={tb.className} style={tb.style}>
                {inner}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
