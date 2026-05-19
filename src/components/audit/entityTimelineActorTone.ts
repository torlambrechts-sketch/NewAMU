// Role-label table — extracted from EntityTimelineActor.tsx so the
// component module can keep react-refresh purity.

import type { AuditActorRole } from '../../lib/audit/diffShape'

export const ROLE_LABEL: Record<AuditActorRole, string> = {
  verneombud: 'Verneombud',
  amu_medlem: 'AMU-medlem',
  leder: 'Leder',
  hms_radgiver: 'HMS-rådgiver',
  ansatt: 'Ansatt',
  system: 'System',
  ekstern: 'Ekstern',
}
