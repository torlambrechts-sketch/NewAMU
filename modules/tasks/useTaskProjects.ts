// useTaskProjects — CRUD hook for task_projects (PDCA/Kanban project boards).
// Projects group task_items across templates under a single PDCA or Kanban board.
// Used by TasksHubLanding (project list) and TasksManagementPage (project board mode).

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import type { TaskProject } from '../../src/types/task'

export type { TaskProject }

export type CreateProjectInput = {
  title: string
  description?: string
  methodology: 'pdca' | 'kanban'
  startDate?: string
  endDate?: string
  lawRefs?: string[]
}

export type UseTaskProjectsReturn = {
  loading: boolean
  projects: TaskProject[]
  error: string | null
  createProject: (input: CreateProjectInput) => Promise<string | null>
  updateProject: (
    id: string,
    patch: Partial<CreateProjectInput & { status: TaskProject['status'] }>,
  ) => Promise<void>
  softDeleteProject: (id: string) => Promise<void>
  reload: () => void
}

export function useTaskProjects(): UseTaskProjectsReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [projects, setProjects] = useState<TaskProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    setLoading(true)
    void supabase
      .from('task_projects')
      .select(
        'id, title, description, methodology, status, start_date, end_date, law_refs, lead_user_id, created_by, created_at, updated_at',
      )
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data, error: qErr }) => {
        if (cancelled) return
        setLoading(false)
        if (qErr) {
          setError(qErr.message)
          return
        }
        setError(null)
        setProjects(
          (data ?? []).map((r) => ({
            id: String(r.id),
            organizationId: orgId,
            pack: 'aml-amu' as const,
            title: String(r.title ?? ''),
            description: String(r.description ?? ''),
            methodology: (r.methodology ?? 'pdca') as TaskProject['methodology'],
            status: (r.status ?? 'active') as TaskProject['status'],
            startDate: r.start_date ? String(r.start_date) : undefined,
            endDate: r.end_date ? String(r.end_date) : undefined,
            lawRefs: (r.law_refs as string[]) ?? [],
            leadUserId: r.lead_user_id ? String(r.lead_user_id) : undefined,
            createdBy: r.created_by ? String(r.created_by) : undefined,
            createdAt: String(r.created_at),
            updatedAt: String(r.updated_at),
          })),
        )
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId, version])

  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<string | null> => {
      if (!supabase || !orgId) return null
      const { data, error: insErr } = await supabase
        .from('task_projects')
        .insert({
          organization_id: orgId,
          title: input.title,
          description: input.description ?? '',
          methodology: input.methodology,
          status: 'active',
          start_date: input.startDate ?? null,
          end_date: input.endDate ?? null,
          law_refs: input.lawRefs ?? [],
        })
        .select('id')
        .single()
      if (insErr || !data) return null
      reload()
      return String(data.id)
    },
    [supabase, orgId, reload],
  )

  const updateProject = useCallback(
    async (
      id: string,
      patch: Partial<CreateProjectInput & { status: TaskProject['status'] }>,
    ): Promise<void> => {
      if (!supabase) return
      const payload: Record<string, unknown> = {}
      if (patch.title !== undefined) payload.title = patch.title
      if (patch.description !== undefined) payload.description = patch.description
      if (patch.methodology !== undefined) payload.methodology = patch.methodology
      if (patch.status !== undefined) payload.status = patch.status
      if (patch.startDate !== undefined) payload.start_date = patch.startDate
      if (patch.endDate !== undefined) payload.end_date = patch.endDate
      if (patch.lawRefs !== undefined) payload.law_refs = patch.lawRefs
      await supabase.from('task_projects').update(payload).eq('id', id)
      reload()
    },
    [supabase, reload],
  )

  const softDeleteProject = useCallback(
    async (id: string): Promise<void> => {
      if (!supabase) return
      await supabase
        .from('task_projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      reload()
    },
    [supabase, reload],
  )

  return { loading, projects, error, createProject, updateProject, softDeleteProject, reload }
}
