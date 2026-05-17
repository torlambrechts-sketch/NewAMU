// Main alerts hook — owns the read + write surface for the Varslinger module.
//
// One hook owns: system templates + org settings + org templates + categories
// + cases list + per-case detail (notes/attachments/timeline). Mutations are
// scoped to what the UI needs and forwards them with the lock-trigger
// constraints in mind (identity columns immutable from insert; title +
// description immutable post-close).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import {
  parseCaseNoteRow,
  parseCaseRow,
  parseCategoryRow,
  parseOrgTemplateRow,
  parseOrgTemplateSettingRow,
  parseSystemTemplateRow,
  parseTimelineEventRow,
  parseAttachmentRow,
} from './types'
import type {
  AlertCaseAttachmentRow,
  AlertCaseNoteRow,
  AlertCaseRow,
  AlertCaseTimelineEventRow,
  AlertCategoryRow,
  AlertClosingOutcome,
  AlertNoteKind,
  AlertOrgTemplateRow,
  AlertOrgTemplateSettingRow,
  AlertSeverity,
  AlertStatus,
  AlertSystemTemplateRow,
  ResolvedAlertTemplate,
} from './types'

function nonNull<T>(rows: Array<T | null>): T[] {
  return rows.filter((r): r is T => r !== null)
}

export type CreateAlertCaseInput = {
  templateId: string
  templateKind: 'system' | 'org'
  /** Optional kind hint. The before-insert DB trigger derives the
   *  authoritative value from the template, so this is purely for
   *  optimistic client state. Falls back to 'whistleblowing'. */
  kind?: import('./types').AlertKind
  title: string
  description: string
  isAnonymous?: boolean
  reporterContact?: string | null
  occurredAtText?: string | null
  categoryId?: string | null
  metadata?: Record<string, unknown>
}

export type AlertCaseDetail = {
  caseRow: AlertCaseRow | null
  notes: AlertCaseNoteRow[]
  attachments: AlertCaseAttachmentRow[]
  timeline: AlertCaseTimelineEventRow[]
}

const EMPTY_DETAIL: AlertCaseDetail = {
  caseRow: null,
  notes: [],
  attachments: [],
  timeline: [],
}

export type UseAlertsState = {
  orgId: string | null
  loading: boolean
  error: string | null
  canManage: boolean
  isDpo: boolean
  isCommitteeConfidential: boolean
  isCommitteeEscalated: boolean
  systemTemplates: AlertSystemTemplateRow[]
  orgSettings: AlertOrgTemplateSettingRow[]
  orgTemplates: AlertOrgTemplateRow[]
  categories: AlertCategoryRow[]
  cases: AlertCaseRow[]
  resolvedTemplates: ResolvedAlertTemplate[]
  detail: AlertCaseDetail
  detailLoading: boolean
  detailCaseId: string | null
  reload: () => Promise<void>
  loadDetail: (caseId: string) => Promise<void>
  createCase: (input: CreateAlertCaseInput) => Promise<{ id: string; accessKey: string } | null>
  addNote: (caseId: string, body: string, opts?: { noteKind?: AlertNoteKind; visibleToReporter?: boolean }) => Promise<AlertCaseNoteRow | null>
  setStatus: (caseId: string, status: AlertStatus) => Promise<boolean>
  setSeverity: (caseId: string, severity: AlertSeverity | null) => Promise<boolean>
  setAssignedCommittee: (caseId: string, memberIds: string[]) => Promise<boolean>
  setCategory: (caseId: string, categoryId: string | null) => Promise<boolean>
  setOrgContext: (caseId: string, ctx: { locationId?: string | null; departmentId?: string | null; teamId?: string | null }) => Promise<boolean>
  closeCase: (caseId: string, args: { closingSummary: string; closingOutcome: AlertClosingOutcome }) => Promise<boolean>
  reopenCase: (caseId: string) => Promise<boolean>
  upsertOrgTemplateSetting: (input: { systemTemplateId: string; enabled?: boolean; navPinned?: boolean; categoryId?: string | null; overrideName?: string | null; overrideRetentionYears?: number | null }) => Promise<boolean>
  upsertCategory: (input: { id?: string; slug: string; name: string; description?: string | null; position?: number; isActive?: boolean }) => Promise<AlertCategoryRow | null>
  softDeleteCategory: (id: string) => Promise<boolean>
  uploadAttachment: (caseId: string, file: File) => Promise<AlertCaseAttachmentRow | null>
  getAttachmentSignedUrl: (path: string, ttlSeconds?: number) => Promise<string | null>
  deleteAttachment: (attachmentId: string) => Promise<boolean>
}

