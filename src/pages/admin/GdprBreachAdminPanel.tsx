// GdprBreachAdminPanel — administrasjon av brudd-hendelser etter
// GDPR Art. 33 (varsling Datatilsynet innen 72 t) og Art. 34
// (varsling til berørte ved høy risiko).
//
// Brukes av DPO + org-admin. Viser deadlines visuelt — rød < 24 t,
// gul < 48 t, grønn ellers.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock, Loader2, Plus, ShieldAlert } from 'lucide-react'
import { ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type Incident = {
  id: string
  detected_at: string
  deadline_at: string
  reported_to_datatilsynet_at: string | null
  reported_to_subjects_at: string | null
  resolved_at: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  breach_type: 'confidentiality' | 'integrity' | 'availability' | 'combined'
  title: string
  description: string
  affected_categories: string[]
  affected_subjects_estimate: number | null
  affected_subjects_actual: number | null
  risk_assessment: string | null
  mitigation_actions: string | null
  status: 'detected' | 'investigating' | 'reported' | 'resolved' | 'dismissed'
  datatilsynet_reference: string | null
  created_at: string
}

const SEVERITY: SelectOption[] = [
  { value: 'low', label: 'Lav' },
  { value: 'medium', label: 'Middels' },
  { value: 'high', label: 'Høy' },
  { value: 'critical', label: 'Kritisk' },
]

const BREACH_TYPE: SelectOption[] = [
  { value: 'confidentiality', label: 'Konfidensialitet — uautorisert tilgang' },
  { value: 'integrity', label: 'Integritet — endring/korrupsjon' },
  { value: 'availability', label: 'Tilgjengelighet — tap/utilgjengelighet' },
  { value: 'combined', label: 'Kombinert' },
]

const STATUS: SelectOption[] = [
  { value: 'detected', label: 'Oppdaget' },
  { value: 'investigating', label: 'Under undersøkelse' },
  { value: 'reported', label: 'Rapportert Datatilsynet' },
  { value: 'resolved', label: 'Avsluttet' },
  { value: 'dismissed', label: 'Avvist' },
]

const STATUS_LABEL: Record<string, string> = {
  detected: 'Oppdaget',
  investigating: 'Under undersøkelse',
  reported: 'Rapportert',
  resolved: 'Avsluttet',
  dismissed: 'Avvist',
}

function hoursLeft(deadline: string): number {
  return (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60)
}

function deadlineColor(hours: number, status: string): string {
  if (status === 'reported' || status === 'resolved' || status === 'dismissed') {
    return 'text-neutral-500'
  }
  if (hours < 0) return 'text-red-700 font-semibold'
  if (hours < 24) return 'text-red-700'
  if (hours < 48) return 'text-amber-700'
  return 'text-emerald-700'
}

export function GdprBreachAdminPanel() {
  const { supabase, organization, profile, user } = useOrgSetupContext()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'medium' as Incident['severity'],
    breach_type: 'confidentiality' as Incident['breach_type'],
    affected_subjects_estimate: '',
    risk_assessment: '',
    mitigation_actions: '',
  })

  const load = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('gdpr_breach_incidents')
        .select('*')
        .eq('organization_id', organization.id)
        .order('detected_at', { ascending: false })
      if (e) throw e
      setIncidents((data ?? []) as Incident[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id])

  useEffect(() => { void load() }, [load])

  async function createIncident() {
    if (!supabase || !organization?.id) return
    setSaving(true)
    setError(null)
    try {
      const { error: e } = await supabase.from('gdpr_breach_incidents').insert({
        organization_id: organization.id,
        title: form.title,
        description: form.description,
        severity: form.severity,
        breach_type: form.breach_type,
        affected_subjects_estimate: form.affected_subjects_estimate
          ? parseInt(form.affected_subjects_estimate, 10)
          : null,
        risk_assessment: form.risk_assessment || null,
        mitigation_actions: form.mitigation_actions || null,
        reporter_user_id: user?.id ?? null,
        status: 'detected',
      })
      if (e) throw e
      setShowForm(false)
      setForm({
        title: '',
        description: '',
        severity: 'medium',
        breach_type: 'confidentiality',
        affected_subjects_estimate: '',
        risk_assessment: '',
        mitigation_actions: '',
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke opprette')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: Incident['status']) {
    if (!supabase) return
    const patch: Record<string, unknown> = { status }
    if (status === 'reported') patch.reported_to_datatilsynet_at = new Date().toISOString()
    if (status === 'resolved') patch.resolved_at = new Date().toISOString()
    const { error: e } = await supabase
      .from('gdpr_breach_incidents')
      .update(patch)
      .eq('id', id)
    if (e) setError(e.message)
    else void load()
  }

  const sortedIncidents = useMemo(() => {
    return [...incidents].sort((a, b) => {
      const aActive = a.status === 'detected' || a.status === 'investigating'
      const bActive = b.status === 'detected' || b.status === 'investigating'
      if (aActive && !bActive) return -1
      if (!aActive && bActive) return 1
      return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
    })
  }, [incidents])

  const canManage = profile?.is_org_admin === true
  // TODO: utvid med DPO-rolle-sjekk når useOrgSetupContext eksporterer rolle-tildelinger

  if (!canManage) {
    return <WarningBox>Du må være org-admin eller ha rollen DPO for å se brudd-hendelser.</WarningBox>
  }

  return (
    <ModuleSectionCard
      title="GDPR brudd-hendelser"
      description="Registrer og spor brudd etter GDPR Art. 33 (varsling til Datatilsynet innen 72 timer) og Art. 34 (varsling til berørte ved høy risiko)."
      icon={ShieldAlert}
    >
      {error ? <WarningBox>{error}</WarningBox> : null}

      <div className="mb-4 flex gap-2">
        <Button type="button" variant="primary" onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-1 h-3 w-3" />
          {showForm ? 'Lukk skjema' : 'Registrer brudd'}
        </Button>
      </div>

      {showForm ? (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-900">
            <AlertTriangle className="h-4 w-4" />
            Nytt brudd — 72-timers-fristen starter NÅ
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700">Tittel</label>
              <StandardInput
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Kort beskrivelse av hendelsen"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-neutral-700">Alvorlighet</label>
                <SearchableSelect
                  value={form.severity}
                  options={SEVERITY}
                  onChange={(v) => setForm((f) => ({ ...f, severity: v as Incident['severity'] }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700">Type</label>
                <SearchableSelect
                  value={form.breach_type}
                  options={BREACH_TYPE}
                  onChange={(v) => setForm((f) => ({ ...f, breach_type: v as Incident['breach_type'] }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700">Beskrivelse</label>
              <StandardTextarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Hva har skjedd, hvilke data er berørt, hvordan ble det oppdaget"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700">Anslag antall berørte personer</label>
              <StandardInput
                type="number"
                value={form.affected_subjects_estimate}
                onChange={(e) => setForm((f) => ({ ...f, affected_subjects_estimate: e.target.value }))}
                placeholder="Estimat"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700">Risiko-vurdering</label>
              <StandardTextarea
                value={form.risk_assessment}
                onChange={(e) => setForm((f) => ({ ...f, risk_assessment: e.target.value }))}
                rows={2}
                placeholder="Sannsynlighet × konsekvens for de berørte"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700">Iverksatte tiltak</label>
              <StandardTextarea
                value={form.mitigation_actions}
                onChange={(e) => setForm((f) => ({ ...f, mitigation_actions: e.target.value }))}
                rows={2}
                placeholder="Tiltak for å begrense skade"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={createIncident}
              disabled={saving || !form.title || !form.description}
            >
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Registrer brudd
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Henter…
        </div>
      ) : incidents.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
          Ingen registrerte brudd. Bra. Trykk «Registrer brudd» ved hendelse.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedIncidents.map((i) => {
            const hrs = hoursLeft(i.deadline_at)
            const isActive = i.status === 'detected' || i.status === 'investigating'
            return (
              <div
                key={i.id}
                className={`rounded-lg border bg-white p-4 ${
                  isActive && hrs < 24 ? 'border-red-300' : 'border-neutral-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-neutral-900">{i.title}</h4>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          i.severity === 'critical'
                            ? 'bg-red-100 text-red-900'
                            : i.severity === 'high'
                              ? 'bg-orange-100 text-orange-900'
                              : i.severity === 'medium'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {SEVERITY.find((s) => s.value === i.severity)?.label}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-700">
                        {STATUS_LABEL[i.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-600">{i.description}</p>
                    <div className={`mt-2 flex items-center gap-1 text-xs ${deadlineColor(hrs, i.status)}`}>
                      <Clock className="h-3 w-3" />
                      {isActive
                        ? hrs < 0
                          ? `FORFALT for ${Math.abs(Math.floor(hrs))} timer siden`
                          : `${Math.floor(hrs)} timer igjen av 72-timers-fristen`
                        : i.reported_to_datatilsynet_at
                          ? `Rapportert ${new Date(i.reported_to_datatilsynet_at).toLocaleString('nb-NO')}`
                          : `Avsluttet ${new Date(i.resolved_at ?? i.created_at).toLocaleString('nb-NO')}`}
                    </div>
                    {i.affected_subjects_estimate ? (
                      <div className="mt-1 text-[11px] text-neutral-500">
                        Anslag berørte: {i.affected_subjects_estimate}
                      </div>
                    ) : null}
                  </div>
                  {isActive ? (
                    <div className="flex flex-col gap-1">
                      {i.status === 'detected' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => updateStatus(i.id, 'investigating')}
                        >
                          Start undersøkelse
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => updateStatus(i.id, 'reported')}
                      >
                        Rapportert til Datatilsynet
                      </Button>
                    </div>
                  ) : i.status === 'reported' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => updateStatus(i.id, 'resolved')}
                    >
                      Avslutt
                    </Button>
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
