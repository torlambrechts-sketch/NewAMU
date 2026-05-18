// Survey embedder — Studio Builder Phase 1 stub.

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'
import { DeferredEmbedderPlaceholder } from '../../../src/components/studio/shell/DeferredEmbedderPlaceholder'

export default function SurveyEmbedder({ mode }: EmbedderProps) {
  return (
    <DeferredEmbedderPlaceholder
      scopeLabel="undersøkelser"
      fallbackHref="/survey/admin"
      fallbackLabel="Undersøkelser → Innstillinger"
      mode={mode}
    />
  )
}
