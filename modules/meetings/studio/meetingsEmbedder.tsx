// Meetings embedder — Studio Builder Phase 1 stub.

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'
import { DeferredEmbedderPlaceholder } from '../../../src/components/studio/shell/DeferredEmbedderPlaceholder'

export default function MeetingsEmbedder({ mode }: EmbedderProps) {
  return (
    <DeferredEmbedderPlaceholder
      scopeLabel="møter"
      fallbackHref="/meetings/admin"
      fallbackLabel="Møter → Innstillinger"
      mode={mode}
    />
  )
}
