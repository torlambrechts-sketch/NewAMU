// Main meetings hook — owns the read + write surface for the Møter module.
//
// Mirrors the documents/survey shape: one big hook with the read state
// (templates, categories, instances, detail child tables) and the
// mutations needed by Hub + Detail + Admin pages. Forgiving zod parsers
// on every fetch so a partial-schema drift never crashes the UI.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import { fetchClientIpBestEffort, hashDocumentPayload } from '../../src/lib/level1Signature'
import type {
  MeetingActionItemRow,
  MeetingActionStatus,
  MeetingAgendaItemRow,
  MeetingAttendeeRole,
  MeetingAttendeeRow,
  MeetingCadence,
  MeetingCategoryRow,
  MeetingConfidentialityLevel,
  MeetingDecisionRow,
  MeetingDecisionStatus,
  MeetingFramework,
  MeetingOrgTemplateRow,
  MeetingOrgTemplateSettingRow,
  MeetingRow,
  MeetingSignatureRow,
  MeetingStatus,
  MeetingSystemTemplateRow,
  MeetingTemplateDefinition,
  ResolvedMeetingTemplate,
  TemplateMetadataSchema,
} from './types'
import {
  parseMeetingActionItemRow,
  parseMeetingAgendaAttachmentRow,
  parseMeetingAgendaItemRow,
  parseMeetingAttendeeRow,
  parseMeetingCategoryRow,
  parseMeetingDecisionRow,
  parseMeetingDigestRecipientRow,
  parseMeetingExternalInviteeRow,
  parseMeetingLiveSessionRow,
  parseMeetingOrgTemplateRow,
  parseMeetingOrgTemplateSettingRow,
  parseMeetingRow,
  parseMeetingSignatureRow,
  parseMeetingSpeakerQueueRow,
  parseMeetingSystemTemplateRow,
} from './types'
import type { MeetingParityCheck, MeetingVoteResult } from './types'

type Supabase = SupabaseClient
type ParseResult<T> = { success: true; data: T } | { success: false }

function collect<T>(rows: unknown[] | null | undefined, parse: (r: unknown) => ParseResult<T>): T[] {
  const out: T[] = []
  for (const raw of rows ?? []) {
    const p = parse(raw)
    if (p.success) out.push(p.data)
  }
  return out
}

export type CreateMeetingInput = {
  title: string
  description?: string | null
  templateId?: string | null
  orgTemplateId?: string | null
  scheduledAt?: string | null
  endsAt?: string | null
  confidentialityLevel?: MeetingConfidentialityLevel
  locationLabel?: string | null
  locationId?: string | null
  departmentId?: string | null
  teamId?: string | null
  participantMemberIds?: string[]
  metadata?: Record<string, unknown>
  reportingPeriodStart?: string | null
  reportingPeriodEnd?: string | null
  reportingPeriodLabel?: string | null
}

export type AgendaItemInput = {
  meetingId: string
  title: string
  description?: string | null
  lawRef?: string | null
  durationMinutes?: number | null
  presenterMemberId?: string | null
  /** Sparse-position insertion. Computes `position = insertAfterPosition + 5`
   *  when set, else `max(position) + 10`. */
  insertAfterPosition?: number
}

export type AgendaItemPatch = {
  title?: string
  description?: string | null
  lawRef?: string | null
  durationMinutes?: number | null
  presenterMemberId?: string | null
}

export type ReportingPeriodInput = {
  start: string | null
  end: string | null
  label: string | null
}

export type PriorOpenDecision = {
  id: string
  decision_text: string
  decision_at: string
  meeting_id: string
  meeting_title: string
  meeting_scheduled_at: string | null
}

export type MeetingDetail = {
  meeting: MeetingRow | null
  agendaItems: MeetingAgendaItemRow[]
  attendees: MeetingAttendeeRow[]
  decisions: MeetingDecisionRow[]
  actionItems: MeetingActionItemRow[]
  signatures: MeetingSignatureRow[]
  priorOpenDecisions: PriorOpenDecision[]
}

const EMPTY_DETAIL: MeetingDetail = {
  meeting: null,
  agendaItems: [],
  attendees: [],
  decisions: [],
  actionItems: [],
  signatures: [],
  priorOpenDecisions: [],
}

