import { useCallback, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAssignableUsers } from '../../src/hooks/useAssignableUsers'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type {
  SjaAnalysis,
  SjaControlType,
  SjaDetail,
  SjaHazard,
  SjaHazardCategory,
  SjaJobType,
  SjaMeasure,
  SjaParticipant,
  SjaParticipantRole,
  SjaTask,
  SjaTemplate,
  SjaTemplateHazard,
  SjaTemplateTask,
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

export type CreateSjaAnalysisPayload = {
  title: string
  templateId?: string | null
  jobType: SjaJobType
  jobDescription?: string
  triggerReason?: string
  locationId?: string | null
  locationText?: string | null
  responsibleId?: string | null
  scheduledStart?: string | null
  scheduledEnd?: string | null
}

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
  createAnalysis: (payload: CreateSjaAnalysisPayload) => Promise<SjaAnalysis | null>
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
    isFromTemplate?: boolean
    isMandatory?: boolean
  }) => Promise<void>
  updateMeasure: (
    measureId: string,
    patch: Partial<
      Pick<
        SjaMeasure,
        | 'description'
        | 'control_type'
        | 'assigned_to_id'
        | 'assigned_to_name'
        | 'completed'
        | 'is_from_template'
        | 'is_mandatory'
        | 'deletion_justification'
        | 'deleted_at'
        | 'deleted_by'
      >
    >,
  ) => Promise<void>
  deleteMeasure: (measureId: string, opts?: { justification?: string | null }) => Promise<void>
  hardDeleteMeasure: (measureId: string) => Promise<void>
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
    required_ppe?: string[] | null
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
      required_ppe?: string[] | null
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
  const { organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('sja.manage')

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
    if (!orgId) {
      setError('Organisasjon er ikke valgt.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [analysesRes, templatesRes, locationsRes, authRes, assignableUsersList] = await Promise.all([
        supabase
          .from('sja_analyses')
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('sja_templates')
          .select('*')
          .eq('organization_id', orgId)
          .order('name', { ascending: true }),
        supabase
          .from('locations')
          .select('id, name')
          .eq('organization_id', orgId)
          .order('name', { ascending: true }),
        supabase.auth.getUser(),
        fetchAssignableUsers(supabase, orgId),
      ])

      if (analysesRes.error) {
        const msg = getSupabaseErrorMessage(analysesRes.error)
        const low = msg.toLowerCase()
        if (low.includes('sja_analyses') && (low.includes('does not exist') || low.includes('schema cache') || low.includes('42p01'))) {
          setError(
            'SJA-tabellene finnes ikke i databasen ennå. Be administrator kjøre migrasjonen «supabase/migrations/20260720100000_sja_module.sql» (f.eks. via npm run db:migrate eller SQL Editor).',
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
  }, [supabase, orgId])

  const mergeAnalysis = useCallback((row: SjaAnalysis) => {
    setAnalyses((prev) => {
      const i = prev.findIndex((a) => a.id === row.id)
      if (i === -1) return [row, ...prev]
      const next = [...prev]
      next[i] = row
      return next
    })
  }, [])

  const createAnalysis = useCallback(
    async (payload: CreateSjaAnalysisPayload): Promise<SjaAnalysis | null> => {
      if (!supabase) {
        setError('Supabase er ikke konfigurert.')
        return null
      }
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å opprette SJA.')
        return null
      }
      const title = payload.title.trim()
      if (!title) {
        setError('Tittel er påkrevd.')
        return null
      }
      setError(null)
      const jobDescription = (payload.jobDescription ?? '').trim() || '—'
      const triggerReason = (payload.triggerReason ?? 'non_routine').trim() || 'non_routine'
      const scheduledStartIso =
        payload.scheduledStart?.trim() && !Number.isNaN(new Date(payload.scheduledStart).getTime())
          ? new Date(payload.scheduledStart).toISOString()
          : null
      const scheduledEndIso =
        payload.scheduledEnd?.trim() && !Number.isNaN(new Date(payload.scheduledEnd).getTime())
          ? new Date(payload.scheduledEnd).toISOString()
          : null
      const row = {
        organization_id: orgId,
        title,
        job_description: jobDescription,
        job_type: payload.jobType,
        trigger_reason: triggerReason,
        template_id: payload.templateId ?? null,
        location_id: payload.locationId ?? null,
        location_text: payload.locationText?.trim() ? payload.locationText.trim() : null,
        responsible_id: payload.responsibleId ?? null,
        scheduled_start: scheduledStartIso,
        scheduled_end: scheduledEndIso,
        status: 'draft' as const,
      }
      const { data, error: insErr } = await supabase
        .from('sja_analyses')
        .insert(row)
        .select('*')
        .eq('organization_id', orgId)
        .single()
      if (insErr) {
        setError(getSupabaseErrorMessage(insErr))
        return null
      }
      const parsed = parseRow(data, SjaAnalysisSchema)
      if (!parsed) {
        setError('Kunne ikke tolke ny SJA fra databasen.')
        return null
      }
      mergeAnalysis(parsed)

      const tplId = payload.templateId ?? null
      if (tplId) {
        const tpl = templates.find((t) => t.id === tplId) ?? null
        const prefill = tpl?.prefill_tasks
        if (tpl && Array.isArray(prefill) && prefill.length > 0) {
          const sortedTasks = [...prefill].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) as SjaTemplateTask[]
          for (let ti = 0; ti < sortedTasks.length; ti += 1) {
            const pt = sortedTasks[ti]
            const title = typeof pt.title === 'string' ? pt.title.trim() : ''
            if (!title) continue
            const { data: taskRow, error: taskErr } = await supabase
              .from('sja_tasks')
              .insert({
                sja_id: parsed.id,
                title,
                description: typeof pt.description === 'string' ? pt.description.trim() || null : null,
                position: typeof pt.position === 'number' ? pt.position : ti,
              })
              .select('*, sja_analyses!inner(organization_id)')
              .eq('sja_analyses.organization_id', orgId)
              .single()
            if (taskErr) {
              setError(taskErr.message)
              break
            }
            const taskParsed = parseRow(taskRow, SjaTaskSchema)
            if (!taskParsed) continue
            setTasks((prev) => [...prev, taskParsed])

            const hazards = Array.isArray(pt.hazards) ? (pt.hazards as SjaTemplateHazard[]) : []
            for (const th of hazards) {
              const hzDesc = typeof th.description === 'string' ? th.description.trim() : ''
              if (!hzDesc) continue
              const catRaw = typeof th.category === 'string' ? th.category : 'other'
              const category = (
                [
                  'fall',
                  'chemical',
                  'electrical',
                  'mechanical',
                  'fire',
                  'ergonomic',
                  'dropped_object',
                  'other',
                ].includes(catRaw)
                  ? catRaw
                  : 'other'
              ) as SjaHazardCategory
              const { data: hazRow, error: hazErr } = await supabase
                .from('sja_hazards')
                .insert({
                  sja_id: parsed.id,
                  task_id: taskParsed.id,
                  description: hzDesc,
                  category,
                })
                .select('*, sja_analyses!inner(organization_id)')
                .eq('sja_analyses.organization_id', orgId)
                .single()
              if (hazErr) {
                setError(hazErr.message)
                break
              }
              const hazParsed = parseRow(hazRow, SjaHazardSchema)
              if (!hazParsed) continue
              setHazards((prev) => [...prev, hazParsed])

              const mz = Array.isArray(th.measures) ? th.measures : []
              for (const m of mz) {
                const md = typeof m.description === 'string' ? m.description.trim() : ''
                if (!md) continue
                const ctRaw = typeof m.control_type === 'string' ? m.control_type : 'administrative'
                const ct = (
                  ['eliminate', 'substitute', 'engineering', 'administrative', 'ppe'].includes(ctRaw)
                    ? ctRaw
                    : 'administrative'
                ) as SjaControlType
                const { data: measRow, error: measErr } = await supabase
                  .from('sja_measures')
                  .insert({
                    sja_id: parsed.id,
                    hazard_id: hazParsed.id,
                    description: md,
                    control_type: ct,
                    is_from_template: true,
                    is_mandatory: Boolean(m.is_mandatory),
                  })
                  .select('*, sja_analyses!inner(organization_id)')
                  .eq('sja_analyses.organization_id', orgId)
                  .single()
                if (measErr) {
                  setError(measErr.message)
                  break
                }
                const measParsed = parseRow(measRow, SjaMeasureSchema)
                if (measParsed) setMeasures((prev) => [...prev, measParsed])
              }
            }
          }
        }
      }

      return parsed
    },
    [supabase, mergeAnalysis, templates, orgId, canManage],
  )

  const loadDetail = useCallback(
    async (sjaId: string) => {
      if (!supabase) {
        setError('Supabase er ikke konfigurert.')
        return
      }
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      setError(null)
      try {
        const { data: analysisRow, error: analysisError } = await supabase
          .from('sja_analyses')
          .select('*')
          .eq('id', sjaId)
          .eq('organization_id', orgId)
          .maybeSingle()
        if (analysisError) throw analysisError
        const analysis = parseRow(analysisRow, SjaAnalysisSchema)
        if (!analysis) return
        mergeAnalysis(analysis)

        const [pRes, tRes, hRes, mRes] = await Promise.all([
          supabase
            .from('sja_participants')
            .select('*, sja_analyses!inner(organization_id)')
            .eq('sja_id', sjaId)
            .eq('sja_analyses.organization_id', orgId)
            .order('created_at', { ascending: true }),
          supabase
            .from('sja_tasks')
            .select('*, sja_analyses!inner(organization_id)')
            .eq('sja_id', sjaId)
            .eq('sja_analyses.organization_id', orgId)
            .order('position', { ascending: true }),
          supabase
            .from('sja_hazards')
            .select('*, sja_analyses!inner(organization_id)')
            .eq('sja_id', sjaId)
            .eq('sja_analyses.organization_id', orgId)
            .order('created_at', { ascending: true }),
          supabase
            .from('sja_measures')
            .select('*, sja_analyses!inner(organization_id)')
            .eq('sja_id', sjaId)
            .eq('sja_analyses.organization_id', orgId)
            .order('created_at', { ascending: true }),
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
    [supabase, orgId, mergeAnalysis],
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
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return
      }
      setError(null)
      const row: Record<string, unknown> = Object.fromEntries(
        Object.entries({ ...patch, updated_at: new Date().toISOString() }).filter(([, v]) => v !== undefined),
      )
      delete row.id
      delete row.organization_id
      delete row.created_at
      const { data, error: upErr } = await supabase
        .from('sja_analyses')
        .update(row)
        .eq('id', sjaId)
        .eq('organization_id', orgId)
        .select('*')
        .single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaAnalysisSchema)
      if (parsed) mergeAnalysis(parsed)
    },
    [supabase, orgId, canManage, mergeAnalysis],
  )

  const advanceStatus = useCallback(
    async (sjaId: string, nextStatus: SjaAnalysis['status'], payload?: AdvanceStatusPayload) => {
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA-status.')
        return
      }
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
    [analyses, canManage, saveAnalysisPatch],
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
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return
      }
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
      const { data, error: insErr } = await supabase
        .from('sja_participants')
        .insert(row)
        .select('*, sja_analyses!inner(organization_id)')
        .eq('sja_analyses.organization_id', orgId)
        .single()
      if (insErr) {
        setError(insErr.message)
        return
      }
      const parsed = parseRow(data, SjaParticipantSchema)
      if (parsed) setParticipants((prev) => [...prev, parsed])
    },
    [supabase, orgId, canManage],
  )

  const deleteParticipant = useCallback(
    async (participantId: string) => {
      if (!supabase) return
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return
      }
      setError(null)
      const { data: inOrg, error: preErr } = await supabase
        .from('sja_participants')
        .select('id, sja_analyses!inner(organization_id)')
        .eq('id', participantId)
        .eq('sja_analyses.organization_id', orgId)
        .maybeSingle()
      if (preErr) {
        setError(preErr.message)
        return
      }
      if (!inOrg) {
        setError('Fant ikke deltakeren i denne organisasjonen.')
        return
      }
      const { error: delErr } = await supabase.from('sja_participants').delete().eq('id', participantId)
      if (delErr) {
        setError(delErr.message)
        return
      }
      setParticipants((prev) => removeById(prev, participantId))
    },
    [supabase, orgId, canManage],
  )

  const addTask = useCallback(
    async (sjaId: string, title: string): Promise<SjaTask | null> => {
      if (!supabase) return null
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return null
      }
      setError(null)
      const existing = tasks.filter((t) => t.sja_id === sjaId)
      const position = existing.length > 0 ? Math.max(...existing.map((t) => t.position)) + 1 : 0
      const { data, error: insErr } = await supabase
        .from('sja_tasks')
        .insert({ sja_id: sjaId, title: title.trim(), position })
        .select('*, sja_analyses!inner(organization_id)')
        .eq('sja_analyses.organization_id', orgId)
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
    [supabase, orgId, canManage, tasks],
  )

  const updateTask = useCallback(
    async (taskId: string, patch: Partial<Pick<SjaTask, 'title' | 'description'>>) => {
      if (!supabase) return
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return
      }
      setError(null)
      const row: Record<string, unknown> = {}
      if (patch.title !== undefined) row.title = patch.title
      if (patch.description !== undefined) row.description = patch.description
      const { data, error: upErr } = await supabase
        .from('sja_tasks')
        .update(row)
        .eq('id', taskId)
        .select('*, sja_analyses!inner(organization_id)')
        .eq('sja_analyses.organization_id', orgId)
        .single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaTaskSchema)
      if (parsed) setTasks((prev) => replaceById(prev, taskId, parsed))
    },
    [supabase, orgId, canManage],
  )

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!supabase) return
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return
      }
      setError(null)
      const { data: inOrg, error: preErr } = await supabase
        .from('sja_tasks')
        .select('id, sja_analyses!inner(organization_id)')
        .eq('id', taskId)
        .eq('sja_analyses.organization_id', orgId)
        .maybeSingle()
      if (preErr) {
        setError(preErr.message)
        return
      }
      if (!inOrg) {
        setError('Fant ikke oppgaven i denne organisasjonen.')
        return
      }
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
    [supabase, orgId, canManage],
  )

  const reorderTasks = useCallback(
    async (sjaId: string, orderedTaskIds: string[]) => {
      if (!supabase) return
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return
      }
      setError(null)
      const { data: parent, error: parentErr } = await supabase
        .from('sja_analyses')
        .select('id')
        .eq('id', sjaId)
        .eq('organization_id', orgId)
        .maybeSingle()
      if (parentErr) {
        setError(parentErr.message)
        return
      }
      if (!parent) {
        setError('Fant ikke SJA i denne organisasjonen.')
        return
      }
      for (let i = 0; i < orderedTaskIds.length; i += 1) {
        const id = orderedTaskIds[i]
        const { error: upErr } = await supabase
          .from('sja_tasks')
          .update({ position: i })
          .eq('id', id)
          .eq('sja_id', sjaId)
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
    [supabase, orgId, canManage],
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
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return null
      }
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
        .select('*, sja_analyses!inner(organization_id)')
        .eq('sja_analyses.organization_id', orgId)
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
    [supabase, orgId, canManage],
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
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return
      }
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
        .select('*, sja_analyses!inner(organization_id)')
        .eq('sja_analyses.organization_id', orgId)
        .single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaHazardSchema)
      if (parsed) setHazards((prev) => replaceById(prev, hazardId, parsed))
    },
    [supabase, orgId, canManage],
  )

  const deleteHazard = useCallback(
    async (hazardId: string) => {
      if (!supabase) return
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return
      }
      setError(null)
      const { data: inOrg, error: preErr } = await supabase
        .from('sja_hazards')
        .select('id, sja_analyses!inner(organization_id)')
        .eq('id', hazardId)
        .eq('sja_analyses.organization_id', orgId)
        .maybeSingle()
      if (preErr) {
        setError(preErr.message)
        return
      }
      if (!inOrg) {
        setError('Fant ikke farekilden i denne organisasjonen.')
        return
      }
      const { error: delErr } = await supabase.from('sja_hazards').delete().eq('id', hazardId)
      if (delErr) {
        setError(delErr.message)
        return
      }
      setHazards((prev) => removeById(prev, hazardId))
      setMeasures((prev) => prev.filter((m) => m.hazard_id !== hazardId))
    },
    [supabase, orgId, canManage],
  )

  const addMeasure = useCallback(
    async (input: {
      sjaId: string
      hazardId: string
      description: string
      controlType: SjaControlType
      assignedToId?: string | null
      assignedToName?: string | null
      isFromTemplate?: boolean
      isMandatory?: boolean
    }) => {
      if (!supabase) return
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return
      }
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
          is_from_template: input.isFromTemplate ?? false,
          is_mandatory: input.isMandatory ?? false,
        })
        .select('*, sja_analyses!inner(organization_id)')
        .eq('sja_analyses.organization_id', orgId)
        .single()
      if (insErr) {
        setError(insErr.message)
        return
      }
      const parsed = parseRow(data, SjaMeasureSchema)
      if (parsed) setMeasures((prev) => [...prev, parsed])
    },
    [supabase, orgId, canManage],
  )

  const updateMeasure = useCallback(
    async (
      measureId: string,
      patch: Partial<
        Pick<
          SjaMeasure,
          | 'description'
          | 'control_type'
          | 'assigned_to_id'
          | 'assigned_to_name'
          | 'completed'
          | 'is_from_template'
          | 'is_mandatory'
          | 'deletion_justification'
          | 'deleted_at'
          | 'deleted_by'
        >
      >,
    ) => {
      if (!supabase) return
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return
      }
      setError(null)
      const body: Record<string, unknown> = {
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.control_type !== undefined ? { control_type: patch.control_type } : {}),
        ...(patch.assigned_to_id !== undefined ? { assigned_to_id: patch.assigned_to_id } : {}),
        ...(patch.assigned_to_name !== undefined ? { assigned_to_name: patch.assigned_to_name } : {}),
        ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
        ...(patch.is_from_template !== undefined ? { is_from_template: patch.is_from_template } : {}),
        ...(patch.is_mandatory !== undefined ? { is_mandatory: patch.is_mandatory } : {}),
        ...(patch.deletion_justification !== undefined ? { deletion_justification: patch.deletion_justification } : {}),
        ...(patch.deleted_at !== undefined ? { deleted_at: patch.deleted_at } : {}),
        ...(patch.deleted_by !== undefined ? { deleted_by: patch.deleted_by } : {}),
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
        .select('*, sja_analyses!inner(organization_id)')
        .eq('sja_analyses.organization_id', orgId)
        .maybeSingle()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaMeasureSchema)
      if (parsed) setMeasures((prev) => replaceById(prev, measureId, parsed))
    },
    [supabase, orgId, canManage],
  )

  const deleteMeasure = useCallback(
    async (measureId: string, opts?: { justification?: string | null }) => {
      if (!supabase) return
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return
      }
      setError(null)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const now = new Date().toISOString()
      const { data, error: upErr } = await supabase
        .from('sja_measures')
        .update({
          deleted_at: now,
          deleted_by: user?.id ?? null,
          deletion_justification: opts?.justification?.trim() || null,
        })
        .eq('id', measureId)
        .select('*, sja_analyses!inner(organization_id)')
        .eq('sja_analyses.organization_id', orgId)
        .maybeSingle()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaMeasureSchema)
      if (parsed) setMeasures((prev) => replaceById(prev, measureId, parsed))
      else setMeasures((prev) => removeById(prev, measureId))
    },
    [supabase, orgId, canManage],
  )

  const hardDeleteMeasure = useCallback(
    async (measureId: string) => {
      if (!supabase) return
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA.')
        return
      }
      setError(null)
      const { data: inOrg, error: preErr } = await supabase
        .from('sja_measures')
        .select('id, sja_analyses!inner(organization_id)')
        .eq('id', measureId)
        .eq('sja_analyses.organization_id', orgId)
        .maybeSingle()
      if (preErr) {
        setError(preErr.message)
        return
      }
      if (!inOrg) {
        setError('Fant ikke tiltaket i denne organisasjonen.')
        return
      }
      const { error: delErr } = await supabase.from('sja_measures').delete().eq('id', measureId)
      if (delErr) {
        setError(delErr.message)
        return
      }
      setMeasures((prev) => removeById(prev, measureId))
    },
    [supabase, orgId, canManage],
  )

  const signParticipant = useCallback(
    async (participantId: string) => {
      if (!supabase) return
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      setError(null)
      const now = new Date().toISOString()
      const { data, error: upErr } = await supabase
        .from('sja_participants')
        .update({ signed_at: now })
        .eq('id', participantId)
        .select('*, sja_analyses!inner(organization_id)')
        .eq('sja_analyses.organization_id', orgId)
        .single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaParticipantSchema)
      if (parsed) setParticipants((prev) => replaceById(prev, participantId, parsed))
    },
    [supabase, orgId],
  )

  const completeDebrief = useCallback(
    async (input: { sjaId: string; unexpectedHazards: boolean; debriefNotes: string }) => {
      if (!supabase) return
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å fullføre SJA-debrief.')
        return
      }
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
        .eq('organization_id', orgId)
        .select('*')
        .single()
      if (upErr) {
        setError(upErr.message)
        return
      }
      const parsed = parseRow(data, SjaAnalysisSchema)
      if (parsed) mergeAnalysis(parsed)
    },
    [supabase, orgId, canManage, mergeAnalysis],
  )

  const createAvvikFromDebrief = useCallback(
    async (sjaId: string): Promise<string | null> => {
      if (!supabase) return null
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å opprette avvik fra SJA-debrief.')
        return null
      }
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
          organization_id: orgId,
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
    [supabase, orgId, canManage, analyses, saveAnalysisPatch],
  )

  const createTemplate = useCallback(
    async (row: {
      name: string
      job_type: string
      description?: string | null
      required_certs?: string[] | null
      required_ppe?: string[] | null
      prefill_tasks?: unknown
      is_active?: boolean
    }): Promise<SjaTemplate | null> => {
      if (!supabase) return null
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return null
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å opprette SJA-maler.')
        return null
      }
      setError(null)
      const { data, error: insErr } = await supabase
        .from('sja_templates')
        .insert({
          organization_id: orgId,
          name: row.name.trim(),
          job_type: row.job_type,
          description: row.description ?? null,
          required_certs: row.required_certs ?? null,
          required_ppe: row.required_ppe ?? [],
          prefill_tasks: row.prefill_tasks ?? null,
          is_active: row.is_active ?? true,
        })
        .select('*')
        .eq('organization_id', orgId)
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
    [supabase, orgId, canManage],
  )

  const updateTemplate = useCallback(
    async (
      templateId: string,
      row: {
        name?: string
        job_type?: string
        description?: string | null
        required_certs?: string[] | null
        required_ppe?: string[] | null
        prefill_tasks?: unknown
        is_active?: boolean
      },
    ) => {
      if (!supabase) return
      if (!orgId) {
        setError('Organisasjon er ikke valgt.')
        return
      }
      if (!canManage) {
        setError('Du har ikke tilgang til å endre SJA-maler.')
        return
      }
      setError(null)
      const body: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (row.name !== undefined) body.name = row.name.trim()
      if (row.job_type !== undefined) body.job_type = row.job_type
      if (row.description !== undefined) body.description = row.description
      if (row.required_certs !== undefined) body.required_certs = row.required_certs
      if (row.required_ppe !== undefined) body.required_ppe = row.required_ppe
      if (row.prefill_tasks !== undefined) body.prefill_tasks = row.prefill_tasks
      if (row.is_active !== undefined) body.is_active = row.is_active
      const { data, error: upErr } = await supabase
        .from('sja_templates')
        .update(body)
        .eq('id', templateId)
        .eq('organization_id', orgId)
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
    [supabase, orgId, canManage],
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
      createAnalysis,
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
      hardDeleteMeasure,
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
      createAnalysis,
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
      hardDeleteMeasure,
      signParticipant,
      completeDebrief,
      createAvvikFromDebrief,
      createTemplate,
      updateTemplate,
    ],
  )
}
