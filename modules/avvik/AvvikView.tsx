import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AlertTriangle, CheckCircle2, ChevronRight, Plus, Search, X } from 'lucide-react'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { useAvvik } from './useAvvik'
import type { AvvikRow, AvvikSeverity, AvvikStatus } from './types'

type Props = { supabase: SupabaseClient | null }

// ── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<AvvikSeverity, string> = {
  low: 'Lav', medium: 'Middels', high: 'Høy', critical: 'Kritisk',
}
const SEVERITY_COLOR: Record<AvvikSeverity, string> = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-700',
}
const SEVERITY_ORDER: Record<AvvikSeverity, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
}
const STATUS_LABEL: Record<AvvikStatus, string> = {
  open: 'Åpent', in_progress: 'Under behandling', closed: 'Lukket',
}
const STATUS_COLOR: Record<AvvikStatus, string> = {
  open: 'bg-red-50 text-red-700',
  in_progress: 'bg-yellow-50 text-yellow-700',
  closed: 'bg-green-50 text-green-700',
}
const STATUS_NEXT: Partial<Record<AvvikStatus, AvvikStatus>> = {
  open: 'in_progress',
  in_progress: 'closed',
}

const PANEL_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-700'
const PANEL_INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'

function formatDate(v: string | null) {
  if (!v) return '—'
  try { return new Date(v).toLocaleDateString('nb-NO', { dateStyle: 'short' }) } catch { return v }
}

// ── Avvik detail panel ────────────────────────────────────────────────────────

type PanelTab = 'detaljer' | 'status' | 'historikk'
const PANEL_TABS: Record<PanelTab, string> = {
  detaljer: 'Detaljer',
  status: 'Status & handling',
  historikk: 'Historikk',
}

