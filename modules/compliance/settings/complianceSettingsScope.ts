// Compliance (Sjekklister) settings scope.
//
// Mirrors the six tabs in `src/pages/ComplianceChecklistsAdminPage.tsx`:
// Maler / Kategorier / Pakker / Krav / Arbeidsflyt / Statistikk. Every
// tab is already a named export from `modules/compliance/admin/*Tab.tsx`
// so this scope is the cleanest of all migrations — no inline JSX
// extraction needed.

import { lazy } from 'react'
import {
  BarChart2,
  ClipboardList,
  FolderTree,
  GitBranch,
  Layers,
  ShieldCheck,
} from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../../src/lib/settings/settingsRegistry'

const sections: SettingsSection[] = [
  {
    id: 'maler',
    label: 'Maler',
    icon: ClipboardList,
    capabilities: ['templates'],
    searchKeywords: ['mal', 'sjekkliste', 'template'],
    component: lazy(() =>
      import('../admin/MalerTab').then((m) => ({ default: m.MalerTab })),
    ),
  },
  {
    id: 'kategorier',
    label: 'Kategorier',
    icon: FolderTree,
    capabilities: ['categories'],
    searchKeywords: ['kategori', 'gruppe', 'taksonomi'],
    component: lazy(() =>
      import('../admin/KategorierTab').then((m) => ({ default: m.KategorierTab })),
    ),
  },
  {
    id: 'pakker',
    label: 'Pakker',
    icon: Layers,
    capabilities: ['packs'],
    searchKeywords: ['pakke', 'pack', 'aml', 'iso', 'rammeverk'],
    component: lazy(() =>
      import('../admin/PakkerTab').then((m) => ({ default: m.PakkerTab })),
    ),
  },
  {
    id: 'krav',
    label: 'Krav',
    icon: ShieldCheck,
    capabilities: ['requirements'],
    searchKeywords: ['krav', 'compliance', 'lovkrav', 'ik-f', 'aml-§', 'requirement'],
    component: lazy(() =>
      import('../admin/KravTab').then((m) => ({ default: m.KravTab })),
    ),
  },
  {
    id: 'arbeidsflyt',
    label: 'Arbeidsflyt',
    icon: GitBranch,
    capabilities: ['workflow'],
    searchKeywords: ['arbeidsflyt', 'workflow', 'epost', 'varsel', 'avvik'],
    component: lazy(() =>
      import('../admin/ArbeidsflytTab').then((m) => ({ default: m.ArbeidsflytTab })),
    ),
  },
  {
    id: 'statistikk',
    label: 'Statistikk',
    icon: BarChart2,
    capabilities: ['statistics'],
    searchKeywords: ['statistikk', 'kpi', 'dekning', 'coverage'],
    component: lazy(() =>
      import('../admin/StatistikkTab').then((m) => ({ default: m.StatistikkTab })),
    ),
  },
]

registerSettingsScope({
  scopeId: 'compliance',
  label: 'Sjekklister',
  group: 'module',
  order: 10,
  icon: ShieldCheck,
  // Brand green per CLAUDE.md "Accent palette". The compliance pages
  // flip accent by `?pack=` at render-time; the scope's default is the
  // canonical AML green and the per-pack override lives elsewhere.
  accent: '#1a3d32',
  // Mirrors COMPLIANCE_NAV_PERMS in `AticsShell.tsx:371` — broad on
  // purpose so view-only HMS roles see the menu. Per-tab perm gating
  // happens inside the existing tab components when they write.
  permAny: [
    'module.view.dashboard',
    'checklist.manage',
  ],
  sections,
})
