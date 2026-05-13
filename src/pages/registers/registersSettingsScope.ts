// Registers settings scope.
//
// Mirrors the two tabs currently rendered by
// `src/pages/registers/RegistersAdminPage.tsx`:
//   - Registertyper (enable/disable system types + create custom types)
//   - Kategorier (category CRUD that groups types in the sidebar)
//
// The legacy page stays mounted at `/registers/admin` until the flag
// flip; this scope adds the same functionality under
// `/admin/settings/registers/<section>` so both surfaces coexist during
// the migration.

import { lazy } from 'react'
import { FolderTree, Layers, Package } from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../lib/settings/settingsRegistry'

const sections: SettingsSection[] = [
  {
    id: 'typer',
    label: 'Registertyper',
    icon: Layers,
    capabilities: ['general', 'categories'],
    searchKeywords: ['register', 'registertype', 'kjemikalier', 'leverandører', 'gdpr'],
    component: lazy(() => import('./RegistersScopeTyper')),
  },
  {
    id: 'kategorier',
    label: 'Kategorier',
    icon: FolderTree,
    capabilities: ['categories'],
    searchKeywords: ['kategori', 'gruppe'],
    component: lazy(() => import('./RegistersScopeKategorier')),
  },
]

registerSettingsScope({
  scopeId: 'registers',
  label: 'Register',
  group: 'module',
  order: 50,
  icon: Package,
  // Register doesn't have a dedicated accent in CLAUDE.md; using the
  // brand green to match the existing RegistersAdminPage chrome.
  accent: '#1a3d32',
  // Mirrors REGISTERS_NAV_PERMS in AticsShell.tsx:416 — broad, because
  // anyone with view access to an HMS module surface can see the menu;
  // the page-level RLS keeps writes scoped. Admin short-circuits.
  permAny: [
    'module.view.dashboard',
    'module.view.hse',
    'module.view.org_health',
    'module.view.internal_control',
    'documents.view',
  ],
  sections,
})
