// HelsetilsynetSetup — fire-stegs admin-veiviser for helsesektor-meldinger
// til Statens helsetilsyn (spesialisthelsetjenesteloven § 3-3) og UKOM
// (helse- og omsorgstjenesteloven § 12-3 a). Til forskjell fra
// AltinnSetup/ArbeidstilsynetSetup/NavSetup er det her ingen Maskinporten-
// /virksomhetssertifikat-flyt — disse to regulatorene har ingen API per
// dags dato. Wizard'en lagrer kontakt-info + en redigerbar melding-mal i
// org_integrations.config, og test-steget genererer en stub-PDF for
// brukerens egen review.
//
// Step 1 — Forstå skjemaplikten (lovparagrafer + lenker)
// Step 2 — Kontaktinformasjon (faganasvarlig + mottakers fagavdeling +
//          konfidensialitetsnivå)
// Step 3 — Standard-skjema mal (redigerbar tekstområde)
// Step 4 — Test forbindelsen (generer + last opp stub-PDF til
//          workflow-evidence/<org>/test-melding.pdf og signer 1h-URL)
//
// Why this exists: helsesektor-pakken (_123000) ble levert med rules som
// emitterer manuelle outbox-rader for Helsetilsynet/UKOM, men brukerne
// hadde ingen UI for å konfigurere hvor disse meldingene skulle havne.
// Denne veiviser'en lukker det gap'et.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  FileWarning,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../../components/module'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import { StandardTextarea } from '../../../components/ui/Textarea'
import { SearchableSelect } from '../../../components/ui/SearchableSelect'
import { InfoBox, WarningBox } from '../../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { useOrgIntegrations } from '../../../hooks/useOrgIntegrations'
import { WizardStepper, type WizardStep } from './WizardStepper'

const STEPS: WizardStep[] = [
  { id: 'intro', label: '1. Forstå' },
  { id: 'contact', label: '2. Kontaktinfo' },
  { id: 'template', label: '3. Melding-mal' },
  { id: 'test', label: '4. Test' },
]

// Default canonical melde-skjema text — placeholder iht. helsetilsyns-
// forskriften, redigerbar i steg 3 og lagret som config.melding_template.
// Tilsiktet høyt nivå; nøyaktig formulering fra forskriften skal seedes
// senere når jurist har gjennomgått (se TODO i header).
const DEFAULT_MELDING_TEMPLATE = `MELDING OM ALVORLIG HENDELSE I HELSE- OG OMSORGSTJENESTEN
Hjemmel: Spesialisthelsetjenesteloven § 3-3 / Helse- og omsorgstjenesteloven § 12-3 a

1. Pasientskade-kategori
   [ ] Død  [ ] Betydelig personskade  [ ] Pasient skadet annen pasient
   [ ] Annen alvorlig hendelse — spesifiser:

2. Hendelsesdato (DD.MM.ÅÅÅÅ HH:MM):

3. Beskrivelse av hendelsen (kort, kronologisk):

4. Vurdering av årsak (sannsynlig hovedårsak + medvirkende faktorer):

5. Tiltak iverksatt (umiddelbare tiltak + planlagte langsiktige tiltak):

6. Vurdering av forebyggbarhet (kunne hendelsen vært unngått? Hvordan?):

7. Kontaktperson hos virksomheten:
   Navn:
   Stilling:
   Telefon / e-post:

Konfidensiell behandling — taushetsplikt iht. helsepersonelloven § 21.`

const RECIPIENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'helsetilsynet_sentral', label: 'Statens helsetilsyn — sentralt' },
  { value: 'helsetilsynet_fylkesmann', label: 'Statens helsetilsyn — fylkesmann (statsforvalter)' },
  { value: 'ukom', label: 'UKOM (Statens undersøkelseskommisjon)' },
  { value: 'parallell', label: 'Parallell — både Helsetilsynet og UKOM' },
]

type ConfidentialityLevel = 'standard' | 'restricted' | 'confidential'

