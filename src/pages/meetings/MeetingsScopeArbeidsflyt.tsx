// Settings-hub wrapper for the Møter "Arbeidsflyt" tab. Mirrors the
// inline JSX block at `MeetingsAdminPage.tsx:139-155`.

import { GitBranch } from 'lucide-react'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { WorkflowRulesTab } from '../../components/workflow/WorkflowRulesTab'
import { MEETINGS_WORKFLOW_TRIGGER_EVENTS } from '../../components/workflow/workflowTriggerRegistry'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

export default function MeetingsScopeArbeidsflyt() {
  const { supabase } = useOrgSetupContext()
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="h-5 w-5 text-[#1a3d32]" />
        <h2 className="text-lg font-semibold text-neutral-900">Arbeidsflyt</h2>
      </div>
      <p className="mb-4 text-sm text-neutral-600">
        Koble møtehendelser til e-postregler og automatisering — f.eks. varsling
        ved planlagt møte, fullføring eller manglende signatur.
      </p>
      <WorkflowRulesTab
        supabase={supabase}
        module="meetings"
        triggerEvents={MEETINGS_WORKFLOW_TRIGGER_EVENTS.map((e) => ({ value: e.value, label: e.label }))}
      />
    </ModuleSectionCard>
  )
}
