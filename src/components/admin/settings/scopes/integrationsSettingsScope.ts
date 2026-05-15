// Integrasjoner settings scope.
//
// Consolidates every "connect to an external system" surface that was
// previously split across `IntegrationsAdminPanel` (provider integrations
// like BankID, Eco-Online, Lovdata, Feide) and the standalone
// `GovIntegrationsPage` (government endpoints: Altinn, Arbeidstilsynet,
// Datatilsynet, NAV). Webhooks & API tokens get their own section so the
// "where do I add a webhook?" question has one answer.

import { lazy } from 'react'
import { Landmark, Plug, ShieldCheck, Webhook } from 'lucide-react'
import {
  registerSettingsScope,
  type SettingsSection,
} from '../../../../lib/settings/settingsRegistry'
import { placeholderSection } from '../placeholderSection'

const sections: SettingsSection[] = [
  {
    id: 'providers',
    label: 'Tilkoblede tjenester',
    icon: Plug,
    capabilities: ['integrations'],
    searchKeywords: ['integrasjon', 'bankid', 'eco-online', 'lovdata', 'feide', 'minid'],
    component: lazy(() =>
      import('../../../../pages/admin/IntegrationsAdminPanel').then((m) => ({
        default: m.IntegrationsAdminPanel,
      })),
    ),
  },
  {
    id: 'gov',
    label: 'Statlige integrasjoner',
    icon: Landmark,
    capabilities: ['integrations'],
    searchKeywords: ['altinn', 'arbeidstilsynet', 'datatilsynet', 'nav', 'stat'],
    component: lazy(() =>
      import('../../../../pages/admin/integrations/GovIntegrationsPage').then((m) => ({
        default: m.GovIntegrationsPage,
      })),
    ),
  },
  {
    id: 'webhooks',
    label: 'Webhooks & API',
    icon: Webhook,
    capabilities: ['integrations'],
    searchKeywords: ['webhook', 'api', 'token', 'callback'],
    permAny: ['roles.manage', 'workflows.manage'],
    component: placeholderSection(
      'Webhooks og API-tokens',
      'Organisasjonsomfattende webhooks og API-tilganger til eksterne systemer.',
      'Egen tabell og innstillingsside leveres i fase 3. Modulinterne webhooks (Survey, Workflow) ligger fortsatt under sin modul.',
    ),
  },
]

registerSettingsScope({
  scopeId: 'integrations',
  label: 'Integrasjoner',
  group: 'org',
  order: 20,
  icon: ShieldCheck,
  permAny: ['module.view.admin', 'workflows.manage'],
  sections,
})
