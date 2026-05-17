// NavSetup — admin wizard for NAV sykefraværsoppfølging via Altinn DSOP.
// NAV har ingen egen Maskinporten-klient i denne integrasjonen — det er
// Altinn-tilgangen som gjør jobben (DSOP = Dialog Sykefraværsoppfølging
// kjører over Altinn 3-skjemaer "nav-sykefravar-*").
//
// Hvis Altinn ikke er aktivt, blokker oppsettet med deep-link.
// Workflow: AML § 4-6 + Folketrygdloven § 8-7 / § 25-2.
//
// Steps:
//   1. Forstå — AML § 4-6 + Folketrygdloven, DSOP-skjemaer per uke
//   2. Altinn-avhengighet — blokker hvis ikke aktivert
//   3. Sandbox/Produksjon
//   4. Dialog-mottaker (default arbeidsgiver-orgnr + responsible-user)
//   5. Test forbindelsen — dry-run mot gov-nav-sykefravar

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
  { id: 'altinn', label: '2. Altinn-tilgang' },
  { id: 'env', label: '3. Miljø' },
  { id: 'recipient', label: '4. Dialog-mottaker' },
  { id: 'test', label: '5. Test' },
]

const TRIGGER_OPTIONS: SelectOption[] = [
  { value: '4', label: 'Uke 4 — Dialogmøte 1' },
  { value: '8', label: 'Uke 8 — Oppfølgingsplan (NAV)' },
  { value: '12', label: 'Uke 12 — Tiltak' },
  { value: '26', label: 'Uke 26 — Maksgrense' },
]

