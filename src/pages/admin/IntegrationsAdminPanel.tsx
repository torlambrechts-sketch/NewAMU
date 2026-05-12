// IntegrationsAdminPanel — admin-fane for å konfigurere integrasjoner.
//
// MVP: BankID (signering), Eco-Online (stoff­kartotek), pluss plassholdere
// for Altinn, Lovdata Pro, Feide. Hemmeligheter lagres aldri her — kun
// public client_id, callback-URL og miljø. Hemmelig­håndtering skjer via
// edge function-secrets / Supabase Vault (TODO-instruks på siden).

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Lock, Plug, Settings, ShieldCheck } from 'lucide-react'
import { ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type IntegrationKind = 'bankid' | 'minid' | 'eco_online' | 'altinn' | 'lovdata_pro' | 'feide'

type IntegrationRow = {
  id: string
  kind: IntegrationKind
  enabled: boolean
  config: Record<string, unknown>
  last_health_check_at: string | null
  last_health_status: string | null
  last_health_message: string | null
}

type IntegrationDef = {
  kind: IntegrationKind
  title: string
  description: string
  fields: { key: string; label: string; placeholder?: string; type?: 'text' | 'select'; options?: SelectOption[] }[]
  secretNote: string
}

const ENV_OPTIONS: SelectOption[] = [
  { value: 'test', label: 'Test / Pre-prod' },
  { value: 'prod', label: 'Produksjon' },
]

const INTEGRATIONS: IntegrationDef[] = [
  {
    kind: 'bankid',
    title: 'BankID',
    description:
      'Sterkt autentisert digital signering av dokumenter. Brukes av signature_block-modulen i HMS-håndbok, varslings­rutiner, drøftings­protokoller og personal­dokumenter. Krever BankID Merchant-avtale.',
    fields: [
      { key: 'environment', label: 'Miljø', type: 'select', options: ENV_OPTIONS },
      { key: 'client_id', label: 'BankID Client ID', placeholder: 'urn:bankid:...' },
      {
        key: 'callback_url',
        label: 'Callback-URL',
        placeholder: 'https://newamu.no/bankid/callback',
      },
      { key: 'display_name', label: 'Visningsnavn ved signering', placeholder: 'Virksomheten din AS' },
    ],
    secretNote:
      'Klient-hemmelighet og signatur-sertifikat skal lagres som Supabase Vault-secret med navn BANKID_CLIENT_SECRET og BANKID_PRIVATE_KEY. IKKE lim inn hemmeligheter her.',
  },
  {
    kind: 'minid',
    title: 'MinID (ID-porten)',
    description:
      'ID-porten MinID for sterk pålogging (passord + SMS-kode). Brukes som alternativ til BankID når BankID-nivå ikke er nødvendig — typisk for kvittering på dokument-lesing, ikke for juridisk bindende signering.',
    fields: [
      { key: 'environment', label: 'Miljø', type: 'select', options: ENV_OPTIONS },
      { key: 'client_id', label: 'ID-porten Client ID', placeholder: 'urn:idporten:...' },
      {
        key: 'callback_url',
        label: 'Callback-URL',
        placeholder: 'https://newamu.no/idporten/callback',
      },
      { key: 'acr_values', label: 'Krav til sikkerhets­nivå', placeholder: 'idporten-loa-substantial (standard)' },
    ],
    secretNote:
      'Klient-hemmelighet lagres som Supabase Vault-secret MINID_CLIENT_SECRET. Forhåndsregistrering kreves hos Digdir for å motta produksjons-credentials.',
  },
  {
    kind: 'eco_online',
    title: 'Eco-Online (stoff­kartotek)',
    description:
      'Henter kjemikalie­liste og SDS-blad inn i NewAMU. Brukes av risiko­vurderings­modulen (industri/bygg/helse).',
    fields: [
      { key: 'environment', label: 'Miljø', type: 'select', options: ENV_OPTIONS },
      { key: 'api_base_url', label: 'API Base URL', placeholder: 'https://api.eco-online.com/v3' },
      { key: 'workspace_id', label: 'Workspace-ID', placeholder: 'Eco-Online workspace identifikator' },
    ],
    secretNote: 'API-token lagres som Supabase Vault-secret med navn ECO_ONLINE_API_TOKEN.',
  },
  {
    kind: 'altinn',
    title: 'Altinn',
    description:
      'Innsending av offentlige skjema (vernerunde-rapporter, ulykkes­meldinger, ARP-data). Planlagt fase 2.',
    fields: [
      { key: 'environment', label: 'Miljø', type: 'select', options: ENV_OPTIONS },
      { key: 'maskinporten_client_id', label: 'Maskinporten Client ID' },
    ],
    secretNote: 'Maskinporten privat nøkkel lagres som secret ALTINN_MASKINPORTEN_PRIVATE_KEY.',
  },
  {
    kind: 'lovdata_pro',
    title: 'Lovdata Pro',
    description:
      'Henter oppdatert lovtekst direkte inn i law_ref-blokker. Krever Lovdata Pro-abonnement. Planlagt fase 2.',
    fields: [
      { key: 'subscription_id', label: 'Abonnement-ID' },
    ],
    secretNote: 'API-token lagres som secret LOVDATA_API_TOKEN.',
  },
  {
    kind: 'feide',
    title: 'Feide',
    description:
      'Single sign-on for utdannings­sektor. Erstatter standard pålogging hvis virksomheten er Feide-tilknyttet. Planlagt fase 2.',
    fields: [
      { key: 'environment', label: 'Miljø', type: 'select', options: ENV_OPTIONS },
      { key: 'idp_url', label: 'Feide IdP URL' },
      { key: 'sp_entity_id', label: 'SP Entity ID' },
    ],
    secretNote: 'SAML-sertifikat lagres som secret FEIDE_SP_PRIVATE_KEY.',
  },
]

export function IntegrationsAdminPanel() {
  const { supabase, organization, profile } = useOrgSetupContext()
  const sb = supabase
  const canManage = profile?.is_org_admin === true
  const [rows, setRows] = useState<IntegrationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKind, setSavingKind] = useState<IntegrationKind | null>(null)
  const [drafts, setDrafts] = useState<Record<IntegrationKind, Record<string, string>>>({} as Record<IntegrationKind, Record<string, string>>)

  const load = useCallback(async () => {
    if (!sb || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await sb
        .from('org_integrations')
        .select('id, kind, enabled, config, last_health_check_at, last_health_status, last_health_message')
        .eq('organization_id', organization.id)
      if (e) throw e
      const initialDrafts = {} as Record<IntegrationKind, Record<string, string>>
      for (const def of INTEGRATIONS) {
        const row = (data ?? []).find((r: IntegrationRow) => r.kind === def.kind)
        const d: Record<string, string> = {}
        for (const f of def.fields) d[f.key] = (row?.config?.[f.key] as string) ?? ''
        initialDrafts[def.kind] = d
      }
      setRows((data ?? []) as IntegrationRow[])
      setDrafts(initialDrafts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste integrasjoner')
    } finally {
      setLoading(false)
    }
  }, [sb, organization?.id])

  useEffect(() => { void load() }, [load])

  async function saveIntegration(def: IntegrationDef, enable: boolean) {
    if (!sb || !organization?.id) return
    setSavingKind(def.kind)
    setError(null)
    try {
      const config = drafts[def.kind] ?? {}
      const { error: e } = await sb
        .from('org_integrations')
        .upsert(
          {
            organization_id: organization.id,
            kind: def.kind,
            enabled: enable,
            config,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,kind' },
        )
      if (e) throw e
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke lagre')
    } finally {
      setSavingKind(null)
    }
  }

  function updateDraft(kind: IntegrationKind, key: string, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [kind]: { ...(prev[kind] ?? {}), [key]: value },
    }))
  }

  function statusBadge(row: IntegrationRow | undefined) {
    if (!row) return <span className="text-xs text-neutral-500">Ikke konfigurert</span>
    if (!row.enabled) return <span className="text-xs text-neutral-500">Konfigurert, deaktivert</span>
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Aktiv
      </span>
    )
  }

  if (!canManage) {
    return <WarningBox>Du må være org-admin for å se integrasjoner.</WarningBox>
  }

  return (
    <ModuleSectionCard
      title="Integrasjoner"
      description="Aktiver og konfigurer integrasjoner mot eksterne tjenester. Hemmeligheter lagres separat i Supabase Vault."
      icon={Plug}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Henter…
        </div>
      ) : null}
      {error ? <WarningBox>{error}</WarningBox> : null}
      <div className="space-y-4">
        {INTEGRATIONS.map((def) => {
          const row = rows.find((r) => r.kind === def.kind)
          const draft = drafts[def.kind] ?? {}
          const isSaving = savingKind === def.kind
          return (
            <div key={def.kind} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {def.kind === 'bankid' ? <ShieldCheck className="h-5 w-5 text-[#1a3d32]" /> : <Settings className="h-5 w-5 text-neutral-500" />}
                    <h3 className="text-base font-semibold text-neutral-900">{def.title}</h3>
                    <div className="ml-auto">{statusBadge(row)}</div>
                  </div>
                  <p className="mt-1 text-sm text-neutral-700">{def.description}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {def.fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-neutral-700">{f.label}</label>
                    {f.type === 'select' && f.options ? (
                      <SearchableSelect
                        value={draft[f.key] ?? ''}
                        options={f.options}
                        onChange={(v) => updateDraft(def.kind, f.key, v as string)}
                      />
                    ) : (
                      <StandardInput
                        value={draft[f.key] ?? ''}
                        onChange={(e) => updateDraft(def.kind, f.key, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{def.secretNote}</span>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => saveIntegration(def, true)}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                  {row?.enabled ? 'Lagre og hold aktiv' : 'Aktiver'}
                </Button>
                {row?.enabled ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => saveIntegration(def, false)}
                    disabled={isSaving}
                  >
                    Deaktiver
                  </Button>
                ) : null}
              </div>

              {row?.last_health_check_at ? (
                <div className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                  Siste sjekk: {new Date(row.last_health_check_at).toLocaleString('nb-NO')} ·{' '}
                  Status: <strong>{row.last_health_status ?? '—'}</strong>
                  {row.last_health_message ? <> · {row.last_health_message}</> : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </ModuleSectionCard>
  )
}
