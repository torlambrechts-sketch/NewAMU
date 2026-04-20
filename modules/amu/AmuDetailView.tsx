import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { fetchAssignableUsers, type AssignableUser } from '../../src/hooks/useAssignableUsers'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { WarningBox, InfoBox } from '../../src/components/ui/AlertBox'
import { Badge, type BadgeVariant } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import type { AmuAgendaItem, AmuDecision, AmuMeeting, AmuParticipant, AmuParticipantRole } from './types'
import type { AmuHookState } from './useAmu'

const TAB_ITEMS: TabItem[] = [
  { id: 'planlegging', label: 'Planlegging' },
  { id: 'møterom', label: 'Møterom' },
  { id: 'referat_signatur', label: 'Referat & signatur' },
]

const ROLE_OPTIONS: { value: AmuParticipantRole; label: string }[] = [
  { value: 'employer_rep', label: 'Arbeidsgivers representant' },
  { value: 'employee_rep', label: 'Arbeidstakerrepresentant' },
  { value: 'safety_deputy', label: 'Verneombud' },
  { value: 'bht', label: 'BHT' },
  { value: 'secretary', label: 'Referent' },
]

const SOURCE_MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Ingen kilde' },
  { value: 'avvik', label: 'Avvik' },
  { value: 'sick_leave', label: 'Sykefravær' },
  { value: 'whistleblowing', label: 'Varsling' },
]

const MEETING_STATUS_OPTIONS: { value: AmuMeeting['status']; label: string }[] = [
  { value: 'scheduled', label: 'Planlagt' },
  { value: 'active', label: 'Aktivt' },
  { value: 'completed', label: 'Fullført' },
  { value: 'signed', label: 'Signert' },
]

function statusBadgeVariant(status: AmuMeeting['status']): BadgeVariant {
  if (status === 'scheduled') return 'info'
  if (status === 'active') return 'warning'
  if (status === 'signed') return 'success'
  return 'neutral'
}

function statusLabel(status: AmuMeeting['status']): string {
  if (status === 'scheduled') return 'Planlagt'
  if (status === 'active') return 'Aktivt'
  if (status === 'completed') return 'Fullført'
  if (status === 'signed') return 'Signert'
  return status
}

function isMeetingReadOnly(m: AmuMeeting) {
  return m.status === 'signed'
}

