// Roller & tilganger-seksjonen.
// Viser alle role_definitions med tellinger (brukere + tillatelser),
// risikonivå, lovreferanser og en kort beskrivelse. Banner på toppen
// bekrefter at lovpålagte roller er på plass.

import { KeyRound, Plus, ShieldCheck } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import {
  AdminCard,
  AdminError,
  AdminInfoBanner,
  AdminLoading,
} from './AdminShared'
import { useAdminRoles } from './useAdminRoles'
import type { AdminSectionProps } from './types'

const REQUIRED_SLUGS = ['dl', 'hmsleder', 'hvo', 'vo', 'amu', 'bht', 'dpo']

export function SecRoles({ easy }: AdminSectionProps) {
  const { roles, loading, error } = useAdminRoles()

  if (loading) return <AdminLoading />

  const required = REQUIRED_SLUGS.filter((slug) =>
    roles.some((r) => r.slug === slug && r.userCount > 0),
  )
  const missing = REQUIRED_SLUGS.filter(
    (slug) => !roles.some((r) => r.slug === slug && r.userCount > 0),
  )
  const allRequiredMet = missing.length === 0

  return (
    <div className="space-y-4">
      <AdminInfoBanner
        icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
        title={
          allRequiredMet
            ? 'Lovpålagte roller — alle på plass'
            : `Mangler ${missing.length} lovpålagte ${missing.length === 1 ? 'rolle' : 'roller'}`
        }
        description={
          allRequiredMet
            ? `Daglig leder, HMS-leder, hovedverneombud, verneombud, AMU-medlemmer, BHT og DPO er besatt (${required.length}/${REQUIRED_SLUGS.length}). Tilsyn fra Arbeidstilsynet vil verifisere disse.`
            : `Disse rollene mangler tildeling: ${missing.join(', ')}. Tildel ansvar slik at lovpålagte HMS-funksjoner er dekket.`
        }
      />

      {error ? <AdminError message={error} /> : null}

      <AdminCard>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Roller og tilganger</h3>
            <p className="text-[11px] text-neutral-500">
              {roles.length} roller definert · {roles.reduce((a, r) => a + r.userCount, 0)} brukerrelasjoner
            </p>
          </div>
          <Button variant="primary" size="sm" icon={<Plus className="h-3 w-3" />}>
            Ny rolle
          </Button>
        </div>
        <ul className="divide-y divide-neutral-100">
          {roles.length === 0 ? (
            <li className="px-5 py-6 text-center text-xs text-neutral-500">
              Ingen roller er definert.
            </li>
          ) : (
            roles.map((r) => (
              <li key={r.id} className="px-5 py-3 hover:bg-neutral-50/60">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#fbf9f3] text-[#1a3d32]">
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-semibold text-neutral-900">{r.name}</span>
                      {r.lawRefs.map((l) => (
                        <span
                          key={l}
                          className="rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]"
                        >
                          {l}
                        </span>
                      ))}
                      {r.isSystem && (
                        <span className="rounded bg-[#1a3d32] px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          System
                        </span>
                      )}
                      <span className="ml-auto text-[10px] tabular-nums text-neutral-500">
                        {r.userCount} {r.userCount === 1 ? 'bruker' : 'brukere'} · {r.permissionCount} tillatelser
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">{r.scope}</div>
                    {!easy && r.description ? (
                      <p className="mt-1 text-[12px] text-neutral-600">{r.description}</p>
                    ) : null}
                  </div>
                  <span
                    className={
                      'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ' +
                      (r.riskLevel === 'høy'
                        ? 'bg-red-100 text-red-800'
                        : r.riskLevel === 'middels'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-neutral-100 text-neutral-600')
                    }
                  >
                    {r.riskLevel} risiko
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </AdminCard>
    </div>
  )
}
