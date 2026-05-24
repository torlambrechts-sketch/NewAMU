// Loads integrations for the Integrasjoner section.
//
// Source: `org_integrations` (per-org connection rows) + a static
// catalogue of available providers. A provider that has no
// `org_integrations` row appears as `tilgjengelig`; one with `enabled =
// true` is `koblet`; one with `enabled = false` is `venter` (mid-setup).

import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  Briefcase,
  Building,
  Calculator,
  Calendar,
  Cloud,
  Key,
  Lock,
  MessageSquare,
  Plug,
  Send,
} from 'lucide-react'
import type { ElementType } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type { IntegrationSummary } from './types'

interface CatalogEntry {
  id: string
  kind: string | null
  name: string
  category: string
  description: string
  icon: ElementType
  authMethod: string
  dataFlow: string
  connector: string
  defaultScopes: string[]
}

const CATALOG: CatalogEntry[] = [
  {
    id: 'nav',
    kind: 'nav',
    name: 'NAV — Aa-register + sykmeldinger',
    category: 'Myndigheter',
    description:
      'Automatisk sync av ansatte fra Aa-registeret. Lese sykmeldinger og dialogmøteinvitasjoner.',
    icon: Building,
    authMethod: 'OAuth 2.0 + ID-porten',
    dataFlow: 'inn + ut',
    connector: 'Direkte',
    defaultScopes: ['aa.read', 'sykmelding.read', 'dialogmote.write'],
  },
  {
    id: 'bankid',
    kind: null,
    name: 'BankID',
    category: 'Identitet',
    description: 'Sikker signering av referat, lovpålagte dokumenter og personalavtaler.',
    icon: Lock,
    authMethod: 'OIDC',
    dataFlow: 'ut',
    connector: 'Signicat',
    defaultScopes: ['signature', 'auth'],
  },
  {
    id: 'altinn',
    kind: 'altinn',
    name: 'Altinn',
    category: 'Myndigheter',
    description: 'Innsending av lovpålagte rapporter til Arbeidstilsynet og SSB.',
    icon: Send,
    authMethod: 'Maskinporten',
    dataFlow: 'ut',
    connector: 'Direkte',
    defaultScopes: ['altinn.submit'],
  },
  {
    id: 'idporten',
    kind: null,
    name: 'ID-porten',
    category: 'Identitet',
    description: 'SSO-pålogging for ansatte og eksterne (verneombud, BHT, tillitsvalgte).',
    icon: Key,
    authMethod: 'OIDC',
    dataFlow: 'inn',
    connector: 'Direkte',
    defaultScopes: ['openid', 'profile'],
  },
  {
    id: 'entra',
    kind: null,
    name: 'Microsoft Entra ID (Azure AD)',
    category: 'Identitet',
    description: 'SSO + SCIM-provisionering av brukere og roller.',
    icon: Cloud,
    authMethod: 'SAML 2.0 + SCIM',
    dataFlow: 'inn + ut',
    connector: 'Direkte',
    defaultScopes: ['User.Read.All', 'Group.Read.All'],
  },
  {
    id: 'slack',
    kind: null,
    name: 'Slack',
    category: 'Kommunikasjon',
    description: 'Sender HMS-varsler og påminnelser til relevante kanaler.',
    icon: MessageSquare,
    authMethod: 'OAuth 2.0',
    dataFlow: 'ut',
    connector: 'Klarert App',
    defaultScopes: ['chat:write', 'channels:read'],
  },
  {
    id: 'teams',
    kind: null,
    name: 'Microsoft Teams',
    category: 'Kommunikasjon',
    description: 'Klar til oppsett — krever godkjenning fra Entra-admin.',
    icon: MessageSquare,
    authMethod: 'OAuth 2.0',
    dataFlow: 'ut',
    connector: 'Klarert App',
    defaultScopes: ['Chat.Write', 'TeamsAppInstallation.ReadForUser'],
  },
  {
    id: 'visma',
    kind: null,
    name: 'Visma HRM',
    category: 'HR',
    description: 'Synkronisering av ansatte, stillingsbeskrivelser og lønnsdata-flagg.',
    icon: Briefcase,
    authMethod: 'API key',
    dataFlow: 'inn',
    connector: 'Direkte',
    defaultScopes: ['employees.read'],
  },
  {
    id: 'simployer',
    kind: null,
    name: 'Simployer',
    category: 'HR',
    description: 'Importer kompetansebibliotek og oppslagsdata.',
    icon: BookOpen,
    authMethod: 'API key',
    dataFlow: 'inn',
    connector: 'Direkte',
    defaultScopes: [],
  },
  {
    id: 'google',
    kind: null,
    name: 'Google Workspace',
    category: 'Kalender',
    description: 'Synkroniser AMU-møter og kurs med ansattes kalender.',
    icon: Calendar,
    authMethod: 'OAuth 2.0',
    dataFlow: 'ut',
    connector: 'Direkte',
    defaultScopes: ['calendar.events'],
  },
  {
    id: 'outlook',
    kind: null,
    name: 'Microsoft 365 (Outlook)',
    category: 'Kalender',
    description: 'Møteinvitasjoner og kalendersynkronisering.',
    icon: Calendar,
    authMethod: 'OAuth 2.0',
    dataFlow: 'ut',
    connector: 'Direkte',
    defaultScopes: ['Calendars.ReadWrite'],
  },
  {
    id: 'tripletex',
    kind: null,
    name: 'Tripletex',
    category: 'Regnskap',
    description: 'Importer leverandører til leverandørregisteret.',
    icon: Calculator,
    authMethod: 'API key',
    dataFlow: 'inn',
    connector: 'Direkte',
    defaultScopes: [],
  },
  {
    id: 'webhook',
    kind: null,
    name: 'Webhooks (generisk)',
    category: 'Utviklere',
    description: 'Send Klarert-hendelser til egne systemer via HTTP.',
    icon: Plug,
    authMethod: 'API key (HMAC)',
    dataFlow: 'ut',
    connector: 'Direkte',
    defaultScopes: [],
  },
  {
    id: 'datatilsynet',
    kind: 'datatilsynet',
    name: 'Datatilsynet (brudd-melding)',
    category: 'Myndigheter',
    description: '72-timers innsending av personvernbrudd iht. GDPR Art. 33.',
    icon: Send,
    authMethod: 'Maskinporten',
    dataFlow: 'ut',
    connector: 'Direkte',
    defaultScopes: ['datatilsynet.submit'],
  },
  {
    id: 'arbeidstilsynet',
    kind: 'regint',
    name: 'Arbeidstilsynet (RegInc)',
    category: 'Myndigheter',
    description: 'Innsending av personskader og arbeidsrelaterte sykdommer.',
    icon: Send,
    authMethod: 'Maskinporten',
    dataFlow: 'ut',
    connector: 'Direkte',
    defaultScopes: ['arbeidstilsynet.submit'],
  },
]

