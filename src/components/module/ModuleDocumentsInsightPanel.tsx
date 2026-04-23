import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { WORKPLACE_MODULE_SUBTLE_PANEL, WORKPLACE_MODULE_SUBTLE_PANEL_STYLE } from '../layout/workplaceModuleSurface'

export type ModuleDocumentsInsightPanelProps = {
  children: ReactNode
  /** Optional heading inside the panel (e.g. «Filtre»). */
  title?: string
  className?: string
}

/**
 * Cream / subtle bordered panel for the documents module **aside** column — filters, short summaries, etc.
 * Matches the document hub test layout; avoids a nested white `ModuleSectionCard` beside the main list card.
 *
 * @see {@link ModuleDocumentsHubLayout}
 */
export function ModuleDocumentsInsightPanel({ children, title, className }: ModuleDocumentsInsightPanelProps) {
  return (
    <div
      className={twMerge(WORKPLACE_MODULE_SUBTLE_PANEL, 'p-3 md:p-4', className)}
      style={WORKPLACE_MODULE_SUBTLE_PANEL_STYLE}
    >
      {title ? <h3 className="text-xs font-semibold text-neutral-900">{title}</h3> : null}
      <div className={title ? 'mt-3' : undefined}>{children}</div>
    </div>
  )
}
