// Integrasjoner-seksjonen.
// Henter status fra org_integrations + en statisk katalog av leverandører.
// Hver kategori (Myndigheter, Identitet, Kommunikasjon, HR, Kalender,
// Regnskap, Utviklere) blir et eget panel.
//
// "Frakobl" / "Koble til"-knappene gjør en upsert mot org_integrations
// for de leverandørene som har et `kind`. OAuth/SAML-leverandører
// (Slack, Teams, Google, Outlook, BankID, ID-porten, Entra) har
// `kind = null` og deeplinker til /admin/integrations/<id>-wizarden
// hvis den finnes, eller deaktiveres til en disabled-tilstand.

import { useState } from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Loader2,
  Plug,
  Settings,
} from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { AdminCard, AdminError, AdminInfoBanner, AdminLoading } from './AdminShared'
import { useAdminIntegrations } from './useAdminIntegrations'
import type { AdminSectionProps, IntegrationSummary } from './types'

const STATUS_META: Record<
  IntegrationSummary['status'],
  {
    badgeBg: string
    badgeFg: string
    label: string
    icon: typeof CheckCircle2
  }
> = {
  koblet: { badgeBg: 'bg-green-100', badgeFg: 'text-green-800', label: 'Koblet', icon: CheckCircle2 },
  venter: { badgeBg: 'bg-amber-100', badgeFg: 'text-amber-900', label: 'Venter', icon: Clock },
  tilgjengelig: {
    badgeBg: 'bg-neutral-100',
    badgeFg: 'text-neutral-700',
    label: 'Tilgjengelig',
    icon: Circle,
  },
}

export function SecIntegrations({ easy }: AdminSectionProps) {
  const { integrations, loading, error, setEnabled, refresh } = useAdminIntegrations()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)

  if (loading) return <AdminLoading />

  const grouped = integrations.reduce<Record<string, IntegrationSummary[]>>((acc, i) => {
    ;(acc[i.category] = acc[i.category] || []).push(i)
    return acc
  }, {})

  const connectedCount = integrations.filter((i) => i.status === 'koblet').length

  async function handleToggle(integration: IntegrationSummary, nextEnabled: boolean) {
    if (!integration.kind) {
      // OAuth/SAML — open wizard if one exists, otherwise inform user.
      if (integration.wizardPath) {
        window.location.assign(integration.wizardPath)
      } else {
        setActionErr(
          `${integration.name} må kobles via leverandørens eget OAuth-flow. Kontakt support for oppsett.`,
        )
      }
      return
    }
    setBusyId(integration.id)
    setActionErr(null)
    try {
      const err = await setEnabled(integration.kind, nextEnabled)
      if (err) setActionErr(err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <AdminInfoBanner
        icon={<Plug className="h-4 w-4" aria-hidden="true" />}
        title="Integrasjoner"
        description="Koble Klarert til myndighetstjenester, HR-systemer og kommunikasjonsverktøy. Alt loggføres for revisjon."
        right={
          <span className="text-[11px] text-neutral-600">
            {connectedCount}/{integrations.length} aktive
          </span>
        }
      />

      {error ? <AdminError message={error} /> : null}
      {actionErr ? <AdminError message={actionErr} /> : null}

      {Object.entries(grouped).map(([cat, items]) => (
        <section key={cat}>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
            {cat}
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((i) => (
              <IntegrationCard
                key={i.id}
                integration={i}
                easy={easy}
                busy={busyId === i.id}
                onToggle={(next) => handleToggle(i, next)}
                onConfigure={() => refresh()}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function IntegrationCard({
  integration: i,
  easy,
  busy,
  onToggle,
  onConfigure,
}: {
  integration: IntegrationSummary
  easy: boolean
  busy: boolean
  onToggle: (nextEnabled: boolean) => void
  onConfigure: () => void
}) {
  const meta = STATUS_META[i.status]
  const Icon = i.icon
  const StatusIcon = meta.icon

  return (
    <AdminCard className="flex flex-col p-4 transition-colors hover:border-[#1a3d32]/40">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#fbf9f3] text-[#1a3d32]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-neutral-900">{i.name}</h3>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${meta.badgeBg} ${meta.badgeFg}`}
            >
              <StatusIcon className="h-2.5 w-2.5" aria-hidden="true" /> {meta.label}
            </span>
          </div>
          {!easy && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-neutral-600">
              {i.description}
            </p>
          )}
        </div>
      </div>
      {!easy && (
        <div className="mt-3 grid grid-cols-2 gap-1 text-[10px]">
          <div className="rounded border border-neutral-200 bg-neutral-50/60 px-1.5 py-1">
            <span className="text-neutral-500">Auth:</span>{' '}
            <span className="text-neutral-800">{i.authMethod}</span>
          </div>
          <div className="rounded border border-neutral-200 bg-neutral-50/60 px-1.5 py-1">
            <span className="text-neutral-500">Data:</span>{' '}
            <span className="text-neutral-800">{i.dataFlow}</span>
          </div>
          {i.lastSync && (
            <div className="col-span-2 rounded border border-neutral-200 bg-neutral-50/60 px-1.5 py-1">
              <span className="text-neutral-500">Sist sync:</span>{' '}
              <span className="tabular-nums text-neutral-800">{i.lastSync}</span>
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-neutral-100 pt-2.5">
        {i.status === 'koblet' ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onToggle(false)}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Frakobl
            </Button>
            {i.wizardPath ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<Settings className="h-3 w-3" />}
                onClick={() => {
                  window.location.assign(i.wizardPath!)
                  onConfigure()
                }}
              >
                Konfig
              </Button>
            ) : null}
          </>
        ) : i.status === 'venter' ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onToggle(false)}
            >
              Avbryt
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              icon={
                busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ExternalLink className="h-3 w-3" />
                )
              }
              onClick={() => onToggle(true)}
            >
              Fullfør oppsett
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            icon={busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />}
            onClick={() => onToggle(true)}
          >
            Koble til
          </Button>
        )}
      </div>
    </AdminCard>
  )
}
