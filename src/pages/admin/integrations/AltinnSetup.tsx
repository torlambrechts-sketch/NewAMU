// AltinnSetup — five-step admin wizard for the Altinn 3 / Maskinporten
// integration. Replaces the combined GovIntegrationsPage card for Altinn.
//
// Step 1 — Forstå hva som sendes (Norwegian explainer)
// Step 2 — Virksomhetssertifikat opplastning (PEM/.p12 → Vault via
//          workflow_set_vault_secret RPC, with verifisering-state)
// Step 3 — Sandbox vs Produksjon (TT02 anbefalt → org_integrations.environment)
// Step 4 — Klient-ID + scope + kid (Maskinporten public config)
// Step 5 — "Test forbindelsen" → gov-altinn-submit?dryRun=true and final
//          activation (enabled=true)
//
// Why this exists: spec §6 wants a focused wizard per provider so the
// admin sees one regulator at a time. Cert-rotation UI is out of scope —
// re-running step 2 overwrites the vault row (workflow_set_vault_secret
// is an upsert).

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileWarning, Loader2, Lock, ShieldCheck, Upload } from 'lucide-react'
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
  { id: 'cert', label: '2. Virksomhetssertifikat' },
  { id: 'env', label: '3. Miljø' },
  { id: 'config', label: '4. Klient-ID' },
  { id: 'test', label: '5. Test' },
]

type CertState =
  | { phase: 'idle' }
  | { phase: 'verifying' }
  | { phase: 'verified'; expiresAt: string | null; secretName: string }
  | { phase: 'rejected'; reason: string }

