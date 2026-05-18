// PakkerTab — manage compliance packs: edit display fields and toggle activation.
//
// Shows two sections:
//   1. Active packs — packs with is_active=true. Editable display fields + Deaktiver.
//   2. Available packs — dormant packs (is_active=false). Activate to provision
//      system templates and categories via the DB trigger.
//
// activatePack / deactivatePack go through usePacks which sets is_active in DB;
// the compliance_pack_provision_on_change trigger fires on activation and seeds
// all baseline templates + categories for the pack automatically.

import { useState } from 'react'
import { CheckCircle2, Layers, Leaf, Lock, Settings, Shield, Star, Globe2, PlusCircle } from 'lucide-react'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { usePacks } from '../usePacks'
import { PackEditorPanel } from './PackEditorPanel'
import type { CompliancePack } from '../../../src/lib/compliance/packs'
import type { CompliancePackSlug } from '../types'

const PACK_ICON: Record<CompliancePackSlug, typeof Shield> = {
  'aml-amu':   Shield,
  'iso-45001': Globe2,
  'iso-9001':  Star,
  'iso-14001': Leaf,
  'iso-27001': Lock,
}

const PACK_DESCRIPTION: Record<CompliancePackSlug, string> = {
  'aml-amu':   'Vernerunder og internkontroll etter arbeidsmiljøloven og IK-forskriften.',
  'iso-45001': 'Internrevisjoner for arbeidsmiljøstyringssystem — ISO 45001:2018.',
  'iso-9001':  'Internrevisjoner for kvalitetsstyringssystem — ISO 9001:2015.',
  'iso-14001': 'Internrevisjoner for miljøstyringssystem — ISO 14001:2015.',
  'iso-27001': 'Internrevisjoner for informasjonssikkerhetsstyringssystem — ISO 27001:2022.',
}

export function PakkerTab() {
  const { supabase } = useOrgSetupContext()
  const { packs, loading, activatePack, deactivatePack } = usePacks({
    supabase,
    includeInactive: true,
  })
  const [editing, setEditing] = useState<CompliancePack | null>(null)
  const [confirming, setConfirming] = useState<CompliancePack | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const activePacks   = packs.filter((p) => p.isActive)
  const inactivePacks = packs.filter((p) => !p.isActive)

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3500)
  }

  const handleActivate = async (slug: CompliancePackSlug) => {
    setActivating(slug)
    await activatePack(slug)
    setActivating(null)
    showSuccess('Pakken er aktivert. Maler og krav er nå tilgjengelige.')
  }

  const handleDeactivate = async (slug: CompliancePackSlug) => {
    setActivating(slug)
    await deactivatePack(slug)
    setActivating(null)
    setConfirming(null)
    showSuccess('Pakken er deaktivert og skjult fra compliance-hubben.')
  }

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}
      {/* ── Active packs ── */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Aktive pakker</h2>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Tilpass terminologi, KPI-merker, alvorlighetsetiketter og lovreferanser.
          Deaktivering skjuler pakken fra hubben — eksisterende sjekklister beholdes.
        </p>

        {loading ? (
          <p className="mt-5 text-sm text-neutral-500">Laster pakker…</p>
        ) : activePacks.length === 0 ? (
          <p className="mt-5 text-sm text-neutral-500">Ingen aktive pakker.</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {activePacks.map((p) => {
              const Icon = PACK_ICON[p.slug as CompliancePackSlug] ?? Layers
              return (
                <li
                  key={p.slug}
                  className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#1a3d32]" aria-hidden />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-neutral-900">{p.shortName}</span>
                          <Badge variant="success">Aktiv</Badge>
                          <Badge variant="info">{p.pluralLabel}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">
                          <span className="font-mono">{p.slug}</span>
                          <span className="mx-1.5">·</span>
                          <span>{p.legalReferences.length} bannerreferanser</span>
                          <span className="mx-1.5">·</span>
                          <span>posisjon {p.position}</span>
                        </p>
                        <p className="mt-2 text-sm text-neutral-700">{p.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Settings className="h-3.5 w-3.5" />}
                        onClick={() => setEditing(p)}
                      >
                        Rediger
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirming(p)}
                        disabled={activating === p.slug}
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

      {/* ── Available (inactive) packs ── */}
      {inactivePacks.length > 0 && (
        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-neutral-400" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">Tilgjengelige pakker</h2>
          </div>
          <p className="mt-1.5 text-sm text-neutral-600">
            Aktiver en pakke for å få tilgang til systemmalene og kategoriene for
            det valgte regelverket. Maler og krav provisjoneres automatisk ved aktivering.
          </p>

          <ul className="mt-5 space-y-3">
            {inactivePacks.map((p) => {
              const Icon = PACK_ICON[p.slug as CompliancePackSlug] ?? Layers
              const desc = PACK_DESCRIPTION[p.slug as CompliancePackSlug] ?? p.description
              return (
                <li
                  key={p.slug}
                  className="rounded-lg border border-dashed border-neutral-300 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-neutral-700">{p.shortName}</span>
                          <Badge variant="neutral">Ikke aktivert</Badge>
                        </div>
                        <p className="mt-1 text-xs text-neutral-400 font-mono">{p.slug}</p>
                        <p className="mt-2 text-sm text-neutral-600">{desc}</p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<PlusCircle className="h-3.5 w-3.5" />}
                      onClick={() => handleActivate(p.slug as CompliancePackSlug)}
                      disabled={activating === p.slug}
                    >
                      {activating === p.slug ? 'Aktiverer…' : 'Aktiver'}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </ModuleSectionCard>
      )}

      {/* ── Deactivate confirmation dialog ── */}
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="mx-4 w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-neutral-900">
              Deaktiver {confirming.shortName}?
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Pakken vil ikke lenger vises i compliance-hubben eller pakke&shy;velgeren.
              Eksisterende sjekklister og signaturer beholdes og er fortsatt tilgjengelige
              via "Alle sjekklister". Du kan reaktivere pakken når som helst.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                Avbryt
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDeactivate(confirming.slug as CompliancePackSlug)}
                disabled={activating === confirming.slug}
              >
                {activating === confirming.slug ? 'Deaktiverer…' : 'Deaktiver pakke'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <PackEditorPanel
          pack={editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}
