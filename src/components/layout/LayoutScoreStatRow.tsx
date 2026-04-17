import type { ReactNode } from 'react'
import { LAYOUT_SCORE_STAT_CREAM, type LayoutScoreStatItem } from './platformLayoutKit'

type Props = {
  items: LayoutScoreStatItem[]
  className?: string
  /** Ekstra innhold per celle (valgfritt) */
  childrenByIndex?: Record<number, ReactNode>
  /**
   * `compact` — mindre typografi og padding (smale kolonner / mobil, f.eks. inspeksjonsrunde-detalj).
   */
  variant?: 'default' | 'compact'
}

/**
 * Tre (eller flere) KPI-bokser: stort tall, tittel, undertekst — som i layout-referanse scorecard-rad.
 * Én rad over hele bredden (like brede kolonner); `min-w-0` lar innhold bryte innenfor smale skjermer.
 */
export function LayoutScoreStatRow({
  items,
  className = '',
  childrenByIndex,
  variant = 'default',
}: Props) {
  const n = Math.max(1, items.length)
  const compact = variant === 'compact'
  const cellPad = compact ? 'px-3 py-3 sm:px-4 sm:py-3.5' : 'px-4 py-4 sm:px-5'
  const bigClass = compact
    ? 'break-words text-base font-bold leading-snug text-neutral-900 sm:text-lg'
    : 'text-3xl font-bold tabular-nums text-neutral-900'
  const titleClass = compact
    ? 'mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-700'
    : 'mt-1 text-sm font-semibold text-neutral-900'
  const subClass = compact ? 'mt-0.5 text-[10px] leading-snug text-neutral-600' : 'mt-0.5 text-xs text-neutral-600'

  return (
    <div
      className={`grid gap-3 ${className}`.trim()}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      {items.map((it, idx) => (
        <div
          key={`${it.title}-${idx}`}
          className={`min-w-0 rounded-xl ${cellPad}`}
          style={{ backgroundColor: LAYOUT_SCORE_STAT_CREAM }}
        >
          <p className={bigClass}>{it.big}</p>
          <p className={titleClass}>{it.title}</p>
          <p className={subClass}>{it.sub}</p>
          {childrenByIndex?.[idx] ?? null}
        </div>
      ))}
    </div>
  )
}
