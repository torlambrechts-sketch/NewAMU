// usePlanningTasks — task_items + project + okr-link aggregation for /planlegging.
//
// Returns all task_items for the org enriched with:
//   * okrKeyResultId (from okr_task_links, single)
//   * recurrence fields
//   * project link
//
// Also exposes mutations for:
//   * create new task (optionally linked to a KR)
//   * mark recurring with interval + optional stop date
//   * stop recurrence (via stop_recurring_task RPC)
//   * update interval (via update_recurring_task_interval RPC)
//   * link/unlink to a KR

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import type { TaskItemPriority, TaskItemStatus, TaskPdcaPhase, TaskTemplateKind } from '../types/task'

export type PlanningTaskRow = {
  id: string
  title: string
  description: string
  status: TaskItemStatus
  priority: TaskItemPriority
  templateKind: TaskTemplateKind | null
  templateSlug: string | null
  ownerName: string | null
  assigneeName: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  projectId: string | null
  pdcaPhase: TaskPdcaPhase
  parentItemId: string | null
  // Recurring fields
  recurrenceIntervalDays: number | null
  recurrenceActive: boolean
  recurrenceStopAt: string | null
  recurrenceStoppedAt: string | null
  recurrenceParentItemId: string | null
  nextRecurrenceDate: string | null
  recurrenceCadence: string | null
  // OKR link (single, picks first if multiple)
  okrKeyResultId: string | null
}

export type CreatePlanningTaskInput = {
  title: string
  description?: string
  priority?: TaskItemPriority
  dueDate?: string
  ownerName?: string
  assigneeName?: string
  templateKind?: TaskTemplateKind
  projectId?: string
  pdcaPhase?: TaskPdcaPhase
  // Recurrence
  recurrenceIntervalDays?: number
  recurrenceActive?: boolean
  recurrenceStopAt?: string
  // OKR link
  keyResultId?: string
}

export type UsePlanningTasksReturn = {
  loading: boolean
  error: string | null
  tasks: PlanningTaskRow[]
  reload: () => void
  createTask: (input: CreatePlanningTaskInput) => Promise<string | null>
  updateTaskStatus: (id: string, status: TaskItemStatus) => Promise<void>
  setRecurrence: (id: string, intervalDays: number | null, stopAt?: string | null) => Promise<void>
  stopRecurrence: (id: string) => Promise<void>
  linkTaskToKr: (taskId: string, keyResultId: string) => Promise<void>
  unlinkTaskFromKr: (taskId: string, keyResultId: string) => Promise<void>
}

