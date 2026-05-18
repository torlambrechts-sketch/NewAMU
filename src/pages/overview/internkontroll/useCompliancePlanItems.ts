// useCompliancePlanItems — CRUD over the compliance_plan_items table.
//
// Loads all non-deleted plan items for the active org, exposes
// create/update/delete operations, and bridges status='in_progress' to
// an auto-created task_items row (source_type='compliance_plan',
// source_id=<plan_item.id>). The Tasks bridge is one-way in v1 —
// closing the task does NOT auto-flip the plan item to 'done'.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type { FrameworkId } from './frameworkParagraphs'

export type CompliancePlanItemStatus = 'planned' | 'in_progress' | 'blocked' | 'done'

export type CompliancePlanItem = {
  id: string
  organization_id: string
  law_ref: string
  framework_id: FrameworkId
  title: string
  description: string | null
  owner_user_id: string | null
  status: CompliancePlanItemStatus
  start_at: string | null
  due_at: string | null
  milestone: string | null
  task_id: string | null
  created_at: string
  updated_at: string
}

export type CreatePlanItemInput = {
  law_ref: string
  framework_id: FrameworkId
  title: string
  description?: string
  status?: CompliancePlanItemStatus
  due_at?: string | null
}

export type UpdatePlanItemInput = Partial<
  Pick<CompliancePlanItem, 'title' | 'description' | 'status' | 'due_at' | 'owner_user_id'>
>

const PLAN_ITEM_COLUMNS =
  'id, organization_id, law_ref, framework_id, title, description, owner_user_id, status, start_at, due_at, milestone, task_id, created_at, updated_at'

export function useCompliancePlanItems(framework: FrameworkId): {
  items: CompliancePlanItem[]
  loading: boolean
  error: string | null
  /** Items grouped by law_ref for O(1) inspector lookups. */
  itemsByLawRef: Map<string, CompliancePlanItem[]>
  reload: () => Promise<void>
  createItem: (input: CreatePlanItemInput) => Promise<CompliancePlanItem | null>
  updateItem: (id: string, patch: UpdatePlanItemInput) => Promise<CompliancePlanItem | null>
  deleteItem: (id: string) => Promise<boolean>
} {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [items, setItems] = useState<CompliancePlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase || !orgId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('compliance_plan_items')
      .select(PLAN_ITEM_COLUMNS)
      .eq('organization_id', orgId)
      .eq('framework_id', framework)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (err) {
      setError(err.message)
      setItems([])
      setLoading(false)
      return
    }
    setError(null)
    setItems((data ?? []) as CompliancePlanItem[])
    setLoading(false)
  }, [supabase, orgId, framework])

  useEffect(() => {
    void reload()
  }, [reload])

  const itemsByLawRef = useMemo(() => {
    const m = new Map<string, CompliancePlanItem[]>()
    for (const it of items) {
      const arr = m.get(it.law_ref) ?? []
      arr.push(it)
      m.set(it.law_ref, arr)
    }
    return m
  }, [items])

  // Tasks bridge: when a plan item flips into 'in_progress' and has no
  // task yet, create one. Pure client-side mirror — v1 one-way.
  const ensureBridgeTask = useCallback(
    async (plan: CompliancePlanItem): Promise<string | null> => {
      if (!supabase || !orgId) return null
      if (plan.task_id) return plan.task_id
      const { data, error: insErr } = await supabase
        .from('task_items')
        .insert({
          organization_id: orgId,
          title: `Internkontroll: ${plan.title}`,
          description:
            (plan.description ? plan.description + '\n\n' : '') +
            `Lukke-tiltak for ${plan.law_ref}.`,
          priority: 'medium',
          status: 'open',
          pack: 'aml-amu',
          source_type: 'compliance_plan',
          source_id: plan.id,
          law_refs: [plan.law_ref],
          source_category: 'compliance',
          pdca_phase: 'do',
          due_date: plan.due_at,
        })
        .select('id')
        .single()
      if (insErr || !data) return null
      const taskId = String(data.id)
      // Persist the task_id back to the plan item so we don't double-create.
      await supabase
        .from('compliance_plan_items')
        .update({ task_id: taskId })
        .eq('id', plan.id)
      return taskId
    },
    [supabase, orgId],
  )

  const createItem = useCallback(
    async (input: CreatePlanItemInput): Promise<CompliancePlanItem | null> => {
      if (!supabase || !orgId) return null
      const { data, error: insErr } = await supabase
        .from('compliance_plan_items')
        .insert({
          law_ref: input.law_ref,
          framework_id: input.framework_id,
          title: input.title,
          description: input.description ?? null,
          status: input.status ?? 'planned',
          due_at: input.due_at ?? null,
        })
        .select(PLAN_ITEM_COLUMNS)
        .single()
      if (insErr || !data) return null
      const created = data as CompliancePlanItem
      setItems((prev) => [created, ...prev])
      if (created.status === 'in_progress') {
        const taskId = await ensureBridgeTask(created)
        if (taskId) {
          setItems((prev) =>
            prev.map((it) => (it.id === created.id ? { ...it, task_id: taskId } : it)),
          )
        }
      }
      return created
    },
    [supabase, orgId, ensureBridgeTask],
  )

  const updateItem = useCallback(
    async (id: string, patch: UpdatePlanItemInput): Promise<CompliancePlanItem | null> => {
      if (!supabase) return null
      const cleanPatch: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) cleanPatch[k] = v
      }
      const { data, error: updErr } = await supabase
        .from('compliance_plan_items')
        .update(cleanPatch)
        .eq('id', id)
        .select(PLAN_ITEM_COLUMNS)
        .single()
      if (updErr || !data) return null
      const updated = data as CompliancePlanItem
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)))
      if (updated.status === 'in_progress' && !updated.task_id) {
        const taskId = await ensureBridgeTask(updated)
        if (taskId) {
          setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, task_id: taskId } : it)),
          )
        }
      }
      return updated
    },
    [supabase, ensureBridgeTask],
  )

  const deleteItem = useCallback(
    async (id: string): Promise<boolean> => {
      if (!supabase) return false
      const { error: delErr } = await supabase
        .from('compliance_plan_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (delErr) return false
      setItems((prev) => prev.filter((it) => it.id !== id))
      return true
    },
    [supabase],
  )

  return {
    items,
    loading,
    error,
    itemsByLawRef,
    reload,
    createItem,
    updateItem,
    deleteItem,
  }
}
