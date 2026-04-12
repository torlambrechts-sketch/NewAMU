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
 * Én rad over hele bredden (like brede kolonner); `min-w-0` lar innhold bryte innenfor smale skjermer.
 */
export function LayoutScoreStatRow({ items, className = '', childrenByIndex }: Props) {
  const n = Math.max(1, items.length)
  return (
    <div
      className={`grid gap-3 ${className}`.trim()}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      {items.map((it, idx) => (
        <div
          key={`${it.title}-${idx}`}
          className="min-w-0 rounded-xl px-4 py-4 sm:px-5"
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