export type UseMeetingsState = {
  loading: boolean
  error: string | null
  orgId: string | null
  canManage: boolean
  /** Resolved templates — system + per-org settings overlay + org-custom. */
  templates: ResolvedMeetingTemplate[]
  /** Raw rows for admin surfaces. */
  systemTemplates: MeetingSystemTemplateRow[]
  orgSettings: MeetingOrgTemplateSettingRow[]
  orgTemplates: MeetingOrgTemplateRow[]
  categories: MeetingCategoryRow[]
  meetings: MeetingRow[]
  detail: MeetingDetail
  detailLoading: boolean
  detailMeetingId: string | null
  loadList: () => Promise<void>
  loadDetail: (meetingId: string) => Promise<void>
  clearDetail: () => void
  createMeeting: (input: CreateMeetingInput) => Promise<MeetingRow | null>
  updateMeeting: (id: string, patch: Partial<MeetingRow>) => Promise<boolean>
  setAgendaMinutes: (
    agendaItemId: string,
    patch: {
      minutesSummary?: string | null
      decisionText?: string | null
      decisionStatus?: MeetingDecisionStatus | null
      voteFor?: number | null
      voteAgainst?: number | null
      voteAbstain?: number | null
      minorityDissentText?: string | null
    },
  ) => Promise<boolean>
  upsertAttendee: (input: {
    meetingId: string
    memberId: string
    role: MeetingAttendeeRole
    present?: boolean | null
    excused?: boolean
    digital?: boolean
    notes?: string | null
  }) => Promise<boolean>
  addActionItem: (input: {
    meetingId: string
    agendaItemId?: string | null
    description: string
    responsibleMemberId?: string | null
    dueDate?: string | null
  }) => Promise<MeetingActionItemRow | null>
  setActionItemStatus: (id: string, status: MeetingActionStatus) => Promise<boolean>
  signProtocol: (input: {
    meetingId: string
    signerName: string
    signerRole: 'chair' | 'secretary' | 'management' | 'member' | 'other'
    signerMemberId?: string | null
  }) => Promise<boolean>
  /** Records that innkalling was sent at `sentAt` (default: now) and which
   *  members were notified. Does not send email itself — invoke the
   *  `send-meeting-invites` edge function for that. */
  markInvitationSent: (input: {
    meetingId: string
    recipientMemberIds: string[]
    sentAt?: string
  }) => Promise<boolean>
  /** Optimistically invokes `send-meeting-invites` edge function and on
   *  success stamps `invitation_sent_at` + `invitation_recipients`. */
  sendInvitations: (input: {
    meetingId: string
    mode?: 'initial' | 'reminder'
  }) => Promise<{ ok: boolean; sent: number; error?: string }>
  /** RSVP state machine for invited members + substitute auto-activation. */
  setRsvp: (input: {
    meetingId: string
    memberId: string
    status: import('./types').MeetingRsvpStatus
    reason?: string | null
  }) => Promise<boolean>
  activateSubstitute: (input: {
    meetingId: string
    substituteMemberId: string
    principalMemberId: string
  }) => Promise<boolean>
  /** Voting model on an agenda item (controls how the result is derived). */
  setAgendaVotingModel: (
    agendaItemId: string,
    model: import('./types').MeetingVotingModel | null,
  ) => Promise<boolean>
  /** Cast / change a single ballot — supports both live and pre-vote.
   *  Anonymous voting is a *display-time* concern (the UI hides voter
   *  identity in the rendered result); at the DB level every ballot has
   *  a member_id so we get one row per voter per agenda item. */
  castVote: (input: {
    agendaItemId: string
    meetingId: string
    memberId: string
    ballot: import('./types').MeetingBallot
    side?: Exclude<import('./types').MeetingSide, 'observer'> | null
    isPreVote?: boolean
  }) => Promise<boolean>
  /** Server-computed result (model-aware) for an agenda item. */
  getVoteResult: (agendaItemId: string) => Promise<import('./types').MeetingVoteResult | null>
  /** Server-computed parity + quorum status for a meeting. */
  getParityCheck: (meetingId: string) => Promise<import('./types').MeetingParityCheck | null>
  /** Live-room session controls. */
  startLiveSession: (meetingId: string) => Promise<boolean>
  setLiveActiveItem: (meetingId: string, agendaItemId: string | null) => Promise<boolean>
  endLiveSession: (meetingId: string) => Promise<boolean>
  loadLiveSession: (meetingId: string) => Promise<import('./types').MeetingLiveSessionRow | null>
  /** Speaker queue (taleliste). */
  addSpeaker: (input: {
    meetingId: string
    agendaItemId: string | null
    memberId: string | null
    topic?: string | null
  }) => Promise<boolean>
  giveSpeakerFloor: (speakerId: string) => Promise<boolean>
  yieldSpeaker: (speakerId: string) => Promise<boolean>
  loadSpeakerQueue: (meetingId: string) => Promise<import('./types').MeetingSpeakerQueueRow[]>
  /** External invitees with secure tokens (token-gated public access). */
  addExternalInvitee: (input: {
    meetingId: string
    name: string
    email?: string | null
    role?: string | null
    accessLevel?: 'observer' | 'speak' | 'vote'
    orgAffiliation?: string | null
    expiresAt?: string | null
  }) => Promise<import('./types').MeetingExternalInviteeRow | null>
  loadExternalInvitees: (meetingId: string) => Promise<import('./types').MeetingExternalInviteeRow[]>
  /** Stakeholder digest recipients (post-signing distribution). */
  upsertDigestRecipient: (input: {
    id?: string
    meetingId: string
    name: string
    recipientFilter?: Record<string, unknown>
    extractMode?: 'full' | 'decisions_only'
    defaultSelected?: boolean
    lawRef?: string | null
  }) => Promise<boolean>
  loadDigestRecipients: (meetingId: string) => Promise<import('./types').MeetingDigestRecipientRow[]>
  /** Admin: toggle a system template on/off for the current org. */
  setTemplateEnabled: (systemTemplateId: string, enabled: boolean) => Promise<boolean>
  setTemplateCategory: (systemTemplateId: string, categoryId: string | null) => Promise<boolean>
  setTemplatePinned: (systemTemplateId: string, navPinned: boolean) => Promise<boolean>
  renameTemplate: (systemTemplateId: string, overrideName: string | null) => Promise<boolean>
  upsertCategory: (input: {
    id?: string
    slug: string
    name: string
    description?: string | null
    position?: number
  }) => Promise<MeetingCategoryRow | null>
  upsertOrgTemplate: (input: {
    id?: string
    slug: string
    name: string
    description?: string | null
    categoryId?: string | null
    framework: MeetingFramework
    frameworks?: string[]
    lawRefs?: string[]
    cadenceHint?: MeetingCadence | null
    defaultDurationMinutes?: number | null
    defaultConfidentialityLevel?: MeetingConfidentialityLevel
    minimumEmployeeCount?: number | null
    definition: MeetingTemplateDefinition
    metadataSchema?: TemplateMetadataSchema
    navPinned?: boolean
    isActive?: boolean
  }) => Promise<MeetingOrgTemplateRow | null>
  deleteOrgTemplate: (id: string) => Promise<boolean>
  refresh: () => Promise<void>
  clearError: () => void

  // ── Agenda builder ─────────────────────────────────────────────────────
  /** Add a manual (non-template) agenda item. Refuses post-sign. */
  addAgendaItem: (input: AgendaItemInput) => Promise<MeetingAgendaItemRow | null>
  /** Patch title/description/duration/presenter on an unsigned meeting's item. */
  updateAgendaItem: (id: string, patch: AgendaItemPatch) => Promise<boolean>
  /** Remove a non-mandatory agenda item (server enforces is_mandatory guard). */
  removeAgendaItem: (id: string) => Promise<boolean>
  /** Reorder by passing the desired final id sequence; positions = i*10. */
  reorderAgendaItems: (meetingId: string, orderedIds: string[]) => Promise<boolean>

  // ── Reporting period ──────────────────────────────────────────────────
  updateMeetingPeriod: (id: string, period: ReportingPeriodInput) => Promise<boolean>

  // ── Binding snapshots ─────────────────────────────────────────────────
  /** Re-resolve a single agenda item's binding and write the snapshot.
   *  Caller provides the fresh snapshot (computed by resolveAllForMeeting). */
  writeBindingSnapshot: (
    agendaItemId: string,
    snapshot: import('./types').RenderedBindingResult | null,
  ) => Promise<boolean>

  // ── Attachments (Sherpany-style pre-read docs) ────────────────────────
  /** Link a wiki_page as pre-read attachment to an agenda item. */
  addAttachment: (agendaItemId: string, wikiPageId: string) => Promise<boolean>
  removeAttachment: (attachmentId: string) => Promise<boolean>
  /** Read attachments for a given agenda item (lazy on demand). */
  listAttachments: (
    agendaItemId: string,
  ) => Promise<import('./types').MeetingAgendaAttachmentRow[]>
}

const META_DEFAULT: TemplateMetadataSchema = { fields: [] }

function resolveTemplates(
  systemTemplates: MeetingSystemTemplateRow[],
  orgSettings: MeetingOrgTemplateSettingRow[],
  orgTemplates: MeetingOrgTemplateRow[],
  categories: MeetingCategoryRow[],
): ResolvedMeetingTemplate[] {
  const settingsById = new Map<string, MeetingOrgTemplateSettingRow>()
  for (const s of orgSettings) settingsById.set(s.system_template_id, s)
  const categoryBySlug = new Map<string, MeetingCategoryRow>()
  for (const c of categories) categoryBySlug.set(c.slug, c)

  const resolved: ResolvedMeetingTemplate[] = []
  for (const t of systemTemplates) {
    const setting = settingsById.get(t.id)
    if (setting && setting.enabled === false) continue
    const categoryId =
      setting?.category_id ??
      (t.default_category_slug ? categoryBySlug.get(t.default_category_slug)?.id ?? null : null)
    resolved.push({
      key: t.id,
      sourceKind: 'system',
      systemTemplateId: t.id,
      orgTemplateId: null,
      name: setting?.override_name ?? t.label,
      description: setting?.override_description ?? t.description,
      framework: t.framework,
      frameworks: t.frameworks ?? [],
      lawRefs: t.law_refs ?? [],
      cadenceHint: t.cadence_hint,
      defaultDurationMinutes: t.default_duration_minutes,
      defaultConfidentialityLevel: t.default_confidentiality_level ?? 'standard',
      minimumEmployeeCount: t.minimum_employee_count ?? null,
      categoryId,
      navPinned: setting?.nav_pinned ?? false,
      position: setting?.position ?? t.sort_order,
      definition: setting?.override_definition ?? t.definition,
      metadataSchema: setting?.override_metadata_schema ?? t.metadata_schema ?? META_DEFAULT,
      isSystem: true,
      isActive: t.is_active,
    })
  }
  for (const ot of orgTemplates) {
    if (ot.deleted_at) continue
    resolved.push({
      key: `org:${ot.id}`,
      sourceKind: 'org',
      systemTemplateId: null,
      orgTemplateId: ot.id,
      name: ot.name,
      description: ot.description,
      framework: ot.framework,
      frameworks: ot.frameworks ?? [],
      lawRefs: ot.law_refs ?? [],
      cadenceHint: ot.cadence_hint,
      defaultDurationMinutes: ot.default_duration_minutes,
      defaultConfidentialityLevel: ot.default_confidentiality_level ?? 'standard',
      minimumEmployeeCount: ot.minimum_employee_count ?? null,
      categoryId: ot.category_id,
      navPinned: ot.nav_pinned,
      position: 1000,
      definition: ot.definition,
      metadataSchema: ot.metadata_schema ?? META_DEFAULT,
      isSystem: false,
      isActive: ot.is_active,
    })
  }
  resolved.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
  return resolved
}

