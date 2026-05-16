// Innstillinger (system) settings scope.
//
// Org-wide system settings that don't merit their own admin module:
// company identity (read-only summary + deep-link to OrganisationPage),
// security roadmap, GDPR ops, and a plan/billing card. The privacy
// section composes the two existing panels (GdprBreachAdminPanel +
// GdprSubjectRequestsAdminPanel) under one tab so admins find every
// personvern-relatert ops surface in one place.
//
// Maler was promoted to its own top-level admin module — sidebar entry
// Administrasjon → Maler with per-source subs that pre-filter the
// /admin/templates browser. Having templates as both a top-level entry
// and an Innstillinger sub-tab was duplicate noise. Modul-konfigurasjon
// (/admin/modules) is reached from the sidebar only — it's a thin
// enable/disable matrix with no useful summary surface to put here.

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
