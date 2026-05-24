// Roller & tilganger-seksjonen.
// Viser alle role_definitions med tellinger (brukere + tillatelser),
// risikonivå, lovreferanser og en kort beskrivelse. Banner på toppen
// sammenligner aktive roller mot et anbefalt sett (admin, member,
// verneombud) som faktisk seedes av seed_default_roles_for_org.
//
// "Ny rolle"-knappen åpner en inline-form som skriver til
// role_definitions med slug+navn. Den fulle tillatelses-editoren
// ligger fortsatt i den eldre RolesAdminPanel — denne seksjonen
// fokuserer på oversikt + opprettelse.

import { useState } from 'react'
import { KeyRound, Loader2, Plus, ShieldCheck } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import {
  AdminCard,
  AdminError,
  AdminInfoBanner,
  AdminLoading,
} from './AdminShared'
import { slugify } from './format'
import { useAdminRoles } from './useAdminRoles'
import type { AdminSectionProps } from './types'

// Slugs seeded by seed_default_roles_for_org() at org-creation time.
// These are the baseline roles every org gets; anything beyond is
// admin-created.
const DEFAULT_SEEDED_SLUGS = ['admin', 'member', 'verneombud'] as const

// Lovpålagte funksjoner Klarert anbefaler — disse må fylles enten ved
// at en eksisterende rolle får tildelt ansvar eller ved at en ny
// rolle opprettes for funksjonen. Brukes til en mykere "anbefalt"
// banner i avansert modus, ikke en hard "mangler" beskjed.
const RECOMMENDED_FUNCTIONAL_SLUGS = [
  'daglig_leder',
  'hms_koordinator',
  'verneombud',
  'amu_medlem',
  'bht_kontakt',
  'dpo',
] as const


export function SecRoles({ easy }: AdminSectionProps) {
  const { supabase, organization, isAdmin } = useOrgSetupContext()
  const { roles, loading, error, refresh } = useAdminRoles()
  const [openCreate, setOpenCreate] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  if (loading) return <AdminLoading />

  const seeded = DEFAULT_SEEDED_SLUGS.filter((s) =>
    roles.some((r) => r.slug === s),
  )
  const missingSeeded = DEFAULT_SEEDED_SLUGS.filter(
    (s) => !roles.some((r) => r.slug === s),
  )
  const recommendedPresent = RECOMMENDED_FUNCTIONAL_SLUGS.filter((s) =>
    roles.some((r) => r.slug === s),
  )
  const recommendedMissing = RECOMMENDED_FUNCTIONAL_SLUGS.filter(
    (s) => !roles.some((r) => r.slug === s),
  )
  const seededOk = missingSeeded.length === 0
  const allRecommendedMet = recommendedMissing.length === 0

  async function submitCreate() {
    if (!supabase || !organization?.id) return
    const trimmedName = name.trim()
    const finalSlug = (slug.trim() || slugify(trimmedName)).toLowerCase()
    if (!trimmedName || !finalSlug) {
      setCreateErr('Navn og slug er påkrevd.')
      return
    }
    if (roles.some((r) => r.slug === finalSlug)) {
      // Pre-flight check before the DB rejects it. Faster + nicer
      // message than waiting for the (organization_id, slug) unique
      // constraint to fire.
      setCreateErr(
        `Slug «${finalSlug}» er allerede i bruk. Velg en annen slug eller endre navnet.`,
      )
      return
    }
    setBusy(true)
    setCreateErr(null)
    try {
      const { error: insErr } = await supabase.from('role_definitions').insert({
        organization_id: organization.id,
        slug: finalSlug,
        name: trimmedName,
        description: description.trim() || null,
        is_system: false,
      })
      if (insErr) {
        // Postgres 23505 = unique_violation — race condition when a
        // simultaneous admin created the same slug between our pre-
        // flight and the insert.
        const isUniqueViolation =
          (insErr as { code?: string }).code === '23505' ||
          /duplicate key/i.test(insErr.message)
        if (isUniqueViolation) {
          setCreateErr(
            `Slug «${finalSlug}» ble nettopp opprettet av en annen admin. Bruk en annen slug.`,
          )
          await refresh()
          return
        }
        throw insErr
      }
      setName('')
      setSlug('')
      setDescription('')
      setSlugTouched(false)
      setOpenCreate(false)
      await refresh()
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : 'Kunne ikke opprette rolle')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <AdminInfoBanner
        icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
        title={
          seededOk
            ? 'Standard-roller på plass'
            : `Mangler ${missingSeeded.length} standard ${missingSeeded.length === 1 ? 'rolle' : 'roller'}`
        }
        description={
          seededOk
            ? `Admin, Medlem og Verneombud er definert (${seeded.length}/${DEFAULT_SEEDED_SLUGS.length}). ${
                allRecommendedMet
                  ? 'Alle anbefalte lovpålagte funksjoner er også tildelt.'
                  : `Anbefalte lovpålagte funksjoner som mangler: ${recommendedMissing.join(', ')}.`
              }`
            : `Disse standard-rollene mangler i organisasjonen: ${missingSeeded.join(', ')}. Kjør seed_default_roles_for_org for å reparere.`
        }
      />

      {error ? <AdminError message={error} /> : null}

      <AdminCard>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Roller og tilganger</h3>
            <p className="text-[11px] text-neutral-500">
              {roles.length} roller definert ·{' '}
              {roles.reduce((a, r) => a + r.userCount, 0)} brukerrelasjoner ·{' '}
              {recommendedPresent.length}/{RECOMMENDED_FUNCTIONAL_SLUGS.length} anbefalte
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-3 w-3" />}
            onClick={() => setOpenCreate((v) => !v)}
            disabled={!isAdmin}
            title={isAdmin ? undefined : 'Krever administrator-tilgang'}
          >
            Ny rolle
          </Button>
        </div>

        {openCreate && (
          <div className="border-b border-neutral-100 bg-neutral-50/60 px-5 py-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="new-role-name"
                  className="text-[10px] font-bold uppercase tracking-wider text-neutral-500"
                >
                  Navn
                </label>
                <StandardInput
                  id="new-role-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (!slugTouched) setSlug(slugify(e.target.value))
                  }}
                  placeholder="f.eks. Verneombud — Bergen"
                  className="mt-1"
                />
              </div>
              <div>
                <label
                  htmlFor="new-role-slug"
                  className="text-[10px] font-bold uppercase tracking-wider text-neutral-500"
                >
                  Slug
                </label>
                <StandardInput
                  id="new-role-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(slugify(e.target.value))
                    setSlugTouched(true)
                  }}
                  placeholder="verneombud_bergen"
                  className="mt-1 font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="new-role-desc"
                  className="text-[10px] font-bold uppercase tracking-wider text-neutral-500"
                >
                  Beskrivelse (valgfritt)
                </label>
                <StandardInput
                  id="new-role-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Hva denne rollen dekker"
                  className="mt-1"
                />
              </div>
            </div>
            {createErr ? (
              <div className="mt-2">
                <AdminError message={createErr} />
              </div>
            ) : null}
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpenCreate(false)
                  setCreateErr(null)
                }}
              >
                Avbryt
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                disabled={busy || !name.trim()}
                onClick={() => void submitCreate()}
              >
                Opprett rolle
              </Button>
            </div>
          </div>
        )}

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
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      <span className="font-mono">{r.slug}</span> · {r.scope}
                    </div>
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
