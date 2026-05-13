// Documents settings scope.
//
// Mirrors the ten tabs currently rendered by
// `src/pages/DocumentsModuleAdminPage.tsx` (Generelt / Revisjon /
// Kvitteringer / Maler / Pakker / Krav / Import/Eksport / Tilgang /
// Arbeidsflyt / Statistikk). The three settings tabs that share the
// `org_module_payloads.documents_settings` blob are rendered via the
// `DocumentsScope*` wrappers, which own load/save via the shared
// `useDocumentsModuleSettings` hook. The other seven tabs use their
// existing standalone components directly.

import { lazy } from 'react'
import {
  BarChart2,
  BookOpen,
  Download,
  FileText,
  GitBranch,
  Layers,
  Lock,
  RefreshCw,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../../lib/settings/settingsRegistry'

const sections: SettingsSection[] = [
  {
    id: 'generelt',
    label: 'Generelt',
    icon: Settings,
    capabilities: ['general'],
    searchKeywords: ['språk', 'lovkrav', 'publisering', 'revisjonsbadge'],
    component: lazy(() => import('./DocumentsScopeGenerelt')),
  },
  {
    id: 'revisjon',
    label: 'Revisjon',
    icon: RefreshCw,
    capabilities: ['general'],
    searchKeywords: ['revisjon', 'årsgjennomgang', 'varsling', 'frist'],
    component: lazy(() => import('./DocumentsScopeRevisjon')),
  },
  {
    id: 'kvitteringer',
    label: 'Kvitteringer',
    icon: FileText,
    capabilities: ['general'],
    searchKeywords: ['kvittering', 'acknowledgement', 'påminnelse', 'frist'],
    component: lazy(() => import('./DocumentsScopeKvitteringer')),
  },
  {
    id: 'maler',
    label: 'Maler',
    icon: BookOpen,
    capabilities: ['templates'],
    searchKeywords: ['mal', 'template', 'systemmal', 'orgmal'],
    component: lazy(() =>
      import('./DocumentsSettingsMaler').then((m) => ({ default: m.DocumentsSettingsMaler })),
    ),
  },
  {
    id: 'pakker',
    label: 'Pakker',
    icon: Layers,
    capabilities: ['packs'],
    searchKeywords: ['pakke', 'pack', 'rammeverk'],
    component: lazy(() =>
      import('../../../../modules/documents/admin/DocumentsPakkerTab').then((m) => ({
        default: m.DocumentsPakkerTab,
      })),
    ),
  },
  {
    id: 'krav',
    label: 'Krav',
    icon: ShieldCheck,
    capabilities: ['requirements'],
    searchKeywords: ['krav', 'compliance', 'lovkrav', 'requirement'],
    component: lazy(() =>
      import('../../../../modules/documents/admin/DocumentsKravTab').then((m) => ({
        default: m.DocumentsKravTab,
      })),
    ),
  },
  {
    id: 'import',
    label: 'Import/Eksport',
    icon: Download,
    capabilities: ['import-export'],
    searchKeywords: ['import', 'eksport', 'json', 'backup'],
    component: lazy(() =>
      import('./DocumentsSettingsImportEksport').then((m) => ({
        default: m.DocumentsSettingsImportEksport,
      })),
    ),
  },
  {
    id: 'tilgang',
    label: 'Tilgang',
    icon: Lock,
    capabilities: ['general'],
    searchKeywords: ['tilgang', 'roller', 'access', 'permission'],
    component: lazy(() =>
      import('./DocumentsSettingsTilgang').then((m) => ({
        default: m.DocumentsSettingsTilgang,
      })),
    ),
  },
  {
    id: 'arbeidsflyt',
    label: 'Arbeidsflyt',
    icon: GitBranch,
    capabilities: ['workflow'],
    searchKeywords: ['arbeidsflyt', 'workflow', 'epost', 'varsel', 'automatisering'],
    component: lazy(() => import('./DocumentsScopeArbeidsflyt')),
  },
  {
    id: 'statistikk',
    label: 'Statistikk',
    icon: BarChart2,
    capabilities: ['statistics'],
    searchKeywords: ['statistikk', 'kpi', 'dekning'],
    component: lazy(() =>
      import('../../../../modules/documents/admin/DocumentsStatistikkTab').then((m) => ({
        default: m.DocumentsStatistikkTab,
      })),
    ),
  },
]

registerSettingsScope({
  scopeId: 'documents',
  label: 'Dokumenter',
  group: 'module',
  order: 30,
  icon: BookOpen,
  // Accent mirrors `CLAUDE.md` "Accent palette" — documents = deep teal.
  accent: '#0f766e',
  // Settings gate matches the existing `DocumentsModuleAdminPage` check
  // (`documents.manage`). Module nav permissions (`DOCUMENTS_NAV_PERMS`)
  // are broader on purpose — they include view roles. The settings hub
  // intentionally narrows to manage-only because every tab here writes.
  permAny: ['documents.manage'],
  sections,
})
