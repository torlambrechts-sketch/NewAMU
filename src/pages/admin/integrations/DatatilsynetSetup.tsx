// DatatilsynetSetup — admin wizard for Datatilsynet personvernbrudd-melding
// (GDPR Art. 33 / Personopplysningsloven § 26, 72-timers frist fra
// "aware_at").
//
// Datatilsynet har ingen åpen JSON-API ennå — transport-laget velger Altinn 3
// hvis det er konfigurert, ellers manuell outbox-rute. Wizarden samler
// inn kontakt-info for personvernombud + signerings-config (sha256 over
// canonical body) som gov-datatilsynet-breach allerede produserer.
//
// Steps:
//   1. Forstå — GDPR Art. 33 + 72-timers frist + Schrems-II forbud mot
//      US-relé
//   2. Altinn-status (anbefalt — manuell outbox er fallback)
//   3. Sandbox/Produksjon (eller manuell-only)
//   4. Personvernombud kontakt-info + signerings-config
//   5. Test forbindelsen — dry-run mot gov-datatilsynet-breach

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileWarning, Loader2, ShieldCheck, Upload } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../../components/module'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import { InfoBox, WarningBox } from '../../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { useOrgIntegrations } from '../../../hooks/useOrgIntegrations'
import { WizardStepper, type WizardStep } from './WizardStepper'
import { runGovDryRun, type DryRunResult } from './govDryRun'

const STEPS: WizardStep[] = [
  { id: 'intro', label: '1. Forstå' },
  { id: 'altinn', label: '2. Altinn-status' },
  { id: 'env', label: '3. Miljø' },
  { id: 'contact', label: '4. Personvernombud' },
  { id: 'test', label: '5. Test' },
]

