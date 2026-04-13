import { createContext } from 'react'
import type { ComposerTemplateRow } from '../lib/platformComposerTemplatesApi'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export type WorkplacePublishedComposerContextValue = {
  /** All published rows (stack + grid). Same fetch as stack-only before — use for Komponer (grid) layouts. */
  publishedComposerTemplates: ComposerTemplateRow[] | null
  /** @deprecated Prefer publishedComposerTemplates and filter by kind — kept for existing call sites */
  publishedStackTemplates: ComposerTemplateRow[] | null
  loadState: LoadState
  refreshPublishedTemplates: () => Promise<void>
}

export const WorkplacePublishedComposerContext = createContext<WorkplacePublishedComposerContextValue | null>(null)
