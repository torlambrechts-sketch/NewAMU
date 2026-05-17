// GovIntegrationsPage — admin wizard for the four government providers.
//
// One page covers altinn / regint / datatilsynet / nav. Each card lets
// the admin:
//   * Set environment (tt02 sandbox / prod)
//   * Register client_id + kid + scope
//   * Paste a PEM-encoded virksomhetssertifikat private key → stored
//     in Vault via workflow_set_vault_secret RPC
//   * Toggle enabled
//   * See last_submission_at / last_submission_status
//
// Activating any integration also surfaces a banner:
// "Regler som bruker denne integrasjonen krever workflows.activate_external."

import { useEffect, useState } from 'react'
import { CheckCircle2, FileWarning, Lock, RefreshCw, Save } from 'lucide-react'
import { ModulePageShell } from '../../../components/module'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import { StandardTextarea } from '../../../components/ui/Textarea'
import { SearchableSelect } from '../../../components/ui/SearchableSelect'
import { ToggleSwitch } from '../../../components/ui/FormToggles'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../../lib/supabaseError'

type IntegrationKind = 'altinn' | 'regint' | 'datatilsynet' | 'nav'

type IntegrationRow = {
  id: string
  organization_id: string
  kind: IntegrationKind
  enabled: boolean
  environment: 'tt02' | 'prod'
  config: Record<string, string>
  vault_secret_name: string | null
  last_health_status: 'ok' | 'degraded' | 'down' | null
  last_submission_at: string | null
  last_submission_status: 'ok' | 'failed' | null
}

const KIND_META: Record<
  IntegrationKind,
  { title: string; description: string; defaultScope: string; lawRef: string }
> = {
  altinn: {
    title: 'Altinn',
    description: 'Generisk Altinn 3-envelope for melding-innsending.',
    defaultScope: 'altinn:instances.write',
    lawRef: '',
  },
  regint: {
    title: 'Arbeidstilsynet (RegInc)',
    description: 'Alvorlig skade-melding etter AML § 5-2 — 24-timers frist.',
    defaultScope: 'arbeidstilsynet:reginc/melding.write',
    lawRef: 'AML § 5-2',
  },
  datatilsynet: {
    title: 'Datatilsynet',
    description: 'Personvernbrudd-skjema etter GDPR Art. 33 — 72-timers frist.',
    defaultScope: '',
    lawRef: 'GDPR Art. 33',
  },
  nav: {
    title: 'NAV (DSOP)',
    description: 'Sykefraværsoppfølging via Altinn DSOP.',
    defaultScope: '',
    lawRef: 'AML § 4-6, Folketrygdloven § 25-2',
  },
}

export function GovIntegrationsPage() {
  const { supabase, organization } = useOrgSetupContext()
  const [rows, setRows] = useState<Record<IntegrationKind, IntegrationRow | null>>({
    altinn: null,
    regint: null,
    datatilsynet: null,
    nav: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    if (!supabase || !organization) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('org_integrations')
        .select('*')
        .eq('organization_id', organization.id)
        .in('kind', ['altinn', 'regint', 'datatilsynet', 'nav'])
      if (e) throw e
      const next: Record<IntegrationKind, IntegrationRow | null> = {
        altinn: null,
        regint: null,
        datatilsynet: null,
        nav: null,
      }
      ;(data ?? []).forEach((r: unknown) => {
        const row = r as IntegrationRow
        next[row.kind] = row
      })
      setRows(next)
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, organization?.id])

  if (loading) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Admin', to: '/admin' },
          { label: 'Statlige integrasjoner' },
        ]}
        title="Statlige integrasjoner"
      >
        <p className="text-sm text-neutral-500">Laster …</p>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Admin', to: '/admin' },
        { label: 'Statlige integrasjoner' },
      ]}
      title="Statlige integrasjoner"
      description="Konfigurer Altinn, Arbeidstilsynet RegInc, Datatilsynet og NAV. Aktivering av en regel som bruker disse krever workflows.activate_external og dobbel godkjenning."
    >
      <div className="space-y-3">
        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <FileWarning className="mr-1 inline h-3 w-3" />
          Privatnøkler (virksomhetssertifikat PEM PKCS#8) lagres i Supabase Vault og kan ikke
          leses tilbake — kun overskrives. Inntil organisasjonen har registrert egen nøkkel
          brukes plattformens sandbox-nøkkel (MASKINPORTEN_TT02_PRIVATE_KEY) i TT02-miljøet.
        </div>
        {(Object.keys(KIND_META) as IntegrationKind[]).map((kind) => (
          <IntegrationCard
            key={kind}
            kind={kind}
            row={rows[kind]}
            onChanged={refresh}
          />
        ))}
      </div>
    </ModulePageShell>
  )
}