export function AmuDetailView({
  amu,
  meetingId,
  listPath,
}: {
  amu: AmuHookState
  meetingId: string
  listPath: string
}) {
  const navigate = useNavigate()
  const { supabase, profile } = useOrgSetupContext()
  const [meeting, setMeeting] = useState<AmuMeeting | null>(null)
  const [detailState, setDetailState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [agenda, setAgenda] = useState<AmuAgendaItem[]>([])
  const [decisionByAgenda, setDecisionByAgenda] = useState<Record<string, AmuDecision | null>>({})
  const [participants, setParticipants] = useState<AmuParticipant[]>([])
  const [assignable, setAssignable] = useState<AssignableUser[]>([])
  const [activeTab, setActiveTab] = useState('planlegging')
  const [loadTick, setLoadTick] = useState(0)
  const [saving, setSaving] = useState(false)
  const [wStats, setWStats] = useState<{ open: number; closed: number } | null>(null)
  const [sStats, setSStats] = useState<{ active: number; partial: number; other: number } | null>(null)

  const [titleDraft, setTitleDraft] = useState('')
  const [dateDraft, setDateDraft] = useState('')
  const [locationDraft, setLocationDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState<AmuMeeting['status']>('scheduled')

  const [agendaPanel, setAgendaPanel] = useState<
    { mode: 'new' } | { mode: 'edit'; item: AmuAgendaItem } | null
  >(null)
  const [agendaForm, setAgendaForm] = useState({
    title: '',
    description: '',
    order_index: 0,
    source_module: '' as string,
  })

  const [decisionPanel, setDecisionPanel] = useState<{
    item: AmuAgendaItem
    decision: AmuDecision | null
  } | null>(null)
  const [decisionText, setDecisionText] = useState('')
  const [apTitle, setApTitle] = useState('')
  const [apDescription, setApDescription] = useState('')
  const [apDue, setApDue] = useState('')
  const [apResponsible, setApResponsible] = useState('')

  const [addParticipantUserId, setAddParticipantUserId] = useState('')
  const [addParticipantRole, setAddParticipantRole] = useState<AmuParticipantRole>('employer_rep')

  const [minutesDraft, setMinutesDraft] = useState('')
  const [chairUserId, setChairUserId] = useState('')

  const agendaFormTitleId = useId()
  const decisionFormTitleId = useId()
  const readOnly = meeting ? isMeetingReadOnly(meeting) : true

  const refreshMeetingBundle = useCallback(async () => {
    const m = await amu.getMeeting(meetingId)
    if (m) {
      setDetailState('ready')
      setMeeting(m)
      setTitleDraft(m.title)
      setDateDraft(m.date)
      setLocationDraft(m.location)
      setStatusDraft(m.status)
      setMinutesDraft(m.minutes_draft ?? '')
      setChairUserId(m.meeting_chair_user_id ?? profile?.id ?? '')
    } else {
      setDetailState('missing')
      setMeeting(null)
    }
    const [items, decs, parts] = await Promise.all([
      amu.loadAgendaItems(meetingId),
      amu.loadDecisionsForMeeting(meetingId),
      amu.loadParticipants(meetingId),
    ])
    setAgenda(items)
    const dmap: Record<string, AmuDecision | null> = {}
    for (const d of decs) {
      dmap[d.agenda_item_id] = d
    }
    for (const it of items) {
      if (!(it.id in dmap)) dmap[it.id] = null
    }
    setDecisionByAgenda(dmap)
    setParticipants(parts)
  }, [amu, meetingId, profile?.id])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void refreshMeetingBundle()
    }, 0)
    return () => window.clearTimeout(t)
  }, [refreshMeetingBundle, loadTick])

  useEffect(() => {
    if (!supabase) return
    void (async () => {
      const u = await fetchAssignableUsers(supabase)
      setAssignable(u)
    })()
  }, [supabase])

  useEffect(() => {
    void (async () => {
      const w = await amu.fetchWhistleblowingAgendaStats()
      if (w) setWStats(w)
      const s = await amu.fetchSickLeaveAgendaStats()
      if (s) setSStats(s)
    })()
  }, [amu, meetingId])

  const userLabel = useCallback(
    (id: string) => assignable.find((u) => u.id === id)?.displayName ?? id,
    [assignable],
  )

  const participantOptions = useMemo(
    () => assignable.map((u) => ({ value: u.id, label: u.displayName })),
    [assignable],
  )

  const chairSelectOptions = useMemo(() => {
    const byId = new Map(participantOptions.map((o) => [o.value, o.label] as const))
    for (const p of participants) {
      if (!byId.has(p.user_id)) {
        byId.set(p.user_id, userLabel(p.user_id))
      }
    }
    if (meeting?.meeting_chair_user_id && !byId.has(meeting.meeting_chair_user_id)) {
      byId.set(meeting.meeting_chair_user_id, userLabel(meeting.meeting_chair_user_id))
    }
    return Array.from(byId.entries()).map(([value, label]) => ({ value, label }))
  }, [participantOptions, participants, meeting, userLabel])

  const onSaveMeta = useCallback(async () => {
    if (!meeting) return
    setSaving(true)
    const next = await amu.updateMeeting(meeting.id, {
      title: titleDraft,
      date: dateDraft,
      location: locationDraft,
      status: statusDraft,
    })
    if (next) {
      setMeeting(next)
    }
    setLoadTick((x) => x + 1)
    setSaving(false)
  }, [amu, meeting, titleDraft, dateDraft, locationDraft, statusDraft])

  const onSaveMinutes = useCallback(async () => {
    if (!meeting) return
    setSaving(true)
    const next = await amu.updateMeeting(meeting.id, { minutes_draft: minutesDraft || null })
    if (next) {
      setMeeting(next)
    }
    setLoadTick((x) => x + 1)
    setSaving(false)
  }, [amu, meeting, minutesDraft])

  const onGenerateDefaultAgenda = useCallback(async () => {
    const created = await amu.generateDefaultAgenda(meetingId)
    if (created) {
      setAgenda(created)
      setLoadTick((x) => x + 1)
    }
  }, [amu, meetingId])

  const openNewAgendaPanel = useCallback(() => {
    setAgendaForm({
      title: '',
      description: '',
      order_index: agenda.length,
      source_module: '',
    })
    setAgendaPanel({ mode: 'new' })
  }, [agenda.length])

  const openEditAgenda = useCallback((item: AmuAgendaItem) => {
    setAgendaForm({
      title: item.title,
      description: item.description,
      order_index: item.order_index,
      source_module: item.source_module ?? '',
    })
    setAgendaPanel({ mode: 'edit', item })
  }, [])

  const saveAgendaFromPanel = useCallback(async () => {
    if (!agendaPanel) return
    const sm = agendaForm.source_module.trim()
    if (agendaPanel.mode === 'new') {
      const row = await amu.insertAgendaItem(meetingId, {
        title: agendaForm.title.trim() || 'Uten tittel',
        description: agendaForm.description,
        order_index: agendaForm.order_index,
        source_module: sm ? sm : null,
        source_id: null,
      })
      if (row) {
        setAgenda((a) => [...a, row].sort((p, q) => p.order_index - q.order_index))
      }
    } else {
      const u = await amu.updateAgendaItem(agendaPanel.item.id, {
        title: agendaForm.title.trim() || 'Uten tittel',
        description: agendaForm.description,
        order_index: agendaForm.order_index,
        source_module: sm ? sm : null,
        source_id: agendaPanel.item.source_id,
      })
      if (u) {
        setAgenda((a) => a.map((x) => (x.id === u.id ? u : x)).sort((p, q) => p.order_index - q.order_index))
      }
    }
    setAgendaPanel(null)
    setLoadTick((x) => x + 1)
  }, [agendaForm, agendaPanel, amu, meetingId])

  const deleteAgenda = useCallback(
    async (id: string) => {
      const ok = await amu.deleteAgendaItem(id)
      if (ok) {
        setAgenda((a) => a.filter((x) => x.id !== id))
        setLoadTick((x) => x + 1)
      }
    },
    [amu],
  )

  const fixOpenDecision = useCallback((item: AmuAgendaItem) => {
    const d = decisionByAgenda[item.id] ?? null
    setDecisionText(d?.decision_text ?? '')
    setApTitle(`Tiltak: ${item.title}`.slice(0, 200))
    setApDescription(d?.decision_text || item.description)
    setApDue(new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10))
    setApResponsible('')
    setDecisionPanel({ item, decision: d })
  }, [decisionByAgenda])

  const saveDecisionOnly = useCallback(async () => {
    if (!decisionPanel) return
    setSaving(true)
    const { item, decision: d0 } = decisionPanel
    let next: AmuDecision | null = null
    if (d0) {
      next = await amu.upsertDecision({ id: d0.id, patch: { decision_text: decisionText } })
    } else {
      next = await amu.upsertDecision({ agenda_item_id: item.id, decision_text: decisionText })
    }
    if (next) {
      setDecisionByAgenda((m) => ({ ...m, [item.id]: next }))
    }
    setSaving(false)
    setLoadTick((x) => x + 1)
  }, [amu, decisionPanel, decisionText])

  const createTiltakAndLink = useCallback(async () => {
    if (!decisionPanel) return
    if (!apDue) {
      amu.setError('Fyll inn frist (dato) for tiltaket.')
      return
    }
    const dueIso = new Date(`${apDue}T12:00:00`).toISOString()
    setSaving(true)
    const apId = await amu.createActionPlanItemFromAgenda(decisionPanel.item.id, {
      title: apTitle.trim() || `Tiltak: ${decisionPanel.item.title}`,
      description: apDescription,
      dueAtIso: dueIso,
      responsibleUserId: apResponsible || null,
    })
    if (!apId) {
      setSaving(false)
      return
    }
    const d0 = decisionPanel.decision
    if (d0) {
      await amu.upsertDecision({
        id: d0.id,
        patch: { decision_text: decisionText, action_plan_item_id: apId },
      })
    } else {
      await amu.upsertDecision({
        agenda_item_id: decisionPanel.item.id,
        decision_text: decisionText,
        action_plan_item_id: apId,
      })
    }
    const fresh = await amu.loadDecisionsForMeeting(meetingId)
    const m: Record<string, AmuDecision | null> = { ...decisionByAgenda }
    for (const d of fresh) m[d.agenda_item_id] = d
    setDecisionByAgenda(m)
    setSaving(false)
    setDecisionPanel(null)
    setLoadTick((x) => x + 1)
  }, [amu, apDescription, apDue, apTitle, apResponsible, decisionByAgenda, decisionPanel, decisionText, meetingId])

  const onSignMeeting = useCallback(async () => {
    if (!meeting) return
    if (!chairUserId) {
      amu.setError('Velg møteleder for signering.')
      return
    }
    setSaving(true)
    await amu.updateMeeting(meeting.id, { meeting_chair_user_id: chairUserId || null })
    const signed = await amu.signMeetingAsChair(meeting.id, chairUserId)
    if (signed) {
      setMeeting(signed)
    }
    setLoadTick((x) => x + 1)
    setSaving(false)
  }, [amu, chairUserId, meeting])

  if (detailState === 'loading') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">Laster møte…</p>
        <Button type="button" variant="secondary" onClick={() => navigate(listPath)}>
          Tilbake til listen
        </Button>
      </div>
    )
  }

  if (detailState === 'missing' || !meeting) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">Fant ikke møtet.</p>
        <Button type="button" variant="secondary" onClick={() => navigate(listPath)}>
          Tilbake til listen
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-6">
      <ComplianceBanner title="Arbeidsmiljøloven Kap. 7 — Arbeidsmiljøutvalg (AMU)" className="border-b border-[#1a3d32]/20">
        Møter, saksbehandling og referat følger arbeidsmiljøloven. Persondata i andre moduler (f.eks. varsling) vises kun i aggregert form.
      </ComplianceBanner>
      {amu.error ? <WarningBox>{amu.error}</WarningBox> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1">
            <Link to={listPath} className="text-xs text-neutral-500 hover:text-neutral-800">
              ← AMU-møter
            </Link>
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 md:text-xl">{meeting.title}</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {new Date(`${meeting.date}T12:00:00`).toLocaleDateString('nb-NO', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            {meeting.location ? `· ${meeting.location}` : ''}
          </p>
        </div>
        <Badge variant={statusBadgeVariant(meeting.status)}>{statusLabel(meeting.status)}</Badge>
      </div>

      <Tabs items={TAB_ITEMS} activeId={activeTab} onChange={setActiveTab} className="border-b border-neutral-200 pb-1" />

      {activeTab === 'planlegging' && (
        <div className="flex flex-col space-y-6">
          {wStats && sStats && (
            <InfoBox>
              {`Varsling: ${wStats.open} åpne, ${wStats.closed} lukkede. Sykefravær (HSE-modul, aggregert): ${sStats.active} aktive, ${sStats.partial} delvise, ${sStats.other} øvrige. `}
            </InfoBox>
          )}

          <div className={`${WORKPLACE_MODULE_CARD} p-5 md:p-6`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <h3 className="text-sm font-semibold text-neutral-900">Møtedata</h3>
            <div className="mt-4 space-y-4">
              <div className={WPSTD_FORM_ROW_GRID}>
                <div>
                  <div className={WPSTD_FORM_FIELD_LABEL}>Overskrift / navn</div>
                  <p className="text-sm text-neutral-600">Beskriv møtet. Lagres med knappen nedenfor.</p>
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-m-title">
                    Tittel
                  </label>
                  <StandardInput
                    id="amu-m-title"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    disabled={readOnly || !amu.canManage}
                  />
                </div>
              </div>
              <div className={WPSTD_FORM_ROW_GRID}>
                <div>
                  <div className={WPSTD_FORM_FIELD_LABEL}>Dato og sted</div>
                  <p className="text-sm text-neutral-600">Planlagt møtedato og lokasjon (eller Teams).</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-m-date">
                      Dato
                    </label>
                    <StandardInput
                      id="amu-m-date"
                      type="date"
                      value={dateDraft}
                      onChange={(e) => setDateDraft(e.target.value)}
                      disabled={readOnly || !amu.canManage}
                    />
                  </div>
                  <div>
                    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-m-loc">
                      Sted
                    </label>
                    <StandardInput
                      id="amu-m-loc"
                      value={locationDraft}
                      onChange={(e) => setLocationDraft(e.target.value)}
                      disabled={readOnly || !amu.canManage}
                    />
                  </div>
                </div>
              </div>
              <div className={WPSTD_FORM_ROW_GRID}>
                <div>
                  <div className={WPSTD_FORM_FIELD_LABEL}>Status</div>
                  <p className="text-sm text-neutral-600">Aktivt møte brukes når saksbehandling pågår i møterom-fanen.</p>
                </div>
                <div>
                  <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-m-status">
                    Møtestatus
                  </label>
                  <SearchableSelect
                    value={statusDraft}
                    options={MEETING_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(v) => setStatusDraft(v as AmuMeeting['status'])}
                    disabled={readOnly || !amu.canManage || meeting.status === 'signed'}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="primary"
                disabled={readOnly || !amu.canManage || saving}
                onClick={() => void onSaveMeta()}
              >
                Lagre møtedata
              </Button>
            </div>
          </div>

          <div className={`${WORKPLACE_MODULE_CARD} p-5 md:p-6`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <h3 className="text-sm font-semibold text-neutral-900">Deltakere</h3>
            <p className="mt-1 text-sm text-neutral-600">Legg til brukere fra virksomheten med roller i møtet.</p>
            {participants.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Bruker</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Rolle</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Til stede</th>
                      <th className={LAYOUT_TABLE1_POSTINGS_TH} />
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p) => (
                      <tr key={p.user_id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                        <td className="px-5 py-3 font-medium text-neutral-900">{userLabel(p.user_id)}</td>
                        <td className="px-5 py-3">
                          <SearchableSelect
                            value={p.role}
                            options={ROLE_OPTIONS}
                            onChange={async (v) => {
                              const next = await amu.upsertParticipant(meeting.id, p.user_id, { role: v as AmuParticipantRole })
                              if (next) {
                                setParticipants((rows) => rows.map((r) => (r.user_id === p.user_id ? next : r)))
                              }
                            }}
                            disabled={readOnly || !amu.canManage}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <YesNoToggle
                            value={p.present}
                            onChange={async (v) => {
                              const next = await amu.upsertParticipant(meeting.id, p.user_id, { present: v })
                              if (next) {
                                setParticipants((rows) => rows.map((r) => (r.user_id === p.user_id ? next : r)))
                              }
                            }}
                          />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={readOnly || !amu.canManage}
                            icon={<Trash2 className="h-4 w-4" />}
                            aria-label="Fjern"
                            onClick={async () => {
                              const ok = await amu.removeParticipant(meeting.id, p.user_id)
                              if (ok) setParticipants((r) => r.filter((x) => x.user_id !== p.user_id))
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="mt-6 max-w-2xl space-y-3">
              <label className={WPSTD_FORM_FIELD_LABEL}>Legg til deltaker</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <SearchableSelect
                    value={addParticipantUserId}
                    options={[{ value: '', label: 'Velg bruker' }, ...participantOptions]}
                    onChange={setAddParticipantUserId}
                    disabled={readOnly || !amu.canManage}
                  />
                </div>
                <div className="min-w-0 sm:w-56">
                  <SearchableSelect
                    value={addParticipantRole}
                    options={ROLE_OPTIONS}
                    onChange={(v) => setAddParticipantRole(v as AmuParticipantRole)}
                    disabled={readOnly || !amu.canManage}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={readOnly || !amu.canManage || !addParticipantUserId}
                  onClick={async () => {
                    if (!addParticipantUserId) return
                    const next = await amu.upsertParticipant(meeting.id, addParticipantUserId, {
                      role: addParticipantRole,
                      present: true,
                    })
                    if (next) {
                      setParticipants((r) => [...r.filter((x) => x.user_id !== addParticipantUserId), next])
                      setAddParticipantUserId('')
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Legg til
                </Button>
              </div>
            </div>
          </div>

          <div className={`${WORKPLACE_MODULE_CARD} p-0 overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <LayoutTable1PostingsShell
              wrap={false}
              title="Saksliste (agenda)"
              description="Standard saksliste kan genereres. Rediger i sidepanel for å følge selskapsmønsteret."
              headerActions={
                <div className="flex flex-wrap gap-2">
                  {agenda.length > 0 ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={openNewAgendaPanel}
                      disabled={readOnly || !amu.canManage}
                    >
                      <Plus className="h-4 w-4" />
                      Nytt punkt
                    </Button>
                  ) : null}
                </div>
              }
              toolbar={<span className="sr-only">Saksliste</span>}
            >
              {agenda.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                  <ListOrdered className="h-10 w-10 text-neutral-300" />
                  <div>
                    <p className="text-sm font-medium text-neutral-800">Ingen saker ennå</p>
                    <p className="mt-1 max-w-md text-sm text-neutral-600">
                      Generer forslag til saksliste for å komme raskt i gang med møtet, eller opprett punkter for hånd.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={readOnly || !amu.canManage}
                    onClick={() => void onGenerateDefaultAgenda()}
                  >
                    Generer standard saksliste
                  </Button>
                </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr>
                      <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">#</th>
                      <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sak</th>
                      <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Kilde</th>
                      <th className="bg-neutral-50 px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-neutral-500" />
                    </tr>
                  </thead>
                  <tbody>
                    {agenda.map((a) => (
                      <tr key={a.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                        <td className="px-5 py-3 text-neutral-600">{a.order_index + 1}</td>
                        <td className="px-5 py-3 text-neutral-900">
                          <div className="font-medium">{a.title}</div>
                          {a.description ? <div className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{a.description}</div> : null}
                        </td>
                        <td className="px-5 py-3 text-neutral-600">
                          {a.source_module
                            ? SOURCE_MODULE_OPTIONS.find((o) => o.value === a.source_module)?.label ?? a.source_module
                            : '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditAgenda(a)}
                              disabled={readOnly || !amu.canManage}
                              icon={<Pencil className="h-4 w-4" />}
                              aria-label="Rediger"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => void deleteAgenda(a.id)}
                              disabled={readOnly || !amu.canManage}
                              icon={<Trash2 className="h-4 w-4" />}
                              aria-label="Slett"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </LayoutTable1PostingsShell>
          </div>
        </div>
      )}

      {activeTab === 'møterom' && (
        <div className={`${WORKPLACE_MODULE_CARD} p-0 overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
          <LayoutTable1PostingsShell
            wrap={false}
            title="Aktivt møte — saksrunde"
            description="Gå gjennom saksene og registrer korte vedtak. Klikk for å skrive i sidepanel (ingen innebygde skjema i tabellen)."
            headerActions={
              meeting.status !== 'active' ? (
                <Badge variant="info">Bruk møtestatus «Aktivt» for live modus (Planlegging-fanen)</Badge>
              ) : null
            }
            toolbar={<span className="sr-only">Møterom</span>}
          >
            {agenda.length === 0 ? (
              <p className="px-5 py-10 text-sm text-neutral-600">Ingen saker i sakslisten. Gå til Planlegging for å opprette agenda.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-20">#</th>
                    <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sak</th>
                    <th className="bg-neutral-50 px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-32">Vedtak</th>
                  </tr>
                </thead>
                <tbody>
                  {agenda.map((a) => {
                    const has = decisionByAgenda[a.id]
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-neutral-100 transition-colors hover:bg-neutral-50 cursor-pointer"
                        onClick={() => fixOpenDecision(a)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            fixOpenDecision(a)
                          }
                        }}
                      >
                        <td className="px-5 py-3 text-neutral-500">{a.order_index + 1}</td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-neutral-900">{a.title}</div>
                          {a.description ? <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{a.description}</div> : null}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {has?.decision_text ? (
                            <Badge variant="success">Oppført</Badge>
                          ) : (
                            <Badge variant="neutral">Ikke ført</Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </LayoutTable1PostingsShell>
        </div>
      )}

      {activeTab === 'referat_signatur' && (
        <div className="flex flex-col space-y-4">
          <div className={`${WORKPLACE_MODULE_CARD} p-5 md:p-6`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <h3 className="text-sm font-semibold text-neutral-900">Utkast til referat</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Referat bør samsvare med saksbehandlingen. Lagres separat; signert møte kan ikke omskrives.
            </p>
            <div className="mt-4">
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-minutes">
                Tekst
              </label>
              <StandardTextarea
                id="amu-minutes"
                className="min-h-[200px] mt-1.5 w-full"
                value={minutesDraft}
                onChange={(e) => setMinutesDraft(e.target.value)}
                readOnly={readOnly || !amu.canManage}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="secondary" disabled={readOnly || !amu.canManage} onClick={() => void onSaveMinutes()}>
                Lagre referat
              </Button>
            </div>
          </div>
          <div className={`${WORKPLACE_MODULE_CARD} p-5 md:p-6`} style={WORKPLACE_MODULE_CARD_SHADOW}>
            <h3 className="text-sm font-semibold text-neutral-900">Signering av referat (møteleder)</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Signering låser møtet. Velg møteleder og klikk for å ferdigstille status og signaturtid.
            </p>
            {meeting.chair_signed_at ? (
              <p className="mt-2 text-sm text-emerald-800">Signert {new Date(meeting.chair_signed_at).toLocaleString('nb-NO')}</p>
            ) : null}
            <div className="mt-4 max-w-md">
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-chair">
                Møteleder
              </label>
              <SearchableSelect
                value={chairUserId}
                options={[{ value: '', label: 'Velg' }, ...chairSelectOptions]}
                onChange={setChairUserId}
                disabled={readOnly || !amu.canManage}
              />
            </div>
            <div className="mt-4">
              <Button
                type="button"
                variant="primary"
                disabled={readOnly || !amu.canManage || !chairUserId || meeting.status === 'signed'}
                onClick={() => void onSignMeeting()}
              >
                Signer og lukk møtet
              </Button>
            </div>
          </div>
        </div>
      )}

      <SlidePanel
        open={agendaPanel !== null}
        onClose={() => setAgendaPanel(null)}
        titleId={agendaFormTitleId}
        title={agendaPanel?.mode === 'new' ? 'Ny saks' : 'Rediger sak'}
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAgendaPanel(null)}>Avbryt</Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void saveAgendaFromPanel()}
              disabled={!amu.canManage}
            >Lagre</Button>
          </div>
        }
      >
        <div className="space-y-0">
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <div className={WPSTD_FORM_FIELD_LABEL}>Sakstittel</div>
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-agg-title">Tittel</label>
              <StandardInput id="amu-agg-title" value={agendaForm.title} onChange={(e) => setAgendaForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <div className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</div>
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-agg-body">Beskrivelse</label>
              <StandardTextarea id="amu-agg-body" className="min-h-[100px] mt-1.5 w-full" value={agendaForm.description} onChange={(e) => setAgendaForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <div className={WPSTD_FORM_FIELD_LABEL}>Saksordner</div>
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-agg-ord">Rekkefølge (0 = først)</label>
              <StandardInput
                id="amu-agg-ord"
                type="number"
                value={agendaForm.order_index}
                onChange={(e) => setAgendaForm((f) => ({ ...f, order_index: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <div className={WPSTD_FORM_FIELD_LABEL}>Kildepunkt (polymorf lenke)</div>
            </div>
            <div>
              <SearchableSelect
                value={agendaForm.source_module}
                options={SOURCE_MODULE_OPTIONS}
                onChange={(v) => setAgendaForm((f) => ({ ...f, source_module: v }))}
              />
            </div>
          </div>
        </div>
      </SlidePanel>

      <SlidePanel
        open={decisionPanel !== null}
        onClose={() => setDecisionPanel(null)}
        titleId={decisionFormTitleId}
        title={decisionPanel ? decisionPanel.item.title : 'Sak'}
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="secondary" onClick={() => setDecisionPanel(null)}>Lukk</Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" disabled={saving} onClick={() => void saveDecisionOnly()}>
                Lagre vedtak
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={saving}
                onClick={() => void createTiltakAndLink()}
              >
                Opprett tiltak i Handlingsplan
              </Button>
            </div>
          </div>
        }
      >
        {decisionPanel ? (
          <div className="space-y-0">
            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <div className={WPSTD_FORM_FIELD_LABEL}>Kortvedtak</div>
                <p className="text-sm text-neutral-600">Formuler vedtak som AMU forstår. Detaljer følger ofte i tiltaket.</p>
              </div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-d-text">Vedtakstekst</label>
                <StandardTextarea id="amu-d-text" className="min-h-[140px] w-full" value={decisionText} onChange={(e) => setDecisionText(e.target.value)} readOnly={readOnly || !amu.canManage} />
              </div>
            </div>
            <div className="border-b border-dashed border-neutral-200" />
            <h3 className="px-4 py-2 text-sm font-semibold text-neutral-900 sm:px-5">Tiltak (valgfri)</h3>
            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <div className={WPSTD_FORM_FIELD_LABEL}>Tittel for tiltak</div>
              </div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-d-ap-title">Oppgave</label>
                <StandardInput id="amu-d-ap-title" value={apTitle} onChange={(e) => setApTitle(e.target.value)} disabled={readOnly || !amu.canManage} />
              </div>
            </div>
            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <div className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</div>
              </div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-d-ap-d">Beskrivelse</label>
                <StandardTextarea id="amu-d-ap-d" className="min-h-[100px] w-full" value={apDescription} onChange={(e) => setApDescription(e.target.value)} />
              </div>
            </div>
            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <div className={WPSTD_FORM_FIELD_LABEL}>Frist</div>
              </div>
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-d-ap-f">Dato frist</label>
                <StandardInput id="amu-d-ap-f" type="date" value={apDue} onChange={(e) => setApDue(e.target.value)} />
              </div>
            </div>
            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <div className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig</div>
              </div>
              <div>
                <SearchableSelect
                  value={apResponsible}
                  options={[{ value: '', label: 'Ikke tildelt' }, ...participantOptions]}
                  onChange={setApResponsible}
                />
              </div>
            </div>
          </div>
        ) : null}
      </SlidePanel>
    </div>
  )
}
