// Fetches task_template_catalog joined with task_org_templates for the org.
// System templates (organization_id IS NULL) are visible to all orgs.
// Per-org rows in task_org_templates control nav_pinned and is_active.
import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import type { TaskOrgTemplate, TaskPack, TaskSourceCategory, TaskTemplateCatalog } from '../../src/types/task'

type CatalogRow = {
  id: string
  organization_id: string | null
  slug: string
  pack: string
  source_category: string
  name: string
  description: string
  law_refs: string[]
  default_pdca_phase: string
  definition: unknown
  cadence_hint: string | null
  is_active: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

type OrgTemplateRow = {
  id: string
  organization_id: string
  catalog_id: string
  nav_pinned: boolean
  is_active: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

function mapCatalog(r: CatalogRow): TaskTemplateCatalog {
  const def = r.definition as {
    fields?: TaskTemplateCatalog['definition']['fields']
    checklist_items?: Array<{ id: string; text: string }>
  }
  return {
    id: r.id,
    organizationId: r.organization_id ?? undefined,
    slug: r.slug,
    pack: r.pack as TaskPack,
    sourceCategory: r.source_category as TaskSourceCategory,
    name: r.name,
    description: r.description,
    lawRefs: r.law_refs ?? [],
    defaultPdcaPhase: r.default_pdca_phase as TaskTemplateCatalog['defaultPdcaPhase'],
    definition: {
      fields: def.fields ?? [],
      checklistItems: def.checklist_items ?? [],
    },
    cadenceHint: r.cadence_hint ?? undefined,
    isActive: r.is_active,
    isSystem: r.is_system,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function mapOrgTemplate(r: OrgTemplateRow): TaskOrgTemplate {
  return {
    id: r.id,
    organizationId: r.organization_id,
    catalogId: r.catalog_id,
    navPinned: r.nav_pinned,
    isActive: r.is_active,
    deletedAt: r.deleted_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function useTaskTemplates(opts: { pack?: TaskPack; navPinnedOnly?: boolean } = {}) {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const [catalog, setCatalog] = useState<TaskTemplateCatalog[]>([])
  const [orgTemplates, setOrgTemplates] = useState<TaskOrgTemplate[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) { setCatalog([]); setOrgTemplates([]); return }
    setLoading(true)
    try {
      // Fetch system catalog templates
      let catalogQuery = supabase
        .from('task_template_catalog')
        .select('*')
        .eq('is_active', true)
      if (opts.pack) catalogQuery = catalogQuery.eq('pack', opts.pack)

      // Fetch per-org overrides
      let orgQuery = supabase
        .from('task_org_templates')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
      if (opts.navPinnedOnly) orgQuery = orgQuery.eq('nav_pinned', true)

      const [catalogRes, orgRes] = await Promise.all([catalogQuery, orgQuery])

      if (!catalogRes.error && !orgRes.error) {
        setCatalog((catalogRes.data ?? []).map((r) => mapCatalog(r as CatalogRow)))
        setOrgTemplates((orgRes.data ?? []).map((r) => mapOrgTemplate(r as OrgTemplateRow)))
      } else {
        setCatalog([])
        setOrgTemplates([])
      }
    } catch { setCatalog([]); setOrgTemplates([]) }
    finally { setLoading(false) }
  }, [supabase, orgId, opts.pack, opts.navPinnedOnly])

  useEffect(() => { void refresh() }, [refresh])

  // Merge: system templates filtered to those org has activated
  const pinnedCatalogIds = new Set(
    orgTemplates.filter((t) => t.navPinned).map((t) => t.catalogId),
  )
  const activeCatalogIds = new Set(orgTemplates.map((t) => t.catalogId))

  const pinnedTemplates = catalog.filter((t) => pinnedCatalogIds.has(t.id))
  const activeTemplates = catalog.filter((t) => activeCatalogIds.has(t.id))

  const setPinned = useCallback(
    async (catalogId: string, pinned: boolean): Promise<boolean> => {
      if (!supabase || !orgId) return false
      const { error: e } = await supabase
        .from('task_org_templates')
        .upsert(
          { organization_id: orgId, catalog_id: catalogId, nav_pinned: pinned, is_active: true },
          { onConflict: 'organization_id,catalog_id' },
        )
      if (e) { console.error('setPinned:', e); return false }
      await refresh()
      return true
    },
    [supabase, orgId, refresh],
  )

  return { catalog, orgTemplates, pinnedTemplates, activeTemplates, loading, refresh, setPinned }
}
