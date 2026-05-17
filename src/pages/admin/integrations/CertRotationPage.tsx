// CertRotationPage — guided rotation of Maskinporten virksomhetssertifikat
// for the four gov integrations (Altinn / RegInt / Datatilsynet / NAV).
//
// Section A is a cert-status table fed by org_integrations.signing_* +
// cert_rotation_audit_log (last_rotated_at). Section B is a 4-step wizard:
//   1. Forstå konsekvensen   — Norwegian explainer (60-s token grace)
//   2. Last opp nytt sertifikat — file picker + metadata fields
//   3. Forhåndsvis            — side-by-side compare; reject if shorter
//   4. Bekreft                — typed confirmation (org domain or 6-digit code)
//
// Why this exists: NSM Grunnprinsipper 2.4 requires planned key rotation
// and AltinnSetup re-runs the upload step without showing the user old vs
// new cert. Without a guided flow it's easy to swap a cert that's already
// closer to expiry than the one it replaces. The wizard also calls the new
// workflow_record_cert_rotation RPC so the audit trail + ON_CERT_ROTATED
// event fire atomically with the org_integrations update.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../../components/module'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import { InfoBox, WarningBox } from '../../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { useOrgIntegrations, type GovIntegrationKind } from '../../../hooks/useOrgIntegrations'
import { WizardStepper, type WizardStep } from './WizardStepper'

const KIND_LABELS: Record<GovIntegrationKind, string> = {
  altinn: 'Altinn / Maskinporten',
  regint: 'Arbeidstilsynet (RegInt)',
  datatilsynet: 'Datatilsynet',
  nav: 'NAV (DSOP)',
}

const STEPS: WizardStep[] = [
  { id: 'understand', label: '1. Forstå' },
  { id: 'upload', label: '2. Last opp' },
  { id: 'preview', label: '3. Forhåndsvis' },
  { id: 'confirm', label: '4. Bekreft' },
]

type CertExtract = {
  kid: string
  serial: string
  subject: string
  issuer: string
  validFrom: string | null
  validTo: string | null
}

type RotationRow = {
  kind: GovIntegrationKind
  enabled: boolean
  vaultSecretName: string | null
  signingAdapter: string | null
  signingKid: string | null
  signingCertSerial: string | null
  signingCertExpiresAt: string | null
  lastRotatedAt: string | null
}

type AuditRow = {
  kind: GovIntegrationKind
  rotated_at: string
  new_kid: string | null
}

function truncate(value: string | null | undefined, take = 12): string {
  if (!value) return '—'
  if (value.length <= take * 2 + 1) return value
  return `${value.slice(0, take)}…${value.slice(-4)}`
}

function nbDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('nb-NO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function expiryCountdown(iso: string | null | undefined): { label: string; tone: 'ok' | 'warn' | 'danger' | 'expired' | 'unknown' } {
  if (!iso) return { label: '—', tone: 'unknown' }
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return { label: '—', tone: 'unknown' }
  const diffMs = ts - Date.now()
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000))
  if (days < 0) {
    return { label: `UTLØPT ${Math.abs(days)} dager siden`, tone: 'expired' }
  }
  if (days <= 30) {
    return { label: `om ${days} dager`, tone: 'danger' }
  }
  if (days <= 90) {
    return { label: `om ${days} dager`, tone: 'warn' }
  }
  const months = Math.round(days / 30)
  return { label: `om ${months} måneder`, tone: 'ok' }
}

function countdownClasses(tone: 'ok' | 'warn' | 'danger' | 'expired' | 'unknown'): string {
  switch (tone) {
    case 'expired':
      return 'bg-rose-100 text-rose-900 border-rose-200'
    case 'danger':
      return 'bg-amber-100 text-amber-900 border-amber-200'
    case 'warn':
      return 'bg-yellow-50 text-yellow-900 border-yellow-200'
    case 'ok':
      return 'bg-emerald-50 text-emerald-900 border-emerald-200'
    default:
      return 'bg-neutral-100 text-neutral-700 border-neutral-200'
  }
}

