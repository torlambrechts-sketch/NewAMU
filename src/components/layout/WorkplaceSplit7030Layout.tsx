import type { ReactNode } from 'react'

const CARD = 'rounded-xl border border-neutral-200/80 bg-white shadow-sm'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

/** Same ratio as layout-reference «Dashboard 70/30» and WelcomeDashboardPage main column. */
const GRID =
  'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:items-start'

export type WorkplaceSplit7030LayoutProps = {
  /** Primary column (~2/3) */
  main: ReactNode
  /** Secondary column (~1/3) */
  aside: ReactNode
  /** When true, each column is wrapped in a white card (default true). */
  cardWrap?: boolean
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
  className = '',
  mainClassName = '',
  asideClassName = '',
}: WorkplaceSplit7030LayoutProps) {
  const mainInner = <div className={`min-w-0 space-y-6 ${mainClassName}`.trim()}>{main}</div>
  const asideInner = <div className={`min-w-0 space-y-6 ${asideClassName}`.trim()}>{aside}</div>

  return (
    <div className={`${GRID} ${className}`.trim()}>
      {cardWrap ? (
        <>
          <div className={`${CARD} p-4 md:p-6`} style={CARD_SHADOW}>
            {mainInner}
          </div>
          <div className={`${CARD} p-4 md:p-6`} style={CARD_SHADOW}>
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
