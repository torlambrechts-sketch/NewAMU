import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type {
  VernerunderRow,
  VernerundeCategoryRow,
  VernerundeCheckpointRow,
  VernerundeFindingRow,
  VernerundeParticipantRow,
  VernerunderStatus,
  VernerundeTemplateItemRow,
  VernerundeTemplateRow,
  VernerunderWorkflowEventName,
  VernerunderWorkflowDispatchPayload,
} from './types'
import {
  parseCategoryList,
  parseCheckpointList,
  parseFindingList,
  parseParticipantList,
  parseTemplateItemList,
  parseTemplateList,
  parseVernerunderList,
  parseVernerunderRow,
  VernerunderWorkflowDispatchPayloadSchema,
} from './schema'

function isLockedStatus(s: VernerunderStatus) {
  return s === 'completed' || s === 'signed'
}

type ParentStatus = Pick<VernerunderRow, 'id' | 'status' | 'organization_id'>

export function useVernerunde() {
  const { supabase, organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('vernerunder.manage')

  const [vernerunder, setVernerunder] = useState<VernerunderRow[]>([])
  const [categories, setCategories] = useState<VernerundeCategoryRow[]>([])
  const [templates, setTemplates] = useState<VernerundeTemplateRow[]>([])
  const [templateItemsByTemplateId, setTemplateItemsByTemplateId] = useState<Record<string, VernerundeTemplateItemRow[]>>(
    {},
  )
  const [checkpointsByRunde, setCheckpointsByRunde] = useState<Record<string, VernerundeCheckpointRow[]>>({})
  const [participantsByRunde, setParticipantsByRunde] = useState<Record<string, VernerundeParticipantRow[]>>({})
  const [findingsByRunde, setFindingsByRunde] = useState<Record<string, VernerundeFindingRow[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setErr = useCallback((e: unknown) => {
    setError(getSupabaseErrorMessage(e))
  }, [])

  const assertOrg = useCallback(() => {
    if (!orgId) {
      setError('Ingen organisasjon valgt.')
      return null
    }
    return orgId
  }, [orgId])

  const assertCanManage = useCallback(() => {
    if (!canManage) {
      setError('Du har ikke tilgang til å administrere vernerunder.')
      return false
    }
    return true
  }, [canManage])

  const loadCatalog = useCallback(async () => {
    const o = assertOrg()
    if (!supabase || !o) return
    setLoading(true)
    setError(null)
    try {
      const [cRes, tRes] = await Promise.all([
        supabase
          .from('vernerunde_categories')
          .select('*')
          .eq('organization_id', o)
          .order('name', { ascending: true }),
        supabase
          .from('vernerunde_templates')
          .select('*')
          .eq('organization_id', o)
          .order('name', { ascending: true }),
      ])
      if (cRes.error) throw cRes.error
      if (tRes.error) throw tRes.error
      setCategories(parseCategoryList((cRes.data as unknown[]) ?? []))
      setTemplates(parseTemplateList((tRes.data as unknown[]) ?? []))
    } catch (e) {
      setErr(e)
    } finally {
      setLoading(false)
    }
  }, [assertOrg, supabase, setErr])

  const loadRounds = useCallback(async () => {
    const o = assertOrg()
    if (!supabase || !o) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('vernerunder')
        .select('*')
        .eq('organization_id', o)
        .order('planned_date', { ascending: false, nullsFirst: true })
        .order('created_at', { ascending: false })
      if (qErr) throw qErr
      setVernerunder(parseVernerunderList((data as unknown[]) ?? []))
    } catch (e) {
      setErr(e)
    } finally {
      setLoading(false)
    }
  }, [assertOrg, supabase, setErr])

  const load = useCallback(async () => {
    await loadRounds()
    await loadCatalog()
  }, [loadRounds, loadCatalog])

  useEffect(() => {
    void load()
  }, [load])

  const fetchParentStatus = useCallback(
    async (vernerundeId: string): Promise<ParentStatus | null> => {
      const o = assertOrg()
      if (!supabase || !o) return null
      const { data, error: qErr } = await supabase
        .from('vernerunder')
        .select('id, status, organization_id')
        .eq('id', vernerundeId)
        .eq('organization_id', o)
        .maybeSingle()
      if (qErr) {
        setErr(qErr)
        return null
      }
      if (!data) {
        setError('Fant ikke vernerunden.')
        return null
      }
      return data as ParentStatus
    },
    [assertOrg, supabase, setErr],
  )

  const assertNotLocked = useCallback(
    async (vernerundeId: string) => {
      const row = await fetchParentStatus(vernerundeId)
      if (!row) return { ok: false as const, row: null as ParentStatus | null }
      if (isLockedStatus(row.status as VernerunderStatus)) {
        setError('Vernerunden er låst (fullført eller signert) og kan ikke endres.')
        return { ok: false as const, row }
      }
      return { ok: true as const, row }
    },
    [fetchParentStatus],
  )

  const loadTemplateItems = useCallback(
    async (templateId: string) => {
      const o = assertOrg()
      if (!supabase || !o) return
      setError(null)
      try {
        const { data, error: qErr } = await supabase
          .from('vernerunde_template_items')
          .select('*')
          .eq('organization_id', o)
          .eq('template_id', templateId)
          .order('position', { ascending: true })
        if (qErr) throw qErr
        setTemplateItemsByTemplateId((prev) => ({
          ...prev,
          [templateId]: parseTemplateItemList((data as unknown[]) ?? []),
        }))
      } catch (e) {
        setErr(e)
      }
    },
    [assertOrg, supabase, setErr],
  )

  const loadRoundChildren = useCallback(
    async (vernerundeId: string) => {
      const o = assertOrg()
      if (!supabase || !o) return
      setError(null)
      try {
        const [ck, p, f] = await Promise.all([
          supabase
            .from('vernerunde_checkpoints')
            .select('*')
            .eq('organization_id', o)
            .eq('vernerunde_id', vernerundeId)
            .order('created_at', { ascending: true }),
          supabase
            .from('vernerunde_participants')
            .select('*')
            .eq('organization_id', o)
            .eq('vernerunde_id', vernerundeId)
            .order('created_at', { ascending: true }),
          supabase
            .from('vernerunde_findings')
            .select('*')
            .eq('organization_id', o)
            .eq('vernerunde_id', vernerundeId)
            .order('created_at', { ascending: false }),
        ])
        if (ck.error) throw ck.error
        if (p.error) throw p.error
        if (f.error) throw f.error
        setCheckpointsByRunde((prev) => ({ ...prev, [vernerundeId]: parseCheckpointList((ck.data as unknown[]) ?? []) }))
        setParticipantsByRunde((prev) => ({ ...prev, [vernerundeId]: parseParticipantList((p.data as unknown[]) ?? []) }))
        setFindingsByRunde((prev) => ({ ...prev, [vernerundeId]: parseFindingList((f.data as unknown[]) ?? []) }))
      } catch (e) {
        setErr(e)
      }
    },
    [assertOrg, supabase, setErr],
  )

  const createVernerunde = useCallback(
    async (input: { title: string; template_id?: string | null; planned_date?: string | null; status?: VernerunderStatus }) => {
      const o = assertOrg()
      if (!supabase || !o || !assertCanManage()) return null
      setError(null)
      try {
        const { data, error: ins } = await supabase
          .from('vernerunder')
          .insert({
            organization_id: o,
            title: input.title.trim(),
            template_id: input.template_id ?? null,
            planned_date: input.planned_date ?? null,
            status: input.status ?? 'draft',
          })
          .select('*')
          .single()
        if (ins) throw ins
        const p = parseVernerunderRow(data)
        if (!p.success) {
          setError('Ugyldig svar fra server ved opprettelse av vernerunde.')
          return null
        }
        setVernerunder((prev) => [p.data, ...prev])
        return p.data
      } catch (e) {
        setErr(e)
        return null
      }
    },
    [assertOrg, assertCanManage, supabase, setErr],
  )

  const updateVernerunde = useCallback(
    async (id: string, patch: Partial<Pick<VernerunderRow, 'title' | 'planned_date' | 'template_id' | 'status'>>) => {
      const o = assertOrg()
      if (!supabase || !o || !assertCanManage()) return
      setError(null)
      const m = await assertNotLocked(id)
      if (!m.ok) return
      try {
        const { data, error: u } = await supabase
          .from('vernerunder')
          .update(patch)
          .eq('id', id)
          .eq('organization_id', o)
          .select('*')
          .single()
        if (u) throw u
        const p = parseVernerunderRow(data)
        if (p.success) {
          setVernerunder((prev) => prev.map((r) => (r.id === p.data.id ? p.data : r)))
        } else {
          setError('Ugyldig svar ved oppdatering.')
        }
      } catch (e) {
        setErr(e)
      }
    },
    [assertOrg, assertCanManage, supabase, assertNotLocked, setErr],
  )

  const addCategory = useCallback(
    async (name: string) => {
      const o = assertOrg()
      if (!supabase || !o || !assertCanManage()) return null
      setError(null)
      try {
        const { data, error: e } = await supabase
          .from('vernerunde_categories')
          .insert({ organization_id: o, name: name.trim() })
          .select('*')
          .single()
        if (e) throw e
        const list = parseCategoryList([data])
        const row = list[0]
        if (row) setCategories((c) => [...c, row].sort((a, b) => a.name.localeCompare(b.name, 'nb')))
        return row ?? null
      } catch (err) {
        setErr(err)
        return null
      }
    },
    [assertOrg, assertCanManage, supabase, setErr],
  )

  const addTemplate = useCallback(
    async (input: { name: string; description?: string | null }) => {
      const o = assertOrg()
      if (!supabase || !o || !assertCanManage()) return null
      setError(null)
      try {
        const { data, error: e } = await supabase
          .from('vernerunde_templates')
          .insert({ organization_id: o, name: input.name.trim(), description: input.description?.trim() ?? null })
          .select('*')
          .single()
        if (e) throw e
        const list = parseTemplateList([data])
        const row = list[0]
        if (row) setTemplates((t) => [...t, row].sort((a, b) => a.name.localeCompare(b.name, 'nb')))
        return row ?? null
      } catch (err) {
        setErr(err)
        return null
      }
    },
    [assertOrg, assertCanManage, supabase, setErr],
  )

  const addTemplateItem = useCallback(
    async (input: { templateId: string; question_text: string; category_id?: string | null; position?: number }) => {
      const o = assertOrg()
      if (!supabase || !o || !assertCanManage()) return null
      setError(null)
      try {
        const { data, error: e } = await supabase
          .from('vernerunde_template_items')
          .insert({
            template_id: input.templateId,
            organization_id: o,
            question_text: input.question_text.trim(),
            category_id: input.category_id ?? null,
            position: input.position ?? 0,
          })
          .select('*')
          .single()
        if (e) throw e
        const list = parseTemplateItemList([data])
        const row = list[0]
        if (row) {
          setTemplateItemsByTemplateId((prev) => {
            const cur = prev[input.templateId] ?? []
            return { ...prev, [input.templateId]: [...cur, row].sort((a, b) => a.position - b.position) }
          })
        }
        return row ?? null
      } catch (err) {
        setErr(err)
        return null
      }
    },
    [assertOrg, assertCanManage, supabase, setErr],
  )

  const addCheckpoint = useCallback(
    async (vernerundeId: string, input: { question_text: string; original_template_item_id?: string | null }) => {
      const o = assertOrg()
      if (!supabase || !o || !assertCanManage()) return null
      const m = await assertNotLocked(vernerundeId)
      if (!m.ok) return null
      setError(null)
      try {
        const { data, error: e } = await supabase
          .from('vernerunde_checkpoints')
          .insert({
            organization_id: o,
            vernerunde_id: vernerundeId,
            question_text: input.question_text.trim(),
            original_template_item_id: input.original_template_item_id ?? null,
          })
          .select('*')
          .single()
        if (e) throw e
        const list = parseCheckpointList([data])
        const row = list[0]
        if (row) {
          setCheckpointsByRunde((prev) => ({
            ...prev,
            [vernerundeId]: [...(prev[vernerundeId] ?? []), row].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            ),
          }))
        }
        return row ?? null
      } catch (err) {
        setErr(err)
        return null
      }
    },
    [assertOrg, assertCanManage, supabase, assertNotLocked, setErr],
  )

  const addFinding = useCallback(
    async (
      vernerundeId: string,
      input: {
        description: string
        severity: VernerundeFindingRow['severity']
        checkpoint_id?: string | null
        category_id?: string | null
      },
    ) => {
      const o = assertOrg()
      if (!supabase || !o || !assertCanManage()) return null
      const m = await assertNotLocked(vernerundeId)
      if (!m.ok) return null
      setError(null)
      try {
        const { data, error: e } = await supabase
          .from('vernerunde_findings')
          .insert({
            organization_id: o,
            vernerunde_id: vernerundeId,
            description: input.description.trim(),
            severity: input.severity,
            checkpoint_id: input.checkpoint_id ?? null,
            category_id: input.category_id ?? null,
          })
          .select('*')
          .single()
        if (e) throw e
        const list = parseFindingList([data])
        const row = list[0]
        if (row) {
          setFindingsByRunde((prev) => ({ ...prev, [vernerundeId]: [row, ...(prev[vernerundeId] ?? [])] }))
        }
        return row ?? null
      } catch (err) {
        setErr(err)
        return null
      }
    },
    [assertOrg, assertCanManage, supabase, assertNotLocked, setErr],
  )

  const addParticipant = useCallback(
    async (vernerundeId: string, input: { user_id: string; role: VernerundeParticipantRow['role'] }) => {
      const o = assertOrg()
      if (!supabase || !o || !assertCanManage()) return null
      const m = await assertNotLocked(vernerundeId)
      if (!m.ok) return null
      setError(null)
      try {
        const { data, error: e } = await supabase
          .from('vernerunde_participants')
          .insert({
            organization_id: o,
            vernerunde_id: vernerundeId,
            user_id: input.user_id,
            role: input.role,
          })
          .select('*')
          .single()
        if (e) throw e
        const list = parseParticipantList([data])
        const row = list[0]
        if (row) {
          setParticipantsByRunde((prev) => ({ ...prev, [vernerundeId]: [...(prev[vernerundeId] ?? []), row] }))
        }
        return row ?? null
      } catch (err) {
        setErr(err)
        return null
      }
    },
    [assertOrg, assertCanManage, supabase, assertNotLocked, setErr],
  )

  const signParticipant = useCallback(
    async (participantId: string, vernerundeId: string) => {
      const o = assertOrg()
      if (!supabase || !o || !assertCanManage()) return
      const m = await assertNotLocked(vernerundeId)
      if (!m.ok) return
      setError(null)
      try {
        const { data, error: e } = await supabase
          .from('vernerunde_participants')
          .update({ signed_at: new Date().toISOString() })
          .eq('id', participantId)
          .eq('organization_id', o)
          .eq('vernerunde_id', vernerundeId)
          .select('*')
          .single()
        if (e) throw e
        const list = parseParticipantList([data])
        const row = list[0]
        if (row) {
          setParticipantsByRunde((prev) => {
            const cur = prev[vernerundeId] ?? []
            return { ...prev, [vernerundeId]: cur.map((p) => (p.id === row.id ? row : p)) }
          })
        }
      } catch (err) {
        setErr(err)
      }
    },
    [assertOrg, assertCanManage, supabase, assertNotLocked, setErr],
  )

  const dispatchVernerunderWorkflow = useCallback(
    async (event: VernerunderWorkflowEventName, payload: VernerunderWorkflowDispatchPayload) => {
      if (!assertCanManage()) {
        return { ok: false as const, error: 'Ingen tilgang' }
      }
      const o = assertOrg()
      if (!o) return { ok: false as const, error: 'Ingen organisasjon' }
      const withOrg: VernerunderWorkflowDispatchPayload = { ...payload, row: { ...payload.row, organization_id: o } }
      const parsed = VernerunderWorkflowDispatchPayloadSchema.safeParse(withOrg)
      if (!parsed.success) {
        const msg = 'Ugyldig arbeidsflyt-nyttelast.'
        setError(msg)
        return { ok: false as const, error: msg }
      }
      if (!supabase) {
        setError('Supabase er ikke tilgjengelig.')
        return { ok: false as const, error: 'Ingen supabase' }
      }
      setError(null)
      const { error: rErr } = await supabase.rpc('workflow_emit_vernerunder_event', {
        p_event: event,
        p_payload: parsed.data as never,
      })
      if (rErr) {
        setErr(rErr)
        return { ok: false as const, error: getSupabaseErrorMessage(rErr) }
      }
      return { ok: true as const }
    },
    [assertCanManage, assertOrg, supabase, setErr, setError],
  )

  const byId = useMemo(() => {
    const m: Record<string, VernerunderRow> = {}
    for (const r of vernerunder) m[r.id] = r
    return m
  }, [vernerunder])

  return {
    organizationId: orgId,
    canManage,
    vernerunder,
    categories,
    templates,
    templateItemsByTemplateId,
    checkpointsByRunde,
    participantsByRunde,
    findingsByRunde,
    byId,
    loading,
    error,
    setError,
    load,
    loadRounds,
    loadCatalog,
    loadRoundChildren,
    loadTemplateItems,
    createVernerunde,
    updateVernerunde,
    addCategory,
    addTemplate,
    addTemplateItem,
    addCheckpoint,
    addFinding,
    addParticipant,
    signParticipant,
    fetchParentStatus,
    isLockedByStatus: isLockedStatus,
    dispatchVernerunderWorkflow,
  }
}
