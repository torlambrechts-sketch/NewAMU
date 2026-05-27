// Møter — detail view (redesign).
//
// Six tabs: Agenda · Deltakere · Statistikk · Vedtak · Referat · Historikk.
// Wires straight into useMeetings + useMeetingDataBindings + signProtocol.
//
// Quorum banner appears on Deltakere when the template defines minimumQuorum.
// System alerts banner aggregates mandatory-gap, statistic-threshold and
// invitation-late warnings.
//
// Statistikk fetches auto-resolved bindings via useMeetingDataBindings and
// renders one card per agenda-item binding (trend, breakdown, narrative).

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarPlus,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Database,
  Download,
  Edit3,
  FileDown,
  FileEdit,
  FileText,
  Gavel,
  History,
  Landmark,
  Info,
  ListChecks,
  ListTodo,
  Lock,
  MapPin,
  Minus,
  PenSquare,
  Play,
  Plus,
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  StickyNote,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { ModulePageShell, ModulePageEmpty } from '../../components/module/ModulePageShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { WarningBox, InfoBox } from '../../components/ui/AlertBox'
import { SlidePanel } from '../../components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useMeetings, useMeetingDataBindings } from '../../../modules/meetings'
import {
  MEETING_ACTION_STATUS_LABEL,
  MEETING_ATTENDEE_ROLE_LABEL,
  MEETING_CONFIDENTIALITY_LABEL,
  MEETING_DECISION_STATUS_LABEL,
  MEETING_STATUS_LABEL,
} from '../../../modules/meetings/meetingsLabels'
import { MeetingAmuLeaderRotationBadge } from '../../../modules/meetings/components/MeetingAmuLeaderRotationBadge'
import { MeetingReportingObligationsPanel } from '../../../modules/meetings/components/MeetingReportingObligationsPanel'
import type { MeetingReportingObligationRow } from '../../../modules/meetings/types'
import type {
  MeetingActionStatus,
  MeetingAgendaItemRow,
  MeetingAttendeeRole,
  MeetingAttendeeRow,
  MeetingDecisionRow,
  MeetingActionItemRow,
  MeetingRow,
  MeetingRsvpStatus,
  MeetingSignatureRow,
  MeetingStatus,
  MeetingTemplateAgendaItem,
  RenderedBindingResult,
  ResolvedMeetingTemplate,
} from '../../../modules/meetings/types'

type Tab = 'agenda' | 'deltakere' | 'statistikk' | 'vedtak' | 'rapportering' | 'referat' | 'historikk'

// ── Status badge variant mapping ─────────────────────────────────────────

const STATUS_BADGE: Record<MeetingStatus, 'draft' | 'active' | 'signed' | 'neutral'> = {
  planned: 'active',
  in_progress: 'active',
  completed: 'signed',
  cancelled: 'neutral',
}

// ── Date helpers ─────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtDateShort(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtRelativeDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function initialsFrom(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function Initials({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-[#e7efe9] font-semibold text-[#14312a]"
      style={{ height: size, width: size, fontSize: size <= 14 ? 8 : size * 0.4 }}
      aria-hidden
    >
      {initialsFrom(name)}
    </span>
  )
}

// ── Pills ───────────────────────────────────────────────────────────────

function MtgStatusPill({ status }: { status: MeetingStatus }) {
  return <Badge variant={STATUS_BADGE[status]}>{MEETING_STATUS_LABEL[status]}</Badge>
}

function FrameworkBadge({ framework }: { framework: string | undefined }) {
  if (!framework) return null
  return (
    <span className="inline-flex items-center gap-1 rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]">
      {framework}
    </span>
  )
}

function ProgressBar({
  value,
  tone = 'forest',
  height = 6,
}: {
  value: number
  tone?: 'forest' | 'warn' | 'danger'
  height?: number
}) {
  const pct = Math.min(100, Math.max(0, value * 100))
  const bg = tone === 'forest' ? '#1a3d32' : tone === 'danger' ? '#dc2626' : '#d97706'
  return (
    <div
      className="overflow-hidden rounded-full bg-neutral-200"
      style={{ height }}
      aria-hidden
    >
      <div className="h-full transition-all" style={{ width: `${pct}%`, background: bg }} />
    </div>
  )
}

// ── Main detail view ────────────────────────────────────────────────────

