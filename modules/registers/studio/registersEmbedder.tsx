// Registers embedder — Studio Builder Phase 1 stub.

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'
import { DeferredEmbedderPlaceholder } from '../../../src/components/studio/shell/DeferredEmbedderPlaceholder'

export default function RegistersEmbedder({ mode }: EmbedderProps) {
  return (
    <DeferredEmbedderPlaceholder
      scopeLabel="register"
      fallbackHref="/registers/admin"
      fallbackLabel="Register → Admin"
      mode={mode}
    />
  )
}
