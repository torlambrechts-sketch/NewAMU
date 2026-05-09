// Compliance Checklist primitive — single hook for all data + mutations.
// Per MODULE_SPEC.md §3 + AI_MODULE_SPEC.md §3: components do not call
// Supabase directly; all error handling routes through getSupabaseErrorMessage.
// Authorization: isAdmin || can('checklist.manage') gates every mutation.

import { useCallback, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAssignableUsers } from '../../src/hooks/useAssignableUsers'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type {
  ChecklistCommentRow,
  ChecklistDefinition,
  ChecklistScopeType,
  ComplianceAggregates,
  ComplianceAssignableUser,
  ComplianceCategoryRow,
  ComplianceExecutionRow,
  ComplianceResponseRow,
  CompliancePackSlug,
  ComplianceSeverity,
  ComplianceTemplateRow,
  TemplateMetadataSchema,
} from './types'
import {
  ChecklistCommentRowSchema,
  ComplianceCategoryRowSchema,
  ComplianceExecutionRowSchema,
  ComplianceResponseRowSchema,
  ComplianceTemplateRowSchema,
  parseChecklistDefinition,
  parseRows,
} from './schema'

type UseChecklistModuleInput = {
  supabase: SupabaseClient | null
}

export type ChecklistModuleState = {
  loading: boolean
  error: string | null
  currentUserId: string | null
  templates: ComplianceTemplateRow[]
  executions: ComplianceExecutionRow[]
  responsesByExecutionId: Record<string, ComplianceResponseRow[]>
  assignableUsers: ComplianceAssignableUser[]
  aggregates: ComplianceAggregates

  /** Comments keyed by execution_id, loaded on demand. */
  commentsByExecutionId: Record<string, ChecklistCommentRow[]>

  load: (filters?: { pack?: CompliancePackSlug; includeArchived?: boolean }) => Promise<void>
  loadDetail: (executionId: string) => Promise<void>
  reloadAggregates: (pack?: CompliancePackSlug, templateId?: string) => Promise<void>

  /** Load (or reload) comments for a single execution. */
  loadComments: (executionId: string) => Promise<void>

  /** Post a new comment. Returns the saved row, or null on error. */
  addComment: (payload: {
    executionId: string
    itemKey?: string
    body: string
    mentions?: string[]
  }) => Promise<ChecklistCommentRow | null>

  /** Edit body + mentions of an existing comment (author only). */
  updateComment: (payload: {
    commentId: string
    body: string
    mentions?: string[]
  }) => Promise<void>

  /** Delete a comment (author only). */
  deleteComment: (commentId: string, executionId: string) => Promise<void>

  createExecution: (payload: {
    templateId: string
    title: string
    scheduledFor?: string
    assignedTo?: string
  }) => Promise<string | null>

  saveResponse: (payload: {
    executionId: string
    itemKey: string
    value: unknown
    comment?: string
    severity?: ComplianceSeverity
  }) => Promise<void>

  signExecution: (executionId: string) => Promise<void>

  /** Archive a signed execution (one-way; cannot be undone). */
  archiveExecution: (executionId: string) => Promise<void>

  /**
   * Amend non-canonical metadata (title, summary, attendees, assignment,
   * schedule). Allowed even on signed executions — these fields don't feed
   * the sign_checksum digest.
   */
  updateExecutionMetadata: (payload: {
    executionId: string
    title?: string
    summary?: string | null
    attendees?: string[]
    assignedTo?: string | null
    scheduledFor?: string | null
    locationId?: string | null
    departmentId?: string | null
    teamId?: string | null
    participantMemberIds?: string[]
    /** Free-form per-template metadata bag (template.metadata_schema-driven). */
    metadata?: Record<string, unknown>
    /** Scope — what this checklist is about. */
    scopeType?: ChecklistScopeType | null
    scopeCatalogueItemLabel?: string | null
    scopeOtherLabel?: string | null
  }) => Promise<void>

  uploadResponseAttachment: (payload: {
    executionId: string
    itemKey: string
    file: File
  }) => Promise<string | null>

  removeResponseAttachment: (payload: {
    executionId: string
    itemKey: string
    storagePath: string
  }) => Promise<void>

  /** Sign a Supabase Storage path for inline display (e.g. <img src>). */
  signAttachmentUrl: (storagePath: string, ttlSeconds?: number) => Promise<string | null>

  // ── Template administration ──────────────────────────────────────────────

  createTemplate: (payload: {
    pack: CompliancePackSlug
    slug: string
    name: string
    description?: string
    definition?: ChecklistDefinition
  }) => Promise<string | null>

  updateTemplate: (payload: {
    templateId: string
    name?: string
    description?: string | null
    definition?: ChecklistDefinition
    nav_pinned?: boolean
    is_active?: boolean
    category_id?: string | null
    metadata_schema?: TemplateMetadataSchema
  }) => Promise<void>

  /** Soft delete (sets deleted_at). System rows are rejected by the DB trigger. */
  softDeleteTemplate: (templateId: string) => Promise<void>

  // ── Categories (per-org, per-pack groupings) ────────────────────────────

  /** Active categories for every licensed pack (deleted/inactive filtered out). */
  categories: ComplianceCategoryRow[]

  loadCategories: () => Promise<void>

  createCategory: (payload: {
    pack: CompliancePackSlug
    slug: string
    name: string
    description?: string | null
    position?: number
  }) => Promise<string | null>

  updateCategory: (payload: {
    categoryId: string
    name?: string
    description?: string | null
    position?: number
    is_active?: boolean
  }) => Promise<void>

  /** Soft delete. Templates with this category fall back to "Uten kategori" via FK ON DELETE SET NULL. */
  softDeleteCategory: (categoryId: string) => Promise<void>

  // ── Template ↔ requirement tagging ──────────────────────────────────────

  /** Cached requirement-id list per template, populated on demand. */
  requirementIdsByTemplateId: Record<string, string[]>

  loadTemplateRequirements: (templateId: string) => Promise<void>

  setTemplateRequirements: (
    templateId: string,
    requirementIds: string[],
  ) => Promise<void>
}

