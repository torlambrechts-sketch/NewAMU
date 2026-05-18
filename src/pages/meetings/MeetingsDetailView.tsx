// Møter — detail view (one meeting).
//
// Tabs: Informasjon · Agenda · Deltakere · Vedtak · Protokoll.
//
// Mandatory-topics banner surfaces any `definition_snapshot.agendaItems[]`
// with `isMandatory: true` that don't have a `minutes_summary` registered
// yet — closing the AML § 7-2 (6) gap (Q4 årsmøte must touch every
// mandatory sak before signing).
//
// Vote inputs (vote_for / vote_against / vote_abstain) ride alongside
// the decision text per agenda item — they remain editable until the
// protocol is signed.

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ListChecks,
  PenSquare,
  Plus,
  Scale,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import { ModulePageShell, ModulePageEmpty } from '../../components/module/ModulePageShell'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { Tabs } from '../../components/ui/Tabs'
import { WarningBox, InfoBox } from '../../components/ui/AlertBox'
import { MandatoryGapsNoticePanel } from '../../../modules/meetings/components/MandatoryGapsNoticePanel'
import { TimeBudgetBar } from '../../../modules/meetings/components/TimeBudgetBar'
import { ParityPanel } from '../../../modules/meetings/components/ParityPanel'
import { RsvpRosterRow } from '../../../modules/meetings/components/RsvpRosterEditor'
import { AutoSourceRail } from '../../../modules/meetings/components/AutoSourceRail'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useMeetings, useMeetingDataBindings } from '../../../modules/meetings'
import { DatapakkeTab } from '../../../modules/meetings/tabs/DatapakkeTab'
import { BriefingDashboardTab } from '../../../modules/meetings/tabs/BriefingDashboardTab'
// Side-effect: register the briefing dashboard scope so the runtime
// can render template-declared layouts via `ReportModulesGrid`.
import '../../../modules/meetings/dashboards/meetingBriefingDashboardScope'
import { AgendaBuilderToolbar } from '../../../modules/meetings/components/AgendaBuilderToolbar'
import {
  AgendaItemFormPanel,
  type AgendaItemFormValue,
} from '../../../modules/meetings/components/AgendaItemFormPanel'
import {
  SuggestedTopicsCard,
  type SuggestedTopic,
} from '../../../modules/meetings/components/SuggestedTopicsCard'
import type { PeriodValue } from '../../../modules/meetings/components/ReportingPeriodPicker'
import type { MeetingDataBinding } from '../../../modules/meetings'

type MeetingDataBindingSource = MeetingDataBinding['source']
import {
  MEETING_ACTION_STATUS_LABEL,
  MEETING_ATTENDEE_ROLE_LABEL,
  MEETING_CONFIDENTIALITY_LABEL,
  MEETING_DECISION_STATUS_LABEL,
  MEETING_STATUS_LABEL,
} from '../../../modules/meetings/meetingsLabels'
import type {
  MeetingActionStatus,
  MeetingAgendaItemRow,
  MeetingAttendeeRole,
  MeetingDecisionStatus,
  MeetingRow,
  MeetingStatus,
  MeetingTemplateAgendaItem,
  RenderedBindingResult,
} from '../../../modules/meetings/types'

type Tab = 'informasjon' | 'datapakke' | 'dashboard' | 'agenda' | 'deltakere' | 'vedtak' | 'protokoll'

const STATUS_BADGE: Record<MeetingStatus, 'draft' | 'active' | 'signed' | 'neutral'> = {
  planned: 'active',
  in_progress: 'active',
  completed: 'signed',
  cancelled: 'neutral',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
}

