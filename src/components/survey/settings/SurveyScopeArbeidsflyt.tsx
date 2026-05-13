// Settings-hub wrapper for the Survey "Arbeidsflyt" tab. Mirrors the
// inline JSX block at `SurveyModuleAdminPage.tsx:378-387`.

import { GitBranch } from 'lucide-react'
import { ModuleSectionCard } from '../../module'
import { WorkflowRulesTab } from '../../workflow/WorkflowRulesTab'
import { SURVEY_WORKFLOW_TRIGGER_EVENTS } from '../../workflow/workflowTriggerRegistry'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

export default function SurveyScopeArbeidsflyt() {
  const { supabase } = useOrgSetupContext()
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="h-5 w-5 text-[#1a3d32]" />
        <h2 className="text-lg font-semibold text-neutral-900">Arbeidsflyt</h2>
      </div>
      <p className="mb-4 text-sm text-neutral-600">
        Koble hendelser for undersøkelsesmodulen til e-postregler og automatisering.
      </p>
      <WorkflowRulesTab
        supabase={supabase}
        module="survey"
        triggerEvents={SURVEY_WORKFLOW_TRIGGER_EVENTS.map((e) => ({ value: e.value, label: e.label }))}
      />
    </ModuleSectionCard>
  )
}
