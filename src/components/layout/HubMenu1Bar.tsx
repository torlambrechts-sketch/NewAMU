import { NavLink, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { WORKPLACE_FOREST } from './WorkplaceChrome'

/**
 * NavLink's isActive only compares pathname by default, so every
 * `/internal-control?tab=x` link matches the same pathname and all look active.
 * When `to` includes a query string, require pathname + those search params to match.
 */
function hubNavLinkActive(
  to: string,
  loc: { pathname: string; search: string },
  navLinkIsActive: boolean,
): boolean {
  const q = to.indexOf('?')
  if (q < 0) return navLinkIsActive
  const pathPart = to.slice(0, q)
  if (loc.pathname !== pathPart) return false
  const want = new URLSearchParams(to.slice(q + 1))
  const have = new URLSearchParams(loc.search.startsWith('?') ? loc.search.slice(1) : loc.search)
  for (const key of want.keys()) {
    if (want.get(key) !== have.get(key)) return false
  }
  return true
}

export type HubMenu1Item = {
  key: string
  label: string
  icon: LucideIcon
  active: boolean
  /** Icon-only control (label becomes screen-reader + title). */
  iconOnly?: boolean
  /** Small red alert dot (e.g. overdue annual review). */
  badgeDot?: boolean
  /** Optional count badge (same styling as Organisasjon → Ansatte). */
  badgeCount?: number
  /** `danger` — red badge for critical counts (e.g. SJA stopp-regel). */
  badgeVariant?: 'default' | 'danger'
  /** Use NavLink when `to` is set; otherwise a button with `onClick`. */
  to?: string
  end?: boolean
  replace?: boolean
  onClick?: () => void
  /** When true, tab is non-interactive (e.g. gated step). */
  disabled?: boolean
  /**
   * When set, overrides NavLink `isActive` for styling (e.g. «Dokumenter» should stay active on
   * `/documents/page/...` even though those paths are not the same as `/documents`).
   */
  navActiveOverride?: boolean
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
  const location = useLocation()

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
                className={({ isActive }) => {
                  const on =
                    item.navActiveOverride !== undefined
                      ? item.navActiveOverride
                      : hubNavLinkActive(item.to!, location, isActive)
                  return `${tabClass} ${on ? TAB_ACTIVE : TAB_INACTIVE}`
                }}
                style={({ isActive }) => {
                  const on =
                    item.navActiveOverride !== undefined
                      ? item.navActiveOverride
                      : hubNavLinkActive(item.to!, location, isActive)
                  return on ? { backgroundColor: WORKPLACE_FOREST } : undefined
                }}
              >
                {({ isActive }) => {
                  const on =
                    item.navActiveOverride !== undefined
                      ? item.navActiveOverride
                      : hubNavLinkActive(item.to!, location, isActive)
                  return (
                    <>
                      <Icon className={`size-4 shrink-0 ${on ? 'text-white' : 'text-neutral-500'}`} aria-hidden={compact} />
                      {compact ? <span className="sr-only">{item.label}</span> : <span className="whitespace-nowrap">{item.label}</span>}
                      {!compact && item.badgeCount != null && item.badgeCount >= 0 ? (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                            item.badgeVariant === 'danger'
                              ? on
                                ? 'bg-red-600 text-white'
                                : 'bg-red-100 text-red-800'
                              : on
                                ? 'bg-white/20 text-white'
                                : 'bg-neutral-200 text-neutral-700'
                          }`}
                        >
                          {item.badgeCount}
                        </span>
                      ) : null}
                      {!compact && item.badgeDot ? (
                        <span className="size-2 shrink-0 rounded-full bg-red-500" title="Krever oppmerksomhet" aria-hidden />
                      ) : null}
                    </>
                  )
                }}
              </NavLink>
            )
          }

          const on = item.active
          const badge =
            !compact && item.badgeCount != null && item.badgeCount >= 0 ? (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                  item.badgeVariant === 'danger'
                    ? on
                      ? 'bg-red-600 text-white'
                      : 'bg-red-100 text-red-800'
                    : on
                      ? 'bg-white/20 text-white'
                      : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {item.badgeCount}
              </span>
            ) : null
          const dot =
            !compact && item.badgeDot ? (
              <span className="size-2 shrink-0 rounded-full bg-red-500" title="Krever oppmerksomhet" aria-hidden />
            ) : null

          return (
            <button
              key={item.key}
              type="button"
              disabled={item.disabled === true}
              onClick={item.disabled === true ? undefined : item.onClick}
              title={compact ? item.label : undefined}
              aria-label={compact ? item.label : undefined}
              className={`${tabClass} ${on ? TAB_ACTIVE : TAB_INACTIVE} ${
                item.disabled === true ? 'cursor-not-allowed opacity-45' : ''
              }`}
              style={on ? { backgroundColor: WORKPLACE_FOREST } : undefined}
            >
              <Icon className={`size-4 shrink-0 ${on ? 'text-white' : 'text-neutral-500'}`} aria-hidden={compact} />
              {compact ? <span className="sr-only">{item.label}</span> : <span className="whitespace-nowrap">{item.label}</span>}
              {badge}
              {dot}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
