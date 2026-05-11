// Møter — detail view (single meeting).
//
// Tabs: Oversikt, Agenda, Deltakere, Vedtak, Protokoll.
// All tabs share the loaded MeetingDetail from useMeetings. Agenda tab
// owns per-item minutes + decision editing. Protokoll tab handles
// confirmation signing (level1-style, *not* legally binding eSign).

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
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
import { useMeetings } from '../../../modules/meetings'
import {
  MEETING_ACTION_STATUS_LABEL,
  MEETING_CONFIDENTIALITY_LABEL,
  MEETING_DECISION_STATUS_LABEL,
  MEETING_STATUS_LABEL,
} from '../../../modules/meetings/meetingsLabels'
import type {
  MeetingActionStatus,
  MeetingAgendaItemRow,
  MeetingDecisionStatus,
} from '../../../modules/meetings/types'

type Tab = 'overview' | 'agenda' | 'attendees' | 'decisions' | 'protocol'

const TABS: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'overview', label: 'Oversikt', icon: ClipboardList },
  { id: 'agenda', label: 'Agenda', icon: ListChecks },
  { id: 'attendees', label: 'Deltakere', icon: Users },
  { id: 'decisions', label: 'Vedtak', icon: CheckCircle2 },
  { id: 'protocol', label: 'Protokoll', icon: PenSquare },
]

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
}

export function MeetingsDetailView() {
  const { meetingId = '' } = useParams<{ meetingId: string }>()
  const meetings = useMeetings()
  const { loadDetail, clearDetail } = meetings
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    if (!meetingId) return
    void loadDetail(meetingId)
    return () => clearDetail()
  }, [meetingId, loadDetail, clearDetail])

  const detail = meetings.detail
  const meeting = detail.meeting
  const isLocked = !!meeting?.protocol_signed_at

  if (meetings.detailLoading && !meeting) {
    return <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-600">Laster møtet…</div>
  }
  if (!meeting) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-600">
        Fant ikke møtet.{' '}
        <Link to="/meetings" className="text-cyan-700 underline">
          Gå tilbake
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            to="/meetings"
            className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-3 w-3" /> Møter
          </Link>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-neutral-900">
            {meeting.title}
          </h1>
          <p className="mt-1 text-xs text-neutral-600">
            {fmtDate(meeting.scheduled_at)} · {MEETING_STATUS_LABEL[meeting.status]} ·{' '}
            <span className="font-semibold">
              {MEETING_CONFIDENTIALITY_LABEL[meeting.confidentiality_level]}
            </span>
          </p>
        </div>
        {isLocked ? (
          <span className="inline-flex items-center gap-1 border border-emerald-700 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
            <ShieldCheck className="h-3 w-3" /> Protokoll signert {fmtDate(meeting.protocol_signed_at)}
          </span>
        ) : null}
      </header>

      <nav className="mb-4 flex flex-wrap gap-1 border-b border-neutral-200">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${
                active
                  ? 'border-b-2 border-cyan-700 text-cyan-700'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </nav>

      {tab === 'overview' ? <OverviewTab meeting={meeting} /> : null}
      {tab === 'agenda' ? (
        <AgendaTab
          items={detail.agendaItems}
          locked={isLocked}
          onSave={meetings.setAgendaMinutes}
        />
      ) : null}
      {tab === 'attendees' ? <AttendeesTab attendees={detail.attendees} /> : null}
      {tab === 'decisions' ? (
        <DecisionsTab
          decisions={detail.decisions}
          actionItems={detail.actionItems}
          onAddAction={meetings.addActionItem}
          onSetActionStatus={meetings.setActionItemStatus}
          locked={isLocked}
          meetingId={meeting.id}
        />
      ) : null}
      {tab === 'protocol' ? (
        <ProtocolTab
          meetingId={meeting.id}
          signatures={detail.signatures}
          locked={isLocked}
          onSign={meetings.signProtocol}
          canManage={meetings.canManage}
        />
      ) : null}
    </div>
  )
}

