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

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ListChecks,
  PenSquare,
  Plus,
  Scale,
  ShieldCheck,
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

type Tab = 'informasjon' | 'agenda' | 'deltakere' | 'vedtak' | 'protokoll'

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

  const memberById = useMemo(() => {
    const m = new Map<string, string>()
    for (const member of members ?? []) {
      m.set(member.id, member.display_name ?? member.id.slice(0, 8))
    }
    return m
  }, [members])

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

  const tabItems = [
    { id: 'informasjon', label: 'Informasjon', icon: ClipboardList },
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
        </div>
      }
      tabs={<Tabs items={tabItems} activeId={tab} onChange={(id) => setTab(id as Tab)} />}
    >
      {meetings.error ? <WarningBox>{meetings.error}</WarningBox> : null}

      {mandatoryGaps.length > 0 && tab !== 'agenda' ? (
        <InfoBox>
          <strong>{mandatoryGaps.length}</strong> obligatorisk{mandatoryGaps.length === 1 ? '' : 'e'} sak{mandatoryGaps.length === 1 ? '' : 'er'} mangler protokollført innhold.
          Gå til <button type="button" className="underline" onClick={() => setTab('agenda')}>Agenda</button>{' '}
          for å fullføre før signering.
        </InfoBox>
      ) : null}

      {tab === 'informasjon' ? (
        <ModuleSectionCard className="p-5 md:p-6">
          <InformationTab meeting={meeting} />
        </ModuleSectionCard>
      ) : null}

      {tab === 'agenda' ? (
        <ModuleSectionCard className="p-5 md:p-6">
          <AgendaTab
            items={meetings.detail.agendaItems}
            locked={isLocked}
            mandatoryGaps={mandatoryGaps}
            bindings={bindings.resolvedByAgendaItemId}
            priorOpenDecisions={meetings.detail.priorOpenDecisions}
            onSave={meetings.setAgendaMinutes}
          />
        </ModuleSectionCard>
      ) : null}

      {tab === 'deltakere' ? (
        <ModuleSectionCard className="p-5 md:p-6">
          <AttendeesTab attendees={meetings.detail.attendees} memberById={memberById} />
        </ModuleSectionCard>
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

function InformationTab({ meeting }: { meeting: MeetingRow }) {
  const snap = meeting.definition_snapshot
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
          <InvitationBadge
            invitationLeadDays={snap.invitationLeadDays}
            scheduledAt={meeting.scheduled_at}
            invitationSentAt={meeting.invitation_sent_at}
          />
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
        Innkalling ikke registrert (minst {invitationLeadDays} dagers frist iht. forskrift om organisering).
      </div>
    )
  }
  const sent = new Date(invitationSentAt)
  const diffDays = Math.floor((sched.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < invitationLeadDays) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Innkalling sendt {diffDays} dager før — frist er {invitationLeadDays} dager.
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
  mandatoryGaps,
  bindings,
  priorOpenDecisions,
  onSave,
}: {
  items: MeetingAgendaItemRow[]
  locked: boolean
  mandatoryGaps: string[]
  bindings: Map<string, RenderedBindingResult>
  priorOpenDecisions: ReturnType<typeof useMeetings>['detail']['priorOpenDecisions']
  onSave: ReturnType<typeof useMeetings>['setAgendaMinutes']
}) {
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

      {mandatoryGaps.length > 0 ? (
        <WarningBox>
          <strong>Mangler:</strong> {mandatoryGaps.length} obligatorisk{mandatoryGaps.length === 1 ? '' : 'e'} sak{mandatoryGaps.length === 1 ? '' : 'er'} har ikke protokollført innhold:
          <ul className="mt-1.5 list-inside list-disc text-xs">
            {mandatoryGaps.slice(0, 5).map((title) => (
              <li key={title}>{title}</li>
            ))}
            {mandatoryGaps.length > 5 ? <li>… og {mandatoryGaps.length - 5} til</li> : null}
          </ul>
        </WarningBox>
      ) : null}

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

      {items.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Ingen agendapunkter — maler skal materialisere disse automatisk.
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((item) => (
            <AgendaItemEditor
              key={item.id}
              item={item}
              locked={locked}
              binding={bindings.get(item.id)}
              onSave={onSave}
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
}: {
  item: MeetingAgendaItemRow
  locked: boolean
  binding: RenderedBindingResult | undefined
  onSave: ReturnType<typeof useMeetings>['setAgendaMinutes']
}) {
  const [minutes, setMinutes] = useState(item.minutes_summary ?? '')
  const [decisionText, setDecisionText] = useState(item.decision_text ?? '')
  const [decisionStatus, setDecisionStatus] = useState<MeetingDecisionStatus | ''>(
    item.decision_status ?? '',
  )
  const [voteFor, setVoteFor] = useState<string>(item.vote_for?.toString() ?? '')
  const [voteAgainst, setVoteAgainst] = useState<string>(item.vote_against?.toString() ?? '')
  const [voteAbstain, setVoteAbstain] = useState<string>(item.vote_abstain?.toString() ?? '')
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
      })
      if (ok) setSavedAt(Date.now())
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">
            {item.position + 1}. {item.title}
          </p>
          {item.description ? (
            <p className="mt-1 text-xs text-neutral-600">{item.description}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {item.is_mandatory ? <Badge variant="critical">Obligatorisk</Badge> : null}
            {item.law_ref ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                <Scale className="h-3 w-3" /> {item.law_ref}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {binding ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-semibold uppercase tracking-wider text-amber-900/80 text-[10px]">
              Møteforberedelse
            </p>
            {!locked ? (
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

      <div className="mt-3 grid gap-3 md:grid-cols-2">
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
        <div className="space-y-3">
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
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`agenda-${item.id}-for`}>
            Stemmer for
          </label>
          <StandardInput
            id={`agenda-${item.id}-for`}
            className="mt-1.5"
            type="number"
            min={0}
            value={voteFor}
            onChange={(e) => setVoteFor(e.target.value)}
            disabled={locked}
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`agenda-${item.id}-against`}>
            Stemmer mot
          </label>
          <StandardInput
            id={`agenda-${item.id}-against`}
            className="mt-1.5"
            type="number"
            min={0}
            value={voteAgainst}
            onChange={(e) => setVoteAgainst(e.target.value)}
            disabled={locked}
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={`agenda-${item.id}-abstain`}>
            Avholdende
          </label>
          <StandardInput
            id={`agenda-${item.id}-abstain`}
            className="mt-1.5"
            type="number"
            min={0}
            value={voteAbstain}
            onChange={(e) => setVoteAbstain(e.target.value)}
            disabled={locked}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3 border-t border-neutral-200/80 pt-3">
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
    </li>
  )
}

// ── Deltakere ─────────────────────────────────────────────────────────────

function AttendeesTab({
  attendees,
  memberById,
}: {
  attendees: ReturnType<typeof useMeetings>['detail']['attendees']
  memberById: Map<string, string>
}) {
  if (attendees.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Ingen deltakere registrert ennå.
      </p>
    )
  }
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead className="bg-neutral-50/60">
        <tr>
          <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
            Deltaker
          </th>
          <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
            Rolle
          </th>
          <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
            Til stede
          </th>
          <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
            Notat
          </th>
        </tr>
      </thead>
      <tbody>
        {attendees.map((a) => (
          <tr key={`${a.meeting_id}-${a.member_id}`} className="border-t border-neutral-100">
            <td className="px-5 py-3 text-sm text-neutral-900">
              {memberById.get(a.member_id) ?? `${a.member_id.slice(0, 8)}…`}
            </td>
            <td className="px-5 py-3 text-sm text-neutral-700">
              {MEETING_ATTENDEE_ROLE_LABEL[a.role as MeetingAttendeeRole] ?? a.role}
            </td>
            <td className="px-5 py-3 text-sm text-neutral-700">
              {a.present === null ? '—' : a.present ? 'Ja' : 'Nei'}
            </td>
            <td className="px-5 py-3 text-sm text-neutral-600">{a.notes ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
