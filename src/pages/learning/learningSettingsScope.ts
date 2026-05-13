// Learning (Læring) settings scope.
//
// Phase-1 interim: registers ONE section ("Innstillinger") that lazy-
// loads the existing `LearningSettings.tsx` component, whose six
// internal tabs (Generelt / Kategorier / Stier / Systemkurs /
// Integrasjoner / Eksport) continue to work via its `?tab=…` query
// param. The legacy URL `/learning/innstillinger` is unchanged.
//
// Phase-2 follow-up (out of scope here): decompose
// `LearningSettings.tsx` into one file per section (matching the
// pattern documents/survey use) so each section becomes a first-class
// registry entry — enabling per-tab search, audit-log tagging, and
// deep-linking through the unified hub. The five inline sections in
// the existing file (`GeneraltSection`, `StierSection`,
// `SystemkursSection`, `IntegrasjonerSection`, `EksportSection`) plus
// the already-extracted `KategorierSection` are the extraction units.

import { lazy } from 'react'
import { GraduationCap, Settings } from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../lib/settings/settingsRegistry'

const sections: SettingsSection[] = [
  {
    id: 'innstillinger',
    label: 'Innstillinger',
    icon: Settings,
    capabilities: [
      'general',
      'categories',
      'templates',
      'integrations',
      'import-export',
    ],
    searchKeywords: [
      'kurs',
      'læring',
      'systemkurs',
      'kategori',
      'sti',
      'integrasjon',
      'webhook',
      'teams',
      'slack',
      'eksport',
      'gdpr',
    ],
    component: lazy(() =>
      import('./LearningSettings').then((m) => ({ default: m.LearningSettings })),
    ),
  },
]

registerSettingsScope({
  scopeId: 'learning',
  label: 'Læring',
  group: 'module',
  order: 70,
  icon: GraduationCap,
  // Teal per CLAUDE.md "Accent palette".
  accent: '#0e7490',
  // Mirrors LEARNING_NAV_PERMS in `AticsShell.tsx:394`.
  permAny: ['module.view.learning', 'module.view.dashboard'],
  sections,
})
