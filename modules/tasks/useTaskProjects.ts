// Reads and writes task_projects + task_project_evidence.
// Projects are the auditable container for PDCA cycles — each project
// bundles tasks, evidence links, and can generate a signed export token.
import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import type { TaskPack, TaskProject, TaskProjectEvidence } from '../../src/types/task'

type ProjectRow = {
  id: string
  organization_id: string
  pack: string
  title: string
  description: string
  methodology: string
  status: string
  start_date: string | null
  end_date: string | null
  law_refs: string[]
  lead_user_id: string | null
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type EvidenceRow = {
  id: string
  organization_id: string
  project_id: string
  kind: string
  label: string
  external_ref_table: string | null
  external_ref_id: string | null
  file_path: string | null
  uploaded_by: string | null
  created_at: string
}

function mapProject(r: ProjectRow): TaskProject {
  return {
    id: r.id,
    organizationId: r.organization_id,
    pack: r.pack as TaskPack,
    title: r.title,
    description: r.description,
    methodology: r.methodology as TaskProject['methodology'],
    status: r.status as TaskProject['status'],
    startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined,
    lawRefs: r.law_refs ?? [],
    leadUserId: r.lead_user_id ?? undefined,
    deletedAt: r.deleted_at ?? undefined,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function mapEvidence(r: EvidenceRow): TaskProjectEvidence {
  return {
    id: r.id,
    organizationId: r.organization_id,
    projectId: r.project_id,
    kind: r.kind as TaskProjectEvidence['kind'],
    label: r.label,
    externalRefTable: r.external_ref_table ?? undefined,
    externalRefId: r.external_ref_id ?? undefined,
    filePath: r.file_path ?? undefined,
    uploadedBy: r.uploaded_by ?? undefined,
    createdAt: r.created_at,
  }
}

export function useTaskProjects(pack?: TaskPack) {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const [projects, setProjects] = useState<TaskProject[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) { setProjects([]); return }
    setLoading(true)
    try {
      let query = supabase
        .from('task_projects')
        .select('*')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (pack) query = query.eq('pack', pack)
      const { data, error: e } = await query
      if (e) {
        if (String(e.message).toLowerCase().includes('does not exist')) { setProjects([]); return }
        throw e
      }
      setProjects((data ?? []).map((r) => mapProject(r as ProjectRow)))
    } catch { setProjects([]) }
    finally { setLoading(false) }
  }, [supabase, orgId, pack])

  useEffect(() => { void refresh() }, [refresh])

  const createProject = useCallback(
    async (payload: Omit<TaskProject, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<TaskProject | null> => {
      if (!supabase || !orgId) return null
      const { data, error: e } = await supabase
        .from('task_projects')
        .insert({
          organization_id: orgId,
          pack: payload.pack,
          title: payload.title,
          description: payload.description,
          methodology: payload.methodology,
          status: payload.status,
          start_date: payload.startDate ?? null,
          end_date: payload.endDate ?? null,
          law_refs: payload.lawRefs,
          lead_user_id: payload.leadUserId ?? null,
        })
        .select()
        .single()
      if (e) { console.error('createProject:', e); return null }
      const created = mapProject(data as ProjectRow)
      setProjects((prev) => [created, ...prev])
      return created
    },
    [supabase, orgId],
  )

  const updateProject = useCallback(
    async (id: string, patch: Partial<TaskProject>): Promise<boolean> => {
      if (!supabase || !orgId) return false
      const dbPatch: Record<string, unknown> = {}
      if (patch.title !== undefined) dbPatch.title = patch.title
      if (patch.description !== undefined) dbPatch.description = patch.description
      if (patch.methodology !== undefined) dbPatch.methodology = patch.methodology
      if (patch.status !== undefined) dbPatch.status = patch.status
      if (patch.startDate !== undefined) dbPatch.start_date = patch.startDate
      if (patch.endDate !== undefined) dbPatch.end_date = patch.endDate
      if (patch.lawRefs !== undefined) dbPatch.law_refs = patch.lawRefs
      if (patch.leadUserId !== undefined) dbPatch.lead_user_id = patch.leadUserId
      const { error: e } = await supabase
        .from('task_projects')
        .update(dbPatch)
        .eq('id', id)
        .eq('organization_id', orgId)
      if (e) { console.error('updateProject:', e); return false }
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
      return true
    },
    [supabase, orgId],
  )

  const deleteProject = useCallback(
    async (id: string): Promise<boolean> => {
      if (!supabase || !orgId) return false
      const { error: e } = await supabase
        .from('task_projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', orgId)
      if (e) { console.error('deleteProject:', e); return false }
      setProjects((prev) => prev.filter((p) => p.id !== id))
      return true
    },
    [supabase, orgId],
  )

  return { projects, loading, refresh, createProject, updateProject, deleteProject }
}

export function useTaskProjectEvidence(projectId: string | undefined) {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const [evidence, setEvidence] = useState<TaskProjectEvidence[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId || !projectId) { setEvidence([]); return }
    setLoading(true)
    try {
      const { data, error: e } = await supabase
        .from('task_project_evidence')
        .select('*')
        .eq('organization_id', orgId)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
      if (e) {
        if (String(e.message).toLowerCase().includes('does not exist')) { setEvidence([]); return }
        throw e
      }
      setEvidence((data ?? []).map((r) => mapEvidence(r as EvidenceRow)))
    } catch { setEvidence([]) }
    finally { setLoading(false) }
  }, [supabase, orgId, projectId])

  useEffect(() => { void refresh() }, [refresh])

  const addEvidence = useCallback(
    async (payload: Omit<TaskProjectEvidence, 'id' | 'organizationId' | 'createdAt'>): Promise<TaskProjectEvidence | null> => {
      if (!supabase || !orgId) return null
      const { data, error: e } = await supabase
        .from('task_project_evidence')
        .insert({
          organization_id: orgId,
          project_id: payload.projectId,
          kind: payload.kind,
          label: payload.label,
          external_ref_table: payload.externalRefTable ?? null,
          external_ref_id: payload.externalRefId ?? null,
          file_path: payload.filePath ?? null,
        })
        .select()
        .single()
      if (e) { console.error('addEvidence:', e); return null }
      const created = mapEvidence(data as EvidenceRow)
      setEvidence((prev) => [created, ...prev])
      return created
    },
    [supabase, orgId],
  )

  const removeEvidence = useCallback(
    async (id: string): Promise<boolean> => {
      if (!supabase || !orgId) return false
      const { error: e } = await supabase
        .from('task_project_evidence')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId)
      if (e) { console.error('removeEvidence:', e); return false }
      setEvidence((prev) => prev.filter((ev) => ev.id !== id))
      return true
    },
    [supabase, orgId],
  )

  return { evidence, loading, refresh, addEvidence, removeEvidence }
}

