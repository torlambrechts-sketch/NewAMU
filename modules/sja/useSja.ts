import { useCallback, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAssignableUsers } from '../../src/hooks/useAssignableUsers'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type {
  SjaAnalysis,
  SjaControlType,
  SjaDetail,
  SjaHazard,
  SjaHazardCategory,
  SjaMeasure,
  SjaParticipant,
  SjaParticipantRole,
  SjaTask,
  SjaTemplate,
} from './types'
import {
  SjaAnalysisSchema,
  SjaHazardSchema,
  SjaMeasureSchema,
  SjaParticipantSchema,
  SjaTaskSchema,
  SjaTemplateSchema,
} from './schema'

export type SjaAssignableUser = { id: string; displayName: string }

export type SjaLocationRow = { id: string; name: string }

export type AdvanceStatusPayload = {
  stop_reason?: string
}

export type UseSjaInput = { supabase: SupabaseClient | null }

export type SjaState = {
  loading: boolean
  error: string | null
  currentUserId: string | null
  analyses: SjaAnalysis[]
  templates: SjaTemplate[]
  locations: SjaLocationRow[]
  assignableUsers: SjaAssignableUser[]
  participants: SjaParticipant[]
  tasks: SjaTask[]
  hazards: SjaHazard[]
  measures: SjaMeasure[]
  loadedDetailIds: string[]
  load: () => Promise<void>
  loadDetail: (sjaId: string) => Promise<void>
  getDetail: (sjaId: string) => SjaDetail | null
  saveAnalysisPatch: (sjaId: string, patch: Partial<SjaAnalysis>) => Promise<void>
  advanceStatus: (sjaId: string, nextStatus: SjaAnalysis['status'], payload?: AdvanceStatusPayload) => Promise<void>
  addParticipant: (input: {
    sjaId: string
    name: string
    role: SjaParticipantRole
    userId?: string | null
    company?: string | null
    certsVerified?: boolean
    certsNotes?: string | null
  }) => Promise<void>
  deleteParticipant: (participantId: string) => Promise<void>
  addTask: (sjaId: string, title: string) => Promise<SjaTask | null>
  updateTask: (taskId: string, patch: Partial<Pick<SjaTask, 'title' | 'description'>>) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  reorderTasks: (sjaId: string, orderedTaskIds: string[]) => Promise<void>
  addHazard: (
    sjaId: string,
    taskId: string,
    description: string,
    category: SjaHazardCategory,
    chemicalRef?: string | null,
  ) => Promise<SjaHazard | null>
  updateHazard: (
    hazardId: string,
    patch: Partial<
      Pick<
        SjaHazard,
        | 'description'
        | 'category'
        | 'initial_probability'
        | 'initial_consequence'
        | 'residual_probability'
        | 'residual_consequence'
        | 'chemical_ref'
      >
    >,
  ) => Promise<void>
  deleteHazard: (hazardId: string) => Promise<void>
  addMeasure: (input: {
    sjaId: string
    hazardId: string
    description: string
    controlType: SjaControlType
    assignedToId?: string | null
    assignedToName?: string | null
  }) => Promise<void>
  updateMeasure: (
    measureId: string,
    patch: Partial<Pick<SjaMeasure, 'description' | 'control_type' | 'assigned_to_id' | 'assigned_to_name' | 'completed'>>,
  ) => Promise<void>
  deleteMeasure: (measureId: string) => Promise<void>
  signParticipant: (participantId: string) => Promise<void>
  completeDebrief: (input: {
    sjaId: string
    unexpectedHazards: boolean
    debriefNotes: string
  }) => Promise<void>
  createAvvikFromDebrief: (sjaId: string) => Promise<string | null>
  createTemplate: (row: {
    name: string
    job_type: string
    description?: string | null
    required_certs?: string[] | null
    prefill_tasks?: unknown
    is_active?: boolean
  }) => Promise<SjaTemplate | null>
  updateTemplate: (
    templateId: string,
    row: {
      name?: string
      job_type?: string
      description?: string | null
      required_certs?: string[] | null
      prefill_tasks?: unknown
      is_active?: boolean
    },
  ) => Promise<void>
}

