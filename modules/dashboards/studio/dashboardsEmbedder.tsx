// Dashboards embedder — Studio Builder Phase 1 stub.

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'
import { DeferredEmbedderPlaceholder } from '../../../src/components/studio/shell/DeferredEmbedderPlaceholder'

export default function DashboardsEmbedder({ mode }: EmbedderProps) {
  return (
    <DeferredEmbedderPlaceholder
      scopeLabel="dashboards"
      fallbackHref="/overview/hms"
      fallbackLabel="Analyse → Rediger layout"
      mode={mode}
    />
  )
}