export function AltinnSetup() {
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()
  const { rows, loading, upsert, setVaultSecret, refresh } = useOrgIntegrations(['altinn'])
  const row = rows.altinn

  const [stepIndex, setStepIndex] = useState(0)
  const [pemPassword, setPemPassword] = useState('')
  const [certState, setCertState] = useState<CertState>({ phase: 'idle' })
  const [environment, setEnvironment] = useState<'tt02' | 'prod'>(row?.environment ?? 'tt02')
  const [clientId, setClientId] = useState<string>(
    typeof row?.config?.client_id === 'string' ? (row.config.client_id as string) : '',
  )
  const [kid, setKid] = useState<string>(
    typeof row?.config?.kid === 'string' ? (row.config.kid as string) : '',
  )
  const [scope, setScope] = useState<string>(
    typeof row?.config?.scope === 'string'
      ? (row.config.scope as string)
      : 'altinn:instances.write altinn:serviceowner/instances.write',
  )
  const [defaultRecipient, setDefaultRecipient] = useState<string>(
    typeof row?.config?.default_recipient === 'string'
      ? (row.config.default_recipient as string)
      : '',
  )
  const [savingConfig, setSavingConfig] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null)
  const [testing, setTesting] = useState(false)

  // Re-hydrate when a row arrives (initial load is async).
  useEffect(() => {
    if (!row) return
    setEnvironment(row.environment ?? 'tt02')
    if (typeof row.config?.client_id === 'string') setClientId(row.config.client_id as string)
    if (typeof row.config?.kid === 'string') setKid(row.config.kid as string)
    if (typeof row.config?.scope === 'string') setScope(row.config.scope as string)
    if (typeof row.config?.default_recipient === 'string')
      setDefaultRecipient(row.config.default_recipient as string)
    if (row.vault_secret_name && certState.phase === 'idle') {
      setCertState({
        phase: 'verified',
        expiresAt:
          typeof row.config?.cert_expires_at === 'string'
            ? (row.config.cert_expires_at as string)
            : null,
        secretName: row.vault_secret_name,
      })
    }
  }, [row, certState.phase])

  const certWarning = useMemo(() => {
    if (certState.phase !== 'verified' || !certState.expiresAt) return null
    const ts = Date.parse(certState.expiresAt)
    if (Number.isNaN(ts)) return null
    const diffDays = Math.round((ts - Date.now()) / (24 * 60 * 60 * 1000))
    if (diffDays < 60) return diffDays
    return null
  }, [certState])

  const onCertFile = async (file: File | null) => {
    if (!file) return
    setCertState({ phase: 'verifying' })
    try {
      // Accept PEM directly. For .p12 we only read the file text as-is —
      // backend-side decryption with the supplied password is the real
      // verification step. Front-end just stores raw bytes (base64 in
      // text-string form) into Vault.
      const text = await file.text()
      if (!text.trim()) {
        setCertState({ phase: 'rejected', reason: 'Tom fil' })
        return
      }
      // Heuristic verification — we look for PEM header. Real RSA-key parse
      // happens server-side when the first Maskinporten token-exchange
      // fires during the dry-run step. This is "format check only".
      const looksLikePem = /-----BEGIN [^-]+-----/.test(text)
      if (!looksLikePem && !pemPassword) {
        setCertState({
          phase: 'rejected',
          reason: 'Filen ser ikke ut som PEM. Lim inn PKCS#8 PEM-tekst eller oppgi passord for .p12.',
        })
        return
      }
      // Push to Vault.
      const secretName = await setVaultSecret('altinn', text)
      setCertState({ phase: 'verified', expiresAt: null, secretName })
    } catch (err) {
      setCertState({
        phase: 'rejected',
        reason: err instanceof Error ? err.message : 'Ukjent feil ved opplasting',
      })
    }
  }

  const persistConfig = async (overrides?: { enabled?: boolean }) => {
    setSavingConfig(true)
    setConfigError(null)
    try {
      await upsert({
        kind: 'altinn',
        environment,
        enabled: overrides?.enabled ?? row?.enabled ?? false,
        config: {
          client_id: clientId,
          kid,
          scope,
          default_recipient: defaultRecipient,
        },
      })
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Kunne ikke lagre konfigurasjon')
      throw err
    } finally {
      setSavingConfig(false)
    }
  }

  const runTest = async () => {
    if (!supabase || !organization?.id) return
    setTesting(true)
    setDryRun(null)
    try {
      // Persist config first so the edge function sees the right row.
      await persistConfig()
      const res = await runGovDryRun(supabase, 'altinn', organization.id)
      setDryRun(res)
      if (res.ok) {
        await upsert({ kind: 'altinn', enabled: true, environment })
        await refresh()
      }
    } finally {
      setTesting(false)
    }
  }

  const finish = async () => {
    navigate('/admin/integrations/altinn')
  }

  if (loading) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Admin', to: '/admin' },
          { label: 'Integrasjoner', to: '/admin/integrations' },
          { label: 'Altinn' },
        ]}
        title="Altinn-oppsett"
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
            <h2 className="text-base font-semibold text-neutral-900">Forstå hva som sendes</h2>
            <p className="text-sm text-neutral-700">
              Du gir NewAMU lov til å sende meldinger på vegne av din virksomhet via Altinn 3 /
              Maskinporten. Standardmiljø er <strong>TT02 sandbox (testing)</strong>. Du bytter til
              produksjon når du har verifisert at sandboxen virker for din virksomhet.
            </p>
            <InfoBox>
              Maskinporten-flyten signerer hver melding med din virksomhetssertifikat (PKCS#8
              PEM). Privatnøkkelen lagres kryptert i Supabase Vault og kan ikke leses tilbake —
              kun overskrives.
            </InfoBox>
            <div className="rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
              <p className="font-medium text-neutral-700">Hjemmel</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>eForvaltningsforskriften § 8 — digital kommunikasjon med forvaltningen</li>
                <li>AML § 5-2 (via Arbeidstilsynet RegInc), GDPR Art. 33 (via Datatilsynet)</li>
                <li>Maskinporten brukervilkår — Digdir</li>
              </ul>
            </div>
          </ModuleSectionCard>
        )
      case 'cert':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">
              Virksomhetssertifikat (PKCS#8 PEM eller .p12)
            </h2>
            <p className="text-sm text-neutral-700">
              Last opp privatnøkkelen for din virksomhetssertifikat. Filen sendes direkte til
              Supabase Vault via en security-definer RPC og er <strong>aldri</strong> lagret i
              klartekst på klienten. NAV-, Arbeidstilsynet- og Datatilsynet-integrasjonene
              gjenbruker denne nøkkelen.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-neutral-700">
                Sertifikat (PEM / .p12 / .key)
                <StandardInput
                  type="file"
                  accept=".p12,.pem,.key"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    void onCertFile(file)
                  }}
                  className="mt-1.5"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Passord (kun for .p12)
                <StandardInput
                  type="password"
                  value={pemPassword}
                  onChange={(e) => setPemPassword(e.target.value)}
                  placeholder="(valgfritt)"
                  className="mt-1.5"
                />
              </label>
            </div>

            {certState.phase === 'verifying' && (
              <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifiserer …
              </div>
            )}
            {certState.phase === 'verified' && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-medium">Verifisert</p>
                  <p className="text-xs">
                    Vault-navn: <code className="font-mono">{certState.secretName}</code>
                  </p>
                  {certState.expiresAt && (
                    <p className="text-xs">
                      Utløper:{' '}
                      <strong>{new Date(certState.expiresAt).toLocaleDateString('nb-NO')}</strong>
                    </p>
                  )}
                </div>
              </div>
            )}
            {certState.phase === 'rejected' && (
              <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <div>
                  <p className="font-medium">Avvist</p>
                  <p className="text-xs">{certState.reason}</p>
                </div>
              </div>
            )}
            {certWarning !== null && (
              <WarningBox>
                Sertifikatet utløper om {certWarning} dager. Forny i god tid — uten gyldig
                sertifikat blokkeres alle gov-meldinger.
              </WarningBox>
            )}

            <InfoBox>
              <Lock className="mr-1 inline h-3 w-3" />
              <span>
                Filen havner i <code className="font-mono text-xs">vault.secrets</code> med navn{' '}
                <code className="font-mono text-xs">workflow.gov.&lt;org&gt;.altinn</code>. Bare
                edge-funksjoner med service-role-tilgang kan dekryptere den.
              </span>
            </InfoBox>
          </ModuleSectionCard>
        )
      case 'env':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Sandbox vs Produksjon</h2>
            <p className="text-sm text-neutral-700">
              Vi anbefaler at du tester mot <strong>TT02 sandbox</strong> først. Når dry-run i
              steg 5 er grønn, kan du bytte til produksjon. Du kan alltid bytte tilbake.
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
                    Maskinporten test-tenant + Altinn TT02. Ingen reelle meldinger sendes.
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
                    Maskinporten + Altinn produksjons-API. Meldinger registreres reelt hos
                    mottaker.
                  </p>
                </div>
              </label>
            </div>
          </ModuleSectionCard>
        )
      case 'config':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Maskinporten klient-ID</h2>
            <p className="text-sm text-neutral-700">
              Registrer Maskinporten-klienten din hos Digdir og hent klient-ID, kid (JWK key id)
              og scope. Disse feltene er offentlige — de lagres i klartekst på{' '}
              <code className="font-mono">org_integrations.config</code>.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-neutral-700">
                Klient-ID
                <StandardInput
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="f.eks. 0a4b3e2d-1234-…"
                  className="mt-1.5 font-mono"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                kid (JWK key id)
                <StandardInput
                  value={kid}
                  onChange={(e) => setKid(e.target.value)}
                  placeholder="signing-key-2026-01"
                  className="mt-1.5 font-mono"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700 sm:col-span-2">
                Scope
                <StandardInput
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="altinn:instances.write altinn:serviceowner/instances.write"
                  className="mt-1.5 font-mono"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700 sm:col-span-2">
                Standard mottaker-orgnummer (valgfritt)
                <StandardInput
                  value={defaultRecipient}
                  onChange={(e) => setDefaultRecipient(e.target.value)}
                  placeholder="9 siffer — eks. 974760673"
                  className="mt-1.5 font-mono"
                />
              </label>
            </div>
            {configError && <WarningBox>{configError}</WarningBox>}
          </ModuleSectionCard>
        )
      case 'test':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Test forbindelsen</h2>
            <p className="text-sm text-neutral-700">
              Vi sender en tom dry-run-melding til <code>gov-altinn-submit</code> for å verifisere
              at Maskinporten-flyten henger sammen. Ingen melding når Altinn — kun
              token-utvekslingen valideres.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => void runTest()}
                disabled={testing || !certState || certState.phase === 'idle'}
                icon={testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              >
                {testing ? 'Tester …' : 'Kjør dry-run'}
              </Button>
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
                    Modus: <code>{dryRun.mode}</code>. Status er satt til{' '}
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
      case 'cert':
        return certState.phase === 'verified'
      case 'env':
        return true
      case 'config':
        return clientId.trim().length > 0
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
        { label: 'Altinn' },
      ]}
      title="Altinn-oppsett"
      description="Konfigurer Maskinporten + Altinn 3 for din virksomhet. Brukes også av NAV, Datatilsynet og Arbeidstilsynet RegInc."
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
              disabled={!canAdvance || savingConfig}
              onClick={async () => {
                if (STEPS[stepIndex]?.id === 'config') {
                  try {
                    await persistConfig()
                  } catch {
                    return
                  }
                } else if (STEPS[stepIndex]?.id === 'env') {
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
              onClick={() => void finish()}
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

export default AltinnSetup
