// GovIntegrationsPage — "Velg integrasjon" hub.
//
// The original combined page lived here and let an admin configure all
// four regulators (Altinn / Arbeidstilsynet RegInc / Datatilsynet / NAV)
// from one screen. Spec §6 wants one focused wizard per provider, so the
// real configuration UI now lives at
// `/admin/integrations/<altinn|arbeidstilsynet|datatilsynet|nav>`.
//
// This page is a thin index that:
//   * lists the four providers with current status (loaded via
//     useOrgIntegrations)
//   * deep-links into the matching wizard
//   * carries a deprecation note for users who bookmarked the old combined
//     route `/admin/integrasjoner-staten` — they still land here, then pick
//     the regulator they want.

import { Link } from 'react-router-dom'
import { CheckCircle2, FileWarning, ShieldCheck } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../../components/module'
import { Button } from '../../../components/ui/Button'
import { InfoBox } from '../../../components/ui/AlertBox'
import { useOrgIntegrations, type GovIntegrationKind, type OrgIntegrationRow } from '../../../hooks/useOrgIntegrations'

type ProviderMeta = {
  kind: GovIntegrationKind
  title: string
  description: string
  path: string
  lawRef: string
  dependency?: 'altinn'
}

const PROVIDERS: ProviderMeta[] = [
  {
    kind: 'altinn',
    title: 'Altinn 3 / Maskinporten',
    description:
      'Generisk Altinn-envelope for melding-innsending. Forutsetning for NAV, Datatilsynet og Arbeidstilsynet.',
    path: '/admin/integrations/altinn',
    lawRef: 'eForvaltningsforskriften § 8',
  },
  {
    kind: 'regint',
    title: 'Arbeidstilsynet (RegInc)',
    description: 'Alvorlig skade-melding — 24-timers frist fra hendelsen.',
    path: '/admin/integrations/arbeidstilsynet',
    lawRef: 'AML § 5-2',
    dependency: 'altinn',
  },
  {
    kind: 'datatilsynet',
    title: 'Datatilsynet',
    description: 'Personvernbrudd-melding — 72-timers frist fra du ble kjent.',
    path: '/admin/integrations/datatilsynet',
    lawRef: 'GDPR Art. 33',
    dependency: 'altinn',
  },
  {
    kind: 'nav',
    title: 'NAV (DSOP)',
    description: 'Sykefraværsoppfølging via Altinn DSOP. Bruker samme cert som Altinn.',
    path: '/admin/integrations/nav',
    lawRef: 'AML § 4-6, Folketrygdloven § 8-7',
    dependency: 'altinn',
  },
]

function StatusBadge({ row }: { row: OrgIntegrationRow | null }) {
  if (row?.enabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">
        <CheckCircle2 className="h-3 w-3" /> Konfigurert ✓ {row.environment.toUpperCase()}
      </span>
    )
  }
  if (row) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
        Lagret, ikke aktivert
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
      <FileWarning className="h-3 w-3" /> Ikke konfigurert
    </span>
  )
}

export function GovIntegrationsPage() {
  const { rows, loading } = useOrgIntegrations()

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Admin', to: '/admin' },
        { label: 'Integrasjoner' },
      ]}
      title="Velg integrasjon"
      description="Per-leverandør-veivisere har erstattet det gamle samlede skjermbildet. Velg en regulator under for å starte oppsettet."
      loading={loading}
    >
      <div className="space-y-4">
        <InfoBox>
          Dette skjermbildet har erstattet den gamle kombinerte siden
          (<code>/admin/integrasjoner-staten</code>). Hver leverandør har nå sin egen veiviser
          for å unngå at en feil i én integrasjon påvirker oppsett av en annen.
        </InfoBox>

        <div className="grid gap-3">
          {PROVIDERS.map((p) => {
            const row = rows[p.kind]
            const altinnActive = Boolean(rows.altinn?.enabled)
            const blockedByAltinn = Boolean(p.dependency === 'altinn' && !altinnActive)
            return (
              <ModuleSectionCard key={p.kind} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
                      <ShieldCheck className="h-4 w-4 text-[#1a3d32]" /> {p.title}
                    </h2>
                    <p className="mt-0.5 text-sm text-neutral-700">{p.description}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500">Hjemmel: {p.lawRef}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge row={row} />
                  </div>
                </div>
                {blockedByAltinn && (
                  <p className="text-xs text-amber-800">
                    Krever aktiv Altinn-integrasjon — wizarden veileder deg dit hvis nødvendig.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Link to={p.path}>
                    <Button variant="primary" size="sm">
                      {row?.enabled ? 'Endre oppsett' : 'Start oppsett'}
                    </Button>
                  </Link>
                  {row?.last_submission_at && (
                    <span className="self-center text-[11px] text-neutral-500">
                      Sist innsending: {new Date(row.last_submission_at).toLocaleString('nb-NO')} ·{' '}
                      {row.last_submission_status ?? '—'}
                    </span>
                  )}
                </div>
              </ModuleSectionCard>
            )
          })}
        </div>
      </div>
    </ModulePageShell>
  )
}

export default GovIntegrationsPage
