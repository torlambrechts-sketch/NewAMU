import type { ContentBlock } from '../types/documents'

/** Ensures every block has `instanceId` for stable React keys and drag-and-drop. */
export function ensureContentBlockInstanceIds(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((b) => (b.instanceId ? b : { ...b, instanceId: crypto.randomUUID() }))
}

/** Removes client-only ids before JSON persistence to `wiki_pages.blocks`. */
export function stripContentBlockInstanceIds(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block) => {
    if (!block.instanceId) return block
    const next = { ...block } as ContentBlock & { instanceId?: string }
    delete next.instanceId
    return next as ContentBlock
  })
}
