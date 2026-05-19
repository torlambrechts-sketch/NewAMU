// Learning audit scope — side-effect file.
// Imported by useLearning at module load. See specs/endringslogg-spec.md §5.

import { registerAuditScope } from '../../../src/lib/audit/auditRegistry'

registerAuditScope({
  scopeId: 'learning',
  label: 'Kurs',
  entityKinds: ['learning_course', 'learning_course_progress'],
  accent: '#0e7490',
  auditableTables: ['learning_courses', 'learning_modules', 'learning_course_progress'],
})
