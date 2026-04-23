import type { ReactNode } from 'react'
import { Folder } from 'lucide-react'
import { LAYOUT_SCORE_STAT_CREAM, type LayoutScoreStatItem } from './platformLayoutKit'

type Props = {
  items: LayoutScoreStatItem[]
  className?: string
  /** Ekstra innhold per celle (valgfritt) */
  childrenByIndex?: Record<number, ReactNode>
  /**
   * `compact` — mindre typografi og padding (smale kolonner / mobil, f.eks. inspeksjonsrunde-detalj).
   * `dense` — enda mindre (f.eks. mange mapper per rad i dokumenthub).
   */
  variant?: 'default' | 'compact' | 'dense'
  /** Faste antall kolonner i rutenettet (f.eks. 5). Standard: ett felt per celle (`items.length`). */
  columns?: number
  /** `tight` — mindre mellomrom mellom celler. */
  gap?: 'default' | 'tight'
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
  columns,
  gap = 'default',
}: Props) {
  const n = Math.max(1, items.length)
  const colCount = Math.max(1, columns ?? n)
  const dense = variant === 'dense'
  const compact = variant === 'compact' || dense
  const cellPad = dense
    ? 'px-2 py-2 sm:px-2.5 sm:py-2'
    : compact
      ? 'px-3 py-3 sm:px-4 sm:py-3.5'
      : 'px-4 py-4 sm:px-5'
  const bigClass = dense
    ? 'break-words text-sm font-bold tabular-nums leading-tight text-neutral-900 sm:text-base'
    : compact
      ? 'break-words text-base font-bold leading-snug text-neutral-900 sm:text-lg'
      : 'text-3xl font-bold tabular-nums text-neutral-900'
  const titleClass = dense
    ? 'mt-0.5 text-[10px] font-semibold uppercase leading-tight tracking-wide text-neutral-700'
    : compact
      ? 'mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-700'
      : 'mt-1 text-sm font-semibold text-neutral-900'
  const subClass = dense
    ? 'mt-0.5 text-[9px] leading-tight text-neutral-600'
    : compact
      ? 'mt-0.5 text-[10px] leading-snug text-neutral-600'
      : 'mt-0.5 text-xs text-neutral-600'

  const gapClass = gap === 'tight' ? 'gap-2' : 'gap-3'

  const folderIconClass = dense
    ? 'mt-0.5 h-4 w-4 shrink-0 text-neutral-500'
    : compact
      ? 'mt-1 h-5 w-5 shrink-0 text-neutral-500'
      : 'mt-2 h-6 w-6 shrink-0 text-neutral-500'

  return (
    <div
      className={`grid ${gapClass} ${className}`.trim()}
      style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
    >
      {items.map((it, idx) => (
        <div
          key={`${it.title}-${idx}`}
          className={`min-w-0 rounded-xl ${cellPad}`}
          style={{ backgroundColor: LAYOUT_SCORE_STAT_CREAM }}
        >
          {it.icon === 'folder' ? (
            <div className="flex gap-2">
              <Folder className={folderIconClass} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={bigClass}>{it.big}</p>
                <p className={titleClass}>{it.title}</p>
                <p className={subClass}>{it.sub}</p>
              </div>
            </div>
          ) : (
            <>
              <p className={bigClass}>{it.big}</p>
              <p className={titleClass}>{it.title}</p>
              <p className={subClass}>{it.sub}</p>
            </>
          )}
          {childrenByIndex?.[idx] ?? null}
        </div>
      ))}
    </div>
  )
}
