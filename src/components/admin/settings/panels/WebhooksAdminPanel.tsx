// Webhooks & API — modulvis oversikt.
//
// There is no org-wide webhook table yet — each module that emits
// webhooks (currently undersøkelser and arbeidsflyt) carries its own
// config in `org_module_payloads`. This panel inventories what exists
// so admins know where to manage each integration, and points at the
// per-module settings pages.

import { ArrowRight, Plug, Webhook } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModuleSectionCard } from '../../../module'
import { Button } from '../../../ui/Button'

const SOURCES: {
  icon: typeof Webhook
  label: string
  description: string
  to: string
  ctaLabel: string
}[] = [
  {
    icon: Webhook,
    label: 'Undersøkelser',
    description:
      'Webhook + Slack-varsling for hendelser i undersøkelsesmodulen (kampanje publisert, svar mottatt, kvote nådd).',
    to: '/admin/settings/survey',
    ctaLabel: 'Åpne undersøkelse-innstillinger',
  },
  {
    icon: Plug,
    label: 'Arbeidsflyt',
    description:
      'HTTP-aksjoner i workflow-regler kan POSTe til vilkårlig endepunkt; konfigureres per regel.',
    to: '/admin/settings/workflows/rules',
    ctaLabel: 'Åpne arbeidsflyt-regler',
  },
]

export default function WebhooksAdminPanel() {
  return (
    <div className="space-y-4">
      <ModuleSectionCard className="p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <Webhook className="size-5 text-[#1a3d32]" />
          Modulvise webhooks
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Webhook-konfigurasjon ligger inne i hver modul som emitterer hendelser. En
          organisasjons­omfattende relay-tabell er ikke ennå opprettet — bruk modul­siden under.
        </p>
        <ul className="mt-4 space-y-3">
          {SOURCES.map((s) => (
            <li key={s.label} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-neutral-200 p-4">
              <div className="flex items-start gap-3">
                <s.icon className="mt-0.5 size-4 text-neutral-500" />
                <div>
                  <p className="text-sm font-medium text-neutral-900">{s.label}</p>
                  <p className="mt-0.5 text-xs text-neutral-600">{s.description}</p>
                </div>
              </div>
              <Link to={s.to}>
                <Button variant="secondary" size="sm" icon={<ArrowRight className="size-3.5" />}>
                  {s.ctaLabel}
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5">
        <h2 className="text-lg font-semibold text-neutral-900">API-tokens</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Det finnes ingen egen API-token-tabell i denne versjonen. Eksterne integrasjoner som
          trenger tilgang gjøres i dag via Supabase service-nøkler eller signerte revisor-lenker
          (se Brukere & roller → Eksterne brukere → Revisorer).
        </p>
      </ModuleSectionCard>
    </div>
  )
}
