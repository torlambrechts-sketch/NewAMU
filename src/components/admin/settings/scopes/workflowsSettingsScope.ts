// Arbeidsflyt settings scope.
//
// Promotes the workflow module to a first-class admin section. The
// composer/run engine still lives at `/workflow` (no refactor of the
// runtime in this restructure); the `regler` section deep-links there
// so admins arriving via /admin/settings/workflows still land on a
// working UI. The remaining sections are placeholders that phase 3
// fills in with the run history view and templates library.

import { BarChart3, FileStack, History, Lock, ScrollText, Workflow } from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../../../lib/settings/settingsRegistry'
import { placeholderSection } from '../placeholderSection'

const sections: SettingsSection[] = [
  {
    id: 'analyse',
    label: 'Analyse',
    icon: BarChart3,
    capabilities: ['statistics'],
    searchKeywords: ['analyse', 'workflow kpi', 'success rate', 'sla'],
    component: placeholderSection(
      'Arbeidsflyt-analyse',
      'KPI-er for arbeidsflyt: antall kjøringer, suksess­rate, gjennomsnittlig responstid og SLA-brudd.',
      'Kobles på workflow-modulens eksisterende widget-scope i fase 3.',
    ),
  },
  {
    id: 'rules',
    label: 'Regler',
    icon: ScrollText,
    capabilities: ['workflow'],
    searchKeywords: ['regel', 'rule', 'composer', 'triggers', 'aksjon'],
    permAny: ['workflows.manage', 'workflows.compose'],
    component: placeholderSection(
      'Regelkomponist',
      'Bygg utløsere, betingelser og handlinger for arbeidsflyten i organisasjonen.',
      'Bruk /workflow i mellomtiden; lenken under Arbeidsflyt → Regler i sidemenyen tar deg dit.',
    ),
  },
  {
    id: 'runs',
    label: 'Kjøringer',
    icon: History,
    capabilities: ['general'],
    searchKeywords: ['kjøring', 'run', 'logg', 'historikk', 'retry'],
    permAny: ['workflows.manage', 'module.view.workflow'],
    component: placeholderSection(
      'Kjøringshistorikk',
      'Liste over alle workflow-kjøringer med status, retry og feilsøkings­logg.',
      'Eksisterende kjøringsside flyttes hit i fase 3.',
    ),
  },
  {
    id: 'templates',
    label: 'Maler',
    icon: FileStack,
    capabilities: ['templates'],
    searchKeywords: ['mal', 'workflow template', 'biblioteket'],
    permAny: ['workflows.manage'],
    component: placeholderSection(
      'Workflow-maler',
      'Forhåndsdefinerte arbeidsflyter som administratorer kan ta i bruk i ett klikk.',
      'Bibliotek med pakker (varsling, ROS-eskalering, AT-melding) leveres i fase 3.',
    ),
  },
  {
    id: 'auditors',
    label: 'Auditor-tilganger',
    icon: Lock,
    capabilities: ['general'],
    searchKeywords: ['auditor', 'revisor', 'token', 'signert lenke'],
    permAny: ['workflows.manage'],
    component: placeholderSection(
      'Auditor-tilganger',
      'Signerte lenker som gir revisorer lese­tilgang til utvalgte kjøringer.',
      'Forvaltes via /admin/settings/users-roles/external (revisor-fanen). Denne siden lenker dit i fase 3.',
    ),
  },
]

registerSettingsScope({
  scopeId: 'workflows',
  label: 'Arbeidsflyt',
  group: 'org',
  order: 30,
  icon: Workflow,
  permAny: ['workflows.manage', 'module.view.workflow', 'module.view.admin'],
  sections,
})
