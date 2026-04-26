import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileText,
  Info,
  PenLine,
} from 'lucide-react'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import { ModuleInformationCard } from '../../src/components/module/ModuleInformationCard'
import { ModuleSignatureCard } from '../../src/components/module/ModuleSignatureCard'
import { ModulePreflightChecklist } from '../../src/components/module/ModulePreflightChecklist'
import { fetchAssignableUsers, type AssignableUser } from '../../src/hooks/useAssignableUsers'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import { WarningBox, InfoBox } from '../../src/components/ui/AlertBox'
import { Badge, type BadgeVariant } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { AmuAgendaPlanningTable } from './AmuAgendaPlanningTable'
import { AmuMeetingRoomTab } from './AmuMeetingRoomTab'
import { AmuParticipantsTable } from './AmuParticipantsTable'
import type { AmuAgendaItem, AmuDecision, AmuMeeting, AmuParticipant } from './types'
import type { AmuHookState } from './useAmu'

type AmuTab = 'information' | 'planlegging' | 'meeting_room' | 'minutes' | 'signature'

const TAB_ITEMS: TabItem[] = [
  { id: 'information', label: 'Informasjon', icon: Info },
  { id: 'planlegging', label: 'Planlegging', icon: CalendarCheck },
  { id: 'meeting_room', label: 'Møterom', icon: ClipboardList },
  { id: 'minutes', label: 'Referat', icon: FileText },
  { id: 'signature', label: 'Signering', icon: PenLine },
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
  const [participantBalanceOk, setParticipantBalanceOk] = useState(false)
  const [assignable, setAssignable] = useState<AssignableUser[]>([])
  const [activeTab, setActiveTab] = useState<AmuTab>('information')
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
    source_id_raw: '' as string,
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
      try {
        const u = await fetchAssignableUsers(supabase)
        setAssignable(u)
      } catch (err) {
        amu.setError(getSupabaseErrorMessage(err))
      }
    })()
  }, [supabase, amu])

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

  const sourceLabelForAgenda = useCallback((item: AmuAgendaItem) => {
    return item.source_module
      ? SOURCE_MODULE_OPTIONS.find((o) => o.value === item.source_module)?.label ?? item.source_module
      : '—'
  }, [])

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
      source_id_raw: '',
    })
    setAgendaPanel({ mode: 'new' })
  }, [agenda.length])

  const openEditAgenda = useCallback((item: AmuAgendaItem) => {
    setAgendaForm({
      title: item.title,
      description: item.description,
      order_index: item.order_index,
      source_module: item.source_module ?? '',
      source_id_raw: item.source_id ?? '',
    })
    setAgendaPanel({ mode: 'edit', item })
  }, [])

  const saveAgendaFromPanel = useCallback(async () => {
    if (!agendaPanel) return
    const sm = agendaForm.source_module.trim()
    const idTrim = agendaForm.source_id_raw.trim()
    let sourceId: string | null = null
    if (idTrim) {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRe.test(idTrim)) {
        amu.setError('Kilde-ID må være en gyldig UUID når den er fylt ut.')
        return
      }
      sourceId = idTrim
    }
    if (agendaPanel.mode === 'new') {
      const row = await amu.insertAgendaItem(meetingId, {
        title: agendaForm.title.trim() || 'Uten tittel',
        description: agendaForm.description,
        order_index: agendaForm.order_index,
        source_module: sm ? sm : null,
        source_id: sourceId,
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
        source_id: sourceId,
      })
      if (u) {
        setAgenda((a) =>
          a.map((x) => (x.id === u.id ? u : x)).sort((p, q) => p.order_index - q.order_index),
        )
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

  const fixOpenDecision = useCallback(
    (item: AmuAgendaItem) => {
      const d = decisionByAgenda[item.id] ?? null
      setDecisionText(d?.decision_text ?? '')
      setApTitle(`Tiltak: ${item.title}`.slice(0, 200))
      setApDescription(d?.decision_text || item.description)
      setApDue(new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10))
      setApResponsible('')
      setDecisionPanel({ item, decision: d })
    },
    [decisionByAgenda],
  )

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

  // ── Pre-flight checks for signing ──
  const hasAgenda = agenda.length > 0
  const decidedCount = agenda.filter((it) => !!decisionByAgenda[it.id]?.decision_text?.trim()).length
  const allDecided = hasAgenda && decidedCount === agenda.length
  const hasMinutes = (meeting?.minutes_draft ?? '').trim().length > 0
  const hasChair = !!chairUserId
  const preflight = [
    { ok: hasAgenda, label: 'Minst én sak er registrert' },
    { ok: allDecided, label: `Alle saker har vedtak (${decidedCount}/${agenda.length})` },
    { ok: hasMinutes, label: 'Referat er fylt ut' },
    { ok: hasChair, label: 'Møteleder er valgt' },
    {
      ok: participantBalanceOk,
      label: 'Lik representasjon begge sider, minst ett verneombud (AML §7-3 og §7-4)',
    },
  ]

  // ── Page shell guards ──
  if (detailState === 'loading') {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Samarbeid' }, { label: 'AMU', to: listPath }]}
        title="Laster møte…"
        loading
        loadingLabel="Laster møte…"
      >
        {null}
      </ModulePageShell>
    )
  }

  if (detailState === 'missing' || !meeting) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Samarbeid' }, { label: 'AMU', to: listPath }]}
        title="Møtet finnes ikke"
        notFound={{
          title: 'Møtet finnes ikke',
          backLabel: '← Tilbake til AMU-møter',
          onBack: () => navigate(listPath),
        }}
      >
        {null}
      </ModulePageShell>
    )
  }

  const meetingDateLabel = new Date(`${meeting.date}T12:00:00`).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Samarbeid' },
        { label: 'AMU', to: listPath },
        { label: meeting.title },
      ]}
      title={meeting.title}
      description={
        <p className="max-w-4xl text-xs leading-relaxed text-neutral-600">
          {meetingDateLabel}
          {meeting.location ? ` · ${meeting.location}` : ''}
          {' · '}
          {agenda.length} saker · {participants.length} deltakere
        </p>
      }
      headerActions={
        <Badge variant={statusBadgeVariant(meeting.status)}>{statusLabel(meeting.status)}</Badge>
      }
      tabs={<Tabs items={TAB_ITEMS} activeId={activeTab} onChange={(id) => setActiveTab(id as AmuTab)} />}
    >
      {amu.error ? <WarningBox>{amu.error}</WarningBox> : null}

      {activeTab === 'information' && (
        <div className="flex flex-col space-y-6">
          {wStats && sStats && (
            <InfoBox>
              {`Varsling: ${wStats.open} åpne, ${wStats.closed} lukkede. Sykefravær (HSE-modul, aggregert): ${sStats.active} aktive, ${sStats.partial} delvise, ${sStats.other} øvrige.`}
            </InfoBox>
          )}

          <ModuleInformationCard
            title="Arbeidsmiljøloven Kap. 7 — Arbeidsmiljøutvalg"
            description={
              <p>
                Generell informasjon om dette AMU-møtet. Møter, saksbehandling og referat følger arbeidsmiljøloven.
                Persondata fra andre moduler (f.eks. varsling) vises kun i aggregert form.
              </p>
            }
            rows={[
              {
                id: 'title',
                label: 'Tittel',
                htmlFor: 'amu-m-title',
                required: true,
                value: (
                  <StandardInput
                    id="amu-m-title"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    disabled={readOnly || !amu.canManage}
                  />
                ),
              },
              {
                id: 'date',
                label: 'Dato',
                htmlFor: 'amu-m-date',
                value: (
                  <StandardInput
                    id="amu-m-date"
                    type="date"
                    value={dateDraft}
                    onChange={(e) => setDateDraft(e.target.value)}
                    disabled={readOnly || !amu.canManage}
                  />
                ),
              },
              {
                id: 'location',
                label: 'Sted',
                htmlFor: 'amu-m-loc',
                value: (
                  <StandardInput
                    id="amu-m-loc"
                    value={locationDraft}
                    onChange={(e) => setLocationDraft(e.target.value)}
                    disabled={readOnly || !amu.canManage}
                    placeholder="Møterom / Teams"
                  />
                ),
              },
              {
                id: 'status',
                label: 'Status',
                htmlFor: 'amu-m-status',
                value: (
                  <SearchableSelect
                    value={statusDraft}
                    options={MEETING_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(v) => setStatusDraft(v as AmuMeeting['status'])}
                    disabled={readOnly || !amu.canManage || meeting.status === 'signed'}
                  />
                ),
              },
            ]}
            footer={
              <div className="flex flex-wrap justify-end">
                <Button
                  type="button"
                  variant="primary"
                  disabled={readOnly || !amu.canManage || saving}
                  onClick={() => void onSaveMeta()}
                >
                  {saving ? 'Lagrer…' : 'Lagre møtedata'}
                </Button>
              </div>
            }
          />
        </div>
      )}

      {activeTab === 'planlegging' && (
        <div className="flex flex-col space-y-6">
          <AmuParticipantsTable
            participants={participants}
            userLabel={userLabel}
            participantSelectOptions={participantOptions}
            readOnly={readOnly}
            canManage={amu.canManage}
            onUpdateRole={async (userId, role) => {
              const next = await amu.upsertParticipant(meeting.id, userId, { role })
              if (next) {
                setParticipants((rows) => rows.map((r) => (r.user_id === userId ? next : r)))
              }
            }}
            onUpdatePresent={async (userId, present) => {
              const next = await amu.upsertParticipant(meeting.id, userId, { present })
              if (next) {
                setParticipants((rows) => rows.map((r) => (r.user_id === userId ? next : r)))
              }
            }}
            onRemove={async (userId) => {
              const ok = await amu.removeParticipant(meeting.id, userId)
              if (ok) setParticipants((r) => r.filter((x) => x.user_id !== userId))
            }}
            onAdd={async (userId, role) => {
              const next = await amu.upsertParticipant(meeting.id, userId, {
                role,
                present: true,
              })
              if (next) {
                setParticipants((r) => [...r.filter((x) => x.user_id !== userId), next])
                return true
              }
              return false
            }}
            onBalanceChange={setParticipantBalanceOk}
          />

          <AmuAgendaPlanningTable
            agenda={agenda}
            readOnly={readOnly}
            canManage={amu.canManage}
            sourceLabel={sourceLabelForAgenda}
            onGenerateDefaultAgenda={() => void onGenerateDefaultAgenda()}
            onOpenNew={openNewAgendaPanel}
            onOpenEdit={openEditAgenda}
            onDelete={(id) => void deleteAgenda(id)}
          />
        </div>
      )}

      {activeTab === 'meeting_room' && (
        <AmuMeetingRoomTab
          agenda={agenda}
          decisionByAgenda={decisionByAgenda}
          meetingStatus={meeting.status}
          onOpenDecision={fixOpenDecision}
          onGoToPlanning={() => setActiveTab('planlegging')}
        />
      )}

      {activeTab === 'minutes' && (
        <ModuleSectionCard>
          <ComplianceBanner
            title="Arbeidsmiljøloven § 7-2 — referat"
            className="border-b border-[#1a3d32]/20"
          >
            Referatet skal dokumentere saksbehandling og vedtak. Lagres separat; signert møte kan ikke omskrives.
          </ComplianceBanner>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-minutes">
              Referat-tekst
            </label>
            <StandardTextarea
              id="amu-minutes"
              rows={12}
              value={minutesDraft}
              onChange={(e) => setMinutesDraft(e.target.value)}
              readOnly={readOnly || !amu.canManage}
              placeholder="Skriv referatet her…"
              className="resize-none"
            />
          </div>
          {!readOnly && amu.canManage && (
            <div className="border-t border-neutral-200 px-4 py-4 md:px-5">
              <Button
                type="button"
                variant="primary"
                disabled={saving}
                onClick={() => void onSaveMinutes()}
              >
                {saving ? 'Lagrer…' : 'Lagre referat'}
              </Button>
            </div>
          )}
        </ModuleSectionCard>
      )}

      {activeTab === 'signature' && (
        <ModuleSectionCard>
          <ComplianceBanner
            title="Arbeidsmiljøloven § 7-2 — signering av referat"
            className="border-b border-[#1a3d32]/20"
          >
            Møteleder signerer og låser referatet. Signering markerer møtet som gjennomført og arkivert.
          </ComplianceBanner>

          <div className="space-y-6 p-5 md:p-6">
            {meeting.status !== 'signed' && <ModulePreflightChecklist items={preflight} />}

            {!participantBalanceOk && !readOnly && (
              <InfoBox>
                <strong>AML §7-3 og §7-4:</strong> Signering er blokkert fordi representasjonen ikke er i balanse.
                Gå til Planlegging-fanen og juster roller slik at begge sider har like mange representanter og minst
                ett verneombud er inkludert.
              </InfoBox>
            )}

            {!readOnly && (
              <div className={WPSTD_FORM_ROW_GRID}>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-chair">
                  Møteleder
                </label>
                <SearchableSelect
                  value={chairUserId}
                  options={[{ value: '', label: 'Velg møteleder' }, ...chairSelectOptions]}
                  onChange={setChairUserId}
                  disabled={!amu.canManage}
                />
              </div>
            )}

            <ModuleSignatureCard
              title="Møteleder"
              lawReference="AML § 7-2 — ansvar for referat"
              signed={
                meeting.chair_signed_at
                  ? {
                      at: meeting.chair_signed_at,
                      byName: meeting.meeting_chair_user_id
                        ? userLabel(meeting.meeting_chair_user_id)
                        : null,
                    }
                  : null
              }
              buttonLabel="Signer som møteleder"
              variant="primary"
              disabled={
                !amu.canManage ||
                readOnly ||
                !hasAgenda ||
                !allDecided ||
                !hasMinutes ||
                !hasChair ||
                !participantBalanceOk ||
                saving
              }
              busy={saving}
              hideButton={meeting.status === 'signed'}
              onSign={() => void onSignMeeting()}
            />

            {meeting.status === 'signed' && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
                <p className="text-sm font-semibold text-green-800">Møtet er signert og låst</p>
                <p className="mt-1 text-xs text-green-600">
                  Arkivert etter arbeidsmiljøloven § 7-2. Videre endringer krever nytt møte eller korrigering i
                  egen sak.
                </p>
              </div>
            )}
          </div>
        </ModuleSectionCard>
      )}

      {/* ── Slide-over: Agenda-sak ────────────────────────────────────────── */}
      <SlidePanel
        open={agendaPanel !== null}
        onClose={() => setAgendaPanel(null)}
        titleId={agendaFormTitleId}
        title={agendaPanel?.mode === 'new' ? 'Ny sak' : 'Rediger sak'}
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAgendaPanel(null)}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void saveAgendaFromPanel()}
              disabled={!amu.canManage}
            >
              Lagre
            </Button>
          </div>
        }
      >
        <div className="space-y-0">
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-agg-title">
              Tittel
            </label>
            <StandardInput
              id="amu-agg-title"
              value={agendaForm.title}
              onChange={(e) => setAgendaForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-agg-body">
              Beskrivelse
            </label>
            <StandardTextarea
              id="amu-agg-body"
              rows={4}
              value={agendaForm.description}
              onChange={(e) => setAgendaForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-agg-ord">
              Rekkefølge (0 = først)
            </label>
            <StandardInput
              id="amu-agg-ord"
              type="number"
              value={agendaForm.order_index}
              onChange={(e) => setAgendaForm((f) => ({ ...f, order_index: Number(e.target.value) }))}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Kildemodul</span>
            <SearchableSelect
              value={agendaForm.source_module}
              options={SOURCE_MODULE_OPTIONS}
              onChange={(v) => setAgendaForm((f) => ({ ...f, source_module: v }))}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-agg-sid">
              Kilde-ID (UUID, valgfri)
            </label>
            <StandardInput
              id="amu-agg-sid"
              value={agendaForm.source_id_raw}
              onChange={(e) => setAgendaForm((f) => ({ ...f, source_id_raw: e.target.value }))}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>
        </div>
      </SlidePanel>

      {/* ── Slide-over: Vedtak + Tiltak ──────────────────────────────────── */}
      <SlidePanel
        open={decisionPanel !== null}
        onClose={() => setDecisionPanel(null)}
        titleId={decisionFormTitleId}
        title={decisionPanel ? decisionPanel.item.title : 'Sak'}
        footer={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="secondary" onClick={() => setDecisionPanel(null)}>
              Lukk
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void saveDecisionOnly()}
              >
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
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-d-text">
                Vedtakstekst
              </label>
              <StandardTextarea
                id="amu-d-text"
                rows={5}
                value={decisionText}
                onChange={(e) => setDecisionText(e.target.value)}
                readOnly={readOnly || !amu.canManage}
              />
            </div>
            <div className="border-b border-dashed border-neutral-200" />
            <h3 className="px-4 py-2 text-sm font-semibold text-neutral-900 md:px-5">
              Tiltak i Handlingsplan (valgfri)
            </h3>
            <div className={WPSTD_FORM_ROW_GRID}>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-d-ap-title">
                Tittel
              </label>
              <StandardInput
                id="amu-d-ap-title"
                value={apTitle}
                onChange={(e) => setApTitle(e.target.value)}
                disabled={readOnly || !amu.canManage}
              />
            </div>
            <div className={WPSTD_FORM_ROW_GRID}>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-d-ap-d">
                Beskrivelse
              </label>
              <StandardTextarea
                id="amu-d-ap-d"
                rows={3}
                value={apDescription}
                onChange={(e) => setApDescription(e.target.value)}
              />
            </div>
            <div className={WPSTD_FORM_ROW_GRID}>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-d-ap-f">
                Dato frist
              </label>
              <StandardInput
                id="amu-d-ap-f"
                type="date"
                value={apDue}
                onChange={(e) => setApDue(e.target.value)}
              />
            </div>
            <div className={WPSTD_FORM_ROW_GRID}>
              <span className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig</span>
              <SearchableSelect
                value={apResponsible}
                options={[{ value: '', label: 'Ikke tildelt' }, ...participantOptions]}
                onChange={setApResponsible}
              />
            </div>
          </div>
        ) : null}
      </SlidePanel>

    </ModulePageShell>
  )
}