/**
 * Heuristic PEM/.p12 metadata extractor. We can't fully parse X.509 in the
 * browser without a heavy crypto lib, so we ask the admin to enter the
 * fields manually if extraction fails. Future: pull asn1.js / pkijs and
 * decrypt PKCS#12 with WebCrypto.PBES2.
 *
 * TODO: PKCS#12 client-side decryption with the supplied password would
 * let us auto-fill KID/serial/expires; tracked separately.
 */
async function extractCertMetadata(_file: File, _password: string): Promise<Partial<CertExtract>> {
  return {}
}

export function CertRotationPage() {
  const { supabase, organization } = useOrgSetupContext()
  const { rows: integrationRows, loading: integrationsLoading, refresh } = useOrgIntegrations([
    'altinn', 'regint', 'datatilsynet', 'nav',
  ])

  const [auditMap, setAuditMap] = useState<Record<GovIntegrationKind, string | null>>({
    altinn: null, regint: null, datatilsynet: null, nav: null,
  })
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [activeRotation, setActiveRotation] = useState<GovIntegrationKind | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)

  // Wizard form state
  const [pemFile, setPemFile] = useState<File | null>(null)
  const [pemPassword, setPemPassword] = useState('')
  const [pemText, setPemText] = useState('')
  const [newKid, setNewKid] = useState('')
  const [newSerial, setNewSerial] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newIssuer, setNewIssuer] = useState('')
  const [newValidFrom, setNewValidFrom] = useState('')
  const [newValidTo, setNewValidTo] = useState('')
  const [reason, setReason] = useState('')
  const [confirmationChallenge, setConfirmationChallenge] = useState('')
  const [confirmationInput, setConfirmationInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Load latest rotation timestamp per kind ─────────────────────────────
  const loadAudit = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoadingAudit(true)
    try {
      const { data, error } = await supabase
        .from('cert_rotation_audit_log')
        .select('kind, rotated_at, new_kid')
        .eq('organization_id', organization.id)
        .order('rotated_at', { ascending: false })
        .limit(64)
      if (error) throw error
      const next: Record<GovIntegrationKind, string | null> = {
        altinn: null, regint: null, datatilsynet: null, nav: null,
      }
      for (const r of (data ?? []) as AuditRow[]) {
        if (!next[r.kind]) next[r.kind] = r.rotated_at
      }
      setAuditMap(next)
    } catch {
      // table missing in dev DB → leave as nulls
    } finally {
      setLoadingAudit(false)
    }
  }, [supabase, organization?.id])

  useEffect(() => { void loadAudit() }, [loadAudit])

  // ── Resolve rotation rows from org_integrations ─────────────────────────
  const rotationRows: RotationRow[] = useMemo(() => {
    const kinds: GovIntegrationKind[] = ['altinn', 'regint', 'datatilsynet', 'nav']
    return kinds.map((k) => {
      const row = integrationRows[k]
      // useOrgIntegrations does not select the signing_* columns; reach for
      // them defensively in case a future change adds them to the hook.
      const r = (row ?? null) as (typeof row & {
        signing_adapter?: string | null
        signing_kid?: string | null
        signing_cert_serial?: string | null
        signing_cert_expires_at?: string | null
      }) | null
      return {
        kind: k,
        enabled: r?.enabled ?? false,
        vaultSecretName: r?.vault_secret_name ?? null,
        signingAdapter: r?.signing_adapter ?? null,
        signingKid: r?.signing_kid ?? null,
        signingCertSerial: r?.signing_cert_serial ?? null,
        signingCertExpiresAt: r?.signing_cert_expires_at ?? null,
        lastRotatedAt: auditMap[k] ?? null,
      }
    })
  }, [integrationRows, auditMap])

  // Re-fetch raw signing_* columns once on mount because useOrgIntegrations
  // doesn't pull them.
  const [signingPatched, setSigningPatched] = useState<Record<GovIntegrationKind, {
    adapter: string | null
    kid: string | null
    serial: string | null
    expiresAt: string | null
  }>>({
    altinn: { adapter: null, kid: null, serial: null, expiresAt: null },
    regint: { adapter: null, kid: null, serial: null, expiresAt: null },
    datatilsynet: { adapter: null, kid: null, serial: null, expiresAt: null },
    nav: { adapter: null, kid: null, serial: null, expiresAt: null },
  })

  const loadSigning = useCallback(async () => {
    if (!supabase || !organization?.id) return
    try {
      const { data, error } = await supabase
        .from('org_integrations')
        .select('kind, signing_adapter, signing_kid, signing_cert_serial, signing_cert_expires_at')
        .eq('organization_id', organization.id)
        .in('kind', ['altinn', 'regint', 'datatilsynet', 'nav'])
      if (error) throw error
      const next = {
        altinn: { adapter: null, kid: null, serial: null, expiresAt: null },
        regint: { adapter: null, kid: null, serial: null, expiresAt: null },
        datatilsynet: { adapter: null, kid: null, serial: null, expiresAt: null },
        nav: { adapter: null, kid: null, serial: null, expiresAt: null },
      } as typeof signingPatched
      for (const row of (data ?? []) as Array<{
        kind: GovIntegrationKind
        signing_adapter: string | null
        signing_kid: string | null
        signing_cert_serial: string | null
        signing_cert_expires_at: string | null
      }>) {
        next[row.kind] = {
          adapter: row.signing_adapter,
          kid: row.signing_kid,
          serial: row.signing_cert_serial,
          expiresAt: row.signing_cert_expires_at,
        }
      }
      setSigningPatched(next)
    } catch {
      // columns may not exist in dev; ignore
    }
  }, [supabase, organization?.id])

  useEffect(() => { void loadSigning() }, [loadSigning])

  // Merge the explicit signing_* fetch into rotationRows.
  const mergedRows: RotationRow[] = useMemo(() => rotationRows.map((r) => {
    const s = signingPatched[r.kind]
    return {
      ...r,
      signingAdapter: r.signingAdapter ?? s.adapter,
      signingKid: r.signingKid ?? s.kid,
      signingCertSerial: r.signingCertSerial ?? s.serial,
      signingCertExpiresAt: r.signingCertExpiresAt ?? s.expiresAt,
    }
  }), [rotationRows, signingPatched])

  const activeRow = useMemo(
    () => mergedRows.find((r) => r.kind === activeRotation) ?? null,
    [mergedRows, activeRotation],
  )

  const resetWizard = useCallback(() => {
    setStepIndex(0)
    setPemFile(null)
    setPemPassword('')
    setPemText('')
    setNewKid('')
    setNewSerial('')
    setNewSubject('')
    setNewIssuer('')
    setNewValidFrom('')
    setNewValidTo('')
    setReason('')
    setConfirmationInput('')
    setSubmitError(null)
    setSubmitting(false)
  }, [])

  const openWizard = useCallback((kind: GovIntegrationKind) => {
    setActiveRotation(kind)
    resetWizard()
    // Generate a 6-digit code as the typed-confirmation challenge. The
    // user may type either the org domain (when available) OR this code.
    setConfirmationChallenge(String(Math.floor(100000 + Math.random() * 900000)))
  }, [resetWizard])

  const closeWizard = useCallback(() => {
    setActiveRotation(null)
    resetWizard()
  }, [resetWizard])

  // ── Upload handler — try to extract metadata, fall back to manual ───────
  const onPemFile = useCallback(async (file: File | null) => {
    setPemFile(file)
    if (!file) {
      setPemText('')
      return
    }
    try {
      const text = await file.text()
      setPemText(text)
      const extracted = await extractCertMetadata(file, pemPassword)
      if (extracted.kid) setNewKid(extracted.kid)
      if (extracted.serial) setNewSerial(extracted.serial)
      if (extracted.subject) setNewSubject(extracted.subject)
      if (extracted.issuer) setNewIssuer(extracted.issuer)
      if (extracted.validFrom) setNewValidFrom(extracted.validFrom)
      if (extracted.validTo) setNewValidTo(extracted.validTo)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kunne ikke lese fil')
    }
  }, [pemPassword])

  const isPemValid = useMemo(() => {
    if (!pemText) return false
    const looksLikePem = /-----BEGIN [^-]+-----/.test(pemText)
    return looksLikePem || (pemFile?.name.toLowerCase().endsWith('.p12') ?? false)
  }, [pemText, pemFile])

  // Refuse if the new cert expires earlier than the old one.
  const expiryRegression: { reason: string } | null = useMemo(() => {
    if (!activeRow?.signingCertExpiresAt || !newValidTo) return null
    const oldTs = Date.parse(activeRow.signingCertExpiresAt)
    const newTs = Date.parse(newValidTo)
    if (Number.isNaN(oldTs) || Number.isNaN(newTs)) return null
    if (newTs < oldTs) {
      return {
        reason: `Det nye sertifikatet utløper (${nbDateTime(newValidTo)}) før det gamle (${nbDateTime(activeRow.signingCertExpiresAt)}). Rotasjon skal alltid forlenge — ikke forkorte.`,
      }
    }
    return null
  }, [activeRow, newValidTo])

  const expectedConfirmation = useMemo(() => {
    // The org doesn't carry an email_domain field — derive a slug from the
    // org name so the admin types something memorable instead of a random
    // 6-digit code. Either value is accepted.
    const domain = organization?.name
      ? organization.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32)
      : ''
    return { domain, code: confirmationChallenge }
  }, [organization, confirmationChallenge])

  const confirmationOk = useMemo(() => {
    const v = confirmationInput.trim()
    if (!v) return false
    return v === expectedConfirmation.code
      || (expectedConfirmation.domain && v.toLowerCase() === expectedConfirmation.domain.toLowerCase())
  }, [confirmationInput, expectedConfirmation])

  // ── Submit the rotation ─────────────────────────────────────────────────
  const submitRotation = useCallback(async () => {
    if (!supabase || !organization?.id || !activeRow) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      // Step 1 — push the new PEM into Vault.
      const { error: vaultErr } = await supabase.rpc('workflow_set_vault_secret', {
        p_organization_id: organization.id,
        p_kind: activeRow.kind,
        p_secret_value: pemText,
      })
      if (vaultErr) throw new Error(`Vault skriving feilet: ${vaultErr.message}`)

      // Step 2 — record the rotation atomically.
      const { error: rpcErr } = await supabase.rpc('workflow_record_cert_rotation', {
        p_org_id: organization.id,
        p_kind: activeRow.kind,
        p_old_kid: activeRow.signingKid,
        p_new_kid: newKid.trim() || activeRow.signingKid,
        p_new_serial: newSerial.trim() || null,
        p_new_expires_at: newValidTo ? new Date(newValidTo).toISOString() : null,
        p_reason: reason.trim() || null,
      })
      if (rpcErr) throw new Error(`Rotasjon avvist: ${rpcErr.message}`)

      await Promise.all([refresh(), loadAudit(), loadSigning()])
      setBannerMessage(`Sertifikat rotert ✓ — ${KIND_LABELS[activeRow.kind]}`)
      closeWizard()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Ukjent feil')
    } finally {
      setSubmitting(false)
    }
  }, [
    supabase, organization?.id, activeRow, pemText, newKid, newSerial, newValidTo,
    reason, refresh, loadAudit, loadSigning, closeWizard,
  ])

  // ── Render — overview table ─────────────────────────────────────────────
  const overview = (
    <ModuleSectionCard className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">Status per integrasjon</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { void refresh(); void loadAudit(); void loadSigning() }}
          icon={loadingAudit || integrationsLoading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCcw className="h-3.5 w-3.5" />}
        >
          Oppdater
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
              <th className="py-2 pr-3">Integrasjon</th>
              <th className="py-2 pr-3">Vault-navn</th>
              <th className="py-2 pr-3">Signing-adapter</th>
              <th className="py-2 pr-3">KID</th>
              <th className="py-2 pr-3">Serial</th>
              <th className="py-2 pr-3">Utløper</th>
              <th className="py-2 pr-3">Sist rotert</th>
              <th className="py-2 pr-3 text-right">Handling</th>
            </tr>
          </thead>
          <tbody>
            {mergedRows.map((row) => {
              const countdown = expiryCountdown(row.signingCertExpiresAt)
              const isVaultPem = (row.signingAdapter ?? 'vault_pem') === 'vault_pem'
              return (
                <tr key={row.kind} className="border-b border-neutral-100 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-neutral-900">{KIND_LABELS[row.kind]}</div>
                    {!row.enabled && (
                      <div className="text-xs text-neutral-500">Ikke aktivert</div>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-neutral-700">
                    {truncate(row.vaultSecretName, 18)}
                  </td>
                  <td className="py-2 pr-3 text-xs text-neutral-700">
                    {row.signingAdapter ?? 'vault_pem'}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-neutral-700">
                    {truncate(row.signingKid, 10)}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-neutral-700">
                    {truncate(row.signingCertSerial, 10)}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    <div className="text-neutral-700">{nbDateTime(row.signingCertExpiresAt)}</div>
                    <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${countdownClasses(countdown.tone)}`}>
                      <Clock className="h-3 w-3" /> {countdown.label}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-neutral-700">
                    {nbDateTime(row.lastRotatedAt)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openWizard(row.kind)}
                      disabled={!isVaultPem || !row.enabled}
                      title={
                        !row.enabled
                          ? 'Integrasjonen er ikke aktivert'
                          : !isVaultPem
                            ? 'HSM-adaptere roteres via leverandørens API, ikke via Vault.'
                            : undefined
                      }
                      icon={<RefreshCcw className="h-3.5 w-3.5" />}
                    >
                      Roter
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <InfoBox>
        Sertifikatrotasjon dekker NSM Grunnprinsipper 2.4 og IK-forskriften
        § 5 nr. 7. Et utløpt sertifikat blokkerer ALL Maskinporten-trafikk
        for valgt regulator. Sørg for at det nye sertifikatet er registrert
        hos Digdir før du fullfører wizarden.
      </InfoBox>
    </ModuleSectionCard>
  )

  // ── Wizard rendering ────────────────────────────────────────────────────
  const wizardStepNode = (() => {
    if (!activeRow) return null
    const oldCountdown = expiryCountdown(activeRow.signingCertExpiresAt)
    const newCountdown = expiryCountdown(newValidTo ? new Date(newValidTo).toISOString() : null)
    switch (STEPS[stepIndex]?.id) {
      case 'understand':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h3 className="text-base font-semibold text-neutral-900">Forstå konsekvensen</h3>
            <p className="text-sm text-neutral-700">
              Du er i ferd med å bytte virksomhetssertifikat for{' '}
              <strong>{organization?.name ?? 'din virksomhet'}</strong> mot{' '}
              <strong>{KIND_LABELS[activeRow.kind]}</strong>. Det nye sertifikatet vil brukes for{' '}
              <strong>ALLE</strong> fremtidige Maskinporten-tokens fra og med{' '}
              <strong>{new Date().toLocaleString('nb-NO')}</strong>. Eksisterende ubrukte tokens
              fortsetter å fungere til de utløper (typisk 60 sekunder etter utstedelse).
            </p>
            <InfoBox>
              Privatnøkkelen lagres kryptert i Supabase Vault og er aldri lesbar fra klienten —
              kun overskrivbar. Det gamle sertifikatet beholdes IKKE som backup, så sørg for at
              det nye er registrert hos Digdir og at du har sandbox-verifisert flyten først.
            </InfoBox>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
              <p className="font-medium text-neutral-800">Hjemmel</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>NSM Grunnprinsipper 2.4 — planlagt rotasjon av nøkkelmateriale</li>
                <li>IK-forskriften § 5 nr. 7 — systematisk overvåking av sikkerhetstiltak</li>
                <li>Sikkerhetsloven § 4-3 — forsvarlig sikkerhetstilstand for tjenester som signerer mot myndighetsregistre</li>
              </ul>
            </div>
          </ModuleSectionCard>
        )
      case 'upload':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h3 className="text-base font-semibold text-neutral-900">Last opp nytt sertifikat</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-neutral-700">
                Sertifikat (PEM / .p12 / .key)
                <StandardInput
                  type="file"
                  accept=".p12,.pem,.key"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    void onPemFile(f)
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
            {!isPemValid && pemFile && (
              <WarningBox>
                Filen ser ikke ut som PKCS#8 PEM. Last opp et .pem/.key med
                <code className="mx-1 font-mono text-xs">-----BEGIN …-----</code>-header,
                eller en .p12-pakke.
              </WarningBox>
            )}
            <p className="text-sm text-neutral-700">
              Klient-side dekoding av X.509-metadata er ikke implementert ennå —
              fyll inn KID, serial, gyldig fra/til manuelt. Verdiene må matche
              det som er registrert hos Digdir.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-neutral-700">
                Ny KID (JWK key id)
                <StandardInput
                  value={newKid}
                  onChange={(e) => setNewKid(e.target.value)}
                  placeholder="signing-key-2027-05"
                  className="mt-1.5 font-mono"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Ny X.509-serial
                <StandardInput
                  value={newSerial}
                  onChange={(e) => setNewSerial(e.target.value)}
                  placeholder="01:2A:3F:…"
                  className="mt-1.5 font-mono"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Subject (CN/O)
                <StandardInput
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="CN=NewAMU AS, O=NewAMU AS"
                  className="mt-1.5"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Issuer
                <StandardInput
                  value={newIssuer}
                  onChange={(e) => setNewIssuer(e.target.value)}
                  placeholder="Buypass Class 3 CA …"
                  className="mt-1.5"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Gyldig fra (notBefore)
                <StandardInput
                  type="date"
                  value={newValidFrom}
                  onChange={(e) => setNewValidFrom(e.target.value)}
                  className="mt-1.5"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Gyldig til (notAfter)
                <StandardInput
                  type="date"
                  value={newValidTo}
                  onChange={(e) => setNewValidTo(e.target.value)}
                  className="mt-1.5"
                />
              </label>
            </div>
            <label className="block text-xs font-medium text-neutral-700">
              Begrunnelse (valgfritt — havner i audit-loggen)
              <StandardInput
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Eks: Planlagt årlig rotasjon — ny Buypass-pakke."
                className="mt-1.5"
              />
            </label>
          </ModuleSectionCard>
        )
      case 'preview': {
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h3 className="text-base font-semibold text-neutral-900">Forhåndsvis bytte</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-neutral-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase text-neutral-500">Gammelt sertifikat</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <Field label="KID" value={truncate(activeRow.signingKid, 18)} />
                  <Field label="Serial" value={truncate(activeRow.signingCertSerial, 18)} />
                  <Field label="Utløper" value={nbDateTime(activeRow.signingCertExpiresAt)} />
                  <Field label="Tilstand" value={oldCountdown.label} />
                </dl>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase text-emerald-700">Nytt sertifikat</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <Field label="KID" value={truncate(newKid || '—', 18)} />
                  <Field label="Serial" value={truncate(newSerial || '—', 18)} />
                  <Field label="Utløper" value={nbDateTime(newValidTo || null)} />
                  <Field label="Tilstand" value={newValidTo ? newCountdown.label : '—'} />
                  <Field label="Subject" value={newSubject || '—'} />
                  <Field label="Issuer" value={newIssuer || '—'} />
                </dl>
              </div>
            </div>
            {expiryRegression && (
              <WarningBox>{expiryRegression.reason}</WarningBox>
            )}
          </ModuleSectionCard>
        )
      }
      case 'confirm':
        return (
          <ModuleSectionCard className="space-y-4 p-6">
            <h3 className="text-base font-semibold text-neutral-900">Bekreft rotasjonen</h3>
            <p className="text-sm text-neutral-700">
              Skriv bekreftelseskoden under, eller virksomhetens domene, for å fullføre rotasjonen.
              Handlingen kan ikke rulles tilbake — det gamle sertifikatet overskrives i Vault.
            </p>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-base tracking-widest text-neutral-900">
              {expectedConfirmation.code}
            </div>
            <label className="block text-xs font-medium text-neutral-700">
              Bekreftelseskode eller domene
              <StandardInput
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={expectedConfirmation.domain
                  ? `${expectedConfirmation.code} eller ${expectedConfirmation.domain}`
                  : expectedConfirmation.code}
                className="mt-1.5 font-mono"
              />
            </label>
            {submitError && (
              <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{submitError}</span>
              </div>
            )}
          </ModuleSectionCard>
        )
      default:
        return null
    }
  })()

  const canAdvance = (() => {
    if (!activeRow) return false
    switch (STEPS[stepIndex]?.id) {
      case 'understand':
        return true
      case 'upload':
        return isPemValid && newKid.trim().length > 0 && Boolean(newValidTo)
      case 'preview':
        return !expiryRegression
      case 'confirm':
        return confirmationOk && !submitting
      default:
        return false
    }
  })()

  const wizard = activeRow ? (
    <ModuleSectionCard className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">
            Roter sertifikat — {KIND_LABELS[activeRow.kind]}
          </h2>
          <p className="text-xs text-neutral-600">Steg {stepIndex + 1} av {STEPS.length}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={closeWizard}>
          Avbryt
        </Button>
      </div>
      <WizardStepper steps={STEPS} activeIndex={stepIndex} onSelect={setStepIndex} />
      {wizardStepNode}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          disabled={stepIndex === 0 || submitting}
          onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
          icon={<ArrowLeft className="h-4 w-4" />}
        >
          Forrige
        </Button>
        {stepIndex < STEPS.length - 1 ? (
          <Button
            variant="primary"
            disabled={!canAdvance}
            onClick={() => setStepIndex((s) => Math.min(STEPS.length - 1, s + 1))}
            icon={<ArrowRight className="h-4 w-4" />}
          >
            Neste
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={!canAdvance}
            onClick={() => void submitRotation()}
            icon={submitting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ShieldCheck className="h-4 w-4" />}
          >
            {submitting ? 'Roterer …' : 'Fullfør rotasjon'}
          </Button>
        )}
      </div>
    </ModuleSectionCard>
  ) : null

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Admin', to: '/admin' },
        { label: 'Integrasjoner', to: '/admin/integrations' },
        { label: 'Sertifikat-rotasjon' },
      ]}
      title="Sertifikat-rotasjon"
      description="Roter Maskinporten virksomhetssertifikat for de fire gov-integrasjonene. NSM Grunnprinsipper 2.4 + IK-f § 5 nr. 7."
      headerActions={
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-900">
          <KeyRound className="h-3 w-3" /> NSM 2.4
        </span>
      }
    >
      <div className="space-y-4">
        {bannerMessage && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="flex-1">
              <p className="font-medium">{bannerMessage}</p>
              <p className="text-xs">
                Ny KID er nå aktiv for alle påfølgende Maskinporten-tokens. Audit-rad er
                opprettet og workflow-event <code className="font-mono">ON_CERT_ROTATED</code> er
                dispatchet.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              className="text-xs text-emerald-800 hover:text-emerald-900"
            >
              Lukk
            </button>
          </div>
        )}

        {overview}
        {wizard}

        <div className="text-center">
          <Link to="/admin/integrations" className="text-xs text-neutral-500 hover:text-neutral-700">
            ← Tilbake til integrasjoner
          </Link>
          {' · '}
          <span className="text-xs text-neutral-500">
            <Upload className="mr-1 inline h-3 w-3" /> Wizard skriver til Vault + audit-log
          </span>
        </div>
      </div>
    </ModulePageShell>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-mono text-neutral-900">{value}</dd>
    </div>
  )
}

export default CertRotationPage
