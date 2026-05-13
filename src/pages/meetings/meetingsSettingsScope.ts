// Meetings (Møter) settings scope.
//
// Mirrors the six tabs in `src/pages/meetings/MeetingsAdminPage.tsx`:
// Maler / Kategorier / Pakker / Krav / Arbeidsflyt / Statistikk.

import { lazy } from 'react'
import {
  BarChart2,
  ClipboardList,
  GitBranch,
  Layers,
  ShieldCheck,
  Tags,
  Users,
} from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../lib/settings/settingsRegistry'

const sections: SettingsSection[] = [
  {
    id: 'maler',
    label: 'Maler',
    icon: ClipboardList,
    capabilities: ['templates'],
    searchKeywords: ['mal', 'møte', 'agenda', 'systemmal', 'orgmal'],
    component: lazy(() => import('./MeetingsScopeMaler')),
  },
  {
    id: 'kategorier',
    label: 'Kategorier',
    icon: Tags,
    capabilities: ['categories'],
    searchKeywords: ['kategori', 'gruppe', 'sidebar'],
    component: lazy(() => import('./MeetingsScopeKategorier')),
  },
  {
    id: 'pakker',
    label: 'Pakker',
    icon: Layers,
    capabilities: ['packs'],
    searchKeywords: ['pakke', 'pack', 'rammeverk'],
    component: lazy(() =>
      import('../../../modules/meetings/admin/MeetingsPakkerTab').then((m) => ({
        default: m.MeetingsPakkerTab,
      })),
    ),
  },
  {
    id: 'krav',
    label: 'Krav',
    icon: ShieldCheck,
    capabilities: ['requirements'],
    searchKeywords: ['krav', 'compliance', 'lovkrav'],
    component: lazy(() =>
      import('../../../modules/meetings/admin/MeetingsKravTab').then((m) => ({
        default: m.MeetingsKravTab,
      })),
    ),
  },
  {
    id: 'arbeidsflyt',
    label: 'Arbeidsflyt',
    icon: GitBranch,
    capabilities: ['workflow'],
    searchKeywords: ['arbeidsflyt', 'workflow', 'epost', 'varsel', 'signatur'],
    component: lazy(() => import('./MeetingsScopeArbeidsflyt')),
  },
  {
    id: 'statistikk',
    label: 'Statistikk',
    icon: BarChart2,
    capabilities: ['statistics'],
    searchKeywords: ['statistikk', 'kpi', 'dekning'],
    component: lazy(() =>
      import('../../../modules/meetings/admin/MeetingsStatistikkTab').then((m) => ({
        default: m.MeetingsStatistikkTab,
      })),
    ),
  },
]

registerSettingsScope({
  scopeId: 'meetings',
  label: 'Møter',
  group: 'module',
  order: 40,
  icon: Users,
  // Møter doesn't have a dedicated accent in CLAUDE.md — using the
  // brand green to match existing MeetingsAdminPage chrome.
  accent: '#1a3d32',
  // Settings gate matches the existing MeetingsAdminPage `canManage`
  // check (line 101): `meetings.manage` only. Admin short-circuits.
  permAny: ['meetings.manage'],
  sections,
})
