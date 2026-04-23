import type { ReactNode } from 'react'

const CARD = 'rounded-xl border border-neutral-200/80 bg-white shadow-sm'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

/** Same ratio as layout-reference «Dashboard 70/30» and WelcomeDashboardPage main column. */
const GRID_DEFAULT =
  'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:items-start'

/** Tighter split: aligned column tops, equal stretch height, smaller gaps and card padding (e.g. document hub test). */
const GRID_COMPACT =
  'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(240px,2.75fr)] lg:items-stretch lg:gap-5'

const CARD_PAD_DEFAULT = 'p-4 md:p-6'
const CARD_PAD_COMPACT = 'p-3 md:p-4'

const INNER_STACK_DEFAULT = 'space-y-6'
const INNER_STACK_COMPACT = 'space-y-4'

export type WorkplaceSplit7030LayoutProps = {
  /** Primary column (~2/3) */
  main: ReactNode
  /** Secondary column (~1/3) */
  aside: ReactNode
  /** When true, each column is wrapped in a white card (default true). */
  cardWrap?: boolean
  /**
   * `compact` — smaller gaps, tighter card padding, columns stretch to same height so main/aside boxes align visually.
   */
  splitDensity?: 'default' | 'compact'
  /** Extra class on outer grid */
  className?: string
  /** Extra class on main cell */
  mainClassName?: string
  /** Extra class on aside cell */
  asideClassName?: string
}

/**
 * Two-column layout: main ~7fr, aside ~3fr (stacked on small screens).
 * Use on cream canvas ({@link WorkplaceChrome}) for overview / dashboard sidebars.
 */
export function WorkplaceSplit7030Layout({
  main,
  aside,
  cardWrap = true,
  splitDensity = 'default',
  className = '',
  mainClassName = '',
  asideClassName = '',
}: WorkplaceSplit7030LayoutProps) {
  const gridBase = splitDensity === 'compact' ? GRID_COMPACT : GRID_DEFAULT
  const cardPad = splitDensity === 'compact' ? CARD_PAD_COMPACT : CARD_PAD_DEFAULT
  const innerStack = splitDensity === 'compact' ? INNER_STACK_COMPACT : INNER_STACK_DEFAULT

  const mainInner = <div className={`min-w-0 ${innerStack} ${mainClassName}`.trim()}>{main}</div>
  const asideInner = <div className={`min-w-0 ${innerStack} ${asideClassName}`.trim()}>{aside}</div>

  return (
    <div className={`${gridBase} ${className}`.trim()}>
      {cardWrap ? (
        <>
          <div className={`${CARD} flex min-h-0 min-w-0 flex-col ${cardPad}`} style={CARD_SHADOW}>
            {mainInner}
          </div>
          <div className={`${CARD} flex min-h-0 min-w-0 flex-col ${cardPad}`} style={CARD_SHADOW}>
            {asideInner}
          </div>
        </>
      ) : (
        <>
          {mainInner}
          {asideInner}
        </>
      )}
    </div>
  )
}
