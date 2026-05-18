// Registers embedder — Studio Builder Phase 2a Task 2a.1.

import RegistersScopeTyper from '../../../src/pages/registers/RegistersScopeTyper'
import { CloneDeepLinkRedirect } from '../../../src/components/studio/shell/CloneDeepLinkRedirect'
import { ScopeListShell } from '../../../src/components/studio/shell/ScopeListShell'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function RegistersEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode}>
      <CloneDeepLinkRedirect scopeId="registers" />
      <ScopeListShell
        title="Register"
        subtitle="AML / GDPR / ISO register-typer + felt-skjema"
        bare
      >
        <RegistersScopeTyper />
      </ScopeListShell>
    </div>
  )
}
