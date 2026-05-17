import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
import { ModulePageIcon } from '../components/ModulePageIcon'
import { Button } from '../components/ui/Button'
import { StandardInput } from '../components/ui/Input'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { formatBrregAddress } from '../lib/brreg'
import type { BrregEnhet } from '../types/brreg'

const steps = [
  'Organisasjon (Brønnøysund)',
  'Ditt navn',
  'Avdelinger',
  'Team',
  'Lokasjoner',
  'Personer',
  'Fullfør',
] as const

export function OnboardingWizard() {
  const navigate = useNavigate()
  const {
    supabaseConfigured,
    loadState,
    error: bootError,
    organization,
    departments,
    teams,
    locations,
    members,
    createOrganizationFromBrreg,
    updateDisplayName,
    addDepartment,
    addTeam,
    addLocation,
    addOrgMember,
    completeOnboarding,
    fetchEnhetByOrgnr,
    normalizeOrgNumber,
    profile,
  } = useOrgSetupContext()

  const [step, setStep] = useState(0)
  const [orgnrInput, setOrgnrInput] = useState('')
  const [brregPreview, setBrregPreview] = useState<BrregEnhet | null>(null)
  const [brregErr, setBrregErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [deptName, setDeptName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [teamDeptId, setTeamDeptId] = useState<string>('')
  const [locName, setLocName] = useState('')
  const [locAddr, setLocAddr] = useState('')
  const [memName, setMemName] = useState('')
  const [memEmail, setMemEmail] = useState('')
  const [memDept, setMemDept] = useState('')
  const [memTeam, setMemTeam] = useState('')
  const [memLoc, setMemLoc] = useState('')

  if (!supabaseConfigured) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <h1 className="text-lg font-semibold">Supabase er ikke konfigurert</h1>
          <p className="mt-2 text-sm text-amber-900/90">
            Legg til <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> og{' '}
            <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code> i miljøvariabler og bygg på
            nytt. Se README for detaljer.
          </p>
        </div>
      </div>
    )
  }

  if (loadState === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-neutral-600">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        Kobler til…
      </div>
    )
  }

  const lookupBrreg = async () => {
    setBrregErr(null)
    setBrregPreview(null)
    setBusy(true)
    try {
      const e = await fetchEnhetByOrgnr(orgnrInput)
      setBrregPreview(e)
    } catch (err) {
      setBrregErr(err instanceof Error ? err.message : 'Oppslag feilet')
    } finally {
      setBusy(false)
    }
  }

  const saveOrg = async () => {
    setFormErr(null)
    setBusy(true)
    try {
      await createOrganizationFromBrreg(orgnrInput, brregPreview ?? undefined)
      setStep(1)
    } catch (err) {
      setFormErr(getSupabaseErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const saveDisplayName = async () => {
    if (!displayName.trim()) {
      setFormErr('Skriv inn navn.')
      return
    }
    setFormErr(null)
    setBusy(true)
    try {
      await updateDisplayName(displayName.trim())
      setStep(2)
    } catch (err) {
      setFormErr(getSupabaseErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const finish = async () => {
    setFormErr(null)
    setBusy(true)
    try {
      await completeOnboarding()
      navigate('/?setup=1', { replace: true })
    } catch (err) {
      setFormErr(getSupabaseErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center gap-4">
        <ModulePageIcon className="bg-[#1a3d32] text-white">
          <Building2 className="size-11 md:size-12" strokeWidth={1.35} aria-hidden />
        </ModulePageIcon>
        <div>
          <h1 className="font-serif text-2xl text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
            Oppsett av virksomhet
          </h1>
          <p className="text-sm text-neutral-600">
            Organisasjonsnummer fra Brønnøysundregistrene, deretter struktur og katalog (uten egen registrering —
            midlertidig anonym sesjon).
          </p>
        </div>
      </div>

      {bootError && loadState === 'error' ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{bootError}</p>
      ) : null}

      <ol className="mb-8 flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <li key={label}>
            <Button
              size="sm"
              variant={i === step ? 'primary' : 'secondary'}
              onClick={() => (i <= step ? setStep(i) : undefined)}
              disabled={i > step}
              aria-current={i === step ? 'step' : undefined}
              className={`rounded-full ${
                i < step ? 'border-emerald-200 bg-emerald-100 text-emerald-900 hover:bg-emerald-200' : ''
              }`}
            >
              {i + 1}. {label}
            </Button>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm">
        {step === 0 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-neutral-800">Organisasjonsnummer (9 siffer)</label>
            <div className="flex flex-wrap gap-2">
              <StandardInput
                inputMode="numeric"
                autoComplete="off"
                value={orgnrInput}
                onChange={(e) => setOrgnrInput(normalizeOrgNumber(e.target.value))}
                placeholder="123456789"
                className="min-w-[12rem] flex-1 rounded-lg"
              />
              <Button
                variant="primary"
                onClick={() => void lookupBrreg()}
                disabled={busy || normalizeOrgNumber(orgnrInput).length !== 9}
                icon={busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                className="rounded-lg"
              >
                Hent fra Brønnøysund
              </Button>
            </div>
            {brregErr ? <p className="text-sm text-red-600">{brregErr}</p> : null}
            {brregPreview ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-sm">
                <p className="font-semibold text-emerald-950">{brregPreview.navn}</p>
                <p className="mt-1 text-emerald-900/90">{formatBrregAddress(brregPreview)}</p>
                <p className="mt-1 text-xs text-emerald-800/80">
                  Org.nr. {brregPreview.organisasjonsnummer}
                  {brregPreview.organisasjonsform?.beskrivelse
                    ? ` · ${brregPreview.organisasjonsform.beskrivelse}`
                    : ''}
                </p>
              </div>
            ) : null}
            <Button
              variant="primary"
              onClick={() => void saveOrg()}
              disabled={busy || !brregPreview}
              icon={busy ? <Loader2 className="size-4 animate-spin" /> : undefined}
              className="rounded-lg bg-[#c9a227] text-neutral-900 hover:bg-[#b88f1f]"
            >
              Opprett og lagre i database
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {organization ? (
                <>
                  Du er koblet til <strong>{organization.name}</strong> ({organization.organization_number}).
                </>
              ) : null}
            </p>
            <label className="block text-sm font-medium text-neutral-800">Ditt visningsnavn</label>
            <StandardInput
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={profile?.display_name || 'Fornavn Etternavn'}
              className="rounded-lg"
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={back}
                icon={<ChevronLeft className="size-4" />}
                className="rounded-lg"
              >
                Tilbake
              </Button>
              <Button
                variant="primary"
                onClick={() => void saveDisplayName()}
                disabled={busy}
                className="rounded-lg"
              >
                Neste
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Avdelinger er valgfrie — du kan legge dem til nå eller senere. Du kan også hoppe over.
            </p>
            <ul className="space-y-1 text-sm">
              {departments.map((d) => (
                <li key={d.id} className="rounded border border-neutral-100 bg-neutral-50 px-2 py-1">
                  {d.name}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <StandardInput
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="Avdelingsnavn"
                className="min-w-0 flex-1 rounded-lg"
              />
              <Button
                variant="primary"
                onClick={() => {
                  void (async () => {
                    if (!deptName.trim()) return
                    setFormErr(null)
                    setBusy(true)
                    try {
                      await addDepartment(deptName)
                      setDeptName('')
                    } catch (err) {
                      setFormErr(getSupabaseErrorMessage(err))
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
                disabled={busy}
                className="shrink-0 rounded-lg bg-neutral-800 hover:bg-neutral-700"
              >
                Legg til
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={back} className="rounded-lg">
                Tilbake
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setFormErr(null)
                  next()
                }}
                className="rounded-lg"
              >
                Neste
              </Button>
            </div>
            {formErr && step === 2 ? <p className="text-sm text-red-600">{formErr}</p> : null}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Team er valgfrie — du kan legge dem til nå eller senere. Knytt gjerne til avdeling.
            </p>
            <ul className="space-y-1 text-sm">
              {teams.map((t) => (
                <li key={t.id} className="rounded border border-neutral-100 bg-neutral-50 px-2 py-1">
                  {t.name}
                  {t.department_id
                    ? ` · ${departments.find((d) => d.id === t.department_id)?.name ?? ''}`
                    : ''}
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-2">
              <StandardInput
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Teamnavn"
                className="rounded-lg"
              />
              <SearchableSelect
                value={teamDeptId}
                options={[
                  { value: '', label: 'Avdeling (valgfritt)' },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
                onChange={setTeamDeptId}
              />
            </div>
            <Button
              variant="primary"
              onClick={() => {
                void (async () => {
                  if (!teamName.trim()) return
                  setFormErr(null)
                  setBusy(true)
                  try {
                    await addTeam(teamName, teamDeptId || null)
                    setTeamName('')
                    setTeamDeptId('')
                  } catch (err) {
                    setFormErr(getSupabaseErrorMessage(err))
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
              disabled={busy}
              className="rounded-lg bg-neutral-800 hover:bg-neutral-700"
            >
              Legg til team
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={back} className="rounded-lg">
                Tilbake
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setFormErr(null)
                  next()
                }}
                className="rounded-lg"
              >
                Neste
              </Button>
            </div>
            {formErr && step === 3 ? <p className="text-sm text-red-600">{formErr}</p> : null}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Lokasjoner er valgfrie — du kan legge dem til nå eller senere.
            </p>
            <ul className="space-y-1 text-sm">
              {locations.map((l) => (
                <li key={l.id} className="rounded border border-neutral-100 bg-neutral-50 px-2 py-1">
                  {l.name}
                  {l.address ? ` — ${l.address}` : ''}
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-2">
              <StandardInput
                value={locName}
                onChange={(e) => setLocName(e.target.value)}
                placeholder="Lokasjonsnavn"
                className="rounded-lg"
              />
              <StandardInput
                value={locAddr}
                onChange={(e) => setLocAddr(e.target.value)}
                placeholder="Adresse (valgfritt)"
                className="rounded-lg"
              />
            </div>
            <Button
              variant="primary"
              onClick={() => {
                void (async () => {
                  if (!locName.trim()) return
                  setFormErr(null)
                  setBusy(true)
                  try {
                    await addLocation(locName, locAddr)
                    setLocName('')
                    setLocAddr('')
                  } catch (err) {
                    setFormErr(getSupabaseErrorMessage(err))
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
              disabled={busy}
              className="rounded-lg bg-neutral-800 hover:bg-neutral-700"
            >
              Legg til lokasjon
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={back} className="rounded-lg">
                Tilbake
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setFormErr(null)
                  next()
                }}
                className="rounded-lg"
              >
                Neste
              </Button>
            </div>
            {formErr && step === 4 ? <p className="text-sm text-red-600">{formErr}</p> : null}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Katalog over personer (ikke innlogging — kun struktur). Valgfritt; du kan hoppe over.
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {members.map((m) => (
                <li key={m.id} className="rounded border border-neutral-100 bg-neutral-50 px-2 py-1">
                  {m.display_name}
                  {m.email ? ` · ${m.email}` : ''}
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-2">
              <StandardInput
                value={memName}
                onChange={(e) => setMemName(e.target.value)}
                placeholder="Navn"
                className="rounded-lg"
              />
              <StandardInput
                value={memEmail}
                onChange={(e) => setMemEmail(e.target.value)}
                placeholder="E-post (valgfritt)"
                className="rounded-lg"
              />
              <SearchableSelect
                value={memDept}
                options={[
                  { value: '', label: 'Avdeling' },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
                onChange={setMemDept}
              />
              <SearchableSelect
                value={memTeam}
                options={[
                  { value: '', label: 'Team' },
                  ...teams.map((t) => ({ value: t.id, label: t.name })),
                ]}
                onChange={setMemTeam}
              />
              <div className="sm:col-span-2">
                <SearchableSelect
                  value={memLoc}
                  options={[
                    { value: '', label: 'Lokasjon' },
                    ...locations.map((l) => ({ value: l.id, label: l.name })),
                  ]}
                  onChange={setMemLoc}
                />
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                void (async () => {
                  if (!memName.trim()) return
                  setFormErr(null)
                  setBusy(true)
                  try {
                    await addOrgMember({
                      displayName: memName,
                      email: memEmail || undefined,
                      departmentId: memDept || null,
                      teamId: memTeam || null,
                      locationId: memLoc || null,
                    })
                    setMemName('')
                    setMemEmail('')
                    setMemDept('')
                    setMemTeam('')
                    setMemLoc('')
                  } catch (err) {
                    setFormErr(getSupabaseErrorMessage(err))
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
              disabled={busy}
              className="rounded-lg bg-neutral-800 hover:bg-neutral-700"
            >
              Legg til person
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={back} className="rounded-lg">
                Tilbake
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setFormErr(null)
                  next()
                }}
                className="rounded-lg"
              >
                Neste
              </Button>
            </div>
            {formErr && step === 5 ? <p className="text-sm text-red-600">{formErr}</p> : null}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4 text-center">
            <p className="text-neutral-700">
              Du har registrert <strong>{organization?.name}</strong>. Struktur (avdelinger, team, lokasjoner, katalog)
              kan du legge inn senere.
            </p>
            <p className="text-sm text-neutral-500">
              Du kan endre strukturen senere i en dedikert organisasjonsinnstilling (kommer).
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={back} className="rounded-lg">
                Tilbake
              </Button>
              <Button
                variant="primary"
                onClick={() => void finish()}
                disabled={busy}
                icon={busy ? <Loader2 className="size-4 animate-spin" /> : undefined}
                className="rounded-lg bg-[#c9a227] text-neutral-900 hover:bg-[#b88f1f]"
              >
                Gå til appen
              </Button>
            </div>
          </div>
        )}

        {formErr && step !== 2 && step !== 3 && step !== 4 && step !== 5 ? (
          <p className="mt-4 text-sm text-red-600">{formErr}</p>
        ) : null}
      </div>
    </div>
  )
}
