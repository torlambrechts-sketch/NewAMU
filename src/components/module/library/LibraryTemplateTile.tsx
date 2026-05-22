// LibraryTemplateTile — consistent card shell for template tiles across all
// module library pages (compliance, survey, meetings).
//
// Single-action tiles: pass onClick — the entire card becomes a <button> with
// a focus-visible ring coloured by accentColor.
//
// Multi-action tiles (e.g. peek + create): omit onClick — a <div role="group">
// shell is rendered so screen readers announce the card as a group and the
// child buttons are individually reachable.
//
// favoriteSlot is absolutely positioned at top-right.

import { useRef } from 'react'
import type { ReactNode } from 'react'

type Props = {
  /** FavoriteToggle or other overlay widget — absolutely positioned top-right. */
  favoriteSlot?: ReactNode
  /** Primary action. When provided the card shell renders as a <button>. */
  onClick?: () => void
  /** Accessible label for the card shell. Required in multi-action (group) mode. */
  ariaLabel?: string
  /** Accent hex colour for hover border and focus ring — default brand green. */
  accentColor?: string
  children: ReactNode
  className?: string
}

const SHELL =
  'h-full w-full rounded-lg border border-neutral-200/80 bg-white p-4 ' +
  'text-left transition-colors hover:bg-neutral-50'

export function LibraryTemplateTile({
  favoriteSlot,
  onClick,
  ariaLabel,
  accentColor = '#1a3d32',
  children,
  className = '',
}: Props) {
  // HTMLElement covers both button and div; we only access .style on the ref.
  const ref = useRef<HTMLElement>(null)

  const hover = (on: boolean) => {
    if (!ref.current) return
    ref.current.style.borderColor = on ? `${accentColor}4d` : ''
  }

  const baseShared = {
    className: `group ${SHELL} ${className}`,
    onMouseEnter: () => hover(true),
    onMouseLeave: () => hover(false),
  }

  const inner = onClick ? (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      {...baseShared}
      className={`${baseShared.className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
      style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
      onFocus={() => hover(true)}
      onBlur={() => hover(false)}
    >
      {children}
    </button>
  ) : (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      {...baseShared}
      role="group"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  )

  return (
    <li className="relative">
      {favoriteSlot && (
        <div className="absolute right-1.5 top-1.5 z-10 bg-white/90">{favoriteSlot}</div>
      )}
      {inner}
    </li>
  )
}