function HistorikkTab({
  avvik,
  supabase,
}: {
  avvik: AvvikRow
  supabase: SupabaseClient | null
}) {
  const [rows, setRows] = useState<
    { id: string; action: string; changed_at: string; changed_by: string | null; changed_fields: string[] | null }[]
  >([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    setLoading(true)
    void supabase
      .from('hse_audit_log')
      .select('id, action, changed_at, changed_by, changed_fields')
      .eq('record_id', avvik.id)
      .order('changed_at', { ascending: false })
      .limit(50)
      .then(({ data, error: err }) => {
        setLoading(false)
        if (err) { setError(err.message); return }
        setRows(
          (data ?? []).map((r) => ({
            id: r.id as string,
            action: r.action as string,
            changed_at: r.changed_at as string,
            changed_by: r.changed_by as string | null,
            changed_fields: Array.isArray(r.changed_fields) ? (r.changed_fields as string[]) : null,
          })),
        )
      })
  }, [supabase, avvik.id])

  if (loading) return <p className="px-5 py-8 text-center text-sm text-neutral-400">Laster historikk…</p>
  if (error) return <p className="px-5 py-6 text-center text-sm text-red-500">{error}</p>
  if (rows.length === 0) return <p className="px-5 py-8 text-center text-sm text-neutral-400">Ingen loggoppføringer ennå.</p>

  const ACTION_LABEL: Record<string, string> = { INSERT: 'Opprettet', UPDATE: 'Endret', DELETE: 'Slettet' }
  const ACTION_COLOR: Record<string, string> = {
    INSERT: 'bg-green-100 text-green-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
  }

  const SKIP_FIELDS = new Set(['updated_at', 'changed_at'])

  return (
    <div className="divide-y divide-neutral-100 px-5 py-2">
      {rows.map((row) => {
        const fields = (row.changed_fields ?? []).filter((f) => !SKIP_FIELDS.has(f))
        return (
          <div key={row.id} className="flex items-start gap-3 py-3">
            <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${ACTION_COLOR[row.action] ?? 'bg-neutral-100 text-neutral-600'}`}>
              {ACTION_LABEL[row.action] ?? row.action}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-neutral-500">
                {new Date(row.changed_at).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
              {fields.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {fields.map((f) => (
                    <span key={f} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{f}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AvvikPanel({
  avvik: initialAvvik,
  module,
  supabase,
  onClose,
  onDeleted,
}: {
  avvik: AvvikRow
  module: ReturnType<typeof useAvvik>
  supabase: SupabaseClient | null
  onClose: () => void
  onDeleted: () => void
}) {
  const avvik = module.avvik.find((a) => a.id === initialAvvik.id) ?? initialAvvik
  const [tab, setTab] = useState<PanelTab>('detaljer')
  const [title, setTitle] = useState(avvik.title)
  const [description, setDescription] = useState(avvik.description)
  const [severity, setSeverity] = useState<AvvikSeverity>(avvik.severity)
  const [dueAt, setDueAt] = useState(avvik.due_at ? avvik.due_at.slice(0, 10) : '')
  const [assignedTo, setAssignedTo] = useState(avvik.assigned_to ?? '')
  const [rootCause, setRootCause] = useState(avvik.root_cause_analysis ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [advancingStatus, setAdvancingStatus] = useState(false)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  async function handleSave() {
    setSaving(true)
    await module.updateAvvik({
      avvikId: avvik.id,
      title,
      description,
      severity,
      dueAt: dueAt || null,
      assignedTo: assignedTo || null,
      rootCauseAnalysis: rootCause || null,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleAdvanceStatus() {
    const next = STATUS_NEXT[avvik.status]
    if (!next) return
    setAdvancingStatus(true)
    await module.updateAvvik({ avvikId: avvik.id, status: next })
    setAdvancingStatus(false)
  }

  async function handleDelete() {
    if (!window.confirm('Slett dette avviket? Handlingen kan ikke angres.')) return
    await module.deleteAvvik(avvik.id)
    onDeleted()
  }

  const isClosed = avvik.status === 'closed'
  const nextStatus = STATUS_NEXT[avvik.status]

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/45 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex h-full w-full max-w-[min(100vw,720px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]">
        {/* Header */}
        <div className="shrink-0 border-b border-neutral-200/90 bg-white px-6 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_COLOR[avvik.severity]}`}>
                  {SEVERITY_LABEL[avvik.severity]}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[avvik.status]}`}>
                  {STATUS_LABEL[avvik.status]}
                </span>
              </div>
              <h2 className="mt-1 text-base font-semibold text-neutral-900 line-clamp-2">{avvik.title}</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                {avvik.source !== 'manual' ? `Kilde: ${avvik.source}` : 'Manuelt registrert'}
                {avvik.created_at && ` · ${formatDate(avvik.created_at)}`}
              </p>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 rounded p-1 text-neutral-400 hover:bg-neutral-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 flex gap-0.5">
            {(Object.keys(PANEL_TABS) as PanelTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t ? 'border-b-2 border-[#1a3d32] text-[#1a3d32]' : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {PANEL_TABS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'detaljer' && (
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className={PANEL_FIELD_LABEL} htmlFor="avvik-title">Tittel</label>
                <input id="avvik-title" value={title} onChange={(e) => setTitle(e.target.value)}
                  readOnly={isClosed} className={PANEL_INPUT} />
              </div>
              <div>
                <label className={PANEL_FIELD_LABEL} htmlFor="avvik-desc">Beskrivelse</label>
                <textarea id="avvik-desc" rows={4} value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  readOnly={isClosed} className={`${PANEL_INPUT} resize-none`} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={PANEL_FIELD_LABEL} htmlFor="avvik-severity">Alvorlighetsgrad</label>
                  <select id="avvik-severity" value={severity} disabled={isClosed}
                    onChange={(e) => setSeverity(e.target.value as AvvikSeverity)} className={PANEL_INPUT}>
                    {(Object.keys(SEVERITY_LABEL) as AvvikSeverity[]).map((s) => (
                      <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={PANEL_FIELD_LABEL} htmlFor="avvik-due">Frist</label>
                  <input id="avvik-due" type="date" value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    readOnly={isClosed} className={PANEL_INPUT} />
                </div>
                <div className="sm:col-span-2">
                  <label className={PANEL_FIELD_LABEL} htmlFor="avvik-assigned">Ansvarlig</label>
                  <select id="avvik-assigned" value={assignedTo} disabled={isClosed}
                    onChange={(e) => setAssignedTo(e.target.value)} className={PANEL_INPUT}>
                    <option value="">(Ingen)</option>
                    {module.assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.displayName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={PANEL_FIELD_LABEL} htmlFor="avvik-rootcause">Rotårsaksanalyse</label>
                <textarea id="avvik-rootcause" rows={3} value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  readOnly={isClosed}
                  placeholder="Beskriv rotårsak for gjentakende avvik (IK-f krav)…"
                  className={`${PANEL_INPUT} resize-none`} />
              </div>
              {!isClosed && (
                <div className="flex items-center gap-3">
                  <button type="button" disabled={saving} onClick={() => void handleSave()}
                    className="rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: '#1a3d32' }}>
                    {saving ? 'Lagrer…' : saved ? 'Lagret ✓' : 'Lagre'}
                  </button>
                  {module.error && <span className="text-xs text-red-600">{module.error}</span>}
                </div>
              )}
            </div>
          )}

          {tab === 'status' && (
            <div className="space-y-4 px-6 py-5">
              {/* Status step indicator */}
              <div className="flex items-center gap-0">
                {(['open', 'in_progress', 'closed'] as AvvikStatus[]).map((s, i) => {
                  const done = (['open', 'in_progress', 'closed'] as AvvikStatus[]).indexOf(avvik.status) >= i
                  return (
                    <React.Fragment key={s}>
                      <div className={`flex flex-col items-center gap-1 ${i > 0 ? '' : ''}`}>
                        <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                          done ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-300 bg-white text-neutral-400'
                        }`}>{i + 1}</div>
                        <span className="text-[10px] text-neutral-500 whitespace-nowrap">{STATUS_LABEL[s]}</span>
                      </div>
                      {i < 2 && <div className={`mb-5 h-0.5 flex-1 ${done && avvik.status !== s ? 'bg-[#1a3d32]' : 'bg-neutral-200'}`} />}
                    </React.Fragment>
                  )
                })}
              </div>

              {/* Advance button */}
              {nextStatus && (
                <div className="rounded-none border border-neutral-200 bg-white p-4">
                  <p className="text-sm font-medium text-neutral-900">Neste steg: {STATUS_LABEL[nextStatus]}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {nextStatus === 'in_progress' && 'Marker avviket som under behandling.'}
                    {nextStatus === 'closed' && 'Marker avviket som lukket. Krever at tiltak er iverksatt og verifisert.'}
                  </p>
                  <button type="button" disabled={advancingStatus}
                    onClick={() => void handleAdvanceStatus()}
                    className="mt-3 rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: '#1a3d32' }}>
                    {advancingStatus ? 'Oppdaterer…' : `Flytt til "${STATUS_LABEL[nextStatus]}"`}
                  </button>
                </div>
              )}

              {isClosed && (
                <div className="rounded border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="text-sm font-semibold text-green-800">Avvik lukket</p>
                  </div>
                  {avvik.closed_at && (
                    <p className="mt-1 text-xs text-green-600">Lukket {formatDate(avvik.closed_at)}</p>
                  )}
                </div>
              )}

              {/* Danger zone */}
              {!isClosed && (
                <div className="rounded-none border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-800">Slett avvik</p>
                  <p className="mt-1 text-xs text-red-600">Permanent sletting. Kan ikke angres.</p>
                  <button type="button" onClick={() => void handleDelete()}
                    className="mt-3 rounded border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                    Slett avvik
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'historikk' && (
            <HistorikkTab avvik={avvik} supabase={supabase} />
          )}
        </div>

        <div className="shrink-0 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              {avvik.risk_score != null ? `Risikoskår: ${avvik.risk_score}` : 'Ingen risikoskår'}
            </span>
            <button type="button" onClick={onClose}
              className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
              Lukk
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Create avvik modal ────────────────────────────────────────────────────────

function CreateAvvikModal({
  module,
  onClose,
  onCreated,
}: {
  module: ReturnType<typeof useAvvik>
  onClose: () => void
  onCreated: (avvik: AvvikRow) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<AvvikSeverity>('high')
  const [dueAt, setDueAt] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!title.trim()) return
    setSaving(true)
    const result = await module.createAvvik({
      title, description, severity,
      dueAt: dueAt || undefined,
      assignedTo: assignedTo || undefined,
      source: 'manual',
    })
    setSaving(false)
    if (result) onCreated(result)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-none bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">Nytt avvik</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className={PANEL_FIELD_LABEL} htmlFor="new-avvik-title">Tittel *</label>
            <input id="new-avvik-title" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Kort beskrivelse av avviket…" className={PANEL_INPUT} />
          </div>
          <div>
            <label className={PANEL_FIELD_LABEL} htmlFor="new-avvik-desc">Beskrivelse</label>
            <textarea id="new-avvik-desc" rows={3} value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detaljert beskrivelse…" className={`${PANEL_INPUT} resize-none`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={PANEL_FIELD_LABEL} htmlFor="new-avvik-sev">Alvorlighet</label>
              <select id="new-avvik-sev" value={severity}
                onChange={(e) => setSeverity(e.target.value as AvvikSeverity)} className={PANEL_INPUT}>
                {(Object.keys(SEVERITY_LABEL) as AvvikSeverity[]).map((s) => (
                  <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={PANEL_FIELD_LABEL} htmlFor="new-avvik-due">Frist</label>
              <input id="new-avvik-due" type="date" value={dueAt}
                onChange={(e) => setDueAt(e.target.value)} className={PANEL_INPUT} />
            </div>
            <div className="sm:col-span-2">
              <label className={PANEL_FIELD_LABEL} htmlFor="new-avvik-assigned">Ansvarlig</label>
              <select id="new-avvik-assigned" value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)} className={PANEL_INPUT}>
                <option value="">(Ingen)</option>
                {module.assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName}</option>
                ))}
              </select>
            </div>
          </div>
          {module.error && <p className="text-xs text-red-600">{module.error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-6 py-4">
          <button type="button" onClick={onClose}
            className="rounded border border-neutral-300 px-4 py-2 text-sm">Avbryt</button>
          <button type="button" disabled={!title.trim() || saving}
            onClick={() => void handleCreate()}
            className="rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: '#1a3d32' }}>
            {saving ? 'Oppretter…' : 'Opprett avvik'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS: { value: 'all' | AvvikStatus; label: string }[] = [
  { value: 'all', label: 'Alle statuser' },
  { value: 'open', label: 'Åpne' },
  { value: 'in_progress', label: 'Under behandling' },
  { value: 'closed', label: 'Lukket' },
]

const SEVERITY_FILTER_OPTIONS: { value: 'all' | AvvikSeverity; label: string }[] = [
  { value: 'all', label: 'Alle alvorligheter' },
  { value: 'critical', label: 'Kritisk' },
  { value: 'high', label: 'Høy' },
  { value: 'medium', label: 'Middels' },
  { value: 'low', label: 'Lav' },
]

export function AvvikView({ supabase }: Props) {
  const module = useAvvik({ supabase })
  const { load } = module
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AvvikStatus>('all')
  const [severityFilter, setSeverityFilter] = useState<'all' | AvvikSeverity>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => { void load() }, [load])

  const selectedAvvik = useMemo(
    () => module.avvik.find((a) => a.id === selectedId) ?? null,
    [module.avvik, selectedId],
  )

  const filtered = useMemo(() => {
    let list = [...module.avvik].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    )
    if (statusFilter !== 'all') list = list.filter((a) => a.status === statusFilter)
    if (severityFilter !== 'all') list = list.filter((a) => a.severity === severityFilter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
    return list
  }, [module.avvik, statusFilter, severityFilter, search])

  const stats = useMemo(() => {
    const open = module.avvik.filter((a) => a.status === 'open').length
    const inProgress = module.avvik.filter((a) => a.status === 'in_progress').length
    const critical = module.avvik.filter((a) => a.severity === 'critical' && a.status !== 'closed').length
    return { open, inProgress, critical }
  }, [module.avvik])

  const overdue = useCallback(
    (a: AvvikRow) => a.due_at && a.status !== 'closed' && new Date(a.due_at) < new Date(),
    [],
  )

  return (
    <div className="space-y-6">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'HMS' }, { label: 'Avvik' }]}
        title="Avviksregister"
        description="Alle avvik på tvers av inspeksjoner og meldinger — IK-forskriften § 5 nr. 7."
        headerActions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: '#2D403A' }}
          >
            <Plus className="h-4 w-4" />
            Nytt avvik
          </button>
        }
      />

      <LayoutScoreStatRow
        items={[
          { big: String(stats.open), title: 'Åpne avvik', sub: 'Krever handling' },
          { big: String(stats.inProgress), title: 'Under behandling', sub: 'Tiltak pågår' },
          { big: String(stats.critical), title: 'Kritiske (åpne)', sub: 'Høyeste prioritet' },
        ]}
      />

      <LayoutTable1PostingsShell
        wrap
        title="Avvik"
        description="Sortert etter alvorlighetsgrad — kritiske øverst."
        headerActions={
          module.error ? <span className="text-xs text-red-600">{module.error}</span> : undefined
        }
        toolbar={
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk i tittel, beskrivelse…"
                className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              {SEVERITY_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        }
        footer={
          <span className="text-neutral-500">
            {search.trim() || statusFilter !== 'all' || severityFilter !== 'all'
              ? `${filtered.length} treff`
              : `${module.avvik.length} avvik totalt`}
          </span>
        }
      >
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Alvorlighet</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kilde</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Frist</th>
              <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr
                key={a.id}
                className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                onClick={() => setSelectedId(a.id)}
              >
                <td className="px-5 py-3">
                  <span className="font-medium text-neutral-900">{a.title}</span>
                  {overdue(a) && (
                    <span className="ml-2 inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                      <AlertTriangle className="h-3 w-3" /> Forfalt
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_COLOR[a.severity]}`}>
                    {SEVERITY_LABEL[a.severity]}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </td>
                <td className="px-5 py-3 text-neutral-500 text-xs">{a.source}</td>
                <td className="px-5 py-3 text-neutral-600">{formatDate(a.due_at)}</td>
                <td className="px-3 py-3 text-neutral-300">
                  <ChevronRight className="h-4 w-4" />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-neutral-400">
                  {module.loading ? 'Laster avvik…' : 'Ingen avvik matcher filteret.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </LayoutTable1PostingsShell>

      {selectedAvvik && (
        <AvvikPanel
          avvik={selectedAvvik}
          module={module}
          supabase={supabase}
          onClose={() => setSelectedId(null)}
          onDeleted={() => setSelectedId(null)}
        />
      )}

      {createOpen && (
        <CreateAvvikModal
          module={module}
          onClose={() => setCreateOpen(false)}
          onCreated={(a) => { setCreateOpen(false); setSelectedId(a.id) }}
        />
      )}
    </div>
  )
}
