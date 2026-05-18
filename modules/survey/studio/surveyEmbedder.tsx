// Survey embedder — Studio Builder Phase 2a Task 2a.1.
//
// Wraps the existing SurveyMalerOpsCard (template management +
// metadata schema editor) inline in the studio shell. The card already
// owns its own state, pack filter, edit panel and mutations — perfect
// shape for a thin adapter that just hosts it.

import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { SurveyMalerOpsCard } from '../admin/SurveyMalerOpsCard'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function SurveyEmbedder({ mode }: EmbedderProps) {
  const { supabase } = useOrgSetupContext()
  return (
    <div data-studio-mode={mode}>
      <SurveyMalerOpsCard supabase={supabase} />
    </div>
  )
}
