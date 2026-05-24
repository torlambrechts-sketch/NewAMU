// Organisasjon-seksjonen.
// Header card med basisdata om virksomheten + lovpålagte krav,
// fulgt av tabell over lokasjoner og en panel for avdelinger.

import { MapPin, Pencil, Plus, ShieldCheck, Users } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import {
  ADMIN_SERIF,
  ADMIN_TABLE_TH,
  ADMIN_TABLE_TR_BODY,
  AdminCard,
  AdminLoading,
  ComplianceCheck,
} from './AdminShared'
import type { AdminSectionProps } from './types'

export function SecOrg({ easy }: AdminSectionProps) {
  const { organization, locations, departments, members, loadState } = useOrgSetupContext()

  if (loadState !== 'ready' || !organization) {
    return <AdminLoading />
  }

  const memberCount = members.length
  const employees = Math.max(memberCount, 0)
  const orgNr = formatOrgNr(organization.organization_number)
  const brreg = (organization.brreg_snapshot ?? {}) as Record<string, unknown>
  const naceCode = (brreg.naeringskode1 as Record<string, unknown> | undefined)?.kode as
    | string
    | undefined
  const naceDescription = (brreg.naeringskode1 as Record<string, unknown> | undefined)
    ?.beskrivelse as string | undefined
  const nace =
    typeof naceCode === 'string' && typeof naceDescription === 'string'
      ? `${naceCode} ${naceDescription}`
      : '—'
  const contactEmail = organization.varsling_contact_email ?? '—'
  const hq = locations[0]?.name ?? 'Hovedkontor ikke registrert'

  const amuRequired = employees >= 30
  const bhtRequired = true
  const ikRequired = true
  const dpoAppointed = members.some((m) => /personvern|dpo/i.test(m.display_name))

  return (
    <div className="space-y-4">
      {/* Hovedkort */}
      <AdminCard className="p-5">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#1a3d32] text-xl font-bold text-white"
            style={{ fontFamily: ADMIN_SERIF }}
            aria-hidden="true"
          >
            {organization.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2
              className="text-xl font-bold tracking-tight text-neutral-900"
              style={{ fontFamily: ADMIN_SERIF }}
            >
              {organization.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
              <span>
                Org.nr <span className="font-mono tabular-nums text-neutral-900">{orgNr}</span>
              </span>
              <span className="text-neutral-300">·</span>
              <span>{nace}</span>
              <span className="text-neutral-300">·</span>
              <span>{employees} ansatte</span>
              <span className="text-neutral-300">·</span>
              <span>{contactEmail}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              <span>{hq}</span>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={<Pencil className="h-3 w-3" />}>
            Rediger
          </Button>
        </div>

        {!easy && (
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <ComplianceCheck
              label="AMU lovpålagt"
              met={amuRequired}
              note={amuRequired ? '> 30 ansatte' : 'Frivillig — < 30 ansatte'}
            />
            <ComplianceCheck label="BHT-avtale" met={bhtRequired} note="AML § 3-3" />
            <ComplianceCheck label="Internkontroll" met={ikRequired} note="IK § 5" />
            <ComplianceCheck label="GDPR-DPO" met={dpoAppointed} note="GDPR Art. 37" />
          </div>
        )}
      </AdminCard>

      {/* Lokasjoner */}
      <AdminCard>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Lokasjoner</h3>
            <p className="text-[11px] text-neutral-500">
              {locations.length} steder
              {locations.length > 0
                ? ` · ${employees} ansatte fordelt`
                : ' — legg til hovedkontor og avdelinger'}
            </p>
          </div>
          <Button variant="secondary" size="sm" icon={<Plus className="h-3 w-3" />}>
            Ny lokasjon
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50/60">
              <tr>
                <th className={ADMIN_TABLE_TH}>Lokasjon</th>
                <th className={ADMIN_TABLE_TH}>Adresse</th>
                <th className={ADMIN_TABLE_TH}>Ansatte</th>
                <th className={ADMIN_TABLE_TH}>AMU-krav</th>
                <th className={`${ADMIN_TABLE_TH} text-right`} />
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-xs text-neutral-500">
                    Ingen lokasjoner enda — legg til hovedkontor for å komme i gang.
                  </td>
                </tr>
              ) : (
                locations.map((l) => {
                  const locMembers = members.filter((m) => m.location_id === l.id).length
                  const isMandatory = locMembers >= 30 || /hoved|lager|hall/i.test(l.name)
                  return (
                    <tr key={l.id} className={ADMIN_TABLE_TR_BODY}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
                          <span className="font-medium text-neutral-900">{l.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[11px] text-neutral-600">
                        {l.address ?? '—'}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-neutral-700">{locMembers}</td>
                      <td className="px-5 py-3">
                        {isMandatory ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]">
                            <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" /> Lovpålagt AMU
                          </span>
                        ) : (
                          <span className="text-[11px] text-neutral-500">Ikke krav</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-neutral-300" aria-hidden="true">
                        ›
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* Avdelinger */}
      {!easy && (
        <AdminCard>
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Avdelinger</h3>
              <p className="text-[11px] text-neutral-500">
                {departments.length} avdelinger · brukes for rapportering og tilgang
              </p>
            </div>
            <Button variant="secondary" size="sm" icon={<Plus className="h-3 w-3" />}>
              Ny avdeling
            </Button>
          </div>
          <ul className="divide-y divide-neutral-100">
            {departments.length === 0 ? (
              <li className="px-5 py-6 text-center text-xs text-neutral-500">
                Ingen avdelinger enda.
              </li>
            ) : (
              departments.map((d) => {
                const depMembers = members.filter((m) => m.department_id === d.id).length
                return (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                    <Users className="h-3.5 w-3.5 text-neutral-500" aria-hidden="true" />
                    <span className="flex-1 text-sm text-neutral-900">{d.name}</span>
                    <span className="text-[11px] tabular-nums text-neutral-500">
                      {depMembers} ansatte
                    </span>
                  </li>
                )
              })
            )}
          </ul>
        </AdminCard>
      )}
    </div>
  )
}

function formatOrgNr(raw: string): string {
  const clean = (raw || '').replace(/\s/g, '')
  if (clean.length !== 9) return raw
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`
}
