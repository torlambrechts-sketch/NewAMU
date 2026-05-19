// Alerts audit scope — side-effect file.
//
// **All alerts mutations are privileged by default** per spec §13.3 +
// privileged-data classification §4.5. Only readers with
// audit.read.privileged see the diff content. The trail itself stays
// visible to anyone with audit.read so the audit chain is provable.

import { registerAuditScope } from '../../../src/lib/audit/auditRegistry'

registerAuditScope({
  scopeId: 'alerts',
  label: 'Varsling',
  entityKinds: ['alert_case', 'alert_case_note', 'alert_case_attachment'],
  // No accent — alerts uses the neutral chrome; spec doesn't assign an
  // accent because the module's visual language is already red-coded for
  // sensitivity.
  auditableTables: ['alert_cases', 'alert_case_notes', 'alert_case_attachments'],
})