function resolveTemplates(
  system: AlertSystemTemplateRow[],
  settings: AlertOrgTemplateSettingRow[],
  orgTemplates: AlertOrgTemplateRow[],
  categories: AlertCategoryRow[]
): ResolvedAlertTemplate[] {
  const settingsByTpl = new Map(settings.map((s) => [s.system_template_id, s]))
  const out: ResolvedAlertTemplate[] = []
  for (const t of system) {
    const s = settingsByTpl.get(t.id)
    if (s && s.enabled === false) continue
    out.push({
      kind: 'system',
      id: t.id,
      slug: t.slug,
      templateKind: t.kind,
      name: s?.override_name ?? t.label,
      description: s?.override_description ?? t.description ?? null,
      frameworks: t.frameworks,
      lawRefs: t.law_refs,
      defaultCategorySlug: t.default_category_slug,
      categoryId: s?.category_id ?? (categories.find((c) => c.slug === t.default_category_slug)?.id ?? null),
      defaultConfidentialityLevel: t.default_confidentiality_level,
      retentionYears: s?.override_retention_years ?? t.default_retention_years,
      acknowledgementDueDays: t.acknowledgement_due_days,
      investigationDueDays: t.investigation_due_days,
      requiresDpo: t.requires_dpo,
      allowsAnonymous: t.allows_anonymous,
      navPinned: s?.nav_pinned ?? true,
      position: s?.position ?? t.sort_order,
      enabled: s?.enabled ?? true,
      definition: s?.override_definition ?? t.definition,
      metadataSchema: s?.override_metadata_schema ?? t.metadata_schema,
    })
  }
  for (const ot of orgTemplates) {
    if (!ot.is_active || ot.deleted_at) continue
    out.push({
      kind: 'org',
      id: ot.id,
      slug: ot.slug,
      templateKind: ot.kind,
      name: ot.name,
      description: ot.description,
      frameworks: ot.frameworks,
      lawRefs: ot.law_refs,
      defaultCategorySlug: null,
      categoryId: ot.category_id,
      defaultConfidentialityLevel: ot.default_confidentiality_level,
      retentionYears: ot.default_retention_years,
      acknowledgementDueDays: ot.acknowledgement_due_days,
      investigationDueDays: ot.investigation_due_days,
      requiresDpo: ot.requires_dpo,
      allowsAnonymous: ot.allows_anonymous,
      navPinned: ot.nav_pinned,
      position: 1000,
      enabled: ot.is_active,
      definition: ot.definition,
      metadataSchema: ot.metadata_schema,
    })
  }
  out.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
  return out
}

