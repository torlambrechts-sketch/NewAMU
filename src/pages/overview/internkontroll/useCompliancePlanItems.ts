// useCompliancePlanItems — CRUD over the compliance_plan_items table.
//
// Loads all non-deleted plan items for the active org, exposes
// create/update/delete operations, and bridges status='in_progress' to
// an auto-created task_items row (source_type='compliance_plan',
// source_id=<plan_item.id>). The Tasks bridge is one-way in v1 —
// closing the task does NOT auto-flip the plan item to 'done'.
//
// RLS POLICY (intentional, documented):
//   compliance_plan_items_write_org gates writes on
//   `organization_id = current_org_id()` with NO role check (i.e. no
//   `is_org_admin() OR user_has_permission(…)` predicate). Any member
//   of the org can create / update / delete tiltak. This is the right
//   posture for a "propose a closure" surface — verneombud, AMU
//   members, and HR all need to spot gaps and write a plan row. If a
//   tenant wants admin-only management, the right fix is a per-tenant
//   feature flag, NOT widening the global policy. Cross-org writes
//   are still impossible (org-scope gate).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../../lib/supabaseError'
import { MAX_PLAN_ITEMS_PER_FRAMEWORK } from '../../../../modules/compliance-layer/limits'
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

// Maps an internkontroll FrameworkId to the matching `task_items.pack`
// enum value (compliance_pack). The 5 frameworks our planner covers
// fall into 2 logical buckets:
//   • AML / IK-forskriften / sectoral lover (GDPR, Åpenhetsloven) →
//     the `aml-amu` pack the AMU surface already owns. IK-f is the
//     forskrift paired with AML; GDPR + ÅPL ride along on the AMU
//     pack since there's no dedicated pack yet.
//   • ISO 45001 → the dedicated `iso-45001` pack.
// Adding a new framework: extend FrameworkId, add the matching pack
// here. The compliance_pack enum is at supabase/migrations/.
function packForFramework(framework: FrameworkId): string {
  switch (framework) {
    case 'iso-45001':
      return 'iso-45001'
    case 'aml':
    case 'ik-f':
    case 'gdpr':
    case 'apenhetsloven':
      return 'aml-amu'
  }
}

export function useCompliancePlanItems(framework: FrameworkId | 'all'): {
  items: CompliancePlanItem[]
  loading: boolean
  error: string | null
  /** Items grouped by law_ref for O(1) inspector lookups. */
  itemsByLawRef: Map<string, CompliancePlanItem[]>
  reload: (signal?: AbortSignal) => Promise<void>
  createItem: (input: CreatePlanItemInput) => Promise<CompliancePlanItem | null>
  updateItem: (id: string, patch: UpdatePlanItemInput) => Promise<CompliancePlanItem | null>
  deleteItem: (id: string) => Promise<boolean>
} {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [items, setItems] = useState<CompliancePlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (!supabase || !orgId) {
        setItems([])
        setLoading(false)
        return
      }
      setLoading(true)
      // Defensive cap from modules/compliance-layer/limits.ts. Newer
      // items first means the cap drops the long tail of historic
      // done/blocked items if a tenant ever crosses the threshold.
      // When `framework === 'all'` we deliberately raise the cap to
      // 5×MAX_PLAN_ITEMS_PER_FRAMEWORK so the unified Tiltak section
      // can render a multi-framework view without truncation surprises.
      const limit =
        framework === 'all'
          ? MAX_PLAN_ITEMS_PER_FRAMEWORK * 5
          : MAX_PLAN_ITEMS_PER_FRAMEWORK
      let query = supabase
        .from('compliance_plan_items')
        .select(PLAN_ITEM_COLUMNS)
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(limit)
      if (framework !== 'all') {
        query = query.eq('framework_id', framework)
      }
      if (signal) query = query.abortSignal(signal)
      const { data, error: err } = await query
      // On abort: don't touch state. The new effect run has already
      // set loading=true; touching loading here would race the next
      // render. Same for items/error.
      if (signal?.aborted) return
      if (err) {
        if ((err as { name?: string }).name === 'AbortError') return
        // Avoid leaking raw Postgres / RLS denial strings (incl. table
        // names) into the UI banner.
        setError(getSupabaseErrorMessage(err))
        setItems([])
        setLoading(false)
        return
      }
      setError(null)
      setItems((data ?? []) as CompliancePlanItem[])
      setLoading(false)
    },
    [supabase, orgId, framework],
  )

  useEffect(() => {
    const controller = new AbortController()
    void reload(controller.signal)
    return () => controller.abort()
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

  // Bridge: when a plan item flips into 'in_progress', mint a paired
  // task_items row (source_type='compliance_plan', source_id=<plan.id>)
  // so the closure shows up in the Tasks-modulen alongside everything
  // else the action-owner is responsible for. The DB enforces 1:1 via
  // the partial unique index `task_items_compliance_plan_bridge_uidx`
  // — a double-click race surfaces as a unique_violation which we
  // catch and treat as success (the existing row IS the bridge).
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
          pack: packForFramework(plan.framework_id),
          source_type: 'compliance_plan',
          source_id: plan.id,
          law_refs: [plan.law_ref],
          // 'tiltak' is the matching enum label on task_source_category
          // — using a value outside the enum failed silently before the
          // unique-bridge index landed. Keep this in sync with the enum
          // in 20260925120100_register_records.sql.
          source_category: 'tiltak',
          pdca_phase: 'do',
          due_date: plan.due_at,
        })
        .select('id')
        .single()
      if (insErr) {
        // Unique-violation on the partial bridge index means another
        // tab/race already inserted the bridge — fetch and link it.
        if ((insErr as { code?: string }).code === '23505') {
          const { data: existing } = await supabase
            .from('task_items')
            .select('id')
            .eq('source_type', 'compliance_plan')
            .eq('source_id', plan.id)
            .is('deleted_at', null)
            .maybeSingle()
          if (existing?.id) {
            await supabase
              .from('compliance_plan_items')
              .update({ task_id: String(existing.id) })
              .eq('id', plan.id)
            return String(existing.id)
          }
        }
        return null
      }
      if (!data) return null
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
