// Survey audit scope — side-effect file.
// Imported by SurveyDetailView at module load. See specs/endringslogg-spec.md §5.

import { registerAuditScope } from '../../../src/lib/audit/auditRegistry'

registerAuditScope({
  scopeId: 'survey',
  label: 'Undersøkelse',
  entityKinds: ['survey'],
  accent: '#7c3aed',
  auditableTables: ['surveys', 'survey_sections', 'org_survey_questions'],
})