export function MeetingsDetailView() {
  const { meetingId = '' } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { members } = useOrgSetupContext()
  const meetings = useMeetings()
  const { loadDetail, clearDetail } = meetings
  const [tab, setTab] = useState<Tab>('agenda')
  const [addAgendaOpen, setAddAgendaOpen] = useState(false)
  const [agendaEditTarget, setAgendaEditTarget] = useState<MeetingAgendaItemRow | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const memberById = useMemo(() => {
    const m = new Map<string, string>()
    for (const member of members ?? []) {
      m.set(member.id, member.display_name ?? member.id.slice(0, 8))
    }
    return m
  }, [members])

  const memberOptions = useMemo(
    () =>
      (members ?? []).map((m) => ({
        value: m.id,
        label: m.display_name ?? m.id.slice(0, 8),
      })),
    [members],
  )

  useEffect(() => {
    if (!meetingId) return
    void loadDetail(meetingId)
    return () => clearDetail()
  }, [meetingId, loadDetail, clearDetail])

  // ── Reporting obligations (AML § 15-2 NAV, § 7-2 (6), Foretaksregisteret) ─
  // Auto-materialised by trigger at meeting INSERT; we fetch on detail open.
  const [reportingObligations, setReportingObligations] = useState<MeetingReportingObligationRow[]>([])
  const { loadReportingObligations } = meetings
  useEffect(() => {
    if (!meetingId) return
    let cancelled = false
    void (async () => {
      const rows = await loadReportingObligations(meetingId)
      if (!cancelled) setReportingObligations(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [meetingId, loadReportingObligations])

  const refreshReportingObligations = async () => {
    if (!meetingId) return
    const rows = await loadReportingObligations(meetingId)
    setReportingObligations(rows)
  }

  // Compute bindings unconditionally to keep hook order stable.
  const bindings = useMeetingDataBindings({
    meeting: meetings.detail.meeting,
    agendaItems: meetings.detail.agendaItems,
  })

  // Auto-fill bindings into snapshots once per meeting open. Guards:
  //   - ref-gate per meeting id (don't re-run on every render)
  //   - signed meetings never auto-fill (the snapshot is part of the hash)
  //   - only fills snapshots / minutes that are still empty (preserves edits)
  //   - skips placeholder resolvers (snap.error set)
  //   - re-checks the meeting id before each write (rapid back-button
  //     into a different meeting must NOT write to the new meeting's items)
  //   - bails on first error so a sign-in-flight collision surfaces cleanly
  const autoFilledRef = useRef<string | null>(null)
  useEffect(() => {
    const m = meetings.detail.meeting
    if (!m || m.protocol_signed_at) return
    if (autoFilledRef.current === m.id) return
    if (meetings.detail.agendaItems.length === 0) return
    if (bindings.resolvedByAgendaItemId.size === 0) return
    if (bindings.loading) return
    const meetingId = m.id
    autoFilledRef.current = meetingId
    void (async () => {
      try {
        for (const item of meetings.detail.agendaItems) {
          // Bail if the detail view switched to a different meeting mid-loop.
          if (meetings.detail.meeting?.id !== meetingId) return
          // Bail if someone signed the protocol while we were iterating.
          if (meetings.detail.meeting?.protocol_signed_at) return
          const snap = bindings.resolvedByAgendaItemId.get(item.id)
          if (!snap) continue
          if (!item.binding_snapshot) {
            const ok = await meetings.writeBindingSnapshot(item.id, snap)
            if (!ok) return
          }
          if (!item.minutes_summary?.trim() && !snap.error) {
            const ok = await meetings.setAgendaMinutes(item.id, {
              minutesSummary: snap.summaryMarkdown,
            })
            if (!ok) return
          }
        }
      } catch {
        // Concurrent edit / sign races land here — clear the ref so a
        // subsequent reopen has a fresh attempt.
        autoFilledRef.current = null
      }
    })()
  }, [
    meetings.detail.meeting,
    meetings.detail.agendaItems,
    bindings.resolvedByAgendaItemId,
    bindings.loading,
    // Stable function references — depending on the whole `meetings` object
    // would force the effect to re-think it needs to run on every state
    // change of the parent.
    meetings.writeBindingSnapshot,
    meetings.setAgendaMinutes,
  ])

  if (!meetingId) {
    return (
      <ModulePageEmpty
        title="Ingen møte valgt"
        backLabel="← Til Møter"
        onBack={() => navigate('/meetings')}
      />
    )
  }

  if (meetings.detailLoading && !meetings.detail.meeting) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Møter', to: '/meetings' }, { label: 'Laster…' }]}
        title="Laster møte…"
        loading
        loadingLabel="Henter agenda, deltakere og protokoll."
      >
        {null}
      </ModulePageShell>
    )
  }

  const meeting = meetings.detail.meeting
  if (!meeting) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Møter', to: '/meetings' }, { label: 'Ikke funnet' }]}
        title="Møtet finnes ikke"
        notFound={{
          title: 'Fant ikke møtet — det kan være slettet, arkivert eller utenfor din tilgang.',
          backLabel: '← Til Møter',
          onBack: () => navigate('/meetings'),
        }}
      >
        {null}
      </ModulePageShell>
    )
  }

  const isLocked = !!meeting.protocol_signed_at
  const tpl = templateForMeeting(meeting, meetings.templates)
  const mandatoryGaps = computeMandatoryGaps(meeting, meetings.detail.agendaItems)
  const alertItems = computeAlerts(
    meeting,
    meetings.detail.agendaItems,
    meetings.detail.priorOpenDecisions,
    bindings.resolvedByAgendaItemId,
    mandatoryGaps,
  )
  const criticalAlerts = alertItems.filter((a) => a.tone === 'critical').length
  const warningAlerts = alertItems.filter((a) => a.tone === 'warning').length

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        icon={<ArrowLeft className="h-4 w-4" />}
        onClick={() => navigate('/meetings')}
      >
        Tilbake
      </Button>
      <Button
        variant="secondary"
        icon={<CalendarDays className="h-4 w-4" />}
        onClick={() => {
          // Calendar export: download .ics link (already produced via export route).
          navigate(`/meetings/${meeting.id}/eksport`)
        }}
      >
        Legg til i kalender
      </Button>
      {meeting.status === 'planned' && meetings.canManage ? (
        <Button
          variant="secondary"
          icon={<Send className="h-4 w-4" />}
          onClick={() => void meetings.sendInvitations({ meetingId: meeting.id, mode: 'reminder' })}
        >
          Send påminnelse
        </Button>
      ) : null}
      {meeting.status === 'planned' && !isLocked && meetings.canManage ? (
        <Link to={`/meetings/${meeting.id}/live`}>
          <Button variant="primary" icon={<Play className="h-4 w-4" />}>
            Start møte
          </Button>
        </Link>
      ) : null}
      {meeting.status === 'in_progress' && meetings.canManage ? (
        <Button
          variant="primary"
          icon={<Check className="h-4 w-4" />}
          onClick={async () => {
            // Close the live session row first so MeetingLivePage's
            // recovery flow doesn't see a zombie when next opened.
            await meetings.endLiveSession(meeting.id)
            await meetings.updateMeeting(meeting.id, {
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
          }}
        >
          Avslutt og skriv referat
        </Button>
      ) : null}
      {meeting.status === 'completed' && !meeting.protocol_signed_at && meetings.canManage ? (
        <Button
          variant="primary"
          icon={<FileEdit className="h-4 w-4" />}
          onClick={() => setTab('referat')}
        >
          Skriv referat
        </Button>
      ) : null}
      {meeting.status === 'completed' && meeting.protocol_signed_at ? (
        <Link to={`/meetings/${meeting.id}/eksport`}>
          <Button variant="primary" icon={<Download className="h-4 w-4" />}>
            Last ned referat
          </Button>
        </Link>
      ) : null}
    </div>
  )

  // Visible tab strip with badges.
  const tabItems: Array<{
    id: Tab
    label: string
    icon: typeof ListChecks
    badgeCount?: number
  }> = [
    {
      id: 'agenda',
      label: 'Agenda',
      icon: ListChecks,
      badgeCount: meetings.detail.agendaItems.length,
    },
    {
      id: 'deltakere',
      label: 'Deltakere',
      icon: Users,
      badgeCount: meetings.detail.attendees.length,
    },
    {
      id: 'statistikk',
      label: 'Statistikk',
      icon: Database,
      badgeCount: bindings.resolvedByAgendaItemId.size || undefined,
    },
    {
      id: 'vedtak',
      label: 'Vedtak',
      icon: Gavel,
      badgeCount: meetings.detail.decisions.length || undefined,
    },
    ...(reportingObligations.length > 0
      ? [
          {
            id: 'rapportering' as Tab,
            label: 'Rapportering',
            icon: Landmark,
            badgeCount:
              reportingObligations.filter((o) => !o.fulfilled_at).length || undefined,
          },
        ]
      : []),
    { id: 'referat', label: 'Referat', icon: FileText },
    {
      id: 'historikk',
      label: 'Historikk',
      icon: History,
      badgeCount: undefined,
    },
  ]

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: 'Møter', to: '/meetings' },
        {
          label:
            meeting.title.length > 40 ? `${meeting.title.slice(0, 38)}…` : meeting.title,
        },
      ]}
      title={meeting.title}
      description={
        <span className="text-sm text-neutral-600">
          {meeting.description ?? `${fmtDateTime(meeting.scheduled_at)} · ${meeting.location_label ?? 'Ingen lokasjon'}`}
        </span>
      }
      headerActions={headerActions}
    >
      {meetings.error ? <WarningBox>{meetings.error}</WarningBox> : null}

      {/* Top status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white px-5 py-3 k-card-shadow">
        <div className="flex flex-wrap items-center gap-3">
          <MtgStatusPill status={meeting.status} />
          {tpl ? <FrameworkBadge framework={tpl.framework} /> : null}
          {tpl?.lawRefs?.length ? (
            <span className="inline-flex items-center gap-1 rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]">
              <ShieldCheck className="h-3 w-3" aria-hidden /> Lovpålagt
            </span>
          ) : null}
          {meeting.quorum_met === true ? (
            <span className="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-800">
              <CheckCircle2 className="h-3 w-3" aria-hidden /> Beslutningsdyktig
            </span>
          ) : null}
          {meeting.confidentiality_level !== 'standard' ? (
            <Badge
              variant={
                meeting.confidentiality_level === 'akan'
                  ? 'akan'
                  : meeting.confidentiality_level === 'confidential'
                  ? 'confidential'
                  : 'restricted'
              }
            >
              {MEETING_CONFIDENTIALITY_LABEL[meeting.confidentiality_level]}
            </Badge>
          ) : null}
          {meeting.amu_leader_period_party ? (
            <MeetingAmuLeaderRotationBadge party={meeting.amu_leader_period_party} />
          ) : null}
          {isLocked ? (
            <Badge variant="signed">
              <ShieldCheck className="mr-1 inline h-3 w-3" aria-hidden />
              Signert
            </Badge>
          ) : null}
          {tpl?.lawRefs?.slice(0, 3).map((l) => (
            <span
              key={l}
              className="rounded border border-[#c5d3c8] bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]"
            >
              {l}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
            <span className="tabular-nums">{fmtDateTime(meeting.scheduled_at)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
            <span className="truncate">{meeting.location_label ?? '—'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
            <span className="tabular-nums">
              {/* Use the roster (`attendees.length`) as the denominator —
                  it's the post-invite headcount the chair manages.
                  `participant_member_ids` is the initial planned list
                  from creation time and stops updating after invites
                  are added/removed from the panel. */}
              {meetings.detail.attendees.filter((a) =>
                meeting.status === 'planned'
                  ? a.rsvp_status === 'accepted'
                  : a.present === true,
              ).length}/{meetings.detail.attendees.length}
            </span>
          </span>
        </div>
      </div>

      {/* System alerts banner */}
      {alertItems.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 k-card-shadow">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                {criticalAlerts > 0 ? `${criticalAlerts} kritisk varsel · ` : ''}
                {warningAlerts} til drøfting
              </div>
              <ul className="mt-1.5 space-y-1 text-[12px]">
                {alertItems.map((a, i) => {
                  const Icon =
                    a.tone === 'critical'
                      ? AlertOctagon
                      : a.tone === 'warning'
                        ? AlertTriangle
                        : Info
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <Icon
                        className={[
                          'mt-0.5 h-3 w-3 shrink-0',
                          a.tone === 'critical'
                            ? 'text-red-700'
                            : a.tone === 'warning'
                              ? 'text-amber-700'
                              : 'text-blue-700',
                        ].join(' ')}
                        aria-hidden
                      />
                      <span
                        className={
                          a.tone === 'critical'
                            ? 'text-red-900'
                            : a.tone === 'warning'
                              ? 'text-amber-900'
                              : 'text-blue-900'
                        }
                      >
                        {a.text}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="rounded-xl border border-neutral-200/80 bg-white k-card-shadow">
        <div className="border-b border-neutral-100 px-5 py-2.5">
          <DetailTabs items={tabItems} activeId={tab} onChange={(id) => setTab(id as Tab)} />
        </div>

        <div className="p-5">
          {tab === 'agenda' ? (
            <AgendaTabPanel
              meeting={meeting}
              tpl={tpl}
              items={meetings.detail.agendaItems}
              memberById={memberById}
              locked={isLocked}
              canManage={meetings.canManage}
              priorOpenDecisions={meetings.detail.priorOpenDecisions}
              onAdd={() => {
                setAgendaEditTarget(null)
                setAddAgendaOpen(true)
              }}
              onEdit={(item) => {
                setAgendaEditTarget(item)
                setAddAgendaOpen(true)
              }}
              onRemove={(id) => void meetings.removeAgendaItem(id)}
              onReorder={(orderedIds) => void meetings.reorderAgendaItems(meeting.id, orderedIds)}
              onSendAgenda={() =>
                // Pick mode based on whether innkalling is already on file —
                // re-stamping `invitation_sent_at` after the chair already
                // sent the initial round breaks the "X dager før" warning.
                void meetings.sendInvitations({
                  meetingId: meeting.id,
                  mode: meeting.invitation_sent_at ? 'reminder' : 'initial',
                })
              }
              onJumpToStatistikk={() => setTab('statistikk')}
            />
          ) : null}

          {tab === 'deltakere' ? (
            <DeltakereTabPanel
              meeting={meeting}
              tpl={tpl}
              attendees={meetings.detail.attendees}
              memberById={memberById}
              canManage={meetings.canManage}
              locked={isLocked}
              onInvite={() => setInviteOpen(true)}
              onSetRsvp={meetings.setRsvp}
              onSetAmuLeaderPeriodParty={meetings.setAmuLeaderPeriodParty}
            />
          ) : null}

          {tab === 'statistikk' ? (
            <StatistikkTabPanel
              meeting={meeting}
              tpl={tpl}
              agendaItems={meetings.detail.agendaItems}
              bindings={bindings.resolvedByAgendaItemId}
              loading={bindings.loading}
              onRefresh={async () => {
                for (const item of meetings.detail.agendaItems) {
                  const snap = bindings.resolvedByAgendaItemId.get(item.id)
                  if (snap) await meetings.writeBindingSnapshot(item.id, snap)
                }
              }}
            />
          ) : null}

          {tab === 'vedtak' ? (
            <VedtakTabPanel
              meeting={meeting}
              agendaItems={meetings.detail.agendaItems}
              decisions={meetings.detail.decisions}
              actionItems={meetings.detail.actionItems}
              priorOpenDecisions={meetings.detail.priorOpenDecisions}
              memberById={memberById}
              locked={isLocked}
              canManage={meetings.canManage}
              onAddAction={meetings.addActionItem}
              onSetActionStatus={meetings.setActionItemStatus}
              onSaveMinorityDissent={(itemId, text) =>
                meetings.setAgendaMinutes(itemId, { minorityDissentText: text })
              }
            />
          ) : null}

          {tab === 'rapportering' ? (
            <MeetingReportingObligationsPanel
              obligations={reportingObligations}
              canManage={meetings.canManage}
              onMarkFulfilled={async (id, input) => {
                const ok = await meetings.markReportingObligationFulfilled(id, input)
                if (ok) await refreshReportingObligations()
                return ok
              }}
              onUnmarkFulfilled={async (id) => {
                const ok = await meetings.unmarkReportingObligationFulfilled(id)
                if (ok) await refreshReportingObligations()
                return ok
              }}
            />
          ) : null}

          {tab === 'referat' ? (
            <ReferatTabPanel
              meeting={meeting}
              tpl={tpl}
              attendees={meetings.detail.attendees}
              agendaItems={meetings.detail.agendaItems}
              signatures={meetings.detail.signatures}
              memberById={memberById}
              mandatoryGaps={mandatoryGaps}
              locked={isLocked}
              canManage={meetings.canManage}
              onSign={meetings.signProtocol}
              onSeedReferat={async () => {
                for (const item of meetings.detail.agendaItems) {
                  if (!item.minutes_summary?.trim()) {
                    const snap = bindings.resolvedByAgendaItemId.get(item.id)
                    if (snap) {
                      await meetings.setAgendaMinutes(item.id, {
                        minutesSummary: snap.summaryMarkdown,
                      })
                    }
                  }
                }
              }}
            />
          ) : null}

          {tab === 'historikk' ? (
            <HistorikkTabPanel
              meeting={meeting}
              agendaItems={meetings.detail.agendaItems}
              attendees={meetings.detail.attendees}
              signatures={meetings.detail.signatures}
              memberById={memberById}
            />
          ) : null}
        </div>
      </div>

      <AgendaItemSlidePanel
        open={addAgendaOpen}
        initial={agendaEditTarget}
        memberOptions={memberOptions}
        onClose={() => {
          setAddAgendaOpen(false)
          setAgendaEditTarget(null)
        }}
        onSubmit={async (v) => {
          const durationMinutes = v.durationMinutes ? Math.max(0, v.durationMinutes) : null
          if (agendaEditTarget) {
            await meetings.updateAgendaItem(agendaEditTarget.id, {
              title: v.title,
              description: v.description.trim() || null,
              lawRef: v.lawRef.trim() || null,
              durationMinutes,
              presenterMemberId: v.presenterMemberId || null,
            })
          } else {
            await meetings.addAgendaItem({
              meetingId: meeting.id,
              title: v.title,
              description: v.description.trim() || null,
              lawRef: v.lawRef.trim() || null,
              durationMinutes,
              presenterMemberId: v.presenterMemberId || null,
            })
          }
        }}
      />

      <InviteAttendeeSlidePanel
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        memberOptions={memberOptions}
        existingAttendeeMemberIds={meetings.detail.attendees.map((a) => a.member_id)}
        onInvite={async ({ memberId, role }) => {
          await meetings.upsertAttendee({
            meetingId: meeting.id,
            memberId,
            role,
          })
        }}
      />
    </ModulePageShell>
  )
}

// ── Helpers — template resolver / gap computation / alerts ───────────────

function templateForMeeting(
  m: MeetingRow,
  templates: ResolvedMeetingTemplate[],
): ResolvedMeetingTemplate | null {
  if (m.system_template_id) {
    const t = templates.find((tt) => tt.systemTemplateId === m.system_template_id)
    if (t) return t
  }
  if (m.org_template_id) {
    const t = templates.find((tt) => tt.orgTemplateId === m.org_template_id)
    if (t) return t
  }
  return null
}

function computeMandatoryGaps(meeting: MeetingRow, items: MeetingAgendaItemRow[]): string[] {
  const snap = meeting.definition_snapshot
  if (!snap?.agendaItems?.length) return []
  const minutesByKey = new Map<string, string | null>()
  for (const item of items) {
    if (item.template_item_key) minutesByKey.set(item.template_item_key, item.minutes_summary)
  }
  const gaps: string[] = []
  for (const tplItem of snap.agendaItems as MeetingTemplateAgendaItem[]) {
    if (!tplItem.isMandatory) continue
    const minutes = minutesByKey.get(tplItem.key)
    if (!minutes || !minutes.trim()) gaps.push(tplItem.title)
  }
  return gaps
}

type Alert = { tone: 'critical' | 'warning' | 'info'; text: string }

function computeAlerts(
  meeting: MeetingRow,
  agendaItems: MeetingAgendaItemRow[],
  priorOpenDecisions: Array<{ id: string; decision_text: string; meeting_title: string }>,
  bindingsByItem: Map<string, RenderedBindingResult>,
  mandatoryGaps: string[],
): Alert[] {
  const out: Alert[] = []
  // Critical alerts pulled from prior open decisions (carry-over).
  if (priorOpenDecisions.length > 0) {
    out.push({
      tone: 'critical',
      text: `${priorOpenDecisions.length} åpne vedtak fra tidligere møter må følges opp.`,
    })
  }
  // Warning alerts — mandatory gaps still to fill in.
  if (mandatoryGaps.length > 0) {
    out.push({
      tone: 'warning',
      text: `${mandatoryGaps.length} obligatorisk${mandatoryGaps.length === 1 ? '' : 'e'} sak${mandatoryGaps.length === 1 ? '' : 'er'} mangler protokollført innhold.`,
    })
  }
  // Invitation timeliness — recommend sending the invite if we're close.
  const snap = meeting.definition_snapshot
  if (
    meeting.status === 'planned' &&
    !meeting.invitation_sent_at &&
    snap?.invitationLeadDays &&
    meeting.scheduled_at
  ) {
    const days = Math.ceil(
      (new Date(meeting.scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    )
    if (days <= snap.invitationLeadDays) {
      out.push({
        tone: 'warning',
        text: `Innkalling ikke sendt — anbefalt frist er ${snap.invitationLeadDays} dager (${days} dag${days === 1 ? '' : 'er'} igjen).`,
      })
    }
  }
  // Binding errors surface as informational notices.
  for (const item of agendaItems) {
    const snap2 = bindingsByItem.get(item.id)
    if (snap2?.error) {
      out.push({
        tone: 'info',
        text: `${item.title}: ${snap2.error}`,
      })
    }
  }
  return out.slice(0, 6)
}

// ── Detail tabs (custom — supports inline rendering with right-aligned actions) ───

function DetailTabs({
  items,
  activeId,
  onChange,
}: {
  items: Array<{
    id: Tab
    label: string
    icon: typeof ListChecks
    badgeCount?: number
  }>
  activeId: Tab
  onChange: (id: Tab) => void
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Detaljvisning-faner">
      {items.map((tab) => {
        const Icon = tab.icon
        const active = tab.id === activeId
        return (
          <Button
            key={tab.id}
            variant="ghost"
            size="sm"
            onClick={() => onChange(tab.id)}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[#1a3d32] text-white hover:bg-[#14312a] hover:text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
            ].join(' ')}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span>{tab.label}</span>
            {tab.badgeCount !== undefined && tab.badgeCount > 0 ? (
              <span
                className={[
                  'ml-1 rounded-full px-1.5 py-0.5 text-[10px]',
                  active ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700',
                ].join(' ')}
              >
                {tab.badgeCount}
              </span>
            ) : null}
          </Button>
        )
      })}
    </nav>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// AGENDA TAB
// ═════════════════════════════════════════════════════════════════════════

const TYPE_BADGE = {
  orientering: { bg: 'bg-blue-100', fg: 'text-blue-800', label: 'Orientering' },
  drofting: { bg: 'bg-amber-100', fg: 'text-amber-900', label: 'Drøfting' },
  beslutning: { bg: 'bg-[#e7efe9]', fg: 'text-[#14312a]', label: 'Beslutning' },
} as const

type AgendaItemType = keyof typeof TYPE_BADGE

function classifyAgendaItem(item: MeetingAgendaItemRow): AgendaItemType {
  if (item.voting_model || item.decision_text) return 'beslutning'
  if (item.is_mandatory) return 'drofting'
  return 'orientering'
}

function AgendaTabPanel({
  meeting,
  tpl,
  items,
  memberById,
  locked,
  canManage,
  priorOpenDecisions,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
  onSendAgenda,
  onJumpToStatistikk,
}: {
  meeting: MeetingRow
  tpl: ResolvedMeetingTemplate | null
  items: MeetingAgendaItemRow[]
  memberById: Map<string, string>
  locked: boolean
  canManage: boolean
  priorOpenDecisions: Array<{ id: string; decision_text: string; meeting_title: string }>
  onAdd: () => void
  onEdit: (item: MeetingAgendaItemRow) => void
  onRemove: (id: string) => void
  onReorder: (orderedIds: string[]) => void
  onSendAgenda: () => void
  onJumpToStatistikk: () => void
}) {
  const ordered = useMemo(() => items.slice().sort((a, b) => a.position - b.position), [items])
  const totalMin = ordered.reduce((a, x) => a + (x.duration_minutes ?? 0), 0)
  const plannedWindowMin = (() => {
    if (meeting.scheduled_at && meeting.ends_at) {
      const ms = new Date(meeting.ends_at).getTime() - new Date(meeting.scheduled_at).getTime()
      if (ms > 0) return Math.round(ms / 60000)
    }
    return tpl?.defaultDurationMinutes ?? Math.max(totalMin, 60)
  })()

  function moveUp(idx: number) {
    if (idx === 0) return
    const next = ordered.slice()
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onReorder(next.map((i) => i.id))
  }
  function moveDown(idx: number) {
    if (idx === ordered.length - 1) return
    const next = ordered.slice()
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onReorder(next.map((i) => i.id))
  }

  const typeCounts: Record<AgendaItemType, number> = { orientering: 0, drofting: 0, beslutning: 0 }
  for (const it of ordered) typeCounts[classifyAgendaItem(it)] += 1

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Agenda</h3>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {ordered.length} punkter · planlagt {totalMin} min · {fmtDateTime(meeting.scheduled_at)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {canManage && !locked ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Send className="h-3 w-3" />}
                  onClick={onSendAgenda}
                >
                  Send agenda
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-3 w-3" />}
                  onClick={onAdd}
                >
                  Legg til punkt
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {priorOpenDecisions.length > 0 ? (
          <div className="mt-3">
            <InfoBox>
              <strong>Vedtak fra tidligere møter ({priorOpenDecisions.length}):</strong>
              <ul className="mt-1.5 space-y-1 text-xs">
                {priorOpenDecisions.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    «{d.decision_text}» —{' '}
                    <span className="italic text-neutral-600">{d.meeting_title}</span>
                  </li>
                ))}
                {priorOpenDecisions.length > 5 ? (
                  <li>… og {priorOpenDecisions.length - 5} til</li>
                ) : null}
              </ul>
            </InfoBox>
          </div>
        ) : null}

        <ol className="mt-3 space-y-2">
          {ordered.length === 0 ? (
            <li className="rounded-md border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
              Ingen agendapunkter ennå.
            </li>
          ) : (
            ordered.map((item, idx) => {
              const type = classifyAgendaItem(item)
              const T = TYPE_BADGE[type]
              const presenter = item.presenter_member_id
                ? memberById.get(item.presenter_member_id)
                : null
              const hasBinding = !!item.binding_snapshot
              return (
                <li
                  key={item.id}
                  className="group rounded-md border border-neutral-200/80 bg-white p-3 hover:border-[#1a3d32]/40 hover:bg-[#fbf9f3]/60"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-xs font-bold tabular-nums text-neutral-700">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-medium text-neutral-900">{item.title}</span>
                        <span
                          className={[
                            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                            T.bg,
                            T.fg,
                          ].join(' ')}
                        >
                          {T.label}
                        </span>
                        {item.is_mandatory ? <Badge variant="critical">Obligatorisk</Badge> : null}
                        {item.law_ref ? (
                          <span className="rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]">
                            {item.law_ref}
                          </span>
                        ) : null}
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-neutral-500">
                          <Clock className="h-2.5 w-2.5" aria-hidden /> {item.duration_minutes ?? 0} min
                        </span>
                      </div>
                      {item.description ? (
                        <p className="mt-1.5 text-[12px] text-neutral-600">{item.description}</p>
                      ) : null}
                      {(hasBinding || presenter) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {hasBinding ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={onJumpToStatistikk}
                              className="inline-flex h-auto items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 hover:bg-blue-100"
                            >
                              <Database className="h-2.5 w-2.5" aria-hidden /> Hentes fra system
                            </Button>
                          ) : null}
                          {presenter ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
                              <Initials name={presenter} size={14} /> {presenter}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                    {!locked && canManage ? (
                      <div className="flex shrink-0 items-center gap-0.5 self-start">
                        {/* Mandatory template items have a fixed position
                            baked into the snapshot — letting the chair
                            reorder them defeats template integrity for
                            audits. Only manual items can be moved. */}
                        {!item.is_mandatory && idx > 0 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveUp(idx)}
                            aria-label="Flytt opp"
                            title="Flytt opp"
                          >
                            <ListTodo className="h-3.5 w-3.5 rotate-180" aria-hidden />
                          </Button>
                        ) : null}
                        {!item.is_mandatory && idx < ordered.length - 1 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveDown(idx)}
                            aria-label="Flytt ned"
                            title="Flytt ned"
                          >
                            <ListTodo className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        ) : null}
                        {item.is_manual ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(item)}
                            aria-label="Rediger"
                            title="Rediger"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        ) : null}
                        {item.is_manual ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemove(item.id)}
                            aria-label="Slett sak"
                            title="Slett sak"
                            className="text-red-500 hover:bg-red-50 hover:text-red-700"
                          >
                            ×
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })
          )}
        </ol>

        {canManage && !locked ? (
          <Button
            variant="ghost"
            onClick={onAdd}
            className="mt-3 flex h-auto w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]"
          >
            <Plus className="h-3 w-3" aria-hidden /> Nytt agendapunkt
          </Button>
        ) : null}
      </div>

      {/* Sidebar */}
      <aside className="space-y-3">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Tidsbudsjett</h3>
            <span className="text-base font-bold tabular-nums text-[#1a3d32]">{totalMin} min</span>
          </div>
          <div className="mt-2">
            <ProgressBar
              value={plannedWindowMin > 0 ? totalMin / plannedWindowMin : 0}
              tone={totalMin <= plannedWindowMin ? 'forest' : 'danger'}
            />
          </div>
          <div className="mt-1.5 text-[11px] tabular-nums text-neutral-600">
            av {plannedWindowMin} min planlagt
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow">
          <h3 className="text-sm font-semibold text-neutral-900">Saktype-fordeling</h3>
          <ul className="mt-2 space-y-1.5 text-[11px]">
            {(['beslutning', 'drofting', 'orientering'] as const).map((t) => {
              const T = TYPE_BADGE[t]
              const count = typeCounts[t]
              return (
                <li key={t} className="flex items-center justify-between">
                  <span
                    className={[
                      'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                      T.bg,
                      T.fg,
                    ].join(' ')}
                  >
                    {T.label}
                  </span>
                  <span className="tabular-nums font-semibold text-neutral-900">{count}</span>
                </li>
              )
            })}
          </ul>
        </div>

        {tpl ? (
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow">
            <h3 className="text-sm font-semibold text-neutral-900">Mal-info</h3>
            <dl className="mt-2 space-y-1.5 text-xs text-neutral-700">
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Mal</dt>
                <dd className="text-right font-medium">{tpl.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Rammeverk</dt>
                <dd>{tpl.framework}</dd>
              </div>
              {tpl.lawRefs.length > 0 ? (
                <div className="border-t border-neutral-100 pt-2">
                  <dt className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Lovreferanser
                  </dt>
                  <dd className="space-y-0.5 text-[11px]">
                    {tpl.lawRefs.map((r) => (
                      <div key={r} className="inline-flex items-center gap-1">
                        <Scale className="h-2.5 w-2.5 text-neutral-400" aria-hidden /> {r}
                      </div>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

        {/* Related docs from agenda attachments — surfaces wiki/document refs
            attached to any agenda item on this meeting. */}
        <RelatedDocsSidebar agendaItems={ordered} />
      </aside>
    </div>
  )
}

// Related-docs sidebar — surfaces agenda items with law_refs or
// binding_snapshots as references the chair should have at hand.
function RelatedDocsSidebar({
  agendaItems,
}: {
  agendaItems: MeetingAgendaItemRow[]
}) {
  const hits = useMemo(
    () =>
      agendaItems
        .filter((i) => i.law_ref || i.binding_snapshot)
        .slice(0, 5)
        .map((i) => ({
          id: i.id,
          title: i.title,
          reason: i.law_ref ?? (i.binding_snapshot ? 'Datakilde brukt' : ''),
        })),
    [agendaItems],
  )
  if (hits.length === 0) return null
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow">
      <h3 className="text-sm font-semibold text-neutral-900">Relaterte referanser</h3>
      <ul className="mt-2 space-y-1.5">
        {hits.map((d) => (
          <li key={d.id}>
            <div className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs">
              <FileText className="h-3 w-3 shrink-0 text-neutral-500" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-neutral-900">{d.title}</span>
                <span className="block truncate text-[10px] text-neutral-500">{d.reason}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// DELTAKERE TAB
// ═════════════════════════════════════════════════════════════════════════

const SIDE_VISUAL: Record<string, { label: string; color: string }> = {
  employer: { label: 'Arbeidsgiversiden', color: '#1a3d32' },
  employee: { label: 'Arbeidstakersiden', color: '#5A9C76' },
  bht: { label: 'Bedriftshelsetjenesten', color: '#737373' },
  observer: { label: 'Observatører', color: '#737373' },
  external: { label: 'Eksterne', color: '#737373' },
}

function sideForAttendee(a: MeetingAttendeeRow): string {
  if (a.side) return a.side
  switch (a.role) {
    case 'chair':
    case 'secretary':
    case 'employer_rep':
      return 'employer'
    case 'employee_rep':
    case 'verneombud':
    case 'hovedverneombud':
    case 'tillitsvalgt':
      return 'employee'
    case 'observer':
      return 'observer'
    case 'guest':
      return 'external'
    default:
      return 'observer'
  }
}

function isVotingRole(role: MeetingAttendeeRole): boolean {
  return (
    role === 'chair' ||
    role === 'employer_rep' ||
    role === 'employee_rep' ||
    role === 'member' ||
    role === 'hovedverneombud' ||
    role === 'tillitsvalgt'
  )
}

function DeltakereTabPanel({
  meeting,
  tpl,
  attendees,
  memberById,
  canManage,
  locked,
  onInvite,
  onSetRsvp,
  onSetAmuLeaderPeriodParty,
}: {
  meeting: MeetingRow
  tpl: ResolvedMeetingTemplate | null
  attendees: MeetingAttendeeRow[]
  memberById: Map<string, string>
  canManage: boolean
  locked: boolean
  onInvite: () => void
  onSetRsvp: ReturnType<typeof useMeetings>['setRsvp']
  onSetAmuLeaderPeriodParty: ReturnType<typeof useMeetings>['setAmuLeaderPeriodParty']
}) {
  const isConfidential = meeting.confidentiality_level !== 'standard'
  const isAmuLike = !!tpl?.definition?.minimumQuorum
  const grouped = useMemo(() => {
    const m = new Map<string, MeetingAttendeeRow[]>()
    for (const a of attendees) {
      const side = sideForAttendee(a)
      const list = m.get(side) ?? []
      list.push(a)
      m.set(side, list)
    }
    return m
  }, [attendees])

  const chair = attendees.find((a) => a.role === 'chair')
  const secretary = attendees.find((a) => a.role === 'secretary')

  // Quorum tracker — once the meeting is `in_progress` or `completed` the
  // chair records `present` per attendee, and that's the authoritative
  // count. While the meeting is still `planned` we fall back to RSVP
  // accepted so the chair can preview whether quorum is likely.
  //
  // The server-side `meeting_parity_check` RPC is the source of truth for
  // signing; this local view is a chair-side preview only — see
  // `ParityPanel.tsx` for the authoritative panel.
  const stage: 'planned' | 'live' =
    meeting.status === 'planned' ? 'planned' : 'live'
  const countAttendee = (a: MeetingAttendeeRow): boolean =>
    stage === 'live' ? a.present === true : a.rsvp_status === 'accepted'
  const presentCount = attendees.filter(countAttendee).length
  const employerCount = attendees.filter(
    (a) => sideForAttendee(a) === 'employer' && countAttendee(a) && isVotingRole(a.role),
  ).length
  const employeeCount = attendees.filter(
    (a) => sideForAttendee(a) === 'employee' && countAttendee(a) && isVotingRole(a.role),
  ).length
  const totalVotingMembers = attendees.filter((a) => isVotingRole(a.role)).length
  // Quorum: prefer the template's minimumQuorum spec; both 'count' and
  // 'percent' kinds are honoured. Default to 4 (AML § 7-2 minimum AMU size).
  const quorumNeeded = (() => {
    const q = tpl?.definition?.minimumQuorum
    if (!q) return 4
    if (q.kind === 'count') return q.value
    if (q.kind === 'percent') return Math.ceil((q.value / 100) * Math.max(1, totalVotingMembers))
    return 4
  })()
  const balanced = employerCount === employeeCount
  const quorumOK = isAmuLike
    ? presentCount >= quorumNeeded && employerCount > 0 && employeeCount > 0
    : meeting.quorum_met !== false

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        {/* Quorum banner — AML § 7-2 compliance */}
        {isAmuLike ? (
          <div
            className={[
              'rounded-md border p-3 text-[12px]',
              quorumOK ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50',
            ].join(' ')}
          >
            <div className="flex items-start gap-3">
              {quorumOK ? (
                <ShieldCheck className="h-4 w-4 shrink-0 text-green-700" aria-hidden />
              ) : (
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
              )}
              <div className="flex-1">
                <div
                  className={[
                    'font-semibold',
                    quorumOK ? 'text-green-900' : 'text-red-900',
                  ].join(' ')}
                >
                  {quorumOK
                    ? 'Quorum oppfylt — møtet er beslutningsdyktig'
                    : 'Quorum ikke oppfylt'}
                </div>
                <p
                  className={[
                    'mt-1 text-[11px]',
                    quorumOK ? 'text-green-800' : 'text-red-800',
                  ].join(' ')}
                >
                  {presentCount} stemmeberettigede {stage === 'live' ? 'til stede' : 'bekreftet'} ({employerCount} fra arbeidsgiver ·{' '}
                  {employeeCount} fra arbeidstaker). Minimum {quorumNeeded}. Like mange fra hver side:{' '}
                  {balanced ? 'Ja' : 'Nei'}.
                </p>
                <p className="mt-1 text-[10px] italic text-neutral-600">
                  AML § 7-2: AMU må ha tilstrekkelig antall medlemmer fra begge parter for å være
                  beslutningsdyktig.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* AMU leder-rotasjon (forskriftens § 3-15) — dobbeltstemme ved likhet */}
        {isAmuLike ? (
          <div className="mt-3 rounded-md border border-cyan-200 bg-cyan-50/40 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-cyan-900">
                  AMU-leder-rotasjon (forskriftens § 3-15)
                </h4>
                <p className="mt-1 text-[11px] text-cyan-900/80">
                  Lederen roterer årlig mellom arbeidsgiver- og arbeidstakerrep. og har
                  dobbeltstemme ved stemmelikhet i partssammensatt voting.
                </p>
                <div className="mt-2">
                  <MeetingAmuLeaderRotationBadge
                    party={meeting.amu_leader_period_party}
                    showEmpty
                  />
                </div>
              </div>
              {canManage && !locked ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant={
                      meeting.amu_leader_period_party === 'arbeidsgiver' ? 'primary' : 'secondary'
                    }
                    size="sm"
                    onClick={() => void onSetAmuLeaderPeriodParty(meeting.id, 'arbeidsgiver')}
                  >
                    Arbeidsgiver
                  </Button>
                  <Button
                    variant={
                      meeting.amu_leader_period_party === 'arbeidstaker' ? 'primary' : 'secondary'
                    }
                    size="sm"
                    onClick={() => void onSetAmuLeaderPeriodParty(meeting.id, 'arbeidstaker')}
                  >
                    Arbeidstaker
                  </Button>
                  {meeting.amu_leader_period_party ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void onSetAmuLeaderPeriodParty(meeting.id, null)}
                      title="Fjern leder-party fra møtet"
                    >
                      Nullstill
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Grouped by side */}
        <div className="mt-4 space-y-4">
          {[...grouped.entries()].map(([side, list]) => {
            const s = SIDE_VISUAL[side] || { label: side, color: '#737373' }
            return (
              <section key={side}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <h4 className="text-sm font-semibold text-neutral-900">{s.label}</h4>
                  <span className="text-[10px] tabular-nums text-neutral-400">
                    {list.length} {list.length === 1 ? 'person' : 'personer'}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {list.map((a) => {
                    const name = memberById.get(a.member_id) ?? `${a.member_id.slice(0, 8)}…`
                    const voting = isVotingRole(a.role)
                    return (
                      <li
                        key={a.member_id}
                        className="flex items-center gap-3 rounded-md border border-neutral-200/80 bg-white p-2.5"
                      >
                        <Initials name={name} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="truncate text-sm font-medium text-neutral-900">
                              {name}
                            </span>
                            {voting ? (
                              <span className="rounded bg-[#e7efe9] px-1 py-0.5 text-[9px] font-bold text-[#14312a]">
                                Stemmerett
                              </span>
                            ) : (
                              <span className="rounded bg-neutral-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-600">
                                Rådgivende
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {MEETING_ATTENDEE_ROLE_LABEL[a.role] ?? a.role}
                          </div>
                          {a.notes ? (
                            <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-neutral-500">
                              <StickyNote className="h-2.5 w-2.5" aria-hidden />
                              {a.notes}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <RsvpControl
                            attendee={a}
                            canManage={canManage}
                            onSetRsvp={(status) =>
                              void onSetRsvp({
                                meetingId: a.meeting_id,
                                memberId: a.member_id,
                                status,
                              })
                            }
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
          {attendees.length === 0 ? (
            <p className="text-sm text-neutral-500">Ingen deltakere registrert ennå.</p>
          ) : null}
        </div>

        {canManage ? (
          <Button
            variant="ghost"
            onClick={onInvite}
            className="mt-4 flex h-auto w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]"
          >
            <UserPlus className="h-3 w-3" aria-hidden /> Inviter deltaker
          </Button>
        ) : null}
      </div>

      {/* Sidebar */}
      <aside className="space-y-3">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow">
          <h3 className="text-sm font-semibold text-neutral-900">Sammensetning</h3>
          <ul className="mt-3 space-y-2 text-xs">
            <li className="flex justify-between">
              <dt className="text-neutral-500">Møteleder</dt>
              <dd className="font-medium text-neutral-900">
                {chair ? memberById.get(chair.member_id) ?? '—' : '—'}
              </dd>
            </li>
            <li className="flex justify-between">
              <dt className="text-neutral-500">Sekretær</dt>
              <dd className="font-medium text-neutral-900">
                {secretary ? memberById.get(secretary.member_id) ?? '—' : '—'}
              </dd>
            </li>
            <li className="flex justify-between">
              <dt className="text-neutral-500">Stemmeberettigede</dt>
              <dd className="font-medium tabular-nums text-neutral-900">
                {attendees.filter((a) => isVotingRole(a.role)).length}
              </dd>
            </li>
            <li className="flex justify-between">
              <dt className="text-neutral-500">Observatører</dt>
              <dd className="font-medium tabular-nums text-neutral-900">
                {attendees.filter((a) => !isVotingRole(a.role) && a.role !== 'secretary').length}
              </dd>
            </li>
            <li className="flex justify-between">
              <dt className="text-neutral-500">{stage === 'live' ? 'Til stede' : 'Bekreftet'}</dt>
              <dd className="font-medium tabular-nums text-neutral-900">
                {presentCount}/{attendees.length}
              </dd>
            </li>
          </ul>
        </div>

        {isAmuLike ? (
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow">
            <h3 className="text-sm font-semibold text-neutral-900">Krav fra AML kap. 7</h3>
            <ul className="mt-2 space-y-2 text-[11px]">
              <li className="flex items-start gap-2">
                <Check
                  className={[
                    'mt-0.5 h-3 w-3 shrink-0',
                    balanced ? 'text-green-600' : 'text-amber-500',
                  ].join(' ')}
                  aria-hidden
                />
                <span>Like mange fra arbeidsgiver- og arbeidstakersiden</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className={[
                    'mt-0.5 h-3 w-3 shrink-0',
                    employerCount > 0 ? 'text-green-600' : 'text-amber-500',
                  ].join(' ')}
                  aria-hidden
                />
                <span>Arbeidsgiver representert</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className={[
                    'mt-0.5 h-3 w-3 shrink-0',
                    attendees.some((a) => a.role === 'hovedverneombud')
                      ? 'text-green-600'
                      : 'text-amber-500',
                  ].join(' ')}
                  aria-hidden
                />
                <span>Hovedverneombud til stede</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className={[
                    'mt-0.5 h-3 w-3 shrink-0',
                    attendees.some((a) => sideForAttendee(a) === 'bht')
                      ? 'text-green-600'
                      : 'text-amber-500',
                  ].join(' ')}
                  aria-hidden
                />
                <span>BHT observatør (rådgivende rolle)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className={[
                    'mt-0.5 h-3 w-3 shrink-0',
                    attendees.length >= 4 && attendees.length <= 8
                      ? 'text-green-600'
                      : 'text-amber-500',
                  ].join(' ')}
                  aria-hidden
                />
                <span>Mellom 4 og 8 medlemmer</span>
              </li>
            </ul>
          </div>
        ) : null}

        {isConfidential ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-[11px] text-amber-900">
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
              <div>
                <div className="font-semibold">Taushetsplikt</div>
                <div className="mt-0.5">
                  AMU-medlemmer har taushetsplikt om personlige forhold (AML § 7-2). Referat
                  anonymiseres ved publisering.
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

function RsvpControl({
  attendee,
  canManage,
  onSetRsvp,
}: {
  attendee: MeetingAttendeeRow
  canManage: boolean
  onSetRsvp: (status: MeetingRsvpStatus) => void
}) {
  if (!canManage) {
    return attendee.rsvp_status === 'accepted' ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700">
        <Check className="h-3 w-3" aria-hidden /> Bekreftet
      </span>
    ) : attendee.rsvp_status === 'declined' ? (
      <span className="inline-flex items-center gap-1 text-[11px] text-red-700">
        <Minus className="h-3 w-3" aria-hidden /> Avslått
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
        <Clock className="h-3 w-3" aria-hidden /> Venter
      </span>
    )
  }
  return (
    <div className="inline-flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSetRsvp('accepted')}
        className={[
          'h-auto rounded px-1.5 py-0.5 text-[10px] font-semibold',
          attendee.rsvp_status === 'accepted'
            ? 'bg-green-100 text-green-800 hover:bg-green-100'
            : 'text-neutral-500 hover:bg-neutral-50',
        ].join(' ')}
        title="Bekreft"
      >
        Bekreftet
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSetRsvp('tentative')}
        className={[
          'h-auto rounded px-1.5 py-0.5 text-[10px] font-semibold',
          attendee.rsvp_status === 'tentative'
            ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
            : 'text-neutral-500 hover:bg-neutral-50',
        ].join(' ')}
        title="Tentativ"
      >
        Kanskje
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSetRsvp('declined')}
        className={[
          'h-auto rounded px-1.5 py-0.5 text-[10px] font-semibold',
          attendee.rsvp_status === 'declined'
            ? 'bg-red-100 text-red-800 hover:bg-red-100'
            : 'text-neutral-500 hover:bg-neutral-50',
        ].join(' ')}
        title="Avslå"
      >
        Avslått
      </Button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// STATISTIKK TAB
// ═════════════════════════════════════════════════════════════════════════

function StatistikkTabPanel({
  meeting,
  tpl,
  agendaItems,
  bindings,
  loading,
  onRefresh,
}: {
  meeting: MeetingRow
  tpl: ResolvedMeetingTemplate | null
  agendaItems: MeetingAgendaItemRow[]
  bindings: Map<string, RenderedBindingResult>
  loading: boolean
  onRefresh: () => Promise<void>
}) {
  const cards = useMemo(() => {
    const out: Array<{
      key: string
      item: MeetingAgendaItemRow
      snap: RenderedBindingResult
    }> = []
    for (const it of agendaItems) {
      const snap = bindings.get(it.id) ?? it.binding_snapshot
      if (!snap) continue
      out.push({ key: it.id, item: it, snap })
    }
    return out
  }, [agendaItems, bindings])

  const tplContracts = (tpl?.definition.agendaItems ?? []).filter(
    (a) => 'dataBinding' in a && a.dataBinding,
  )

  void meeting

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Statistikk hentet automatisk fra systemet
          </h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            Hver kilde fanges som et øyeblikksbilde rett før møtet starter.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="h-3 w-3" />}
            onClick={() => void onRefresh()}
            disabled={loading}
          >
            Oppdater
          </Button>
          <Link to={`/meetings/${meeting.id}/eksport`}>
            <Button variant="secondary" size="sm" icon={<Download className="h-3 w-3" />}>
              Eksporter
            </Button>
          </Link>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
          Ingen automatiske datakilder på dette møtet.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {cards.map(({ key, item, snap }) => (
            <StatistikkCard key={key} item={item} snap={snap} />
          ))}
        </div>
      )}

      {tplContracts.length > 0 ? (
        <div className="mt-5 rounded-md bg-[#fbf9f3] p-4 text-[11px]">
          <h4 className="text-sm font-semibold text-neutral-900">Hva henter systemet?</h4>
          <p className="mt-1 text-neutral-600">
            Malen <span className="font-medium">{tpl?.name}</span> definerer hvilke datakilder
            som hentes automatisk når et nytt møte opprettes. Statistikken oppdateres på nytt rett
            før møtet starter.
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {tplContracts.map((c, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded border border-neutral-200 bg-white px-2 py-1.5"
              >
                <Database className="h-3 w-3 shrink-0 text-neutral-500" aria-hidden />
                <div className="min-w-0 flex-1 text-[10px]">
                  <div className="truncate font-semibold text-neutral-900">{c.title}</div>
                  <div className="truncate text-neutral-500">
                    {c.dataBinding?.source} · {c.dataBinding?.window ?? 'current'}
                  </div>
                </div>
                {c.lawRef ? (
                  <span className="rounded bg-[#e7efe9] px-1 py-0 text-[9px] font-bold text-[#14312a]">
                    {c.lawRef}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function StatistikkCard({
  item,
  snap,
}: {
  item: MeetingAgendaItemRow
  snap: RenderedBindingResult
}) {
  // Extract a top-level metric if the binding includes numeric data rows.
  const headlineNumber = useMemo(() => extractHeadline(snap), [snap])
  const tone = headlineNumber?.tone ?? 'attention'

  const A =
    tone === 'over_target'
      ? {
          border: 'border-red-200',
          bg: 'bg-red-50/40',
          pillBg: 'bg-red-100',
          pillFg: 'text-red-800',
          iconClr: 'text-red-700',
        }
      : tone === 'on_target'
        ? {
            border: 'border-green-200',
            bg: 'bg-green-50/30',
            pillBg: 'bg-green-100',
            pillFg: 'text-green-800',
            iconClr: 'text-green-700',
          }
        : {
            border: 'border-amber-200',
            bg: 'bg-amber-50/40',
            pillBg: 'bg-amber-100',
            pillFg: 'text-amber-800',
            iconClr: 'text-amber-700',
          }

  const Icon =
    tone === 'over_target' ? AlertOctagon : tone === 'on_target' ? CheckCircle2 : AlertTriangle
  const TrendIcon = headlineNumber?.trend === 'up' ? TrendingUp : headlineNumber?.trend === 'down' ? TrendingDown : Minus

  return (
    <section className={['flex flex-col rounded-lg border p-4', A.border, A.bg].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            {item.title}
          </div>
          {headlineNumber ? (
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums text-neutral-900">
                {headlineNumber.value}
              </span>
              {headlineNumber.unit ? (
                <span className="text-sm text-neutral-500">{headlineNumber.unit}</span>
              ) : null}
              {headlineNumber.delta != null ? (
                <span
                  className={[
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    tone === 'on_target'
                      ? 'bg-green-100 text-green-800'
                      : tone === 'over_target'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-900',
                  ].join(' ')}
                >
                  <TrendIcon className="h-2.5 w-2.5" aria-hidden />
                  {headlineNumber.delta > 0 ? '+' : ''}
                  {headlineNumber.delta}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <span
          className={['flex h-8 w-8 shrink-0 items-center justify-center rounded-md', A.pillBg, A.iconClr].join(' ')}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>

      {/* Sparkline if we can extract one */}
      {snap.dataRows && snap.dataRows.length > 1 ? (
        <Sparkline data={snap.dataRows} />
      ) : null}

      {/* Breakdown — subsequent dataRows with label+value structure */}
      <BreakdownList rows={snap.dataRows ?? []} />

      {/* Narrative */}
      <p className="mt-3 whitespace-pre-wrap text-[12px] leading-relaxed text-neutral-700">
        {snap.summaryMarkdown}
      </p>

      {/* Source footer */}
      <div className="mt-auto flex items-center justify-between border-t border-neutral-200/60 pt-2 text-[10px] text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <Database className="h-2.5 w-2.5" aria-hidden />
          {snap.source}
        </span>
        {item.law_ref ? (
          <span className="rounded bg-[#e7efe9] px-1.5 py-0.5 font-semibold text-[#14312a]">
            {item.law_ref}
          </span>
        ) : null}
      </div>
    </section>
  )
}

type Headline = {
  value: string | number
  unit?: string
  delta?: number
  trend?: 'up' | 'down' | 'flat'
  tone: 'on_target' | 'over_target' | 'attention'
}

function extractHeadline(snap: RenderedBindingResult): Headline | null {
  // Heuristics — the data shapes we expect from the resolver include
  // sick_leave_stats (percent), incidents (count), training_completion
  // (percent), etc. The resolver doesn't emit a uniform "headline" yet,
  // so we look in dataRows for a first-row "value" / "current" / "total".
  if (!snap.dataRows?.length) return null
  const first = snap.dataRows[0]
  if (!first) return null
  const num = (k: string) => {
    const v = first[k]
    return typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : null
  }
  const candidates: Array<{ value: number | null; unit: string }> = [
    { value: num('value'), unit: '' },
    { value: num('current'), unit: '' },
    { value: num('total'), unit: '' },
    { value: num('count'), unit: '' },
    { value: num('percent'), unit: '%' },
    { value: num('rate'), unit: '%' },
  ]
  const hit = candidates.find((c) => c.value !== null && Number.isFinite(c.value))
  if (!hit) return null
  const prev = num('prev') ?? num('previous')
  const target = num('target')
  const delta =
    prev !== null && Number.isFinite(prev) ? Number((hit.value! - prev).toFixed(2)) : undefined
  const trend = delta == null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  // Tone: if target exists, a value above target trends "over_target";
  // below target trends "on_target". When no target, we use attention.
  let tone: Headline['tone'] = 'attention'
  if (target !== null && Number.isFinite(target)) {
    tone = hit.value! <= target ? 'on_target' : 'over_target'
  } else if (delta != null && delta < 0) {
    tone = 'on_target'
  } else if (delta != null && delta > 0) {
    tone = 'attention'
  }
  return {
    value: hit.value!,
    unit: hit.unit,
    delta,
    trend,
    tone,
  }
}

function BreakdownList({ rows }: { rows: Array<Record<string, unknown>> }) {
  // Show subsequent rows when they expose a label-style key — useful for
  // sub-aggregates like "Korttid / Langtid" or "Kritisk / Høy / Middels / Lav".
  const items = useMemo(() => {
    const out: Array<{ label: string; value: string; delta?: number }> = []
    for (const row of rows.slice(0, 6)) {
      const label =
        (row.label as string | undefined) ??
        (row.category as string | undefined) ??
        (row.severity as string | undefined) ??
        (row.bucket as string | undefined) ??
        (row.name as string | undefined)
      if (!label) continue
      const valueRaw =
        (row.value as number | string | undefined) ??
        (row.count as number | string | undefined) ??
        (row.current as number | string | undefined)
      if (valueRaw == null) continue
      const value = typeof valueRaw === 'number' ? valueRaw.toString() : String(valueRaw)
      const prev = (row.prev as number | undefined) ?? null
      const delta =
        prev != null && typeof valueRaw === 'number' ? valueRaw - prev : undefined
      out.push({ label, value, delta })
    }
    return out
  }, [rows])
  if (items.length === 0) return null
  return (
    <ul className="mt-3 space-y-1 text-[11px]">
      {items.map((b, i) => (
        <li key={i} className="flex items-center justify-between">
          <span className="text-neutral-600">{b.label}</span>
          <span className="tabular-nums">
            <span className="font-semibold text-neutral-900">{b.value}</span>
            {b.delta != null && b.delta !== 0 ? (
              <span
                className={['ml-1', b.delta > 0 ? 'text-amber-700' : 'text-green-700'].join(' ')}
              >
                {b.delta > 0 ? '+' : ''}
                {b.delta}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Sparkline({ data }: { data: Array<Record<string, unknown>> }) {
  const points = useMemo(() => {
    const values: number[] = []
    for (const row of data) {
      for (const k of ['value', 'current', 'rate', 'percent', 'count']) {
        const v = row[k]
        if (typeof v === 'number' && Number.isFinite(v)) {
          values.push(v)
          break
        }
      }
    }
    if (values.length < 2) return ''
    const max = Math.max(...values)
    const min = Math.min(...values)
    const range = Math.max(1, max - min)
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * 200
        const y = 32 - ((v - min) / range) * 28 - 2
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [data])
  if (!points) return null
  return (
    <svg className="mt-3" width="100%" height="32" viewBox="0 0 200 32" preserveAspectRatio="none">
      <polyline fill="none" stroke="#1a3d32" strokeOpacity="0.6" strokeWidth="1.5" points={points} />
    </svg>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// VEDTAK TAB
// ═════════════════════════════════════════════════════════════════════════

function VedtakTabPanel({
  meeting,
  agendaItems,
  decisions,
  actionItems,
  priorOpenDecisions,
  memberById,
  locked,
  canManage,
  onAddAction,
  onSetActionStatus,
  onSaveMinorityDissent,
}: {
  meeting: MeetingRow
  agendaItems: MeetingAgendaItemRow[]
  decisions: MeetingDecisionRow[]
  actionItems: MeetingActionItemRow[]
  priorOpenDecisions: Array<{
    id: string
    decision_text: string
    decision_at: string
    meeting_id: string
    meeting_title: string
    meeting_scheduled_at: string | null
  }>
  memberById: Map<string, string>
  locked: boolean
  canManage: boolean
  onAddAction: ReturnType<typeof useMeetings>['addActionItem']
  onSetActionStatus: ReturnType<typeof useMeetings>['setActionItemStatus']
  onSaveMinorityDissent: (agendaItemId: string, text: string | null) => Promise<boolean>
}) {
  // Capture "now" once per mount via a lazy useState initialiser so the
  // render is deterministic between re-renders (purity rule).
  const [now] = useState<number>(() => Date.now())

  const openFromPrior = priorOpenDecisions
  void meeting

  // Decisions made in THIS meeting, split by status.
  const thisOpen = decisions.filter((d) => d.status === 'open')
  const thisClosed = decisions.filter((d) => d.status !== 'open')

  // Closing-rate aggregate over actions tied to this meeting.
  const totalActions = actionItems.length
  const doneActions = actionItems.filter((a) => a.status === 'done').length
  const lateActions = actionItems.filter(
    (a) =>
      a.status !== 'done' && a.due_date && new Date(a.due_date).getTime() < now,
  ).length
  const closeRate = totalActions === 0 ? 0 : doneActions / totalActions

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Vedtak og handlingspunkter</h3>
        <p className="mt-0.5 text-[11px] text-neutral-500">
          Vedtak fra dette møtet og åpne handlingspunkter fra forrige.
        </p>

        {/* From previous meetings */}
        <div className="mt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Åpne fra tidligere møter ({openFromPrior.length})
          </h4>
          <ul className="mt-2 space-y-2">
            {openFromPrior.length === 0 ? (
              <li className="rounded border border-dashed border-neutral-200 px-3 py-4 text-center text-[11px] text-neutral-500">
                Ingen åpne handlingspunkter fra tidligere møter.
              </li>
            ) : (
              openFromPrior.map((d) => (
                <li
                  key={d.id}
                  className="rounded-md border p-3 border-neutral-200 bg-white"
                >
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-neutral-900">{d.decision_text}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-neutral-600">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" aria-hidden />
                          <span className="tabular-nums">{fmtDateShort(d.decision_at)}</span>
                        </span>
                        <span className="text-neutral-400">·</span>
                        <span>
                          Fra <span className="italic">{d.meeting_title}</span>
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">
                      åpent
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Vedtak fra dette møtet */}
        <div className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Vedtak fra dette møtet ({decisions.length})
          </h4>
          <ul className="mt-2 space-y-2">
            {decisions.length === 0 ? (
              <li className="rounded border border-dashed border-neutral-200 px-3 py-4 text-center text-[11px] text-neutral-500">
                Ingen vedtak registrert ennå.
              </li>
            ) : (
              <>
                {thisOpen.map((d) => (
                  <li key={d.id} className="rounded-md border border-neutral-200/80 bg-white p-3">
                    <div className="flex items-start gap-3">
                      <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-[#1a3d32]" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-neutral-900">{d.decision_text}</div>
                        <div className="mt-1 text-[11px] text-neutral-500">
                          {fmtDateTime(d.decision_at)}
                        </div>
                      </div>
                      <Badge variant="active">{MEETING_DECISION_STATUS_LABEL[d.status]}</Badge>
                    </div>
                  </li>
                ))}
                {thisClosed.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-md border border-neutral-200/80 bg-white px-3 py-2 opacity-75"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-700" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-neutral-700">{d.decision_text}</div>
                      <div className="mt-0.5 text-[10px] text-neutral-500">
                        Status: {MEETING_DECISION_STATUS_LABEL[d.status]} · {fmtDateShort(d.decision_at)}
                      </div>
                    </div>
                    <Badge variant={d.status === 'implemented' ? 'signed' : 'neutral'}>
                      {MEETING_DECISION_STATUS_LABEL[d.status]}
                    </Badge>
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>

        {/* Mindretallets standpunkt (Forskrift om org. ledelse § 3-16).
            Lovpåkrevd protokollføring av mindretallets begrunnelse for hvert
            agendapunkt der det er stemt mot eller avholdt seg. */}
        <MinorityDissentSection
          agendaItems={agendaItems}
          locked={locked}
          canManage={canManage}
          onSave={onSaveMinorityDissent}
        />

        {/* Action items / oppfølginger */}
        <div className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Oppfølgingsoppgaver ({actionItems.length})
          </h4>
          {actionItems.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-600">Ingen oppgaver registrert.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {actionItems.map((a) => {
                const responsible = a.responsible_member_id
                  ? memberById.get(a.responsible_member_id)
                  : null
                const overdue =
                  a.due_date && a.status !== 'done' && new Date(a.due_date).getTime() < now
                return (
                  <li
                    key={a.id}
                    className={[
                      'rounded-md border p-3',
                      overdue ? 'border-red-200 bg-red-50/40' : 'border-neutral-200 bg-white',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-3">
                      <ListTodo
                        className={[
                          'mt-0.5 h-4 w-4 shrink-0',
                          overdue ? 'text-red-600' : 'text-neutral-500',
                        ].join(' ')}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-neutral-900">{a.description}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-neutral-600">
                          {responsible ? (
                            <span className="inline-flex items-center gap-1">
                              <Initials name={responsible} size={16} /> {responsible}
                            </span>
                          ) : null}
                          {a.due_date ? (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-2.5 w-2.5" aria-hidden />
                              <span
                                className={[
                                  'tabular-nums',
                                  overdue ? 'font-semibold text-red-700' : '',
                                ].join(' ')}
                              >
                                {fmtDateShort(a.due_date)}
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <SearchableSelect
                        value={a.status}
                        options={[
                          { value: 'open', label: MEETING_ACTION_STATUS_LABEL.open },
                          { value: 'in_progress', label: MEETING_ACTION_STATUS_LABEL.in_progress },
                          { value: 'done', label: MEETING_ACTION_STATUS_LABEL.done },
                          { value: 'dropped', label: MEETING_ACTION_STATUS_LABEL.dropped },
                        ]}
                        onChange={(v) => void onSetActionStatus(a.id, v as MeetingActionStatus)}
                        disabled={locked || !canManage}
                        triggerClassName="py-1.5 text-xs"
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {canManage && !locked ? (
          <NewActionForm
            onAdd={async (input) => {
              await onAddAction(input)
            }}
            meetingId={meeting.id}
          />
        ) : null}
      </div>

      {/* Sidebar */}
      <aside className="space-y-3">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow">
          <h3 className="text-sm font-semibold text-neutral-900">Vedtaks-statistikk</h3>
          <ul className="mt-2 space-y-1.5 text-xs">
            <li className="flex justify-between">
              <span className="text-neutral-500">Lukkings-rate</span>
              <span className="font-semibold tabular-nums text-neutral-900">
                {Math.round(closeRate * 100)}%
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-neutral-500">Antall oppgaver</span>
              <span className="font-semibold tabular-nums text-neutral-900">{totalActions}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-neutral-500">Forsinkede</span>
              <span className="font-semibold tabular-nums text-red-700">{lateActions}</span>
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-[#1a3d32]/30 bg-[#e7efe9]/40 p-4">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1a3d32]" aria-hidden />
            <div>
              <h4 className="text-sm font-semibold text-[#14312a]">
                AMU har beslutningsmyndighet
              </h4>
              <p className="mt-1 text-[11px] text-neutral-700">
                AMU kan vedta at arbeidsgiver må gjennomføre tiltak for å verne liv og helse, og
                kan kreve undersøkelser/målinger av helsefare (AML § 7-2).
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

// Mindretallets standpunkt — Forskrift om org. ledelse § 3-16 krever at
// mindretallets begrunnelse protokollføres på hver avstemming der det er
// stemt mot eller avholdt seg. Surfaces a textarea per agenda item with
// recorded against/abstain votes.
function MinorityDissentSection({
  agendaItems,
  locked,
  canManage,
  onSave,
}: {
  agendaItems: MeetingAgendaItemRow[]
  locked: boolean
  canManage: boolean
  onSave: (agendaItemId: string, text: string | null) => Promise<boolean>
}) {
  // Find items where someone voted against or abstained — these need
  // mindretallsbegrunnelse per § 3-16.
  const itemsWithMinority = useMemo(
    () =>
      agendaItems
        .filter(
          (i) =>
            (i.vote_against != null && i.vote_against > 0) ||
            (i.vote_abstain != null && i.vote_abstain > 0),
        )
        .sort((a, b) => a.position - b.position),
    [agendaItems],
  )

  if (itemsWithMinority.length === 0) return null

  return (
    <div className="mt-5">
      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
        Mindretallets standpunkt ({itemsWithMinority.length})
        <span className="ml-2 text-[10px] font-normal normal-case text-neutral-400">
          Forskrift om org. ledelse § 3-16
        </span>
      </h4>
      <p className="mt-1 text-[11px] text-neutral-500">
        Lovpåkrevd protokollføring av mindretallets begrunnelse. Fyll inn for hver sak der det er
        stemt mot eller avholdt seg.
      </p>
      <ul className="mt-2 space-y-2">
        {itemsWithMinority.map((item) => (
          <MinorityDissentEditor
            key={item.id}
            item={item}
            locked={locked || !canManage}
            onSave={onSave}
          />
        ))}
      </ul>
    </div>
  )
}

function MinorityDissentEditor({
  item,
  locked,
  onSave,
}: {
  item: MeetingAgendaItemRow
  locked: boolean
  onSave: (agendaItemId: string, text: string | null) => Promise<boolean>
}) {
  const [text, setText] = useState<string>(item.minority_dissent_text ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sync local text state from server reloads, but only when we're not
  // in the middle of an in-flight save (that would silently discard the
  // user's typed text). useEffect avoids the setState-during-render
  // anti-pattern the previous implementation used.
  useEffect(() => {
    if (busy) return
    setText(item.minority_dissent_text ?? '')
  }, [item.minority_dissent_text, busy])

  async function handleSave() {
    if (busy) return
    setBusy(true)
    setSaved(false)
    try {
      const next = text.trim() ? text : null
      const ok = await onSave(item.id, next)
      if (ok) setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  const hasContent = !!item.minority_dissent_text?.trim()

  return (
    <li className="rounded-md border border-neutral-200/80 bg-white p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-neutral-900">{item.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] tabular-nums text-neutral-500">
            {item.vote_for != null ? <span>For: {item.vote_for}</span> : null}
            {item.vote_against != null ? <span>Mot: {item.vote_against}</span> : null}
            {item.vote_abstain != null ? <span>Avholdende: {item.vote_abstain}</span> : null}
          </div>
        </div>
        {hasContent ? (
          <Badge variant="signed">Protokollført</Badge>
        ) : (
          <Badge variant="warning">Mangler</Badge>
        )}
      </div>
      <StandardTextarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={locked}
        placeholder="Mindretallets begrunnelse — kort sammendrag av hvorfor stemt mot/avholdt."
        className="mt-2"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        {saved ? <span className="text-[10px] text-green-700">Lagret</span> : null}
        <Button
          variant="secondary"
          size="sm"
          icon={<Edit3 className="h-3 w-3" />}
          onClick={() => void handleSave()}
          disabled={locked || busy || text === (item.minority_dissent_text ?? '')}
        >
          Lagre
        </Button>
      </div>
    </li>
  )
}

function NewActionForm({
  onAdd,
  meetingId,
}: {
  onAdd: (input: {
    meetingId: string
    description: string
    dueDate?: string | null
  }) => Promise<void>
  meetingId: string
}) {
  const [desc, setDesc] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy || !desc.trim()) return
    setBusy(true)
    try {
      await onAdd({ meetingId, description: desc.trim(), dueDate: due || null })
      setDesc('')
      setDue('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 grid grid-cols-1 gap-3 rounded-md border border-dashed border-neutral-300 p-3 md:grid-cols-[1fr_180px_auto] md:items-end"
    >
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-new-action">
          Ny oppgave
        </label>
        <StandardInput
          id="meetings-new-action"
          className="mt-1.5"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Beskriv handlingen…"
        />
      </div>
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-new-action-due">
          Frist
        </label>
        <StandardInput
          id="meetings-new-action-due"
          type="date"
          className="mt-1.5"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </div>
      <Button
        variant="primary"
        type="submit"
        icon={<Plus className="h-4 w-4" />}
        disabled={busy || !desc.trim()}
      >
        Legg til
      </Button>
    </form>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// REFERAT TAB
// ═════════════════════════════════════════════════════════════════════════

function ReferatTabPanel({
  meeting,
  tpl,
  attendees,
  agendaItems,
  signatures,
  memberById,
  mandatoryGaps,
  locked,
  canManage,
  onSign,
  onSeedReferat,
}: {
  meeting: MeetingRow
  tpl: ResolvedMeetingTemplate | null
  attendees: MeetingAttendeeRow[]
  agendaItems: MeetingAgendaItemRow[]
  signatures: MeetingSignatureRow[]
  memberById: Map<string, string>
  mandatoryGaps: string[]
  locked: boolean
  canManage: boolean
  onSign: ReturnType<typeof useMeetings>['signProtocol']
  onSeedReferat: () => Promise<void>
}) {
  const ordered = useMemo(() => agendaItems.slice().sort((a, b) => a.position - b.position), [agendaItems])
  const hasMinutes = ordered.some((it) => it.minutes_summary && it.minutes_summary.trim())
  // "Draft" view (empty-state with seed CTA) only when NO minutes exist at
  // all. Once the chair has started writing, render the full document even
  // if some mandatory gaps remain — the sidebar checklist + signature
  // warning already surface what's left to fill.
  const isDraft = !meeting.protocol_signed_at && !hasMinutes
  const confirmedAttendees = attendees.filter((a) => a.rsvp_status === 'accepted')
  const chair = attendees.find((a) => a.role === 'chair')
  const secretary = attendees.find((a) => a.role === 'secretary')

  const [signerName, setSignerName] = useState('')
  const [signerRole, setSignerRole] = useState<'chair' | 'secretary' | 'management' | 'member' | 'other'>('chair')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSign(e: FormEvent) {
    e.preventDefault()
    // Defense-in-depth: the form is already hidden behind a `canManage`
    // check at the call site, but guard the action itself too — the
    // hook is callable from anywhere with a meetings reference, and a
    // future refactor must not silently expose signing to participants.
    if (busy || locked || !canManage || !signerName.trim()) return
    setBusy(true)
    setErrorMsg(null)
    try {
      const ok = await onSign({
        meetingId: meeting.id,
        signerName: signerName.trim(),
        signerRole,
      })
      if (ok) setSignerName('')
      else setErrorMsg('Kunne ikke registrere signering. Sjekk at obligatoriske saker er fylt ut.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article
        className="mx-auto w-full max-w-[720px] rounded-xl bg-white px-6 py-8 ring-1 ring-neutral-200/70 md:px-10 md:py-10"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
      >
        <div className="border-b border-neutral-100 pb-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400">
            Referat · {tpl?.framework ?? 'Møtedokument'}
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-neutral-900 md:text-3xl">
            {meeting.title}
          </h1>
          <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[12px] text-neutral-600 md:grid-cols-2">
            <div>
              <span className="text-neutral-400">Tid: </span>
              <span className="tabular-nums">{fmtDateTime(meeting.scheduled_at)}</span>
            </div>
            <div>
              <span className="text-neutral-400">Sted: </span>
              {meeting.location_label ?? '—'}
            </div>
            <div>
              <span className="text-neutral-400">Møteleder: </span>
              {chair ? memberById.get(chair.member_id) ?? '—' : '—'}
            </div>
            <div>
              <span className="text-neutral-400">Sekretær: </span>
              {secretary ? memberById.get(secretary.member_id) ?? '—' : '—'}
            </div>
          </div>
        </div>

        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Til stede</h2>
          {confirmedAttendees.length === 0 ? (
            <p className="mt-2 text-[13px] text-neutral-500">
              Ingen deltakere har bekreftet ennå.
            </p>
          ) : (
            <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[13px] text-neutral-700 md:grid-cols-2">
              {confirmedAttendees.map((d) => {
                const name = memberById.get(d.member_id) ?? `${d.member_id.slice(0, 8)}…`
                return (
                  <li key={d.member_id}>
                    {name}{' '}
                    <span className="text-neutral-400">
                      — {MEETING_ATTENDEE_ROLE_LABEL[d.role] ?? d.role}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {isDraft ? (
          <div className="mt-8 rounded-md border-2 border-dashed border-neutral-300 px-4 py-8 text-center md:px-6 md:py-10">
            <FileEdit className="mx-auto h-6 w-6 text-neutral-400" aria-hidden />
            <h3 className="mt-2 text-sm font-semibold text-neutral-900">
              Referat ikke skrevet ennå
            </h3>
            <p className="mt-1 text-[12px] text-neutral-500">
              Referatet bør publiseres innen 14 dager etter møtet.
              <br />
              Hvert agendapunkt blir et eget kapittel — pre-utfylt fra agendaen og statistikken.
            </p>
            {canManage && !locked ? (
              <Button
                variant="primary"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => void onSeedReferat()}
                className="mt-4"
                size="sm"
              >
                Start referat fra agenda
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <section className="mt-6 space-y-5 text-[14px] leading-[1.65] text-neutral-700">
              {ordered.map((item, i) => (
                <div key={item.id}>
                  <h2 className="text-[18px] font-bold tracking-tight text-neutral-900">
                    {i + 1}. {item.title}
                  </h2>
                  {item.minutes_summary ? (
                    <p className="mt-1.5 whitespace-pre-wrap">{item.minutes_summary}</p>
                  ) : (
                    <p className="mt-1.5 italic text-neutral-400">
                      Ingen sammendrag protokollført.
                    </p>
                  )}
                  {item.decision_text ? (
                    <div className="mt-3 rounded border border-[#c5d3c8] bg-[#e7efe9]/40 px-3 py-2 text-[13px] text-[#14312a]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#14312a]">
                        Vedtak
                      </span>
                      <p className="mt-1 whitespace-pre-wrap">{item.decision_text}</p>
                      {(item.vote_for ?? 0) + (item.vote_against ?? 0) + (item.vote_abstain ?? 0) > 0 ? (
                        <p className="mt-1.5 text-[11px] tabular-nums text-neutral-700">
                          Stemmer: {item.vote_for ?? 0} for · {item.vote_against ?? 0} mot ·{' '}
                          {item.vote_abstain ?? 0} avholdende
                        </p>
                      ) : null}
                      {item.minority_dissent_text ? (
                        <p className="mt-1.5 text-[11px] italic text-neutral-700">
                          Mindretallets standpunkt: {item.minority_dissent_text}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </section>

            <section className="mt-8 border-t border-neutral-100 pt-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Signaturer
              </h2>
              {signatures.length === 0 ? (
                <p className="mt-2 text-[12px] text-neutral-500">
                  Ingen signaturer registrert ennå.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-6 text-[12px] md:grid-cols-2">
                  {signatures.map((s) => (
                    <div key={s.id}>
                      <div className="text-neutral-500">
                        {s.signer_role === 'chair'
                          ? 'For møteleder'
                          : s.signer_role === 'secretary'
                            ? 'For sekretær'
                            : 'For ' + s.signer_role}
                      </div>
                      <div className="mt-3 font-semibold text-neutral-900">{s.signer_name}</div>
                      <div className="mt-0.5 border-t border-neutral-300 pt-0.5 text-[11px] tabular-nums text-neutral-500">
                        {fmtRelativeDate(s.signed_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </article>

      <aside className="space-y-3">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow">
          <h3 className="text-sm font-semibold text-neutral-900">Referat-krav</h3>
          <ul className="mt-2 space-y-1.5 text-[11px]">
            <li className="flex items-center gap-1.5">
              {hasMinutes ? (
                <CheckCircle2 className="h-3 w-3 text-green-600" aria-hidden />
              ) : (
                <Circle className="h-3 w-3 text-neutral-300" aria-hidden />
              )}
              <span>Skrevet</span>
            </li>
            <li className="flex items-center gap-1.5">
              {meeting.invitation_sent_at ? (
                <CheckCircle2 className="h-3 w-3 text-green-600" aria-hidden />
              ) : (
                <Circle className="h-3 w-3 text-neutral-300" aria-hidden />
              )}
              <span>Sirkulert til partene</span>
            </li>
            <li className="flex items-center gap-1.5">
              {signatures.length >= 2 ? (
                <CheckCircle2 className="h-3 w-3 text-green-600" aria-hidden />
              ) : (
                <Circle className="h-3 w-3 text-neutral-300" aria-hidden />
              )}
              <span>Signert av begge sider</span>
            </li>
            <li className="flex items-center gap-1.5">
              {meeting.archived_at ? (
                <CheckCircle2 className="h-3 w-3 text-green-600" aria-hidden />
              ) : (
                <Circle className="h-3 w-3 text-neutral-300" aria-hidden />
              )}
              <span>Arkivert (5 års oppbevaring)</span>
            </li>
          </ul>
          <p className="mt-3 rounded-md bg-[#fbf9f3] p-2 text-[10px] italic text-neutral-600">
            AML § 7-2 og forskrift om organisering, ledelse og medvirkning krever referat fra alle
            AMU-møter. Brukes til årsrapport til virksomhetens styrende organer.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow">
          <h3 className="text-sm font-semibold text-neutral-900">Eksport</h3>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Link to={`/meetings/${meeting.id}/eksport`}>
              <Button variant="secondary" size="sm" icon={<FileDown className="h-3 w-3" />}>
                PDF
              </Button>
            </Link>
            <Link to={`/meetings/${meeting.id}/eksport`}>
              <Button variant="secondary" size="sm" icon={<FileText className="h-3 w-3" />}>
                Word
              </Button>
            </Link>
          </div>
        </div>

        {canManage && !locked ? (
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow">
            <h3 className="text-sm font-semibold text-neutral-900">Signer protokoll</h3>
            <p className="mt-1 text-[11px] text-neutral-500">
              Låser identitetsbærende felter mot endring. BankID-integrasjon kommer i en senere
              fase.
            </p>
            {mandatoryGaps.length > 0 ? (
              <div className="mt-2">
                <WarningBox>
                  {mandatoryGaps.length} obligatorisk
                  {mandatoryGaps.length === 1 ? '' : 'e'} sak
                  {mandatoryGaps.length === 1 ? '' : 'er'} mangler protokollført innhold.
                </WarningBox>
              </div>
            ) : null}
            {errorMsg ? (
              <div className="mt-2">
                <WarningBox>{errorMsg}</WarningBox>
              </div>
            ) : null}
            <form onSubmit={handleSign} className="mt-3 space-y-2.5">
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-sign-name">
                  Navn
                </label>
                <StandardInput
                  id="meetings-sign-name"
                  className="mt-1.5"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                />
              </div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-sign-role">
                  Rolle
                </label>
                <SearchableSelect
                  value={signerRole}
                  options={[
                    { value: 'chair', label: 'Møteleder' },
                    { value: 'secretary', label: 'Sekretær' },
                    { value: 'management', label: 'Ledelse' },
                    { value: 'member', label: 'Medlem' },
                    { value: 'other', label: 'Annet' },
                  ]}
                  onChange={(v) => setSignerRole(v as typeof signerRole)}
                  className="mt-1.5"
                />
              </div>
              <Button
                variant="primary"
                type="submit"
                size="sm"
                icon={<PenSquare className="h-3 w-3" />}
                disabled={busy || !signerName.trim() || mandatoryGaps.length > 0}
                className="w-full"
              >
                Bekreft protokoll
              </Button>
            </form>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// HISTORIKK TAB
// ═════════════════════════════════════════════════════════════════════════

type AuditEntry = {
  when: string
  actor: string
  action: string
  detail: string
  icon: typeof CheckCircle2
  tone: 'success' | 'neutral' | 'warning'
}

function buildAuditLog(args: {
  meeting: MeetingRow
  agendaItems: MeetingAgendaItemRow[]
  attendees: MeetingAttendeeRow[]
  signatures: MeetingSignatureRow[]
  memberById: Map<string, string>
}): AuditEntry[] {
  const out: AuditEntry[] = []
  const { meeting, agendaItems, attendees, signatures, memberById } = args
  out.push({
    when: meeting.created_at,
    actor: 'System',
    action: 'møte opprettet',
    detail: `${meeting.title} opprettet`,
    icon: CalendarPlus,
    tone: 'neutral',
  })
  if (meeting.invitation_sent_at) {
    out.push({
      when: meeting.invitation_sent_at,
      actor: 'System',
      action: 'innkalling sendt',
      detail: `Innkalling sendt til ${meeting.invitation_recipients?.length ?? 0} deltakere`,
      icon: Send,
      tone: 'success',
    })
  }
  for (const a of agendaItems) {
    if (a.binding_snapshot) {
      out.push({
        when: a.binding_snapshot.resolvedAt,
        actor: 'System',
        action: 'statistikk hentet',
        detail: `${a.title}: ${a.binding_snapshot.source}`,
        icon: Database,
        tone: 'neutral',
      })
    }
  }
  for (const a of attendees) {
    if (a.rsvp_responded_at) {
      const name = memberById.get(a.member_id) ?? a.member_id.slice(0, 8)
      out.push({
        when: a.rsvp_responded_at,
        actor: name,
        action: `RSVP: ${a.rsvp_status}`,
        detail: a.rsvp_reason ?? 'Ingen kommentar',
        icon: a.rsvp_status === 'accepted' ? CheckCircle2 : Clock,
        tone:
          a.rsvp_status === 'accepted'
            ? 'success'
            : a.rsvp_status === 'declined'
              ? 'warning'
              : 'neutral',
      })
    }
  }
  if (meeting.completed_at) {
    out.push({
      when: meeting.completed_at,
      actor: 'System',
      action: 'møte avsluttet',
      detail: 'Møtet ble markert som gjennomført',
      icon: Check,
      tone: 'success',
    })
  }
  for (const s of signatures) {
    out.push({
      when: s.signed_at,
      actor: s.signer_name,
      action: 'signerte protokoll',
      detail: `Rolle: ${s.signer_role}`,
      icon: PenSquare,
      tone: 'success',
    })
  }
  out.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
  return out
}

function HistorikkTabPanel({
  meeting,
  agendaItems,
  attendees,
  signatures,
  memberById,
}: {
  meeting: MeetingRow
  agendaItems: MeetingAgendaItemRow[]
  attendees: MeetingAttendeeRow[]
  signatures: MeetingSignatureRow[]
  memberById: Map<string, string>
}) {
  const entries = useMemo(
    () => buildAuditLog({ meeting, agendaItems, attendees, signatures, memberById }),
    [meeting, agendaItems, attendees, signatures, memberById],
  )

  const TONE = {
    success: { bg: 'bg-green-100', fg: 'text-green-700' },
    neutral: { bg: 'bg-neutral-100', fg: 'text-neutral-600' },
    warning: { bg: 'bg-amber-100', fg: 'text-amber-700' },
  } as const

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Audit-logg</h3>
        <p className="mt-0.5 text-[11px] text-neutral-500">
          Alt som har skjedd rundt dette møtet — fra opprettelse til signert referat.
        </p>

        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">Ingen hendelser registrert ennå.</p>
        ) : (
          <ol className="relative mt-4 border-l-2 border-neutral-200 pl-6">
            {entries.map((a, i) => {
              const Icon = a.icon
              const tone = TONE[a.tone]
              return (
                <li key={i} className="relative mb-4 last:mb-0">
                  <span
                    className={[
                      'absolute -left-[34px] top-0 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white',
                      tone.bg,
                      tone.fg,
                    ].join(' ')}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div className="rounded-md border border-neutral-200/80 bg-white p-3 k-card-shadow">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="text-xs">
                        <span className="font-semibold text-neutral-900">{a.actor}</span>
                        <span className="text-neutral-500"> {a.action}</span>
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-neutral-400">
                        {fmtDateTime(a.when)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-neutral-700">{a.detail}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <aside className="space-y-3">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 k-card-shadow">
          <h3 className="text-sm font-semibold text-neutral-900">Lagring og oppbevaring</h3>
          <ul className="mt-2 space-y-2 text-[12px]">
            <li className="flex justify-between">
              <dt className="text-neutral-500">Referat</dt>
              <dd className="text-neutral-900">5 år (IK § 5)</dd>
            </li>
            <li className="flex justify-between">
              <dt className="text-neutral-500">Vedtaksprotokoll</dt>
              <dd className="text-neutral-900">Permanent</dd>
            </li>
            <li className="flex justify-between">
              <dt className="text-neutral-500">Audit-logg</dt>
              <dd className="text-neutral-900">10 år</dd>
            </li>
            <li className="flex justify-between">
              <dt className="text-neutral-500">Behandlingsgrunnlag</dt>
              <dd className="text-neutral-900">GDPR Art. 6 (1) c</dd>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// Slide panels — Add/edit agenda item · Invite attendee
// ═════════════════════════════════════════════════════════════════════════

type AgendaFormValue = {
  title: string
  description: string
  lawRef: string
  durationMinutes: number
  presenterMemberId: string
}

function AgendaItemSlidePanel({
  open,
  initial,
  memberOptions,
  onClose,
  onSubmit,
}: {
  open: boolean
  initial: MeetingAgendaItemRow | null
  memberOptions: Array<{ value: string; label: string }>
  onClose: () => void
  onSubmit: (v: AgendaFormValue) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [lawRef, setLawRef] = useState('')
  const [durationMinutes, setDurationMinutes] = useState<number>(0)
  const [presenterMemberId, setPresenterMemberId] = useState<string>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(initial?.title ?? '')
    setDescription(initial?.description ?? '')
    setLawRef(initial?.law_ref ?? '')
    setDurationMinutes(initial?.duration_minutes ?? 0)
    setPresenterMemberId(initial?.presenter_member_id ?? '')
  }, [open, initial])

  const handleSubmit = useCallback(async () => {
    if (busy || !title.trim()) return
    setBusy(true)
    try {
      await onSubmit({ title: title.trim(), description, lawRef, durationMinutes, presenterMemberId })
      onClose()
    } finally {
      setBusy(false)
    }
  }, [busy, title, description, lawRef, durationMinutes, presenterMemberId, onSubmit, onClose])

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="meetings-agenda-panel-title"
      title={initial ? 'Rediger agendapunkt' : 'Nytt agendapunkt'}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || !title.trim()}
          >
            {initial ? 'Lagre' : 'Legg til'}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
        className="space-y-5"
      >
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="agenda-title">
            Tittel
          </label>
          <StandardInput
            id="agenda-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="agenda-desc">
            Beskrivelse
          </label>
          <StandardTextarea
            id="agenda-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="agenda-lawref">
              Lovreferanse
            </label>
            <StandardInput
              id="agenda-lawref"
              value={lawRef}
              onChange={(e) => setLawRef(e.target.value)}
              placeholder="AML § …"
              className="mt-1.5"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="agenda-duration">
              Varighet (min)
            </label>
            <StandardInput
              id="agenda-duration"
              type="number"
              min={0}
              value={String(durationMinutes)}
              onChange={(e) => setDurationMinutes(Math.max(0, parseInt(e.target.value || '0', 10)))}
              className="mt-1.5"
            />
          </div>
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="agenda-presenter">
            Ansvarlig
          </label>
          <SearchableSelect
            value={presenterMemberId}
            options={[{ value: '', label: 'Ingen valgt' }, ...memberOptions]}
            onChange={(v) => setPresenterMemberId(v)}
            className="mt-1.5"
          />
        </div>
      </form>
    </SlidePanel>
  )
}

function InviteAttendeeSlidePanel({
  open,
  onClose,
  memberOptions,
  existingAttendeeMemberIds,
  onInvite,
}: {
  open: boolean
  onClose: () => void
  memberOptions: Array<{ value: string; label: string }>
  existingAttendeeMemberIds: string[]
  onInvite: (input: { memberId: string; role: MeetingAttendeeRole }) => Promise<void>
}) {
  const [memberId, setMemberId] = useState('')
  const [role, setRole] = useState<MeetingAttendeeRole>('member')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setMemberId('')
    setRole('member')
  }, [open])

  const availableOptions = useMemo(
    () =>
      memberOptions.filter((o) => !existingAttendeeMemberIds.includes(o.value)),
    [memberOptions, existingAttendeeMemberIds],
  )

  async function handleSubmit() {
    if (busy || !memberId) return
    setBusy(true)
    try {
      await onInvite({ memberId, role })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="meetings-invite-panel-title"
      title="Inviter deltaker"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || !memberId}
          >
            Inviter
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
        className="space-y-5"
      >
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="invite-member">
            Medlem
          </label>
          <SearchableSelect
            value={memberId}
            options={availableOptions}
            onChange={setMemberId}
            placeholder="Velg medlem …"
            className="mt-1.5"
          />
          {availableOptions.length === 0 ? (
            <p className="mt-1 text-xs text-neutral-500">
              Alle aktuelle medlemmer er allerede invitert.
            </p>
          ) : null}
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="invite-role">
            Rolle
          </label>
          <SearchableSelect
            value={role}
            options={Object.entries(MEETING_ATTENDEE_ROLE_LABEL).map(([k, v]) => ({
              value: k,
              label: v,
            }))}
            onChange={(v) => setRole(v as MeetingAttendeeRole)}
            className="mt-1.5"
          />
        </div>
      </form>
    </SlidePanel>
  )
}
