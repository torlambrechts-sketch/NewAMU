import { createContext } from 'react'
import type { ComposerTemplateRow } from '../lib/platformComposerTemplatesApi'

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export type WorkplacePublishedComposerContextValue = {
  publishedStackTemplates: ComposerTemplateRow[] | null
  loadState: LoadState
  refreshPublishedTemplates: () => Promise<void>
}

export const WorkplacePublishedComposerContext = createContext<WorkplacePublishedComposerContextValue | null>(null)