export function NavSetup() {
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()
  const { rows, loading, upsert, refresh } = useOrgIntegrations(['altinn', 'nav'])
  const altinnRow = rows.altinn
  const row = rows.nav

  const [stepIndex, setStepIndex] = useState(0)
  const [environment, setEnvironment] = useState<'tt02' | 'prod'>(row?.environment ?? 'tt02')
  const [defaultOrgnr, setDefaultOrgnr] = useState<string>(
    typeof row?.config?.default_orgnr === 'string' ? (row.config.default_orgnr as string) : '',
  )
  const [dialogMottaker, setDialogMottaker] = useState<string>(
    typeof row?.config?.dialog_mottaker_email === 'string'
      ? (row.config.dialog_mottaker_email as string)
      : '',
  )
  const [autoTrigger, setAutoTrigger] = useState<string>(
    typeof row?.config?.auto_trigger_week === 'string'
      ? (row.config.auto_trigger_week as string)
      : '8',
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!row) return
    setEnvironment(row.environment ?? 'tt02')
    if (typeof row.config?.default_orgnr === 'string')
      setDefaultOrgnr(row.config.default_orgnr as string)
    if (typeof row.config?.dialog_mottaker_email === 'string')
      setDialogMottaker(row.config.dialog_mottaker_email as string)
    if (typeof row.config?.auto_trigger_week === 'string')
      setAutoTrigger(row.config.auto_trigger_week as string)
  }, [row])

  const altinnReady = Boolean(altinnRow?.enabled && altinnRow?.vault_secret_name)

  const persistConfig = async (overrides?: { enabled?: boolean }) => {
    setSaving(true)
    setSaveError(null)
    try {
      await upsert({
        kind: 'nav',
        environment,
        enabled: overrides?.enabled ?? row?.enabled ?? false,
        config: {
          default_orgnr: defaultOrgnr,
          dialog_mottaker_email: dialogMottaker,
          auto_trigger_week: autoTrigger,
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
      const res = await runGovDryRun(supabase, 'nav', organization.id)
      setDryRun(res)
      if (res.ok) {
        await upsert({ kind: 'nav', enabled: true, environment })
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
          { label: 'NAV' },
        ]}
        title="NAV-oppsett"
        loading
      >
        <div />
      </ModulePageShell>
    )
  }

  const validEmail = !dialogMottaker || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dialogMottaker)

  const stepNode = (() => {
    switch (STEPS[stepIndex]?.id) {
      case 'intro':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">
              Sykefraværsoppfølging via Altinn DSOP
            </h2>
            <p className="text-sm text-neutral-700">
              Du gir NewAMU lov til å sende oppfølgingsplaner og dialogmøte-varsler til NAV via{' '}
              <strong>Dialog Sykefraværsoppfølging (DSOP)</strong> — som kjører over Altinn 3.
              Plikten følger av <strong>AML § 4-6</strong> (tilrettelegging) og{' '}
              <strong>Folketrygdloven § 8-7 / § 25-2</strong>.
            </p>
            <InfoBox>
              NAV har ingen egen Maskinporten-klient i denne flyten — meldingene signeres med
              <strong> Altinn-virksomhetssertifikatet</strong>. Hvis Altinn ikke er aktivt, kan
              ikke NAV-oppsettet fullføres.
            </InfoBox>
            <div className="rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
              <p className="font-medium text-neutral-700">DSOP-skjemaer (trigger pr. uke)</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>
                  Uke 4 — <code className="font-mono">nav-sykefravar-dialogmote-1</code>
                </li>
                <li>
                  Uke 8 — <code className="font-mono">nav-sykefravar-oppfolgingsplan-8u</code>{' '}
                  (obligatorisk)
                </li>
                <li>
                  Uke 12 — <code className="font-mono">nav-sykefravar-tiltak-12u</code>
                </li>
                <li>
                  Uke 26 — <code className="font-mono">nav-sykefravar-maksdato-26u</code>
                </li>
              </ul>
            </div>
          </ModuleSectionCard>
        )
      case 'altinn':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Altinn-avhengighet</h2>
            <p className="text-sm text-neutral-700">
              NAV bruker Altinn-tilgangen din. Du må sette opp Altinn-integrasjonen først.
            </p>
            {altinnReady ? (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-medium">
                    Altinn er konfigurert ({altinnRow?.environment.toUpperCase()})
                  </p>
                  <p className="text-xs">
                    Virksomhetssertifikatet i Vault gjenbrukes for NAV DSOP.
                  </p>
                </div>
              </div>
            ) : (
              <WarningBox>
                <strong>NAV bruker Altinn-tilgangen din.</strong> Vennligst sett opp Altinn først.{' '}
                <Link
                  to="/admin/integrations/altinn"
                  className="font-medium underline"
                >
                  Sett opp Altinn ▸
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
              NAV-skjemaer kjører over samme Altinn-miljø som du valgte for Altinn. Vi anbefaler
              fortsatt sandbox for første gangs verifisering.
            </p>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 hover:border-neutral-300">
                <StandardInput
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
                    Altinn TT02. Skjemaer queues, men når ikke reell NAV-saksbehandler.
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 hover:border-neutral-300">
                <StandardInput
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
                    Reell innsending. Sykmeldt + saksbehandler får dialogvarsel.
                  </p>
                </div>
              </label>
            </div>
          </ModuleSectionCard>
        )
      case 'recipient':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">
              Dialog-mottaker og standardverdier
            </h2>
            <p className="text-sm text-neutral-700">
              Disse feltene fylles inn automatisk når en regel utløser et DSOP-skjema.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-neutral-700">
                Arbeidsgiver-orgnummer
                <StandardInput
                  value={defaultOrgnr}
                  onChange={(e) => setDefaultOrgnr(e.target.value)}
                  placeholder="9 siffer"
                  className="mt-1.5 font-mono"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Dialog-mottaker e-post
                <StandardInput
                  type="email"
                  value={dialogMottaker}
                  onChange={(e) => setDialogMottaker(e.target.value)}
                  placeholder="hr-ansvarlig@virksomhet.no"
                  className="mt-1.5"
                />
                {dialogMottaker && !validEmail && (
                  <span className="mt-1 block text-[11px] text-rose-700">Ugyldig e-postadresse</span>
                )}
              </label>
              <label className="block text-xs font-medium text-neutral-700 sm:col-span-2">
                Auto-trigger (forhåndsvalgt uke)
                <SearchableSelect
                  value={autoTrigger}
                  options={TRIGGER_OPTIONS}
                  onChange={(v) => setAutoTrigger(v)}
                />
                <span className="mt-1 block text-[11px] text-neutral-500">
                  Workflow-regelen kan overstyre dette pr. sak.
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
              Vi sender en tom testforbindelse-melding til <code>gov-nav-sykefravar</code> for å
              verifisere koblingen. Ingen DSOP-skjema når NAV.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => void runTest()}
                disabled={testing || !altinnReady}
                icon={testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              >
                {testing ? 'Tester …' : 'Test forbindelsen'}
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
                    Modus: <code>{dryRun.mode === 'dry-run' ? 'testforbindelse' : dryRun.mode}</code>.
                    Status:{' '}
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
      case 'recipient':
        return defaultOrgnr.trim().length === 9 && validEmail
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
        { label: 'NAV' },
      ]}
      title="NAV sykefraværsoppfølging-oppsett"
      description="Konfigurer DSOP-innsending via Altinn (AML § 4-6 + Folketrygdloven § 8-7)."
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
                if (STEPS[stepIndex]?.id === 'env' || STEPS[stepIndex]?.id === 'recipient') {
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
              onClick={() => void navigate('/admin/integrations/nav')}
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

export default NavSetup
