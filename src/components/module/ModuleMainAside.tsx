import type { ReactNode } from 'react'
import { WorkplaceSplit7030Layout } from '../layout/WorkplaceSplit7030Layout'

/**
 * 70/30 main + aside layout for module pages and frontpages.
 *
 * Thin semantic wrapper around {@link WorkplaceSplit7030Layout} so any module
 * page can drop in the exact same two-column split as the platform-admin
 * `layout-reference` → `Survey insights 70/30` and `Dashboard 70/30`
 * references: `lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)]`.
 *
 * Use for:
 *   - Group frontpage dashboards where the main column carries charts /
 *     tables and the aside shows latest activity, alerts, or a compact
 *     navigation panel.
 *   - Any detail page where the main column holds the primary content and
 *     the aside holds secondary metadata / activity feed.
 *
 * Defaults to `cardWrap={false}` so the caller owns the card chrome (each
 * section inside the main/aside can be its own `ModuleSectionCard` / insight
 * card). Pass `cardWrap` to get the same white card around both columns as
 * in the platform reference.
 *
 * @example
 * ```tsx
 * <ModuleMainAside
 *   main={
 *     <div className="space-y-4">
 *       <ModuleDonutCard … />
 *       <ModuleSectionCard>…</ModuleSectionCard>
 *     </div>
 *   }
 *   aside={
 *     <div className={INSIGHT_CARD}>
 *       <div className={INSIGHT_CARD_TOP_RULE} />
 *       <p className="font-semibold">Siste aktivitet</p>
 *       …
 *     </div>
 *   }
 * />
 * ```
 */
export interface ModuleMainAsideProps {
  /** Primary column content (~7fr). */
  main: ReactNode
  /** Secondary column content (~3fr). */
  aside: ReactNode
  /**
   * When `true`, each column is wrapped in a white card (same as the
   * platform reference blocks). Default `false` — the caller typically
   * supplies its own cards per section so the aside can hold multiple
   * individually-styled widgets.
   */
  cardWrap?: boolean
  /** Passed to `WorkplaceSplit7030Layout` — tighter grid/gaps and card padding when `compact`. */
  splitDensity?: 'default' | 'compact'
  /** Extra class on the outer grid. */
  className?: string
}

export function ModuleMainAside({
  main,
  aside,
  cardWrap = false,
  splitDensity = 'default',
  className = '',
}: ModuleMainAsideProps) {
  return (
    <WorkplaceSplit7030Layout
      main={main}
      aside={aside}
      cardWrap={cardWrap}
      splitDensity={splitDensity}
      className={className}
    />
  )
}
