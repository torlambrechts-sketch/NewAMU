import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * KPI strip used at the top of module landing pages.
 *
 * Extracted from the ad-hoc `kpiItems.map(...)` blocks that every module page
 * re-declared. One row, four-up on desktop — `big` number, `title`, `sub`.
 */
export interface ModuleKpiItem {
  big: ReactNode
  title: string
  sub?: ReactNode
  /** Optional tone — `danger` tints the big number red for overdue counts. */
  tone?: 'default' | 'danger'
  icon?: ReactNode
  onClick?: () => void
}

export function ModuleKpiRow({
  items,
  className,
  accent = '#0f766e',
}: {
  items: ModuleKpiItem[]
  className?: string
  accent?: string
}) {
  return (
    <div
      className={twMerge(
        'grid grid-cols-2 gap-3 lg:grid-cols-4',
        className,
      )}
    >
      {items.map((item) => {
        const interactive = typeof item.onClick === 'function'
        const Tag = interactive ? 'button' : 'div'
        return (
          <Tag
            key={item.title}
            type={interactive ? 'button' : undefined}
            onClick={item.onClick}
            className={twMerge(
              'rounded-xl border border-neutral-200/80 bg-white px-4 py-3.5 text-left shadow-sm',
              interactive ? 'transition-colors hover:border-neutral-300 hover:bg-neutral-50' : '',
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p
                className="text-[26px] font-bold leading-none tabular-nums tracking-tight"
                style={{ color: item.tone === 'danger' ? '#b91c1c' : accent }}
              >
                {item.big}
              </p>
              {item.icon ? <span className="text-neutral-400">{item.icon}</span> : null}
            </div>
            <p className="mt-2 text-[13px] font-semibold text-neutral-900">{item.title}</p>
            {item.sub ? <p className="mt-0.5 text-[11px] text-neutral-500">{item.sub}</p> : null}
          </Tag>
        )
      })}
    </div>
  )
}
