import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { ModuleMainAside } from './ModuleMainAside'
import { ModuleSectionCard } from './ModuleSectionCard'

export type ModuleDocumentsHubLayoutProps = {
  /** Primary column: typically a table inside the shell; rendered inside one white {@link ModuleSectionCard}. */
  main: ReactNode
  /** Aside: filters / insight widgets — use {@link ModuleDocumentsInsightPanel} and {@link ModuleDocumentsForestCard}. */
  aside: ReactNode
  /** Full-width row above the 70/30 split (e.g. folder strip). */
  top?: ReactNode
  /** Full-width blocks below the split (e.g. malbibliotek, modals). */
  below?: ReactNode
  /** Passed to {@link ModuleMainAside} / {@link WorkplaceSplit7030Layout}. */
  splitDensity?: 'default' | 'compact'
  className?: string
}

/**
 * Default **Dokumenter** hub shell: 70/30 without an outer white wrap on each column (`cardWrap={false}`),
 * one white card around **main** only, aside stacks directly on the cream canvas.
 *
 * Use on `DocumentsModuleLayout` body (and test pages) so list + insight columns match placement rules
 * and avoid double white boxes (`docs/UI_PLACEMENT_RULES.md`).
 */
export function ModuleDocumentsHubLayout({
  main,
  aside,
  top,
  below,
  splitDensity = 'compact',
  className,
}: ModuleDocumentsHubLayoutProps) {
  return (
    <div className={twMerge('space-y-0', className)}>
      {top ? <div className="mb-5">{top}</div> : null}
      <ModuleMainAside
        cardWrap={false}
        splitDensity={splitDensity}
        main={
          <ModuleSectionCard className="p-3 md:p-4">
            {main}
          </ModuleSectionCard>
        }
        aside={<div className="space-y-3">{aside}</div>}
      />
      {below ? <div className="mt-6 space-y-6">{below}</div> : null}
    </div>
  )
}
