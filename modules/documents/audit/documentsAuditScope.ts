// Documents audit scope — side-effect file.
// Imported by useDocuments at module load. See specs/endringslogg-spec.md §5.

import { registerAuditScope } from '../../../src/lib/audit/auditRegistry'

registerAuditScope({
  scopeId: 'documents',
  label: 'Dokument',
  entityKinds: ['wiki_page', 'wiki_space'],
  accent: '#0f766e',
  auditableTables: ['wiki_pages', 'wiki_spaces', 'wiki_page_versions'],
})
