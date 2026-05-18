// Møter — AMU agenda-restanser. Surfaces backlog rows emitted by
// add_amu_agenda_item when no upcoming meeting matched, so admins can
// manually knytte dem til et planlagt møte eller avvise med begrunnelse.
// Append-only avvisnings­log skrives av amu_backlog_dismiss(); auto-drenert
// historikk leses fra amu_agenda_backlog der drained_at IS NOT NULL.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  RotateCcw,
  Search,
} from 'lucide-react'
import { ModulePageShell, ModulePageEmpty } from '../../components/module/ModulePageShell'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TD,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../components/layout/layoutTable1PostingsKit'
import { Badge, type BadgeVariant } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { InfoBox, WarningBox } from '../../components/ui/AlertBox'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import { FormModal } from '../../template'
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

function priorityBadgeVariant(p: BacklogRow['priority']): BadgeVariant {
  switch (p) {
    case 'critical':
      return 'critical'
    case 'high':
      return 'high'
    case 'low':
      return 'neutral'
    default:
      return 'info'
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
    if (reason.length < 10) {
      setError('Begrunnelse må være minst 10 tegn.')
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

  const breadcrumb = [
    { label: 'HMS' },
    { label: 'Møter', to: '/meetings' },
    { label: 'Agenda-restanser' },
  ]

  if (!orgId) {
    return (
      <ModulePageShell breadcrumb={breadcrumb} title="Agenda-restanser">
        <ModulePageEmpty
          title="Velg en organisasjon"
          description="Du må velge en organisasjon før restansene kan vises."
        />
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={breadcrumb}
      title="Agenda-restanser"
      description={
        <span className="text-sm text-neutral-600">
          Saker som ble emittert av en arbeidsflyt, men som ikke fant et planlagt
          møte å lande på. Knytt dem manuelt til et kommende møte, eller avvis dem
          med en sporbar begrunnelse.
        </span>
      }
      headerActions={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void load()}
          icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
        >
          Oppdater
        </Button>
      }
      loading={loading && rows.length === 0}
      loadingLabel="Laster restanser …"
    >
      {/* Permission notice */}
      {!canManage ? (
        <InfoBox>
          Du kan se restansene, men trenger tilgangen <code>meetings.manage</code>{' '}
          for å knytte til møter eller avvise saker.
        </InfoBox>
      ) : null}

      {/* KPI strip */}
      <LayoutScoreStatRow
        items={[
          {
            big: String(pending.length),
            title: 'I kø',
            sub: 'Saker som venter på et møte',
          },
          {
            big: String(stalePendingCount),
            title: `Ventet >${STALE_DAYS} dager`,
            sub: stalePendingCount > 0 ? 'Bør behandles' : 'Innenfor frist',
          },
          {
            big: String(recentlyDrainedCount),
            title: `Drenert siste ${RECENT_DRAIN_DAYS} dager`,
            sub: 'Knyttet til møte',
          },
        ]}
      />

      {/* Flashes */}
      {actionMessage ? <InfoBox>{actionMessage}</InfoBox> : null}
      {error ? <WarningBox>{error}</WarningBox> : null}

      {/* Section B — Backlog table */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">Saker i kø</h2>
          <Badge variant="neutral">
            {filteredPending.length} av {pending.length}
          </Badge>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="block">
            <span className={WPSTD_FORM_FIELD_LABEL}>
              <Search className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              Søk i tittel
            </span>
            <StandardInput
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Skriv et søkeord …"
              className="mt-1.5"
            />
          </label>
          <label className="block md:min-w-[14rem]">
            <span className={`${WPSTD_FORM_FIELD_LABEL} flex items-center justify-between`}>
              <span>
                <Clock className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                Maks alder
              </span>
              <span className="font-normal normal-case text-neutral-500">{maxAgeDays} dager</span>
            </span>
            <StandardInput
              type="range"
              min={1}
              max={365}
              value={maxAgeDays}
              onChange={(e) => setMaxAgeDays(Number(e.target.value))}
              className="mt-1.5 block w-full"
              aria-label="Maks alder i dager"
            />
          </label>
          <div className="block">
            <span className={WPSTD_FORM_FIELD_LABEL}>Kilde-modul</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {sourceModuleOptions.length === 0 ? (
                <span className="text-xs text-neutral-400">Ingen kildemoduler i køen.</span>
              ) : (
                sourceModuleOptions.map((key) => {
                  const active = selectedSourceModules.has(key)
                  return (
                    <Button
                      key={key}
                      variant={active ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => toggleSourceModule(key)}
                      aria-pressed={active}
                    >
                      {key}
                    </Button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mt-5 overflow-x-auto">
          {filteredPending.length === 0 ? (
            <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
              {pending.length === 0
                ? 'Ingen saker i kø. Arbeidsflyt-saker som ikke finner et møte havner her.'
                : 'Ingen saker matcher filtrene.'}
            </div>
          ) : (
            <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
              <thead>
                <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Opprettet</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kilde</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Alder</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kandidat-møter</th>
                  <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`}>Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.map((row) => {
                  const candidates = nextUpcomingCandidates(row, meetings.meetings, 3)
                  const stale = ageInDays(row.created_at) > STALE_DAYS
                  const open = assignOpenFor === row.id
                  return (
                    <tr key={row.id} className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} align-top`}>
                      <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-xs text-neutral-600`}>
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-xs text-neutral-700`}>
                        <div className="font-medium text-neutral-800">
                          {row.source_module ?? '—'}
                        </div>
                        <div className="mt-0.5 text-neutral-500">{row.source_id ?? '—'}</div>
                        <div className="mt-1.5">
                          <Badge variant={priorityBadgeVariant(row.priority)}>
                            {priorityLabel(row.priority)}
                          </Badge>
                        </div>
                      </td>
                      <td className={LAYOUT_TABLE1_POSTINGS_TD}>
                        <div className="font-medium text-neutral-900">{row.title}</div>
                        {row.description ? (
                          <p className="mt-1 text-xs text-neutral-600">{row.description}</p>
                        ) : null}
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-neutral-400">
                          møtetype: {row.meeting_type}
                        </p>
                      </td>
                      <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-xs`}>
                        <Badge variant={stale ? 'warning' : 'neutral'}>
                          {ageInDays(row.created_at)} d
                        </Badge>
                      </td>
                      <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-xs text-neutral-700`}>
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
                      <td className={`${LAYOUT_TABLE1_POSTINGS_TD} text-right text-xs`}>
                        <div className="relative inline-flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!canManage || candidates.length === 0}
                              onClick={() => setAssignOpenFor(open ? null : row.id)}
                              aria-expanded={open}
                              aria-haspopup="menu"
                              icon={<ChevronDown className="h-3 w-3" aria-hidden />}
                            >
                              Knytt til møte
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={!canManage}
                              onClick={() => {
                                setDismissTarget(row)
                                setDismissReason('')
                              }}
                            >
                              Avvis
                            </Button>
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
                                  <Button
                                    key={m.id}
                                    variant="ghost"
                                    disabled={busyRowId === row.id}
                                    onClick={() => void handleAssign(row.id, m.id)}
                                    className="block w-full rounded px-2 py-1.5 text-left text-xs font-normal text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                                    role="menuitem"
                                  >
                                    <div className="font-medium">{m.title}</div>
                                    <div className="text-[11px] text-neutral-500">
                                      {formatDate(m.scheduled_at)} ·{' '}
                                      {m.system_template_id ?? 'fri agenda'}
                                    </div>
                                  </Button>
                                ))
                              )}
                              <div className="mt-1 border-t border-neutral-100 pt-1">
                                <Button
                                  variant="ghost"
                                  onClick={() => setAssignOpenFor(null)}
                                  className="block w-full rounded px-2 py-1.5 text-left text-[11px] font-normal text-neutral-500 hover:bg-neutral-50"
                                >
                                  Avbryt
                                </Button>
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
        <Button
          variant="ghost"
          onClick={() => setRecentOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-none p-0 text-left font-normal hover:bg-transparent"
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
        </Button>
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
      <FormModal
        open={dismissTarget !== null}
        titleId="amu-backlog-dismiss-title"
        title="Avvis sak fra køen"
        onClose={() => {
          setDismissTarget(null)
          setDismissReason('')
        }}
        footer={
          <div className="flex w-full items-center justify-end gap-2">
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
              disabled={
                !dismissTarget ||
                busyRowId === dismissTarget.id ||
                dismissReason.trim().length < 10
              }
              onClick={() => void handleDismiss()}
            >
              Avvis saken
            </Button>
          </div>
        }
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
              <span className={WPSTD_FORM_FIELD_LABEL}>
                Begrunnelse <span className="text-red-600">*</span>{' '}
                <span className="font-normal normal-case text-neutral-500">
                  (minst 10 tegn)
                </span>
              </span>
              <StandardTextarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                rows={4}
                minLength={10}
                placeholder="Hvorfor avvises denne saken? (synlig i loggen)"
                className="mt-1.5"
              />
              {dismissReason.trim().length > 0 && dismissReason.trim().length < 10 ? (
                <p className="mt-1 text-xs text-red-700">Begrunnelse må være minst 10 tegn.</p>
              ) : null}
            </label>
          </div>
        ) : null}
      </FormModal>
    </ModulePageShell>
  )
}

export default AMUAgendaBacklogPage