function OverviewTab({ meeting }: { meeting: NonNullable<ReturnType<typeof useMeetings>['detail']['meeting']> }) {
  const snap = meeting.definition_snapshot
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="space-y-3 lg:col-span-2">
        {meeting.description ? (
          <p className="text-sm leading-relaxed text-neutral-800">{meeting.description}</p>
        ) : (
          <p className="text-sm text-neutral-500">Ingen beskrivelse.</p>
        )}
        {snap?.invitationLeadDays && meeting.scheduled_at ? (
          <InvitationBadge
            invitationLeadDays={snap.invitationLeadDays}
            scheduledAt={meeting.scheduled_at}
            invitationSentAt={meeting.invitation_sent_at}
          />
        ) : null}
      </section>
      <aside className="space-y-3">
        <div className="border border-neutral-200 bg-white p-3 text-xs">
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Detaljer
          </h3>
          <dl className="space-y-1 text-neutral-700">
            <div className="flex justify-between gap-3">
              <dt>Sted</dt>
              <dd className="font-semibold">{meeting.location_label ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Møteleder</dt>
              <dd className="font-semibold text-right">
                {meeting.protocol_signed_by ? '—' : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Quorum</dt>
              <dd className="font-semibold">
                {meeting.quorum_met === null
                  ? 'Ukjent'
                  : meeting.quorum_met
                  ? 'Ja'
                  : 'Nei'}
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
      <div className="inline-flex items-center gap-2 border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
        <AlertTriangle className="h-3.5 w-3.5" />
        Innkalling ikke registrert (minst {invitationLeadDays} dagers frist)
      </div>
    )
  }
  const sent = new Date(invitationSentAt)
  const diffDays = Math.floor((sched.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < invitationLeadDays) {
    return (
      <div className="inline-flex items-center gap-2 border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-900">
        <AlertTriangle className="h-3.5 w-3.5" />
        Innkalling sendt {diffDays} dager før – frist er {invitationLeadDays} dager.
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-2 border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Innkalling sendt i god tid ({diffDays} dager før).
    </div>
  )
}

function AgendaTab({
  items,
  locked,
  onSave,
}: {
  items: MeetingAgendaItemRow[]
  locked: boolean
  onSave: ReturnType<typeof useMeetings>['setAgendaMinutes']
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Ingen agendapunkter. (Maler skal materialisere disse automatisk.)
      </p>
    )
  }
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <AgendaItemEditor key={item.id} item={item} locked={locked} onSave={onSave} />
      ))}
    </ol>
  )
}

