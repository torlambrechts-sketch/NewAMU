// Innstillinger (system) settings scope.
//
// Org-wide system settings: company identity (read-only summary +
// deep-link to OrganisationPage), security roadmap, GDPR ops, a
// cross-module template summary, and a plan/billing card. The privacy
// section composes the two existing panels (GdprBreachAdminPanel +
// GdprSubjectRequestsAdminPanel) under one tab so admins find every
// personvern-relatert ops surface in one place.
//
// Maler is registered here as a summary section with a CTA to the
// full /admin/templates browser — keeps templates discoverable when
// admins navigate inside the settings hub. The sidebar also has a
// direct Maler link for one-click access. Modul-konfigurasjon
// (/admin/modules) is reached from the sidebar only — it's a thin
// enable/disable matrix with no useful summary surface to put here.

import { lazy } from 'react'
import { LayoutTemplate, ScrollText, Settings, ShieldAlert, Sliders, Wallet } from 'lucide-react'
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
    id: 'templates',
    label: 'Maler',
    icon: LayoutTemplate,
    capabilities: ['templates'],
    searchKeywords: ['mal', 'template', 'malbibliotek', 'sjekkliste', 'dokumentmal', 'kursmal'],
    component: lazy(() => import('../panels/MalerSettingsPanel')),
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
