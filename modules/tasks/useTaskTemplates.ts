// useTaskTemplates — fetches active task templates + categories for the org.
// Used by TasksHubLanding (tile grid) and TasksManagementPage (template focus mode).
// Read-only; mutations live in TasksAdminPage (Phase 3).

import { useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import type { TaskTemplateKind, TaskMetadataSchema, TaskPack } from '../../src/types/task'

export type TaskTemplateRow = {
  id: string
  slug: string
  name: string
  description: string
  templateKind: TaskTemplateKind
  pack: TaskPack
  lawRefs: string[]
  cadenceHint?: string
  metadataSchema: TaskMetadataSchema
  categoryId: string | null
  navPinned: boolean
  isSystem: boolean
  version: number
}

export type TaskCategoryRow = {
  id: string
  name: string
  description: string
  position: number
  pack?: TaskPack
}

export type UseTaskTemplatesReturn = {
  loading: boolean
  templates: TaskTemplateRow[]
  categories: TaskCategoryRow[]
  error: string | null
}

export function useTaskTemplates(): UseTaskTemplatesReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [templates, setTemplates] = useState<TaskTemplateRow[]>([])
  const [categories, setCategories] = useState<TaskCategoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    setLoading(true)

    void Promise.all([
      supabase
        .from('task_template_catalog')
        .select(
          'id, slug, name, description, template_kind, pack, law_refs, cadence_hint, metadata_schema, is_system, version, task_org_templates!inner(category_id, nav_pinned)',
        )
        .eq('task_org_templates.organization_id', orgId)
        .eq('task_org_templates.is_active', true)
        .is('task_org_templates.deleted_at', null)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('task_template_categories')
        .select('id, name, description, position, pack')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('position', { ascending: true })
        .order('name', { ascending: true }),
    ]).then(([tplRes, catRes]) => {
      if (cancelled) return
      setLoading(false)

      if (tplRes.error) {
        setError(tplRes.error.message)
      } else {
        setError(null)
        const rows = (tplRes.data ?? []).map((r) => {
          const raw = r as Record<string, unknown>
          // Supabase !inner join returns array for to-many; take first element
          const orgArr = raw.task_org_templates as Array<{ category_id: string | null; nav_pinned: boolean }>
          const org = Array.isArray(orgArr) ? orgArr[0] : (orgArr as { category_id: string | null; nav_pinned: boolean } | null)
          return {
            id: String(raw.id),
            slug: String(raw.slug ?? ''),
            name: String(raw.name ?? ''),
            description: String(raw.description ?? ''),
            templateKind: (raw.template_kind ?? 'oppgave') as TaskTemplateKind,
            pack: (raw.pack ?? 'aml-amu') as TaskPack,
            lawRefs: (raw.law_refs as string[]) ?? [],
            cadenceHint: raw.cadence_hint ? String(raw.cadence_hint) : undefined,
            metadataSchema: (raw.metadata_schema ?? { fields: [] }) as TaskMetadataSchema,
            categoryId: org?.category_id ?? null,
            navPinned: org?.nav_pinned ?? false,
            isSystem: Boolean(raw.is_system),
            version: Number(raw.version ?? 1),
          } satisfies TaskTemplateRow
        })
        setTemplates(rows)
        setFetchedFor(orgId)
      }

      if (!catRes.error) {
        setCategories(
          (catRes.data ?? []).map((c) => {
            const raw = c as Record<string, unknown>
            return {
              id: String(raw.id),
              name: String(raw.name ?? ''),
              description: String(raw.description ?? ''),
              position: Number(raw.position ?? 100),
              pack: raw.pack ? (raw.pack as TaskPack) : undefined,
            }
          }),
        )
      }
    })

    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const isLoading = loading || (orgId !== null && fetchedFor !== orgId)

  return { loading: isLoading, templates, categories, error }
}
