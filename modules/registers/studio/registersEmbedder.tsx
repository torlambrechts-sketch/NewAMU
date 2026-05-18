// Registers embedder — Studio Builder Phase 2a Task 2a.1.
//
// Wraps the existing RegistersScopeTyper inline. The settings hub
// already covers list + add + lock-toggle for the org's register types.

import RegistersScopeTyper from '../../../src/pages/registers/RegistersScopeTyper'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function RegistersEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode}>
      <RegistersScopeTyper />
    </div>
  )
}
