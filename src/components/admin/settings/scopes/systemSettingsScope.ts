// Innstillinger (system) settings scope.
//
// Org-wide system settings: locale/branding, security policy, GDPR ops
// (breach reporting + subject requests + retention), the cross-module
// templates browser, the module-enablement page, and a placeholder for
// plan & billing. The GDPR section composes the two existing panels
// (`GdprBreachAdminPanel` + `GdprSubjectRequestsAdminPanel`) under one
// tab so admins find every personvern-relatert ops surface in one place.

import { lazy } from 'react'
import { Boxes, LayoutTemplate, ScrollText, Settings, ShieldAlert, Sliders, Wallet } from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../../../lib/settings/settingsRegistry'
import { placeholderSection } from '../placeholderSection'

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
    searchKeywords: ['sikkerhet', 'passord', '2fa', 'revisjonslogg', 'audit'],
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
    searchKeywords: ['mal', 'template', 'biblioteket', 'kryssmodul'],
    component: placeholderSection(
      'Tverrgående maler',
      'Bla i og administrer maler på tvers av modulene (sjekklister, dokumenter, undersøkelser, læring).',
      'Eksisterende side ligger på /admin/templates. Lenken i sidemenyen tar deg dit.',
    ),
  },
  {
    id: 'modules',
    label: 'Modul-konfigurasjon',
    icon: Boxes,
    capabilities: ['general'],
    searchKeywords: ['moduler', 'aktivering', 'tilgjengelighet', 'rbac', 'feature flag'],
    component: placeholderSection(
      'Modul-konfigurasjon',
      'Aktivér moduler for organisasjonen og styr hvilke roller som ser hva.',
      'Eksisterende side ligger på /admin/modules. Lenken i sidemenyen tar deg dit.',
    ),
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