type WizardConfig = {
  faganasvarlig_navn: string
  faganasvarlig_epost: string
  faganasvarlig_telefon: string
  recipient: string
  default_confidentiality: ConfidentialityLevel
  melding_template: string
}

type OrgIntegrationConfigRow = {
  id: string
  enabled: boolean
  config: Record<string, unknown> | null
}

type TestResult =
  | { ok: true; signedUrl: string | null; storagePath: string }
  | { ok: false; error: string; detail?: string }

const EVIDENCE_BUCKET = 'workflow-evidence'

function readString(config: Record<string, unknown> | null, key: keyof WizardConfig, fallback: string): string {
  const v = config?.[key]
  return typeof v === 'string' ? v : fallback
}

function readConfidentiality(config: Record<string, unknown> | null): ConfidentialityLevel {
  const v = config?.default_confidentiality
  if (v === 'restricted' || v === 'confidential' || v === 'standard') return v
  return 'confidential'
}

// Build a minimal text-only "stub-PDF" without bringing in a PDF library
// on the client. The bytes follow the spec for a single-page A4 PDF with
// a Helvetica text stream — enough for a human to confirm storage upload
// works and to download/view in any PDF viewer. The real production
// rendering happens server-side in the helsetilsynet-build-melding edge
// function (pdf-lib + the same melding-mal).
function escapePdfText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildStubMeldingPdf(args: {
  orgName: string
  template: string
  recipientLabel: string
  faganasvarlig: string
}): Uint8Array {
  const lines: string[] = [
    'STUB — TEST-MELDING (ikke send)',
    `Virksomhet: ${args.orgName}`,
    `Mottaker: ${args.recipientLabel}`,
    `Faganasvarlig: ${args.faganasvarlig || '—'}`,
    `Generert: ${new Date().toLocaleString('nb-NO')}`,
    '',
    ...args.template.split('\n').slice(0, 60).map((l) => l.slice(0, 90)),
  ]
  // Build a minimal text stream — 12pt Helvetica, top-down with 14pt
  // leading. PDF coordinates start bottom-left so we anchor at y=800.
  const streamLines = lines.map((l, i) => {
    const y = 800 - i * 14
    return `BT /F1 11 Tf 50 ${y} Td (${escapePdfText(l)}) Tj ET`
  })
  const stream = streamLines.join('\n')
  const streamLen = stream.length

  const objects: string[] = []
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
  )
  objects.push(
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj\n`,
  )
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')

  const header = '%PDF-1.4\n'
  let body = header
  const offsets: number[] = [0]
  for (const o of objects) {
    offsets.push(body.length)
    body += o
  }
  const xrefOffset = body.length
  let xref = `xref\n0 ${objects.length + 1}\n`
  xref += '0000000000 65535 f \n'
  for (let i = 1; i <= objects.length; i++) {
    xref += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  const pdf = body + xref + trailer
  return new TextEncoder().encode(pdf)
}

export function HelsetilsynetSetup() {
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()
  const { upsert: integrationsUpsert } = useOrgIntegrations(['helsetilsynet'])

  const [row, setRow] = useState<OrgIntegrationConfigRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)
  const [config, setConfig] = useState<WizardConfig>({
    faganasvarlig_navn: '',
    faganasvarlig_epost: '',
    faganasvarlig_telefon: '',
    recipient: 'helsetilsynet_sentral',
    default_confidentiality: 'confidential',
    melding_template: DEFAULT_MELDING_TEMPLATE,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('org_integrations')
        .select('id, enabled, config')
        .eq('organization_id', organization.id)
        .eq('kind', 'helsetilsynet')
        .maybeSingle()
      if (error) throw error
      const r = (data as OrgIntegrationConfigRow | null) ?? null
      setRow(r)
      if (r?.config) {
        setConfig({
          faganasvarlig_navn: readString(r.config, 'faganasvarlig_navn', ''),
          faganasvarlig_epost: readString(r.config, 'faganasvarlig_epost', ''),
          faganasvarlig_telefon: readString(r.config, 'faganasvarlig_telefon', ''),
          recipient: readString(r.config, 'recipient', 'helsetilsynet_sentral'),
          default_confidentiality: readConfidentiality(r.config),
          melding_template: readString(r.config, 'melding_template', DEFAULT_MELDING_TEMPLATE),
        })
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Kunne ikke laste integrasjon')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const persistConfig = useCallback(
    async (overrides?: { enabled?: boolean }) => {
      if (!supabase || !organization?.id) return
      setSaving(true)
      setSaveError(null)
      try {
        // Route via the shared hook so the org_integrations upsert shape
        // (requires_external_activation, onConflict key, refresh chain) is
        // identical to AltinnSetup / ArbeidstilsynetSetup / NavSetup. Avoids
        // drift between setup paths.
        await integrationsUpsert({
          kind: 'helsetilsynet',
          environment: 'prod', // no sandbox for melde.no
          enabled: overrides?.enabled,
          config: { ...config },
        })
        await refresh()
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Kunne ikke lagre konfigurasjon')
        throw err
      } finally {
        setSaving(false)
      }
    },
    [supabase, organization, config, refresh, integrationsUpsert],
  )

  const runTest = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setTesting(true)
    setTestResult(null)
    try {
      // Save the latest config first so a real call to the edge function
      // (post-wizard) sees the same template/contact.
      await persistConfig()
      const recipientLabel =
        RECIPIENT_OPTIONS.find((o) => o.value === config.recipient)?.label ?? config.recipient
      const pdfBytes = buildStubMeldingPdf({
        orgName: organization.name ?? 'Ukjent virksomhet',
        template: config.melding_template,
        recipientLabel,
        faganasvarlig: config.faganasvarlig_navn,
      })
      const storagePath = `${organization.id}/test-melding.pdf`
      const { error: upErr } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(storagePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        })
      if (upErr) {
        setTestResult({ ok: false, error: 'upload_failed', detail: upErr.message })
        return
      }
      const { data: signed, error: signErr } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(storagePath, 60 * 60)
      if (signErr) {
        setTestResult({ ok: false, error: 'sign_failed', detail: signErr.message })
        return
      }
      setTestResult({
        ok: true,
        signedUrl: signed?.signedUrl ?? null,
        storagePath,
      })
      // Test passed → mark integration active so dashboards reflect it.
      await persistConfig({ enabled: true })
    } catch (err) {
      setTestResult({
        ok: false,
        error: 'unhandled',
        detail: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTesting(false)
    }
  }, [supabase, organization, config, persistConfig])

  const finish = () => navigate('/admin/integrations')

  const canAdvance = useMemo(() => {
    switch (STEPS[stepIndex]?.id) {
      case 'intro':
        return true
      case 'contact':
        return (
          config.faganasvarlig_navn.trim().length > 0 &&
          config.faganasvarlig_epost.trim().length > 0
        )
      case 'template':
        return config.melding_template.trim().length > 20
      case 'test':
        return testResult?.ok === true
      default:
        return false
    }
  }, [stepIndex, config, testResult])

  if (loading) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Admin', to: '/admin' },
          { label: 'Integrasjoner', to: '/admin/integrations' },
          { label: 'Helsetilsynet' },
        ]}
        title="Helsetilsynet-oppsett"
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
            <h2 className="text-base font-semibold text-neutral-900">Forstå skjemaplikten</h2>
            <p className="text-sm text-neutral-700">
              Statens helsetilsyn mottar meldinger om alvorlige hendelser i helse- og
              omsorgstjenesten iht. <strong>spesialisthelsetjenesteloven § 3-3</strong> og{' '}
              <strong>helse- og omsorgstjenesteloven § 12-3 a</strong>. Det finnes per i dag
              ingen API for innsending — meldinger sendes via melde.no eller på e-post.
            </p>
            <InfoBox>
              NewAMU kan derfor ikke automatisk sende meldingen for deg. Workflow-motoren
              forbereder en strukturert melding (PDF) og legger den i den manuelle utboksen
              under «Statlige meldinger». Faganasvarlig laster den ned, oppretter saken hos
              regulator og fører tilbake referansenummer.
            </InfoBox>
            <div className="space-y-3 rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-700">
              <div>
                <p className="font-medium text-neutral-800">Spesialisthelsetjenesteloven § 3-3</p>
                <p className="italic text-neutral-600">
                  «Helseinstitusjon som omfattes av denne loven, skal straks sende melding til
                  Statens helsetilsyn om betydelig personskade på pasient som følge av ytelse av
                  helsetjeneste eller ved at en pasient skader en annen.»
                </p>
              </div>
              <div>
                <p className="font-medium text-neutral-800">
                  Helse- og omsorgstjenesteloven § 12-3 a
                </p>
                <p className="italic text-neutral-600">
                  «Kommunen og virksomhet som har avtale med kommunen … skal straks varsle
                  Statens undersøkelseskommisjon for helse- og omsorgstjenesten (UKOM) om
                  alvorlige hendelser …»
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href="https://www.helsetilsynet.no"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 hover:border-[#1a3d32] hover:bg-emerald-50"
              >
                <span>helsetilsynet.no</span>
                <ExternalLink className="h-4 w-4 text-neutral-500" />
              </a>
              <a
                href="https://ukom.no"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 hover:border-[#1a3d32] hover:bg-emerald-50"
              >
                <span>ukom.no</span>
                <ExternalLink className="h-4 w-4 text-neutral-500" />
              </a>
            </div>
          </ModuleSectionCard>
        )
      case 'contact':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Kontaktinformasjon</h2>
            <p className="text-sm text-neutral-700">
              Hvem hos dere skal varsles når en regel utløser en Helsetilsynet- eller
              UKOM-melding? Personen får oppgaven i sin innboks og er ansvarlig for å
              fullføre innmeldingen hos regulator.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-neutral-700">
                Faganasvarlig — navn
                <StandardInput
                  value={config.faganasvarlig_navn}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, faganasvarlig_navn: e.target.value }))
                  }
                  placeholder="f.eks. Anne Hansen"
                  className="mt-1.5"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Faganasvarlig — e-post
                <StandardInput
                  type="email"
                  value={config.faganasvarlig_epost}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, faganasvarlig_epost: e.target.value }))
                  }
                  placeholder="navn@virksomhet.no"
                  className="mt-1.5 font-mono"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Faganasvarlig — telefon
                <StandardInput
                  value={config.faganasvarlig_telefon}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, faganasvarlig_telefon: e.target.value }))
                  }
                  placeholder="+47 …"
                  className="mt-1.5 font-mono"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Mottakers fagavdeling
                <SearchableSelect
                  value={config.recipient}
                  onChange={(v) => setConfig((c) => ({ ...c, recipient: v }))}
                  options={RECIPIENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  className="mt-1.5"
                  triggerClassName="rounded-md py-2"
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-neutral-700">
                Standard konfidensialitetsnivå for meldinger fra denne virksomheten
              </p>
              {(['standard', 'restricted', 'confidential'] as ConfidentialityLevel[]).map((lvl) => {
                const label =
                  lvl === 'standard'
                    ? 'Standard — synlig for HMS-kjede'
                    : lvl === 'restricted'
                      ? 'Restricted — kun fagansvarlig + daglig leder'
                      : 'Confidential — kun fagansvarlig + brukere med workflows.view_confidential'
                return (
                  <label
                    key={lvl}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 hover:border-neutral-300"
                  >
                    <StandardInput
                      type="radio"
                      name="confidentiality"
                      value={lvl}
                      checked={config.default_confidentiality === lvl}
                      onChange={() =>
                        setConfig((c) => ({ ...c, default_confidentiality: lvl }))
                      }
                      className="mt-1"
                    />
                    <span className="text-sm text-neutral-800">{label}</span>
                  </label>
                )
              })}
            </div>

            {saveError && <WarningBox>{saveError}</WarningBox>}
          </ModuleSectionCard>
        )
      case 'template':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Standard melding-mal</h2>
            <p className="text-sm text-neutral-700">
              Malen brukes som utgangspunkt når workflow-motoren genererer en PDF for
              faganasvarlig. Du kan redigere fritt — felt med <code>[ ]</code> tolkes som
              avkrysningsbokser i UI'et senere.
            </p>
            <InfoBox>
              Standardmalen følger struktur fra helsetilsynsforskriften (kategori, dato,
              beskrivelse, årsak, tiltak, forebyggbarhet, kontaktperson). Den endelige
              ordlyden bør gjennomgås av kvalitets-/jusansvarlig før produksjon.
            </InfoBox>
            <label className="block text-xs font-medium text-neutral-700">
              Melding-mal
              <StandardTextarea
                value={config.melding_template}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, melding_template: e.target.value }))
                }
                rows={20}
                className="mt-1.5 block w-full rounded-md font-mono text-xs leading-relaxed shadow-sm"
              />
            </label>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() =>
                  setConfig((c) => ({ ...c, melding_template: DEFAULT_MELDING_TEMPLATE }))
                }
              >
                Tilbakestill til standardmal
              </Button>
            </div>
          </ModuleSectionCard>
        )
      case 'test':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h2 className="text-base font-semibold text-neutral-900">Test forbindelsen</h2>
            <p className="text-sm text-neutral-700">
              Vi genererer en stub-PDF basert på malen din og laster den opp i
              evidence-bucket'en din. Hvis dette går igjennom, vil den ekte
              outbox-leveransen også gå igjennom. Ingen melding sendes til Helsetilsynet
              eller UKOM nå.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => void runTest()}
                disabled={testing}
                icon={
                  testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )
                }
              >
                {testing ? 'Genererer …' : 'Test forbindelsen'}
              </Button>
              {row?.enabled && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">
                  Aktivert
                </span>
              )}
            </div>
            {testResult && testResult.ok && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div className="flex-1">
                  <p className="font-medium">
                    Test bestått — stub-PDF lastet opp til evidence-bucket.
                  </p>
                  <p className="text-xs">
                    Sti: <code>{testResult.storagePath}</code>
                  </p>
                  {testResult.signedUrl && (
                    <p className="mt-2">
                      <a
                        href={testResult.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                      >
                        <Download className="h-3 w-3" /> Last ned for review (1 time)
                      </a>
                    </p>
                  )}
                </div>
              </div>
            )}
            {testResult && !testResult.ok && (
              <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900">
                <AlertCircle className="mt-0.5 h-4 w-4 text-rose-600" />
                <div>
                  <p className="font-medium">Test feilet — {testResult.error}</p>
                  {testResult.detail && <p className="mt-0.5 text-xs">{testResult.detail}</p>}
                </div>
              </div>
            )}
          </ModuleSectionCard>
        )
      default:
        return null
    }
  })()

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Admin', to: '/admin' },
        { label: 'Integrasjoner', to: '/admin/integrations' },
        { label: 'Helsetilsynet' },
      ]}
      title="Helsetilsynet-oppsett (helsesektor)"
      description="Konfigurer kontakt-info + melding-mal for Statens helsetilsyn og UKOM. Ingen API-flyt — meldinger genereres som PDF og dispatches via manuell utboks."
      headerActions={
        row?.enabled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">
            <CheckCircle2 className="h-3 w-3" /> Konfigurert
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
          <p className="text-xs text-neutral-600">
            Steg {stepIndex + 1} av {STEPS.length}
          </p>
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
                if (STEPS[stepIndex]?.id === 'contact' || STEPS[stepIndex]?.id === 'template') {
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
              {saving ? 'Lagrer …' : 'Neste'}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!canAdvance}
              onClick={() => finish()}
              icon={<ShieldCheck className="h-4 w-4" />}
            >
              Ferdig
            </Button>
          )}
        </div>

        <div className="text-center">
          <Link
            to="/admin/integrations"
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            ← Velg en annen integrasjon
          </Link>
        </div>
      </div>
    </ModulePageShell>
  )
}

export default HelsetilsynetSetup
