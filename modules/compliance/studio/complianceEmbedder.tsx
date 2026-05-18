// Compliance embedder — Studio Builder Phase 1 stub.
// Phase 2a Task 2a.1 swaps this for a TemplateEditorPanel-wrapping adapter.

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'
import { DeferredEmbedderPlaceholder } from '../../../src/components/studio/shell/DeferredEmbedderPlaceholder'

export default function ComplianceEmbedder({ mode }: EmbedderProps) {
  return (
    <DeferredEmbedderPlaceholder
      scopeLabel="sjekklister og samsvar"
      fallbackHref="/compliance/checklists/admin"
      fallbackLabel="Innstillinger → Sjekklister"
      mode={mode}
    />
  )
}