export function useAlerts(): UseAlertsState {
  const { supabase, organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const canManage = isAdmin || can('alerts.manage') || can('alerts.committee')
  const isDpo = can('alerts.dpo')
  const isCommitteeConfidential = can('alerts.committee_confidential')
  const isCommitteeEscalated = can('alerts.committee_escalated')

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [systemTemplates, setSystemTemplates] = useState<AlertSystemTemplateRow[]>([])
  const [orgSettings, setOrgSettings] = useState<AlertOrgTemplateSettingRow[]>([])
  const [orgTemplates, setOrgTemplates] = useState<AlertOrgTemplateRow[]>([])
  const [categories, setCategories] = useState<AlertCategoryRow[]>([])
  const [cases, setCases] = useState<AlertCaseRow[]>([])
  const [detail, setDetail] = useState<AlertCaseDetail>(EMPTY_DETAIL)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailCaseId, setDetailCaseId] = useState<string | null>(null)
  const fetchedRef = useRef<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const [sys, settings, ot, cats, cs] = await Promise.all([
        supabase.from('alert_system_templates').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('alert_org_template_settings').select('*').eq('organization_id', orgId),
        supabase.from('alert_org_templates').select('*').eq('organization_id', orgId).is('deleted_at', null).order('name'),
        supabase.from('alert_template_categories').select('*').eq('organization_id', orgId).is('deleted_at', null).order('position'),
        supabase.from('alert_cases').select('*').eq('organization_id', orgId).order('received_at', { ascending: false }).limit(500),
      ])
      setSystemTemplates(nonNull((sys.data ?? []).map(parseSystemTemplateRow)))
      setOrgSettings(nonNull((settings.data ?? []).map(parseOrgTemplateSettingRow)))
      setOrgTemplates(nonNull((ot.data ?? []).map(parseOrgTemplateRow)))
      setCategories(nonNull((cats.data ?? []).map(parseCategoryRow)))
      setCases(nonNull((cs.data ?? []).map(parseCaseRow)))
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
    void reload()
  }, [supabase, orgId, reload])

  const loadDetail = useCallback(
    async (caseId: string) => {
      if (!supabase || !orgId) return
      setDetailLoading(true)
      setDetailCaseId(caseId)
      try {
        const [c, n, a, t] = await Promise.all([
          supabase.from('alert_cases').select('*').eq('id', caseId).maybeSingle(),
          supabase.from('alert_case_notes').select('*').eq('case_id', caseId).order('created_at'),
          supabase.from('alert_case_attachments').select('*').eq('case_id', caseId).order('created_at'),
          supabase.from('alert_case_timeline_events').select('*').eq('case_id', caseId).order('created_at'),
        ])
        setDetail({
          caseRow: c.data ? parseCaseRow(c.data) : null,
          notes: nonNull((n.data ?? []).map(parseCaseNoteRow)),
          attachments: nonNull((a.data ?? []).map(parseAttachmentRow)),
          timeline: nonNull((t.data ?? []).map(parseTimelineEventRow)),
        })
      } catch (e) {
        setError(getSupabaseErrorMessage(e))
      } finally {
        setDetailLoading(false)
      }
    },
    [supabase, orgId]
  )

  const createCase = useCallback(
    async (input: CreateAlertCaseInput) => {
      if (!supabase || !orgId) return null
      const payload: Record<string, unknown> = {
        organization_id: orgId,
        title: input.title,
        description: input.description,
        is_anonymous: input.isAnonymous ?? false,
        reporter_contact: input.reporterContact ?? null,
        occurred_at_text: input.occurredAtText ?? null,
        category_id: input.categoryId ?? null,
        metadata: input.metadata ?? {},
        source_kind: input.templateKind,
        // Authoritative value comes from the before-insert trigger which reads
        // template.kind; this is just a placeholder to satisfy NOT NULL.
        kind: input.kind ?? 'whistleblowing',
      }
      if (input.templateKind === 'system') payload.system_template_id = input.templateId
      else payload.org_template_id = input.templateId
      const res = await supabase.from('alert_cases').insert(payload).select('id,access_key').maybeSingle()
      if (res.error || !res.data) {
        setError(getSupabaseErrorMessage(res.error))
        return null
      }
      const timeline = supabase.from('alert_case_timeline_events').insert({
        case_id: res.data.id,
        organization_id: orgId,
        event_kind: 'submitted',
        actor_kind: 'committee',
        payload: { template_id: input.templateId },
      })
      void timeline
      await reload()
      return { id: res.data.id as string, accessKey: res.data.access_key as string }
    },
    [supabase, orgId, reload]
  )

  const addNote = useCallback(
    async (caseId: string, body: string, opts?: { noteKind?: AlertNoteKind; visibleToReporter?: boolean }) => {
      if (!supabase || !orgId) return null
      const res = await supabase
        .from('alert_case_notes')
        .insert({
          case_id: caseId,
          organization_id: orgId,
          body,
          note_kind: opts?.noteKind ?? 'internal',
          visible_to_reporter: opts?.visibleToReporter ?? false,
        })
        .select('*')
        .maybeSingle()
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return null
      }
      await supabase.from('alert_case_timeline_events').insert({
        case_id: caseId,
        organization_id: orgId,
        event_kind: opts?.visibleToReporter ? 'note_added_public' : 'note_added_internal',
        actor_kind: 'committee',
        payload: { note_kind: opts?.noteKind ?? 'internal' },
      })
      if (detailCaseId === caseId) await loadDetail(caseId)
      return res.data ? parseCaseNoteRow(res.data) : null
    },
    [supabase, orgId, detailCaseId, loadDetail]
  )

  const updateCase = useCallback(
    async (caseId: string, patch: Record<string, unknown>) => {
      if (!supabase || !orgId) return false
      const res = await supabase.from('alert_cases').update(patch).eq('id', caseId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      if (detailCaseId === caseId) await loadDetail(caseId)
      await reload()
      return true
    },
    [supabase, orgId, detailCaseId, loadDetail, reload]
  )

  const setStatus = useCallback(
    async (caseId: string, status: AlertStatus) => {
      const ok = await updateCase(caseId, { status, ...(status === 'triage' && !cases.find((c) => c.id === caseId)?.acknowledged_at ? { acknowledged_at: new Date().toISOString() } : {}) })
      if (ok && supabase && orgId) {
        await supabase.from('alert_case_timeline_events').insert({
          case_id: caseId,
          organization_id: orgId,
          event_kind: 'status_changed',
          actor_kind: 'committee',
          payload: { to: status },
        })
      }
      return ok
    },
    [updateCase, cases, supabase, orgId]
  )

  const setSeverity = useCallback(
    async (caseId: string, severity: AlertSeverity | null) => {
      const ok = await updateCase(caseId, { severity })
      if (ok && supabase && orgId) {
        await supabase.from('alert_case_timeline_events').insert({
          case_id: caseId, organization_id: orgId, event_kind: 'severity_set', actor_kind: 'committee', payload: { severity },
        })
      }
      return ok
    },
    [updateCase, supabase, orgId]
  )

  const setAssignedCommittee = useCallback(
    async (caseId: string, memberIds: string[]) =>
      updateCase(caseId, { assigned_committee_member_ids: memberIds }),
    [updateCase]
  )

  const setCategory = useCallback(
    async (caseId: string, categoryId: string | null) =>
      updateCase(caseId, { category_id: categoryId }),
    [updateCase]
  )

  const setOrgContext = useCallback(
    async (caseId, ctx) => {
      const patch: Record<string, unknown> = {}
      if (ctx.locationId !== undefined) patch.location_id = ctx.locationId
      if (ctx.departmentId !== undefined) patch.department_id = ctx.departmentId
      if (ctx.teamId !== undefined) patch.team_id = ctx.teamId
      return updateCase(caseId, patch)
    },
    [updateCase]
  ) as UseAlertsState['setOrgContext']

  const closeCase = useCallback(
    async (caseId: string, args: { closingSummary: string; closingOutcome: AlertClosingOutcome }) => {
      const ok = await updateCase(caseId, {
        status: 'closed',
        closed_at: new Date().toISOString(),
        closing_summary: args.closingSummary,
        closing_outcome: args.closingOutcome,
      })
      if (ok && supabase && orgId) {
        await supabase.from('alert_case_timeline_events').insert({
          case_id: caseId, organization_id: orgId, event_kind: 'closed', actor_kind: 'committee',
          payload: { outcome: args.closingOutcome },
        })
      }
      return ok
    },
    [updateCase, supabase, orgId]
  )

  const reopenCase = useCallback(
    async (caseId: string) => {
      // Lock trigger forbids closed_at→null on closed rows. To genuinely
      // reopen, the trigger would need a bypass — for now treat as no-op +
      // emit a 'reopened' timeline event noting the operator's intent.
      if (!supabase || !orgId) return false
      await supabase.from('alert_case_timeline_events').insert({
        case_id: caseId, organization_id: orgId, event_kind: 'reopened', actor_kind: 'committee',
        payload: { note: 'Reopen not yet supported — clone case instead' },
      })
      return true
    },
    [supabase, orgId]
  )

  const upsertOrgTemplateSetting = useCallback<UseAlertsState['upsertOrgTemplateSetting']>(
    async (input) => {
      if (!supabase || !orgId) return false
      const patch: Record<string, unknown> = { organization_id: orgId, system_template_id: input.systemTemplateId }
      if (input.enabled !== undefined) patch.enabled = input.enabled
      if (input.navPinned !== undefined) patch.nav_pinned = input.navPinned
      if (input.categoryId !== undefined) patch.category_id = input.categoryId
      if (input.overrideName !== undefined) patch.override_name = input.overrideName
      if (input.overrideRetentionYears !== undefined) patch.override_retention_years = input.overrideRetentionYears
      const res = await supabase
        .from('alert_org_template_settings')
        .upsert(patch, { onConflict: 'organization_id,system_template_id' })
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      await reload()
      return true
    },
    [supabase, orgId, reload]
  )

  const upsertCategory = useCallback<UseAlertsState['upsertCategory']>(
    async (input) => {
      if (!supabase || !orgId) return null
      const payload: Record<string, unknown> = {
        organization_id: orgId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
      }
      if (input.position !== undefined) payload.position = input.position
      if (input.isActive !== undefined) payload.is_active = input.isActive
      if (input.id) payload.id = input.id
      const res = await supabase
        .from('alert_template_categories')
        .upsert(payload, { onConflict: input.id ? 'id' : 'organization_id,slug' })
        .select('*')
        .maybeSingle()
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return null
      }
      await reload()
      return res.data ? parseCategoryRow(res.data) : null
    },
    [supabase, orgId, reload]
  )

  const softDeleteCategory = useCallback(
    async (id: string) => {
      if (!supabase || !orgId) return false
      const res = await supabase
        .from('alert_template_categories')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', id)
        .eq('organization_id', orgId)
      if (res.error) {
        setError(getSupabaseErrorMessage(res.error))
        return false
      }
      await reload()
      return true
    },
    [supabase, orgId, reload]
  )

  // ── Attachments ─────────────────────────────────────────────────────────
  // Path convention enforced by storage policy: <org_id>/<case_id>/<uuid>-<filename>.
  const uploadAttachment = useCallback<UseAlertsState['uploadAttachment']>(
    async (caseId, file) => {
      if (!supabase || !orgId) return null
      const ext = file.name.match(/\.[A-Za-z0-9]+$/)?.[0] ?? ''
      const stem = file.name
        .replace(ext, '')
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .slice(0, 60) || 'fil'
      const uuid = crypto.randomUUID()
      const path = `${orgId}/${caseId}/${uuid}-${stem}${ext}`
      try {
        const up = await supabase.storage
          .from('alert-attachments')
          .upload(path, file, {
            cacheControl: '3600',
            contentType: file.type || undefined,
            upsert: false,
          })
        if (up.error) throw up.error
        const ins = await supabase
          .from('alert_case_attachments')
          .insert({
            case_id: caseId,
            organization_id: orgId,
            storage_bucket: 'alert-attachments',
            storage_path: path,
            filename: file.name,
            content_type: file.type || null,
            size_bytes: file.size || null,
          })
          .select('*')
          .maybeSingle()
        if (ins.error) throw ins.error
        await supabase.from('alert_case_timeline_events').insert({
          case_id: caseId,
          organization_id: orgId,
          event_kind: 'attachment_added',
          actor_kind: 'committee',
          payload: { filename: file.name, size: file.size },
        })
        if (detailCaseId === caseId) await loadDetail(caseId)
        return ins.data ? parseAttachmentRow(ins.data) : null
      } catch (e) {
        setError(getSupabaseErrorMessage(e))
        return null
      }
    },
    [supabase, orgId, detailCaseId, loadDetail]
  )

  const getAttachmentSignedUrl = useCallback<UseAlertsState['getAttachmentSignedUrl']>(
    async (path, ttlSeconds = 60) => {
      if (!supabase || !path) return null
      const res = await supabase.storage.from('alert-attachments').createSignedUrl(path, ttlSeconds)
      if (res.error || !res.data) {
        setError(getSupabaseErrorMessage(res.error))
        return null
      }
      return res.data.signedUrl
    },
    [supabase]
  )

  const deleteAttachment = useCallback<UseAlertsState['deleteAttachment']>(
    async (attachmentId) => {
      if (!supabase || !orgId) return false
      const row = await supabase
        .from('alert_case_attachments')
        .select('case_id, storage_path')
        .eq('id', attachmentId)
        .maybeSingle()
      if (row.error || !row.data) {
        setError(getSupabaseErrorMessage(row.error))
        return false
      }
      if (row.data.storage_path) {
        await supabase.storage.from('alert-attachments').remove([row.data.storage_path])
      }
      const del = await supabase.from('alert_case_attachments').delete().eq('id', attachmentId)
      if (del.error) {
        setError(getSupabaseErrorMessage(del.error))
        return false
      }
      if (detailCaseId === row.data.case_id) await loadDetail(row.data.case_id)
      return true
    },
    [supabase, orgId, detailCaseId, loadDetail]
  )

  const resolvedTemplates = useMemo(
    () => resolveTemplates(systemTemplates, orgSettings, orgTemplates, categories),
    [systemTemplates, orgSettings, orgTemplates, categories]
  )

  return {
    orgId,
    loading,
    error,
    canManage,
    isDpo,
    isCommitteeConfidential,
    isCommitteeEscalated,
    systemTemplates,
    orgSettings,
    orgTemplates,
    categories,
    cases,
    resolvedTemplates,
    detail,
    detailLoading,
    detailCaseId,
    reload,
    loadDetail,
    createCase,
    addNote,
    setStatus,
    setSeverity,
    setAssignedCommittee,
    setCategory,
    setOrgContext,
    closeCase,
    reopenCase,
    upsertOrgTemplateSetting,
    upsertCategory,
    softDeleteCategory,
    uploadAttachment,
    getAttachmentSignedUrl,
    deleteAttachment,
  }
}
