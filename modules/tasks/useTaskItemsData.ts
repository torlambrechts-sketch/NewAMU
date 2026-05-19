// useTaskItemsData — task_items CRUD for a single org, optionally scoped to
// one template slug or project. Separate from the legacy useTasks.ts stub
// (which is a no-op kept for backward-compat with cross-module consumers).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { emitAuditEvent } from '../../src/lib/audit/emitAuditEvent'
import { isPrivileged } from '../../src/lib/audit/privilege'
import type { TaskItemStatus, TaskItemPriority, TaskTemplateKind, TaskPdcaPhase } from '../../src/types/task'

export type TaskItemRow = {
  id: string
  title: string
  description: string
  status: TaskItemStatus
  priority: TaskItemPriority
  templateSlug: string | null
  templateKind: TaskTemplateKind | null
  ownerName: string | null
  assigneeName: string | null
  dueDate: string | null
  slaDueAt: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  projectId: string | null
  pdcaPhase: TaskPdcaPhase
  parentItemId: string | null
}

export type CreateTaskItemInput = {
  title: string
  description?: string
  priority: TaskItemPriority
  status?: TaskItemStatus
  templateSlug?: string
  templateKind?: TaskTemplateKind
  assigneeName?: string
  ownerName?: string
  dueDate?: string
  projectId?: string
  pdcaPhase?: TaskPdcaPhase
  parentItemId?: string
  sourceType?: string
  sourceId?: string
  lawRefs?: string[]
  pack?: string
}

export type UseTaskItemsDataReturn = {
  loading: boolean
  items: TaskItemRow[]
  error: string | null
  createItem: (input: CreateTaskItemInput) => Promise<string | null>
  updateStatus: (id: string, status: TaskItemStatus) => Promise<boolean>
  updatePdcaPhase: (id: string, phase: TaskPdcaPhase) => Promise<boolean>
  reload: () => void
}

type UseTaskItemsDataOpts = {
  templateSlug?: string | null
  projectId?: string | null
}