function snapshotDefinition(template: ResolvedMeetingTemplate): MeetingTemplateDefinition {
  // Deep-clone via JSON to detach from the cached resolved template object.
  // Also stamp the framework onto the snapshot so downstream consumers
  // (resolver, Datapakke, signal scanner) don't have to re-look-up the
  // template from the meeting's foreign keys.
  const cloned = JSON.parse(JSON.stringify(template.definition)) as MeetingTemplateDefinition
  cloned.framework = template.framework
  return cloned
}

/** H11b — load open decisions from prior meetings using the same template.
 *  RLS scopes by organization so the supabase client only returns the
 *  caller's org rows. Skips the current meeting itself. */
async function loadPriorOpenDecisions(
  supabase: Supabase,
  current: MeetingRow,
): Promise<PriorOpenDecision[]> {
  const templateCol = current.system_template_id
    ? { field: 'system_template_id', value: current.system_template_id }
    : current.org_template_id
      ? { field: 'org_template_id', value: current.org_template_id }
      : null
  if (!templateCol) return []

  const priorMeetingsRes = await supabase
    .from('meetings')
    .select('id, title, scheduled_at')
    .eq('organization_id', current.organization_id)
    .eq(templateCol.field, templateCol.value)
    .neq('id', current.id)
    .is('archived_at', null)
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .limit(10)
  if (priorMeetingsRes.error || !priorMeetingsRes.data?.length) return []
  const priorMeetings = priorMeetingsRes.data as Array<{
    id: string
    title: string
    scheduled_at: string | null
  }>
  const titleById = new Map(priorMeetings.map((m) => [m.id, m.title]))
  const scheduledById = new Map(priorMeetings.map((m) => [m.id, m.scheduled_at]))

  const decisionsRes = await supabase
    .from('meeting_decisions')
    .select('id, decision_text, decision_at, meeting_id')
    .in('meeting_id', priorMeetings.map((m) => m.id))
    .eq('status', 'open')
    .order('decision_at', { ascending: false })
    .limit(20)
  if (decisionsRes.error || !decisionsRes.data) return []
  return (decisionsRes.data as Array<{
    id: string
    decision_text: string
    decision_at: string
    meeting_id: string
  }>).map((d) => ({
    id: d.id,
    decision_text: d.decision_text,
    decision_at: d.decision_at,
    meeting_id: d.meeting_id,
    meeting_title: titleById.get(d.meeting_id) ?? '—',
    meeting_scheduled_at: scheduledById.get(d.meeting_id) ?? null,
  }))
}

/** H11a — Vedtaksregister bridge. Open meeting decisions spawn (or refresh)
 *  a `task_items` row so the decision lands on the user's task board. The
 *  task's id is stored on `meeting_decisions.follow_up_task_id` so re-saving
 *  doesn't duplicate. Closed decisions close the task. */
async function syncDecisionTask(args: {
  supabase: Supabase
  orgId: string
  decisionId: string
  meeting: MeetingRow
  decisionText: string
  status: MeetingDecisionStatus
  existingTaskId: string | null
}): Promise<void> {
  const { supabase, orgId, decisionId, meeting, decisionText, status, existingTaskId } = args
  const title = decisionText.length > 120 ? `${decisionText.slice(0, 117)}…` : decisionText
  const description = `Vedtak fra møte: ${meeting.title}\nKilde: meeting_decisions/${decisionId}`

  if (status === 'open') {
    if (existingTaskId) {
      // Reopen if closed; refresh title/description in case decision text edited.
      await supabase
        .from('task_items')
        .update({
          title,
          description,
          status: 'open',
          closed_at: null,
        })
        .eq('id', existingTaskId)
      return
    }
    const ins = await supabase
      .from('task_items')
      .insert({
        organization_id: orgId,
        title,
        description,
        priority: 'medium',
        status: 'open',
        pack: 'aml-amu',
        source_category: 'tiltak',
        template_kind: 'tiltak',
        pdca_phase: 'do',
        due_date: meeting.next_meeting_proposed_at
          ? meeting.next_meeting_proposed_at.slice(0, 10)
          : null,
      })
      .select('id')
      .single()
    if (ins.data?.id) {
      await supabase
        .from('meeting_decisions')
        .update({ follow_up_task_id: ins.data.id })
        .eq('id', decisionId)
    }
    return
  }

  // Decision is implemented or dropped — close the linked task (if any).
  if (existingTaskId) {
    await supabase
      .from('task_items')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        description: `${description}\nLukket pga. vedtaksstatus: ${status}`,
      })
      .eq('id', existingTaskId)
  }
}

async function loadOrgSettingsRow(
  supabase: Supabase,
  orgId: string,
  systemTemplateId: string,
): Promise<MeetingOrgTemplateSettingRow | null> {
  const res = await supabase
    .from('meeting_org_template_settings')
    .select('*')
    .eq('organization_id', orgId)
    .eq('system_template_id', systemTemplateId)
    .maybeSingle()
  if (res.error) return null
  const parsed = parseMeetingOrgTemplateSettingRow(res.data)
  return parsed.success ? parsed.data : null
}

