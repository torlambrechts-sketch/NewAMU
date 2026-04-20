import { useCallback, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAssignableUsers } from '../../src/hooks/useAssignableUsers'
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
  stampRoundGps: (roundId: string) => Promise<void>
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
    riskProbability?: number
    riskConsequence?: number
    assignedTo?: string | null
  }) => Promise<boolean>
  updateFinding: (payload: {
    findingId: string
    description: string
    severity: InspectionFindingRow['severity']
    itemId?: string | null
    riskProbability?: number | null
    riskConsequence?: number | null
    assignedTo?: string | null
  }) => Promise<boolean>
  deleteFinding: (findingId: string) => Promise<void>
  createDeviationFromFinding: (findingId: string) => Promise<string | null>
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
      const [templatesRes, locationsRes, roundsRes, authUserRes, assignableUsersList] = await Promise.all([
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
        supabase.auth.getUser(),
        fetchAssignableUsers(supabase),
      ])
      if (templatesRes.error) throw templatesRes.error
      if (locationsRes.error) throw locationsRes.error
      if (roundsRes.error) throw roundsRes.error
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
      setAssignableUsers(assignableUsersList)
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
      setError(null)
      try {
        const { data: roundRow, error: roundError } = await supabase
          .from('inspection_rounds')
          .select('*')
          .eq('id', roundId)
          .maybeSingle()
        if (roundError) throw roundError
        const parsedRound = InspectionRoundRowSchema.safeParse(roundRow)
        if (!parsedRound.success || !roundRow) {
          return
        }

        setRounds((previous) => {
          const idx = previous.findIndex((r) => r.id === roundId)
          if (idx === -1) return [parsedRound.data, ...previous]
          const next = [...previous]
          next[idx] = parsedRound.data
          return next
        })

        const itemsRes = await supabase
          .from('inspection_items')
          .select('*')
          .eq('round_id', roundId)
          .order('position', { ascending: true })
        if (itemsRes.error) throw itemsRes.error
        const nextItems = parseRows<InspectionItemRow>(itemsRes.data ?? [], (row) => {
          const parsed = InspectionItemRowSchema.safeParse(row)
          return parsed.success ? parsed.data : null
        })
        setItems((previous) => {
          const rest = previous.filter((item) => item.round_id !== roundId)
          return [...nextItems, ...rest]
        })

        // Load findings separately so a failures here never blocks checklist items above.
        const findingsRes = await supabase
          .from('inspection_findings')
          .select('*, deviations(assigned_to, status)')
          .eq('round_id', roundId)
          .order('created_at', { ascending: false })
        let nextFindings: InspectionFindingRow[] = []
        if (findingsRes.error) {
          setError(findingsRes.error.message)
        } else {
          nextFindings = parseRows<InspectionFindingRow>(findingsRes.data ?? [], (row) => {
            const r = row as Record<string, unknown>
            const dev = r.deviations
            let deviation_assigned_to: string | null | undefined
            let deviation_status: string | null | undefined
            if (dev && typeof dev === 'object') {
              const d = Array.isArray(dev) ? dev[0] : dev
              if (d && typeof d === 'object') {
                const o = d as Record<string, unknown>
                deviation_assigned_to = o.assigned_to == null ? null : String(o.assigned_to)
                deviation_status = o.status == null ? null : String(o.status)
              }
            }
            const { deviations, ...rest } = r
            void deviations
            const merged = { ...rest, deviation_assigned_to, deviation_status }
            const parsed = InspectionFindingRowSchema.safeParse(merged)
            if (!parsed.success) return null
            const del = parsed.data.deleted_at
            if (del != null && String(del).trim() !== '') return null
            return parsed.data
          })
        }
        setFindings((previous) => {
          const rest = previous.filter((f) => f.round_id !== roundId)
          return [...nextFindings, ...rest]
        })
        setLoadedRoundIds((previous) => (previous.includes(roundId) ? previous : [...previous, roundId]))
      } catch (unknownError) {
        const message = unknownError instanceof Error ? unknownError.message : 'Failed loading round detail.'
        setError(message)
      }
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
      riskProbability?: number
      riskConsequence?: number
      assignedTo?: string | null
    }): Promise<boolean> => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return false
      }
      setError(null)
      const desc = payload.description.trim()
      let organizationId: string | null = null
      const fromState = rounds.find((r) => r.id === payload.roundId)
      if (fromState) {
        organizationId = fromState.organization_id
      } else {
        const { data: rRow, error: rErr } = await supabase
          .from('inspection_rounds')
          .select('organization_id')
          .eq('id', payload.roundId)
          .maybeSingle()
        if (rErr || !rRow) {
          setError(rErr?.message ?? 'Fant ikke runden.')
          return false
        }
        organizationId = String((rRow as { organization_id: string }).organization_id)
      }
      if (!organizationId) {
        setError('Mangler organisasjon for runden.')
        return false
      }

      const titleBase = desc.slice(0, 80)
      const deviationInsert: Record<string, unknown> = {
        organization_id: organizationId,
        source: 'inspection_finding',
        title: `Avvik: ${titleBase}`,
        description: desc,
        severity: payload.severity,
        status: 'rapportert',
        assigned_to: payload.assignedTo?.trim() ? payload.assignedTo : null,
      }
      const { data: devRow, error: devErr } = await supabase
        .from('deviations')
        .insert(deviationInsert)
        .select('id')
        .single()

      const findingBase: Record<string, unknown> = {
        round_id: payload.roundId,
        item_id: payload.itemId ?? null,
        description: desc,
        severity: payload.severity,
        photo_path: payload.photoPath ?? null,
      }
      if (payload.riskProbability != null) findingBase.risk_probability = payload.riskProbability
      if (payload.riskConsequence != null) findingBase.risk_consequence = payload.riskConsequence

      let data: unknown
      let insertError: { message: string } | null = null

      if (!devErr && devRow?.id) {
        const deviationId = String((devRow as { id: string }).id)
        const findingInsert = {
          ...findingBase,
          deviation_id: deviationId,
          workflow_processed_at: new Date().toISOString(),
        }
        const ins = await supabase
          .from('inspection_findings')
          .insert(findingInsert)
          .select('*, deviations(assigned_to, status)')
          .single()
        data = ins.data
        insertError = ins.error
        if (!insertError && ins.data) {
          const fid = String((ins.data as { id: string }).id)
          const { error: linkErr } = await supabase.from('deviations').update({ source_id: fid }).eq('id', deviationId)
          if (linkErr) {
            setError(linkErr.message)
            return false
          }
        } else if (insertError) {
          await supabase.from('deviations').delete().eq('id', deviationId)
        }
      } else {
        const ins = await supabase
          .from('inspection_findings')
          .insert(findingBase)
          .select('*, deviations(assigned_to, status)')
          .single()
        data = ins.data
        insertError = ins.error
        if (devErr && !insertError) {
          setError(
            `Kunne ikke opprette koblet avvik (${devErr.message}). Observasjonen er lagret; prøv «Opprett avvik» på raden eller kontakt administrator.`,
          )
        }
      }

      if (insertError) {
        setError(insertError.message)
        return false
      }

      const rowNorm = (() => {
        const r = data as Record<string, unknown>
        const dev = r.deviations
        let deviation_assigned_to: string | null | undefined
        let deviation_status: string | null | undefined
        if (dev && typeof dev === 'object') {
          const d = Array.isArray(dev) ? dev[0] : dev
          if (d && typeof d === 'object') {
            const o = d as Record<string, unknown>
            deviation_assigned_to = o.assigned_to == null ? null : String(o.assigned_to)
            deviation_status = o.status == null ? null : String(o.status)
          }
        }
        const { deviations, ...rest } = r
        void deviations
        return { ...rest, deviation_assigned_to, deviation_status }
      })()
      const parsed = InspectionFindingRowSchema.safeParse(rowNorm)
      if (!parsed.success) {
        setError('Kunne ikke lese opprettet avvik/funn.')
        return false
      }
      setFindings((previous) => [parsed.data, ...previous])
      return true
    },
    [supabase, rounds],
  )

  const updateFinding = useCallback(
    async (payload: {
      findingId: string
      description: string
      severity: InspectionFindingRow['severity']
      itemId?: string | null
      riskProbability?: number | null
      riskConsequence?: number | null
      assignedTo?: string | null
    }): Promise<boolean> => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return false
      }
      const finding = findings.find((f) => f.id === payload.findingId)
      if (!finding) {
        setError('Fant ikke avviket.')
        return false
      }
      setError(null)
      const desc = payload.description.trim()
      const row: Record<string, unknown> = {
        description: desc,
        severity: payload.severity,
        item_id: payload.itemId === undefined ? finding.item_id : payload.itemId,
        risk_probability: payload.riskProbability ?? null,
        risk_consequence: payload.riskConsequence ?? null,
      }
      const { data, error: upErr } = await supabase
        .from('inspection_findings')
        .update(row)
        .eq('id', payload.findingId)
        .select('*, deviations(assigned_to, status)')
        .single()
      if (upErr) {
        setError(upErr.message)
        return false
      }
      const rowNorm = (() => {
        const r = data as Record<string, unknown>
        const dev = r.deviations
        let deviation_assigned_to: string | null | undefined
        let deviation_status: string | null | undefined
        if (dev && typeof dev === 'object') {
          const d = Array.isArray(dev) ? dev[0] : dev
          if (d && typeof d === 'object') {
            const o = d as Record<string, unknown>
            deviation_assigned_to = o.assigned_to == null ? null : String(o.assigned_to)
            deviation_status = o.status == null ? null : String(o.status)
          }
        }
        const { deviations, ...rest } = r
        void deviations
        return { ...rest, deviation_assigned_to, deviation_status }
      })()
      const parsed = InspectionFindingRowSchema.safeParse(rowNorm)
      if (!parsed.success) {
        setError('Kunne ikke lese oppdatert avvik.')
        return false
      }

      if (finding.deviation_id) {
        const titleBase = desc.slice(0, 80)
        const devPatch: Record<string, unknown> = {
          title: `Avvik: ${titleBase}`,
          description: desc,
          severity: payload.severity,
        }
        if (payload.assignedTo !== undefined) {
          devPatch.assigned_to = payload.assignedTo?.trim() ? payload.assignedTo : null
        }
        const { error: devUpErr } = await supabase.from('deviations').update(devPatch).eq('id', finding.deviation_id)
        if (devUpErr) {
          setError(devUpErr.message)
          return false
        }
      }

      let mergedFinding = parsed.data
      if (finding.deviation_id && payload.assignedTo !== undefined) {
        mergedFinding = {
          ...parsed.data,
          deviation_assigned_to: payload.assignedTo?.trim() ? payload.assignedTo : null,
        }
      }

      setFindings((previous) => previous.map((f) => (f.id === payload.findingId ? mergedFinding : f)))
      return true
    },
    [supabase, findings],
  )

  const deleteFinding = useCallback(
    async (findingId: string) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }
      const deviationId = findings.find((f) => f.id === findingId)?.deviation_id ?? null
      setError(null)
      const now = new Date().toISOString()
      const { error: softErr } = await supabase
        .from('inspection_findings')
        .update({ deleted_at: now })
        .eq('id', findingId)
      if (softErr) {
        const msg = softErr.message ?? ''
        const missingCol = /deleted_at|schema cache|column/i.test(msg)
        if (missingCol) {
          const { error: delErr } = await supabase.from('inspection_findings').delete().eq('id', findingId)
          if (delErr) {
            setError(delErr.message)
            return
          }
          if (deviationId) {
            await supabase.from('deviations').delete().eq('id', deviationId)
          }
        } else {
          setError(softErr.message)
          return
        }
      } else if (deviationId) {
        const { error: devSoft } = await supabase.from('deviations').update({ deleted_at: now }).eq('id', deviationId)
        if (devSoft && /deleted_at|schema cache|column/i.test(devSoft.message ?? '')) {
          await supabase.from('deviations').delete().eq('id', deviationId)
        }
      }
      setFindings((previous) => previous.filter((f) => f.id !== findingId))
    },
    [supabase, findings],
  )

  const createDeviationFromFinding = useCallback(
    async (findingId: string) => {
      if (!supabase) {
        setError('Supabase is not configured.')
        return null
      }
      const finding = findings.find((f) => f.id === findingId)
      if (!finding) {
        setError('Fant ikke funnet.')
        return null
      }
      if (finding.deviation_id) {
        return finding.deviation_id
      }
      if (!finding.description?.trim()) {
        setError('Funn mangler beskrivelse — kan ikke opprette avvik.')
        return null
      }
      setError(null)
      const titleBase = finding.description.trim().slice(0, 80)
      const deviationInsert = {
        organization_id: finding.organization_id,
        source: 'inspection_finding',
        source_id: findingId,
        title: `Avvik: ${titleBase}`,
        description: finding.description,
        severity: finding.severity,
        status: 'rapportert' as const,
      }
      const { data: devRow, error: devErr } = await supabase
        .from('deviations')
        .insert(deviationInsert)
        .select('id')
        .single()
      if (devErr || !devRow?.id) {
        setError(devErr?.message ?? 'Kunne ikke opprette avvik.')
        return null
      }
      const newDeviationId = String(devRow.id)
      const { data: updatedFinding, error: linkErr } = await supabase
        .from('inspection_findings')
        .update({ deviation_id: newDeviationId })
        .eq('id', findingId)
        .select('*, deviations(assigned_to, status)')
        .single()
      if (linkErr || !updatedFinding) {
        setError(linkErr?.message ?? 'Avvik opprettet, men kunne ikke koble til funn.')
        return newDeviationId
      }
      const rowNorm = (() => {
        const r = updatedFinding as Record<string, unknown>
        const dev = r.deviations
        let deviation_assigned_to: string | null | undefined
        let deviation_status: string | null | undefined
        if (dev && typeof dev === 'object') {
          const d = Array.isArray(dev) ? dev[0] : dev
          if (d && typeof d === 'object') {
            const o = d as Record<string, unknown>
            deviation_assigned_to = o.assigned_to == null ? null : String(o.assigned_to)
            deviation_status = o.status == null ? null : String(o.status)
          }
        }
        const { deviations, ...rest } = r
        void deviations
        return { ...rest, deviation_assigned_to, deviation_status }
      })()
      const parsed = InspectionFindingRowSchema.safeParse(rowNorm)
      if (!parsed.success) {
        setError('Kunne ikke lese oppdatert funn.')
        return newDeviationId
      }
      setFindings((previous) => previous.map((f) => (f.id === findingId ? parsed.data : f)))
      return newDeviationId
    },
    [supabase, findings],
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

  const stampRoundGps = useCallback(
    async (roundId: string) => {
      if (!supabase || !navigator.geolocation) return
      setError(null)
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const row = {
              gps_lat: pos.coords.latitude,
              gps_lon: pos.coords.longitude,
              gps_accuracy_m: pos.coords.accuracy,
              gps_stamped_at: new Date().toISOString(),
            }
            const { data, error } = await supabase
              .from('inspection_rounds')
              .update(row)
              .eq('id', roundId)
              .select('*')
              .single()
            if (error) {
              setError(error.message)
              resolve()
              return
            }
            const parsed = InspectionRoundRowSchema.safeParse(data)
            if (parsed.success) {
              setRounds((prev) => prev.map((r) => (r.id === roundId ? parsed.data : r)))
            } else {
              setError('Failed to parse round after GPS stamp.')
            }
            resolve()
          },
          (err) => {
            setError(`GPS ikke tilgjengelig: ${err.message}`)
            resolve()
          },
          { enableHighAccuracy: true, timeout: 10_000 },
        )
      })
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
    stampRoundGps,
    saveRoundSummary,
    upsertItemResponse,
    addFinding,
    updateFinding,
    deleteFinding,
    createDeviationFromFinding,
  }
}
