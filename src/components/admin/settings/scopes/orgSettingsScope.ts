// Organisasjon-group settings scope.
//
// Hosts the panels currently rendered as tabs inside
// `src/pages/AdminPage.tsx` (the `/organisation/admin` page). Each tab
// becomes a registered section so the unified settings shell can route
// to it via `/admin/settings/org/<section>`.
//
// The existing panel components are named exports; `React.lazy`
// requires a `default` export at the module level, so each section's
// `component` uses the
//   `lazy(() => import(...).then(m => ({ default: m.Foo })))`
// shape. This keeps each panel in its own chunk.

import { lazy } from 'react'
import { BarChart3, Plug, Shield, ShieldAlert, UserCheck, UserSearch } from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../../../lib/settings/settingsRegistry'

// NOTE: Phase 1 of the settings hub registers the org scope with the
// Funksjonelle roller section only — the smallest panel — to validate
// end-to-end wiring. The remaining sections (users, roles, GDPR, etc.)
// are migrated in subsequent phases when each panel is extracted
// from `AdminPage.tsx` into a freestanding component.
const sections: SettingsSection[] = [
  {
    id: 'functional-roles',
    label: 'Funksjonelle roller',
    icon: UserCheck,
    capabilities: ['general'],
    searchKeywords: ['verneombud', 'amu', 'hms', 'dpo', 'funksjonsroller'],
    component: lazy(() =>
      import('../../../../pages/admin/FunctionalRolesAdminPanel').then((m) => ({
        default: m.FunctionalRolesAdminPanel,
      })),
    ),
  },
  {
    id: 'role-compliance',
    label: 'Rolle-compliance',
    icon: BarChart3,
    capabilities: ['statistics'],
    searchKeywords: ['rolle', 'compliance', 'dekning', 'gap'],
    component: lazy(() =>
      import('../../../../pages/admin/RoleComplianceAnalysePage').then((m) => ({
        default: m.RoleComplianceAnalysePage,
      })),
    ),
  },
  {
    id: 'gdpr-breach',
    label: 'GDPR brudd',
    icon: ShieldAlert,
    capabilities: ['general'],
    searchKeywords: ['gdpr', 'brudd', 'datatilsynet', 'art 33', 'art 34'],
    component: lazy(() =>
      import('../../../../pages/admin/GdprBreachAdminPanel').then((m) => ({
        default: m.GdprBreachAdminPanel,
      })),
    ),
  },
  {
    id: 'gdpr-subject-requests',
    label: 'GDPR individrettigheter',
    icon: UserSearch,
    capabilities: ['general'],
    searchKeywords: ['gdpr', 'innsyn', 'sletting', 'sar', 'individrettigheter'],
    component: lazy(() =>
      import('../../../../pages/admin/GdprSubjectRequestsAdminPanel').then((m) => ({
        default: m.GdprSubjectRequestsAdminPanel,
      })),
    ),
  },
  {
    id: 'integrations',
    label: 'Integrasjoner',
    icon: Plug,
    capabilities: ['integrations'],
    searchKeywords: ['integrasjon', 'bankid', 'altinn', 'eco-online', 'lovdata', 'feide'],
    component: lazy(() =>
      import('../../../../pages/admin/IntegrationsAdminPanel').then((m) => ({
        default: m.IntegrationsAdminPanel,
      })),
    ),
  },
]

registerSettingsScope({
  scopeId: 'org',
  label: 'Organisasjon',
  group: 'org',
  order: 0,
  icon: Shield,
  // `module.view.admin` is the existing gate for `/organisation/admin`
  // (`AdminPage.tsx:252`). Reuse it so visibility doesn't shift.
  permAny: ['module.view.admin', 'roles.manage'],
  sections,
})
