import { useContext } from 'react'
import { WorkplacePublishedComposerContext } from '../context/workplacePublishedComposerContextValue'

export function useWorkplacePublishedComposerStacks() {
  const ctx = useContext(WorkplacePublishedComposerContext)
  if (!ctx) {
    throw new Error('useWorkplacePublishedComposerStacks must be used within WorkplacePublishedComposerProvider')
  }
  return ctx
}
