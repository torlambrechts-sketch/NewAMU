// Meetings audit scope — side-effect file.
// Imported by MeetingsDetailView at module load. See specs/endringslogg-spec.md §5.

import { registerAuditScope } from '../../../src/lib/audit/auditRegistry'

registerAuditScope({
  scopeId: 'meetings',
  label: 'Møte',
  entityKinds: [
    'meeting',
    'meeting_agenda_item',
    'meeting_attendee',
    'meeting_decision',
    'meeting_vote',
  ],
  accent: '#0891b2',
  auditableTables: [
    'meetings',
    'meeting_agenda_items',
    'meeting_attendees',
    'meeting_decisions',
    'meeting_votes',
  ],
})
