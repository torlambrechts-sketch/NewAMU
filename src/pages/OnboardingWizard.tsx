import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
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
      setFormErr(err instanceof Error ? err.message : 'Kunne ikke opprette organisasjon')
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
      setFormErr(err instanceof Error ? err.message : 'Kunne ikke lagre')
    } finally {
      setBusy(false)
    }
  }

  const finish = async () => {
    setFormErr(null)
    setBusy(true)
    try {
      await completeOnboarding()
      navigate('/', { replace: true })
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Kunne ikke fullføre')
    } finally {
      setBusy(false)
    }
  }

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-[#1a3d32] text-white">
          <Building2 className="size-7" aria-hidden />
        </div>
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
            <button
              type="button"
              onClick={() => (i <= step ? setStep(i) : undefined)}
              disabled={i > step}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                i === step
                  ? 'bg-[#1a3d32] text-white'
                  : i < step
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm">
        {step === 0 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-neutral-800">Organisasjonsnummer (9 siffer)</label>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={orgnrInput}
                onChange={(e) => setOrgnrInput(normalizeOrgNumber(e.target.value))}
                placeholder="123456789"
                className="min-w-[12rem] flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void lookupBrreg()}
                disabled={busy || normalizeOrgNumber(orgnrInput).length !== 9}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Hent fra Brønnøysund
              </button>
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
            <button
              type="button"
              onClick={() => void saveOrg()}
              disabled={busy || !brregPreview}
              className="inline-flex items-center gap-2 rounded-lg bg-[#c9a227] px-4 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Opprett og lagre i database
            </button>
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
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={profile?.display_name || 'Fornavn Etternavn'}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={back} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm">
                <ChevronLeft className="mr-1 inline size-4" />
                Tilbake
              </button>
              <button
                type="button"
                onClick={() => void saveDisplayName()}
                disabled={busy}
                className="rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Neste
                <ChevronRight className="ml-1 inline size-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">Legg til minst én avdeling (du kan legge til flere senere).</p>
            <ul className="space-y-1 text-sm">
              {departments.map((d) => (
                <li key={d.id} className="rounded border border-neutral-100 bg-neutral-50 px-2 py-1">
                  {d.name}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="Avdelingsnavn"
                className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    if (!deptName.trim()) return
                    setBusy(true)
                    try {
                      await addDepartment(deptName)
                      setDeptName('')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
                className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white"
              >
                Legg til
              </button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={back} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm">
                Tilbake
              </button>
              <button
                type="button"
                onClick={() => (departments.length ? next() : setFormErr('Legg til minst én avdeling.'))}
                className="rounded-lg bg-[#1a3d32] px-4 py-2 text-sm text-white"
              >
                Neste
              </button>
            </div>
            {formErr && step === 2 ? <p className="text-sm text-red-600">{formErr}</p> : null}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">Team kan knyttes til en avdeling (valgfritt).</p>
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
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Teamnavn"
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <select
                value={teamDeptId}
                onChange={(e) => setTeamDeptId(e.target.value)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">Avdeling (valgfritt)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  if (!teamName.trim()) return
                  setBusy(true)
                  try {
                    await addTeam(teamName, teamDeptId || null)
                    setTeamName('')
                    setTeamDeptId('')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white"
            >
              Legg til team
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={back} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm">
                Tilbake
              </button>
              <button type="button" onClick={next} className="rounded-lg bg-[#1a3d32] px-4 py-2 text-sm text-white">
                Neste
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">Arbeidssteder / lokasjoner.</p>
            <ul className="space-y-1 text-sm">
              {locations.map((l) => (
                <li key={l.id} className="rounded border border-neutral-100 bg-neutral-50 px-2 py-1">
                  {l.name}
                  {l.address ? ` — ${l.address}` : ''}
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={locName}
                onChange={(e) => setLocName(e.target.value)}
                placeholder="Lokasjonsnavn"
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <input
                value={locAddr}
                onChange={(e) => setLocAddr(e.target.value)}
                placeholder="Adresse (valgfritt)"
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  if (!locName.trim()) return
                  setBusy(true)
                  try {
                    await addLocation(locName, locAddr)
                    setLocName('')
                    setLocAddr('')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white"
            >
              Legg til lokasjon
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={back} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm">
                Tilbake
              </button>
              <button
                type="button"
                onClick={() => (locations.length ? next() : setFormErr('Legg til minst én lokasjon.'))}
                className="rounded-lg bg-[#1a3d32] px-4 py-2 text-sm text-white"
              >
                Neste
              </button>
            </div>
            {formErr && step === 4 ? <p className="text-sm text-red-600">{formErr}</p> : null}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Katalog over personer (ikke innlogging — kun struktur). Minst én rad.
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
              <input
                value={memName}
                onChange={(e) => setMemName(e.target.value)}
                placeholder="Navn"
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <input
                value={memEmail}
                onChange={(e) => setMemEmail(e.target.value)}
                placeholder="E-post (valgfritt)"
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <select
                value={memDept}
                onChange={(e) => setMemDept(e.target.value)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">Avdeling</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                value={memTeam}
                onChange={(e) => setMemTeam(e.target.value)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">Team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                value={memLoc}
                onChange={(e) => setMemLoc(e.target.value)}
                className="sm:col-span-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">Lokasjon</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  if (!memName.trim()) return
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
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white"
            >
              Legg til person
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={back} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm">
                Tilbake
              </button>
              <button
                type="button"
                onClick={() => (members.length ? next() : setFormErr('Legg til minst én person.'))}
                className="rounded-lg bg-[#1a3d32] px-4 py-2 text-sm text-white"
              >
                Neste
              </button>
            </div>
            {formErr && step === 5 ? <p className="text-sm text-red-600">{formErr}</p> : null}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4 text-center">
            <p className="text-neutral-700">
              Du har registrert <strong>{organization?.name}</strong> med avdelinger, team, lokasjoner og katalog.
            </p>
            <p className="text-sm text-neutral-500">
              Du kan endre strukturen senere i en dedikert organisasjonsinnstilling (kommer).
            </p>
            <div className="flex justify-center gap-2">
              <button type="button" onClick={back} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm">
                Tilbake
              </button>
              <button
                type="button"
                onClick={() => void finish()}
                disabled={busy}
                className="rounded-lg bg-[#c9a227] px-6 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50"
              >
                {busy ? <Loader2 className="inline size-4 animate-spin" /> : null} Gå til appen
              </button>
            </div>
          </div>
        )}

        {formErr && step !== 2 && step !== 4 && step !== 5 ? (
          <p className="mt-4 text-sm text-red-600">{formErr}</p>
        ) : null}
      </div>
    </div>
  )
}
