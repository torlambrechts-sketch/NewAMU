import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SlidePanel } from '../layout/SlidePanel'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_INPUT_ON_WHITE,
  WPSTD_FORM_INSET,
} from '../layout/WorkplaceStandardFormPanel'
import { WORKPLACE_PAGE_SERIF } from '../layout/WorkplacePageHeading1'
import { RiskMatrix } from './RiskMatrix'

export type DeviationRow = {
  id: string
  organization_id: string
  source: string
  source_id: string | null
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'rapportert' | 'under_behandling' | 'tiltak_iverksatt' | 'lukket'
  risk_probability: number | null
  risk_consequence: number | null
  risk_score: number | null
  root_cause_analysis: string | null
  is_recurring: boolean
  recurrence_notes: string | null
  due_at: string | null
  closed_at: string | null
  closed_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type ActionPlanItemRow = {
  id: string
  organization_id: string
  title: string
  description: string
  responsible_id: string | null
  due_at: string
  status: string
  completed_at: string | null
  created_at: string
}

type AuditLogRow = {
  id: string
  action: string
  changed_by: string | null
  changed_at: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_fields: string[] | null
}

type ProfileOption = { id: string; display_name: string | null; email: string | null }

export interface DeviationPanelProps {
  deviationId: string
  supabase: SupabaseClient | null
  onClose: () => void
  onUpdated?: (deviation: DeviationRow) => void
}

const STATUS_FLOW = [
  { key: 'rapportert' as const, label: 'Rapportert' },
  { key: 'under_behandling' as const, label: 'Under behandling' },
  { key: 'tiltak_iverksatt' as const, label: 'Tiltak iverksatt' },
  { key: 'lukket' as const, label: 'Lukket' },
]

function statusIndex(s: DeviationRow['status']): number {
  return STATUS_FLOW.findIndex((x) => x.key === s)
}

function mapDeviationRow(raw: Record<string, unknown>): DeviationRow {
  return {
    id: String(raw.id),
    organization_id: String(raw.organization_id),
    source: String(raw.source ?? ''),
    source_id: raw.source_id == null ? null : String(raw.source_id),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    severity: raw.severity as DeviationRow['severity'],
    status: raw.status as DeviationRow['status'],
    risk_probability: raw.risk_probability == null ? null : Number(raw.risk_probability),
    risk_consequence: raw.risk_consequence == null ? null : Number(raw.risk_consequence),
    risk_score: raw.risk_score == null ? null : Number(raw.risk_score),
    root_cause_analysis: raw.root_cause_analysis == null ? null : String(raw.root_cause_analysis),
    is_recurring: Boolean(raw.is_recurring),
    recurrence_notes: raw.recurrence_notes == null ? null : String(raw.recurrence_notes),
    due_at: raw.due_at == null ? null : String(raw.due_at),
    closed_at: raw.closed_at == null ? null : String(raw.closed_at),
    closed_by: raw.closed_by == null ? null : String(raw.closed_by),
    created_by: raw.created_by == null ? null : String(raw.created_by),
    created_at: String(raw.created_at ?? ''),
    updated_at: String(raw.updated_at ?? ''),
  }
}

type TabId = 'detaljer' | 'risiko' | 'rotarsak' | 'handlingsplan' | 'historikk'

export function DeviationPanel({ deviationId, supabase, onClose, onUpdated }: DeviationPanelProps) {
  const titleId = `deviation-panel-title-${deviationId}`

  const [tab, setTab] = useState<TabId>('detaljer')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deviation, setDeviation] = useState<DeviationRow | null>(null)
  const [actions, setActions] = useState<ActionPlanItemRow[]>([])
  const [audit, setAudit] = useState<AuditLogRow[]>([])
  const [profiles, setProfiles] = useState<ProfileOption[]>([])

  const [draftTitle, setDraftTitle] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftSeverity, setDraftSeverity] = useState<DeviationRow['severity']>('medium')
  const [savingDetails, setSavingDetails] = useState(false)

  const [draftRootCause, setDraftRootCause] = useState('')
  const [draftRecurring, setDraftRecurring] = useState(false)
  const [draftRecurrenceNotes, setDraftRecurrenceNotes] = useState('')
  const [savingRoot, setSavingRoot] = useState(false)

  const [newActionTitle, setNewActionTitle] = useState('')
  const [newActionResponsible, setNewActionResponsible] = useState<string>('')
  const [newActionDue, setNewActionDue] = useState('')
  const [addingAction, setAddingAction] = useState(false)

  const [savingStatus, setSavingStatus] = useState(false)

  const profileLabel = useCallback(
    (id: string | null) => {
      if (!id) return '—'
      const p = profiles.find((x) => x.id === id)
      if (!p) return id.slice(0, 8) + '…'
      return p.display_name?.trim() || p.email || id.slice(0, 8) + '…'
    },
    [profiles],
  )

  const loadAll = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      setError('Ingen databasekobling.')
      return
    }
    setLoading(true)
    setError(null)
    const { data: devData, error: devErr } = await supabase
      .from('deviations')
      .select('*')
      .eq('id', deviationId)
      .maybeSingle()

    if (devErr || !devData) {
      setDeviation(null)
      setError(devErr?.message ?? 'Fant ikke avviket.')
      setLoading(false)
      return
    }

    const row = mapDeviationRow(devData as Record<string, unknown>)
    setDeviation(row)
    setDraftTitle(row.title)
    setDraftDescription(row.description)
    setDraftSeverity(row.severity)
    setDraftRootCause(row.root_cause_analysis ?? '')
    setDraftRecurring(row.is_recurring)
    setDraftRecurrenceNotes(row.recurrence_notes ?? '')

    const orgId = row.organization_id

    const [apRes, auditRes, profRes] = await Promise.all([
      supabase
        .from('action_plan_items')
        .select('id, organization_id, title, description, responsible_id, due_at, status, completed_at, created_at')
        .eq('source_table', 'deviations')
        .eq('source_id', deviationId)
        .order('due_at', { ascending: true }),
      supabase
        .from('hse_audit_log')
        .select('id, action, changed_by, changed_at, old_data, new_data, changed_fields')
        .eq('record_id', deviationId)
        .eq('table_name', 'deviations')
        .order('changed_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, display_name, email')
        .eq('organization_id', orgId)
        .order('display_name'),
    ])

    if (apRes.error) setError((e) => (e ? `${e}; ` : '') + `Handlingsplan: ${apRes.error.message}`)
    else setActions((apRes.data ?? []) as ActionPlanItemRow[])

    if (auditRes.error) setError((e) => (e ? `${e}; ` : '') + `Historikk: ${auditRes.error.message}`)
    else setAudit((auditRes.data ?? []) as AuditLogRow[])

    if (profRes.error) setError((e) => (e ? `${e}; ` : '') + `Profiler: ${profRes.error.message}`)
    else setProfiles((profRes.data ?? []) as ProfileOption[])

    setLoading(false)
  }, [deviationId, supabase])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const refreshDeviationOnly = useCallback(async () => {
    if (!supabase) return
    const { data, error: err } = await supabase.from('deviations').select('*').eq('id', deviationId).maybeSingle()
    if (!err && data) {
      const row = mapDeviationRow(data as Record<string, unknown>)
      setDeviation(row)
      onUpdated?.(row)
    }
  }, [supabase, deviationId, onUpdated])

  async function saveDetails() {
    if (!supabase || !deviation) return
    setSavingDetails(true)
    const { error: err } = await supabase
      .from('deviations')
      .update({
        title: draftTitle.trim(),
        description: draftDescription,
        severity: draftSeverity,
      })
      .eq('id', deviation.id)
    setSavingDetails(false)
    if (err) {
      window.alert(err.message)
      return
    }
    await refreshDeviationOnly()
    void loadAll()
  }

  async function saveRisk(p: number, c: number) {
    if (!supabase || !deviation || deviation.status === 'lukket') return
    const { error: err } = await supabase
      .from('deviations')
      .update({ risk_probability: p, risk_consequence: c })
      .eq('id', deviation.id)
    if (err) {
      window.alert(err.message)
      return
    }
    await refreshDeviationOnly()
    void loadAll()
  }

  async function saveRootCause() {
    if (!supabase || !deviation) return
    if (draftRecurring && !draftRootCause.trim()) {
      window.alert('Rotårsaksanalyse er påkrevd når avviket er gjentakende.')
      return
    }
    setSavingRoot(true)
    const { error: err } = await supabase
      .from('deviations')
      .update({
        root_cause_analysis: draftRootCause.trim() || null,
        is_recurring: draftRecurring,
        recurrence_notes: draftRecurrenceNotes.trim() || null,
      })
      .eq('id', deviation.id)
    setSavingRoot(false)
    if (err) {
      window.alert(err.message)
      return
    }
    await refreshDeviationOnly()
    void loadAll()
  }

  async function addActionPlanItem() {
    if (!supabase || !deviation) return
    if (!newActionTitle.trim()) {
      window.alert('Tittel er påkrevd.')
      return
    }
    if (!newActionDue) {
      window.alert('Frist er påkrevd.')
      return
    }
    const dueIso = new Date(newActionDue + 'T12:00:00').toISOString()
    setAddingAction(true)
    const { error: err } = await supabase.from('action_plan_items').insert({
      organization_id: deviation.organization_id,
      source_table: 'deviations',
      source_id: deviation.id,
      title: newActionTitle.trim(),
      description: '',
      responsible_id: newActionResponsible || null,
      due_at: dueIso,
      status: 'open',
    })
    setAddingAction(false)
    if (err) {
      window.alert(err.message)
      return
    }
    setNewActionTitle('')
    setNewActionResponsible('')
    setNewActionDue('')
    void loadAll()
  }

  const applyStatus = useCallback(
    async (next: DeviationRow['status']) => {
      if (!supabase || !deviation) return
      const cur = statusIndex(deviation.status)
      const nxt = statusIndex(next)
      if (nxt < cur) return
      if (next === deviation.status) return
      if (next === 'lukket') {
        const ok = window.confirm(
          'Lukking av avviket er endelig. Du kan ikke flytte avviket tilbake til en tidligere fase. Vil du fortsette?',
        )
        if (!ok) return
      }
      setSavingStatus(true)
      const { error: err } = await supabase.from('deviations').update({ status: next }).eq('id', deviation.id)
      setSavingStatus(false)
      if (err) {
        window.alert(err.message)
        return
      }
      await refreshDeviationOnly()
      void loadAll()
    },
    [supabase, deviation, loadAll, refreshDeviationOnly],
  )

  const tabs: { id: TabId; label: string }[] = [
    { id: 'detaljer', label: 'Detaljer' },
    { id: 'risiko', label: 'Risiko' },
    { id: 'rotarsak', label: 'Rotårsak' },
    { id: 'handlingsplan', label: 'Handlingsplan' },
    { id: 'historikk', label: 'Historikk' },
  ]

  const workflowBar = useMemo(() => {
    if (!deviation) return null
    const curIdx = statusIndex(deviation.status)
    return (
      <div className="flex flex-wrap items-center gap-1 text-xs sm:text-sm">
        {STATUS_FLOW.map((step, i) => {
          const isCurrent = step.key === deviation.status
          const isPast = i < curIdx
          const canClick =
            !savingStatus &&
            deviation.status !== 'lukket' &&
            i > curIdx &&
            step.key !== deviation.status
          const base =
            'rounded-md px-2 py-1.5 font-medium transition sm:px-3 ' +
            (isCurrent
              ? 'bg-neutral-900 text-white'
              : isPast
                ? 'bg-neutral-200 text-neutral-700'
                : 'bg-neutral-100 text-neutral-500')
          return (
            <span key={step.key} className="flex items-center gap-1">
              {i > 0 && <span className="text-neutral-400" aria-hidden="true">→</span>}
              <button
                type="button"
                disabled={!canClick}
                title={
                  deviation.status === 'lukket'
                    ? 'Avviket er lukket'
                    : i <= curIdx
                      ? 'Kan ikke flytte bakover'
                      : `Sett status til ${step.label}`
                }
                className={
                  base +
                  (canClick
                    ? ' cursor-pointer hover:bg-neutral-800 hover:text-white'
                    : ' cursor-default') +
                  (!canClick && !isCurrent ? ' opacity-80' : '')
                }
                onClick={() => {
                  if (canClick) void applyStatus(step.key)
                }}
              >
                {step.label}
              </button>
            </span>
          )
        })}
      </div>
    )
  }, [deviation, savingStatus, applyStatus])

  const tabStrip = (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-neutral-200 pb-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          className={
            'rounded-md px-3 py-2 text-sm font-medium ' +
            (tab === t.id ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100')
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  )

  const body = (
    <div className="space-y-6">
      {error && !deviation && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      )}
      {loading && <p className="text-sm text-neutral-600">Laster…</p>}
      {!loading && deviation && (
        <>
          <div className="rounded-lg border border-neutral-200 bg-white/80 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</p>
            {workflowBar}
          </div>
          {tabStrip}
          {tab === 'detaljer' && (
            <div className={WPSTD_FORM_INSET + ' space-y-4'}>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="dev-title">
                  Tittel
                </label>
                <input
                  id="dev-title"
                  className={WPSTD_FORM_INPUT_ON_WHITE}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  disabled={deviation.status === 'lukket'}
                />
              </div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="dev-desc">
                  Beskrivelse
                </label>
                <textarea
                  id="dev-desc"
                  rows={5}
                  className={WPSTD_FORM_INPUT_ON_WHITE}
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  disabled={deviation.status === 'lukket'}
                />
              </div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="dev-sev">
                  Alvorlighetsgrad
                </label>
                <select
                  id="dev-sev"
                  className={WPSTD_FORM_INPUT_ON_WHITE}
                  value={draftSeverity}
                  onChange={(e) => setDraftSeverity(e.target.value as DeviationRow['severity'])}
                  disabled={deviation.status === 'lukket'}
                >
                  <option value="low">Lav</option>
                  <option value="medium">Middels</option>
                  <option value="high">Høy</option>
                  <option value="critical">Kritisk</option>
                </select>
              </div>
              <div className="text-sm text-neutral-600">
                <span className="font-medium text-neutral-800">Kilde:</span> {deviation.source}
                {deviation.source_id ? (
                  <>
                    {' '}
                    <span className="font-mono text-xs">({deviation.source_id})</span>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={savingDetails || deviation.status === 'lukket'}
                onClick={() => void saveDetails()}
              >
                {savingDetails ? 'Lagrer…' : 'Lagre detaljer'}
              </button>
            </div>
          )}
          {tab === 'risiko' && (
            <div className={WPSTD_FORM_INSET}>
              <RiskMatrix
                probability={deviation.risk_probability}
                consequence={deviation.risk_consequence}
                readOnly={deviation.status === 'lukket'}
                size="md"
                onChange={deviation.status === 'lukket' ? undefined : (p, c) => void saveRisk(p, c)}
              />
            </div>
          )}
          {tab === 'rotarsak' && (
            <div className={WPSTD_FORM_INSET + ' space-y-4'}>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="dev-root">
                  Rotårsaksanalyse
                  {draftRecurring ? <span className="text-red-600"> *</span> : null}
                </label>
                <textarea
                  id="dev-root"
                  rows={6}
                  className={WPSTD_FORM_INPUT_ON_WHITE}
                  value={draftRootCause}
                  onChange={(e) => setDraftRootCause(e.target.value)}
                  disabled={deviation.status === 'lukket'}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  checked={draftRecurring}
                  onChange={(e) => setDraftRecurring(e.target.checked)}
                  disabled={deviation.status === 'lukket'}
                />
                Gjentakende avvik
              </label>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="dev-recnotes">
                  Merknader gjentakelse
                </label>
                <textarea
                  id="dev-recnotes"
                  rows={3}
                  className={WPSTD_FORM_INPUT_ON_WHITE}
                  value={draftRecurrenceNotes}
                  onChange={(e) => setDraftRecurrenceNotes(e.target.value)}
                  disabled={deviation.status === 'lukket'}
                />
              </div>
              <button
                type="button"
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={savingRoot || deviation.status === 'lukket'}
                onClick={() => void saveRootCause()}
              >
                {savingRoot ? 'Lagrer…' : 'Lagre rotårsak'}
              </button>
            </div>
          )}
          {tab === 'handlingsplan' && (
            <div className="space-y-6">
              <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
                {actions.length === 0 && (
                  <li className="px-4 py-6 text-sm text-neutral-500">Ingen tiltak registrert ennå.</li>
                )}
                {actions.map((a) => (
                  <li key={a.id} className="px-4 py-3 text-sm">
                    <div className="font-medium text-neutral-900">{a.title}</div>
                    <div className="mt-1 text-neutral-600">
                      Frist: {new Date(a.due_at).toLocaleDateString('nb-NO')} · Status: {a.status} · Ansvarlig:{' '}
                      {profileLabel(a.responsible_id)}
                    </div>
                  </li>
                ))}
              </ul>
              <div className={WPSTD_FORM_INSET + ' space-y-3'}>
                <p className="text-sm font-semibold text-neutral-800">Nytt tiltak</p>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ap-title">
                    Tittel
                  </label>
                  <input
                    id="ap-title"
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                    value={newActionTitle}
                    onChange={(e) => setNewActionTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ap-resp">
                    Ansvarlig
                  </label>
                  <select
                    id="ap-resp"
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                    value={newActionResponsible}
                    onChange={(e) => setNewActionResponsible(e.target.value)}
                  >
                    <option value="">— Velg bruker —</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name?.trim() || p.email || p.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ap-due">
                    Frist
                  </label>
                  <input
                    id="ap-due"
                    type="date"
                    className={WPSTD_FORM_INPUT_ON_WHITE}
                    value={newActionDue}
                    onChange={(e) => setNewActionDue(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  disabled={addingAction}
                  onClick={() => void addActionPlanItem()}
                >
                  {addingAction ? 'Legger til…' : 'Legg til tiltak'}
                </button>
              </div>
            </div>
          )}
          {tab === 'historikk' && (
            <ol className="space-y-4 border-l-2 border-neutral-200 pl-4">
              {audit.length === 0 && <li className="text-sm text-neutral-500">Ingen historikk funnet.</li>}
              {audit.map((entry) => (
                <li key={entry.id} className="relative text-sm">
                  <span className="absolute -left-[calc(0.5rem+2px)] top-1.5 size-2 rounded-full bg-neutral-400" />
                  <div className="font-medium text-neutral-900">
                    {entry.action} · {profileLabel(entry.changed_by)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {new Date(entry.changed_at).toLocaleString('nb-NO')}
                  </div>
                  {entry.changed_fields && entry.changed_fields.length > 0 && (
                    <div className="mt-1 text-xs text-neutral-600">
                      Felter: {entry.changed_fields.join(', ')}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )

  return (
    <SlidePanel
      open
      onClose={onClose}
      titleId={titleId}
      title={
        <span style={{ fontFamily: WORKPLACE_PAGE_SERIF }}>
          {deviation?.title?.trim() || 'Avvik'}
        </span>
      }
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            onClick={onClose}
          >
            Lukk
          </button>
        </div>
      }
    >
      {body}
    </SlidePanel>
  )
}
