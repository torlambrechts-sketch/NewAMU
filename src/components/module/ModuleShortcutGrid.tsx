import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

/**
 * Navigation shortcut card + grid for module / group frontpages.
 *
 * Matches the "open module" card pattern from `WorkplaceReportingPage` — large
 * icon badge, title, short description and an accent CTA. Use on group
 * frontpages (e.g. Risiko & Sikkerhet) to let users jump into each module with
 * one click.
 *
 * @example
 * ```tsx
 * <ModuleShortcutGrid
 *   items={[
 *     { to: '/sja', label: 'SJA', description: 'Sikker jobbanalyse', icon: ShieldAlert },
 *     { to: '/ros', label: 'ROS-analyser', description: 'Risikovurdering', icon: ClipboardList },
 *   ]}
 * />
 * ```
 */

export interface ModuleShortcutItem {
  to: string
  label: string
  description: ReactNode
  /** Lucide icon (or any React component with `className`). */
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  /** Optional tiny badge rendered on the card (e.g. "7 åpne"). */
  badge?: ReactNode
  /** Optional click-through label; defaults to «Åpne». */
  cta?: string
}

export interface ModuleShortcutGridProps {
  items: ModuleShortcutItem[]
  /** Column count at `lg` breakpoint. Defaults to 3. */
  columns?: 2 | 3 | 4
  className?: string
}

export function ModuleShortcutGrid({ items, columns = 3, className }: ModuleShortcutGridProps) {
  const colClass =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className={className ? `grid grid-cols-1 gap-4 ${colClass} ${className}` : `grid grid-cols-1 gap-4 ${colClass}`}>
      {items.map(({ to, label, description, icon: Icon, badge, cta = 'Åpne' }) => (
        <Link
          key={to}
          to={to}
          className="group block rounded-xl border border-neutral-200/90 bg-white p-5 shadow-sm transition hover:border-[#1a3d32]/40 hover:shadow"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#1a3d32]/10 text-[#1a3d32] transition group-hover:bg-[#1a3d32] group-hover:text-white">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-neutral-900">{label}</h3>
                {badge ? (
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                    {badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-neutral-600">{description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#1a3d32] group-hover:gap-2">
                {cta}
                <ArrowRight className="size-4 transition-all group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
