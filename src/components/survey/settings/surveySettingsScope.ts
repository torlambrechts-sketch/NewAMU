// Survey (Undersøkelser) settings scope.
//
// Largest of the seven module scopes — 13 tabs mirroring
// `src/pages/SurveyModuleAdminPage.tsx`:
//   Generelt / Utseende / E-post / SMS / Integrasjoner — slices of the
//     `org_module_payloads.survey_settings` blob, via `useSurveyModuleSettings`
//   Spørsmålsbank / Maler / Arbeidsflyt — extracted from inline JSX
//   Kategorier / Pakker / Krav / Leverandører / Statistikk — thin
//     supabase-passthrough wrappers around existing
//     `modules/survey/admin/*Tab.tsx` exports

import { lazy } from 'react'
import {
  BarChart2,
  BookOpen,
  Building2,
  ClipboardList,
  FolderTree,
  GitBranch,
  Globe,
  Layers,
  LayoutGrid,
  Mail,
  Megaphone,
  Settings,
  ShieldCheck,
  Smartphone,
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
    searchKeywords: ['anonym', 'intro', 'svarprosent', 'terskel'],
    component: lazy(() => import('./SurveyScopeGenerelt')),
  },
  {
    id: 'utseende',
    label: 'Utseende',
    icon: LayoutGrid,
    capabilities: ['general'],
    searchKeywords: ['layout', 'velkomst', 'takkeside', 'logo', 'farge', 'branding'],
    component: lazy(() => import('./SurveyScopeUtseende')),
  },
  {
    id: 'epost',
    label: 'E-post',
    icon: Mail,
    capabilities: ['general'],
    searchKeywords: ['epost', 'invitasjon', 'påminnelse', 'reminder', 'subject'],
    component: lazy(() => import('./SurveyScopeEpost')),
  },
  {
    id: 'sms',
    label: 'SMS',
    icon: Smartphone,
    capabilities: ['integrations'],
    searchKeywords: ['sms', 'twilio', 'vonage', 'messagebird'],
    component: lazy(() => import('./SurveyScopeSms')),
  },
  {
    id: 'integrasjoner',
    label: 'Integrasjoner',
    icon: Globe,
    capabilities: ['integrations'],
    // Integrasjoner needs the narrower `survey.manage` only — the scope's
    // permAny is broader for visibility but this section actually writes.
    permAny: ['survey.manage'],
    searchKeywords: ['webhook', 'slack', 'api', 'integration'],
    component: lazy(() => import('./SurveyScopeIntegrasjoner')),
  },
  {
    id: 'sporsmalbank',
    label: 'Spørsmålsbank',
    icon: BookOpen,
    capabilities: ['general'],
    searchKeywords: ['spørsmål', 'bank', 'gjenbruk', 'question'],
    component: lazy(() => import('./SurveyScopeSporsmalbank')),
  },
  {
    id: 'maler',
    label: 'Maler',
    icon: ClipboardList,
    capabilities: ['templates', 'import-export'],
    searchKeywords: ['mal', 'undersøkelse', 'json', 'eksport', 'import'],
    component: lazy(() => import('./SurveyScopeMaler')),
  },
  {
    id: 'kategorier',
    label: 'Kategorier',
    icon: FolderTree,
    capabilities: ['categories'],
    searchKeywords: ['kategori'],
    component: lazy(() => import('./SurveyScopeKategorier')),
  },
  {
    id: 'pakker',
    label: 'Pakker',
    icon: Layers,
    capabilities: ['packs'],
    searchKeywords: ['pakke', 'pack'],
    component: lazy(() => import('./SurveyScopePakker')),
  },
  {
    id: 'krav',
    label: 'Krav',
    icon: ShieldCheck,
    capabilities: ['requirements'],
    searchKeywords: ['krav', 'compliance', 'lovkrav'],
    component: lazy(() => import('./SurveyScopeKrav')),
  },
  {
    id: 'leverandorer',
    label: 'Leverandører',
    icon: Building2,
    capabilities: ['general'],
    searchKeywords: ['leverandør', 'vendor', 'supplier'],
    component: lazy(() => import('./SurveyScopeLeverandorer')),
  },
  {
    id: 'arbeidsflyt',
    label: 'Arbeidsflyt',
    icon: GitBranch,
    capabilities: ['workflow'],
    searchKeywords: ['arbeidsflyt', 'workflow', 'epost', 'automatisering'],
    component: lazy(() => import('./SurveyScopeArbeidsflyt')),
  },
  {
    id: 'statistikk',
    label: 'Statistikk',
    icon: BarChart2,
    capabilities: ['statistics'],
    searchKeywords: ['statistikk', 'kpi', 'svar'],
    component: lazy(() => import('./SurveyScopeStatistikk')),
  },
]

registerSettingsScope({
  scopeId: 'survey',
  label: 'Undersøkelser',
  group: 'module',
  order: 60,
  icon: Megaphone,
  // Megaphone purple per CLAUDE.md "Accent palette".
  accent: '#7c3aed',
  // Mirrors SURVEY_NAV_PERMS in `AticsShell.tsx:383` — broad for menu
  // visibility. Sections that write narrow further (e.g. Integrasjoner).
  permAny: [
    'module.view.survey',
    'module.view.org_health',
    'module.view.hse',
    'module.view.dashboard',
    'survey.manage',
    'survey.results.view',
  ],
  sections,
})
