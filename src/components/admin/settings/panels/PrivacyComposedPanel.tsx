// Personvern & GDPR composite panel.
//
// GDPR breach reporting moved into the Varslinger (alerts) module — see
// /alerts (kind='gdpr_breach' templates). This panel now hosts only the
// subject-rights surface (innsyn / sletting / dataportabilitet).

import { GdprSubjectRequestsAdminPanel } from '../../../../pages/admin/GdprSubjectRequestsAdminPanel'

export default function PrivacyComposedPanel() {
  return <GdprSubjectRequestsAdminPanel />
}
