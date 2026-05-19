// Tasks audit scope — side-effect file.
// Imported by TaskDetailPanel at module load. See specs/endringslogg-spec.md §5.

import { registerAuditScope } from '../../../src/lib/audit/auditRegistry'

registerAuditScope({
  scopeId: 'tasks',
  label: 'Oppgave',
  entityKinds: ['task_item'],
  accent: '#c2410c',
  auditableTables: ['task_items', 'task_comments', 'task_evidence'],
})
