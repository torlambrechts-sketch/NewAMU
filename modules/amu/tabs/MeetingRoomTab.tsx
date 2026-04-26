import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import {
  ModulePreflightChecklist,
  ModuleSectionCard,
  ModuleSignatureCard,
} from '../../../src/components/module'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { InfoBox } from '../../../src/components/ui/AlertBox'
import { YesNoToggle } from '../../../src/components/ui/FormToggles'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import type { AmuAgendaItem, AmuDecision } from '../types'
import type { AmuHook } from './types'

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function MeetingRoomTab({ amu }: { amu: AmuHook }) {
  const activeMeeting = useMemo(
    () => amu.meetings.find((m) => m.status === 'in_progress') ?? amu.meetings.find((m) => m.status === 'scheduled'),
    [amu.meetings],
  )

  const [elapsed, setElapsed] = useState(0)
  const [showSignOff, setShowSignOff] = useState(false)
  const [leaderSignerId, setLeaderSignerId] = useState<string | null>(null)
  const [deputySignerId, setDeputySignerId] = useState<string | null>(null)

  const meetingAgendaItems = useMemo(() => {
    if (!activeMeeting) return []
    return amu.agendaItems.filter((a) => a.meeting_id === activeMeeting.id).sort((a, b) => a.position - b.position)
  }, [amu.agendaItems, activeMeeting])

  useEffect(() => {
    if (!activeMeeting?.id) return
    void amu.loadMeetingDetail(activeMeeting.id)
  }, [activeMeeting?.id, amu.loadMeetingDetail])

  useEffect(() => {
    if (!activeMeeting || activeMeeting.status !== 'in_progress') return
    const start = Date.now()
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => window.clearInterval(t)
  }, [activeMeeting])

  useEffect(() => {
    if (!activeMeeting || activeMeeting.status !== 'in_progress') return
    if (meetingAgendaItems.length === 0) return
    const hasActive = meetingAgendaItems.some((i) => i.status === 'active')
    const firstPending = meetingAgendaItems.find((i) => i.status === 'pending')
    if (!hasActive && firstPending) void amu.updateAgendaItemStatus(firstPending.id, 'active')
  }, [activeMeeting, meetingAgendaItems, amu.updateAgendaItemStatus])

  const leader = amu.members.find((m) => m.role === 'leader')
  const deputy = amu.members.find((m) => m.role === 'deputy_leader')

  const allItemsDone = meetingAgendaItems.every((i) => i.status === 'decided' || i.status === 'deferred')
  const allDecisionsHaveResponsible = meetingAgendaItems.every((item) => {
    if (item.status !== 'decided') return true
    const d = amu.decisions.find((x) => x.agenda_item_id === item.id)
    return Boolean(d?.responsible_member_id && d?.due_date)
  })
  const attendanceComplete =
    amu.members.length > 0 &&
    amu.members.every((m) => {
      const a = amu.attendance.find((x) => x.meeting_id === activeMeeting?.id && x.member_id === m.id)
      return Boolean(a)
    })

  const handleConfirmAndAdvance = useCallback(
    async (item: AmuAgendaItem, payload: Partial<AmuDecision>) => {
      if (!activeMeeting) return
      const existing = amu.decisions.find((d) => d.agenda_item_id === item.id)
      await amu.recordDecision({
        id: existing?.id,
        agenda_item_id: item.id,
        decision_text: payload.decision_text ?? existing?.decision_text ?? '',
        votes_for: payload.votes_for ?? existing?.votes_for ?? 0,
        votes_against: payload.votes_against ?? existing?.votes_against ?? 0,
        votes_abstained: payload.votes_abstained ?? existing?.votes_abstained ?? 0,
        responsible_member_id: payload.responsible_member_id ?? existing?.responsible_member_id ?? null,
        due_date: payload.due_date ?? existing?.due_date ?? null,
        linked_action_id: payload.linked_action_id ?? existing?.linked_action_id ?? null,
      })
      await amu.updateAgendaItemStatus(item.id, 'decided')
      const next = meetingAgendaItems.find((i) => i.position > item.position && i.status === 'pending')
      if (next) await amu.updateAgendaItemStatus(next.id, 'active')
      await amu.refresh()
      await amu.loadMeetingDetail(activeMeeting.id)
    },
    [activeMeeting, amu, meetingAgendaItems],
  )

  if (!activeMeeting) {
    return <InfoBox>Ingen aktiv møteøkt. Åpne et planlagt møte fra Møteplan-fanen.</InfoBox>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-neutral-900">{activeMeeting.title}</h2>
          <p className="text-xs text-neutral-500">{formatDateTime(activeMeeting.scheduled_at)}</p>
        </div>
        <Badge variant="success">
          {activeMeeting.status === 'in_progress' ? `Pågår nå · ${formatElapsed(elapsed)}` : 'Planlagt'}
        </Badge>
        {amu.canManage && activeMeeting.status === 'scheduled' ? (
          <Button variant="secondary" type="button" onClick={() => void amu.startMeeting(activeMeeting.id)}>
            Start møte
          </Button>
        ) : null}
        {amu.canChair && activeMeeting.status === 'in_progress' ? (
          <Button variant="primary" type="button" onClick={() => setShowSignOff(true)}>
            Avslutt og signer referat
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {meetingAgendaItems.map((item) => (
            <AgendaItemCard
              key={item.id}
              item={item}
              decision={amu.decisions.find((d) => d.agenda_item_id === item.id)}
              members={amu.members}
              canManage={amu.canManage}
              onDecisionSave={(payload) => void handleConfirmAndAdvance(item, payload)}
            />
          ))}
        </div>

        <div className="space-y-4">
          <ModuleSectionCard className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-neutral-900">Deltakere</h3>
            {amu.members.map((m) => {
              const att = amu.attendance.find((a) => a.meeting_id === activeMeeting.id && a.member_id === m.id)
              return (
                <div key={m.id} className="flex items-center gap-2 border-b border-neutral-100 py-2 last:border-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold">
                    {m.display_name
                      .split(/\s+/)
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{m.display_name}</p>
                    <p className="text-xs text-neutral-400">{m.function_label ?? m.role}</p>
                    {!m.voting ? <p className="text-xs text-neutral-400">(uten stemmerett)</p> : null}
                  </div>
                  {amu.canManage ? (
                    <YesNoToggle
                      value={att?.status === 'present' || att?.status === 'digital' || att?.status === 'excused'}
                      onChange={(v) =>
                        void amu.updateAttendance(activeMeeting.id, m.id, v ? 'present' : 'absent')
                      }
                    />
                  ) : (
                    <Badge variant="neutral">{att?.status === 'present' ? 'Til stede' : att?.status ?? '—'}</Badge>
                  )}
                </div>
              )
            })}
          </ModuleSectionCard>

          <ModuleSectionCard className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Møtetid</h3>
            <div className="py-4 text-center font-mono text-4xl font-bold text-[#1a3d32]">
              {activeMeeting.status === 'in_progress' ? formatElapsed(elapsed) : '—'}
            </div>
            <p className="text-center text-xs text-neutral-500">
              {meetingAgendaItems.filter((i) => i.status === 'decided').length} av {meetingAgendaItems.length} saker
              behandlet
            </p>
          </ModuleSectionCard>
        </div>
      </div>

      {showSignOff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <ModuleSectionCard className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-neutral-900">Signer referat</h3>
            <div className="mt-4">
              <ModulePreflightChecklist
                items={[
                  { label: 'Alle saker behandlet eller utsatt', ok: allItemsDone },
                  { label: 'Alle vedtak har ansvarlig og frist', ok: allDecisionsHaveResponsible },
                  { label: 'Deltakelse registrert', ok: attendanceComplete },
                ]}
              />
            </div>
            <div className="mt-6 space-y-4">
              <ModuleSignatureCard
                title="Leder (AMU)"
                contextLine={leader?.display_name ?? '—'}
                lawReference="AML § 7-2"
                buttonLabel="Bekreft leder som signatar"
                onSign={() => setLeaderSignerId(leader?.id ?? null)}
              />
              <ModuleSignatureCard
                title="Nestleder (AMU)"
                contextLine={deputy?.display_name ?? '—'}
                lawReference="AML § 7-2"
                variant="secondary"
                buttonLabel="Bekreft nestleder som signatar"
                onSign={() => setDeputySignerId(deputy?.id ?? null)}
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="secondary" type="button" onClick={() => setShowSignOff(false)}>
                Avbryt
              </Button>
              <Button
                variant="primary"
                type="button"
                disabled={!leaderSignerId || !deputySignerId}
                onClick={() =>
                  void amu
                    .signMeeting(activeMeeting.id, leaderSignerId!, deputySignerId!)
                    .then(() => {
                      setShowSignOff(false)
                      setLeaderSignerId(null)
                      setDeputySignerId(null)
                    })
                }
              >
                Signer referat
              </Button>
            </div>
          </ModuleSectionCard>
        </div>
      ) : null}
    </div>
  )
}

function AgendaItemCard({
  item,
  decision,
  members,
  canManage,
  onDecisionSave,
}: {
  item: AmuAgendaItem
  decision?: AmuDecision
  members: AmuHook['members']
  canManage: boolean
  onDecisionSave: (p: Partial<AmuDecision>) => void
}) {
  const [notes, setNotes] = useState(item.notes ?? '')
  const [decisionText, setDecisionText] = useState(decision?.decision_text ?? '')
  const [votesFor, setVotesFor] = useState(String(decision?.votes_for ?? 0))
  const [votesAgainst, setVotesAgainst] = useState(String(decision?.votes_against ?? 0))
  const [votesAbstained, setVotesAbstained] = useState(String(decision?.votes_abstained ?? 0))
  const [responsibleId, setResponsibleId] = useState(decision?.responsible_member_id ?? '')
  const [dueDate, setDueDate] = useState(decision?.due_date?.slice(0, 10) ?? '')

  if (item.status === 'decided') {
    return (
      <div className="flex items-center gap-3 rounded border bg-neutral-50/80 p-3 opacity-90">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs">
          {item.position}
        </span>
        <span className="flex-1 text-sm text-neutral-500 line-through">{item.title}</span>
        <Badge variant="success">Vedtatt</Badge>
        {decision ? <span className="max-w-[200px] truncate text-xs text-neutral-400">{decision.decision_text}</span> : null}
      </div>
    )
  }

  if (item.status === 'pending') {
    return (
      <div className="flex items-center gap-3 rounded border border-neutral-200 p-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs">
          {item.position}
        </span>
        <span className="flex-1 text-sm text-neutral-600">{item.title}</span>
        <Badge variant="neutral">Venter</Badge>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border-2 border-[#1a3d32] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a3d32] text-xs font-bold text-white">
          {item.position}
        </span>
        <h3 className="font-semibold text-neutral-900">{item.title}</h3>
        {item.legal_ref ? <Badge variant="neutral">{item.legal_ref}</Badge> : null}
        <Badge variant="info">{item.source_type}</Badge>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-neutral-600">Notater fra møtet</p>
        <StandardTextarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canManage} />
      </div>
      <div className="space-y-3 rounded-lg bg-[#f0f7f4] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1a3d32]">Vedtak</p>
        <div>
          <p className="mb-1 text-xs font-semibold text-neutral-600">Vedtakstekst</p>
          <StandardTextarea
            rows={2}
            value={decisionText}
            onChange={(e) => setDecisionText(e.target.value)}
            disabled={!canManage}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StandardInput type="number" min={0} value={votesFor} onChange={(e) => setVotesFor(e.target.value)} />
          <StandardInput type="number" min={0} value={votesAgainst} onChange={(e) => setVotesAgainst(e.target.value)} />
          <StandardInput type="number" min={0} value={votesAbstained} onChange={(e) => setVotesAbstained(e.target.value)} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-neutral-600">Ansvarlig</p>
          <SearchableSelect
            value={responsibleId}
            options={[{ value: '', label: '— Velg —' }, ...members.map((m) => ({ value: m.id, label: m.display_name }))]}
            onChange={setResponsibleId}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-neutral-600">Frist</p>
          <StandardInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      {canManage ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="primary"
            type="button"
            onClick={() =>
              onDecisionSave({
                decision_text: decisionText,
                votes_for: Number.parseInt(votesFor, 10) || 0,
                votes_against: Number.parseInt(votesAgainst, 10) || 0,
                votes_abstained: Number.parseInt(votesAbstained, 10) || 0,
                responsible_member_id: responsibleId.trim() ? responsibleId : null,
                due_date: dueDate || null,
              })
            }
          >
            Bekreft vedtak og gå videre
          </Button>
        </div>
      ) : null}
    </div>
  )
}
