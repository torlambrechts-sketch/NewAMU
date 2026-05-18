// Survey embedder — Studio Builder Phase 2a Task 2a.1.
//
// Modes:
//   ?template=<id> → SurveyBuilder canvas
//   default        → SurveyMalerOpsCard list view in ScopeListShell

import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../src/components/ui/Button'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { SurveyMalerOpsCard } from '../admin/SurveyMalerOpsCard'
import { CloneDeepLinkRedirect } from '../../../src/components/studio/shell/CloneDeepLinkRedirect'
import { ScopeListShell } from '../../../src/components/studio/shell/ScopeListShell'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'
import { SurveyBuilder } from './SurveyBuilder'

export default function SurveyEmbedder({ mode }: EmbedderProps) {
  const { supabase } = useOrgSetupContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const templateId = searchParams.get('template')

  if (templateId) {
    return (
      <div data-studio-mode={mode}>
        <div className="mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.delete('template')
              setSearchParams(next, { replace: true })
            }}
          >
            ← Tilbake til mal-liste
          </Button>
        </div>
        <SurveyBuilder templateId={templateId} />
      </div>
    )
  }

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
