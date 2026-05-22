// LibraryTemplateTile — consistent card shell for template tiles across all
// module library pages (compliance, survey, meetings).
//
// Single-action tiles: pass onClick — the entire card becomes a <button>.
// Multi-action tiles (e.g. peek + create): omit onClick — a <div> shell is
// rendered and callers place their own <button> elements inside children.
//
// favoriteSlot is absolutely positioned at top-right.

import { useRef } from 'react'
import type { ReactNode } from 'react'

type Props = {
  /** FavoriteToggle or other overlay widget — absolutely positioned top-right. */
  favoriteSlot?: ReactNode
  /** Primary action. When provided the card shell renders as a <button>. */
  onClick?: () => void
  /** Accent hex colour for hover border — default brand green. */
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
  accentColor = '#1a3d32',
  children,
  className = '',
}: Props) {
  const ref = useRef<HTMLButtonElement & HTMLDivElement>(null)

  const hover = (on: boolean) => {
    if (!ref.current) return
    ref.current.style.borderColor = on ? `${accentColor}4d` : ''
  }

  const shared = {
    ref,
    className: `group ${SHELL} ${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`,
    onMouseEnter: () => hover(true),
    onMouseLeave: () => hover(false),
    onFocus: () => hover(true),
    onBlur: () => hover(false),
  }

  const inner = onClick ? (
    <button
      type="button"
      onClick={onClick}
      {...shared}
      style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
    >
      {children}
    </button>
  ) : (
    <div {...shared}>{children}</div>
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
