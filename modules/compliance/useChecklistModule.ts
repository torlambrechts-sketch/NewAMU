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
  ComplianceAggregates,
  ComplianceAssignableUser,
  ComplianceExecutionRow,
  ComplianceResponseRow,
  CompliancePackSlug,
  ComplianceSeverity,
  ComplianceTemplateRow,
} from './types'
import {
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

  load: (filters?: { pack?: CompliancePackSlug }) => Promise<void>
  loadDetail: (executionId: string) => Promise<void>
  reloadAggregates: (pack?: CompliancePackSlug) => Promise<void>

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

  // ── Aggregates (org-wide; fetched separately from paginated list) ────────

  const reloadAggregates = useCallback(
    async (pack?: CompliancePackSlug) => {
      if (!supabase || !orgId) return
      try {
        const baseExec = supabase
          .from('compliance_checklist_executions')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)

        const totalQ = pack ? baseExec.eq('pack', pack) : baseExec
        const openQ = (pack
          ? supabase
              .from('compliance_checklist_executions')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', orgId)
              .eq('pack', pack)
          : supabase
              .from('compliance_checklist_executions')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', orgId)
        ).in('status', ['draft', 'active'])

        const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
        const ytdQ = (pack
          ? supabase
              .from('compliance_checklist_executions')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', orgId)
              .eq('pack', pack)
          : supabase
              .from('compliance_checklist_executions')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', orgId)
        )
          .eq('status', 'signed')
          .gte('signed_at', yearStart)

        // Critical findings via responses joined to executions for pack scope.
        const critQ = pack
          ? supabase
              .from('compliance_checklist_responses')
              .select('*, compliance_checklist_executions!inner(pack)', {
                count: 'exact',
                head: true,
              })
              .eq('organization_id', orgId)
              .eq('severity', 'critical')
              .eq('compliance_checklist_executions.pack', pack)
          : supabase
              .from('compliance_checklist_responses')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', orgId)
              .eq('severity', 'critical')

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
    async (filters?: { pack?: CompliancePackSlug }) => {
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

        if (filters?.pack) {
          templatesQ = templatesQ.eq('pack', filters.pack)
          executionsQ = executionsQ.eq('pack', filters.pack)
        }

        const [templatesRes, executionsRes, usersRes] = await Promise.all([
          templatesQ,
          executionsQ,
          fetchAssignableUsers(supabase, orgId),
        ])

        if (templatesRes.error) throw templatesRes.error
        if (executionsRes.error) throw executionsRes.error

        const t = parseRows(templatesRes.data ?? [], ComplianceTemplateRowSchema)
        const e = parseRows(executionsRes.data ?? [], ComplianceExecutionRowSchema)
        setTemplates(t.ok)
        setExecutions(e.ok)
        setAssignableUsers(usersRes)

        if (t.failed + e.failed > 0) {
          setError(`Kunne ikke tolke ${t.failed + e.failed} rader fra databasen.`)
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
      load,
      loadDetail,
      reloadAggregates,
      createExecution,
      saveResponse,
      signExecution,
      uploadResponseAttachment,
      removeResponseAttachment,
      signAttachmentUrl,
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
      load,
      loadDetail,
      reloadAggregates,
      createExecution,
      saveResponse,
      signExecution,
      uploadResponseAttachment,
      removeResponseAttachment,
      signAttachmentUrl,
    ],
  )
}
