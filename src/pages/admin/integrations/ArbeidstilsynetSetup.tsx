// ArbeidstilsynetSetup — admin wizard for Arbeidstilsynet RegInc
// (alvorlig-skade-melding etter AML § 5-2, 24-timers frist).
//
// Inherits Maskinporten + virksomhetssertifikat from Altinn — we only ask
// for the RegInc-specific config (skjema-tilgjengelighet i sandbox,
// melder-rolle default). If Altinn isn't configured yet, we surface a
// blocker with deep-link.
//
// Steps:
//   1. Forstå — AML § 5-2 forklaring + 24-timers frist
//   2. Altinn-status (advarsel hvis ikke aktivert; ellers OK)
//   3. Sandbox vs Produksjon
//   4. Kontakt-info (melder_rolle default + arbeidsgiver-orgnr)
//   5. Test forbindelsen — dry-run mot gov-arbeidstilsynet-rapport

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileWarning, Loader2, ShieldCheck, Upload } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../../components/module'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../../components/ui/SearchableSelect'
import { InfoBox, WarningBox } from '../../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { useOrgIntegrations } from '../../../hooks/useOrgIntegrations'
import { WizardStepper, type WizardStep } from './WizardStepper'
import { runGovDryRun, type DryRunResult } from './govDryRun'

const STEPS: WizardStep[] = [
  { id: 'intro', label: '1. Forstå' },
  { id: 'altinn', label: '2. Altinn-status' },
  { id: 'env', label: '3. Miljø' },
  { id: 'contact', label: '4. Kontakt-info' },
  { id: 'test', label: '5. Test' },
]

const MELDER_ROLE_OPTIONS: SelectOption[] = [
  { value: 'arbeidsgiver', label: 'Arbeidsgiver' },
  { value: 'verneombud', label: 'Verneombud' },
  { value: 'lege', label: 'Behandlende lege' },
]

