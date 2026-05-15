// Organisasjon settings scope.
//
// Surfaces the company entity: profile, structure, and people. Most
// sections deep-link to existing tabs in `src/pages/OrganisationPage.tsx`
// (tab IDs: insights/employees/units/groups/mandates/gdpr/settings).
// Phase-1 sections are placeholders that render under the unified shell;
// the real surfaces still live on the OrganisationPage and are reached
// via the sidebar nav until a later phase inlines them here.

import { Building2, ClipboardList, Network, Shield, UserSquare, Users } from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../../../lib/settings/settingsRegistry'
import { placeholderSection } from '../placeholderSection'

const sections: SettingsSection[] = [
  {
    id: 'analyse',
    label: 'Analyse',
    icon: ClipboardList,
    capabilities: ['statistics'],
    searchKeywords: ['analyse', 'oversikt', 'kpi', 'headcount'],
    component: placeholderSection(
      'Organisasjonsanalyse',
      'Nøkkeltall for selskapsstruktur: headcount, fordeling per avdeling og endringer over tid.',
      'Kommer i en senere fase. Bruk Oversikt → HMS for et helhetlig bilde i mellomtiden.',
    ),
  },
  {
    id: 'company',
    label: 'Selskap',
    icon: Building2,
    capabilities: ['general'],
    searchKeywords: ['selskap', 'profil', 'orgnr', 'brreg', 'merkevare', 'branding'],
    component: placeholderSection(
      'Selskapsprofil',
      'Selskapsnavn, organisasjonsnummer, Brreg-snapshot, merkevare og lokasjoner.',
      'Redigeres foreløpig fra Organisasjonssiden (/organisation?tab=settings).',
    ),
  },
  {
    id: 'units',
    label: 'Avdelinger & enheter',
    icon: Network,
    capabilities: ['categories'],
    searchKeywords: ['avdeling', 'enhet', 'team', 'lokasjon', 'department'],
    component: placeholderSection(
      'Avdelinger, team og lokasjoner',
      'Strukturoppsett for organisasjonen – brukes av modulene for tilgangsstyring og rapportering.',
      'Redigeres foreløpig fra Organisasjonssiden (/organisation?tab=units).',
    ),
  },
  {
    id: 'employees',
    label: 'Ansatte',
    icon: Users,
    capabilities: ['general'],
    searchKeywords: ['ansatte', 'medarbeider', 'employee', 'personalliste'],
    component: placeholderSection(
      'Ansatte',
      'Ansattregister med kontaktinfo, ansettelsestype og rolletildeling.',
      'Redigeres foreløpig fra Organisasjonssiden (/organisation?tab=employees).',
    ),
  },
  {
    id: 'mandates',
    label: 'Mandater & verv',
    icon: UserSquare,
    capabilities: ['general'],
    searchKeywords: ['mandat', 'verv', 'styre', 'amu', 'governance'],
    component: placeholderSection(
      'Mandater og verv',
      'AMU, styreverv og governance-mandater knyttet til ansatte og avdelinger.',
      'Redigeres foreløpig fra Organisasjonssiden (/organisation?tab=mandates).',
    ),
  },
]

registerSettingsScope({
  scopeId: 'organisation',
  label: 'Organisasjon',
  group: 'org',
  order: 0,
  icon: Shield,
  // Org admins and anyone authorised to manage user / org-level data.
  permAny: ['module.view.admin', 'users.manage', 'employee.manage'],
  sections,
})
