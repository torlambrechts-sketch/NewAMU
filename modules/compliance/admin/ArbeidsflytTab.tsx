// ArbeidsflytTab — workflow rule administration for compliance checklists.
//
// Thin wrapper over the shared <WorkflowRulesTab module="compliance_checklist">.
// The default rule (critical response → create_deviation) was seeded in
// 20260806120100_compliance_checklist_workflow.sql; admins can edit it,
// disable it, or add additional rules from this tab.

import { WorkflowRulesTab } from '../../../src/components/workflow/WorkflowRulesTab'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'

export function ArbeidsflytTab() {
  const { supabase } = useOrgSetupContext()
  return <WorkflowRulesTab supabase={supabase} module="compliance_checklist" />
}
