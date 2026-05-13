// /reports/new — create a draft report row, then route into the detail
// page where the builder/viewer logic lives.
//
// Keeps the create flow as a small focused form (name, primary scope,
// extra scopes, period, signer, logo toggle) — the layout itself is
// inherited from the primary scope's defaultLayout. Later iterations
// can let the user pick a template here ("Ny fra mal" → Step 5).

import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import {
  getDashboardScope,
  listDashboardScopes,
} from '../../lib/dashboards/dashboardRegistry'
import { freshId } from '../../lib/dashboards/freshId'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'

type CoverMeta = {
  title?: string
  period_from?: string
  period_to?: string
  signer_name?: string
  signer_role?: string
  include_org_logo?: boolean
}

export function ReportBuilderPage() {
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()
  const scopes = useMemo(() => listDashboardScopes(), [])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [primaryScope, setPrimaryScope] = useState<string>(scopes[0]?.scopeId ?? '')
  const [extraScopes, setExtraScopes] = useState<string[]>([])
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [signerName, setSignerName] = useState('')
  const [signerRole, setSignerRole] = useState('')
  const [includeOrgLogo, setIncludeOrgLogo] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eligibleExtraScopes = useMemo(
    () => scopes.filter((s) => s.scopeId !== primaryScope),
    [scopes, primaryScope],
  )

  function toggleExtra(scopeId: string) {
    setExtraScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId],
    )
  }

  async function handleCreate() {
    if (!supabase || !organization?.id) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Navnet kan ikke være tomt.')
      return
    }
    if (!primaryScope) {
      setError('Velg et hovedscope.')
      return
    }
    setSaving(true)
    setError(null)
    const scope = getDashboardScope(primaryScope)
    const defaultLayout = scope?.defaultLayout ?? []
    const coverMeta: CoverMeta = {
      title: trimmed,
      ...(periodFrom ? { period_from: periodFrom } : {}),
      ...(periodTo ? { period_to: periodTo } : {}),
      ...(signerName.trim() ? { signer_name: signerName.trim() } : {}),
      ...(signerRole.trim() ? { signer_role: signerRole.trim() } : {}),
      include_org_logo: includeOrgLogo,
    }
    try {
      const { data, error: e } = await supabase
        .from('dashboard_layouts')
        .insert({
          kind: 'report',
          scope_id: primaryScope,
          report_scopes: extraScopes,
          slug: `report-${freshId('r')}`,
          name: trimmed,
          description: description.trim() || null,
          layout: defaultLayout,
          filters: [],
          cover_meta: coverMeta,
          is_default: false,
          owner_user_id: null,
        })
        .select('id')
        .single()
      if (e) throw e
      navigate(`/reports/${data.id}`)
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Rapporter', to: '/reports' }, { label: 'Ny rapport' }]}
      title="Ny rapport"
      description="En rapport fryser en oversikt på et tidspunkt. Velg hovedscope, eventuelle ekstra scopes som skal kombineres, og periode-/signaturmetadata for forsiden."
      headerActions={
        <Link
          to="/reports"
          className="inline-flex items-center gap-2 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" /> Tilbake
        </Link>
      }
    >
      <div className="max-w-3xl space-y-6">
        {error ? <WarningBox>{error}</WarningBox> : null}

        <Field label="Navn" required>
          <input
            type="text"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="F.eks. Årsrapport HMS 2026"
          />
        </Field>

        <Field label="Beskrivelse">
          <textarea
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Valgfri kort beskrivelse — vises på rapportlista."
          />
        </Field>

        <Field label="Hovedscope" required hint="Bestemmer standardlayout og hovedaksent.">
          <select
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            value={primaryScope}
            onChange={(e) => {
              const next = e.target.value
              setPrimaryScope(next)
              setExtraScopes((prev) => prev.filter((s) => s !== next))
            }}
          >
            {scopes.map((s) => (
              <option key={s.scopeId} value={s.scopeId}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Ekstra scopes (kombineres)"
          hint="Velg flere for tverr-scope rapporter — datasett slås sammen ved snapshot. Krever at scopen har en registert datasetsHook."
        >
          <div className="space-y-1">
            {eligibleExtraScopes.length === 0 ? (
              <p className="text-xs text-neutral-500">Ingen tilgjengelige scopes.</p>
            ) : (
              eligibleExtraScopes.map((s) => {
                const supported = !!s.datasetsHook
                return (
                  <label
                    key={s.scopeId}
                    className={`flex items-center gap-2 text-sm ${supported ? 'text-neutral-800' : 'text-neutral-400'}`}
                  >
                    <input
                      type="checkbox"
                      checked={extraScopes.includes(s.scopeId)}
                      disabled={!supported}
                      onChange={() => toggleExtra(s.scopeId)}
                    />
                    {s.label}
                    {!supported ? (
                      <span className="ml-1 text-xs italic">(kan ikke kombineres ennå)</span>
                    ) : null}
                  </label>
                )
              })
            )}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Periode fra">
            <input
              type="date"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
            />
          </Field>
          <Field label="Periode til">
            <input
              type="date"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Signatur — navn">
            <input
              type="text"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="F.eks. Kari Nordmann"
            />
          </Field>
          <Field label="Signatur — rolle">
            <input
              type="text"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              value={signerRole}
              onChange={(e) => setSignerRole(e.target.value)}
              placeholder="F.eks. HMS-leder"
            />
          </Field>
        </div>

        <Field label="Forside">
          <label className="flex items-center gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={includeOrgLogo}
              onChange={(e) => setIncludeOrgLogo(e.target.checked)}
            />
            Inkludér organisasjonslogo på forsiden
          </label>
        </Field>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleCreate}
            disabled={saving}
            icon={<Save className="h-4 w-4" />}
          >
            {saving ? 'Oppretter …' : 'Opprett rapport'}
          </Button>
          <Link
            to="/reports"
            className="inline-flex items-center gap-2 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Avbryt
          </Link>
        </div>
      </div>
    </ModulePageShell>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium text-neutral-800">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </span>
      {hint ? <span className="block text-xs text-neutral-500">{hint}</span> : null}
      {children}
    </label>
  )
}
