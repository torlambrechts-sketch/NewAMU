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
  parseMeetingAgendaItemRow,
  parseMeetingAttendeeRow,
  parseMeetingCategoryRow,
  parseMeetingDecisionRow,
  parseMeetingOrgTemplateRow,
  parseMeetingOrgTemplateSettingRow,
  parseMeetingRow,
  parseMeetingSignatureRow,
  parseMeetingSystemTemplateRow,
} from './types'

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
}

export type MeetingDetail = {
  meeting: MeetingRow | null
  agendaItems: MeetingAgendaItemRow[]
  attendees: MeetingAttendeeRow[]
  decisions: MeetingDecisionRow[]
  actionItems: MeetingActionItemRow[]
  signatures: MeetingSignatureRow[]
}

const EMPTY_DETAIL: MeetingDetail = {
  meeting: null,
  agendaItems: [],
  attendees: [],
  decisions: [],
  actionItems: [],
  signatures: [],
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
    definition: MeetingTemplateDefinition
    metadataSchema?: TemplateMetadataSchema
    navPinned?: boolean
    isActive?: boolean
  }) => Promise<MeetingOrgTemplateRow | null>
  deleteOrgTemplate: (id: string) => Promise<boolean>
  refresh: () => Promise<void>
  clearError: () => void
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
  return JSON.parse(JSON.stringify(template.definition)) as MeetingTemplateDefinition
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
        setDetail({
          meeting: meetingParsed.success ? meetingParsed.data : null,
          agendaItems: collect(aiRes.data, parseMeetingAgendaItemRow),
          attendees: collect(atRes.data, parseMeetingAttendeeRow),
          decisions: collect(dRes.data, parseMeetingDecisionRow),
          actionItems: collect(acRes.data, parseMeetingActionItemRow),
          signatures: collect(sRes.data, parseMeetingSignatureRow),
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
            position: idx,
            template_item_key: item.key,
            title: item.title,
            description: item.description ?? null,
            law_ref: item.lawRef ?? null,
            is_mandatory: item.isMandatory,
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
      if (detail.meeting) {
        if (patch.decisionText) {
          const existing = await supabase
            .from('meeting_decisions')
            .select('id')
            .eq('agenda_item_id', agendaItemId)
            .limit(1)
            .maybeSingle()
          if (existing.data?.id) {
            await supabase
              .from('meeting_decisions')
              .update({
                decision_text: patch.decisionText,
                status: (patch.decisionStatus ?? 'open') as MeetingDecisionStatus,
              })
              .eq('id', existing.data.id)
          } else {
            await supabase.from('meeting_decisions').insert({
              meeting_id: detail.meeting.id,
              agenda_item_id: agendaItemId,
              decision_text: patch.decisionText,
              status: (patch.decisionStatus ?? 'open') as MeetingDecisionStatus,
            })
          }
        } else if (patch.decisionText === null) {
          await supabase
            .from('meeting_decisions')
            .delete()
            .eq('agenda_item_id', agendaItemId)
        }
      }
      if (detailMeetingId) await loadDetail(detailMeetingId)
      return true
    },
    [supabase, detail.meeting, detailMeetingId, loadDetail],
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
      const sigIns = await supabase.from('meeting_signatures').insert({
        meeting_id: input.meetingId,
        signer_member_id: input.signerMemberId ?? null,
        signer_name: input.signerName,
        signer_role: input.signerRole,
        signed_at: now,
        is_legally_binding: false,
      })
      if (sigIns.error) {
        setError(getSupabaseErrorMessage(sigIns.error))
        return false
      }
      // Stamp the meeting itself with protocol_signed_at if not already set.
      const mres = await supabase
        .from('meetings')
        .update({
          status: 'completed' as MeetingStatus,
          completed_at: now,
          protocol_signed_at: now,
          protocol_signed_by: input.signerMemberId ?? null,
        })
        .eq('id', input.meetingId)
        .is('protocol_signed_at', null)
      if (mres.error) {
        // Ignore — trigger may reject if already signed; that's fine.
      }
      if (detailMeetingId === input.meetingId) await loadDetail(input.meetingId)
      await loadList()
      return true
    },
    [supabase, detailMeetingId, loadDetail, loadList],
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
    setTemplateEnabled,
    setTemplateCategory,
    setTemplatePinned,
    renameTemplate,
    upsertCategory,
    upsertOrgTemplate,
    deleteOrgTemplate,
    refresh,
    clearError,
  }
}