function parseRow<T>(row: unknown, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }): T | null {
  const parsed = schema.safeParse(row)
  return parsed.success ? (parsed.data as T) : null
}

function replaceById<T extends { id: string }>(list: T[], id: string, next: T): T[] {
  return list.map((row) => (row.id === id ? next : row))
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((row) => row.id !== id)
}

export function useSja({ supabase }: UseSjaInput): SjaState {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<SjaAnalysis[]>([])
  const [templates, setTemplates] = useState<SjaTemplate[]>([])
  const [locations, setLocations] = useState<SjaLocationRow[]>([])
  const [assignableUsers, setAssignableUsers] = useState<SjaAssignableUser[]>([])
  const [participants, setParticipants] = useState<SjaParticipant[]>([])
  const [tasks, setTasks] = useState<SjaTask[]>([])
  const [hazards, setHazards] = useState<SjaHazard[]>([])
  const [measures, setMeasures] = useState<SjaMeasure[]>([])
  const [loadedDetailIds, setLoadedDetailIds] = useState<string[]>([])

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase er ikke konfigurert.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [analysesRes, templatesRes, locationsRes, authRes, assignableUsersList] = await Promise.all([
        supabase.from('sja_analyses').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('sja_templates').select('*').order('name', { ascending: true }),
        supabase.from('locations').select('id, name').order('name', { ascending: true }),
        supabase.auth.getUser(),
        fetchAssignableUsers(supabase),
      ])

      if (analysesRes.error) {
        const msg = getSupabaseErrorMessage(analysesRes.error)
        const low = msg.toLowerCase()
        if (low.includes('sja_analyses') && (low.includes('does not exist') || low.includes('schema cache') || low.includes('42p01'))) {
          setError(
            'SJA-tabellene finnes ikke i databasen ennå. Be administrator kjøre migrasjonen «supabase/migrations/archive/20260720100000_sja_module.sql» (f.eks. via npm run db:migrate eller SQL Editor).',
          )
        } else {
          setError(msg)
        }
        setAnalyses([])
        setTemplates([])
        setLocations([])
        setAssignableUsers(assignableUsersList)
        setCurrentUserId(authRes.data.user?.id ?? null)
        return
      }

      setCurrentUserId(authRes.data.user?.id ?? null)

      setAnalyses(
        (analysesRes.data ?? [])
          .map((row) => parseRow(row, SjaAnalysisSchema))
          .filter((r): r is SjaAnalysis => r !== null),
      )

      const warnings: string[] = []
      if (templatesRes.error) {
        setTemplates([])
        warnings.push(`Maler: ${getSupabaseErrorMessage(templatesRes.error)}`)
      } else {
        setTemplates(
          (templatesRes.data ?? [])
            .map((row) => parseRow(row, SjaTemplateSchema))
            .filter((r): r is SjaTemplate => r !== null)
            .sort((a, b) => a.name.localeCompare(b.name, 'nb')),
        )
      }

      if (locationsRes.error) {
        setLocations([])
        warnings.push(`Lokasjoner: ${getSupabaseErrorMessage(locationsRes.error)}`)
      } else {
        setLocations(
          (locationsRes.data ?? [])
            .map((row) => {
              const o = row as { id?: string; name?: string }
              if (typeof o.id !== 'string' || typeof o.name !== 'string') return null
              return { id: o.id, name: o.name }
            })
            .filter((r): r is SjaLocationRow => r !== null),
        )
      }

      setAssignableUsers(assignableUsersList)
      if (warnings.length > 0) {
        setError(warnings.join(' '))
      }
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const mergeAnalysis = useCallback((row: SjaAnalysis) => {
    setAnalyses((prev) => {
      const i = prev.findIndex((a) => a.id === row.id)
      if (i === -1) return [row, ...prev]
      const next = [...prev]
      next[i] = row
      return next
    })
  }, [])

  const loadDetail = useCallback(
    async (sjaId: string) => {
      if (!supabase) {
        setError('Supabase er ikke konfigurert.')
        return
      }
      setError(null)
      try {
        const { data: analysisRow, error: analysisError } = await supabase
          .from('sja_analyses')
          .select('*')
          .eq('id', sjaId)
          .maybeSingle()
        if (analysisError) throw analysisError
        const analysis = parseRow(analysisRow, SjaAnalysisSchema)
        if (!analysis) return
        mergeAnalysis(analysis)

        const [pRes, tRes, hRes, mRes] = await Promise.all([
          supabase.from('sja_participants').select('*').eq('sja_id', sjaId).order('created_at', { ascending: true }),
          supabase.from('sja_tasks').select('*').eq('sja_id', sjaId).order('position', { ascending: true }),
          supabase.from('sja_hazards').select('*').eq('sja_id', sjaId).order('created_at', { ascending: true }),
          supabase.from('sja_measures').select('*').eq('sja_id', sjaId).order('created_at', { ascending: true }),
        ])
        if (pRes.error) throw pRes.error
        if (tRes.error) throw tRes.error
        if (hRes.error) throw hRes.error
        if (mRes.error) throw mRes.error

        const nextP = (pRes.data ?? [])
          .map((row) => parseRow(row, SjaParticipantSchema))
          .filter((r): r is SjaParticipant => r !== null)
        const nextT = (tRes.data ?? [])
          .map((row) => parseRow(row, SjaTaskSchema))
          .filter((r): r is SjaTask => r !== null)
        const nextH = (hRes.data ?? [])
          .map((row) => parseRow(row, SjaHazardSchema))
          .filter((r): r is SjaHazard => r !== null)
        const nextM = (mRes.data ?? [])
          .map((row) => parseRow(row, SjaMeasureSchema))
          .filter((r): r is SjaMeasure => r !== null)

        setParticipants((prev) => [...prev.filter((x) => x.sja_id !== sjaId), ...nextP])
        setTasks((prev) => [...prev.filter((x) => x.sja_id !== sjaId), ...nextT])
        setHazards((prev) => [...prev.filter((x) => x.sja_id !== sjaId), ...nextH])
        setMeasures((prev) => [...prev.filter((x) => x.sja_id !== sjaId), ...nextM])
        setLoadedDetailIds((prev) => (prev.includes(sjaId) ? prev : [...prev, sjaId]))
      } catch (e) {
        setError(getSupabaseErrorMessage(e))
      }
    },
    [supabase, mergeAnalysis],
  )

  const getDetail = useCallback(
    (sjaId: string): SjaDetail | null => {
      const analysis = analyses.find((a) => a.id === sjaId) ?? null
      if (!analysis) return null
      return {
        analysis,
        participants: participants.filter((p) => p.sja_id === sjaId),
        tasks: tasks.filter((t) => t.sja_id === sjaId).sort((a, b) => a.position - b.position),
        hazards: hazards.filter((h) => h.sja_id === sjaId),
        measures: measures.filter((m) => m.sja_id === sjaId),
      }
    },
    [analyses, participants, tasks, hazards, measures],
  )

  const saveAnalysisPatch = useCallback(
    async (sjaId: string, patch: Partial<SjaAnalysis>) => {
      if (!supabase) {
        setError('Supabase er ikke konfigurert.')
        return
      }
      setError(null)
      const row: Record<string, unknown> = Object.fromEntries(
        Object.entries({ ...patch, updated_at: new Date().toISOString() }).filter(([, v]) => v !== undefined),
      )
      delete row.id
      delete row.organization_id
      delete row.created_at
      const { data, error: upErr } = await supabase.from('sja_analyses').update(row).eq('id', sjaId).select('*').single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaAnalysisSchema)
      if (parsed) mergeAnalysis(parsed)
    },
    [supabase, mergeAnalysis],
  )

  const advanceStatus = useCallback(
    async (sjaId: string, nextStatus: SjaAnalysis['status'], payload?: AdvanceStatusPayload) => {
      const current = analyses.find((a) => a.id === sjaId)
      if (!current) return
      const updates: Partial<SjaAnalysis> = { status: nextStatus }
      if (nextStatus === 'in_execution' && current.status === 'approved') {
        updates.actual_start = new Date().toISOString()
      }
      if (nextStatus === 'completed' && current.status === 'in_execution') {
        updates.actual_end = new Date().toISOString()
      }
      if (nextStatus === 'stopped') {
        updates.stop_reason = payload?.stop_reason?.trim() || null
      }
      if (nextStatus === 'active' && current.status === 'stopped') {
        updates.stop_reason = null
      }
      await saveAnalysisPatch(sjaId, updates as Partial<SjaAnalysis>)
    },
    [analyses, saveAnalysisPatch],
  )

  const addParticipant = useCallback(
    async (input: {
      sjaId: string
      name: string
      role: SjaParticipantRole
      userId?: string | null
      company?: string | null
      certsVerified?: boolean
      certsNotes?: string | null
    }) => {
      if (!supabase) return
      setError(null)
      const row = {
        sja_id: input.sjaId,
        name: input.name.trim(),
        role: input.role,
        user_id: input.userId ?? null,
        company: input.company?.trim() || null,
        certs_verified: input.certsVerified ?? false,
        certs_notes: input.certsNotes?.trim() || null,
      }
      const { data, error: insErr } = await supabase.from('sja_participants').insert(row).select('*').single()
      if (insErr) {
        setError(insErr.message)
        return
      }
      const parsed = parseRow(data, SjaParticipantSchema)
      if (parsed) setParticipants((prev) => [...prev, parsed])
    },
    [supabase],
  )

  const deleteParticipant = useCallback(
    async (participantId: string) => {
      if (!supabase) return
      setError(null)
      const { error: delErr } = await supabase.from('sja_participants').delete().eq('id', participantId)
      if (delErr) {
        setError(delErr.message)
        return
      }
      setParticipants((prev) => removeById(prev, participantId))
    },
    [supabase],
  )

  const addTask = useCallback(
    async (sjaId: string, title: string): Promise<SjaTask | null> => {
      if (!supabase) return null
      setError(null)
      const existing = tasks.filter((t) => t.sja_id === sjaId)
      const position = existing.length > 0 ? Math.max(...existing.map((t) => t.position)) + 1 : 0
      const { data, error: insErr } = await supabase
        .from('sja_tasks')
        .insert({ sja_id: sjaId, title: title.trim(), position })
        .select('*')
        .single()
      if (insErr) {
        setError(insErr.message)
        return null
      }
      const parsed = parseRow(data, SjaTaskSchema)
      if (parsed) {
        setTasks((prev) => [...prev, parsed])
        return parsed
      }
      return null
    },
    [supabase, tasks],
  )

  const updateTask = useCallback(
    async (taskId: string, patch: Partial<Pick<SjaTask, 'title' | 'description'>>) => {
      if (!supabase) return
      setError(null)
      const row: Record<string, unknown> = {}
      if (patch.title !== undefined) row.title = patch.title
      if (patch.description !== undefined) row.description = patch.description
      const { data, error: upErr } = await supabase
        .from('sja_tasks')
        .update(row)
        .eq('id', taskId)
        .select('*')
        .single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaTaskSchema)
      if (parsed) setTasks((prev) => replaceById(prev, taskId, parsed))
    },
    [supabase],
  )

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!supabase) return
      setError(null)
      const { error: delErr } = await supabase.from('sja_tasks').delete().eq('id', taskId)
      if (delErr) {
        setError(delErr.message)
        return
      }
      setTasks((prev) => removeById(prev, taskId))
      setHazards((prev) => {
        const removedHazardIds = new Set(prev.filter((h) => h.task_id === taskId).map((h) => h.id))
        setMeasures((pm) => pm.filter((m) => !removedHazardIds.has(m.hazard_id)))
        return prev.filter((h) => h.task_id !== taskId)
      })
    },
    [supabase],
  )

  const reorderTasks = useCallback(
    async (sjaId: string, orderedTaskIds: string[]) => {
      if (!supabase) return
      setError(null)
      for (let i = 0; i < orderedTaskIds.length; i += 1) {
        const id = orderedTaskIds[i]
        const { error: upErr } = await supabase.from('sja_tasks').update({ position: i }).eq('id', id).eq('sja_id', sjaId)
        if (upErr) {
          setError(upErr.message)
          return
        }
      }
      setTasks((prev) =>
        prev.map((t) => {
          if (t.sja_id !== sjaId) return t
          const pos = orderedTaskIds.indexOf(t.id)
          return pos >= 0 ? { ...t, position: pos } : t
        }),
      )
    },
    [supabase],
  )

  const addHazard = useCallback(
    async (
      sjaId: string,
      taskId: string,
      description: string,
      category: SjaHazardCategory,
      chemicalRef?: string | null,
    ): Promise<SjaHazard | null> => {
      if (!supabase) return null
      setError(null)
      const { data, error: insErr } = await supabase
        .from('sja_hazards')
        .insert({
          sja_id: sjaId,
          task_id: taskId,
          description: description.trim(),
          category,
          chemical_ref: chemicalRef?.trim() || null,
        })
        .select('*')
        .single()
      if (insErr) {
        setError(insErr.message)
        return null
      }
      const parsed = parseRow(data, SjaHazardSchema)
      if (parsed) {
        setHazards((prev) => [...prev, parsed])
        return parsed
      }
      return null
    },
    [supabase],
  )

  const updateHazard = useCallback(
    async (
      hazardId: string,
      patch: Partial<
        Pick<
          SjaHazard,
          | 'description'
          | 'category'
          | 'initial_probability'
          | 'initial_consequence'
          | 'residual_probability'
          | 'residual_consequence'
          | 'chemical_ref'
        >
      >,
    ) => {
      if (!supabase) return
      setError(null)
      const row: Record<string, unknown> = {}
      if (patch.description !== undefined) row.description = patch.description
      if (patch.category !== undefined) row.category = patch.category
      if (patch.initial_probability !== undefined) row.initial_probability = patch.initial_probability
      if (patch.initial_consequence !== undefined) row.initial_consequence = patch.initial_consequence
      if (patch.residual_probability !== undefined) row.residual_probability = patch.residual_probability
      if (patch.residual_consequence !== undefined) row.residual_consequence = patch.residual_consequence
      if (patch.chemical_ref !== undefined) row.chemical_ref = patch.chemical_ref
      const { data, error: upErr } = await supabase
        .from('sja_hazards')
        .update(row)
        .eq('id', hazardId)
        .select('*')
        .single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaHazardSchema)
      if (parsed) setHazards((prev) => replaceById(prev, hazardId, parsed))
    },
    [supabase],
  )

  const deleteHazard = useCallback(
    async (hazardId: string) => {
      if (!supabase) return
      setError(null)
      const { error: delErr } = await supabase.from('sja_hazards').delete().eq('id', hazardId)
      if (delErr) {
        setError(delErr.message)
        return
      }
      setHazards((prev) => removeById(prev, hazardId))
      setMeasures((prev) => prev.filter((m) => m.hazard_id !== hazardId))
    },
    [supabase],
  )

  const addMeasure = useCallback(
    async (input: {
      sjaId: string
      hazardId: string
      description: string
      controlType: SjaControlType
      assignedToId?: string | null
      assignedToName?: string | null
    }) => {
      if (!supabase) return
      setError(null)
      const { data, error: insErr } = await supabase
        .from('sja_measures')
        .insert({
          sja_id: input.sjaId,
          hazard_id: input.hazardId,
          description: input.description.trim(),
          control_type: input.controlType,
          assigned_to_id: input.assignedToId ?? null,
          assigned_to_name: input.assignedToName?.trim() || null,
        })
        .select('*')
        .single()
      if (insErr) {
        setError(insErr.message)
        return
      }
      const parsed = parseRow(data, SjaMeasureSchema)
      if (parsed) setMeasures((prev) => [...prev, parsed])
    },
    [supabase],
  )

  const updateMeasure = useCallback(
    async (
      measureId: string,
      patch: Partial<
        Pick<SjaMeasure, 'description' | 'control_type' | 'assigned_to_id' | 'assigned_to_name' | 'completed'>
      >,
    ) => {
      if (!supabase) return
      setError(null)
      const body: Record<string, unknown> = {
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.control_type !== undefined ? { control_type: patch.control_type } : {}),
        ...(patch.assigned_to_id !== undefined ? { assigned_to_id: patch.assigned_to_id } : {}),
        ...(patch.assigned_to_name !== undefined ? { assigned_to_name: patch.assigned_to_name } : {}),
        ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
      }
      if (patch.completed === true) {
        body.completed_at = new Date().toISOString()
      }
      if (patch.completed === false) {
        body.completed_at = null
      }
      const { data, error: upErr } = await supabase
        .from('sja_measures')
        .update(body)
        .eq('id', measureId)
        .select('*')
        .single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaMeasureSchema)
      if (parsed) setMeasures((prev) => replaceById(prev, measureId, parsed))
    },
    [supabase],
  )

  const deleteMeasure = useCallback(
    async (measureId: string) => {
      if (!supabase) return
      setError(null)
      const { error: delErr } = await supabase.from('sja_measures').delete().eq('id', measureId)
      if (delErr) {
        setError(delErr.message)
        return
      }
      setMeasures((prev) => removeById(prev, measureId))
    },
    [supabase],
  )

  const signParticipant = useCallback(
    async (participantId: string) => {
      if (!supabase) return
      setError(null)
      const now = new Date().toISOString()
      const { data, error: upErr } = await supabase
        .from('sja_participants')
        .update({ signed_at: now })
        .eq('id', participantId)
        .select('*')
        .single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaParticipantSchema)
      if (parsed) setParticipants((prev) => replaceById(prev, participantId, parsed))
    },
    [supabase],
  )

  const completeDebrief = useCallback(
    async (input: { sjaId: string; unexpectedHazards: boolean; debriefNotes: string }) => {
      if (!supabase) return
      setError(null)
      const uid = (await supabase.auth.getUser()).data.user?.id ?? null
      const { data, error: upErr } = await supabase
        .from('sja_analyses')
        .update({
          unexpected_hazards: input.unexpectedHazards,
          debrief_notes: input.debriefNotes.trim(),
          debrief_completed_by: uid,
          debrief_completed_at: new Date().toISOString(),
          status: 'archived',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.sjaId)
        .select('*')
        .single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaAnalysisSchema)
      if (parsed) mergeAnalysis(parsed)
    },
    [supabase, mergeAnalysis],
  )

  const createAvvikFromDebrief = useCallback(
    async (sjaId: string): Promise<string | null> => {
      if (!supabase) return null
      setError(null)
      const analysis = analyses.find((a) => a.id === sjaId)
      if (!analysis) return null
      const title = `SJA: Uventede hendelser — ${analysis.title}`.slice(0, 200)
      const description =
        (analysis.debrief_notes ?? '').trim() ||
        'Uventede farekilder rapportert i SJA-debrief. Se SJA for detaljer.'
      const { data, error: insErr } = await supabase
        .from('deviations')
        .insert({
          title,
          description,
          severity: 'high',
          status: 'rapportert',
          source: 'sja_debrief',
          source_id: sjaId,
        })
        .select('id')
        .single()
      if (insErr) {
        setError(insErr.message)
        return null
      }
      const id = typeof (data as { id?: string })?.id === 'string' ? (data as { id: string }).id : null
      if (id) {
        await saveAnalysisPatch(sjaId, { avvik_created: true })
      }
      return id
    },
    [supabase, analyses, saveAnalysisPatch],
  )

  const createTemplate = useCallback(
    async (row: {
      name: string
      job_type: string
      description?: string | null
      required_certs?: string[] | null
      prefill_tasks?: unknown
      is_active?: boolean
    }): Promise<SjaTemplate | null> => {
      if (!supabase) return null
      setError(null)
      const { data, error: insErr } = await supabase
        .from('sja_templates')
        .insert({
          name: row.name.trim(),
          job_type: row.job_type,
          description: row.description ?? null,
          required_certs: row.required_certs ?? null,
          prefill_tasks: row.prefill_tasks ?? null,
          is_active: row.is_active ?? true,
        })
        .select('*')
        .single()
      if (insErr) {
        setError(insErr.message)
        return null
      }
      const parsed = parseRow(data, SjaTemplateSchema)
      if (parsed) {
        setTemplates((prev) => [...prev.filter((t) => t.id !== parsed.id), parsed].sort((a, b) => a.name.localeCompare(b.name, 'nb')))
        return parsed
      }
      return null
    },
    [supabase],
  )

  const updateTemplate = useCallback(
    async (
      templateId: string,
      row: {
        name?: string
        job_type?: string
        description?: string | null
        required_certs?: string[] | null
        prefill_tasks?: unknown
        is_active?: boolean
      },
    ) => {
      if (!supabase) return
      setError(null)
      const body: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (row.name !== undefined) body.name = row.name.trim()
      if (row.job_type !== undefined) body.job_type = row.job_type
      if (row.description !== undefined) body.description = row.description
      if (row.required_certs !== undefined) body.required_certs = row.required_certs
      if (row.prefill_tasks !== undefined) body.prefill_tasks = row.prefill_tasks
      if (row.is_active !== undefined) body.is_active = row.is_active
      const { data, error: upErr } = await supabase
        .from('sja_templates')
        .update(body)
        .eq('id', templateId)
        .select('*')
        .single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaTemplateSchema)
      if (parsed) {
        setTemplates((prev) => prev.map((t) => (t.id === templateId ? parsed : t)))
      }
    },
    [supabase],
  )

  return useMemo(
    () => ({
      loading,
      error,
      currentUserId,
      analyses,
      templates,
      locations,
      assignableUsers,
      participants,
      tasks,
      hazards,
      measures,
      loadedDetailIds,
      load,
      loadDetail,
      getDetail,
      saveAnalysisPatch,
      advanceStatus,
      addParticipant,
      deleteParticipant,
      addTask,
      updateTask,
      deleteTask,
      reorderTasks,
      addHazard,
      updateHazard,
      deleteHazard,
      addMeasure,
      updateMeasure,
      deleteMeasure,
      signParticipant,
      completeDebrief,
      createAvvikFromDebrief,
      createTemplate,
      updateTemplate,
    }),
    [
      loading,
      error,
      currentUserId,
      analyses,
      templates,
      locations,
      assignableUsers,
      participants,
      tasks,
      hazards,
      measures,
      loadedDetailIds,
      load,
      loadDetail,
      getDetail,
      saveAnalysisPatch,
      advanceStatus,
      addParticipant,
      deleteParticipant,
      addTask,
      updateTask,
      deleteTask,
      reorderTasks,
      addHazard,
      updateHazard,
      deleteHazard,
      addMeasure,
      updateMeasure,
      deleteMeasure,
      signParticipant,
      completeDebrief,
      createAvvikFromDebrief,
      createTemplate,
      updateTemplate,
    ],
  )
}