const ATTACHMENT_BUCKET = 'compliance_checklist_files'

const EMPTY_AGGREGATES: ComplianceAggregates = {
  totalExecutions: 0,
  openCount: 0,
  criticalFindings: 0,
  ytdCompleted: 0,
}

export function useChecklistModule(
  input: UseChecklistModuleInput,
): ChecklistModuleState {
  const { supabase } = input
  const { organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const canManage = isAdmin || can('checklist.manage')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<ComplianceTemplateRow[]>([])
  const [executions, setExecutions] = useState<ComplianceExecutionRow[]>([])
  const [responsesByExecutionId, setResponsesByExecutionId] = useState<
    Record<string, ComplianceResponseRow[]>
  >({})
  const [assignableUsers, setAssignableUsers] = useState<ComplianceAssignableUser[]>([])
  const [aggregates, setAggregates] = useState<ComplianceAggregates>(EMPTY_AGGREGATES)
  const [requirementIdsByTemplateId, setRequirementIdsByTemplateId] = useState<
    Record<string, string[]>
  >({})
  const [categories, setCategories] = useState<ComplianceCategoryRow[]>([])
  const [commentsByExecutionId, setCommentsByExecutionId] = useState<
    Record<string, ChecklistCommentRow[]>
  >({})

  // ── Aggregates (org-wide; fetched separately from paginated list) ────────

  const reloadAggregates = useCallback(
    async (pack?: CompliancePackSlug, templateId?: string) => {
      if (!supabase || !orgId) return
      try {
        // `templateId` is the strongest filter — when set we drop the pack
        // filter (template is already pack-scoped via FK).
        const execTable = () =>
          supabase
            .from('compliance_checklist_executions')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)

        const totalQ = templateId
          ? execTable().eq('template_id', templateId)
          : pack
          ? execTable().eq('pack', pack)
          : execTable()

        const openQ = (templateId
          ? execTable().eq('template_id', templateId)
          : pack
          ? execTable().eq('pack', pack)
          : execTable()
        ).in('status', ['draft', 'active'])

        const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
        const ytdQ = (templateId
          ? execTable().eq('template_id', templateId)
          : pack
          ? execTable().eq('pack', pack)
          : execTable()
        )
          .eq('status', 'signed')
          .gte('signed_at', yearStart)

        // Critical findings — when scoped to a single template we filter on
        // the exec's template_id via the inner join; for pack-only scope we
        // filter on the inner pack; with no filters we count org-wide.
        let critQ
        if (templateId) {
          critQ = supabase
            .from('compliance_checklist_responses')
            .select('*, compliance_checklist_executions!inner(template_id)', {
              count: 'exact',
              head: true,
            })
            .eq('organization_id', orgId)
            .eq('severity', 'critical')
            .eq('compliance_checklist_executions.template_id', templateId)
        } else if (pack) {
          critQ = supabase
            .from('compliance_checklist_responses')
            .select('*, compliance_checklist_executions!inner(pack)', {
              count: 'exact',
              head: true,
            })
            .eq('organization_id', orgId)
            .eq('severity', 'critical')
            .eq('compliance_checklist_executions.pack', pack)
        } else {
          critQ = supabase
            .from('compliance_checklist_responses')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .eq('severity', 'critical')
        }

        const [totalRes, openRes, ytdRes, critRes] = await Promise.all([
          totalQ,
          openQ,
          ytdQ,
          critQ,
        ])

        if (totalRes.error) throw totalRes.error
        if (openRes.error) throw openRes.error
        if (ytdRes.error) throw ytdRes.error
        if (critRes.error) throw critRes.error

        setAggregates({
          totalExecutions: totalRes.count ?? 0,
          openCount: openRes.count ?? 0,
          ytdCompleted: ytdRes.count ?? 0,
          criticalFindings: critRes.count ?? 0,
        })
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  // ── List load ────────────────────────────────────────────────────────────

  const load = useCallback(
    async (filters?: { pack?: CompliancePackSlug; includeArchived?: boolean }) => {
      if (!supabase || !orgId) return
      setLoading(true)
      setError(null)
      try {
        const userResp = await supabase.auth.getUser()
        const uid = userResp.data.user?.id ?? null
        setCurrentUserId(uid)

        let templatesQ = supabase
          .from('compliance_checklist_templates')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('name', { ascending: true })

        let executionsQ = supabase
          .from('compliance_checklist_executions')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('scheduled_for', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })

        const categoriesQ = supabase
          .from('compliance_checklist_categories')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('pack', { ascending: true })
          .order('position', { ascending: true })
          .order('name', { ascending: true })

        if (filters?.pack) {
          templatesQ = templatesQ.eq('pack', filters.pack)
          executionsQ = executionsQ.eq('pack', filters.pack)
        }
        if (!filters?.includeArchived) {
          executionsQ = executionsQ.is('archived_at', null)
        }

        const [templatesRes, executionsRes, categoriesRes, usersRes] = await Promise.all([
          templatesQ,
          executionsQ,
          categoriesQ,
          fetchAssignableUsers(supabase, orgId),
        ])

        if (templatesRes.error) throw templatesRes.error
        if (executionsRes.error) throw executionsRes.error
        if (categoriesRes.error) throw categoriesRes.error

        const t = parseRows(templatesRes.data ?? [], ComplianceTemplateRowSchema)
        const e = parseRows(executionsRes.data ?? [], ComplianceExecutionRowSchema)
        const c = parseRows(categoriesRes.data ?? [], ComplianceCategoryRowSchema)
        setTemplates(t.ok)
        setExecutions(e.ok)
        setCategories(c.ok)
        setAssignableUsers(usersRes)

        const failed = t.failed + e.failed + c.failed
        if (failed > 0) {
          setError(`Kunne ikke tolke ${failed} rader fra databasen.`)
        }

        await reloadAggregates(filters?.pack)
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      } finally {
        setLoading(false)
      }
    },
    [supabase, orgId, reloadAggregates],
  )

  // ── Detail load (responses for one execution) ────────────────────────────

  const loadDetail = useCallback(
    async (executionId: string) => {
      if (!supabase || !orgId) return
      setError(null)
      try {
        const { data, error: respErr } = await supabase
          .from('compliance_checklist_responses')
          .select('*')
          .eq('organization_id', orgId)
          .eq('execution_id', executionId)
          .order('created_at', { ascending: true })
        if (respErr) throw respErr

        const parsed = parseRows(data ?? [], ComplianceResponseRowSchema)
        setResponsesByExecutionId((prev) => ({
          ...prev,
          [executionId]: parsed.ok,
        }))
        if (parsed.failed > 0) {
          setError(`Kunne ikke tolke ${parsed.failed} svar.`)
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  // ── Mutations ────────────────────────────────────────────────────────────

  const createExecution = useCallback(
    async (payload: {
      templateId: string
      title: string
      scheduledFor?: string
      assignedTo?: string
    }): Promise<string | null> => {
      if (!supabase || !orgId) return null
      if (!canManage) {
        setError('Du har ikke tilgang til å opprette sjekklister.')
        return null
      }
      setError(null)

      const template = templates.find((t) => t.id === payload.templateId)
      if (!template) {
        setError('Mal ikke funnet.')
        return null
      }

      try {
        const { data, error: insErr } = await supabase
          .from('compliance_checklist_executions')
          .insert({
            template_id: payload.templateId,
            // pack is set by BEFORE INSERT trigger from template; passed for clarity.
            pack: template.pack,
            title: payload.title,
            status: 'draft',
            scheduled_for: payload.scheduledFor ?? null,
            assigned_to: payload.assignedTo ?? null,
          })
          .select('*')
          .single()
        if (insErr) throw insErr

        const parsed = ComplianceExecutionRowSchema.safeParse(data)
        if (parsed.success) {
          setExecutions((prev) => [parsed.data, ...prev])
          await reloadAggregates(template.pack)
          return parsed.data.id
        }
        return null
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
        return null
      }
    },
    [supabase, orgId, canManage, templates, reloadAggregates],
  )

  const saveResponse = useCallback(
    async (payload: {
      executionId: string
      itemKey: string
      value: unknown
      comment?: string
      severity?: ComplianceSeverity
    }): Promise<void> => {
      if (!supabase || !orgId) return
      if (!canManage) {
        setError('Du har ikke tilgang til å besvare sjekklister.')
        return
      }
      setError(null)

      // Local immutability check: refuse to write to a signed execution.
      const exec = executions.find((e) => e.id === payload.executionId)
      if (exec?.status === 'signed') {
        setError('Sjekklisten er signert og kan ikke endres.')
        return
      }

      try {
        const { data, error: upErr } = await supabase
          .from('compliance_checklist_responses')
          .upsert(
            {
              execution_id: payload.executionId,
              item_key: payload.itemKey,
              value: payload.value as never,
              comment: payload.comment ?? null,
              severity: payload.severity ?? null,
            },
            { onConflict: 'execution_id,item_key' },
          )
          .select('*')
          .single()
        if (upErr) throw upErr

        const parsed = ComplianceResponseRowSchema.safeParse(data)
        if (!parsed.success) return

        setResponsesByExecutionId((prev) => {
          const list = prev[payload.executionId] ?? []
          const next = list.filter((r) => r.item_key !== payload.itemKey)
          next.push(parsed.data)
          return { ...prev, [payload.executionId]: next }
        })
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, canManage, executions],
  )

  const signExecution = useCallback(
    async (executionId: string): Promise<void> => {
      if (!supabase || !orgId) return
      if (!canManage) {
        setError('Du har ikke tilgang til å signere sjekklister.')
        return
      }
      setError(null)

      const exec = executions.find((e) => e.id === executionId)
      if (!exec) {
        setError('Sjekkliste ikke funnet.')
        return
      }
      if (exec.status === 'signed') {
        setError('Sjekklisten er allerede signert.')
        return
      }

      // Required-item validation: every required item must have a response.
      const template = templates.find((t) => t.id === exec.template_id)
      const def = parseChecklistDefinition(template?.definition)
      const responses = responsesByExecutionId[executionId] ?? []
      const responseKeys = new Set(responses.map((r) => r.item_key))
      const missing = def.items
        .filter((it) => it.required && !responseKeys.has(it.key))
        .map((it) => it.prompt)
      if (missing.length > 0) {
        setError(
          `Påkrevde punkter mangler svar: ${missing.slice(0, 3).join(', ')}${
            missing.length > 3 ? '…' : ''
          }`,
        )
        return
      }

      try {
        // The DB trigger sets signed_at, signed_by, definition_snapshot.
        const { data, error: upErr } = await supabase
          .from('compliance_checklist_executions')
          .update({ status: 'signed' })
          .eq('id', executionId)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr

        const parsed = ComplianceExecutionRowSchema.safeParse(data)
        if (parsed.success) {
          setExecutions((prev) =>
            prev.map((e) => (e.id === executionId ? parsed.data : e)),
          )
          await reloadAggregates(exec.pack)
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, canManage, executions, templates, responsesByExecutionId, reloadAggregates],
  )

  const archiveExecution = useCallback(
    async (executionId: string): Promise<void> => {
      if (!supabase || !orgId) return
      if (!canManage) {
        setError('Du har ikke tilgang til å arkivere sjekklister.')
        return
      }
      setError(null)

      const exec = executions.find((e) => e.id === executionId)
      if (!exec) {
        setError('Sjekkliste ikke funnet.')
        return
      }
      if (exec.status !== 'signed') {
        setError('Bare signerte sjekklister kan arkiveres.')
        return
      }
      if (exec.archived_at) {
        setError('Sjekklisten er allerede arkivert.')
        return
      }

      try {
        const { data, error: upErr } = await supabase
          .from('compliance_checklist_executions')
          .update({ archived_at: new Date().toISOString() })
          .eq('id', executionId)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr

        const parsed = ComplianceExecutionRowSchema.safeParse(data)
        if (parsed.success) {
          // Default load filters out archived; drop from local state.
          setExecutions((prev) => prev.filter((e) => e.id !== executionId))
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, canManage, executions],
  )

  // Amendable metadata. Allowed both pre- and post-sign — the BEFORE UPDATE
  // trigger keeps the canonical signed state (definition_snapshot, signed_at,
  // signed_by, sign_checksum, status going backward) locked, but lets these
  // soft fields flow through. Used for editing title / summary / attendees
  // on a finished checklist when the AMU realises a name was misspelled or
  // wants to add a late attendee.
  const updateExecutionMetadata = useCallback(
    async (payload: {
      executionId: string
      title?: string
      summary?: string | null
      attendees?: string[]
      assignedTo?: string | null
      scheduledFor?: string | null
      locationId?: string | null
      departmentId?: string | null
      teamId?: string | null
      participantMemberIds?: string[]
      metadata?: Record<string, unknown>
      scopeType?: ChecklistScopeType | null
      scopeCatalogueItemLabel?: string | null
      scopeOtherLabel?: string | null
    }): Promise<void> => {
      if (!supabase || !orgId) return
      if (!canManage) {
        setError('Du har ikke tilgang til å oppdatere sjekklister.')
        return
      }
      setError(null)

      const update: Record<string, unknown> = {}
      if (payload.title !== undefined) update.title = payload.title
      if (payload.summary !== undefined) update.summary = payload.summary
      if (payload.attendees !== undefined) update.attendees = payload.attendees
      if (payload.assignedTo !== undefined) update.assigned_to = payload.assignedTo
      if (payload.scheduledFor !== undefined) update.scheduled_for = payload.scheduledFor
      if (payload.locationId !== undefined) update.location_id = payload.locationId
      if (payload.departmentId !== undefined) update.department_id = payload.departmentId
      if (payload.teamId !== undefined) update.team_id = payload.teamId
      if (payload.participantMemberIds !== undefined)
        update.participant_member_ids = payload.participantMemberIds
      if (payload.metadata !== undefined) update.metadata = payload.metadata
      if (payload.scopeType !== undefined) update.scope_type = payload.scopeType
      if (payload.scopeCatalogueItemLabel !== undefined)
        update.scope_catalogue_item_label = payload.scopeCatalogueItemLabel
      if (payload.scopeOtherLabel !== undefined)
        update.scope_other_label = payload.scopeOtherLabel
      if (Object.keys(update).length === 0) return

      try {
        const { data, error: upErr } = await supabase
          .from('compliance_checklist_executions')
          .update(update)
          .eq('id', payload.executionId)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr

        const parsed = ComplianceExecutionRowSchema.safeParse(data)
        if (parsed.success) {
          setExecutions((prev) => prev.map((e) => (e.id === parsed.data.id ? parsed.data : e)))
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, canManage],
  )

  // ── Attachments (Supabase Storage) ───────────────────────────────────────

  const uploadResponseAttachment = useCallback(
    async (payload: {
      executionId: string
      itemKey: string
      file: File
    }): Promise<string | null> => {
      if (!supabase || !orgId) return null
      if (!canManage) {
        setError('Du har ikke tilgang til å laste opp filer.')
        return null
      }
      setError(null)

      const exec = executions.find((e) => e.id === payload.executionId)
      if (exec?.status === 'signed') {
        setError('Sjekklisten er signert og kan ikke endres.')
        return null
      }

      // Sanitised filename — keep extension, strip path separators and
      // collapse any other suspicious characters. Prepend a uuid for
      // collision safety inside the (org, exec, item_key) folder.
      const original = payload.file.name
      const dot = original.lastIndexOf('.')
      const ext = dot >= 0 ? original.slice(dot).toLowerCase() : ''
      const stem = (dot >= 0 ? original.slice(0, dot) : original)
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .slice(0, 60) || 'fil'
      const uuid = crypto.randomUUID()
      const path = `${orgId}/${payload.executionId}/${payload.itemKey}/${uuid}-${stem}${ext}`

      try {
        const { error: upErr } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .upload(path, payload.file, {
            cacheControl: '3600',
            contentType: payload.file.type || undefined,
            upsert: false,
          })
        if (upErr) throw upErr

        // Append to value.urls on the response. Existing urls preserved.
        const existing =
          (responsesByExecutionId[payload.executionId] ?? []).find(
            (r) => r.item_key === payload.itemKey,
          )
        const prevValue =
          existing?.value && typeof existing.value === 'object'
            ? (existing.value as Record<string, unknown>)
            : {}
        const prevUrls = Array.isArray(prevValue.urls)
          ? (prevValue.urls as string[])
          : []
        const nextValue = { ...prevValue, urls: [...prevUrls, path] }

        await saveResponse({
          executionId: payload.executionId,
          itemKey: payload.itemKey,
          value: nextValue,
          comment: existing?.comment ?? undefined,
          severity: existing?.severity ?? undefined,
        })

        return path
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
        return null
      }
    },
    [supabase, orgId, canManage, executions, responsesByExecutionId, saveResponse],
  )

  const removeResponseAttachment = useCallback(
    async (payload: {
      executionId: string
      itemKey: string
      storagePath: string
    }): Promise<void> => {
      if (!supabase || !orgId) return
      if (!canManage) {
        setError('Du har ikke tilgang til å fjerne filer.')
        return
      }
      setError(null)

      const exec = executions.find((e) => e.id === payload.executionId)
      if (exec?.status === 'signed') {
        setError('Sjekklisten er signert og kan ikke endres.')
        return
      }

      try {
        const { error: rmErr } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .remove([payload.storagePath])
        if (rmErr) throw rmErr

        // Drop the path from value.urls.
        const existing =
          (responsesByExecutionId[payload.executionId] ?? []).find(
            (r) => r.item_key === payload.itemKey,
          )
        const prevValue =
          existing?.value && typeof existing.value === 'object'
            ? (existing.value as Record<string, unknown>)
            : {}
        const prevUrls = Array.isArray(prevValue.urls)
          ? (prevValue.urls as string[])
          : []
        const nextValue = {
          ...prevValue,
          urls: prevUrls.filter((u) => u !== payload.storagePath),
        }

        await saveResponse({
          executionId: payload.executionId,
          itemKey: payload.itemKey,
          value: nextValue,
          comment: existing?.comment ?? undefined,
          severity: existing?.severity ?? undefined,
        })
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, canManage, executions, responsesByExecutionId, saveResponse],
  )

  const signAttachmentUrl = useCallback(
    async (
      storagePath: string,
      ttlSeconds: number = 3600,
    ): Promise<string | null> => {
      if (!supabase) return null
      const { data, error: signErr } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(storagePath, ttlSeconds)
      if (signErr) return null
      return data?.signedUrl ?? null
    },
    [supabase],
  )

  // ── Comments ─────────────────────────────────────────────────────────────

  const loadComments = useCallback(
    async (executionId: string): Promise<void> => {
      if (!supabase || !orgId) return
      try {
        const { data, error: selErr } = await supabase
          .from('compliance_checklist_comments')
          .select('*')
          .eq('organization_id', orgId)
          .eq('execution_id', executionId)
          .order('created_at', { ascending: true })
        if (selErr) throw selErr
        const parsed = parseRows(data ?? [], ChecklistCommentRowSchema)
        setCommentsByExecutionId((prev) => ({ ...prev, [executionId]: parsed.ok }))
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  const addComment = useCallback(
    async (payload: {
      executionId: string
      itemKey?: string
      body: string
      mentions?: string[]
    }): Promise<ChecklistCommentRow | null> => {
      if (!supabase || !orgId) return null
      setError(null)

      // Resolve the current user's display name for denormalization.
      const userResp = await supabase.auth.getUser()
      const uid = userResp.data.user?.id
      if (!uid) {
        setError('Du er ikke innlogget.')
        return null
      }
      const author = assignableUsers.find((u) => u.id === uid)
      const authorName = author?.displayName ?? userResp.data.user?.email ?? uid

      try {
        const { data, error: insErr } = await supabase
          .from('compliance_checklist_comments')
          .insert({
            organization_id: orgId,
            execution_id: payload.executionId,
            item_key: payload.itemKey ?? null,
            body: payload.body.trim(),
            author_id: uid,
            author_name: authorName,
            mentions: payload.mentions ?? [],
          })
          .select('*')
          .single()
        if (insErr) throw insErr

        const parsed = ChecklistCommentRowSchema.safeParse(data)
        if (!parsed.success) return null

        setCommentsByExecutionId((prev) => {
          const list = prev[payload.executionId] ?? []
          return { ...prev, [payload.executionId]: [...list, parsed.data] }
        })
        return parsed.data
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
        return null
      }
    },
    [supabase, orgId, assignableUsers],
  )

  const updateComment = useCallback(
    async (payload: {
      commentId: string
      body: string
      mentions?: string[]
    }): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)
      try {
        const { data, error: upErr } = await supabase
          .from('compliance_checklist_comments')
          .update({ body: payload.body.trim(), mentions: payload.mentions ?? [] })
          .eq('id', payload.commentId)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr

        const parsed = ChecklistCommentRowSchema.safeParse(data)
        if (!parsed.success) return

        setCommentsByExecutionId((prev) => {
          const executionId = parsed.data.execution_id
          const list = prev[executionId] ?? []
          return {
            ...prev,
            [executionId]: list.map((c) => (c.id === parsed.data.id ? parsed.data : c)),
          }
        })
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  const deleteComment = useCallback(
    async (commentId: string, executionId: string): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)
      try {
        const { error: delErr } = await supabase
          .from('compliance_checklist_comments')
          .delete()
          .eq('id', commentId)
          .eq('organization_id', orgId)
        if (delErr) throw delErr

        setCommentsByExecutionId((prev) => {
          const list = prev[executionId] ?? []
          return { ...prev, [executionId]: list.filter((c) => c.id !== commentId) }
        })
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  // ── Template administration ──────────────────────────────────────────────

  const createTemplate = useCallback(
    async (payload: {
      pack: CompliancePackSlug
      slug: string
      name: string
      description?: string
      definition?: ChecklistDefinition
    }): Promise<string | null> => {
      if (!supabase || !orgId) return null
      if (!canManage) {
        setError('Du har ikke tilgang til å opprette maler.')
        return null
      }
      setError(null)

      try {
        const { data, error: insErr } = await supabase
          .from('compliance_checklist_templates')
          .insert({
            pack: payload.pack,
            slug: payload.slug,
            name: payload.name,
            description: payload.description ?? null,
            definition: payload.definition ?? { items: [] },
            is_active: true,
            nav_pinned: false,
            is_system: false,
          })
          .select('*')
          .single()
        if (insErr) throw insErr

        const parsed = ComplianceTemplateRowSchema.safeParse(data)
        if (parsed.success) {
          setTemplates((prev) => [...prev, parsed.data])
          return parsed.data.id
        }
        return null
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
        return null
      }
    },
    [supabase, orgId, canManage],
  )

  const updateTemplate = useCallback(
    async (payload: {
      templateId: string
      name?: string
      description?: string | null
      definition?: ChecklistDefinition
      nav_pinned?: boolean
      is_active?: boolean
      category_id?: string | null
      metadata_schema?: TemplateMetadataSchema
    }): Promise<void> => {
      if (!supabase || !orgId) return
      if (!canManage) {
        setError('Du har ikke tilgang til å redigere maler.')
        return
      }
      setError(null)

      const update: Record<string, unknown> = {}
      if (payload.name !== undefined) update.name = payload.name
      if (payload.description !== undefined) update.description = payload.description
      if (payload.definition !== undefined) update.definition = payload.definition
      if (payload.nav_pinned !== undefined) update.nav_pinned = payload.nav_pinned
      if (payload.is_active !== undefined) update.is_active = payload.is_active
      if (payload.category_id !== undefined) update.category_id = payload.category_id
      if (payload.metadata_schema !== undefined) update.metadata_schema = payload.metadata_schema
      if (Object.keys(update).length === 0) return

      try {
        const { data, error: upErr } = await supabase
          .from('compliance_checklist_templates')
          .update(update)
          .eq('id', payload.templateId)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr

        const parsed = ComplianceTemplateRowSchema.safeParse(data)
        if (parsed.success) {
          setTemplates((prev) =>
            prev.map((t) => (t.id === payload.templateId ? parsed.data : t)),
          )
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, canManage],
  )

  const softDeleteTemplate = useCallback(
    async (templateId: string): Promise<void> => {
      if (!supabase || !orgId) return
      if (!canManage) {
        setError('Du har ikke tilgang til å slette maler.')
        return
      }
      setError(null)

      const t = templates.find((x) => x.id === templateId)
      if (t?.is_system) {
        setError('Systemmaler kan ikke slettes; sett dem inaktive i stedet.')
        return
      }

      try {
        const { error: upErr } = await supabase
          .from('compliance_checklist_templates')
          .update({ deleted_at: new Date().toISOString(), is_active: false })
          .eq('id', templateId)
          .eq('organization_id', orgId)
        if (upErr) throw upErr

        setTemplates((prev) => prev.filter((x) => x.id !== templateId))
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, canManage, templates],
  )

  // ── Categories (per-org, per-pack) ──────────────────────────────────────

  const loadCategories = useCallback(async (): Promise<void> => {
    if (!supabase || !orgId) return
    setError(null)
    try {
      const { data, error: selErr } = await supabase
        .from('compliance_checklist_categories')
        .select('*')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('pack', { ascending: true })
        .order('position', { ascending: true })
        .order('name', { ascending: true })
      if (selErr) throw selErr
      const parsed = parseRows(data ?? [], ComplianceCategoryRowSchema)
      setCategories(parsed.ok)
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
    }
  }, [supabase, orgId])

  const createCategory = useCallback(
    async (payload: {
      pack: CompliancePackSlug
      slug: string
      name: string
      description?: string | null
      position?: number
    }): Promise<string | null> => {
      if (!supabase || !orgId) return null
      if (!canManage) {
        setError('Du har ikke tilgang til å opprette kategorier.')
        return null
      }
      setError(null)
      try {
        const { data, error: insErr } = await supabase
          .from('compliance_checklist_categories')
          .insert({
            pack: payload.pack,
            slug: payload.slug,
            name: payload.name,
            description: payload.description ?? null,
            position: payload.position ?? 100,
            is_active: true,
            is_system: false,
          })
          .select('*')
          .single()
        if (insErr) throw insErr
        const parsed = ComplianceCategoryRowSchema.safeParse(data)
        if (parsed.success) {
          setCategories((prev) => [...prev, parsed.data])
          return parsed.data.id
        }
        return null
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
        return null
      }
    },
    [supabase, orgId, canManage],
  )

  const updateCategory = useCallback(
    async (payload: {
      categoryId: string
      name?: string
      description?: string | null
      position?: number
      is_active?: boolean
    }): Promise<void> => {
      if (!supabase || !orgId) return
      if (!canManage) {
        setError('Du har ikke tilgang til å redigere kategorier.')
        return
      }
      setError(null)

      const update: Record<string, unknown> = {}
      if (payload.name !== undefined) update.name = payload.name
      if (payload.description !== undefined) update.description = payload.description
      if (payload.position !== undefined) update.position = payload.position
      if (payload.is_active !== undefined) update.is_active = payload.is_active
      if (Object.keys(update).length === 0) return

      try {
        const { data, error: upErr } = await supabase
          .from('compliance_checklist_categories')
          .update(update)
          .eq('id', payload.categoryId)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr
        const parsed = ComplianceCategoryRowSchema.safeParse(data)
        if (parsed.success) {
          setCategories((prev) => prev.map((c) => (c.id === parsed.data.id ? parsed.data : c)))
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, canManage],
  )

  const softDeleteCategory = useCallback(
    async (categoryId: string): Promise<void> => {
      if (!supabase || !orgId) return
      if (!canManage) {
        setError('Du har ikke tilgang til å slette kategorier.')
        return
      }
      setError(null)
      try {
        // Drop the row from local state first; templates using it keep their
        // category_id locally until the next reload, but the FK ON DELETE
        // SET NULL also handles eventual consistency on the server side
        // when the row is hard-deleted by an admin.
        const { error: upErr } = await supabase
          .from('compliance_checklist_categories')
          .update({ deleted_at: new Date().toISOString(), is_active: false })
          .eq('id', categoryId)
          .eq('organization_id', orgId)
        if (upErr) throw upErr
        setCategories((prev) => prev.filter((c) => c.id !== categoryId))
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, canManage],
  )

  // ── Template ↔ requirement tagging ──────────────────────────────────────

  const loadTemplateRequirements = useCallback(
    async (templateId: string): Promise<void> => {
      if (!supabase || !orgId) return
      try {
        const { data, error: respErr } = await supabase
          .from('compliance_template_requirements')
          .select('requirement_id')
          .eq('organization_id', orgId)
          .eq('template_id', templateId)
        if (respErr) throw respErr
        const ids = (data ?? []).map((row) => row.requirement_id as string)
        setRequirementIdsByTemplateId((prev) => ({ ...prev, [templateId]: ids }))
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  const setTemplateRequirements = useCallback(
    async (templateId: string, requirementIds: string[]): Promise<void> => {
      if (!supabase || !orgId) return
      if (!canManage) {
        setError('Du har ikke tilgang til å redigere kravkobling.')
        return
      }
      setError(null)

      const current = new Set(requirementIdsByTemplateId[templateId] ?? [])
      const next = new Set(requirementIds)
      const toAdd = [...next].filter((id) => !current.has(id))
      const toRemove = [...current].filter((id) => !next.has(id))

      try {
        if (toRemove.length > 0) {
          const { error: rmErr } = await supabase
            .from('compliance_template_requirements')
            .delete()
            .eq('organization_id', orgId)
            .eq('template_id', templateId)
            .in('requirement_id', toRemove)
          if (rmErr) throw rmErr
        }

        if (toAdd.length > 0) {
          const rows = toAdd.map((requirement_id) => ({
            template_id: templateId,
            requirement_id,
          }))
          const { error: insErr } = await supabase
            .from('compliance_template_requirements')
            .insert(rows)
          if (insErr) throw insErr
        }

        setRequirementIdsByTemplateId((prev) => ({
          ...prev,
          [templateId]: [...next],
        }))
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, canManage, requirementIdsByTemplateId],
  )

  return useMemo(
    () => ({
      loading,
      error,
      currentUserId,
      templates,
      executions,
      responsesByExecutionId,
      assignableUsers,
      aggregates,
      commentsByExecutionId,
      load,
      loadDetail,
      reloadAggregates,
      createExecution,
      saveResponse,
      signExecution,
      archiveExecution,
      updateExecutionMetadata,
      uploadResponseAttachment,
      removeResponseAttachment,
      signAttachmentUrl,
      loadComments,
      addComment,
      updateComment,
      deleteComment,
      createTemplate,
      updateTemplate,
      softDeleteTemplate,
      categories,
      loadCategories,
      createCategory,
      updateCategory,
      softDeleteCategory,
      requirementIdsByTemplateId,
      loadTemplateRequirements,
      setTemplateRequirements,
    }),
    [
      loading,
      error,
      currentUserId,
      templates,
      executions,
      responsesByExecutionId,
      assignableUsers,
      aggregates,
      commentsByExecutionId,
      load,
      loadDetail,
      reloadAggregates,
      createExecution,
      saveResponse,
      signExecution,
      archiveExecution,
      updateExecutionMetadata,
      uploadResponseAttachment,
      removeResponseAttachment,
      signAttachmentUrl,
      loadComments,
      addComment,
      updateComment,
      deleteComment,
      createTemplate,
      updateTemplate,
      softDeleteTemplate,
      categories,
      loadCategories,
      createCategory,
      updateCategory,
      softDeleteCategory,
      requirementIdsByTemplateId,
      loadTemplateRequirements,
      setTemplateRequirements,
    ],
  )
}