function IntegrationCard({
  kind,
  row,
  onChanged,
}: {
  kind: IntegrationKind
  row: IntegrationRow | null
  onChanged: () => void
}) {
  const { supabase, organization } = useOrgSetupContext()
  const meta = KIND_META[kind]
  const [environment, setEnvironment] = useState(row?.environment ?? 'tt02')
  const [enabled, setEnabled] = useState(row?.enabled ?? false)
  const [clientId, setClientId] = useState(row?.config?.client_id ?? '')
  const [kid, setKid] = useState(row?.config?.kid ?? '')
  const [scope, setScope] = useState(row?.config?.scope ?? meta.defaultScope)
  const [privateKeyPem, setPrivateKeyPem] = useState('')
  const [submissionEmail, setSubmissionEmail] = useState(row?.config?.submission_email ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    if (!supabase || !organization) return
    setSaving(true)
    setSaved(false)
    try {
      const config: Record<string, string> = {
        client_id: clientId,
        kid,
        scope: scope || meta.defaultScope,
      }
      if (kind === 'datatilsynet' && submissionEmail) config.submission_email = submissionEmail
      const { error: upErr } = await supabase
        .from('org_integrations')
        .upsert(
          {
            organization_id: organization.id,
            kind,
            environment,
            enabled,
            config,
            requires_external_activation: true,
          },
          { onConflict: 'organization_id,kind' },
        )
      if (upErr) throw upErr

      if (privateKeyPem.trim()) {
        const { error: vErr } = await supabase.rpc('workflow_set_vault_secret', {
          p_organization_id: organization.id,
          p_kind: kind,
          p_secret_value: privateKeyPem.trim(),
        })
        if (vErr) throw vErr
        setPrivateKeyPem('')
      }
      setSaved(true)
      onChanged()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <details className="rounded-xl border border-neutral-200 bg-white" open={enabled || !!row}>
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
        <div>
          <div className="flex items-center gap-2 font-medium text-neutral-900">
            {meta.title}
            {row?.enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800">
                <CheckCircle2 className="h-3 w-3" /> {row.environment.toUpperCase()}
              </span>
            ) : (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
                Ikke aktivert
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">{meta.description}</p>
          {meta.lawRef && <p className="mt-0.5 text-[11px] text-neutral-500">{meta.lawRef}</p>}
        </div>
        <div className="text-right text-xs text-neutral-500">
          {row?.last_submission_at && (
            <span>
              Sist: {new Date(row.last_submission_at).toLocaleString('nb-NO')} ·{' '}
              {row.last_submission_status ?? '—'}
            </span>
          )}
        </div>
      </summary>
      <div className="space-y-3 border-t border-neutral-100 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-neutral-700">
            Miljø
            <div className="mt-1">
              <SearchableSelect
                value={environment}
                options={[
                  { value: 'tt02', label: 'TT02 (sandbox)' },
                  { value: 'prod', label: 'Produksjon' },
                ]}
                onChange={(v) => setEnvironment(v as 'tt02' | 'prod')}
              />
            </div>
          </label>
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-700">
            <ToggleSwitch checked={enabled} onChange={setEnabled} label="Aktivert" />
            <span>Aktivert</span>
          </div>
        </div>
        <label className="block text-xs font-medium text-neutral-700">
          Klient-ID (Maskinporten)
          <StandardInput
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="f.eks. 0a4b3e2d-1234-…"
            className="mt-1 font-mono"
          />
        </label>
        <label className="block text-xs font-medium text-neutral-700">
          kid (JWK key id)
          <StandardInput
            value={kid}
            onChange={(e) => setKid(e.target.value)}
            placeholder="signing-key-2026-01"
            className="mt-1 font-mono"
          />
        </label>
        <label className="block text-xs font-medium text-neutral-700">
          Maskinporten-scope
          <StandardInput
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder={meta.defaultScope}
            className="mt-1 font-mono"
          />
        </label>
        {kind === 'datatilsynet' && (
          <label className="block text-xs font-medium text-neutral-700">
            Innsendings-epost (Datatilsynet)
            <StandardInput
              value={submissionEmail}
              onChange={(e) => setSubmissionEmail(e.target.value)}
              placeholder="postkasse@datatilsynet.no"
              className="mt-1"
            />
          </label>
        )}
        <label className="block text-xs font-medium text-neutral-700">
          <Lock className="mr-1 inline h-3 w-3" /> Privatnøkkel (PEM PKCS#8) — lagres kryptert i Vault
          <StandardTextarea
            value={privateKeyPem}
            onChange={(e) => setPrivateKeyPem(e.target.value)}
            placeholder={row?.vault_secret_name ? '(lagret — fyll inn for å overskrive)' : '-----BEGIN PRIVATE KEY-----\n…'}
            rows={5}
            className="mt-1 font-mono text-xs"
          />
          {row?.vault_secret_name && (
            <p className="mt-1 text-[11px] text-neutral-500">
              Vault: <code>{row.vault_secret_name}</code>
            </p>
          )}
        </label>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={save}
            disabled={saving}
            icon={<Save className="h-4 w-4" />}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? 'Lagrer …' : 'Lagre'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onChanged}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Oppdater
          </Button>
          {saved && <span className="text-xs text-emerald-700">Lagret.</span>}
        </div>
      </div>
    </details>
  )
}

export default GovIntegrationsPage