export function MeetingsDetailView() {
  const { meetingId = '' } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { members } = useOrgSetupContext()
  const meetings = useMeetings()
  const { loadDetail, clearDetail } = meetings
  const [tab, setTab] = useState<Tab>('informasjon')

  // Agenda builder state — slide-panel for add/edit.
  const [agendaFormOpen, setAgendaFormOpen] = useState(false)
  const [agendaEditTarget, setAgendaEditTarget] = useState<
    import('../../../modules/meetings').MeetingAgendaItemRow | null
  >(null)

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

  // IMPORTANT: every hook must be called on every render in the same order.
  // useMeetingDataBindings ALSO fans out to several child hooks (useHse,
  // useInternalControl, useOrgSetupContext, useRepresentatives). Calling it
  // after the early-return guards below would change the hook count between
  // "loading / not-found" renders and "loaded" renders — React error #310.
  // The hook handles null meeting / empty agendaItems internally (returns
  // an empty resolved map), so it's safe to call unconditionally up front.
  const bindings = useMeetingDataBindings({
    meeting: meetings.detail.meeting,
    agendaItems: meetings.detail.agendaItems,
  })

  // Auto-fill — when a freshly-created meeting is opened, write the
  // resolver output directly into each agenda item's binding_snapshot
  // AND seed its empty `minutes_summary` with the resolver's
  // `summaryMarkdown`. The chair now sees real numbers on the Agenda
  // tab from the first render, instead of having to click "Bruk
  // forberedelse" for every item. Only runs:
  //   - once per meeting open (ref-gated)
  //   - never for signed protocols (locked)
  //   - only on items that have no minutes_summary yet (preserves user edits)
  //   - skips placeholder resolvers (snap.error set)
  const autoFilledRef = useRef<string | null>(null)
  useEffect(() => {
    const m = meetings.detail.meeting
    if (!m) return
    if (m.protocol_signed_at) return
    if (autoFilledRef.current === m.id) return
    if (meetings.detail.agendaItems.length === 0) return
    if (bindings.resolvedByAgendaItemId.size === 0) return
    if (bindings.loading) return

    autoFilledRef.current = m.id

    void (async () => {
      for (const item of meetings.detail.agendaItems) {
        const snap = bindings.resolvedByAgendaItemId.get(item.id)
        if (!snap) continue
        // Persist the snapshot if missing — makes the Datapakke load
        // instantly on next view + freezes the value for audit.
        if (!item.binding_snapshot) {
          await meetings.writeBindingSnapshot(item.id, snap)
        }
        // Seed SAMMENDRAG only when empty AND the resolver returned real
        // data (not a manual-prep placeholder error message).
        if (!item.minutes_summary?.trim() && !snap.error) {
          await meetings.setAgendaMinutes(item.id, {
            minutesSummary: snap.summaryMarkdown,
          })
        }
      }
    })()
  }, [
    meetings.detail.meeting,
    meetings.detail.agendaItems,
    bindings.resolvedByAgendaItemId,
    bindings.loading,
    meetings,
  ])

  // Stable parity-loader ref for ParityPanel — declared before any early
  // return so React's hook-order invariant holds.
  const getParityCheckRef = meetings.getParityCheck
  const parityLoader = useCallback(
    (id: string) => getParityCheckRef(id),
    [getParityCheckRef],
  )

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
  const mandatoryGaps = computeMandatoryGaps(meeting, meetings.detail.agendaItems)

  // Hide Datapakke tab when the template defines no bindings — saves a
  // confusing empty-state for MUS / allmøte / personalmøte / legacy meetings.
  const hasAnyBinding = (() => {
    const tplItems = meeting.definition_snapshot?.agendaItems
    if (!tplItems?.length) return false
    return tplItems.some((tpl) => 'dataBinding' in tpl && tpl.dataBinding)
  })()
  const hasBriefingDashboard = (() => {
    const dash = meeting.definition_snapshot?.dashboard
    return !!(dash && Array.isArray(dash.layout) && dash.layout.length > 0)
  })()

  const tabItems: Array<{
    id: Tab
    label: string
    icon: typeof ClipboardList
    badgeCount?: number
    badgeVariant?: 'danger'
  }> = [
    { id: 'informasjon', label: 'Informasjon', icon: ClipboardList },
    ...(hasAnyBinding ? [{ id: 'datapakke' as const, label: 'Datapakke', icon: BarChart3 }] : []),
    ...(hasBriefingDashboard
      ? [{ id: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 }]
      : []),
    {
      id: 'agenda',
      label: 'Agenda',
      icon: ListChecks,
      badgeCount: mandatoryGaps.length || undefined,
      badgeVariant: mandatoryGaps.length ? ('danger' as const) : undefined,
    },
    { id: 'deltakere', label: 'Deltakere', icon: Users },
    { id: 'vedtak', label: 'Vedtak', icon: CheckCircle2 },
    { id: 'protokoll', label: 'Protokoll', icon: PenSquare },
  ]

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: 'Møter', to: '/meetings' },
        { label: meeting.title },
      ]}
      title={meeting.title}
      description={
        <span className="text-sm text-neutral-600">
          {fmtDate(meeting.scheduled_at)} ·{' '}
          {meeting.location_label ? `${meeting.location_label} · ` : ''}
          {MEETING_CONFIDENTIALITY_LABEL[meeting.confidentiality_level]}
        </span>
      }
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {meeting.confidentiality_level !== 'standard' ? (
            <Badge variant="warning">
              {MEETING_CONFIDENTIALITY_LABEL[meeting.confidentiality_level]}
            </Badge>
          ) : null}
          <Badge variant={STATUS_BADGE[meeting.status]}>
            {MEETING_STATUS_LABEL[meeting.status]}
          </Badge>
          {isLocked ? (
            <Badge variant="signed">
              <ShieldCheck className="mr-1 inline h-3 w-3" />
              Signert
            </Badge>
          ) : null}
          {!isLocked && meeting.scheduled_at ? (
            <Link to={`/meetings/${meeting.id}/live`}>
              <Button
                variant={meeting.status === 'in_progress' ? 'primary' : 'secondary'}
                size="sm"
              >
                {meeting.status === 'in_progress' ? 'Åpne møterom →' : 'Gå inn i møterom'}
              </Button>
            </Link>
          ) : null}
        </div>
      }
      tabs={<Tabs items={tabItems} activeId={tab} onChange={(id) => setTab(id as Tab)} />}
    >
      {meetings.error ? <WarningBox>{meetings.error}</WarningBox> : null}

      {mandatoryGaps.length > 0 && tab !== 'agenda' ? (
        <InfoBox>
          <strong>{mandatoryGaps.length}</strong> obligatorisk{mandatoryGaps.length === 1 ? '' : 'e'} sak{mandatoryGaps.length === 1 ? '' : 'er'} mangler protokollført innhold.
          Gå til <Button variant="ghost" size="sm" className="h-auto rounded-none p-0 font-normal underline hover:bg-transparent" onClick={() => setTab('agenda')}>Agenda</Button>{' '}
          for å fullføre før signering.
        </InfoBox>
      ) : null}

      {tab === 'informasjon' ? (
        <ModuleSectionCard className="p-5 md:p-6">
          <InformationTab
            meeting={meeting}
            canManage={meetings.canManage}
            locked={isLocked}
            onSendInvitations={meetings.sendInvitations}
          />
        </ModuleSectionCard>
      ) : null}

      {tab === 'datapakke' ? (
        <DatapakkeTab
          meeting={meeting}
          agendaItems={meetings.detail.agendaItems}
          liveBindings={bindings.resolvedByAgendaItemId}
          extraSignals={bindings.extraSignalsBySource}
          locked={isLocked}
          onChangePeriod={async (p: PeriodValue) => {
            const ok = await meetings.updateMeetingPeriod(meeting.id, p)
            if (ok) {
              // Re-run resolver immediately and write every snapshot.
              for (const item of meetings.detail.agendaItems) {
                const snap = bindings.resolvedByAgendaItemId.get(item.id)
                if (snap) await meetings.writeBindingSnapshot(item.id, snap)
              }
            }
          }}
          onRefreshAll={async () => {
            for (const item of meetings.detail.agendaItems) {
              const snap = bindings.resolvedByAgendaItemId.get(item.id)
              if (snap) await meetings.writeBindingSnapshot(item.id, snap)
            }
          }}
        />
      ) : null}

      {tab === 'dashboard' ? (
        <BriefingDashboardTab
          meeting={meeting}
          agendaItems={meetings.detail.agendaItems}
        />
      ) : null}

      {tab === 'agenda' ? (
        <div className="space-y-4">
          <MandatoryGapsNoticePanel gaps={mandatoryGaps} />
          <TimeBudgetBar
            items={meetings.detail.agendaItems}
            scheduledAt={meeting.scheduled_at}
            endsAt={meeting.ends_at}
            fallbackMinutes={undefined}
          />
          {!isLocked ? (
            <AutoSourceRail
              bindings={Object.fromEntries(bindings.extraSignalsBySource.entries())}
              loading={bindings.loading}
              onAddItem={async (sourceKey, summaryMarkdown) => {
                const created = await meetings.addAgendaItem({
                  meetingId: meeting.id,
                  title: `Auto: ${sourceKey}`,
                  description: summaryMarkdown.slice(0, 500),
                })
                if (created) await meetings.loadDetail(meeting.id)
              }}
            />
          ) : null}
          <ModuleSectionCard className="p-5 md:p-6">
            <AgendaTab
              items={meetings.detail.agendaItems}
              locked={isLocked}
              bindings={bindings.resolvedByAgendaItemId}
              suggestedSignals={bindings.extraSignalsBySource}
              priorOpenDecisions={meetings.detail.priorOpenDecisions}
              onSave={meetings.setAgendaMinutes}
              onAddItem={() => {
                setAgendaEditTarget(null)
                setAgendaFormOpen(true)
              }}
              onEditItem={(item) => {
                setAgendaEditTarget(item)
                setAgendaFormOpen(true)
              }}
              onRemoveItem={async (id) => {
                await meetings.removeAgendaItem(id)
              }}
              onReorder={async (orderedIds) => {
                await meetings.reorderAgendaItems(meeting.id, orderedIds)
              }}
              onRefreshBinding={async (itemId) => {
                const snap = bindings.resolvedByAgendaItemId.get(itemId)
                if (snap) await meetings.writeBindingSnapshot(itemId, snap)
              }}
              onAddSuggestedTopic={async (topic) => {
                // Materialise the suggestion as a manual agenda item +
                // immediately seed its binding_snapshot + SAMMENDRAG.
                const created = await meetings.addAgendaItem({
                  meetingId: meeting.id,
                  title:
                    topic.snapshot.summaryMarkdown.split('\n')[0].slice(0, 100) ||
                    topic.source,
                })
                if (created) {
                  await meetings.writeBindingSnapshot(created.id, topic.snapshot)
                  await meetings.setAgendaMinutes(created.id, {
                    minutesSummary: topic.snapshot.summaryMarkdown,
                  })
                }
              }}
            />
          </ModuleSectionCard>
        </div>
      ) : null}

      <AgendaItemFormPanel
        open={agendaFormOpen}
        onClose={() => setAgendaFormOpen(false)}
        initial={agendaEditTarget}
        memberOptions={memberOptions}
        onSubmit={async (v: AgendaItemFormValue) => {
          const durationMinutes = v.durationMinutes.trim()
            ? Math.max(0, parseInt(v.durationMinutes, 10) || 0)
            : null
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

      {tab === 'deltakere' ? (
        <div className="space-y-4">
          <ParityPanel
            meetingId={meeting.id}
            loader={parityLoader}
            refreshKey={meetings.detail.attendees.length}
          />
          <ModuleSectionCard className="p-5 md:p-6">
            <AttendeesTab
              attendees={meetings.detail.attendees}
              memberById={memberById}
              canManage={meetings.canManage}
              onSetRsvp={meetings.setRsvp}
              onActivateSubstitute={meetings.activateSubstitute}
            />
          </ModuleSectionCard>
        </div>
      ) : null}

      {tab === 'vedtak' ? (
        <ModuleSectionCard className="p-5 md:p-6">
          <DecisionsTab
            meetingId={meeting.id}
            decisions={meetings.detail.decisions}
            actionItems={meetings.detail.actionItems}
            locked={isLocked}
            onAddAction={meetings.addActionItem}
            onSetActionStatus={meetings.setActionItemStatus}
          />
        </ModuleSectionCard>
      ) : null}

      {tab === 'protokoll' ? (
        <ModuleSectionCard className="p-5 md:p-6">
          <ProtocolTab
            meetingId={meeting.id}
            signatures={meetings.detail.signatures}
            mandatoryGaps={mandatoryGaps}
            locked={isLocked}
            canManage={meetings.canManage}
            onSign={meetings.signProtocol}
          />
        </ModuleSectionCard>
      ) : null}
    </ModulePageShell>
  )
}