export function ArbeidstilsynetSetup() {
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()
  const { rows, loading, upsert, refresh } = useOrgIntegrations(['altinn', 'regint'])
  const altinnRow = rows.altinn
  const row = rows.regint

  const [stepIndex, setStepIndex] = useState(0)
  const [environment, setEnvironment] = useState<'tt02' | 'prod'>(row?.environment ?? 'tt02')
  const [clientId, setClientId] = useState<string>(
    typeof row?.config?.client_id === 'string' ? (row.config.client_id as string) : '',
  )
  const [melderRolle, setMelderRolle] = useState<string>(
    typeof row?.config?.default_melder_rolle === 'string'
      ? (row.config.default_melder_rolle as string)
      : 'arbeidsgiver',
  )
  const [arbeidsgiverOrgnr, setArbeidsgiverOrgnr] = useState<string>(
    typeof row?.config?.arbeidsgiver_orgnr === 'string'
      ? (row.config.arbeidsgiver_orgnr as string)
      : '',
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!row) return
    setEnvironment(row.environment ?? 'tt02')
    if (typeof row.config?.client_id === 'string') setClientId(row.config.client_id as string)
    if (typeof row.config?.default_melder_rolle === 'string')
      setMelderRolle(row.config.default_melder_rolle as string)
    if (typeof row.config?.arbeidsgiver_orgnr === 'string')
      setArbeidsgiverOrgnr(row.config.arbeidsgiver_orgnr as string)
  }, [row])

  const altinnReady = Boolean(altinnRow?.enabled && altinnRow?.vault_secret_name)

  const persistConfig = async (overrides?: { enabled?: boolean }) => {
    setSaving(true)
    setSaveError(null)
    try {
      await upsert({
        kind: 'regint',
        environment,
        enabled: overrides?.enabled ?? row?.enabled ?? false,
        config: {
          client_id: clientId,
          default_melder_rolle: melderRolle,
          arbeidsgiver_orgnr: arbeidsgiverOrgnr,
        },
      })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Kunne ikke lagre konfigurasjon')
      throw err
    } finally {
      setSaving(false)
    }
  }

  const runTest = async () => {
    if (!supabase || !organization?.id) return
    setTesting(true)
    setDryRun(null)
    try {
      await persistConfig()
      const res = await runGovDryRun(supabase, 'regint', organization.id)
      setDryRun(res)
      if (res.ok) {
        await upsert({ kind: 'regint', enabled: true, environment })
        await refresh()
      }
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Admin', to: '/admin' },
          { label: 'Integrasjoner', to: '/admin/integrations' },
          { label: 'Arbeidstilsynet' },
        ]}
        title="Arbeidstilsynet RegInc-oppsett"
        loading
      >
        <div />
      </ModulePageShell>
    )
  }

  const stepNode = (() => {
    switch (STEPS[stepIndex]?.id) {
      case 'intro':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">
              RegInc — alvorlig skade-melding (AML § 5-2)
            </h2>
            <p className="text-sm text-neutral-700">
              Du gir NewAMU lov til å sende inn alvorlig skade-melding til Arbeidstilsynets{' '}
              <strong>Register for Inntekt (RegInc)</strong> på vegne av din virksomhet. Plikten
              følger av <strong>Arbeidsmiljøloven § 5-2</strong>: arbeidsgiver skal varsle
              snarest og innen 24 timer etter alvorlig skade eller dødsfall.
            </p>
            <InfoBox>
              Workflow-regelen <code>rapporter_alvorlig_skade_arbeidstilsynet</code> håndterer
              fristen automatisk og setter <code>sen_innmelding</code> hvis innsendingen passerer
              24-timers vinduet. Du må <strong>aldri</strong> skjule en hendelse fordi
              fristen er passert — Arbeidstilsynet vil heller ha den seint enn aldri.
            </InfoBox>
            <div className="rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
              <p className="font-medium text-neutral-700">Hjemmel</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>AML § 5-2 — varsling om alvorlig skade og dødsfall</li>
                <li>Forskrift om organisering, ledelse og medvirkning § 11-2</li>
              </ul>
            </div>
          </ModuleSectionCard>
        )
      case 'altinn':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Altinn-tilgang</h2>
            <p className="text-sm text-neutral-700">
              RegInc-meldingen signeres med samme virksomhetssertifikat som Altinn-integrasjonen
              din. Du må derfor sette opp Altinn først.
            </p>
            {altinnReady ? (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-medium">Altinn er konfigurert ({altinnRow?.environment.toUpperCase()})</p>
                  <p className="text-xs">
                    Virksomhetssertifikatet i Vault gjenbrukes automatisk for RegInc.
                  </p>
                </div>
              </div>
            ) : (
              <WarningBox>
                Altinn-integrasjonen er ikke aktiv. RegInc kan ikke signere meldinger uten
                Maskinporten-tilgang.{' '}
                <Link to="/admin/integrations/altinn" className="font-medium underline">
                  Sett opp Altinn først ▸
                </Link>
              </WarningBox>
            )}
          </ModuleSectionCard>
        )
      case 'env':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Sandbox vs Produksjon</h2>
            <p className="text-sm text-neutral-700">
              Vi anbefaler å teste mot RegInc-sandboxen først (TT02). Når dry-run i steg 5 er
              grønn, kan du bytte til produksjon.
            </p>
            <WarningBox>
              <strong>Per-skjema sandbox-tilgjengelighet:</strong> Arbeidstilsynet eksponerer ikke
              alle innsendings-skjemaer i TT02. Hvis dry-run feiler med{' '}
              <code>arbeidstilsynet_unreachable</code> i sandbox, betyr det vanligvis at det
              aktuelle skjemaet kun finnes i produksjon. Konsulter{' '}
              <a
                href="https://www.arbeidstilsynet.no/skjema-og-tjenester/"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                Arbeidstilsynet utviklerdokumentasjon
              </a>{' '}
              for siste status.
            </WarningBox>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 hover:border-neutral-300">
                <input
                  type="radio"
                  name="env"
                  value="tt02"
                  checked={environment === 'tt02'}
                  onChange={() => setEnvironment('tt02')}
                  className="mt-1"
                />
                <div className="text-sm">
                  <p className="font-medium text-neutral-900">TT02 sandbox (anbefalt for første gang)</p>
                  <p className="text-xs text-neutral-600">
                    Arbeidstilsynet test-endpoint. Ingen reell saksbehandling.
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 hover:border-neutral-300">
                <input
                  type="radio"
                  name="env"
                  value="prod"
                  checked={environment === 'prod'}
                  onChange={() => setEnvironment('prod')}
                  className="mt-1"
                />
                <div className="text-sm">
                  <p className="font-medium text-neutral-900">Produksjon</p>
                  <p className="text-xs text-neutral-600">
                    Reell innsending til Arbeidstilsynet. Meldinger får saksnummer.
                  </p>
                </div>
              </label>
            </div>
          </ModuleSectionCard>
        )
      case 'contact':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Kontakt-info og standardverdier</h2>
            <p className="text-sm text-neutral-700">
              Disse feltene fylles inn automatisk når en regel utløser en RegInc-melding.
              Brukeren som godkjenner meldingen kan overstyre dem før innsending.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-neutral-700">
                Standard melder-rolle
                <SearchableSelect
                  value={melderRolle}
                  options={MELDER_ROLE_OPTIONS}
                  onChange={(v) => setMelderRolle(v)}
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Arbeidsgiver-orgnummer
                <StandardInput
                  value={arbeidsgiverOrgnr}
                  onChange={(e) => setArbeidsgiverOrgnr(e.target.value)}
                  placeholder="9 siffer"
                  className="mt-1.5 font-mono"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700 sm:col-span-2">
                Maskinporten Klient-ID (RegInc-scope)
                <StandardInput
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Egen klient hos Digdir hvis ikke samme som Altinn"
                  className="mt-1.5 font-mono"
                />
                <span className="mt-1 block text-[11px] text-neutral-500">
                  Scope: <code>arbeidstilsynet:reginc/melding.write</code>
                </span>
              </label>
            </div>
            {saveError && <WarningBox>{saveError}</WarningBox>}
          </ModuleSectionCard>
        )
      case 'test':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Test forbindelsen</h2>
            <p className="text-sm text-neutral-700">
              Vi sender en tom dry-run-melding til <code>gov-arbeidstilsynet-rapport</code> for å
              verifisere at Maskinporten-flyten henger sammen. Ingen melding når
              Arbeidstilsynet.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => void runTest()}
                disabled={testing || !altinnReady}
                icon={testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              >
                {testing ? 'Tester …' : 'Kjør dry-run'}
              </Button>
              {!altinnReady && (
                <span className="text-xs text-amber-700">Krever aktiv Altinn-integrasjon.</span>
              )}
              {environment === 'tt02' && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-900">
                  TT02 sandbox
                </span>
              )}
            </div>
            {dryRun && dryRun.ok && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-medium">Test bestått — integrasjonen er aktivert.</p>
                  <p className="text-xs">
                    Modus: <code>{dryRun.mode}</code>. Status:{' '}
                    <strong>{environment === 'tt02' ? 'test' : 'aktiv'}</strong>.
                  </p>
                </div>
              </div>
            )}
            {dryRun && !dryRun.ok && (
              <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900">
                <AlertCircle className="mt-0.5 h-4 w-4 text-rose-600" />
                <div>
                  <p className="font-medium">Test feilet — {dryRun.error}</p>
                  {dryRun.detail && <p className="mt-0.5 text-xs">{dryRun.detail}</p>}
                </div>
              </div>
            )}
          </ModuleSectionCard>
        )
      default:
        return null
    }
  })()

  const canAdvance = (() => {
    switch (STEPS[stepIndex]?.id) {
      case 'intro':
        return true
      case 'altinn':
        return altinnReady
      case 'env':
        return true
      case 'contact':
        return arbeidsgiverOrgnr.trim().length === 9
      case 'test':
        return dryRun?.ok === true
      default:
        return false
    }
  })()

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Admin', to: '/admin' },
        { label: 'Integrasjoner', to: '/admin/integrations' },
        { label: 'Arbeidstilsynet' },
      ]}
      title="Arbeidstilsynet RegInc-oppsett"
      description="Konfigurer innsending av alvorlig skade-melding etter AML § 5-2 (24-timers frist)."
      headerActions={
        row?.enabled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">
            <CheckCircle2 className="h-3 w-3" /> Konfigurert — {row.environment.toUpperCase()}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
            <FileWarning className="h-3 w-3" /> Ikke aktivert
          </span>
        )
      }
    >
      <div className="space-y-4">
        <ModuleSectionCard className="space-y-3 p-4">
          <WizardStepper steps={STEPS} activeIndex={stepIndex} onSelect={setStepIndex} />
          <p className="text-xs text-neutral-600">Steg {stepIndex + 1} av {STEPS.length}</p>
        </ModuleSectionCard>

        {stepNode}

        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Forrige
          </Button>
          {stepIndex < STEPS.length - 1 ? (
            <Button
              variant="primary"
              disabled={!canAdvance || saving}
              onClick={async () => {
                if (STEPS[stepIndex]?.id === 'env' || STEPS[stepIndex]?.id === 'contact') {
                  try {
                    await persistConfig()
                  } catch {
                    return
                  }
                }
                setStepIndex((s) => Math.min(STEPS.length - 1, s + 1))
              }}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Neste
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!canAdvance}
              onClick={() => void navigate('/admin/integrations/arbeidstilsynet')}
              icon={<ShieldCheck className="h-4 w-4" />}
            >
              Ferdig
            </Button>
          )}
        </div>

        <div className="text-center">
          <Link to="/admin/integrations" className="text-xs text-neutral-500 hover:text-neutral-700">
            ← Velg en annen integrasjon
          </Link>
        </div>
      </div>
    </ModulePageShell>
  )
}

export default ArbeidstilsynetSetup
