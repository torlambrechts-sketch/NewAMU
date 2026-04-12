import type { ReactNode } from 'react'
import { LAYOUT_SCORE_STAT_CREAM, type LayoutScoreStatItem } from './platformLayoutKit'

type Props = {
  items: LayoutScoreStatItem[]
  className?: string
  /** Ekstra innhold per celle (valgfritt) */
  childrenByIndex?: Record<number, ReactNode>
}

/**
 * Tre (eller flere) KPI-bokser: stort tall, tittel, undertekst — som i layout-referanse scorecard-rad.
 */
export function LayoutScoreStatRow({ items, className = '', childrenByIndex }: Props) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className}`.trim()}>
      {items.map((it, idx) => (
        <div
          key={`${it.title}-${idx}`}
          className="rounded-xl px-5 py-4"
          style={{ backgroundColor: LAYOUT_SCORE_STAT_CREAM }}
        >
          <p className="text-3xl font-bold tabular-nums text-neutral-900">{it.big}</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{it.title}</p>
          <p className="mt-0.5 text-xs text-neutral-600">{it.sub}</p>
          {childrenByIndex?.[idx] ?? null}
        </div>
      ))}
    </div>
  )
}