// ── Informasjon ───────────────────────────────────────────────────────────

function InformationTab({
  meeting,
  canManage,
  locked,
  onSendInvitations,
}: {
  meeting: MeetingRow
  canManage: boolean
  locked: boolean
  onSendInvitations: (input: {
    meetingId: string
    mode?: 'initial' | 'reminder'
  }) => Promise<{ ok: boolean; sent: number; error?: string }>
}) {
  const snap = meeting.definition_snapshot
  const [sendStatus, setSendStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'sent'; count: number; partialWarning?: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  const handleSend = useCallback(
    async (mode: 'initial' | 'reminder') => {
      setSendStatus({ kind: 'sending' })
      const res = await onSendInvitations({ meetingId: meeting.id, mode })
      if (res.ok) {
        // Partial-failure: ok=true with an error message means some
        // recipients were delivered but others weren't (e.g. missing
        // email on profile). Surface both the success count and the
        // warning so the chair can fix profiles for the missing few.
        setSendStatus({
          kind: 'sent',
          count: res.sent,
          partialWarning: res.error,
        })
      } else {
        setSendStatus({ kind: 'error', message: res.error ?? 'Ukjent feil' })
      }
    },
    [onSendInvitations, meeting.id],
  )

  const participantCount = meeting.participant_member_ids?.length ?? 0
  const canSendBaseline = canManage && !locked && meeting.scheduled_at !== null
  const canSend = canSendBaseline && participantCount > 0
  const disabledReason = !canSendBaseline
    ? null
    : participantCount === 0
      ? 'Legg til deltakere på møtet før du kan sende innkalling.'
      : null

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Om møtet</h2>
          <p className="mt-1.5 text-sm text-neutral-600">
            {meeting.description ?? 'Ingen beskrivelse registrert.'}
          </p>
        </div>
        {snap?.invitationLeadDays && meeting.scheduled_at ? (
          <div className="space-y-2">
            <InvitationBadge
              invitationLeadDays={snap.invitationLeadDays}
              scheduledAt={meeting.scheduled_at}
              invitationSentAt={meeting.invitation_sent_at}
            />
            {sendStatus.kind === 'error' ? (
              <WarningBox>
                Innkallingen ble ikke sendt: {sendStatus.message} Sjekk at deltakerne
                har gyldig e-postadresse og prøv igjen.
              </WarningBox>
            ) : null}
            {canSendBaseline ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSend('initial')}
                  disabled={!canSend || sendStatus.kind === 'sending'}
                  title={disabledReason ?? undefined}
                >
                  {meeting.invitation_sent_at ? 'Send ny innkalling' : 'Send innkalling'}
                </Button>
                {meeting.invitation_sent_at ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSend('reminder')}
                    disabled={!canSend || sendStatus.kind === 'sending'}
                    title={disabledReason ?? undefined}
                  >
                    Send påminnelse
                  </Button>
                ) : null}
                {sendStatus.kind === 'sending' ? (
                  <span role="status" className="text-xs text-neutral-500">
                    Sender …
                  </span>
                ) : null}
                {sendStatus.kind === 'sent' ? (
                  <span role="status" className="text-xs text-emerald-700">
                    Sendt til {sendStatus.count} deltaker{sendStatus.count === 1 ? '' : 'e'}.
                    {meeting.invitation_sent_at && sendStatus.count > 0
                      ? ' Påminnelse er nå tilgjengelig.'
                      : ''}
                    {sendStatus.partialWarning ? ` ${sendStatus.partialWarning}` : ''}
                  </span>
                ) : null}
                {disabledReason ? (
                  <span className="text-xs text-neutral-500">{disabledReason}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <aside className="space-y-4">
        <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Detaljer</p>
          <dl className="mt-2 space-y-1.5 text-xs text-neutral-700">
            <div className="flex justify-between gap-3">
              <dt>Status</dt>
              <dd className="font-semibold">{MEETING_STATUS_LABEL[meeting.status]}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Sted</dt>
              <dd className="font-semibold">{meeting.location_label ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Beslutningsdyktig</dt>
              <dd className="font-semibold">
                {meeting.quorum_met === null ? 'Ukjent' : meeting.quorum_met ? 'Ja' : 'Nei'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Konfidensialitet</dt>
              <dd className="font-semibold">
                {MEETING_CONFIDENTIALITY_LABEL[meeting.confidentiality_level]}
              </dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  )
}

function InvitationBadge({
  invitationLeadDays,
  scheduledAt,
  invitationSentAt,
}: {
  invitationLeadDays: number
  scheduledAt: string
  invitationSentAt: string | null
}) {
  const sched = new Date(scheduledAt)
  if (!invitationSentAt) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Innkalling ikke registrert (anbefalt minst {invitationLeadDays} dagers frist for god medvirkning).
      </div>
    )
  }
  const sent = new Date(invitationSentAt)
  const diffDays = Math.floor((sched.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < invitationLeadDays) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Innkalling sendt bare {diffDays} dag{diffDays === 1 ? '' : 'er'} før — anbefalt er minst {invitationLeadDays} dager.
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      Innkalling sendt i god tid ({diffDays} dager før).
    </div>
  )
}

// ── Agenda ────────────────────────────────────────────────────────────────

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

function AgendaTab({
  items,
  locked,
  bindings,
  suggestedSignals,
  priorOpenDecisions,
  onSave,
  onAddItem,
  onEditItem,
  onRemoveItem,
  onReorder,
  onRefreshBinding,
  onAddSuggestedTopic,
}: {
  items: MeetingAgendaItemRow[]
  locked: boolean
  bindings: Map<string, RenderedBindingResult>
  suggestedSignals: Map<MeetingDataBindingSource, RenderedBindingResult>
  priorOpenDecisions: ReturnType<typeof useMeetings>['detail']['priorOpenDecisions']
  onSave: ReturnType<typeof useMeetings>['setAgendaMinutes']
  onAddItem: () => void
  onEditItem: (item: MeetingAgendaItemRow) => void
  onRemoveItem: (id: string) => Promise<void>
  onReorder: (orderedIds: string[]) => Promise<void>
  onRefreshBinding: (itemId: string) => Promise<void>
  onAddSuggestedTopic: (topic: SuggestedTopic) => Promise<void>
}) {
  // Sort by position so up/down reorder operates on the displayed order.
  const ordered = items.slice().sort((a, b) => a.position - b.position)

  function moveUp(idx: number) {
    if (idx === 0) return
    const next = ordered.slice()
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    void onReorder(next.map((i) => i.id))
  }
  function moveDown(idx: number) {
    if (idx === ordered.length - 1) return
    const next = ordered.slice()
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    void onReorder(next.map((i) => i.id))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Agenda</h2>
          <p className="mt-1.5 text-sm text-neutral-600">
            Notér sammendrag, vedtak og stemmer per sak. Obligatoriske saker må fylles ut før signering.
          </p>
        </div>
        <span className="text-xs text-neutral-500">{items.length} saker</span>
      </div>

      <SuggestedTopicsCard
        signals={suggestedSignals}
        locked={locked}
        onAddTopic={onAddSuggestedTopic}
      />

      <AgendaBuilderToolbar items={items} locked={locked} onAddItem={onAddItem} />

      {priorOpenDecisions.length > 0 ? (
        <InfoBox>
          <strong>Vedtak fra tidligere møter ({priorOpenDecisions.length}):</strong>
          <ul className="mt-1.5 space-y-1 text-xs">
            {priorOpenDecisions.slice(0, 8).map((d) => (
              <li key={d.id}>
                <span className="text-neutral-900">«{d.decision_text}»</span>{' '}
                <span className="text-neutral-500">
                  — {d.meeting_title} ({fmtDate(d.meeting_scheduled_at)})
                </span>
              </li>
            ))}
            {priorOpenDecisions.length > 8 ? (
              <li>… og {priorOpenDecisions.length - 8} til</li>
            ) : null}
          </ul>
        </InfoBox>
      ) : null}

      {ordered.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Ingen agendapunkter ennå. Trykk «Legg til sak» for å begynne.
        </p>
      ) : (
        <ol id="agenda-items-list" className="divide-y divide-neutral-200/80 border-t border-neutral-200/80">
          {ordered.map((item, idx) => (
            <AgendaItemEditor
              key={item.id}
              item={item}
              locked={locked}
              binding={bindings.get(item.id)}
              onSave={onSave}
              onEdit={item.is_manual ? () => onEditItem(item) : undefined}
              onRemove={
                !locked && !item.is_mandatory
                  ? () => void onRemoveItem(item.id)
                  : undefined
              }
              onMoveUp={!locked && idx > 0 ? () => moveUp(idx) : undefined}
              onMoveDown={
                !locked && idx < ordered.length - 1 ? () => moveDown(idx) : undefined
              }
              onRefreshBinding={() => void onRefreshBinding(item.id)}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

function AgendaItemEditor({
  item,
  locked,
  binding,
  onSave,
  onEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
  onRefreshBinding,
}: {
  item: MeetingAgendaItemRow
  locked: boolean
  binding: RenderedBindingResult | undefined
  onSave: ReturnType<typeof useMeetings>['setAgendaMinutes']
  onEdit?: () => void
  onRemove?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRefreshBinding: () => void
}) {
  const [minutes, setMinutes] = useState(item.minutes_summary ?? '')
  const [decisionText, setDecisionText] = useState(item.decision_text ?? '')
  const [decisionStatus, setDecisionStatus] = useState<MeetingDecisionStatus | ''>(
    item.decision_status ?? '',
  )
  const [voteFor, setVoteFor] = useState<string>(item.vote_for?.toString() ?? '')
  const [voteAgainst, setVoteAgainst] = useState<string>(item.vote_against?.toString() ?? '')
  const [voteAbstain, setVoteAbstain] = useState<string>(item.vote_abstain?.toString() ?? '')
  const [minorityDissent, setMinorityDissent] = useState<string>(
    item.minority_dissent_text ?? '',
  )
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  function parseInt0(v: string): number | null {
    if (v.trim() === '') return null
    const n = parseInt(v, 10)
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  async function handleSave() {
    if (locked || busy) return
    setBusy(true)
    setSavedAt(null)
    try {
      const ok = await onSave(item.id, {
        minutesSummary: minutes || null,
        decisionText: decisionText || null,
        decisionStatus: decisionStatus || null,
        voteFor: parseInt0(voteFor),
        voteAgainst: parseInt0(voteAgainst),
        voteAbstain: parseInt0(voteAbstain),
        minorityDissentText: minorityDissent.trim() ? minorityDissent : null,
      })
      if (ok) setSavedAt(Date.now())
    } finally {
      setBusy(false)
    }
  }

  return (
    <li
      id={`agenda-${item.id}`}
      className="py-8 first:pt-6"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(220px,28%)_1fr] lg:gap-10">
        {/* ── Left gutter: prompt, badges, controls ───────────────────── */}
        <div className="min-w-0 space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold leading-snug text-neutral-900">
              {item.title}
            </p>
            {item.description ? (
              <p className="text-xs leading-relaxed text-neutral-600">
                {item.description}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {item.is_mandatory ? <Badge variant="critical">Obligatorisk</Badge> : null}
            {item.is_manual ? <Badge variant="info">Manuell</Badge> : null}
            {item.law_ref ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                <Scale className="h-3 w-3" /> {item.law_ref}
              </span>
            ) : null}
            {item.duration_minutes != null ? (
              <span className="text-[11px] text-neutral-500">
                ⏱ {item.duration_minutes} min
              </span>
            ) : null}
          </div>
          {(onMoveUp || onMoveDown || onEdit || onRemove) && !locked ? (
            <div className="flex items-center gap-0.5 pt-1">
              {onMoveUp ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onMoveUp}
                  className="h-7 w-7 rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="Flytt opp"
                  title="Flytt opp"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {onMoveDown ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onMoveDown}
                  className="h-7 w-7 rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="Flytt ned"
                  title="Flytt ned"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {onEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onEdit}
                  className="h-7 w-7 rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="Rediger sak"
                  title="Rediger sak"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {onRemove ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRemove}
                  className="h-7 w-7 rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                  aria-label="Slett sak"
                  title="Slett sak"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ── Right column: labeled controls ──────────────────────────── */}
        <div className="space-y-5">
          {binding ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className={`${WPSTD_FORM_FIELD_LABEL} !text-amber-900/80`}>
                  Møteforberedelse
                </p>
                {!locked ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={onRefreshBinding}
                      title="Oppdater datasnapshot for denne saken"
                    >
                      Oppdater data
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setMinutes((prev) => {
                          if (prev && prev.trim().length > 0) {
                            return `${prev}\n\n${binding.summaryMarkdown}`
                          }
                          return binding.summaryMarkdown
                        })
                      }}
                    >
                      Bruk forberedelse
                    </Button>
                  </div>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">
                {binding.summaryMarkdown}
              </p>
              {binding.error ? (
                <p className="mt-2 text-[11px] italic text-amber-700">⚠ {binding.error}</p>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`agenda-${item.id}-min`}>
              Sammendrag
            </label>
            <StandardTextarea
              id={`agenda-${item.id}-min`}
              className="mt-1.5"
              rows={3}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              disabled={locked}
            />
          </div>

          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`agenda-${item.id}-dec`}>
              Vedtak
            </label>
            <StandardTextarea
              id={`agenda-${item.id}-dec`}
              className="mt-1.5"
              rows={2}
              value={decisionText}
              onChange={(e) => setDecisionText(e.target.value)}
              disabled={locked}
            />
          </div>

          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`agenda-${item.id}-st`}>
              Vedtaksstatus
            </label>
            <SearchableSelect
              value={decisionStatus}
              options={[
                { value: '', label: '—' },
                { value: 'open', label: MEETING_DECISION_STATUS_LABEL.open },
                { value: 'implemented', label: MEETING_DECISION_STATUS_LABEL.implemented },
                { value: 'dropped', label: MEETING_DECISION_STATUS_LABEL.dropped },
              ]}
              onChange={(v) => setDecisionStatus(v as MeetingDecisionStatus | '')}
              className="mt-1.5"
              disabled={locked}
            />
          </div>

          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Stemmer</label>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
              <StandardInput
                id={`agenda-${item.id}-for`}
                type="number"
                min={0}
                placeholder="For"
                value={voteFor}
                onChange={(e) => setVoteFor(e.target.value)}
                disabled={locked}
              />
              <StandardInput
                id={`agenda-${item.id}-against`}
                type="number"
                min={0}
                placeholder="Mot"
                value={voteAgainst}
                onChange={(e) => setVoteAgainst(e.target.value)}
                disabled={locked}
              />
              <StandardInput
                id={`agenda-${item.id}-abstain`}
                type="number"
                min={0}
                placeholder="Avholdende"
                value={voteAbstain}
                onChange={(e) => setVoteAbstain(e.target.value)}
                disabled={locked}
              />
            </div>
          </div>

          {(parseInt0(voteAgainst) ?? 0) + (parseInt0(voteAbstain) ?? 0) > 0 ||
          minorityDissent ? (
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`agenda-${item.id}-dissent`}>
                Mindretallets standpunkt
                <span className="ml-2 text-[10px] font-normal text-neutral-500">
                  Forskrift om org. ledelse § 3-16
                </span>
              </label>
              <StandardTextarea
                id={`agenda-${item.id}-dissent`}
                rows={3}
                placeholder="Protokollfør mindretallets begrunnelse for å sikre etterlevelse av § 3-16."
                value={minorityDissent}
                onChange={(e) => setMinorityDissent(e.target.value)}
                disabled={locked}
                className="mt-1.5"
              />
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-1">
            {savedAt ? <Badge variant="signed">Lagret</Badge> : null}
            <Button
              variant="primary"
              type="button"
              size="sm"
              icon={<Edit3 className="h-3.5 w-3.5" />}
              onClick={handleSave}
              disabled={locked || busy}
            >
              Lagre sak
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}

// ── Deltakere ─────────────────────────────────────────────────────────────

function AttendeesTab({
  attendees,
  memberById,
  canManage,
  onSetRsvp,
  onActivateSubstitute,
}: {
  attendees: ReturnType<typeof useMeetings>['detail']['attendees']
  memberById: Map<string, string>
  canManage: boolean
  onSetRsvp: ReturnType<typeof useMeetings>['setRsvp']
  onActivateSubstitute: ReturnType<typeof useMeetings>['activateSubstitute']
}) {
  if (attendees.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Ingen deltakere registrert ennå.
      </p>
    )
  }
  // Candidate substitutes per side — anyone marked as substitute_for_*
  // can be activated for their principal.
  const candidates = attendees
    .filter((a) => a.substitute_for_member_id !== null)
    .map((a) => ({
      id: a.member_id,
      name: memberById.get(a.member_id) ?? `${a.member_id.slice(0, 8)}…`,
      side: a.side,
    }))

  // Principals = attendees who are NOT marked as someone else's substitute.
  const principals = attendees.filter((a) => a.substitute_for_member_id === null)
  return (
    <ul className="divide-y divide-neutral-100">
      {principals.map((a) => (
        <RsvpRosterRow
          key={`${a.meeting_id}-${a.member_id}`}
          attendee={a}
          memberName={memberById.get(a.member_id) ?? `${a.member_id.slice(0, 8)}…`}
          memberRole={MEETING_ATTENDEE_ROLE_LABEL[a.role as MeetingAttendeeRole] ?? a.role}
          candidateSubstitutes={candidates}
          canManage={canManage}
          onSetRsvp={(status, reason) =>
            onSetRsvp({
              meetingId: a.meeting_id,
              memberId: a.member_id,
              status,
              reason: reason ?? null,
            })
          }
          onActivateSubstitute={(substituteMemberId) =>
            onActivateSubstitute({
              meetingId: a.meeting_id,
              substituteMemberId,
              principalMemberId: a.member_id,
            })
          }
        />
      ))}
    </ul>
  )
}

// ── Vedtak ────────────────────────────────────────────────────────────────

function DecisionsTab({
  meetingId,
  decisions,
  actionItems,
  locked,
  onAddAction,
  onSetActionStatus,
}: {
  meetingId: string
  decisions: ReturnType<typeof useMeetings>['detail']['decisions']
  actionItems: ReturnType<typeof useMeetings>['detail']['actionItems']
  locked: boolean
  onAddAction: ReturnType<typeof useMeetings>['addActionItem']
  onSetActionStatus: ReturnType<typeof useMeetings>['setActionItemStatus']
}) {
  const [desc, setDesc] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (locked || busy || !desc.trim()) return
    setBusy(true)
    try {
      const ok = await onAddAction({
        meetingId,
        description: desc.trim(),
        dueDate: due || null,
      })
      if (ok) {
        setDesc('')
        setDue('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">Vedtak</h2>
          <span className="text-xs text-neutral-500">{decisions.length}</span>
        </div>
        {decisions.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">Ingen vedtak registrert.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {decisions.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
              >
                <p className="text-sm font-semibold text-neutral-900">{d.decision_text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                  <span>{fmtDate(d.decision_at)}</span>
                  <Badge variant={d.status === 'implemented' ? 'signed' : d.status === 'dropped' ? 'neutral' : 'active'}>
                    {MEETING_DECISION_STATUS_LABEL[d.status]}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
          <h2 className="text-lg font-semibold text-neutral-900">Oppfølgingsoppgaver</h2>
          <span className="text-xs text-neutral-500">{actionItems.length}</span>
        </div>
        {actionItems.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">Ingen oppgaver registrert.</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-left text-sm">
            <thead className="bg-neutral-50/60">
              <tr>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                  Oppgave
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                  Frist
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {actionItems.map((a) => (
                <tr key={a.id} className="border-t border-neutral-100">
                  <td className="px-5 py-3 text-sm text-neutral-800">{a.description}</td>
                  <td className="px-5 py-3 text-sm text-neutral-700">{a.due_date ?? '—'}</td>
                  <td className="px-5 py-3">
                    <SearchableSelect
                      value={a.status}
                      options={[
                        { value: 'open', label: MEETING_ACTION_STATUS_LABEL.open },
                        { value: 'in_progress', label: MEETING_ACTION_STATUS_LABEL.in_progress },
                        { value: 'done', label: MEETING_ACTION_STATUS_LABEL.done },
                        { value: 'dropped', label: MEETING_ACTION_STATUS_LABEL.dropped },
                      ]}
                      onChange={(v) => void onSetActionStatus(a.id, v as MeetingActionStatus)}
                      disabled={locked}
                      triggerClassName="py-1.5 text-xs"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {locked ? null : (
          <form onSubmit={handleAdd} className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-new-action">
                Ny oppgave
              </label>
              <StandardInput
                id="meetings-new-action"
                className="mt-1.5"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
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
        )}
      </section>
    </div>
  )
}

// ── Protokoll ─────────────────────────────────────────────────────────────

function ProtocolTab({
  meetingId,
  signatures,
  mandatoryGaps,
  locked,
  canManage,
  onSign,
}: {
  meetingId: string
  signatures: ReturnType<typeof useMeetings>['detail']['signatures']
  mandatoryGaps: string[]
  locked: boolean
  canManage: boolean
  onSign: ReturnType<typeof useMeetings>['signProtocol']
}) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<'chair' | 'secretary' | 'management' | 'member' | 'other'>('chair')
  const [busy, setBusy] = useState(false)

  async function handleSign(e: FormEvent) {
    e.preventDefault()
    if (busy || locked || !name.trim()) return
    setBusy(true)
    try {
      const ok = await onSign({ meetingId, signerName: name.trim(), signerRole: role })
      if (ok) setName('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <InfoBox>
        <strong>Bekreftelse — ikke juridisk signatur.</strong> BankID-integrasjon kommer i en senere
        fase (jf. Council Review §3.4). Bekreftelsen låser identitetsbærende kolonner mot endring,
        men metadata forblir editerbar.
      </InfoBox>

      <div>
        <Link
          to={`/meetings/${meetingId}/eksport`}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Last ned protokoll-pakke
        </Link>
        <p className="mt-1 text-xs text-neutral-500">
          Genererer en utskriftsklar protokoll inkludert deltakere, agenda, vedtak,
          oppgaver, signaturer og forberedelsesdata (Skriv ut → Lagre som PDF).
        </p>
      </div>

      {mandatoryGaps.length > 0 ? (
        <WarningBox>
          Protokollen kan ikke signeres før obligatoriske saker er fylt ut. Mangler{' '}
          <strong>{mandatoryGaps.length}</strong>.{' '}
          <Link to="?" className="underline">
            Tilbake til agenda
          </Link>
        </WarningBox>
      ) : null}

      {signatures.length > 0 ? (
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-neutral-50/60">
            <tr>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                Navn
              </th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                Rolle
              </th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                Tidspunkt
              </th>
            </tr>
          </thead>
          <tbody>
            {signatures.map((s) => (
              <tr key={s.id} className="border-t border-neutral-100">
                <td className="px-5 py-3 text-sm font-semibold text-neutral-900">
                  {s.signer_name}
                </td>
                <td className="px-5 py-3 text-sm text-neutral-700">{s.signer_role}</td>
                <td className="px-5 py-3 text-sm text-neutral-600">{fmtDate(s.signed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-neutral-600">Ingen bekreftelser registrert ennå.</p>
      )}

      {canManage && !locked ? (
        <form onSubmit={handleSign} className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end border-t border-neutral-100 pt-4">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-sign-name">
              Navn
            </label>
            <StandardInput
              id="meetings-sign-name"
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-sign-role">
              Rolle
            </label>
            <SearchableSelect
              value={role}
              options={[
                { value: 'chair', label: 'Møteleder' },
                { value: 'secretary', label: 'Sekretær' },
                { value: 'management', label: 'Ledelse' },
                { value: 'member', label: 'Medlem' },
                { value: 'other', label: 'Annet' },
              ]}
              onChange={(v) => setRole(v as typeof role)}
              className="mt-1.5"
            />
          </div>
          <Button
            variant="primary"
            type="submit"
            icon={<PenSquare className="h-4 w-4" />}
            disabled={busy || !name.trim() || mandatoryGaps.length > 0}
          >
            Bekreft protokoll
          </Button>
        </form>
      ) : null}
    </div>
  )
}
