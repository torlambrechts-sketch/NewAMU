// Reads and writes task_items — the relational task store that replaces
// JSON org_module_payloads for new tasks. Old JSON tasks remain readable
// via useTaskExtensions; this hook is the write surface for the new
// pack-aware architecture.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import type {
  TaskItem,
  TaskPack,
  TaskPdcaPhase,
  TaskSourceCategory,
} from '../../src/types/task'

type Row = {
  id: string
  organization_id: string
  project_id: string | null
  pack: string
  source_category: string
  pdca_phase: string
  title: string
  description: string
  status: string
  priority: string
  law_refs: string[]
  assignee_user_id: string | null
  assignee_name: string | null
  owner_role: string | null
  due_date: string | null
  source_type: string | null
  source_id: string | null
  requires_sign_off: boolean
  assignee_signed_at: string | null
  assignee_signed_by: string | null
  management_signed_at: string | null
  management_signed_by: string | null
  closed_at: string | null
  closed_by: string | null
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

function mapRow(r: Row): TaskItem {
  return {
    id: r.id,
    organizationId: r.organization_id,
    projectId: r.project_id ?? undefined,
    pack: r.pack as TaskPack,
    sourceCategory: r.source_category as TaskSourceCategory,
    pdcaPhase: r.pdca_phase as TaskPdcaPhase,
    title: r.title,
    description: r.description,
    status: r.status as TaskItem['status'],
    priority: r.priority as TaskItem['priority'],
    lawRefs: r.law_refs ?? [],
    assigneeUserId: r.assignee_user_id ?? undefined,
    assigneeName: r.assignee_name ?? undefined,
    ownerRole: r.owner_role ?? undefined,
    dueDate: r.due_date ?? undefined,
    sourceType: r.source_type as TaskItem['sourceType'],
    sourceId: r.source_id ?? undefined,
    requiresSignOff: r.requires_sign_off,
    assigneeSignedAt: r.assignee_signed_at ?? undefined,
    assigneeSignedBy: r.assignee_signed_by ?? undefined,
    managementSignedAt: r.management_signed_at ?? undefined,
    managementSignedBy: r.management_signed_by ?? undefined,
    closedAt: r.closed_at ?? undefined,
    closedBy: r.closed_by ?? undefined,
    deletedAt: r.deleted_at ?? undefined,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export type TaskItemFilters = {
  pack?: TaskPack
  sourceCategory?: TaskSourceCategory
  projectId?: string | null
  status?: TaskItem['status']
}

export function useTaskItems(filters: TaskItemFilters = {}) {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const [items, setItems] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stable instance ID so each mounted hook gets its own Supabase channel,
  // preventing "cannot add postgres_changes callbacks after subscribe()" when
  // multiple components use this hook simultaneously.
  const instanceId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`)

  const filtersKey = JSON.stringify(filters)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) {
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('task_items')
        .select('*')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (filters.pack) query = query.eq('pack', filters.pack)
      if (filters.sourceCategory) query = query.eq('source_category', filters.sourceCategory)
      if (filters.projectId !== undefined) {
        if (filters.projectId === null) {
          query = query.is('project_id', null)
        } else {
          query = query.eq('project_id', filters.projectId)
        }
      }
      if (filters.status) query = query.eq('status', filters.status)

      const { data, error: e } = await query
      if (e) {
        if (String(e.message).toLowerCase().includes('does not exist')) {
          setItems([])
          return
        }
        throw e
      }
      setItems((data ?? []).map((r) => mapRow(r as Row)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukjent feil')
      setItems([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, orgId, filtersKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Keep a stable ref so the realtime effect never needs to re-subscribe on filter changes.
  const refreshRef = useRef(refresh)
  useEffect(() => { refreshRef.current = refresh }, [refresh])

  // Realtime subscription — only recreated when supabase client or org changes.
  useEffect(() => {
    if (!supabase || !orgId) return
    const channel = supabase
      .channel(`task_items:org:${orgId}:${instanceId.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_items', filter: `organization_id=eq.${orgId}` },
        () => { void refreshRef.current() },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [supabase, orgId])

  const createItem = useCallback(
    async (payload: Omit<TaskItem, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<TaskItem | null> => {
      if (!supabase || !orgId) return null
      const { data, error: e } = await supabase
        .from('task_items')
        .insert({
          organization_id: orgId,
          project_id: payload.projectId ?? null,
          pack: payload.pack,
          source_category: payload.sourceCategory,
          pdca_phase: payload.pdcaPhase,
          title: payload.title,
          description: payload.description,
          status: payload.status,
          priority: payload.priority,
          law_refs: payload.lawRefs,
          assignee_user_id: payload.assigneeUserId ?? null,
          assignee_name: payload.assigneeName ?? null,
          owner_role: payload.ownerRole ?? null,
          due_date: payload.dueDate ?? null,
          source_type: payload.sourceType ?? null,
          source_id: payload.sourceId ?? null,
          requires_sign_off: payload.requiresSignOff,
        })
        .select()
        .single()
      if (e) { console.error('createItem:', e); return null }
      const created = mapRow(data as Row)
      setItems((prev) => [created, ...prev])
      return created
    },
    [supabase, orgId],
  )

  const updateItem = useCallback(
    async (id: string, patch: Partial<TaskItem>): Promise<boolean> => {
      if (!supabase || !orgId) return false
      const dbPatch: Record<string, unknown> = {}
      if (patch.title !== undefined) dbPatch.title = patch.title
      if (patch.description !== undefined) dbPatch.description = patch.description
      if (patch.status !== undefined) dbPatch.status = patch.status
      if (patch.priority !== undefined) dbPatch.priority = patch.priority
      if (patch.pdcaPhase !== undefined) dbPatch.pdca_phase = patch.pdcaPhase
      if (patch.sourceCategory !== undefined) dbPatch.source_category = patch.sourceCategory
      if (patch.pack !== undefined) dbPatch.pack = patch.pack
      if (patch.lawRefs !== undefined) dbPatch.law_refs = patch.lawRefs
      if (patch.assigneeUserId !== undefined) dbPatch.assignee_user_id = patch.assigneeUserId
      if (patch.assigneeName !== undefined) dbPatch.assignee_name = patch.assigneeName
      if (patch.ownerRole !== undefined) dbPatch.owner_role = patch.ownerRole
      if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate
      if (patch.projectId !== undefined) dbPatch.project_id = patch.projectId
      if (patch.requiresSignOff !== undefined) dbPatch.requires_sign_off = patch.requiresSignOff

      const { error: e } = await supabase
        .from('task_items')
        .update(dbPatch)
        .eq('id', id)
        .eq('organization_id', orgId)
      if (e) { console.error('updateItem:', e); return false }
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      return true
    },
    [supabase, orgId],
  )

  const deleteItem = useCallback(
    async (id: string): Promise<boolean> => {
      if (!supabase || !orgId) return false
      const { error: e } = await supabase
        .from('task_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', orgId)
      if (e) { console.error('deleteItem:', e); return false }
      setItems((prev) => prev.filter((t) => t.id !== id))
      return true
    },
    [supabase, orgId],
  )

  // Pre-grouped by PDCA phase for the board tab
  const byPhase = useMemo(() => {
    const map: Record<TaskPdcaPhase, TaskItem[]> = { plan: [], do: [], check: [], act: [] }
    for (const item of items) map[item.pdcaPhase].push(item)
    return map
  }, [items])

  return { items, byPhase, loading, error, refresh, createItem, updateItem, deleteItem }
}