export function useMeetings(): UseMeetingsState {
  const { supabase, organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const canManage = isAdmin || can('meetings.manage')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [systemTemplates, setSystemTemplates] = useState<MeetingSystemTemplateRow[]>([])
  const [orgSettings, setOrgSettings] = useState<MeetingOrgTemplateSettingRow[]>([])
  const [orgTemplates, setOrgTemplates] = useState<MeetingOrgTemplateRow[]>([])
  const [categories, setCategories] = useState<MeetingCategoryRow[]>([])
  const [meetings, setMeetings] = useState<MeetingRow[]>([])
  const [detail, setDetail] = useState<MeetingDetail>(EMPTY_DETAIL)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailMeetingId, setDetailMeetingId] = useState<string | null>(null)
  const fetchedRef = useRef<string | null>(null)

  const loadList = useCallback(async (): Promise<void> => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const [sysRes, setRes, otRes, catRes, mtRes] = await Promise.all([
        supabase
          .from('meeting_system_templates')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('meeting_org_template_settings')
          .select('*')
          .eq('organization_id', orgId),
        supabase
          .from('meeting_org_templates')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .from('meeting_template_categories')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('position', { ascending: true }),
        supabase
          .from('meetings')
          .select('*')
          .eq('organization_id', orgId)
          .is('archived_at', null)
          .order('scheduled_at', { ascending: false, nullsFirst: false })
          .limit(500),
      ])
      setSystemTemplates(collect(sysRes.data, parseMeetingSystemTemplateRow))
      setOrgSettings(collect(setRes.data, parseMeetingOrgTemplateSettingRow))
      setOrgTemplates(collect(otRes.data, parseMeetingOrgTemplateRow))
      setCategories(collect(catRes.data, parseMeetingCategoryRow))
      setMeetings(collect(mtRes.data, parseMeetingRow))
      fetchedRef.current = orgId
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    if (!supabase || !orgId) return
    if (fetchedRef.current === orgId) return
    void loadList()
  }, [supabase, orgId, loadList])

  const loadDetail = useCallback(
    async (meetingId: string): Promise<void> => {
      if (!supabase || !orgId) return
      setDetailLoading(true)
      setDetailMeetingId(meetingId)
      try {
        const [mRes, aiRes, atRes, dRes, acRes, sRes] = await Promise.all([
          supabase.from('meetings').select('*').eq('id', meetingId).maybeSingle(),
          supabase
            .from('meeting_agenda_items')
            .select('*')
            .eq('meeting_id', meetingId)
            .order('position', { ascending: true }),
          supabase.from('meeting_attendees').select('*').eq('meeting_id', meetingId),
          supabase
            .from('meeting_decisions')
            .select('*')
            .eq('meeting_id', meetingId)
            .order('decision_at', { ascending: false }),
          supabase
            .from('meeting_action_items')
            .select('*')
            .eq('meeting_id', meetingId)
            .order('due_date', { ascending: true, nullsFirst: false }),
          supabase
            .from('meeting_signatures')
            .select('*')
            .eq('meeting_id', meetingId)
            .order('signed_at', { ascending: true }),
        ])
        const meetingParsed = parseMeetingRow(mRes.data)
        const meetingRow = meetingParsed.success ? meetingParsed.data : null

        // H11b — Prior open decisions carry-over. Find decisions still
        // open on prior meetings of the same template; let the user pick
        // up unfinished business from "forrige møte".
        let priorOpenDecisions: PriorOpenDecision[] = []
        if (meetingRow) {
          priorOpenDecisions = await loadPriorOpenDecisions(supabase, meetingRow)
        }

        setDetail({
          meeting: meetingRow,
          agendaItems: collect(aiRes.data, parseMeetingAgendaItemRow),
          attendees: collect(atRes.data, parseMeetingAttendeeRow),
          decisions: collect(dRes.data, parseMeetingDecisionRow),
          actionItems: collect(acRes.data, parseMeetingActionItemRow),
          signatures: collect(sRes.data, parseMeetingSignatureRow),
          priorOpenDecisions,
        })
      } catch (e) {
        setError(getSupabaseErrorMessage(e))
      } finally {
        setDetailLoading(false)
      }
    },
    [supabase, orgId],
  )

  const clearDetail = useCallback(() => {
    setDetail(EMPTY_DETAIL)
    setDetailMeetingId(null)
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    fetchedRef.current = null
    await loadList()
    if (detailMeetingId) await loadDetail(detailMeetingId)
  }, [loadList, loadDetail, detailMeetingId])

  const templates = useMemo<ResolvedMeetingTemplate[]>(
    () => resolveTemplates(systemTemplates, orgSettings, orgTemplates, categories),
    [systemTemplates, orgSettings, orgTemplates, categories],
  )

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMeeting = useCallback(
    async (input: CreateMeetingInput): Promise<MeetingRow | null> => {
      if (!supabase || !orgId) return null
      setError(null)
      let resolvedTpl: ResolvedMeetingTemplate | null = null
      if (input.templateId) {
        resolvedTpl =
          templates.find(
            (t) => t.systemTemplateId === input.templateId || t.orgTemplateId === input.templateId,
          ) ?? null
      } else if (input.orgTemplateId) {
        resolvedTpl = templates.find((t) => t.orgTemplateId === input.orgTemplateId) ?? null
      }
      const sourceKind: 'system' | 'org' = resolvedTpl?.sourceKind ?? 'org'
      const defaultConfidentiality: MeetingConfidentialityLevel =
        input.confidentialityLevel ?? 'standard'
      const insertRow = {
        organization_id: orgId,
        source_kind: sourceKind,
        system_template_id: resolvedTpl?.systemTemplateId ?? null,
        org_template_id: resolvedTpl?.orgTemplateId ?? null,
        title: input.title,
        description: input.description ?? null,
        status: 'planned' as MeetingStatus,
        confidentiality_level: defaultConfidentiality,
        scheduled_at: input.scheduledAt ?? null,
        ends_at: input.endsAt ?? null,
        location_label: input.locationLabel ?? null,
        location_id: input.locationId ?? null,
        department_id: input.departmentId ?? null,
        team_id: input.teamId ?? null,
        participant_member_ids: input.participantMemberIds ?? [],
        metadata: input.metadata ?? {},
        definition_snapshot: resolvedTpl ? snapshotDefinition(resolvedTpl) : null,
        metadata_schema_snapshot: resolvedTpl?.metadataSchema ?? null,
        reporting_period_start: input.reportingPeriodStart ?? null,
        reporting_period_end: input.reportingPeriodEnd ?? null,
        reporting_period_label: input.reportingPeriodLabel ?? null,
      }
      const ins = await supabase.from('meetings').insert(insertRow).select('*').single()
      if (ins.error || !ins.data) {
        setError(getSupabaseErrorMessage(ins.error))
        return null
      }
      const parsed = parseMeetingRow(ins.data)
      if (!parsed.success) return null
      const meeting = parsed.data

      // Materialise agenda items from the snapshotted definition.
      if (resolvedTpl?.definition?.agendaItems?.length) {
        const rows = resolvedTpl.definition.agendaItems
          .slice()
          .sort((a, b) => a.defaultPosition - b.defaultPosition)
          .map((item, idx) => ({
            meeting_id: meeting.id,
            // Sparse positions (gap of 10) so manual inserts are cheap.
            position: idx * 10,
            template_item_key: item.key,
            title: item.title,
            description: item.description ?? null,
            law_ref: item.lawRef ?? null,
            is_mandatory: item.isMandatory,
            is_manual: false,
            duration_minutes: item.defaultDurationMinutes ?? null,
          }))
        const agendaIns = await supabase.from('meeting_agenda_items').insert(rows)
        if (agendaIns.error) {
          // Don't block the meeting creation — surface as error for the page.
          setError(getSupabaseErrorMessage(agendaIns.error))
        }
      }
      await loadList()
      return meeting
    },
    [supabase, orgId, templates, loadList],
  )

  const updateMeeting = useCallback(
    async (id: string, patch: Partial<MeetingRow>): Promise<boolean> => {
      if (!supabase) return false
      const res = await supabase.from('meetings').update(patch).eq('id', id)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
      if (detailMeetingId === id) await loadDetail(id)
      return true
    },
    [supabase, detailMeetingId, loadDetail],
  )

  const setAgendaMinutes: UseMeetingsState['setAgendaMinutes'] = useCallback(
    async (agendaItemId, patch) => {
      if (!supabase) return false
      const update: Record<string, unknown> = {}
      if (patch.minutesSummary !== undefined) update.minutes_summary = patch.minutesSummary
      if (patch.decisionText !== undefined) update.decision_text = patch.decisionText
      if (patch.decisionStatus !== undefined) update.decision_status = patch.decisionStatus
      if (patch.voteFor !== undefined) update.vote_for = patch.voteFor
      if (patch.voteAgainst !== undefined) update.vote_against = patch.voteAgainst
      if (patch.voteAbstain !== undefined) update.vote_abstain = patch.voteAbstain
      if (patch.minorityDissentText !== undefined)
        update.minority_dissent_text = patch.minorityDissentText
      if (Object.keys(update).length === 0) return true
      const res = await supabase
        .from('meeting_agenda_items')
        .update(update)
        .eq('id', agendaItemId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      // Mirror per-agenda decision text into the cross-meeting register.
      // We keep at most one register row per agenda item — the latest
      // edit overwrites it. Clearing decisionText removes the register
      // entry so the agenda is the source of truth.
      if (detail.meeting && orgId) {
        if (patch.decisionText) {
          const status = (patch.decisionStatus ?? 'open') as MeetingDecisionStatus
          const existing = await supabase
            .from('meeting_decisions')
            .select('id, follow_up_task_id')
            .eq('agenda_item_id', agendaItemId)
            .limit(1)
            .maybeSingle()
          let decisionId: string | null = null
          let existingTaskId: string | null = null
          if (existing.data?.id) {
            decisionId = existing.data.id as string
            existingTaskId = (existing.data.follow_up_task_id as string | null) ?? null
            await supabase
              .from('meeting_decisions')
              .update({
                decision_text: patch.decisionText,
                status,
              })
              .eq('id', decisionId)
          } else {
            const ins = await supabase
              .from('meeting_decisions')
              .insert({
                meeting_id: detail.meeting.id,
                agenda_item_id: agendaItemId,
                decision_text: patch.decisionText,
                status,
              })
              .select('id')
              .single()
            if (ins.data?.id) decisionId = ins.data.id as string
          }
          // H11a — Vedtaksregister: keep a linked follow-up task row
          // in sync with the decision. Open decisions spawn or refresh
          // a task; implemented/dropped decisions close the task.
          if (decisionId) {
            await syncDecisionTask({
              supabase,
              orgId,
              decisionId,
              meeting: detail.meeting,
              decisionText: patch.decisionText,
              status,
              existingTaskId,
            })
          }
        } else if (patch.decisionText === null) {
          // Decision cleared — close any linked task before removing
          // the register row so the task carries the audit trail.
          const existing = await supabase
            .from('meeting_decisions')
            .select('follow_up_task_id')
            .eq('agenda_item_id', agendaItemId)
            .limit(1)
            .maybeSingle()
          const linkedTaskId = (existing.data?.follow_up_task_id as string | null) ?? null
          if (linkedTaskId) {
            await supabase
              .from('task_items')
              .update({ status: 'closed', closed_at: new Date().toISOString() })
              .eq('id', linkedTaskId)
          }
          await supabase
            .from('meeting_decisions')
            .delete()
            .eq('agenda_item_id', agendaItemId)
        }
      }
      if (detailMeetingId) await loadDetail(detailMeetingId)
      return true
    },
    [supabase, orgId, detail.meeting, detailMeetingId, loadDetail],
  )

  const upsertAttendee: UseMeetingsState['upsertAttendee'] = useCallback(
    async (input) => {
      if (!supabase) return false
      const row = {
        meeting_id: input.meetingId,
        member_id: input.memberId,
        role: input.role,
        invited: true,
        present: input.present ?? null,
        excused: input.excused ?? false,
        digital: input.digital ?? false,
        notes: input.notes ?? null,
      }
      const res = await supabase
        .from('meeting_attendees')
        .upsert(row, { onConflict: 'meeting_id,member_id' })
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      if (detailMeetingId === input.meetingId) await loadDetail(input.meetingId)
      return true
    },
    [supabase, detailMeetingId, loadDetail],
  )

  const addActionItem: UseMeetingsState['addActionItem'] = useCallback(
    async (input) => {
      if (!supabase) return null
      const ins = await supabase
        .from('meeting_action_items')
        .insert({
          meeting_id: input.meetingId,
          agenda_item_id: input.agendaItemId ?? null,
          description: input.description,
          responsible_member_id: input.responsibleMemberId ?? null,
          due_date: input.dueDate ?? null,
        })
        .select('*')
        .single()
      if (ins.error || !ins.data) {
        setError(getSupabaseErrorMessage(ins.error))
        return null
      }
      const parsed = parseMeetingActionItemRow(ins.data)
      if (!parsed.success) return null
      if (detailMeetingId === input.meetingId) await loadDetail(input.meetingId)
      return parsed.data
    },
    [supabase, detailMeetingId, loadDetail],
  )

  const setActionItemStatus = useCallback(
    async (id: string, status: MeetingActionStatus): Promise<boolean> => {
      if (!supabase) return false
      const res = await supabase.from('meeting_action_items').update({ status }).eq('id', id)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      if (detailMeetingId) await loadDetail(detailMeetingId)
      return true
    },
    [supabase, detailMeetingId, loadDetail],
  )

  const signProtocol: UseMeetingsState['signProtocol'] = useCallback(
    async (input) => {
      if (!supabase) return false
      const now = new Date().toISOString()
      // Build canonical hash payload over the meeting + child tables.
      // The L1 audit row, the signature row, and the protocol_signed_at
      // stamp are then written atomically by the meetings_sign_protocol_v1
      // RPC — single transaction, rolls back on any failure so the audit
      // ledger can never end up partial.
      const meetingRow =
        meetings.find((m) => m.id === input.meetingId) ??
        (detailMeetingId === input.meetingId ? detail.meeting : null)
      const hashPayload = {
        meetingId: input.meetingId,
        organizationId: orgId,
        title: meetingRow?.title ?? null,
        scheduledAt: meetingRow?.scheduled_at ?? null,
        confidentialityLevel: meetingRow?.confidentiality_level ?? null,
        participants: meetingRow?.participant_member_ids ?? [],
        agenda: (detailMeetingId === input.meetingId ? detail.agendaItems : []).map((a) => ({
          position: a.position,
          title: a.title,
          minutesSummary: a.minutes_summary,
          decisionText: a.decision_text,
          decisionStatus: a.decision_status,
          voteFor: a.vote_for,
          voteAgainst: a.vote_against,
          voteAbstain: a.vote_abstain,
          minorityDissentText: a.minority_dissent_text,
        })),
        attendees: (detailMeetingId === input.meetingId ? detail.attendees : []).map((p) => ({
          memberId: p.member_id,
          role: p.role,
          present: p.present,
          excused: p.excused,
        })),
        decisions: (detailMeetingId === input.meetingId ? detail.decisions : []).map((d) => ({
          id: d.id,
          agendaItemId: d.agenda_item_id,
          text: d.decision_text,
          status: d.status,
        })),
        signature: {
          name: input.signerName,
          role: input.signerRole,
          memberId: input.signerMemberId ?? null,
          signedAt: now,
        },
      }
      const documentHashSha256 = await hashDocumentPayload(hashPayload)
      const clientIp = await fetchClientIpBestEffort()
      const rpc = await supabase.rpc('meetings_sign_protocol_v1', {
        p_meeting_id: input.meetingId,
        p_signer_name: input.signerName,
        p_signer_role: input.signerRole,
        p_signer_member_id: input.signerMemberId ?? null,
        p_document_hash_sha256: documentHashSha256,
        p_client_ip: clientIp ?? null,
      })
      if (rpc.error) {
        setError(getSupabaseErrorMessage(rpc.error))
        return false
      }
      if (detailMeetingId === input.meetingId) await loadDetail(input.meetingId)
      await loadList()
      return true
    },
    [supabase, orgId, meetings, detail, detailMeetingId, loadDetail, loadList],
  )

  const markInvitationSent: UseMeetingsState['markInvitationSent'] = useCallback(
    async (input) => {
      if (!supabase) return false
      const sentAt = input.sentAt ?? new Date().toISOString()
      const res = await supabase
        .from('meetings')
        .update({
          invitation_sent_at: sentAt,
          invitation_recipients: input.recipientMemberIds,
        })
        .eq('id', input.meetingId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      if (detailMeetingId === input.meetingId) await loadDetail(input.meetingId)
      await loadList()
      return true
    },
    [supabase, detailMeetingId, loadDetail, loadList],
  )

  const sendInvitations: UseMeetingsState['sendInvitations'] = useCallback(
    async (input) => {
      if (!supabase) return { ok: false, sent: 0, error: 'Supabase ikke tilgjengelig' }
      // Send FIRST, stamp `invitation_sent_at` only after the edge function
      // confirms delivery — otherwise the green "innkalling i god tid" badge
      // would lie about emails that never actually left Resend's queue.
      const invoke = await supabase.functions.invoke('send-meeting-invites', {
        body: { meeting_id: input.meetingId, mode: input.mode ?? 'initial' },
      })
      if (invoke.error) {
        return { ok: false, sent: 0, error: getSupabaseErrorMessage(invoke.error) }
      }
      const data = (invoke.data ?? {}) as { sent?: number; failed?: number; total?: number }
      const sent = Number(data.sent ?? 0)
      const failed = Number(data.failed ?? 0)
      // Partial-failure semantics: if NO message was delivered, treat as full
      // failure and don't stamp the timestamp. If at least one made it, stamp
      // but surface the partial-failure count so the chair can investigate.
      if (sent === 0) {
        return {
          ok: false,
          sent: 0,
          error: failed > 0
            ? `Ingen e-poster ble levert (${failed} feilet — sjekk at deltakerne har e-postadresse).`
            : 'Ingen e-poster ble sendt — sjekk at det er deltakere registrert.',
        }
      }
      const meetingRow = meetings.find((m) => m.id === input.meetingId)
        ?? (detailMeetingId === input.meetingId ? detail.meeting : null)
      const recipients = meetingRow?.participant_member_ids ?? []
      const stamped = await markInvitationSent({
        meetingId: input.meetingId,
        recipientMemberIds: recipients,
      })
      if (!stamped) {
        return {
          ok: false,
          sent,
          error: `E-post sendt til ${sent}, men kunne ikke registrere innkallings­tidspunkt i databasen.`,
        }
      }
      if (failed > 0) {
        return {
          ok: true,
          sent,
          error: `${failed} av ${sent + failed} deltakere fikk ikke e-post (mangler e-postadresse).`,
        }
      }
      return { ok: true, sent }
    },
    [supabase, meetings, detailMeetingId, detail, markInvitationSent],
  )

  // ── RSVP + substitute (L4) ────────────────────────────────────────────────

  const setRsvp: UseMeetingsState['setRsvp'] = useCallback(
    async (input) => {
      if (!supabase) return false
      const res = await supabase
        .from('meeting_attendees')
        .update({
          rsvp_status: input.status,
          rsvp_reason: input.reason ?? null,
          rsvp_responded_at: new Date().toISOString(),
        })
        .eq('meeting_id', input.meetingId)
        .eq('member_id', input.memberId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      if (detailMeetingId === input.meetingId) await loadDetail(input.meetingId)
      return true
    },
    [supabase, detailMeetingId, loadDetail],
  )

  const activateSubstitute: UseMeetingsState['activateSubstitute'] = useCallback(
    async (input) => {
      if (!supabase) return false
      const res = await supabase
        .from('meeting_attendees')
        .update({
          substitute_for_member_id: input.principalMemberId,
          substitute_activated_at: new Date().toISOString(),
          rsvp_status: 'accepted',
        })
        .eq('meeting_id', input.meetingId)
        .eq('member_id', input.substituteMemberId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      if (detailMeetingId === input.meetingId) await loadDetail(input.meetingId)
      return true
    },
    [supabase, detailMeetingId, loadDetail],
  )

  // ── Voting models + ballots (L2 + L3) ─────────────────────────────────────

  const setAgendaVotingModel: UseMeetingsState['setAgendaVotingModel'] = useCallback(
    async (agendaItemId, model) => {
      if (!supabase) return false
      const res = await supabase
        .from('meeting_agenda_items')
        .update({ voting_model: model })
        .eq('id', agendaItemId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      if (detailMeetingId) await loadDetail(detailMeetingId)
      return true
    },
    [supabase, detailMeetingId, loadDetail],
  )

  const castVote: UseMeetingsState['castVote'] = useCallback(
    async (input) => {
      if (!supabase) return false
      const res = await supabase
        .from('meeting_votes')
        .upsert(
          {
            agenda_item_id: input.agendaItemId,
            meeting_id: input.meetingId,
            member_id: input.memberId,
            ballot: input.ballot,
            side: input.side ?? null,
            is_pre_vote: input.isPreVote ?? false,
            cast_at: new Date().toISOString(),
          },
          { onConflict: 'agenda_item_id,member_id' },
        )
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      return true
    },
    [supabase],
  )

  const getVoteResult: UseMeetingsState['getVoteResult'] = useCallback(
    async (agendaItemId) => {
      if (!supabase) return null
      const res = await supabase.rpc('meeting_vote_result', { p_agenda_item_id: agendaItemId })
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return null
      }
      return (res.data ?? null) as MeetingVoteResult | null
    },
    [supabase],
  )

  const getParityCheck: UseMeetingsState['getParityCheck'] = useCallback(
    async (meetingId) => {
      if (!supabase) return null
      const res = await supabase.rpc('meeting_parity_check', { p_meeting_id: meetingId })
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return null
      }
      return (res.data ?? null) as MeetingParityCheck | null
    },
    [supabase],
  )

  // ── Live session + speaker queue (L1 + L13) ───────────────────────────────

  const startLiveSession: UseMeetingsState['startLiveSession'] = useCallback(
    async (meetingId) => {
      if (!supabase || !orgId) return false
      const res = await supabase
        .from('meeting_live_sessions')
        .upsert(
          {
            meeting_id: meetingId,
            organization_id: orgId,
            started_at: new Date().toISOString(),
            ended_at: null,
            elapsed_seconds: 0,
            paused: false,
          },
          { onConflict: 'meeting_id' },
        )
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      await supabase
        .from('meetings')
        .update({ status: 'in_progress' as MeetingStatus })
        .eq('id', meetingId)
      return true
    },
    [supabase, orgId],
  )

  const setLiveActiveItem: UseMeetingsState['setLiveActiveItem'] = useCallback(
    async (meetingId, agendaItemId) => {
      if (!supabase) return false
      const res = await supabase
        .from('meeting_live_sessions')
        .update({ active_agenda_item_id: agendaItemId })
        .eq('meeting_id', meetingId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      return true
    },
    [supabase],
  )

  const endLiveSession: UseMeetingsState['endLiveSession'] = useCallback(
    async (meetingId) => {
      if (!supabase) return false
      const res = await supabase
        .from('meeting_live_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('meeting_id', meetingId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      return true
    },
    [supabase],
  )

  const loadLiveSession: UseMeetingsState['loadLiveSession'] = useCallback(
    async (meetingId) => {
      if (!supabase) return null
      const res = await supabase
        .from('meeting_live_sessions')
        .select('*')
        .eq('meeting_id', meetingId)
        .maybeSingle()
      if (res.error || !res.data) return null
      const parsed = parseMeetingLiveSessionRow(res.data)
      return parsed.success ? parsed.data : null
    },
    [supabase],
  )

  const addSpeaker: UseMeetingsState['addSpeaker'] = useCallback(
    async (input) => {
      if (!supabase) return false
      // Compute next position in queue
      const posRes = await supabase
        .from('meeting_speaker_queue')
        .select('position')
        .eq('meeting_id', input.meetingId)
        .is('yielded_at', null)
        .order('position', { ascending: false })
        .limit(1)
      const nextPos = ((posRes.data?.[0] as { position?: number } | undefined)?.position ?? 0) + 1
      const res = await supabase.from('meeting_speaker_queue').insert({
        meeting_id: input.meetingId,
        agenda_item_id: input.agendaItemId,
        member_id: input.memberId,
        position: nextPos,
        topic: input.topic ?? null,
      })
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      return true
    },
    [supabase],
  )

  const giveSpeakerFloor: UseMeetingsState['giveSpeakerFloor'] = useCallback(
    async (speakerId) => {
      if (!supabase) return false
      const res = await supabase
        .from('meeting_speaker_queue')
        .update({ given_floor_at: new Date().toISOString() })
        .eq('id', speakerId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      return true
    },
    [supabase],
  )

  const yieldSpeaker: UseMeetingsState['yieldSpeaker'] = useCallback(
    async (speakerId) => {
      if (!supabase) return false
      const res = await supabase
        .from('meeting_speaker_queue')
        .update({ yielded_at: new Date().toISOString() })
        .eq('id', speakerId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      return true
    },
    [supabase],
  )

  const loadSpeakerQueue: UseMeetingsState['loadSpeakerQueue'] = useCallback(
    async (meetingId) => {
      if (!supabase) return []
      const res = await supabase
        .from('meeting_speaker_queue')
        .select('*')
        .eq('meeting_id', meetingId)
        .is('yielded_at', null)
        .order('position', { ascending: true })
      if (res.error) return []
      return collect(res.data, parseMeetingSpeakerQueueRow)
    },
    [supabase],
  )

  // ── External invitees + digest (L8 + L11) ─────────────────────────────────

  const addExternalInvitee: UseMeetingsState['addExternalInvitee'] = useCallback(
    async (input) => {
      if (!supabase || !orgId) return null
      // 128 bits of entropy via getRandomValues. Encoded as 32 hex chars
      // so the URL stays short and human-shareable while resisting
      // birthday-collision + brute-force across realistic time windows.
      const tokenBytes = new Uint8Array(16)
      crypto.getRandomValues(tokenBytes)
      const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, '0')).join('')
      const res = await supabase
        .from('meeting_external_invitees')
        .insert({
          meeting_id: input.meetingId,
          organization_id: orgId,
          name: input.name,
          email: input.email ?? null,
          role: input.role ?? null,
          access_level: input.accessLevel ?? 'observer',
          org_affiliation: input.orgAffiliation ?? null,
          secure_token: token,
          expires_at: input.expiresAt ?? null,
        })
        .select('*')
        .single()
      if (res.error || !res.data) {
        setError(getSupabaseErrorMessage(res.error))
        return null
      }
      const parsed = parseMeetingExternalInviteeRow(res.data)
      return parsed.success ? parsed.data : null
    },
    [supabase, orgId],
  )

  const loadExternalInvitees: UseMeetingsState['loadExternalInvitees'] = useCallback(
    async (meetingId) => {
      if (!supabase) return []
      const res = await supabase
        .from('meeting_external_invitees')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true })
      if (res.error) return []
      return collect(res.data, parseMeetingExternalInviteeRow)
    },
    [supabase],
  )

  const upsertDigestRecipient: UseMeetingsState['upsertDigestRecipient'] = useCallback(
    async (input) => {
      if (!supabase || !orgId) return false
      const row = {
        ...(input.id ? { id: input.id } : {}),
        meeting_id: input.meetingId,
        organization_id: orgId,
        name: input.name,
        recipient_filter: input.recipientFilter ?? {},
        extract_mode: input.extractMode ?? 'full',
        default_selected: input.defaultSelected ?? false,
        law_ref: input.lawRef ?? null,
      }
      const res = await supabase
        .from('meeting_digest_recipients')
        .upsert(row, { onConflict: 'id' })
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      return true
    },
    [supabase, orgId],
  )

  const loadDigestRecipients: UseMeetingsState['loadDigestRecipients'] = useCallback(
    async (meetingId) => {
      if (!supabase) return []
      const res = await supabase
        .from('meeting_digest_recipients')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true })
      if (res.error) return []
      return collect(res.data, parseMeetingDigestRecipientRow)
    },
    [supabase],
  )

  // ── Admin: org template settings + categories ─────────────────────────────

  const upsertSetting = useCallback(
    async (
      systemTemplateId: string,
      patch: Partial<MeetingOrgTemplateSettingRow>,
    ): Promise<boolean> => {
      if (!supabase || !orgId) return false
      const existing = await loadOrgSettingsRow(supabase, orgId, systemTemplateId)
      const baseRow = existing ?? {
        organization_id: orgId,
        system_template_id: systemTemplateId,
        enabled: true,
        nav_pinned: false,
        position: 100,
        category_id: null,
        override_name: null,
        override_description: null,
        override_definition: null,
        override_metadata_schema: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const next = { ...baseRow, ...patch }
      const res = await supabase
        .from('meeting_org_template_settings')
        .upsert(next, { onConflict: 'organization_id,system_template_id' })
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      await loadList()
      return true
    },
    [supabase, orgId, loadList],
  )

  const setTemplateEnabled = useCallback(
    (id: string, enabled: boolean) => upsertSetting(id, { enabled }),
    [upsertSetting],
  )
  const setTemplateCategory = useCallback(
    (id: string, categoryId: string | null) => upsertSetting(id, { category_id: categoryId }),
    [upsertSetting],
  )
  const setTemplatePinned = useCallback(
    (id: string, navPinned: boolean) => upsertSetting(id, { nav_pinned: navPinned }),
    [upsertSetting],
  )
  const renameTemplate = useCallback(
    (id: string, overrideName: string | null) => upsertSetting(id, { override_name: overrideName }),
    [upsertSetting],
  )

  const upsertCategory: UseMeetingsState['upsertCategory'] = useCallback(
    async (input) => {
      if (!supabase || !orgId) return null
      const row = {
        ...(input.id ? { id: input.id } : {}),
        organization_id: orgId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        position: input.position ?? 100,
        is_active: true,
      }
      const res = await supabase
        .from('meeting_template_categories')
        .upsert(row, { onConflict: 'organization_id,slug' })
        .select('*')
        .single()
      if (res.error || !res.data) {
        setError(getSupabaseErrorMessage(res.error))
        return null
      }
      const parsed = parseMeetingCategoryRow(res.data)
      if (!parsed.success) return null
      await loadList()
      return parsed.data
    },
    [supabase, orgId, loadList],
  )

  // ── Admin: org-custom meeting templates (full CRUD) ───────────────────────

  const upsertOrgTemplate: UseMeetingsState['upsertOrgTemplate'] = useCallback(
    async (input) => {
      if (!supabase || !orgId) return null
      const baseRow = {
        organization_id: orgId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        category_id: input.categoryId ?? null,
        framework: input.framework,
        frameworks: input.frameworks ?? [input.framework],
        law_refs: input.lawRefs ?? [],
        cadence_hint: input.cadenceHint ?? null,
        default_duration_minutes: input.defaultDurationMinutes ?? null,
        default_confidentiality_level: input.defaultConfidentialityLevel ?? 'standard',
        minimum_employee_count: input.minimumEmployeeCount ?? null,
        definition: input.definition,
        metadata_schema: input.metadataSchema ?? { fields: [] },
        nav_pinned: input.navPinned ?? false,
        is_active: input.isActive ?? true,
      }
      const row = input.id ? { id: input.id, ...baseRow } : baseRow
      const res = await supabase
        .from('meeting_org_templates')
        .upsert(row, { onConflict: input.id ? 'id' : 'organization_id,slug' })
        .select('*')
        .single()
      if (res.error || !res.data) {
        setError(getSupabaseErrorMessage(res.error))
        return null
      }
      const parsed = parseMeetingOrgTemplateRow(res.data)
      if (!parsed.success) return null
      await loadList()
      return parsed.data
    },
    [supabase, orgId, loadList],
  )

  const deleteOrgTemplate: UseMeetingsState['deleteOrgTemplate'] = useCallback(
    async (id) => {
      if (!supabase) return false
      // Soft delete via deleted_at so analytics keep referencing the row.
      const res = await supabase
        .from('meeting_org_templates')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', id)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      await loadList()
      return true
    },
    [supabase, loadList],
  )

  // ── Agenda builder ───────────────────────────────────────────────────────

  const addAgendaItem: UseMeetingsState['addAgendaItem'] = useCallback(
    async (input) => {
      if (!supabase) return null
      // Compute position: max(position) + 10, or insertAfterPosition + 5 when
      // provided. Sparse positions avoid re-numbering on every insert.
      const existing = detail.agendaItems.filter((a) => a.meeting_id === input.meetingId)
      let position: number
      if (typeof input.insertAfterPosition === 'number') {
        position = input.insertAfterPosition + 5
      } else if (existing.length === 0) {
        position = 0
      } else {
        position = Math.max(...existing.map((a) => a.position)) + 10
      }
      const insertRow = {
        meeting_id: input.meetingId,
        position,
        template_item_key: null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        law_ref: input.lawRef?.trim() || null,
        is_mandatory: false,
        is_manual: true,
        duration_minutes: input.durationMinutes ?? null,
        presenter_member_id: input.presenterMemberId ?? null,
      }
      const ins = await supabase
        .from('meeting_agenda_items')
        .insert(insertRow)
        .select('*')
        .single()
      if (ins.error || !ins.data) {
        setError(getSupabaseErrorMessage(ins.error))
        return null
      }
      const parsed = parseMeetingAgendaItemRow(ins.data)
      if (!parsed.success) return null
      // Append to local detail state.
      setDetail((prev) =>
        prev.meeting?.id === input.meetingId
          ? { ...prev, agendaItems: [...prev.agendaItems, parsed.data] }
          : prev,
      )
      return parsed.data
    },
    [supabase, detail.agendaItems],
  )

  const updateAgendaItem: UseMeetingsState['updateAgendaItem'] = useCallback(
    async (id, patch) => {
      if (!supabase) return false
      const dbPatch: Record<string, unknown> = {}
      if (patch.title !== undefined) dbPatch.title = patch.title.trim()
      if (patch.description !== undefined)
        dbPatch.description = patch.description?.trim() || null
      if (patch.lawRef !== undefined) dbPatch.law_ref = patch.lawRef?.trim() || null
      if (patch.durationMinutes !== undefined) dbPatch.duration_minutes = patch.durationMinutes
      if (patch.presenterMemberId !== undefined)
        dbPatch.presenter_member_id = patch.presenterMemberId
      if (Object.keys(dbPatch).length === 0) return true
      const res = await supabase.from('meeting_agenda_items').update(dbPatch).eq('id', id)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      setDetail((prev) => ({
        ...prev,
        agendaItems: prev.agendaItems.map((a) =>
          a.id === id
            ? {
                ...a,
                ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
                ...(patch.description !== undefined
                  ? { description: patch.description?.trim() || null }
                  : {}),
                ...(patch.lawRef !== undefined ? { law_ref: patch.lawRef?.trim() || null } : {}),
                ...(patch.durationMinutes !== undefined
                  ? { duration_minutes: patch.durationMinutes }
                  : {}),
                ...(patch.presenterMemberId !== undefined
                  ? { presenter_member_id: patch.presenterMemberId }
                  : {}),
              }
            : a,
        ),
      }))
      return true
    },
    [supabase],
  )

  const removeAgendaItem: UseMeetingsState['removeAgendaItem'] = useCallback(
    async (id) => {
      if (!supabase) return false
      const target = detail.agendaItems.find((a) => a.id === id)
      if (target?.is_mandatory) {
        setError('Kan ikke slette en obligatorisk sak.')
        return false
      }
      const res = await supabase.from('meeting_agenda_items').delete().eq('id', id)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      setDetail((prev) => ({
        ...prev,
        agendaItems: prev.agendaItems.filter((a) => a.id !== id),
      }))
      return true
    },
    [supabase, detail.agendaItems],
  )

  const reorderAgendaItems: UseMeetingsState['reorderAgendaItems'] = useCallback(
    async (meetingId, orderedIds) => {
      if (!supabase) return false
      // Batch updates — sparse positions (steps of 10) so subsequent
      // single-item reorders stay cheap.
      const updates = orderedIds.map((id, idx) =>
        supabase!.from('meeting_agenda_items').update({ position: idx * 10 }).eq('id', id),
      )
      const results = await Promise.all(updates)
      const firstError = results.find((r) => r.error)
      if (firstError?.error) {
        setError(getSupabaseErrorMessage(firstError.error))
        return false
      }
      setDetail((prev) =>
        prev.meeting?.id === meetingId
          ? {
              ...prev,
              agendaItems: orderedIds
                .map((id, idx) => {
                  const found = prev.agendaItems.find((a) => a.id === id)
                  return found ? { ...found, position: idx * 10 } : null
                })
                .filter((a): a is MeetingAgendaItemRow => a !== null),
            }
          : prev,
      )
      return true
    },
    [supabase],
  )

  // ── Reporting period ─────────────────────────────────────────────────────

  const updateMeetingPeriod: UseMeetingsState['updateMeetingPeriod'] = useCallback(
    async (id, period) => {
      if (!supabase) return false
      const res = await supabase
        .from('meetings')
        .update({
          reporting_period_start: period.start,
          reporting_period_end: period.end,
          reporting_period_label: period.label,
        })
        .eq('id', id)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                reporting_period_start: period.start,
                reporting_period_end: period.end,
                reporting_period_label: period.label,
              }
            : m,
        ),
      )
      setDetail((prev) =>
        prev.meeting?.id === id
          ? {
              ...prev,
              meeting: {
                ...prev.meeting,
                reporting_period_start: period.start,
                reporting_period_end: period.end,
                reporting_period_label: period.label,
              },
            }
          : prev,
      )
      return true
    },
    [supabase],
  )

  // ── Binding snapshots ───────────────────────────────────────────────────

  const writeBindingSnapshot: UseMeetingsState['writeBindingSnapshot'] = useCallback(
    async (agendaItemId, snapshot) => {
      if (!supabase) return false
      const res = await supabase
        .from('meeting_agenda_items')
        .update({ binding_snapshot: snapshot })
        .eq('id', agendaItemId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      setDetail((prev) => ({
        ...prev,
        agendaItems: prev.agendaItems.map((a) =>
          a.id === agendaItemId ? { ...a, binding_snapshot: snapshot } : a,
        ),
      }))
      return true
    },
    [supabase],
  )

  // ── Attachments ──────────────────────────────────────────────────────────

  const addAttachment: UseMeetingsState['addAttachment'] = useCallback(
    async (agendaItemId, wikiPageId) => {
      if (!supabase) return false
      const res = await supabase.from('meeting_agenda_attachments').insert({
        agenda_item_id: agendaItemId,
        wiki_page_id: wikiPageId,
      })
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      return true
    },
    [supabase],
  )

  const removeAttachment: UseMeetingsState['removeAttachment'] = useCallback(
    async (attachmentId) => {
      if (!supabase) return false
      const res = await supabase
        .from('meeting_agenda_attachments')
        .delete()
        .eq('id', attachmentId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      return true
    },
    [supabase],
  )

  const listAttachments: UseMeetingsState['listAttachments'] = useCallback(
    async (agendaItemId) => {
      if (!supabase) return []
      const res = await supabase
        .from('meeting_agenda_attachments')
        .select('*')
        .eq('agenda_item_id', agendaItemId)
        .order('position', { ascending: true })
      if (res.error || !res.data) return []
      return collect(res.data, parseMeetingAgendaAttachmentRow)
    },
    [supabase],
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    loading,
    error,
    orgId,
    canManage,
    templates,
    systemTemplates,
    orgSettings,
    orgTemplates,
    categories,
    meetings,
    detail,
    detailLoading,
    detailMeetingId,
    loadList,
    loadDetail,
    clearDetail,
    createMeeting,
    updateMeeting,
    setAgendaMinutes,
    upsertAttendee,
    addActionItem,
    setActionItemStatus,
    signProtocol,
    markInvitationSent,
    sendInvitations,
    setRsvp,
    activateSubstitute,
    setAgendaVotingModel,
    castVote,
    getVoteResult,
    getParityCheck,
    startLiveSession,
    setLiveActiveItem,
    endLiveSession,
    loadLiveSession,
    addSpeaker,
    giveSpeakerFloor,
    yieldSpeaker,
    loadSpeakerQueue,
    addExternalInvitee,
    loadExternalInvitees,
    upsertDigestRecipient,
    loadDigestRecipients,
    setTemplateEnabled,
    setTemplateCategory,
    setTemplatePinned,
    renameTemplate,
    upsertCategory,
    upsertOrgTemplate,
    deleteOrgTemplate,
    refresh,
    clearError,
    addAgendaItem,
    updateAgendaItem,
    removeAgendaItem,
    reorderAgendaItems,
    updateMeetingPeriod,
    writeBindingSnapshot,
    addAttachment,
    removeAttachment,
    listAttachments,
  }
}
