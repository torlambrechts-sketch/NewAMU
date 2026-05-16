// useAdminTemplates — cross-module aggregator that lists every template
// in the org so admins can browse compliance / survey / documents /
// learning / register / tasks / meetings / alerts / workflow templates
// from one page (`/admin/templates`).
//
// Source of truth: the SQL view `v_admin_templates` (see migration
// 20260912120900). The view does the row-shape normalisation across
// 9 source tables; this hook just reads it and maps to the
// `AdminTemplateRow` type the page expects. Adding a new template-
// bearing module = appending a `union all` block to the view, then
// adding the source key + UI metadata here.
//
// The hook is read-only — CRUD lives on each per-module surface (the
// row's `editUrl` deep-links to the right editor; lightweight edits
// happen in /admin/templates inline via LightweightTemplateEditor +
// per-source bridges).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type AdminTemplateSource =
  | 'compliance'
  | 'survey'
  | 'documents'
  | 'learning'
  | 'registers'
  | 'tasks'
  | 'meetings'
  | 'alerts'
  | 'workflow'

export type AdminTemplateStatus =
  | 'active'
  | 'inactive'
  | 'draft'
  | 'archived'
  | 'system'

export const ADMIN_TEMPLATE_SOURCE_LABELS: Record<AdminTemplateSource, string> = {
  compliance: 'Sjekklister',
  survey: 'Undersøkelser',
  documents: 'Dokumenter',
  learning: 'Læring',
  registers: 'Register',
  tasks: 'Oppgaver',
  meetings: 'Møter',
  alerts: 'Varslinger',
  workflow: 'Arbeidsflyt',
}

export const ADMIN_TEMPLATE_STATUS_LABELS: Record<AdminTemplateStatus, string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  draft: 'Utkast',
  archived: 'Arkivert',
  system: 'System',
}

export type AdminTemplateRow = {
  /** Source-prefixed id, stable across reloads. */
  rowId: string
  source: AdminTemplateSource
  sourceLabel: string
  /** The original DB id (per-source). Use with editUrl + bridges. */
  id: string
  name: string
  /** Resolved category name when the source has one; null otherwise. */
  category: string | null
  status: AdminTemplateStatus
  /** Catalog-shipped / platform-defined row. */
  isSystem: boolean
  /** Most-recent edit timestamp; sorts the table by recency by default. */
  updatedAt: string | null
  /** Deep link into the source module's full editor. */
  editUrl: string
  /** Optional extra context shown beside the name (e.g. pack slug). */
  hint?: string | null
}

export type UseAdminTemplatesReturn = {
  loading: boolean
  error: string | null
  rows: AdminTemplateRow[]
  refresh: () => Promise<void>
}

/** Per-source mapping from `pack`/category text to the editor deep-link. */
function buildEditUrl(source: AdminTemplateSource, id: string): string {
  const enc = encodeURIComponent(id)
  switch (source) {
    case 'compliance':
      return `/compliance/checklists/admin?tab=maler&template=${enc}`
    case 'survey':
      return `/survey/admin?tab=maler&template=${enc}`
    case 'documents':
      return `/documents/admin?tab=maler&template=${enc}`
    case 'learning':
      return `/learning/courses/${enc}`
    case 'registers':
      return `/registers/${enc}`
    case 'tasks':
      return `/tasks/management/admin?template=${enc}`
    case 'meetings':
      return `/meetings/admin?template=${enc}`
    case 'alerts':
      return `/alerts/admin?template=${enc}`
    case 'workflow':
      return `/workflow?tab=library&template=${enc}`
  }
}

type ViewRow = {
  row_id: string
  source: AdminTemplateSource
  source_id: string
  name: string
  category_name: string | null
  status: AdminTemplateStatus
  is_system: boolean
  updated_at: string | null
  organization_id: string | null
  pack: string | null
  hint: string | null
}

export function useAdminTemplates(): UseAdminTemplatesReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [rows, setRows] = useState<AdminTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: respErr } = await supabase
        .from('v_admin_templates')
        .select('row_id, source, source_id, name, category_name, status, is_system, updated_at, organization_id, pack, hint')
        .order('updated_at', { ascending: false })
      if (respErr) throw respErr
      const out: AdminTemplateRow[] = (data ?? []).map((raw) => {
        const v = raw as unknown as ViewRow
        return {
          rowId: v.row_id,
          source: v.source,
          sourceLabel: ADMIN_TEMPLATE_SOURCE_LABELS[v.source],
          id: v.source_id,
          name: v.name,
          category: v.category_name,
          status: v.status,
          isSystem: v.is_system,
          updatedAt: v.updated_at,
          editUrl: buildEditUrl(v.source, v.source_id),
          hint: v.pack ? `pakke: ${v.pack}` : v.hint,
        }
      })
      setRows(out)
      setFetchedFor(orgId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Klarte ikke å laste maler')
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    if (!orgId) {
      setRows([])
      setLoading(false)
      return
    }
    if (fetchedFor !== orgId) {
      void load()
    }
  }, [load, orgId, fetchedFor])

  return useMemo(
    () => ({ loading, error, rows, refresh: load }),
    [loading, error, rows, load],
  )
}