export function usePlanningTasks(): UsePlanningTasksReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [tasks, setTasks] = useState<PlanningTaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const [taskRes, linkRes] = await Promise.all([
          supabase
            .from('task_items')
            .select(
              [
                'id, title, description, status, priority',
                'template_slug, template_kind, owner_name, assignee_name',
                'due_date, created_at, updated_at, closed_at',
                'project_id, pdca_phase, parent_item_id',
                'recurrence_interval_days, recurrence_active, recurrence_stop_at',
                'recurrence_stopped_at, recurrence_parent_item_id',
                'next_recurrence_date, recurrence_cadence',
              ].join(', '),
            )
            .eq('organization_id', orgId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
          supabase
            .from('okr_task_links')
            .select('task_item_id, key_result_id')
            .eq('organization_id', orgId),
        ])

        if (taskRes.error) throw taskRes.error
        if (linkRes.error) throw linkRes.error

        const linkMap = new Map<string, string>()
        for (const r of linkRes.data ?? []) {
          const tid = String((r as { task_item_id: string }).task_item_id)
          const kid = String((r as { key_result_id: string }).key_result_id)
          if (!linkMap.has(tid)) linkMap.set(tid, kid)
        }

        if (cancelled) return

        setTasks(
          (taskRes.data ?? []).map((r) => {
            const row = r as unknown as Record<string, unknown>
            const id = String(row.id)
            return {
              id,
              title: String(row.title ?? ''),
              description: String(row.description ?? ''),
              status: (row.status ?? 'open') as TaskItemStatus,
              priority: (row.priority ?? 'medium') as TaskItemPriority,
              templateKind: row.template_kind ? (String(row.template_kind) as TaskTemplateKind) : null,
              templateSlug: row.template_slug ? String(row.template_slug) : null,
              ownerName: row.owner_name ? String(row.owner_name) : null,
              assigneeName: row.assignee_name ? String(row.assignee_name) : null,
              dueDate: row.due_date ? String(row.due_date) : null,
              createdAt: String(row.created_at),
              updatedAt: String(row.updated_at),
              closedAt: row.closed_at ? String(row.closed_at) : null,
              projectId: row.project_id ? String(row.project_id) : null,
              pdcaPhase: (row.pdca_phase ?? 'do') as TaskPdcaPhase,
              parentItemId: row.parent_item_id ? String(row.parent_item_id) : null,
              recurrenceIntervalDays: row.recurrence_interval_days != null ? Number(row.recurrence_interval_days) : null,
              recurrenceActive: Boolean(row.recurrence_active),
              recurrenceStopAt: row.recurrence_stop_at ? String(row.recurrence_stop_at) : null,
              recurrenceStoppedAt: row.recurrence_stopped_at ? String(row.recurrence_stopped_at) : null,
              recurrenceParentItemId: row.recurrence_parent_item_id
                ? String(row.recurrence_parent_item_id)
                : null,
              nextRecurrenceDate: row.next_recurrence_date ? String(row.next_recurrence_date) : null,
              recurrenceCadence: row.recurrence_cadence ? String(row.recurrence_cadence) : null,
              okrKeyResultId: linkMap.get(id) ?? null,
            }
          }),
        )
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Kunne ikke laste oppgaver.'
        setError(msg)
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, orgId, version])

  const createTask = useCallback<UsePlanningTasksReturn['createTask']>(
    async (input) => {
      if (!supabase || !orgId) return null
      const payload: Record<string, unknown> = {
        organization_id: orgId,
        title: input.title,
        description: input.description ?? '',
        priority: input.priority ?? 'medium',
        status: 'open',
        pack: 'aml-amu',
        source_category: 'general',
        pdca_phase: input.pdcaPhase ?? 'do',
        template_kind: input.templateKind ?? null,
        owner_name: input.ownerName ?? null,
        assignee_name: input.assigneeName ?? null,
        due_date: input.dueDate ?? null,
        project_id: input.projectId ?? null,
      }
      if (input.recurrenceIntervalDays && input.recurrenceIntervalDays > 0) {
        payload.recurrence_interval_days = input.recurrenceIntervalDays
        payload.recurrence_active = input.recurrenceActive ?? true
        if (input.recurrenceStopAt) payload.recurrence_stop_at = input.recurrenceStopAt
        if (input.dueDate) {
          const d = new Date(input.dueDate)
          d.setDate(d.getDate() + input.recurrenceIntervalDays)
          payload.next_recurrence_date = d.toISOString().slice(0, 10)
        }
      }
      const { data, error: insErr } = await supabase
        .from('task_items')
        .insert(payload)
        .select('id')
        .single()
      if (insErr || !data) return null
      const newId = String(data.id)

      if (input.keyResultId) {
        await supabase.from('okr_task_links').insert({
          organization_id: orgId,
          key_result_id: input.keyResultId,
          task_item_id: newId,
        })
      }
      reload()
      return newId
    },
    [supabase, orgId, reload],
  )

  const updateTaskStatus = useCallback<UsePlanningTasksReturn['updateTaskStatus']>(
    async (id, status) => {
      if (!supabase) return
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status } : t)),
      )
      const patch: Record<string, unknown> = { status }
      if (status === 'closed') {
        patch.closed_at = new Date().toISOString()
      }
      const { error: upErr } = await supabase.from('task_items').update(patch).eq('id', id)

      // Hvis recurring og lukkes → generer neste forekomst.
      const t = tasks.find((x) => x.id === id)
      if (!upErr && status === 'closed' && t?.recurrenceActive && t.recurrenceIntervalDays) {
        await supabase.rpc('generate_recurring_task_next', { p_completed_task_id: id })
        reload()
      }
      if (upErr) reload()
    },
    [supabase, tasks, reload],
  )

  const setRecurrence = useCallback<UsePlanningTasksReturn['setRecurrence']>(
    async (id, intervalDays, stopAt) => {
      if (!supabase) return
      if (intervalDays == null || intervalDays <= 0) {
        // Disable recurrence completely.
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  recurrenceIntervalDays: null,
                  recurrenceActive: false,
                  recurrenceStopAt: null,
                  nextRecurrenceDate: null,
                }
              : t,
          ),
        )
        await supabase
          .from('task_items')
          .update({
            recurrence_interval_days: null,
            recurrence_active: false,
            recurrence_stop_at: null,
            next_recurrence_date: null,
          })
          .eq('id', id)
        return
      }
      const { error: rpcErr } = await supabase.rpc('update_recurring_task_interval', {
        p_task_id: id,
        p_interval_days: intervalDays,
        p_stop_at: stopAt ?? null,
      })
      if (rpcErr) {
        setError(rpcErr.message)
      }
      reload()
    },
    [supabase, reload],
  )

  const stopRecurrence = useCallback<UsePlanningTasksReturn['stopRecurrence']>(
    async (id) => {
      if (!supabase) return
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                recurrenceActive: false,
                recurrenceStoppedAt: new Date().toISOString(),
              }
            : t,
        ),
      )
      const { error: rpcErr } = await supabase.rpc('stop_recurring_task', { p_task_id: id })
      if (rpcErr) {
        setError(rpcErr.message)
        reload()
      }
    },
    [supabase, reload],
  )

  const linkTaskToKr = useCallback<UsePlanningTasksReturn['linkTaskToKr']>(
    async (taskId, keyResultId) => {
      if (!supabase || !orgId) return
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, okrKeyResultId: keyResultId } : t)),
      )
      // Upsert — delete any existing link, then insert.
      await supabase.from('okr_task_links').delete().eq('task_item_id', taskId)
      const { error: insErr } = await supabase.from('okr_task_links').insert({
        organization_id: orgId,
        key_result_id: keyResultId,
        task_item_id: taskId,
      })
      if (insErr) reload()
    },
    [supabase, orgId, reload],
  )

  const unlinkTaskFromKr = useCallback<UsePlanningTasksReturn['unlinkTaskFromKr']>(
    async (taskId, keyResultId) => {
      if (!supabase) return
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId && t.okrKeyResultId === keyResultId ? { ...t, okrKeyResultId: null } : t,
        ),
      )
      const { error: delErr } = await supabase
        .from('okr_task_links')
        .delete()
        .eq('task_item_id', taskId)
        .eq('key_result_id', keyResultId)
      if (delErr) reload()
    },
    [supabase, reload],
  )

  return useMemo(
    () => ({
      loading,
      error,
      tasks,
      reload,
      createTask,
      updateTaskStatus,
      setRecurrence,
      stopRecurrence,
      linkTaskToKr,
      unlinkTaskFromKr,
    }),
    [
      loading,
      error,
      tasks,
      reload,
      createTask,
      updateTaskStatus,
      setRecurrence,
      stopRecurrence,
      linkTaskToKr,
      unlinkTaskFromKr,
    ],
  )
}
