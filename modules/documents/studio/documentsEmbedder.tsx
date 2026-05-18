// Documents embedder — Studio Builder Phase 1 stub.

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'
import { DeferredEmbedderPlaceholder } from '../../../src/components/studio/shell/DeferredEmbedderPlaceholder'

export default function DocumentsEmbedder({ mode }: EmbedderProps) {
  return (
    <DeferredEmbedderPlaceholder
      scopeLabel="dokumenter"
      fallbackHref="/documents"
      fallbackLabel="Dokumenter"
      mode={mode}
    />
  )
}
