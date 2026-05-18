// Live Meeting Room — full-screen workspace mode for AMU and peers.
// Distinct from the list/detail/admin shells: it owns the viewport
// so the chair can navigate agenda + voting + attendance + speakers
// without secondary nav. Cyan accent per CLAUDE.md meetings palette.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Hand,
  Minus,
  PenLine,
  Play,
  Radio,
  ShieldCheck,
  ShieldAlert,
  Square,
  Users,
  X,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { WarningBox } from '../../components/ui/AlertBox'
import { useMeetings } from '../../../modules/meetings'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type {
  MeetingAgendaItemRow,
  MeetingBallot,
  MeetingParityCheck,
  MeetingSpeakerQueueRow,
  MeetingVoteResult,
  MeetingVotingModel,
} from '../../../modules/meetings/types'

const ACCENT = '#0891b2'
const VOTING_LABEL: Record<MeetingVotingModel, string> = {
  simple: 'Simpelt flertall',
  qualified: 'Kvalifisert (2/3)',
  parity: 'Paritet — AMU',
  consensus: 'Konsensus',
  anonymous: 'Hemmelig',
}

function formatElapsed(s: number): string {
  const hh = Math.floor(s / 3600)
    .toString()
    .padStart(2, '0')
  const mm = Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export default function MeetingLivePage() {
  const { id: meetingId = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const meetings = useMeetings()
  const { supabase } = useOrgSetupContext()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  // Elapsed is derived from `sessionStartedAt` (a persisted value) — we
  // never write elapsed_seconds back to the DB, so refresh/reconnect
  // recovers the true wall-clock duration without losing audit fidelity.
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [parityCheck, setParityCheck] = useState<MeetingParityCheck | null>(null)
  const [voteResult, setVoteResult] = useState<MeetingVoteResult | null>(null)
  const [speakerQueue, setSpeakerQueue] = useState<MeetingSpeakerQueueRow[]>([])
  const [sessionStarted, setSessionStarted] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (meetingId) void meetings.loadDetail(meetingId)
  }, [meetingId, meetings.loadDetail])

  const meeting = meetings.detail.meeting
  const agendaItems = meetings.detail.agendaItems

  const activeItem: MeetingAgendaItemRow | null = useMemo(() => {
    if (!activeItemId) return null
    return agendaItems.find((i) => i.id === activeItemId) ?? null
  }, [activeItemId, agendaItems])

  // Resolve session state on mount
  useEffect(() => {
    if (!meetingId) return
    let cancelled = false
    void meetings.loadLiveSession(meetingId).then((s) => {
      if (cancelled || !s) return
      setActiveItemId(s.active_agenda_item_id)
      setSessionStartedAt(s.started_at)
      setSessionStarted(s.ended_at === null)
      // Seed initial elapsed from the persisted started_at so the timer
      // is correct immediately, before the interval ticks.
      if (s.ended_at === null && s.started_at) {
        const ms = Date.now() - new Date(s.started_at).getTime()
        setElapsedSec(Math.max(0, Math.floor(ms / 1000)))
      }
    })
    return () => {
      cancelled = true
    }
  }, [meetingId, meetings.loadLiveSession])

  // Default the active item to the first not-done agenda item when none set
  useEffect(() => {
    if (activeItemId) return
    const next = agendaItems.find(
      (i) => i.decision_status !== 'implemented' && i.decision_status !== 'dropped',
    )
    if (!next) return
    // Defer to next tick so the synchronous-setState lint rule is satisfied.
    const t = window.setTimeout(() => setActiveItemId(next.id), 0)
    return () => window.clearTimeout(t)
  }, [activeItemId, agendaItems])

  // Timer tick — recomputes elapsed from the persisted started_at every
  // second. This means reload + reconnect always shows the correct
  // wall-clock duration and we never need to write elapsed_seconds back
  // to the DB (eliminating the audit-trail gap flagged by external review).
  useEffect(() => {
    if (!sessionStarted || !sessionStartedAt) return
    const startMs = new Date(sessionStartedAt).getTime()
    const tick = () => {
      const ms = Date.now() - startMs
      setElapsedSec(Math.max(0, Math.floor(ms / 1000)))
    }
    tick()
    const t = window.setInterval(tick, 1000)
    return () => window.clearInterval(t)
  }, [sessionStarted, sessionStartedAt])

  // Realtime subscription (§8.32) — postgres_changes on the live tables
  // bumps refreshKey so the existing reload effects re-fire. This replaces
  // the manual "Oppdater" pattern with push-based updates while keeping
  // the same data path (no separate optimistic state to reconcile).
  useEffect(() => {
    if (!supabase || !meetingId) return
    const ch = supabase
      .channel(`meeting-live:${meetingId}`, {
        config: { broadcast: { self: false } },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_votes',
          filter: `meeting_id=eq.${meetingId}`,
        },
        () => setRefreshKey((k) => k + 1),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_speaker_queue',
          filter: `meeting_id=eq.${meetingId}`,
        },
        () => setRefreshKey((k) => k + 1),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meeting_live_sessions',
          filter: `meeting_id=eq.${meetingId}`,
        },
        (payload) => {
          const next = payload.new as { active_agenda_item_id?: string | null; ended_at?: string | null }
          if (next.active_agenda_item_id !== undefined) {
            setActiveItemId(next.active_agenda_item_id ?? null)
          }
          // Explicit non-null/undefined check — `if (next.ended_at)`
          // would also match empty string / unset and could leave the
          // UI in "live" mode after a session ends.
          if (next.ended_at !== null && next.ended_at !== undefined && next.ended_at !== '') {
            setSessionStarted(false)
          }
          setRefreshKey((k) => k + 1)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_attendees',
          filter: `meeting_id=eq.${meetingId}`,
        },
        () => setRefreshKey((k) => k + 1),
      )
      .subscribe()
    channelRef.current = ch
    return () => {
      void supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [supabase, meetingId])

  // Stable method refs — useMeetings returns a new object every render so
  // we destructure the specific callbacks (they're useCallback-stable inside
  // the hook).
  const { getParityCheck, getVoteResult, loadSpeakerQueue } = meetings

  useEffect(() => {
    if (!meetingId) return
    let cancelled = false
    void getParityCheck(meetingId).then((r) => {
      if (!cancelled) setParityCheck(r)
    })
    void loadSpeakerQueue(meetingId).then((q) => {
      if (!cancelled) setSpeakerQueue(q)
    })
    return () => {
      cancelled = true
    }
  }, [meetingId, refreshKey, getParityCheck, loadSpeakerQueue])

  useEffect(() => {
    let cancelled = false
    if (!activeItemId) {
      const t = window.setTimeout(() => {
        if (!cancelled) setVoteResult(null)
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(t)
      }
    }
    void getVoteResult(activeItemId).then((r) => {
      if (!cancelled) setVoteResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [activeItemId, refreshKey, getVoteResult])

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleStart() {
    if (!meetingId) return
    const ok = await meetings.startLiveSession(meetingId)
    if (ok) {
      // Re-read the session row so we get the authoritative started_at
      // value (timer derives elapsed from this).
      const s = await meetings.loadLiveSession(meetingId)
      setSessionStartedAt(s?.started_at ?? new Date().toISOString())
      setSessionStarted(true)
      setRefreshKey((k) => k + 1)
    } else {
      setError('Kunne ikke starte møtet.')
    }
  }

  async function handleEnd() {
    if (!meetingId) return
    const ok = await meetings.endLiveSession(meetingId)
    if (ok) {
      setSessionStarted(false)
      navigate(`/meetings/${meetingId}`)
    } else {
      setError('Kunne ikke avslutte møtet.')
    }
  }

  async function selectItem(itemId: string) {
    setActiveItemId(itemId)
    if (meetingId) await meetings.setLiveActiveItem(meetingId, itemId)
    setRefreshKey((k) => k + 1)
  }

  async function castBallot(ballot: MeetingBallot) {
    if (!activeItem || !meetingId) return
    // We need a member_id to record a ballot — anonymous voting is a
    // display-time concern, not a NULL-member pattern (the schema now
    // enforces NOT NULL). For v1 the chair casts on behalf of self if a
    // protocol_signed_by member exists; otherwise the live-room ballot
    // buttons are inert and the chair must cast from the participant
    // grid where each member's id is bound.
    const memberId = meeting?.protocol_signed_by
    if (!memberId) {
      setError('Kan ikke registrere stemme uten medlems-ID. Bruk deltakerlisten.')
      return
    }
    const ok = await meetings.castVote({
      agendaItemId: activeItem.id,
      meetingId,
      memberId,
      ballot,
      isPreVote: false,
    })
    if (ok) setRefreshKey((k) => k + 1)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (!meeting && meetings.detailLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1518] text-white">
        Laster møterom …
      </div>
    )
  }
  if (!meeting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1518] text-white">
        <div className="text-center">
          <p className="text-sm">Møtet ble ikke funnet.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => navigate('/meetings')}>
            Tilbake til møter
          </Button>
        </div>
      </div>
    )
  }

  const itemsDone = agendaItems.filter(
    (i) => i.decision_status === 'implemented' || i.decision_status === 'dropped',
  ).length

  return (
    <div className="min-h-screen text-white" style={{ background: '#0a1518' }}>
      {/* TOP BAR */}
      <header className="border-b border-white/10 px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/meetings/${meetingId}`)}
            icon={<ChevronLeft className="h-3 w-3" />}
            className="border border-white/20 text-white/80 hover:bg-white/10"
          >
            Tilbake
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {sessionStarted ? (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-100"
                      style={{ background: ACCENT }}>
                  <span className="relative mr-1 inline-flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
                  </span>
                  LIVE
                </span>
              ) : (
                <Badge variant="warning">Ikke startet</Badge>
              )}
              <h1 className="truncate text-base font-semibold text-white sm:text-lg">
                {meeting.title}
              </h1>
            </div>
            <p className="text-[11px] text-white/60">
              {meeting.scheduled_at
                ? new Date(meeting.scheduled_at).toLocaleString('nb-NO', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })
                : 'Tidspunkt ikke fastsatt'}
              {meeting.location_label ? ` · ${meeting.location_label}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-white/5 px-3 py-1.5">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-white/60">Tid</p>
              <p className="font-mono text-base font-bold tabular-nums text-white">
                {formatElapsed(elapsedSec)}
              </p>
            </div>
            {parityCheck ? (
              <>
                <div className="h-8 w-px bg-white/15" />
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-white/60">Quorum</p>
                  <p className="flex items-center gap-1 text-sm font-bold text-white">
                    {parityCheck.quorum_ok ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                    )}
                    {parityCheck.total_present_or_accepted}/{parityCheck.quorum_min || '?'}
                  </p>
                </div>
                <div className="h-8 w-px bg-white/15" />
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-white/60">Paritet</p>
                  <p className="flex items-center gap-1.5 text-xs font-bold tabular-nums text-white">
                    <span className="text-amber-300">{parityCheck.employer_count}</span>
                    <span className="text-white/40">:</span>
                    <span className="text-cyan-300">{parityCheck.employee_count}</span>
                  </p>
                </div>
              </>
            ) : null}
          </div>
          {!sessionStarted ? (
            <Button
              variant="primary"
              size="sm"
              icon={<Play className="h-3.5 w-3.5" />}
              onClick={() => void handleStart()}
            >
              Start møte
            </Button>
          ) : (
            <Button
              variant="danger"
              size="sm"
              icon={<Square className="h-3.5 w-3.5" />}
              onClick={() => void handleEnd()}
            >
              Avslutt møte
            </Button>
          )}
        </div>
      </header>

      {error ? (
        <div className="mx-auto max-w-[1600px] px-4 pt-3 md:px-8">
          <WarningBox>{error}</WarningBox>
        </div>
      ) : null}

      {!sessionStarted && (agendaItems.length === 0 || (meeting.participant_member_ids?.length ?? 0) === 0) ? (
        <div className="mx-auto max-w-[1600px] px-4 pt-3 md:px-8">
          <WarningBox>
            {agendaItems.length === 0 && (meeting.participant_member_ids?.length ?? 0) === 0
              ? 'Møtet har ingen agendapunkter og ingen deltakere — legg til begge før du starter.'
              : agendaItems.length === 0
                ? 'Møtet har ingen agendapunkter ennå. Legg til saker i møtedetaljene.'
                : 'Ingen deltakere er lagt til — møtet kan ikke være beslutningsdyktig.'}
          </WarningBox>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-4 py-4 md:px-8 xl:grid-cols-[320px_1fr_320px]">
        {/* LEFT — agenda rail */}
        <aside className="rounded-xl bg-[#152025] p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Saksliste</p>
            <span className="text-[10px] tabular-nums text-white/50">
              {itemsDone}/{agendaItems.length}
            </span>
          </div>
          <ol className="space-y-1">
            {agendaItems.map((it) => {
              const isActive = it.id === activeItemId
              const isDone =
                it.decision_status === 'implemented' || it.decision_status === 'dropped'
              return (
                <li key={it.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void selectItem(it.id)}
                    className={`flex w-full items-start justify-start gap-2 rounded-lg px-2.5 py-2 text-left font-normal normal-case tracking-normal transition-colors ${
                      isActive
                        ? 'bg-cyan-400/15 ring-1 ring-cyan-300/40 hover:bg-cyan-400/20'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
                        isDone
                          ? 'bg-cyan-700 text-white'
                          : isActive
                            ? 'bg-cyan-400 text-cyan-950'
                            : 'bg-white/10 text-white/70'
                      }`}
                    >
                      {isDone ? <Check className="h-3 w-3" /> : it.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[11px] leading-tight ${
                          isDone
                            ? 'text-white/40 line-through'
                            : isActive
                              ? 'font-semibold text-cyan-200'
                              : 'text-white/85'
                        }`}
                      >
                        {it.title}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-[9px] text-white/50">
                        {it.duration_minutes ? <span>{it.duration_minutes}m</span> : null}
                        {it.voting_model ? <span>· {it.voting_model}</span> : null}
                      </div>
                    </div>
                  </Button>
                </li>
              )
            })}
          </ol>
        </aside>

        {/* CENTER — active item + voting */}
        <main className="space-y-4">
          {activeItem ? (
            <div className="rounded-xl bg-white p-5 text-neutral-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                      style={{ background: ACCENT }}
                    >
                      Behandles nå
                    </span>
                    <span className="font-mono text-[10px] text-neutral-400">
                      Sak {activeItem.position}
                    </span>
                    {activeItem.is_mandatory ? <Badge variant="critical">Obligatorisk</Badge> : null}
                    {activeItem.conflict_of_interest?.length ? (
                      <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Habilitet
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-neutral-900">
                    {activeItem.title}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    {activeItem.description ?? activeItem.minutes_summary ?? '—'}
                  </p>
                </div>
                {activeItem.duration_minutes ? (
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Avsatt
                    </p>
                    <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-neutral-900">
                      {activeItem.duration_minutes}m
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Vote widget for vedtak */}
              {activeItem.voting_model ? (
                <div
                  className="mt-4 rounded-xl border p-3"
                  style={{ borderColor: ACCENT, background: '#ecfeff' }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-cyan-900">Avstemning</p>
                    <Badge variant="info">{VOTING_LABEL[activeItem.voting_model]}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(['yes', 'no', 'blank'] as const).map((b) => (
                      <Button
                        key={b}
                        variant="secondary"
                        size="sm"
                        onClick={() => void castBallot(b)}
                        icon={
                          b === 'yes' ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : b === 'no' ? (
                            <X className="h-3.5 w-3.5" />
                          ) : (
                            <Minus className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        {b === 'yes' ? 'JA' : b === 'no' ? 'NEI' : 'Blank'}
                      </Button>
                    ))}
                  </div>
                  {voteResult?.tally ? (
                    <p className="mt-3 text-xs tabular-nums text-neutral-700">
                      <strong>{voteResult.tally.yes}</strong> for ·{' '}
                      <strong>{voteResult.tally.no}</strong> mot ·{' '}
                      <strong>{voteResult.tally.blank}</strong> blank
                      {voteResult.passed === true ? (
                        <span className="ml-2 inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <Check className="h-3 w-3" aria-hidden /> Vedtatt
                        </span>
                      ) : voteResult.passed === false ? (
                        <span className="ml-2 inline-flex items-center gap-1 font-semibold text-red-700">
                          <X className="h-3 w-3" aria-hidden /> Ikke vedtatt
                        </span>
                      ) : voteResult.reason === 'parity_missing_employer' ? (
                        <span className="ml-2 inline-flex items-center gap-1 font-semibold text-amber-800">
                          <AlertTriangle className="h-3 w-3" aria-hidden /> Ugyldig — arbeidsgiversiden mangler
                        </span>
                      ) : voteResult.reason === 'parity_missing_employee' ? (
                        <span className="ml-2 inline-flex items-center gap-1 font-semibold text-amber-800">
                          <AlertTriangle className="h-3 w-3" aria-hidden /> Ugyldig — arbeidstakersiden mangler
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  {voteResult?.model === 'parity' && voteResult.parity ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded border border-amber-200 bg-white p-2">
                        <p className="font-bold uppercase tracking-wider text-amber-800 text-[10px]">
                          Arbeidsgiver
                        </p>
                        <p className="mt-1 tabular-nums text-neutral-700">
                          {voteResult.parity.employer_yes} for · {voteResult.parity.employer_no} mot
                        </p>
                      </div>
                      <div className="rounded border border-cyan-200 bg-white p-2">
                        <p className="font-bold uppercase tracking-wider text-cyan-800 text-[10px]">
                          Arbeidstaker
                        </p>
                        <p className="mt-1 tabular-nums text-neutral-700">
                          {voteResult.parity.employee_yes} for · {voteResult.parity.employee_no} mot
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3 text-sm text-neutral-600">
                  Drøftingssak — ingen vedtak. Notater fra diskusjonen lagres i protokollen.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-white p-5 text-sm text-neutral-600">
              Ingen aktiv sak — velg en sak i sakslisten til venstre.
            </div>
          )}

          {/* Move on */}
          <div className="flex items-center justify-between rounded-xl bg-[#152025] p-3">
            <Button
              variant="ghost"
              size="sm"
              icon={<ChevronLeft className="h-3.5 w-3.5" />}
              className="text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => {
                const idx = agendaItems.findIndex((i) => i.id === activeItemId)
                if (idx > 0) void selectItem(agendaItems[idx - 1]!.id)
              }}
            >
              Forrige sak
            </Button>
            <span className="text-[10px] uppercase tracking-wider text-white/50">
              {activeItem
                ? `Sak ${activeItem.position} av ${agendaItems.length}`
                : `${agendaItems.length} saker`}
            </span>
            <Button
              variant="primary"
              size="sm"
              icon={<ChevronRight className="h-3.5 w-3.5" />}
              onClick={() => {
                const idx = agendaItems.findIndex((i) => i.id === activeItemId)
                if (idx >= 0 && idx < agendaItems.length - 1)
                  void selectItem(agendaItems[idx + 1]!.id)
              }}
            >
              Neste sak
            </Button>
          </div>
        </main>

        {/* RIGHT — speakers + parity recap */}
        <aside className="space-y-4">
          <div className="rounded-xl bg-white p-4 text-neutral-900">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Taleliste
              </p>
              <span className="text-[10px] tabular-nums text-neutral-500">
                {speakerQueue.length} i kø
              </span>
            </div>
            {speakerQueue.length === 0 ? (
              <p className="text-xs text-neutral-500">Ingen har bedt om ordet.</p>
            ) : (
              <ul className="space-y-1.5">
                {speakerQueue.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2.5 rounded bg-neutral-50/60 px-2 py-1.5"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: ACCENT }}>
                      {s.position}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-neutral-900">{s.member_id ?? '—'}</p>
                      {s.topic ? <p className="text-[10px] text-neutral-500">{s.topic}</p> : null}
                    </div>
                    {s.given_floor_at ? (
                      <Badge variant="info">Har ordet</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await meetings.giveSpeakerFloor(s.id)
                          setRefreshKey((k) => k + 1)
                        }}
                      >
                        Gi ordet →
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              icon={<Hand className="h-3.5 w-3.5" />}
              onClick={async () => {
                if (!meetingId) return
                await meetings.addSpeaker({
                  meetingId,
                  agendaItemId: activeItemId,
                  memberId: null,
                  topic: null,
                })
                setRefreshKey((k) => k + 1)
              }}
            >
              Be om ordet
            </Button>
          </div>

          <div className="rounded-xl bg-white p-4 text-neutral-900">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                <Users className="h-3 w-3" aria-hidden /> Tilstedeværelse
              </p>
              {parityCheck ? (
                <span className="text-[10px] tabular-nums text-neutral-500">
                  {parityCheck.total_present_or_accepted} til stede
                </span>
              ) : null}
            </div>
            {parityCheck ? (
              <>
                <div className="flex h-2 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    style={{
                      width: `${
                        (parityCheck.employer_count /
                          Math.max(
                            parityCheck.employer_count + parityCheck.employee_count + parityCheck.bht_count,
                            1,
                          )) *
                        100
                      }%`,
                      background: '#c9a227',
                    }}
                  />
                  <div
                    style={{
                      width: `${
                        (parityCheck.employee_count /
                          Math.max(
                            parityCheck.employer_count + parityCheck.employee_count + parityCheck.bht_count,
                            1,
                          )) *
                        100
                      }%`,
                      background: ACCENT,
                    }}
                  />
                  <div
                    style={{
                      width: `${
                        (parityCheck.bht_count /
                          Math.max(
                            parityCheck.employer_count + parityCheck.employee_count + parityCheck.bht_count,
                            1,
                          )) *
                        100
                      }%`,
                      background: '#7a2e1f',
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-neutral-600">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded" style={{ background: '#c9a227' }} />
                    AG ({parityCheck.employer_count})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded" style={{ background: ACCENT }} />
                    AT ({parityCheck.employee_count})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded" style={{ background: '#7a2e1f' }} />
                    BHT ({parityCheck.bht_count})
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-neutral-500">Ingen attendance-data registrert ennå.</p>
            )}
          </div>

          <div className="rounded-xl bg-white p-3 text-[11px] text-neutral-500">
            <p className="flex items-center gap-1.5">
              <Radio className="h-3 w-3 text-cyan-700" aria-hidden />
              Live-rommet bruker server-data — refresh syncer ballotter, taleliste og paritet.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              icon={<PenLine className="h-3 w-3" />}
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              Oppdater
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
