import { useCallback, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  InspectionChecklistItem,
  InspectionFindingRow,
  InspectionItemRow,
  InspectionLocationRow,
  InspectionRoundRow,
  InspectionTemplateRow,
} from './types'
import {
  InspectionFindingRowSchema,
  InspectionItemRowSchema,
  InspectionLocationRowSchema,
  InspectionRoundRowSchema,
  InspectionTemplateRowSchema,
  parseChecklistItems,
} from './schema'

type UseInspectionModuleInput = {
  supabase: SupabaseClient | null
}

export type InspectionAssignableUser = {
  id: string
  displayName: string
}

export type InspectionModuleState = {
  loading: boolean
  error: string | null
  currentUserId: string | null
  templates: InspectionTemplateRow[]
  locations: InspectionLocationRow[]
  rounds: InspectionRoundRow[]
  assignableUsers: InspectionAssignableUser[]
  itemsByRoundId: Record<string, InspectionItemRow[]>
  findingsByRoundId: Record<string, InspectionFindingRow[]>
  load: () => Promise<void>
  loadRoundDetail: (roundId: string) => Promise<void>
  createTemplate: (payload: { name: string; checklistItems?: InspectionChecklistItem[] }) => Promise<void>
  updateTemplate: (payload: {
    templateId: string
    name: string
    checklistItems: InspectionChecklistItem[]
    isActive?: boolean
  }) => Promise<void>
  createLocation: (payload: { name: string; locationCode?: string; description?: string }) => Promise<void>
  createRound: (payload: {
    templateId: string
    locationId?: string
    title: string
    scheduledFor?: string
    cronExpression?: string
    assignedTo?: string
  }) => Promise<void>
  updateRoundSchedule: (payload: {
    roundId: string
    scheduledFor?: string
    cronExpression?: string
    assignedTo?: string
    status?: InspectionRoundRow['status']
  }) => Promise<void>
  signRound: (roundId: string) => Promise<void>
  signRoundWithRole: (roundId: string, role: 'manager' | 'deputy') => Promise<void>
  saveRoundSummary: (payload: {
    roundId: string
    summary: string
    conductedBy?: string | null
    conductedAt?: string | null
  }) => Promise<void>
  upsertItemResponse: (payload: {
    roundId: string
    checklistItemKey: string
    checklistItemLabel: string
    position: number
    response: Record<string, unknown>
    status?: string
    notes?: string
    photoPath?: string
  }) => Promise<void>
  addFinding: (payload: {
    roundId: string
    itemId?: string
    description: string
    severity: InspectionFindingRow['severity']
    photoPath?: string
  }) => Promise<void>
  deleteFinding: (findingId: string) => Promise<void>
}

function groupByRound<T extends { round_id: string }>(rows: T[]): Record<string, T[]> {
  return rows.reduce<Record<string, T[]>>((acc, row) => {
    if (!acc[row.round_id]) acc[row.round_id] = []
    acc[row.round_id].push(row)
    return acc
  }, {})
}

function parseRows<T>(rows: unknown[], parser: (row: unknown) => T | null): T[] {
  return rows
    .map(parser)
    .filter((row): row is T => row !== null)
}