function AgendaItemEditor({
  item,
  locked,
  onSave,
}: {
  item: MeetingAgendaItemRow
  locked: boolean
  onSave: ReturnType<typeof useMeetings>['setAgendaMinutes']
}) {
  const [minutes, setMinutes] = useState(item.minutes_summary ?? '')
  const [decisionText, setDecisionText] = useState(item.decision_text ?? '')
  const [decisionStatus, setDecisionStatus] = useState<MeetingDecisionStatus | ''>(
    item.decision_status ?? '',
  )
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    if (locked || busy) return
    setBusy(true)
    try {
      await onSave(item.id, {
        minutesSummary: minutes || null,
        decisionText: decisionText || null,
        decisionStatus: decisionStatus || null,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">
            {item.position + 1}. {item.title}
          </p>
          {item.description ? (
            <p className="mt-1 text-xs text-neutral-600">{item.description}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-neutral-500">
            {item.is_mandatory ? (
              <span className="inline-flex items-center gap-1 border border-cyan-700 px-1.5 py-0.5 font-semibold text-cyan-700">
                Obligatorisk
              </span>
            ) : null}
            {item.law_ref ? (
              <span className="inline-flex items-center gap-1">
                <Scale className="h-3 w-3" /> {item.law_ref}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-neutral-700">
          Sammendrag
          <textarea
            className="mt-1 w-full border border-neutral-300 bg-white px-2 py-1.5 text-sm"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            disabled={locked}
            rows={3}
          />
        </label>
        <div className="space-y-2">
          <label className="block text-xs text-neutral-700">
            Vedtak
            <textarea
              className="mt-1 w-full border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              value={decisionText}
              onChange={(e) => setDecisionText(e.target.value)}
              disabled={locked}
              rows={2}
            />
          </label>
          <label className="block text-xs text-neutral-700">
            Status
            <select
              className="mt-1 w-full border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              value={decisionStatus}
              onChange={(e) => setDecisionStatus(e.target.value as MeetingDecisionStatus | '')}
              disabled={locked}
            >
              <option value="">—</option>
              <option value="open">{MEETING_DECISION_STATUS_LABEL.open}</option>
              <option value="implemented">{MEETING_DECISION_STATUS_LABEL.implemented}</option>
              <option value="dropped">{MEETING_DECISION_STATUS_LABEL.dropped}</option>
            </select>
          </label>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={locked || busy}
          className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          <Edit3 className="h-3.5 w-3.5" /> Lagre
        </button>
      </div>
    </li>
  )
}

function AttendeesTab({ attendees }: { attendees: ReturnType<typeof useMeetings>['detail']['attendees'] }) {
  if (attendees.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Ingen deltakere registrert ennå. Bruk møtekortet eller agenda-arket for å markere oppmøte.
      </p>
    )
  }
  return (
    <table className="w-full border border-neutral-200 bg-white text-sm">
      <thead className="bg-neutral-50 text-[11px] uppercase tracking-[0.12em] text-neutral-500">
        <tr>
          <th className="px-3 py-2 text-left">Deltaker</th>
          <th className="px-3 py-2 text-left">Rolle</th>
          <th className="px-3 py-2 text-left">Til stede</th>
          <th className="px-3 py-2 text-left">Notat</th>
        </tr>
      </thead>
      <tbody>
        {attendees.map((a) => (
          <tr key={`${a.meeting_id}-${a.member_id}`} className="border-t border-neutral-100">
            <td className="px-3 py-2 font-mono text-xs">{a.member_id.slice(0, 8)}…</td>
            <td className="px-3 py-2">{a.role}</td>
            <td className="px-3 py-2">{a.present === null ? '—' : a.present ? 'Ja' : 'Nei'}</td>
            <td className="px-3 py-2 text-neutral-600">{a.notes ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DecisionsTab({
  decisions,
  actionItems,
  onAddAction,
  onSetActionStatus,
  locked,
  meetingId,
}: {
  decisions: ReturnType<typeof useMeetings>['detail']['decisions']
  actionItems: ReturnType<typeof useMeetings>['detail']['actionItems']
  onAddAction: ReturnType<typeof useMeetings>['addActionItem']
  onSetActionStatus: ReturnType<typeof useMeetings>['setActionItemStatus']
  locked: boolean
  meetingId: string
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
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-neutral-600">
          Vedtak
        </h2>
        {decisions.length === 0 ? (
          <p className="text-sm text-neutral-600">Ingen vedtak registrert.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 bg-white">
            {decisions.map((d) => (
              <li key={d.id} className="px-3 py-2 text-sm">
                <p className="font-semibold text-neutral-900">{d.decision_text}</p>
                <p className="text-[11px] text-neutral-500">
                  {fmtDate(d.decision_at)} · {MEETING_DECISION_STATUS_LABEL[d.status]}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-neutral-600">
          Oppfølgingsoppgaver
        </h2>
        {actionItems.length === 0 ? (
          <p className="text-sm text-neutral-600">Ingen oppgaver registrert.</p>
        ) : (
          <table className="w-full border border-neutral-200 bg-white text-sm">
            <thead className="bg-neutral-50 text-[11px] uppercase tracking-[0.12em] text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Oppgave</th>
                <th className="px-3 py-2 text-left">Frist</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {actionItems.map((a) => (
                <tr key={a.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{a.description}</td>
                  <td className="px-3 py-2">{a.due_date ?? '—'}</td>
                  <td className="px-3 py-2">
                    <select
                      className="border border-neutral-300 bg-white px-1.5 py-1 text-xs"
                      value={a.status}
                      onChange={(e) =>
                        void onSetActionStatus(a.id, e.target.value as MeetingActionStatus)
                      }
                      disabled={locked}
                    >
                      <option value="open">{MEETING_ACTION_STATUS_LABEL.open}</option>
                      <option value="in_progress">{MEETING_ACTION_STATUS_LABEL.in_progress}</option>
                      <option value="done">{MEETING_ACTION_STATUS_LABEL.done}</option>
                      <option value="dropped">{MEETING_ACTION_STATUS_LABEL.dropped}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {locked ? null : (
          <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex-1 text-xs text-neutral-700">
              Ny oppgave
              <input
                className="mt-1 w-full border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </label>
            <label className="text-xs text-neutral-700">
              Frist
              <input
                type="date"
                className="mt-1 border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={busy || !desc.trim()}
              className="inline-flex items-center gap-1.5 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Legg til
            </button>
          </form>
        )}
      </section>
    </div>
  )
}

function ProtocolTab({
  meetingId,
  signatures,
  locked,
  onSign,
  canManage,
}: {
  meetingId: string
  signatures: ReturnType<typeof useMeetings>['detail']['signatures']
  locked: boolean
  onSign: ReturnType<typeof useMeetings>['signProtocol']
  canManage: boolean
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
      <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong>Bekreftelse — ikke juridisk signatur.</strong> BankID-integrasjon
        kommer i en senere fase (jf. Council Review §3.4).
      </div>

      {signatures.length > 0 ? (
        <table className="w-full border border-neutral-200 bg-white text-sm">
          <thead className="bg-neutral-50 text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Navn</th>
              <th className="px-3 py-2 text-left">Rolle</th>
              <th className="px-3 py-2 text-left">Tidspunkt</th>
            </tr>
          </thead>
          <tbody>
            {signatures.map((s) => (
              <tr key={s.id} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-semibold">{s.signer_name}</td>
                <td className="px-3 py-2">{s.signer_role}</td>
                <td className="px-3 py-2 text-neutral-600">{fmtDate(s.signed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-neutral-600">Ingen bekreftelser registrert ennå.</p>
      )}

      {canManage && !locked ? (
        <form onSubmit={handleSign} className="flex flex-wrap items-end gap-2 border border-neutral-200 bg-white p-3">
          <label className="flex-1 text-xs text-neutral-700">
            Navn
            <input
              className="mt-1 w-full border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-xs text-neutral-700">
            Rolle
            <select
              className="mt-1 border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              <option value="chair">Møteleder</option>
              <option value="secretary">Sekretær</option>
              <option value="management">Ledelse</option>
              <option value="member">Medlem</option>
              <option value="other">Annet</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1.5 bg-cyan-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <PenSquare className="h-4 w-4" /> Bekreft protokollen
          </button>
        </form>
      ) : null}
    </div>
  )
}
