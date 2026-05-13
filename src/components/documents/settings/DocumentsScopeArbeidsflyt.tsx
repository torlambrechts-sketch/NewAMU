// Settings-hub wrapper for the Arbeidsflyt tab. Extracts the inline JSX
// block that lived in `DocumentsModuleAdminPage.tsx:129-150` so the
// unified settings shell can lazy-render it.

import { GitBranch } from 'lucide-react'
import { ModuleSectionCard } from '../../module'
import { WorkflowRulesTab } from '../../workflow/WorkflowRulesTab'
import { DOCUMENTS_WORKFLOW_TRIGGER_EVENTS } from '../../workflow/workflowTriggerRegistry'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

export default function DocumentsScopeArbeidsflyt() {
  const { supabase } = useOrgSetupContext()

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="h-5 w-5 text-[#1a3d32]" />
        <h2 className="text-lg font-semibold text-neutral-900">Arbeidsflyt</h2>
      </div>
      <p className="mb-1 text-sm text-neutral-600">
        Koble dokumenthendelser til e-postregler og automatisering. Hendelser inkluderer publisering,
        revisjonsfrist, kvitteringsstatus og årsgjennomgang.
      </p>
      <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
        <strong className="text-neutral-800">Aktuelle lovkrav:</strong>{' '}
        IK-f §5 nr. 5 (årsgjennomgang) · AML §3-2 (opplæring og informasjon) ·
        Internkontrollforskriften §5 nr. 7 (oppdaterte prosedyrer).
      </div>
      <WorkflowRulesTab
        supabase={supabase}
        module="documents"
        triggerEvents={DOCUMENTS_WORKFLOW_TRIGGER_EVENTS.map((e) => ({ value: e.value, label: e.label }))}
      />
    </ModuleSectionCard>
  )
}
