// Compliance checklist audit scope — side-effect file.
//
// Imported by ChecklistExecutionPage at module load so registration
// happens before <EntityTimeline scopeId="compliance_checklist" /> first
// renders. Mirrors the dashboard-engine convention
// (specs/endringslogg-spec.md §5).

import { registerAuditScope } from '../../../src/lib/audit/auditRegistry'

registerAuditScope({
  scopeId: 'compliance_checklist',
  label: 'Sjekkliste',
  entityKinds: [
    'compliance_checklist_execution',
    'compliance_checklist_response',
    'compliance_checklist_comment',
  ],
  accent: '#1a3d32',
  auditableTables: [
    'compliance_checklist_executions',
    'compliance_checklist_responses',
    'compliance_checklist_comments',
  ],
})