export function useTaskItemsData(
  templateSlugOrOpts?: string | null | UseTaskItemsDataOpts,
): UseTaskItemsDataReturn {
  const opts: UseTaskItemsDataOpts =
    typeof templateSlugOrOpts === 'object' && templateSlugOrOpts !== null && !Array.isArray(templateSlugOrOpts)
      ? templateSlugOrOpts
      : { templateSlug: templateSlugOrOpts as string | null | undefined }

  const { supabase, organization, profile, user } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const actorName = useMemo(
    () => profile?.display_name ?? user?.email ?? 'Bruker',
    [profile, user],
  )

  const [items, setItems] = useState<TaskItemRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    setLoading(true)

    let query = supabase
      .from('task_items')
      .select(
        'id, title, description, status, priority, template_slug, template_kind, owner_name, assignee_name, due_date, sla_due_at, created_at, updated_at, closed_at, project_id, pdca_phase, parent_item_id',
      )
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (opts.templateSlug) query = query.eq('template_slug', opts.templateSlug)
    if (opts.projectId) query = query.eq('project_id', opts.projectId)

    void query.then(({ data, error: qErr }) => {
      if (cancelled) return
      setLoading(false)
      if (qErr) {
        setError(qErr.message)
      } else {
        setError(null)
        setItems(
          (data ?? []).map((r) => ({
            id: String(r.id),
            title: String(r.title ?? ''),
            description: String(r.description ?? ''),
            status: (r.status ?? 'open') as TaskItemStatus,
            priority: (r.priority ?? 'medium') as TaskItemPriority,
            templateSlug: r.template_slug ? String(r.template_slug) : null,
            templateKind: r.template_kind ? (r.template_kind as TaskTemplateKind) : null,
            ownerName: r.owner_name ? String(r.owner_name) : null,
            assigneeName: r.assignee_name ? String(r.assignee_name) : null,
            dueDate: r.due_date ? String(r.due_date) : null,
            slaDueAt: r.sla_due_at ? String(r.sla_due_at) : null,
            createdAt: String(r.created_at),
            updatedAt: String(r.updated_at),
            closedAt: r.closed_at ? String(r.closed_at) : null,
            projectId: r.project_id ? String(r.project_id) : null,
            pdcaPhase: (r.pdca_phase ?? 'do') as TaskPdcaPhase,
            parentItemId: r.parent_item_id ? String(r.parent_item_id) : null,
          })),
        )
      }
    })

    return () => {
      cancelled = true
    }
  }, [supabase, orgId, opts.templateSlug, opts.projectId, version])

  const createItem = useCallback(
    async (input: CreateTaskItemInput): Promise<string | null> => {
      if (!supabase || !orgId) return null
      const { data, error: insErr } = await supabase
        .from('task_items')
        .insert({
          organization_id: orgId,
          title: input.title,
          description: input.description ?? '',
          priority: input.priority,
          status: input.status ?? 'open',
          pack: input.pack ?? 'aml-amu',
          source_type: input.sourceType ?? null,
          source_id: input.sourceId ?? null,
          law_refs: input.lawRefs ?? null,
          source_category: input.templateKind ?? 'general',
          pdca_phase: input.pdcaPhase ?? 'do',
          template_slug: input.templateSlug ?? null,
          template_kind: input.templateKind ?? null,
          assignee_name: input.assigneeName ?? null,
          owner_name: input.ownerName ?? null,
          due_date: input.dueDate ?? null,
          project_id: input.projectId ?? null,
          parent_item_id: input.parentItemId ?? null,
        })
        .select('id')
        .single()
      if (insErr || !data) return null
      reload()
      void emitAuditEvent(supabase, {
        scopeId: 'tasks',
        entityKind: 'task_item',
        entityId: String(data.id),
        actorName,
        summary: { kind: 'preset', preset: 'oppgave_opprettet' },
        // Most tasks aren't sensitive; tilsynsbrev-spawned + confidential
        // tasks are flagged via the source. The privilege helper reads
        // confidentiality; defaults non-privileged.
        privileged: isPrivileged.task({ confidentiality: null }),
        diff: {
          kind: 'multi_field',
          changes: [
            {
              field_label_nb: 'Tittel',
              before: { display: '(ingen verdi)', semantic: 'plain' },
              after: { display: input.title, semantic: 'plain' },
            },
            {
              field_label_nb: 'Prioritet',
              before: { display: '(ingen verdi)', semantic: 'plain' },
              after: { display: String(input.priority), semantic: 'plain' },
            },
          ],
        },
      })
      return String(data.id)
    },
    [supabase, orgId, reload, actorName],
  )

  const updateStatus = useCallback(
    async (id: string, status: TaskItemStatus): Promise<boolean> => {
      if (!supabase) return false
      const beforeRow = items.find((i) => i.id === id) ?? null
      const beforeStatus = beforeRow?.status ?? null
      // Optimistic update — apply immediately, revert on failure
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, status, ...(status === 'closed' ? { closedAt: new Date().toISOString() } : {}) }
            : i,
        ),
      )
      const patch: Record<string, unknown> = { status }
      if (status === 'closed') patch.closed_at = new Date().toISOString()
      const { error: upErr } = await supabase.from('task_items').update(patch).eq('id', id)
      if (upErr) {
        reload() // revert by reloading from DB
        return false
      }
      if (beforeStatus !== status) {
        void emitAuditEvent(supabase, {
          scopeId: 'tasks',
          entityKind: 'task_item',
          entityId: id,
          actorName,
          summary:
            status === 'closed'
              ? { kind: 'preset', preset: 'oppgave_lukket' }
              : { kind: 'preset', preset: 'oppgave_status_endret', subject: status },
          privileged: isPrivileged.task({ confidentiality: null }),
          diff: {
            kind: 'single_field',
            field_label_nb: 'Status',
            before: { display: beforeStatus ?? '(ingen verdi)', semantic: 'status' },
            after: { display: status, semantic: 'status' },
          },
        })
      }
      return true
    },
    [supabase, reload, items, actorName],
  )

  const updatePdcaPhase = useCallback(
    async (id: string, phase: TaskPdcaPhase): Promise<boolean> => {
      if (!supabase) return false
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, pdcaPhase: phase } : i)))
      const { error: upErr } = await supabase
        .from('task_items')
        .update({ pdca_phase: phase })
        .eq('id', id)
      if (upErr) {
        reload()
        return false
      }
      return true
    },
    [supabase, reload],
  )

  return { loading, items, error, createItem, updateStatus, updatePdcaPhase, reload }
}
