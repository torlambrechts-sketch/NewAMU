// Documents embedder — Studio Builder Phase 2a Task 2a.1.

import { DocumentTemplatesSettings } from '../../../src/pages/documents/DocumentTemplatesSettings'
import { CloneDeepLinkRedirect } from '../../../src/components/studio/shell/CloneDeepLinkRedirect'
import { ScopeListShell } from '../../../src/components/studio/shell/ScopeListShell'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function DocumentsEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode}>
      <CloneDeepLinkRedirect scopeId="documents" />
      <ScopeListShell
        title="Dokumenter"
        subtitle="Policy, instrukser, prosedyrer og acknowledgement-flyter"
        bare
      >
        <DocumentTemplatesSettings />
      </ScopeListShell>
    </div>
  )
}
