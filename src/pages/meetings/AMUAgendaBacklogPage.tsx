// Møter — AMU agenda-restanser. Surfaces backlog rows emitted by
// add_amu_agenda_item when no upcoming meeting matched, so admins can
// manually knytte dem til et planlagt møte eller avvise med begrunnelse.
// Append-only avvisnings­log skrives av amu_backlog_dismiss(); auto-drenert
// historikk leses fra amu_agenda_backlog der drained_at IS NOT NULL.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Inbox,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { AticsModalFrame } from '../../components/ui/aticsPrimitives'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useMeetings } from '../../../modules/meetings'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import type { MeetingRow } from '../../../modules/meetings/types'

// ─── Types ────────────────────────────────────────────────────────────────

type BacklogRow = {
  id: string
  organization_id: string
  meeting_type: string
  title: string
  description: string | null
  source_module: string | null
  source_id: string | null
  priority: 'low' | 'normal' | 'high' | 'critical'
  drained_at: string | null
  drained_into: string | null
  created_at: string
}

type DrainedAgendaTitle = {
  id: string
  title: string
  meetingId: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const ACCENT = '#4338ca' // shared HMS overview accent — backlog crosses modules
const STALE_DAYS = 14
const RECENT_DRAIN_DAYS = 7

function ageInDays(created: string): number {
  const ms = Date.now() - new Date(created).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function priorityLabel(p: BacklogRow['priority']): string {
  switch (p) {
    case 'critical':
      return 'Kritisk'
    case 'high':
      return 'Høy'
    case 'low':
      return 'Lav'
    default:
      return 'Normal'
  }
}

function priorityToneClass(p: BacklogRow['priority']): string {
  switch (p) {
    case 'critical':
      return 'bg-red-100 text-red-800'
    case 'high':
      return 'bg-amber-100 text-amber-800'
    case 'low':
      return 'bg-neutral-100 text-neutral-600'
    default:
      return 'bg-indigo-100 text-indigo-800'
  }
}

function parseBacklogRow(raw: unknown): BacklogRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string') return null
  if (typeof r.organization_id !== 'string') return null
  if (typeof r.meeting_type !== 'string') return null
  if (typeof r.title !== 'string') return null
  if (typeof r.created_at !== 'string') return null
  const priorityRaw = typeof r.priority === 'string' ? r.priority : 'normal'
  const priority: BacklogRow['priority'] = (['low', 'normal', 'high', 'critical'] as const).includes(
    priorityRaw as BacklogRow['priority'],
  )
    ? (priorityRaw as BacklogRow['priority'])
    : 'normal'
  return {
    id: r.id,
    organization_id: r.organization_id,
    meeting_type: r.meeting_type,
    title: r.title,
    description: typeof r.description === 'string' ? r.description : null,
    source_module: typeof r.source_module === 'string' ? r.source_module : null,
    source_id: typeof r.source_id === 'string' ? r.source_id : null,
    priority,
    drained_at: typeof r.drained_at === 'string' ? r.drained_at : null,
    drained_into: typeof r.drained_into === 'string' ? r.drained_into : null,
    created_at: r.created_at,
  }
}

// Match a backlog row's meeting_type against a meeting — mirrors the
// SQL drainer in _20260907124400 so the "candidate meetings" preview
// agrees with what the trigger would actually drain on insert.
function meetingMatchesBacklog(b: BacklogRow, m: MeetingRow): boolean {
  if (m.status !== 'planned' && m.status !== 'in_progress') return false
  if (b.meeting_type && m.system_template_id && m.system_template_id === b.meeting_type) {
    return true
  }
  if (b.meeting_type === 'amu') {
    if (m.system_template_id && m.system_template_id.toLowerCase().startsWith('amu')) return true
    if (m.title && m.title.toUpperCase().startsWith('AMU')) return true
  }
  return false
}

function nextUpcomingCandidates(b: BacklogRow, meetings: MeetingRow[], limit = 3): MeetingRow[] {
  const now = Date.now()
  return meetings
    .filter((m) => meetingMatchesBacklog(b, m))
    .filter((m) => !m.scheduled_at || new Date(m.scheduled_at).getTime() >= now)
    .sort((a, c) => {
      const aT = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Number.POSITIVE_INFINITY
      const cT = c.scheduled_at ? new Date(c.scheduled_at).getTime() : Number.POSITIVE_INFINITY
      return aT - cT
    })
    .slice(0, limit)
}

// ─── Component ────────────────────────────────────────────────────────────

export function AMUAgendaBacklogPage() {
  const { supabase, organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const canManage = isAdmin || can('meetings.manage')
  const meetings = useMeetings()

  const [rows, setRows] = useState<BacklogRow[]>([])
  const [drainedAgendaTitles, setDrainedAgendaTitles] = useState<Map<string, DrainedAgendaTitle>>(
    new Map(),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyRowId, setBusyRowId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const [searchText, setSearchText] = useState('')
  const [maxAgeDays, setMaxAgeDays] = useState(180)
  const [selectedSourceModules, setSelectedSourceModules] = useState<Set<string>>(new Set())
  const [assignOpenFor, setAssignOpenFor] = useState<string | null>(null)
  const [dismissTarget, setDismissTarget] = useState<BacklogRow | null>(null)
  const [dismissReason, setDismissReason] = useState('')
  const [recentOpen, setRecentOpen] = useState(true)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const res = await supabase
        .from('amu_agenda_backlog')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(500)
      if (res.error) throw res.error
      const parsed: BacklogRow[] = []
      for (const raw of res.data ?? []) {
        const p = parseBacklogRow(raw)
        if (p) parsed.push(p)
      }
      setRows(parsed)

      // Resolve titles for drained_into agenda items so the recent-drained
      // collapsible can name the row that landed on each meeting.
      const drainedIds = parsed
        .map((r) => r.drained_into)
        .filter((v): v is string => typeof v === 'string')
      if (drainedIds.length > 0) {
        const aiRes = await supabase
          .from('meeting_agenda_items')
          .select('id, title, meeting_id')
          .in('id', drainedIds)
        const next = new Map<string, DrainedAgendaTitle>()
        for (const r of aiRes.data ?? []) {
          const obj = r as { id?: unknown; title?: unknown; meeting_id?: unknown }
          if (typeof obj.id === 'string' && typeof obj.title === 'string') {
            next.set(obj.id, {
              id: obj.id,
              title: obj.title,
              meetingId: typeof obj.meeting_id === 'string' ? obj.meeting_id : null,
            })
          }
        }
        setDrainedAgendaTitles(next)
      } else {
        setDrainedAgendaTitles(new Map())
      }
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void load()
  }, [load])

  // ── Derived ──────────────────────────────────────────────────────────────

  const pending = useMemo(() => rows.filter((r) => r.drained_at === null), [rows])
  const drained = useMemo(
    () =>
      rows
        .filter((r) => r.drained_at !== null)
        .sort((a, b) => (b.drained_at ?? '').localeCompare(a.drained_at ?? ''))
        .slice(0, 20),
    [rows],
  )

  const recentlyDrainedCount = useMemo(() => {
    const cutoff = Date.now() - RECENT_DRAIN_DAYS * 24 * 60 * 60 * 1000
    return rows.filter(
      (r) => r.drained_at !== null && new Date(r.drained_at).getTime() >= cutoff,
    ).length
  }, [rows])

  const stalePendingCount = useMemo(
    () => pending.filter((r) => ageInDays(r.created_at) > STALE_DAYS).length,
    [pending],
  )

  const sourceModuleOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of pending) {
      if (r.source_module) set.add(r.source_module)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'nb'))
  }, [pending])

  const filteredPending = useMemo(() => {
    const needle = searchText.trim().toLowerCase()
    return pending.filter((r) => {
      if (ageInDays(r.created_at) > maxAgeDays) return false
      if (selectedSourceModules.size > 0) {
        const key = r.source_module ?? '__none__'
        if (!selectedSourceModules.has(key)) return false
      }
      if (needle && !r.title.toLowerCase().includes(needle)) return false
      return true
    })
  }, [pending, maxAgeDays, searchText, selectedSourceModules])

  const meetingById = useMemo(() => {
    const map = new Map<string, MeetingRow>()
    for (const m of meetings.meetings) map.set(m.id, m)
    return map
  }, [meetings.meetings])

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleAssign(backlogId: string, meetingId: string) {
    if (!supabase) return
    setBusyRowId(backlogId)
    setActionMessage(null)
    try {
      const res = await supabase.rpc('amu_backlog_assign_to_meeting', {
        p_backlog_id: backlogId,
        p_meeting_id: meetingId,
      })
      if (res.error) throw res.error
      setActionMessage('Saken er knyttet til møtet.')
      setAssignOpenFor(null)
      await load()
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
    } finally {
      setBusyRowId(null)
    }
  }

  async function handleDismiss() {
    if (!supabase || !dismissTarget) return
    const reason = dismissReason.trim()
    if (!reason) {
      setError('Begrunnelse er påkrevd.')
      return
    }
    setBusyRowId(dismissTarget.id)
    setActionMessage(null)
    try {
      const res = await supabase.rpc('amu_backlog_dismiss', {
        p_id: dismissTarget.id,
        p_reason: reason,
      })
      if (res.error) throw res.error
      setActionMessage('Saken er avvist og loggført.')
      setDismissTarget(null)
      setDismissReason('')
      await load()
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
    } finally {
      setBusyRowId(null)
    }
  }

  function toggleSourceModule(key: string) {
    setSelectedSourceModules((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (!orgId) {
    return (
      <div className="mx-auto max-w-5xl p-6 text-sm text-neutral-600">
        Velg en organisasjon for å se restansene.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            HMS · Møter
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-neutral-900">
            <Inbox className="h-6 w-6" style={{ color: ACCENT }} aria-hidden />
            Agenda-restanser
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Saker som ble emittert av en arbeidsflyt, men som ikke fant et planlagt
            møte å lande på. Knytt dem manuelt til et kommende møte, eller avvis
            dem med en sporbar begrunnelse.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
          >
            Oppdater
          </Button>
          <Link to="/meetings">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<ArrowLeft className="h-3.5 w-3.5" aria-hidden />}
            >
              Tilbake til møter
            </Button>
          </Link>
        </div>
      </div>

      {/* Permission notice */}
      {!canManage ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Du kan se restansene, men trenger tilgangen <code>meetings.manage</code>{' '}
            for å knytte til møter eller avvise saker.
          </span>
        </div>
      ) : null}

      {/* Section A — KPI strip */}
      <section aria-label="Nøkkeltall" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="I kø"
          value={pending.length}
          icon={<Inbox className="h-4 w-4" aria-hidden />}
          tone="default"
        />
        <KpiCard
          label={`Ventet for lenge (>${STALE_DAYS} dager)`}
          value={stalePendingCount}
          icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
          tone={stalePendingCount > 0 ? 'warn' : 'default'}
        />
        <KpiCard
          label={`Nylig drenert (siste ${RECENT_DRAIN_DAYS} dager)`}
          value={recentlyDrainedCount}
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          tone="ok"
        />
      </section>

      {/* Flashes */}
      {actionMessage ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {actionMessage}
        </div>
      ) : null}
      {error ? (
        <div className="flex items-start justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="rounded p-0.5 text-red-700 hover:bg-red-100"
            aria-label="Lukk feilmelding"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {/* Section B — Backlog table */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">Saker i kø</h2>
          <span className="text-xs text-neutral-500">
            {filteredPending.length} av {pending.length}
          </span>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="block text-xs">
            <span className="mb-1 flex items-center gap-1.5 font-medium text-neutral-600">
              <Search className="h-3.5 w-3.5" aria-hidden />
              Søk i tittel
            </span>
            <StandardInput
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Skriv et søkeord …"
            />
          </label>
          <label className="block text-xs md:min-w-[14rem]">
            <span className="mb-1 flex items-center justify-between font-medium text-neutral-600">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Maks alder
              </span>
              <span className="font-normal text-neutral-500">{maxAgeDays} dager</span>
            </span>
            <input
              type="range"
              min={1}
              max={365}
              value={maxAgeDays}
              onChange={(e) => setMaxAgeDays(Number(e.target.value))}
              className="block w-full"
              aria-label="Maks alder i dager"
            />
          </label>
          <div className="block text-xs">
            <span className="mb-1 block font-medium text-neutral-600">Kilde-modul</span>
            <div className="flex flex-wrap gap-1.5">
              {sourceModuleOptions.length === 0 ? (
                <span className="text-neutral-400">Ingen kildemoduler i køen.</span>
              ) : (
                sourceModuleOptions.map((key) => {
                  const active = selectedSourceModules.has(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSourceModule(key)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        active
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                          : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
                      }`}
                      aria-pressed={active}
                    >
                      {key}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mt-5 overflow-x-auto">
          {loading ? (
            <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
              Laster restanser …
            </div>
          ) : filteredPending.length === 0 ? (
            <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
              {pending.length === 0
                ? 'Ingen saker i kø. Arbeidsflyt-saker som ikke finner et møte havner her.'
                : 'Ingen saker matcher filtrene.'}
            </div>
          ) : (
            <table className="w-full min-w-[60rem] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-neutral-500">
                  <th className="border-b border-neutral-200 px-3 py-2 font-medium">Opprettet</th>
                  <th className="border-b border-neutral-200 px-3 py-2 font-medium">Kilde</th>
                  <th className="border-b border-neutral-200 px-3 py-2 font-medium">Tittel</th>
                  <th className="border-b border-neutral-200 px-3 py-2 font-medium">Alder</th>
                  <th className="border-b border-neutral-200 px-3 py-2 font-medium">
                    Kandidat-møter
                  </th>
                  <th className="border-b border-neutral-200 px-3 py-2 font-medium text-right">
                    Handlinger
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.map((row) => {
                  const candidates = nextUpcomingCandidates(row, meetings.meetings, 3)
                  const stale = ageInDays(row.created_at) > STALE_DAYS
                  const open = assignOpenFor === row.id
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="border-b border-neutral-100 px-3 py-3 text-xs text-neutral-600">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="border-b border-neutral-100 px-3 py-3 text-xs text-neutral-700">
                        <div className="font-medium text-neutral-800">
                          {row.source_module ?? '—'}
                        </div>
                        <div className="mt-0.5 text-neutral-500">{row.source_id ?? '—'}</div>
                        <div className="mt-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityToneClass(row.priority)}`}
                          >
                            {priorityLabel(row.priority)}
                          </span>
                        </div>
                      </td>
                      <td className="border-b border-neutral-100 px-3 py-3">
                        <div className="font-medium text-neutral-900">{row.title}</div>
                        {row.description ? (
                          <p className="mt-1 text-xs text-neutral-600">{row.description}</p>
                        ) : null}
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-neutral-400">
                          møtetype: {row.meeting_type}
                        </p>
                      </td>
                      <td className="border-b border-neutral-100 px-3 py-3 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                            stale
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}
                        >
                          {ageInDays(row.created_at)} d
                        </span>
                      </td>
                      <td className="border-b border-neutral-100 px-3 py-3 text-xs text-neutral-700">
                        {candidates.length === 0 ? (
                          <span className="text-neutral-400">Ingen kommende møter matcher.</span>
                        ) : (
                          <ul className="space-y-1">
                            {candidates.map((m) => (
                              <li key={m.id} className="flex items-center gap-1.5">
                                <CalendarDays
                                  className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                                  aria-hidden
                                />
                                <span className="truncate">
                                  {m.title}
                                  <span className="ml-1 text-neutral-500">
                                    · {formatDate(m.scheduled_at)}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="border-b border-neutral-100 px-3 py-3 text-right text-xs">
                        <div className="relative inline-flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={!canManage || candidates.length === 0}
                              onClick={() => setAssignOpenFor(open ? null : row.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-40"
                              aria-expanded={open}
                              aria-haspopup="menu"
                            >
                              Knytt til møte
                              <ChevronDown className="h-3 w-3" aria-hidden />
                            </button>
                            <button
                              type="button"
                              disabled={!canManage}
                              onClick={() => {
                                setDismissTarget(row)
                                setDismissReason('')
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40"
                            >
                              Avvis
                            </button>
                          </div>
                          {open ? (
                            <div
                              role="menu"
                              className="absolute right-0 top-8 z-10 w-72 rounded-md border border-neutral-200 bg-white p-1.5 text-left shadow-lg"
                            >
                              {candidates.length === 0 ? (
                                <p className="px-2 py-1.5 text-xs text-neutral-500">
                                  Ingen møter å foreslå.
                                </p>
                              ) : (
                                candidates.map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    disabled={busyRowId === row.id}
                                    onClick={() => void handleAssign(row.id, m.id)}
                                    className="block w-full rounded px-2 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                                    role="menuitem"
                                  >
                                    <div className="font-medium">{m.title}</div>
                                    <div className="text-[11px] text-neutral-500">
                                      {formatDate(m.scheduled_at)} ·{' '}
                                      {m.system_template_id ?? 'fri agenda'}
                                    </div>
                                  </button>
                                ))
                              )}
                              <div className="mt-1 border-t border-neutral-100 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setAssignOpenFor(null)}
                                  className="block w-full rounded px-2 py-1.5 text-left text-[11px] text-neutral-500 hover:bg-neutral-50"
                                >
                                  Avbryt
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </ModuleSectionCard>

      {/* Section C — Recently drained */}
      <ModuleSectionCard className="p-5 md:p-6">
        <button
          type="button"
          onClick={() => setRecentOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={recentOpen}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            <span className="text-lg font-semibold text-neutral-900">
              Nylig knyttet til møte
            </span>
            <span className="text-xs text-neutral-500">{drained.length}</span>
          </span>
          {recentOpen ? (
            <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral-400" aria-hidden />
          )}
        </button>
        {recentOpen ? (
          drained.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">
              Ingen saker er drenert ennå. Når et matchende møte opprettes, drenes
              køen automatisk og listes her.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-neutral-100">
              {drained.map((row) => {
                const agenda = row.drained_into ? drainedAgendaTitles.get(row.drained_into) : null
                const meeting = agenda?.meetingId ? meetingById.get(agenda.meetingId) ?? null : null
                const meetingTitle = meeting?.title ?? null
                return (
                  <li key={row.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">{row.title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Drenert {formatDateTime(row.drained_at)}
                        {agenda ? <> · som «{agenda.title}»</> : null}
                        {meetingTitle ? <> · på {meetingTitle}</> : null}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] uppercase tracking-wide text-neutral-400">
                      {row.meeting_type}
                    </span>
                  </li>
                )
              })}
            </ul>
          )
        ) : null}
      </ModuleSectionCard>

      {/* Dismiss modal */}
      <AticsModalFrame
        open={dismissTarget !== null}
        title="Avvis sak fra køen"
        onClose={() => {
          setDismissTarget(null)
          setDismissReason('')
        }}
      >
        {dismissTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-700">
              Du er i ferd med å avvise saken{' '}
              <span className="font-semibold">«{dismissTarget.title}»</span>. Saken
              fjernes fra køen og handlingen loggføres i{' '}
              <code>amu_backlog_dismissal_log</code> (kun-tilføy).
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-neutral-700">
                Begrunnelse <span className="text-red-600">*</span>
              </span>
              <textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
                placeholder="Hvorfor avvises denne saken? (synlig i loggen)"
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDismissTarget(null)
                  setDismissReason('')
                }}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={busyRowId === dismissTarget.id || dismissReason.trim().length === 0}
                onClick={() => void handleDismiss()}
              >
                Avvis saken
              </Button>
            </div>
          </div>
        ) : null}
      </AticsModalFrame>
    </div>
  )
}

// ─── KPI card ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: ReactNode
  tone: 'default' | 'warn' | 'ok'
}) {
  const toneClass =
    tone === 'warn'
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : tone === 'ok'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
        : 'bg-white border-neutral-200 text-neutral-900'
  return (
    <div className={`rounded-lg border px-4 py-3 shadow-sm ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

export default AMUAgendaBacklogPage