export function DatatilsynetSetup() {
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()
  const { rows, loading, upsert, refresh } = useOrgIntegrations(['altinn', 'datatilsynet'])
  const altinnRow = rows.altinn
  const row = rows.datatilsynet

  const [stepIndex, setStepIndex] = useState(0)
  const [environment, setEnvironment] = useState<'tt02' | 'prod'>(row?.environment ?? 'tt02')
  const [dpoEmail, setDpoEmail] = useState<string>(
    typeof row?.config?.dpo_email === 'string' ? (row.config.dpo_email as string) : '',
  )
  const [dpoPhone, setDpoPhone] = useState<string>(
    typeof row?.config?.dpo_phone === 'string' ? (row.config.dpo_phone as string) : '',
  )
  const [submissionEmail, setSubmissionEmail] = useState<string>(
    typeof row?.config?.submission_email === 'string'
      ? (row.config.submission_email as string)
      : 'postkasse@datatilsynet.no',
  )
  const [signingMode, setSigningMode] = useState<'sha256-canonical' | 'manifest-only'>(
    typeof row?.config?.signing_mode === 'string'
      ? (row.config.signing_mode as 'sha256-canonical' | 'manifest-only')
      : 'sha256-canonical',
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!row) return
    setEnvironment(row.environment ?? 'tt02')
    if (typeof row.config?.dpo_email === 'string') setDpoEmail(row.config.dpo_email as string)
    if (typeof row.config?.dpo_phone === 'string') setDpoPhone(row.config.dpo_phone as string)
    if (typeof row.config?.submission_email === 'string')
      setSubmissionEmail(row.config.submission_email as string)
    if (typeof row.config?.signing_mode === 'string')
      setSigningMode(row.config.signing_mode as 'sha256-canonical' | 'manifest-only')
  }, [row])

  const altinnReady = Boolean(altinnRow?.enabled && altinnRow?.vault_secret_name)

  const persistConfig = async (overrides?: { enabled?: boolean }) => {
    setSaving(true)
    setSaveError(null)
    try {
      await upsert({
        kind: 'datatilsynet',
        environment,
        enabled: overrides?.enabled ?? row?.enabled ?? false,
        config: {
          dpo_email: dpoEmail,
          dpo_phone: dpoPhone,
          submission_email: submissionEmail,
          signing_mode: signingMode,
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
      const res = await runGovDryRun(supabase, 'datatilsynet', organization.id)
      setDryRun(res)
      if (res.ok) {
        await upsert({ kind: 'datatilsynet', enabled: true, environment })
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
          { label: 'Datatilsynet' },
        ]}
        title="Datatilsynet-oppsett"
        loading
      >
        <div />
      </ModulePageShell>
    )
  }

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dpoEmail)
  const validPhone = dpoPhone.replace(/\D/g, '').length >= 8

  const stepNode = (() => {
    switch (STEPS[stepIndex]?.id) {
      case 'intro':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">
              Personvernbrudd-melding (GDPR Art. 33)
            </h2>
            <p className="text-sm text-neutral-700">
              Du gir NewAMU lov til å sende inn personvernbrudd-meldinger til Datatilsynet på
              vegne av din virksomhet. Plikten følger av <strong>GDPR Art. 33</strong> og{' '}
              <strong>Personopplysningsloven § 26</strong>: meldingen skal sendes uten ugrunnet
              opphold og senest innen <strong>72 timer</strong> fra du ble kjent med bruddet.
            </p>
            <InfoBox>
              Datatilsynet har ikke en åpen JSON-API. Hvis Altinn 3 er aktivt, sendes meldingen
              som en signert envelope via <code>gov-altinn-submit</code>. Hvis ikke, queues
              meldingen i <code>gov_notifications_outbox</code> som <em>manual_outbox</em> og en
              admin må lime den inn i Datatilsynets web-skjema.
            </InfoBox>
            <WarningBox>
              <strong>GDPR Art. 44 / Schrems-II:</strong> Personvernbrudd-meldinger sendes{' '}
              <strong>aldri</strong> via amerikansk e-postrelé (SendGrid m.fl.). Transport-laget
              tillater kun Altinn eller manuell innsending.
            </WarningBox>
            <div className="rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
              <p className="font-medium text-neutral-700">Hjemmel</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>GDPR Art. 33 — melding av brudd til tilsynsmyndighet</li>
                <li>GDPR Art. 33(3) — minimumsinnhold i meldingen</li>
                <li>Personopplysningsloven § 26 — gjennomføring av Art. 33 i Norge</li>
                <li>GDPR Art. 44 — overføring til tredjeland (Schrems-II)</li>
              </ul>
            </div>
          </ModuleSectionCard>
        )
      case 'altinn':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Altinn-tilgang (transport)</h2>
            <p className="text-sm text-neutral-700">
              Den anbefalte transport-ruten er Altinn 3-envelopen til Datatilsynet. Hvis Altinn
              ikke er aktiv, faller integrasjonen tilbake på <em>manual_outbox</em>: et menneske
              må lime meldingen inn i Datatilsynets web-skjema. Du kan fortsatt fullføre wizarden
              med manuell-only.
            </p>
            {altinnReady ? (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-medium">Altinn er konfigurert ({altinnRow?.environment.toUpperCase()})</p>
                  <p className="text-xs">Meldinger sendes via Altinn 3 — ingen manuell håndtering.</p>
                </div>
              </div>
            ) : (
              <WarningBox>
                Altinn er ikke aktivt. Meldinger blir queued for manuell innsending.{' '}
                <Link to="/admin/integrations/altinn" className="font-medium underline">
                  Sett opp Altinn for automatisk transport ▸
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
              Dette flagget styrer kun hvilket Altinn-miljø som brukes for transport — selve
              Datatilsynet-meldingens innhold er identisk i sandbox og produksjon.
            </p>
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
                    Altinn TT02. Ingen reell saksbehandling hos Datatilsynet.
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
                    Reell innsending. Datatilsynet kvitterer med saksnummer.
                  </p>
                </div>
              </label>
            </div>
          </ModuleSectionCard>
        )
      case 'contact':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">
              Personvernombud + signerings-config
            </h2>
            <p className="text-sm text-neutral-700">
              GDPR Art. 33(3) krever at meldingen oppgir kontaktinformasjon til personvernombud
              eller annet kontaktpunkt. Datatilsynet ringer denne personen hvis de har spørsmål.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-neutral-700">
                Personvernombud e-post
                <StandardInput
                  type="email"
                  value={dpoEmail}
                  onChange={(e) => setDpoEmail(e.target.value)}
                  placeholder="dpo@virksomhet.no"
                  className="mt-1.5"
                />
                {dpoEmail && !validEmail && (
                  <span className="mt-1 block text-[11px] text-rose-700">Ugyldig e-postadresse</span>
                )}
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Personvernombud telefon
                <StandardInput
                  value={dpoPhone}
                  onChange={(e) => setDpoPhone(e.target.value)}
                  placeholder="+47 90 00 00 00"
                  className="mt-1.5"
                />
                {dpoPhone && !validPhone && (
                  <span className="mt-1 block text-[11px] text-rose-700">
                    Telefonnummer må ha minst 8 siffer
                  </span>
                )}
              </label>
              <label className="block text-xs font-medium text-neutral-700 sm:col-span-2">
                Innsendings-epost (Datatilsynet)
                <StandardInput
                  type="email"
                  value={submissionEmail}
                  onChange={(e) => setSubmissionEmail(e.target.value)}
                  placeholder="postkasse@datatilsynet.no"
                  className="mt-1.5"
                />
                <span className="mt-1 block text-[11px] text-neutral-500">
                  Brukes kun til manual-outbox-instrukser. Selve transport går via Altinn.
                </span>
              </label>
              <fieldset className="sm:col-span-2 rounded-md border border-neutral-200 p-3">
                <legend className="px-1 text-xs font-medium text-neutral-700">Signerings-modus</legend>
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="signing"
                    value="sha256-canonical"
                    checked={signingMode === 'sha256-canonical'}
                    onChange={() => setSigningMode('sha256-canonical')}
                    className="mt-1"
                  />
                  <span>
                    <strong>sha256-canonical (anbefalt)</strong> — kanonisk JSON-body + sha256-hash i
                    en signert manifest. Workflow-evidence lagrer både body og manifest.
                  </span>
                </label>
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="signing"
                    value="manifest-only"
                    checked={signingMode === 'manifest-only'}
                    onChange={() => setSigningMode('manifest-only')}
                    className="mt-1"
                  />
                  <span>
                    <strong>manifest-only</strong> — kun manifest med sha256. Body lagres ikke som
                    evidence (kun feltene for melding). Bruk hvis personopplysningene er
                    spesielt sensitive.
                  </span>
                </label>
              </fieldset>
            </div>
            {saveError && <WarningBox>{saveError}</WarningBox>}
          </ModuleSectionCard>
        )
      case 'test':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Test forbindelsen</h2>
            <p className="text-sm text-neutral-700">
              Vi sender en tom testforbindelse-melding til <code>gov-datatilsynet-breach</code>. Ingen
              transport (Altinn eller outbox) effektueres.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => void runTest()}
                disabled={testing}
                icon={testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              >
                {testing ? 'Tester …' : 'Test forbindelsen'}
              </Button>
              {environment === 'tt02' && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-900">
                  TT02 sandbox
                </span>
              )}
              {!altinnReady && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                  Manuell-outbox-modus
                </span>
              )}
            </div>
            {dryRun && dryRun.ok && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-medium">Test bestått — integrasjonen er aktivert.</p>
                  <p className="text-xs">
                    Modus:{' '}
                    <code>{dryRun.mode === 'dry-run' ? 'testforbindelse' : dryRun.mode}</code>.
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
        return true // can proceed regardless — manual outbox is a valid fallback
      case 'env':
        return true
      case 'contact':
        return validEmail && validPhone
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
        { label: 'Datatilsynet' },
      ]}
      title="Datatilsynet personvernbrudd-oppsett"
      description="Konfigurer innsending etter GDPR Art. 33 (72-timers frist)."
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
              onClick={() => void navigate('/admin/integrations/datatilsynet')}
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

export default DatatilsynetSetup
