// useTaskItemsData — task_items CRUD for a single org, optionally scoped to
// one template slug. Separate from the legacy useTasks.ts stub (which is a
// no-op kept for backward-compat with cross-module consumers).

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import type { TaskItemStatus, TaskItemPriority, TaskTemplateKind } from '../../src/types/task'

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
}

export type CreateTaskItemInput = {
  title: string
  description?: string
  priority: TaskItemPriority
  templateSlug?: string
  templateKind?: TaskTemplateKind
  assigneeName?: string
  ownerName?: string
  dueDate?: string
}

export type UseTaskItemsDataReturn = {
  loading: boolean
  items: TaskItemRow[]
  error: string | null
  createItem: (input: CreateTaskItemInput) => Promise<string | null>
  updateStatus: (id: string, status: TaskItemStatus) => Promise<void>
  reload: () => void
}

export function useTaskItemsData(templateSlug?: string | null): UseTaskItemsDataReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

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
        'id, title, description, status, priority, template_slug, template_kind, owner_name, assignee_name, due_date, sla_due_at, created_at, updated_at, closed_at',
      )
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (templateSlug) {
      query = query.eq('template_slug', templateSlug)
    }

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
          })),
        )
      }
    })

    return () => {
      cancelled = true
    }
  }, [supabase, orgId, templateSlug, version])

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
          status: 'open',
          pack: 'aml-amu',
          source_category: input.templateKind ?? 'general',
          pdca_phase: 'do',
          template_slug: input.templateSlug ?? null,
          template_kind: input.templateKind ?? null,
          assignee_name: input.assigneeName ?? null,
          owner_name: input.ownerName ?? null,
          due_date: input.dueDate ?? null,
        })
        .select('id')
        .single()
      if (insErr || !data) return null
      reload()
      return String(data.id)
    },
    [supabase, orgId, reload],
  )

  const updateStatus = useCallback(
    async (id: string, status: TaskItemStatus): Promise<void> => {
      if (!supabase) return
      await supabase.from('task_items').update({ status }).eq('id', id)
      reload()
    },
    [supabase, reload],
  )

  return { loading, items, error, createItem, updateStatus, reload }
}