function normalizeTimestamptzInput(input: string | undefined): string | null {
  if (!input || input.trim().length === 0) return null
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export function useInspectionModule({ supabase }: UseInspectionModuleInput): InspectionModuleState {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<InspectionTemplateRow[]>([])
  const [locations, setLocations] = useState<InspectionLocationRow[]>([])
  const [rounds, setRounds] = useState<InspectionRoundRow[]>([])
  const [assignableUsers, setAssignableUsers] = useState<InspectionAssignableUser[]>([])
  const [items, setItems] = useState<InspectionItemRow[]>([])
  const [findings, setFindings] = useState<InspectionFindingRow[]>([])
  const [loadedRoundIds, setLoadedRoundIds] = useState<string[]>([])

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [templatesRes, locationsRes, roundsRes, usersRes, authUserRes] = await Promise.all([
        supabase
          .from('inspection_templates')
          .select('*')
          .eq('is_active', true)
          .order('updated_at', { ascending: false }),
        supabase
          .from('inspection_locations')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase.from('inspection_rounds').select('*').order('scheduled_for', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, display_name')
          .order('display_name', { ascending: true }),
        supabase.auth.getUser(),
      ])
      if (templatesRes.error) throw templatesRes.error
      if (locationsRes.error) throw locationsRes.error
      if (roundsRes.error) throw roundsRes.error
      if (usersRes.error) throw usersRes.error
      setCurrentUserId(authUserRes.data.user?.id ?? null)

      const nextTemplates = parseRows<InspectionTemplateRow>(templatesRes.data ?? [], (row) => {
        const parsed = InspectionTemplateRowSchema.safeParse(row)
        return parsed.success ? parsed.data : null
      })
      const nextLocations = parseRows<InspectionLocationRow>(locationsRes.data ?? [], (row) => {
        const parsed = InspectionLocationRowSchema.safeParse(row)
        return parsed.success ? parsed.data : null
      })
      const nextRounds = parseRows<InspectionRoundRow>(roundsRes.data ?? [], (row) => {
        const parsed = InspectionRoundRowSchema.safeParse(row)
        return parsed.success ? parsed.data : null
      })

      setTemplates(nextTemplates)
      setLocations(nextLocations)
      setRounds(nextRounds)
      setAssignableUsers(
        (usersRes.data ?? [])
          .map((row) => {
            const id = typeof row.id === 'string' ? row.id : ''
            if (!id) return null
            const displayName =
              typeof row.display_name === 'string' && row.display_name.trim().length > 0
                ? row.display_name.trim()
                : id
            return { id, displayName }
          })
          .filter((row): row is InspectionAssignableUser => row !== null),
      )
      setItems([])
      setFindings([])
      setLoadedRoundIds([])
    } catch (unknownError) {
      const message = unknownError instanceof Error ? unknownError.message : 'Failed loading inspection module.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const loadRoundDetail = useCallback(
    async (roundId: string) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }

      const [itemsRes, findingsRes] = await Promise.all([
        supabase
          .from('inspection_items')
          .select('*')
          .eq('round_id', roundId)
          .order('position', { ascending: true }),
        supabase
          .from('inspection_findings')
          .select('*')
          .eq('round_id', roundId)
          .order('created_at', { ascending: false }),
      ])

      if (itemsRes.error) {
        setError(itemsRes.error.message)
        return
      }
      if (findingsRes.error) {
        setError(findingsRes.error.message)
        return
      }

      const nextItems = parseRows<InspectionItemRow>(itemsRes.data ?? [], (row) => {
        const parsed = InspectionItemRowSchema.safeParse(row)
        return parsed.success ? parsed.data : null
      })
      const nextFindings = parseRows<InspectionFindingRow>(findingsRes.data ?? [], (row) => {
        const parsed = InspectionFindingRowSchema.safeParse(row)
        return parsed.success ? parsed.data : null
      })

      setItems((previous) => [...previous.filter((item) => item.round_id !== roundId), ...nextItems])
      setFindings((previous) => [...previous.filter((finding) => finding.round_id !== roundId), ...nextFindings])
      setLoadedRoundIds((previous) => (previous.includes(roundId) ? previous : [...previous, roundId]))
    },
    [supabase],
  )

  const createTemplate = useCallback(
    async (payload: { name: string; checklistItems?: InspectionChecklistItem[] }) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }
      setError(null)
      const checklistItems = payload.checklistItems ?? []
      const row = {
        name: payload.name.trim(),
        checklist_definition: {
          title: payload.name.trim(),
          items: checklistItems,
        },
        is_active: true,
      }
      const { data, error: insertError } = await supabase
        .from('inspection_templates')
        .insert(row)
        .select('*')
        .single()
      if (insertError) {
        setError(insertError.message)
        return
      }
      const parsed = InspectionTemplateRowSchema.safeParse(data)
      if (!parsed.success) {
        setError('Failed to parse created template.')
        return
      }
      setTemplates((previous) => [parsed.data, ...previous])
    },
    [supabase],
  )

  const updateTemplate = useCallback(
    async (payload: {
      templateId: string
      name: string
      checklistItems: InspectionChecklistItem[]
      isActive?: boolean
    }) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }
      setError(null)
      const row = {
        name: payload.name.trim(),
        checklist_definition: {
          title: payload.name.trim(),
          items: payload.checklistItems,
        },
        ...(payload.isActive === undefined ? {} : { is_active: payload.isActive }),
      }
      const { data, error: updateError } = await supabase
        .from('inspection_templates')
        .update(row)
        .eq('id', payload.templateId)
        .select('*')
        .single()
      if (updateError) {
        setError(updateError.message)
        return
      }
      const parsed = InspectionTemplateRowSchema.safeParse(data)
      if (!parsed.success) {
        setError('Failed to parse updated template.')
        return
      }
      setTemplates((previous) =>
        previous.map((template) => (template.id === payload.templateId ? parsed.data : template)),
      )
    },
    [supabase],
  )

  const createLocation = useCallback(
    async (payload: { name: string; locationCode?: string; description?: string }) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }
      setError(null)
      const row = {
        name: payload.name.trim(),
        location_code: payload.locationCode?.trim() || null,
        description: payload.description?.trim() || null,
        metadata: {},
        is_active: true,
      }
      const { data, error: insertError } = await supabase
        .from('inspection_locations')
        .insert(row)
        .select('*')
        .single()
      if (insertError) {
        setError(insertError.message)
        return
      }
      const parsed = InspectionLocationRowSchema.safeParse(data)
      if (!parsed.success) {
        setError('Failed to parse created location.')
        return
      }
      setLocations((previous) => [...previous, parsed.data].sort((a, b) => a.name.localeCompare(b.name)))
    },
    [supabase],
  )

  const createRound = useCallback(
    async (payload: {
      templateId: string
      locationId?: string
      title: string
      scheduledFor?: string
      cronExpression?: string
      assignedTo?: string
    }) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }
      setError(null)
      const roundInsert = {
        template_id: payload.templateId,
        location_id: payload.locationId ?? null,
        title: payload.title.trim(),
        scheduled_for: normalizeTimestamptzInput(payload.scheduledFor),
        cron_expression: payload.cronExpression ?? null,
        assigned_to: payload.assignedTo ?? null,
        status: 'draft',
      }
      const { data, error: insertError } = await supabase
        .from('inspection_rounds')
        .insert(roundInsert)
        .select('*')
        .single()
      if (insertError) {
        setError(insertError.message)
        return
      }
      const parsedRound = InspectionRoundRowSchema.safeParse(data)
      if (!parsedRound.success) {
        const fields = parsedRound.error.issues.map((i) => i.path.join('.')).join(', ')
        setError(`Failed to parse created inspection round (fields: ${fields}). Run migration 20260617140000 if missing.`)
        return
      }
      setRounds((previous) => [parsedRound.data, ...previous])

      const template = templates.find((entry) => entry.id === payload.templateId)
      if (!template) return
      const checklistItems = parseChecklistItems(template.checklist_definition)
      if (checklistItems.length === 0) return

      const itemRows = checklistItems.map((item: InspectionChecklistItem, index) => ({
        round_id: parsedRound.data.id,
        checklist_item_key: item.key,
        checklist_item_label: item.label,
        position: index,
        response: {},
        status: 'pending',
      }))
      const { data: createdItems, error: itemsError } = await supabase
        .from('inspection_items')
        .insert(itemRows)
        .select('*')
      if (itemsError) {
        setError(itemsError.message)
        return
      }
      const parsedItems = parseRows<InspectionItemRow>(createdItems ?? [], (row) => {
        const parsed = InspectionItemRowSchema.safeParse(row)
        return parsed.success ? parsed.data : null
      })
      setItems((previous) => [...parsedItems, ...previous])
    },
    [supabase, templates],
  )

  const updateRoundSchedule = useCallback(
    async (payload: {
      roundId: string
      scheduledFor?: string
      cronExpression?: string
      assignedTo?: string
      status?: InspectionRoundRow['status']
    }) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }
      setError(null)
      const row = {
        ...(payload.scheduledFor === undefined
          ? {}
          : { scheduled_for: normalizeTimestamptzInput(payload.scheduledFor) }),
        ...(payload.cronExpression === undefined ? {} : { cron_expression: payload.cronExpression || null }),
        ...(payload.assignedTo === undefined ? {} : { assigned_to: payload.assignedTo || null }),
        ...(payload.status === undefined ? {} : { status: payload.status }),
      }
      const { data, error: updateError } = await supabase
        .from('inspection_rounds')
        .update(row)
        .eq('id', payload.roundId)
        .select('*')
        .single()
      if (updateError) {
        setError(updateError.message)
        return
      }
      const parsed = InspectionRoundRowSchema.safeParse(data)
      if (!parsed.success) {
        setError('Failed to parse updated round schedule.')
        return
      }
      setRounds((previous) => previous.map((round) => (round.id === payload.roundId ? parsed.data : round)))
    },
    [supabase],
  )

  const signRound = useCallback(
    async (roundId: string) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }
      setError(null)
      const { data, error: updateError } = await supabase
        .from('inspection_rounds')
        .update({ status: 'signed' })
        .eq('id', roundId)
        .select('*')
        .single()
      if (updateError) {
        setError(updateError.message)
        return
      }
      const parsed = InspectionRoundRowSchema.safeParse(data)
      if (!parsed.success) {
        setError('Failed to parse signed inspection round.')
        return
      }
      setRounds((previous) => previous.map((round) => (round.id === roundId ? parsed.data : round)))
    },
    [supabase],
  )

  const upsertItemResponse = useCallback(
    async (payload: {
      roundId: string
      checklistItemKey: string
      checklistItemLabel: string
      position: number
      response: Record<string, unknown>
      status?: string
      notes?: string
      photoPath?: string
    }) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }
      setError(null)
      const itemPayload = {
        round_id: payload.roundId,
        checklist_item_key: payload.checklistItemKey,
        checklist_item_label: payload.checklistItemLabel,
        position: payload.position,
        response: payload.response,
        status: payload.status ?? 'completed',
        notes: payload.notes ?? null,
        photo_path: payload.photoPath ?? null,
      }
      const { data: existingRows, error: existingError } = await supabase
        .from('inspection_items')
        .select('id')
        .eq('round_id', payload.roundId)
        .eq('checklist_item_key', payload.checklistItemKey)
        .limit(1)
      if (existingError) {
        setError(existingError.message)
        return
      }

      const existingId = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0].id : null
      const upsertQuery = existingId
        ? supabase.from('inspection_items').update(itemPayload).eq('id', existingId).select('*').single()
        : supabase.from('inspection_items').insert(itemPayload).select('*').single()

      const { data, error: upsertError } = await upsertQuery
      if (upsertError) {
        setError(upsertError.message)
        return
      }
      const parsed = InspectionItemRowSchema.safeParse(data)
      if (!parsed.success) {
        setError('Failed to parse inspection checklist response.')
        return
      }
      setItems((previous) => {
        const found = previous.some((item) => item.id === parsed.data.id)
        if (!found) return [parsed.data, ...previous]
        return previous.map((item) => (item.id === parsed.data.id ? parsed.data : item))
      })
    },
    [supabase],
  )

  const addFinding = useCallback(
    async (payload: {
      roundId: string
      itemId?: string
      description: string
      severity: InspectionFindingRow['severity']
      photoPath?: string
    }) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }
      setError(null)
      const findingInsert = {
        round_id: payload.roundId,
        item_id: payload.itemId ?? null,
        description: payload.description.trim(),
        severity: payload.severity,
        photo_path: payload.photoPath ?? null,
      }
      const { data, error: insertError } = await supabase
        .from('inspection_findings')
        .insert(findingInsert)
        .select('*')
        .single()
      if (insertError) {
        setError(insertError.message)
        return
      }
      const parsed = InspectionFindingRowSchema.safeParse(data)
      if (!parsed.success) {
        setError('Failed to parse inspection finding.')
        return
      }
      setFindings((previous) => [parsed.data, ...previous])
    },
    [supabase],
  )

  const deleteFinding = useCallback(
    async (findingId: string) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }
      setError(null)
      const { error: deleteError } = await supabase
        .from('inspection_findings')
        .delete()
        .eq('id', findingId)
      if (deleteError) {
        setError(deleteError.message)
        return
      }
      setFindings((previous) => previous.filter((finding) => finding.id !== findingId))
    },
    [supabase],
  )

  const signRoundWithRole = useCallback(
    async (roundId: string, role: 'manager' | 'deputy') => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }
      setError(null)
      const { error: rpcError } = await supabase.rpc('sign_inspection_round', {
        p_round_id: roundId,
        p_role: role,
      })
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      const { data, error: fetchError } = await supabase
        .from('inspection_rounds')
        .select('*')
        .eq('id', roundId)
        .single()
      if (fetchError) {
        setError(fetchError.message)
        return
      }
      const parsed = InspectionRoundRowSchema.safeParse(data)
      if (!parsed.success) {
        setError('Failed to parse round after signing.')
        return
      }
      setRounds((previous) => previous.map((r) => (r.id === roundId ? parsed.data : r)))
    },
    [supabase],
  )

  const saveRoundSummary = useCallback(
    async (payload: {
      roundId: string
      summary: string
      conductedBy?: string | null
      conductedAt?: string | null
    }) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }
      setError(null)
      const row: Record<string, unknown> = { summary: payload.summary }
      if (payload.conductedBy !== undefined) row.conducted_by = payload.conductedBy || null
      if (payload.conductedAt !== undefined) {
        row.conducted_at = normalizeTimestamptzInput(payload.conductedAt || undefined)
      }
      const { data, error: updateError } = await supabase
        .from('inspection_rounds')
        .update(row)
        .eq('id', payload.roundId)
        .select('*')
        .single()
      if (updateError) {
        setError(updateError.message)
        return
      }
      const parsed = InspectionRoundRowSchema.safeParse(data)
      if (!parsed.success) {
        setError('Failed to parse round after summary save.')
        return
      }
      setRounds((previous) => previous.map((r) => (r.id === payload.roundId ? parsed.data : r)))
    },
    [supabase],
  )

  const itemsByRoundId = useMemo(() => {
    const grouped = groupByRound(items)
    for (const roundId of loadedRoundIds) {
      if (!grouped[roundId]) grouped[roundId] = []
    }
    return grouped
  }, [items, loadedRoundIds])

  const findingsByRoundId = useMemo(() => {
    const grouped = groupByRound(findings)
    for (const roundId of loadedRoundIds) {
      if (!grouped[roundId]) grouped[roundId] = []
    }
    return grouped
  }, [findings, loadedRoundIds])

  return {
    loading,
    error,
    currentUserId,
    templates,
    locations,
    rounds,
    assignableUsers,
    itemsByRoundId,
    findingsByRoundId,
    load,
    loadRoundDetail,
    createTemplate,
    updateTemplate,
    createLocation,
    createRound,
    updateRoundSchedule,
    signRound,
    signRoundWithRole,
    saveRoundSummary,
    upsertItemResponse,
    addFinding,
    deleteFinding,
  }
}
