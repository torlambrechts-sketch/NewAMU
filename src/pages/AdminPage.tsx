// AdminPage shim — phase 2.
//
// The legacy /organisation/admin page that mixed eight tabs (users,
// roles, delegation, functional_roles, role_compliance, gdpr_breach,
// gdpr_subject_requests, integrations) was 693 lines. Each tab has now
// been extracted into its own panel and registered under the new
// `/admin/settings/users-roles/<section>` scope. Anything that still
// links here gets bounced into the new IA.
//
// The file is kept (instead of deleted) for one release so the
// `/organisation/admin/legacy` fallback route in `App.tsx` continues to
// resolve to *something*. Phase 3 deletes the file and the legacy route.

import { Navigate } from 'react-router-dom'

export function AdminPage() {
  return <Navigate to="/admin/settings/users-roles/internal" replace />
}
