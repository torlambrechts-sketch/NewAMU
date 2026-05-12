// GdprSubjectRequestsAdminPanel — håndtering av individrettighets-
// forespørsler etter GDPR Art. 15-21. 30-dagers svarfrist hard-coded.

import { useCallback, useEffect, useState } from 'react'
import { Clock, Loader2, Plus, UserSearch } from 'lucide-react'
import { ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type Request = {
  id: string
  received_at: string
  deadline_at: string
  request_type: string
  subject_name: string
  subject_email: string | null
  subject_identity_verified: boolean
  request_description: string
  status: string
  response_at: string | null
  response_summary: string | null
  denial_reason: string | null
}

const REQUEST_TYPES: SelectOption[] = [
  { value: 'access', label: 'Innsyn (Art. 15)' },
  { value: 'rectification', label: 'Retting (Art. 16)' },
  { value: 'erasure', label: 'Sletting (Art. 17)' },
  { value: 'restriction', label: 'Begrensning (Art. 18)' },
  { value: 'portability', label: 'Dataportabilitet (Art. 20)' },
  { value: 'objection', label: 'Innsigelse (Art. 21)' },
  { value: 'consent_withdraw', label: 'Trekk samtykke (Art. 7(3))' },
]

const STATUS_LABEL: Record<string, string> = {
  received: 'Mottatt',
  identity_check: 'Identifikasjon',
  in_progress: 'Behandles',
  partial_response: 'Delsvar',
  completed: 'Avsluttet',
  denied: 'Avslått',
  extended: 'Forlenget',
}

function daysLeft(deadline: string): number {
  return Math.floor((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function deadlineColor(days: number, status: string): string {
  if (status === 'completed' || status === 'denied') return 'text-neutral-500'
  if (days < 0) return 'text-red-700 font-semibold'
  if (days < 7) return 'text-red-700'
  if (days < 14) return 'text-amber-700'
  return 'text-emerald-700'
}

export function GdprSubjectRequestsAdminPanel() {
  const { supabase, organization, profile } = useOrgSetupContext()
  const [rows, setRows] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    subject_name: '',
    subject_email: '',
    request_type: 'access',
    request_description: '',
  })

  const load = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('gdpr_subject_requests')
        .select('*')
        .eq('organization_id', organization.id)
        .order('received_at', { ascending: false })
      if (e) throw e
      setRows((data ?? []) as Request[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id])

  useEffect(() => { void load() }, [load])

  async function createRequest() {
    if (!supabase || !organization?.id) return
    setSaving(true)
    setError(null)
    try {
      const { error: e } = await supabase.from('gdpr_subject_requests').insert({
        organization_id: organization.id,
        subject_name: form.subject_name,
        subject_email: form.subject_email || null,
        request_type: form.request_type,
        request_description: form.request_description,
        status: 'received',
      })
      if (e) throw e
      setShowForm(false)
      setForm({ subject_name: '', subject_email: '', request_type: 'access', request_description: '' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke registrere')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: Request['status'], summary?: string) {
    if (!supabase) return
    const patch: Record<string, unknown> = { status }
    if (status === 'completed') {
      patch.response_at = new Date().toISOString()
      if (summary) patch.response_summary = summary
    }
    const { error: e } = await supabase.from('gdpr_subject_requests').update(patch).eq('id', id)
    if (e) setError(e.message)
    else void load()
  }

  if (!profile?.is_org_admin) {
    return <WarningBox>Du må være org-admin eller DPO for å se GDPR-forespørsler.</WarningBox>
  }

  return (
    <ModuleSectionCard
      title="GDPR Individrettigheter (Art. 15-21)"
      description="Forespørsler om innsyn, sletting, retting, portabilitet osv. 30-dagers svarfrist (Art. 12 (3))."
      icon={UserSearch}
    >
      {error ? <WarningBox>{error}</WarningBox> : null}

      <div className="mb-4">
        <Button type="button" variant="primary" onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-1 h-3 w-3" />
          {showForm ? 'Lukk' : 'Registrer forespørsel'}
        </Button>
      </div>

      {showForm ? (
        <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50/50 p-4">
          <div className="mb-2 text-sm font-semibold text-emerald-900">Ny forespørsel — 30 dagers frist starter</div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700">Navn</label>
              <StandardInput
                value={form.subject_name}
                onChange={(e) => setForm((f) => ({ ...f, subject_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700">E-post (valgfritt)</label>
              <StandardInput
                value={form.subject_email}
                onChange={(e) => setForm((f) => ({ ...f, subject_email: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700">Type</label>
              <SearchableSelect
                value={form.request_type}
                options={REQUEST_TYPES}
                onChange={(v) => setForm((f) => ({ ...f, request_type: v as string }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700">Beskrivelse</label>
              <StandardTextarea
                rows={3}
                value={form.request_description}
                onChange={(e) => setForm((f) => ({ ...f, request_description: e.target.value }))}
                placeholder="Hva forespør personen?"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={createRequest}
              disabled={saving || !form.subject_name || !form.request_description}
            >
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Registrer
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Henter…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
          Ingen forespørsler registrert.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const days = daysLeft(r.deadline_at)
            const active = !['completed', 'denied'].includes(r.status)
            return (
              <div key={r.id} className={`rounded-lg border bg-white p-4 ${active && days < 7 ? 'border-red-300' : 'border-neutral-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <span>{r.subject_name}</span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase text-neutral-700">
                        {REQUEST_TYPES.find((t) => t.value === r.request_type)?.label ?? r.request_type}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase text-neutral-700">
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-600">{r.request_description}</p>
                    <div className={`mt-2 flex items-center gap-1 text-xs ${deadlineColor(days, r.status)}`}>
                      <Clock className="h-3 w-3" />
                      {active
                        ? days < 0
                          ? `FORFALT for ${Math.abs(days)} dager siden`
                          : `${days} dager igjen av 30-dagers-fristen`
                        : r.response_at
                          ? `Avsluttet ${new Date(r.response_at).toLocaleDateString('nb-NO')}`
                          : 'Avsluttet'}
                    </div>
                  </div>
                  {active ? (
                    <div className="flex flex-col gap-1">
                      {r.status === 'received' && !r.subject_identity_verified ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => updateStatus(r.id, 'identity_check')}
                        >
                          Verifiser ID
                        </Button>
                      ) : null}
                      {r.status === 'identity_check' || r.status === 'received' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => updateStatus(r.id, 'in_progress')}
                        >
                          Start saksbehandling
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => {
                          const s = window.prompt('Sammendrag av svar:')
                          if (s) void updateStatus(r.id, 'completed', s)
                        }}
                      >
                        Fullfør
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </ModuleSectionCard>
  )
}
