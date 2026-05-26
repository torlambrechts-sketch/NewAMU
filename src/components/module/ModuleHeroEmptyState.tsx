// Shared first-run empty state for ModuleAlleListPage and module landings.
// Renders when an org's data source has zero rows (distinct from "filters
// narrowed to zero", which keeps the existing inline "no matches" copy).
// One CTA per hero — anything more is an information-architecture failure.

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

export interface ModuleHeroEmptyStateProps {
  /** Lucide icon component rendered inside the circular badge. */
  icon: LucideIcon
  /** Norwegian headline — sentence case, no trailing period. */
  title: string
  /** One sentence of context. Keep it short; users skim. */
  body: string
  /** Primary call-to-action. Becomes a router Link (internal) or anchor. */
  primary: { label: string; to: string }
  /** Optional secondary affordance — typically a "browse templates" path. */
  secondary?: { label: string; to: string }
  /** Optional extra content rendered below the CTAs (e.g. a tip card). */
  footer?: ReactNode
  /** Accent colour for the icon badge; falls back to the brand green. */
  accent?: string
}

export function ModuleHeroEmptyState({
  icon: Icon,
  title,
  body,
  primary,
  secondary,
  footer,
  accent = '#1a3d32',
}: ModuleHeroEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className="mb-6 flex size-16 items-center justify-center rounded-full"
        style={{ backgroundColor: `color-mix(in srgb, ${accent} 10%, white)` }}
        aria-hidden
      >
        <Icon className="size-7" style={{ color: accent }} />
      </div>
      <h2 className="mb-2 text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="mb-6 max-w-md text-sm text-neutral-600">{body}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to={primary.to}
          className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={
            {
              backgroundColor: accent,
              ['--tw-ring-color' as string]: `color-mix(in srgb, ${accent} 40%, transparent)`,
            } as React.CSSProperties
          }
        >
          {primary.label}
        </Link>
        {secondary ? (
          <Link
            to={secondary.to}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400"
          >
            {secondary.label}
          </Link>
        ) : null}
      </div>
      {footer ? <div className="mt-8 max-w-md text-xs text-neutral-500">{footer}</div> : null}
    </div>
  )
}
