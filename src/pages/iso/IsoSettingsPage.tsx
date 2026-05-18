// ISO IMS settings — toggle active standards for this organisation.
//
// Activating a standard here calls activatePack() as a side-effect (Model C
// shortcut from the plan), so the compliance hub and pack switcher pick up
// the new pack automatically without the admin visiting Innstillinger → Pakker.
//
// The page also shows current certification targets (read-only in Phase 1;
// editable in Phase 2 when the certification workflow ships).

import { useState } from 'react'
import { CheckCircle2, Globe2, Leaf, Lock, Settings, Shield, Star } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { useIsoSettings } from '../../hooks/useIsoSettings'
import type { IsoStandard } from '../../types/iso'
import { ISO_STANDARDS, ISO_STANDARD_LABELS, ISO_STANDARD_SHORT } from '../../types/iso'

const STANDARD_ICON: Record<IsoStandard, typeof Shield> = {
  'iso-9001':  Star,
  'iso-14001': Leaf,
  'iso-45001': Globe2,
  'iso-27001': Lock,
}

const STANDARD_DESCRIPTION: Record<IsoStandard, string> = {
  'iso-9001':  'Kvalitetsstyringssystem — prosesser, kundetilfredshet, kontinuerlig forbedring.',
  'iso-14001': 'Miljøstyringssystem — miljøaspekter, rettslige forpliktelser, klimamål.',
  'iso-45001': 'Arbeidsmiljøstyringssystem — HIRA, vernerunder, hendelseshåndtering.',
  'iso-27001': 'Informasjonssikkerhetsstyring — risikovurdering, SoA, 93 Annex A-kontroller.',
}

export function IsoSettingsPage() {
  const { loading, error, isStandardActive, toggleStandard } = useIsoSettings()
  const [toggling, setToggling] = useState<IsoStandard | null>(null)
  const [confirming, setConfirming] = useState<IsoStandard | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  const handleActivate = async (standard: IsoStandard) => {
    setToggling(standard)
    await toggleStandard(standard, true)
    setToggling(null)
    showSuccess(`${ISO_STANDARD_SHORT[standard]} er aktivert. Gap-analyse og sjekklister er nå tilgjengelige.`)
  }

  const handleDeactivate = async (standard: IsoStandard) => {
    setToggling(standard)
    await toggleStandard(standard, false)
    setToggling(null)
    setConfirming(null)
    showSuccess(`${ISO_STANDARD_SHORT[standard]} er deaktivert.`)
  }

  const activeStandards = ISO_STANDARDS.filter(isStandardActive)
  const inactiveStandards = ISO_STANDARDS.filter((s) => !isStandardActive(s))

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'ISO IMS', to: '/iso/analyse' },
        { label: 'Innstillinger' },
      ]}
      title="ISO IMS — Innstillinger"
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* ── Active standards ── */}
        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#3730a3]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">Aktive standarder</h2>
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            Aktive standarder er synlige i compliance-hubben og gap-analyseverktøyet.
            Deaktivering skjuler pakken fra hubben — eksisterende revisjoner beholdes.
          </p>

          {loading ? (
            <p className="mt-5 text-sm text-neutral-500">Laster innstillinger…</p>
          ) : activeStandards.length === 0 ? (
            <p className="mt-5 text-sm text-neutral-500">Ingen aktive standarder ennå.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {activeStandards.map((standard) => {
                const Icon = STANDARD_ICON[standard]
                return (
                  <li
                    key={standard}
                    className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#3730a3]" aria-hidden />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-neutral-900">
                              {ISO_STANDARD_SHORT[standard]}
                            </span>
                            <Badge variant="success">Aktiv</Badge>
                          </div>
                          <p className="mt-1 text-xs text-neutral-400 font-mono">{standard}</p>
                          <p className="mt-2 text-sm text-neutral-700">
                            {STANDARD_DESCRIPTION[standard]}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Settings className="h-3.5 w-3.5" />}
                          disabled
                          title="Kommer i neste versjon"
                        >
                          Sertifiseringsmål
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirming(standard)}
                          disabled={toggling === standard}
                          className="text-neutral-500 hover:text-red-600"
                        >
                          Deaktiver
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ModuleSectionCard>

        {/* ── Available standards ── */}
        {inactiveStandards.length > 0 && (
          <ModuleSectionCard className="p-5 md:p-6">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-neutral-400" aria-hidden />
              <h2 className="text-lg font-semibold text-neutral-900">Tilgjengelige standarder</h2>
            </div>
            <p className="mt-1.5 text-sm text-neutral-600">
              Aktiver en standard for å få tilgang til revisjonsprotokollene og
              gap-analyseverktøyet for det aktuelle regelverket. Maler provisjoneres
              automatisk ved aktivering.
            </p>

            <ul className="mt-5 space-y-3">
              {inactiveStandards.map((standard) => {
                const Icon = STANDARD_ICON[standard]
                return (
                  <li
                    key={standard}
                    className="rounded-lg border border-dashed border-neutral-300 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-neutral-700">
                              {ISO_STANDARD_LABELS[standard]}
                            </span>
                            <Badge variant="neutral">Ikke aktivert</Badge>
                          </div>
                          <p className="mt-1 text-xs text-neutral-400 font-mono">{standard}</p>
                          <p className="mt-2 text-sm text-neutral-600">
                            {STANDARD_DESCRIPTION[standard]}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleActivate(standard)}
                        disabled={toggling === standard}
                      >
                        {toggling === standard ? 'Aktiverer…' : 'Aktiver'}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </ModuleSectionCard>
        )}
      </div>

      {/* ── Deactivation confirmation ── */}
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="mx-4 w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-neutral-900">
              Deaktiver {ISO_STANDARD_SHORT[confirming]}?
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Standarden vil ikke lenger vises i compliance-hubben, gap-analyseverktøyet
              eller pakke­velgeren. Eksisterende revisjoner og signaturer beholdes og er
              fortsatt tilgjengelige via «Alle sjekklister». Du kan reaktivere standarden
              når som helst.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                Avbryt
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeactivate(confirming)}
                disabled={toggling === confirming}
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                {toggling === confirming ? 'Deaktiverer…' : 'Deaktiver standard'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ModulePageShell>
  )
}
