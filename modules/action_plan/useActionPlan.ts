import { useCallback, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import { fetchAssignableUsers, type AssignableUser } from '../../src/hooks/useAssignableUsers'
import type { ActionPlanItemRow, CreateActionPlanItemInput, UpdateActionPlanItemInput } from './types'
import {
  collectParsedActionPlanItems,
  collectParsedCategories,
  parseActionPlanItemRow,
} from './schema'
import type { ActionPlanCategoryRow } from './types'

function isImmutableStatus(s: ActionPlanItemRow['status']): boolean {
  return s === 'resolved' || s === 'verified'
}

function endOfLocalDayIso(dateYmd: string) {
  return new Date(`${dateYmd}T23:59:59`).toISOString()
}

function isActionPlanItemOverdue(row: ActionPlanItemRow) {
  if (isImmutableStatus(row.status) || row.status === 'draft') return false
  if (row.status === 'overdue') return true
  const s = row.deadline ?? row.due_at
  if (!s) return false
  const t = new Date(s).getTime()
  if (Number.isNaN(t)) return false
  return t < Date.now() && !isImmutableStatus(row.status)
}

/** Aktive rader: ikke løst/verifisert */
function isActiveItem(row: ActionPlanItemRow) {
  return !isImmutableStatus(row.status)
}

export function useActionPlan({ supabase }: { supabase: SupabaseClient | null }) {
  const { organization, can, isAdmin, user } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('action_plan.manage')
  const currentUserId = user?.id ?? null

  const [items, setItems] = useState<ActionPlanItemRow[]>([])
  const [categories, setCategories] = useState<ActionPlanCategoryRow[]>([])
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setErr = useCallback((e: unknown) => {
    setError(getSupabaseErrorMessage(e))
  }, [])

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const [iRes, cRes, uList] = await Promise.all([
        supabase
          .from('action_plan_items')
          .select('*')
          .eq('organization_id', orgId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('action_plan_categories')
          .select('*')
          .eq('organization_id', orgId)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        fetchAssignableUsers(supabase),
      ])
      if (iRes.error) throw iRes.error
      if (cRes.error) throw cRes.error
      if (iRes.data != null) {
        setItems(collectParsedActionPlanItems(iRes.data as unknown[]))
      } else {
        setItems([])
      }
      if (cRes.data != null) {
        setCategories(collectParsedCategories(cRes.data))
      } else {
        setCategories([])
      }
      setAssignableUsers(uList)
    } catch (e) {
      setErr(e)
    } finally {
      setLoading(false)
    }
  }, [orgId, supabase, setErr])

  const createItem = useCallback(
    async (input: CreateActionPlanItemInput) => {
      if (!supabase || !orgId) {
        setError('Supabase er ikke konfigurert.')
        return
      }
      if (!input.title?.trim()) {
        setError('Tittel er påkrevd.')
        return
      }
      setError(null)
      const deadline = endOfLocalDayIso(input.deadline.slice(0, 10))
      const sourceId =
        input.sourceId ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `gen-${Date.now()}`)
      const row: Record<string, unknown> = {
        organization_id: orgId,
        source_table: input.sourceTable,
        source_id: sourceId,
        source_module: input.sourceModule,
        title: input.title.trim(),
        description: (input.description ?? '').trim(),
        status: input.status,
        priority: input.priority,
        category_id: input.categoryId,
        due_at: deadline,
        deadline,
        responsible_id: input.assignedTo,
        assigned_to: input.assignedTo,
      }
      const { data, error: e } = await supabase
        .from('action_plan_items')
        .insert(row)
        .select('*')
        .maybeSingle()
      if (e) {
        setErr(e)
        return
      }
      if (data) {
        const p = parseActionPlanItemRow(data)
        if (!p.success) setErr(p.error)
      }
      void load()
    },
    [orgId, supabase, load, setErr],
  )

  const updateItem = useCallback(
    async (input: UpdateActionPlanItemInput) => {
      if (!supabase || !orgId) {
        setError('Supabase er ikke konfigurert.')
        return
      }
      setError(null)
      const current = items.find((x) => x.id === input.id)
      if (!current) {
        setError('Fant ikke tiltaket.')
        return
      }
      if (isImmutableStatus(current.status)) {
        setError('Løst eller verifisert tiltak kan ikke endres.')
        return
      }

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (input.title != null) patch.title = input.title
      if (input.description != null) patch.description = input.description
      if (input.status != null) patch.status = input.status
      if (input.priority != null) patch.priority = input.priority
      if (input.categoryId !== undefined) patch.category_id = input.categoryId
      if (input.sourceModule != null) patch.source_module = input.sourceModule
      if (input.sourceId != null) {
        patch.source_id = input.sourceId
        if (input.sourceTable != null) patch.source_table = input.sourceTable
      }
      if (input.assignedTo !== undefined) {
        patch.assigned_to = input.assignedTo
        patch.responsible_id = input.assignedTo
      }
      if (input.deadline != null) {
        const d = input.deadline.includes('T') ? input.deadline : endOfLocalDayIso(input.deadline.slice(0, 10))
        patch.due_at = d
        patch.deadline = d
      }

      const { data, error: e } = await supabase
        .from('action_plan_items')
        .update(patch)
        .eq('id', input.id)
        .eq('organization_id', orgId)
        .select('*')
        .maybeSingle()
      if (e) {
        setErr(e)
        return
      }
      if (data) {
        const p = parseActionPlanItemRow(data)
        if (p.success) {
          setItems((prev) => prev.map((x) => (x.id === p.data.id ? p.data : x)))
        } else {
          setErr(p.error)
        }
      }
      void load()
    },
    [orgId, supabase, items, setErr, load],
  )

  const deleteItem = useCallback(
    async (id: string) => {
      if (!canManage) {
        setError('Du har ikke tilgang til å slette.')
        return
      }
      if (!supabase || !orgId) return
      const current = items.find((x) => x.id === id)
      if (current && isImmutableStatus(current.status)) {
        setError('Løst eller verifisert tiltak kan ikke slettes.')
        return
      }
      setError(null)
      const { error: e } = await supabase.from('action_plan_items').delete().eq('id', id).eq('organization_id', orgId)
      if (e) {
        setErr(e)
        return
      }
      setItems((prev) => prev.filter((x) => x.id !== id))
    },
    [canManage, orgId, supabase, items, setErr],
  )

  const saveCategory = useCallback(
    async (payload: { id?: string; name: string; sort_order?: number }) => {
      if (!supabase || !orgId || !canManage) {
        setError('Ingen tilgang til kategorier.')
        return
      }
      setError(null)
      if (!payload.name.trim()) {
        setError('Navn er påkrevd.')
        return
      }
      if (payload.id) {
        const { data, error: e } = await supabase
          .from('action_plan_categories')
          .update({ name: payload.name.trim(), sort_order: payload.sort_order ?? 0, updated_at: new Date().toISOString() })
          .eq('id', payload.id)
          .eq('organization_id', orgId)
          .select('*')
          .maybeSingle()
        if (e) {
          setErr(e)
          return
        }
        if (data) {
          setCategories((prev) => {
            const parsed = collectParsedCategories([data])
            if (parsed.length === 0) return prev
            return prev.map((c) => (c.id === payload.id ? parsed[0]! : c))
          })
        }
      } else {
        const { data, error: e } = await supabase
          .from('action_plan_categories')
          .insert({
            organization_id: orgId,
            name: payload.name.trim(),
            sort_order: payload.sort_order ?? categories.length,
            updated_at: new Date().toISOString(),
          })
          .select('*')
          .maybeSingle()
        if (e) {
          setErr(e)
          return
        }
        if (data) {
          setCategories((prev) => [...prev, ...collectParsedCategories([data])])
        }
      }
    },
    [orgId, supabase, canManage, categories.length, setErr],
  )

  const deleteCategory = useCallback(
    async (id: string) => {
      if (!supabase || !orgId || !canManage) return
      setError(null)
      const { error: e } = await supabase
        .from('action_plan_categories')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId)
      if (e) {
        setErr(e)
        return
      }
      setCategories((prev) => prev.filter((c) => c.id !== id))
    },
    [orgId, supabase, canManage, setErr],
  )

  return {
    organization,
    canManage,
    can,
    isAdmin,
    orgId,
    currentUserId,
    items,
    categories,
    assignableUsers,
    loading,
    error,
    setError,
    load,
    createItem,
    updateItem,
    deleteItem,
    saveCategory,
    deleteCategory,
    isItemOverdue: isActionPlanItemOverdue,
    isActiveItem,
  }
}

export type UseActionPlanState = ReturnType<typeof useActionPlan>
