// Survey embedder — Studio Builder Phase 2a Task 2a.1.
//
// Hosts SurveyMalerOpsCard inside the consistent ScopeListShell so the
// visual surface matches every other studio scope. The card already
// owns its own state, pack filter, edit panel + mutations.

import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { SurveyMalerOpsCard } from '../admin/SurveyMalerOpsCard'
import { CloneDeepLinkRedirect } from '../../../src/components/studio/shell/CloneDeepLinkRedirect'
import { ScopeListShell } from '../../../src/components/studio/shell/ScopeListShell'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function SurveyEmbedder({ mode }: EmbedderProps) {
  const { supabase } = useOrgSetupContext()
  return (
    <div data-studio-mode={mode}>
      <CloneDeepLinkRedirect scopeId="survey" />
      <ScopeListShell
        title="Undersøkelser"
        subtitle="Maler, metadata-schema og pakke-tilknytning"
        bare
      >
        <SurveyMalerOpsCard supabase={supabase} />
      </ScopeListShell>
    </div>
  )
}