interface OrgIntegrationRow {
  kind: string
  enabled: boolean
  last_submission_at: string | null
  last_submission_status: 'ok' | 'failed' | null
  last_health_status: 'ok' | 'degraded' | 'down' | null
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export interface AdminIntegrationsResult {
  integrations: IntegrationSummary[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useAdminIntegrations(): AdminIntegrationsResult {
  const { supabase, organization } = useOrgSetupContext()
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const orgRes = await supabase
        .from('org_integrations')
        .select('kind, enabled, last_submission_at, last_submission_status, last_health_status')
        .eq('organization_id', organization.id)
      const rows = (orgRes.error ? [] : (orgRes.data ?? [])) as OrgIntegrationRow[]
      const byKind = new Map<string, OrgIntegrationRow>()
      for (const r of rows) byKind.set(r.kind, r)

      const summaries: IntegrationSummary[] = CATALOG.map((c) => {
        const row = c.kind ? byKind.get(c.kind) : undefined
        let status: IntegrationSummary['status'] = 'tilgjengelig'
        if (row?.enabled) status = 'koblet'
        else if (row && !row.enabled) status = 'venter'
        return {
          id: c.id,
          name: c.name,
          category: c.category,
          description: c.description,
          icon: c.icon,
          status,
          dataFlow: c.dataFlow,
          authMethod: c.authMethod,
          lastSync: formatDate(row?.last_submission_at ?? null),
          connector: c.connector,
          scopes: c.defaultScopes,
        }
      })

      setIntegrations(summaries)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste integrasjoner')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { integrations, loading, error, refresh }
}
