// Innstillinger (system) settings scope.
//
// Org-wide system settings: company identity (read-only summary +
// deep-link to OrganisationPage), security roadmap, GDPR ops, and a
// plan/billing card. The privacy section composes the two existing
// panels (GdprBreachAdminPanel + GdprSubjectRequestsAdminPanel) under
// one tab so admins find every personvern-relatert ops surface in one
// place.
//
// Maler (/admin/templates) and Modul-konfigurasjon (/admin/modules) are
// reached from the sidebar directly, not via the registry — they have
// their own top-level routes and rendering a placeholder hop would be
// the anti-pattern we already removed for Organisasjon and Arbeidsflyt.

import { lazy } from 'react'
import { ScrollText, Settings, ShieldAlert, Sliders, Wallet } from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../../../lib/settings/settingsRegistry'

const sections: SettingsSection[] = [
  {
    id: 'general',
    label: 'Generelt',
    icon: Sliders,
    capabilities: ['general'],
    searchKeywords: ['generelt', 'språk', 'tidssone', 'lokalitet', 'merkevare'],
    component: lazy(() => import('../panels/GeneralSettingsPanel')),
  },
  {
    id: 'security',
    label: 'Sikkerhet',
    icon: ScrollText,
    capabilities: ['general'],
    searchKeywords: ['sikkerhet', 'passord', '2fa', 'audit'],
    component: lazy(() => import('../panels/SecurityAdminPanel')),
  },
  {
    id: 'privacy',
    label: 'Personvern & GDPR',
    icon: ShieldAlert,
    capabilities: ['general'],
    searchKeywords: ['gdpr', 'brudd', 'datatilsynet', 'art 33', 'art 34', 'innsyn', 'sletting', 'sar'],
    component: lazy(() => import('../panels/PrivacyComposedPanel')),
  },
  {
    id: 'plan',
    label: 'Plan & abonnement',
    icon: Wallet,
    capabilities: ['general'],
    searchKeywords: ['plan', 'abonnement', 'lisens', 'billing'],
    component: lazy(() => import('../panels/PlanAdminPanel')),
  },
]

registerSettingsScope({
  scopeId: 'settings',
  label: 'Innstillinger',
  group: 'org',
  order: 40,
  icon: Settings,
  permAny: ['module.view.admin', 'roles.manage'],
  sections,
})
