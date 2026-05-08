// useAdminTemplates — cross-module aggregator that lists every template
// in the org so admins can browse compliance / survey / documents /
// learning / register templates from one page (`/admin/templates`).
//
// Each source has its own shape; this hook normalises to the common
// AdminTemplateRow used by the page's table. The hook is read-only —
// CRUD lives on each per-module surface (the row's `editUrl` deep-
// links to the right editor when the user clicks "Rediger").

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type AdminTemplateSource =
  | 'compliance'
  | 'survey'
  | 'documents'
  | 'learning'
  | 'registers'

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
}

export const ADMIN_TEMPLATE_STATUS_LABELS: Record<AdminTemplateStatus, string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  draft: 'Utkast',
  archived: 'Arkivert',
  system: 'System',
}

export type AdminTemplateRow = {
  /** Source-prefixed for uniqueness across modules. */
  rowId: string
  source: AdminTemplateSource
  sourceLabel: string
  /** The original DB id (per-source). Use with editUrl. */
  id: string
  name: string
  /** Resolved category name; null when uncategorised. */
  category: string | null
  status: AdminTemplateStatus
  /** When the catalogue ships the row vs. an admin authored it. */
  isSystem: boolean
  /** Optional ISO timestamp; sorts the table by recency by default. */
  updatedAt: string | null
  /** Deep link into the source module's editor. */
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

export function useAdminTemplates(): UseAdminTemplatesReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [rows, setRows] = useState<AdminTemplateRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)

  const refresh = useMemo(
    () =>
      async () => {
        if (!supabase || !orgId) return
        setLoading(true)
        setError(null)
        try {
          const [
            complianceTpls,
            complianceCats,
            surveyOrgTpls,
            surveyCatalog,
            surveyCats,
            docs,
            learningCourses,
            learningCats,
            registerTypes,
            registerCats,
          ] = await Promise.all([
            supabase
              .from('compliance_checklist_templates')
              .select('id, name, pack, category_id, is_active, updated_at, deleted_at')
              .eq('organization_id', orgId)
              .is('deleted_at', null),
            supabase
              .from('compliance_checklist_categories')
              .select('id, name')
              .eq('organization_id', orgId)
              .is('deleted_at', null),
            supabase
              .from('survey_org_templates')
              .select(
                'id, catalog_id, pack, name_override, category_id, is_active, nav_pinned, updated_at, deleted_at',
              )
              .eq('organization_id', orgId)
              .is('deleted_at', null),
            supabase
              .from('survey_template_catalog')
              .select('id, name, pack, is_system, is_active, updated_at')
              .eq('is_active', true),
            supabase
              .from('survey_template_categories')
              .select('id, name')
              .eq('organization_id', orgId)
              .is('deleted_at', null),
            supabase
              .from('document_org_templates')
              .select('id, title, space_id, is_active, updated_at, deleted_at')
              .eq('organization_id', orgId)
              .is('deleted_at', null),
            supabase
              .from('learning_courses')
              .select('id, title, status, category_id, updated_at')
              .eq('organization_id', orgId),
            supabase
              .from('learning_categories')
              .select('id, name')
              .eq('organization_id', orgId)
              .eq('is_active', true)
              .is('deleted_at', null),
            supabase
              .from('register_types')
              .select('id, organization_id, name, is_active, is_system, updated_at'),
            supabase
              .from('register_categories')
              .select('id, name')
              .eq('organization_id', orgId)
              .eq('is_active', true)
              .is('deleted_at', null),
          ])

          const out: AdminTemplateRow[] = []

          // Compliance
          const complianceCatById = mapBy(complianceCats.data, 'id', 'name')
          for (const r of complianceTpls.data ?? []) {
            const row = r as {
              id: string
              name: string
              pack: string | null
              category_id: string | null
              is_active: boolean
              updated_at: string | null
            }
            out.push({
              rowId: `compliance:${row.id}`,
              source: 'compliance',
              sourceLabel: ADMIN_TEMPLATE_SOURCE_LABELS.compliance,
              id: row.id,
              name: row.name,
              category: row.category_id ? complianceCatById.get(row.category_id) ?? null : null,
              status: row.is_active ? 'active' : 'inactive',
              isSystem: false,
              updatedAt: row.updated_at,
              editUrl: `/compliance/checklists/admin?tab=maler&template=${encodeURIComponent(row.id)}`,
              hint: row.pack ? `pakke: ${row.pack}` : null,
            })
          }

          // Survey — overlay catalog name on org_templates rows
          const catalogById = new Map<string, { name: string; pack: string | null; isSystem: boolean }>()
          for (const c of surveyCatalog.data ?? []) {
            const row = c as { id: string; name: string; pack: string | null; is_system: boolean }
            catalogById.set(row.id, { name: row.name, pack: row.pack, isSystem: row.is_system })
          }
          const surveyCatById = mapBy(surveyCats.data, 'id', 'name')
          for (const r of surveyOrgTpls.data ?? []) {
            const row = r as {
              id: string
              catalog_id: string
              pack: string | null
              name_override: string | null
              category_id: string | null
              is_active: boolean
              updated_at: string | null
            }
            const cat = catalogById.get(row.catalog_id)
            out.push({
              rowId: `survey:${row.id}`,
              source: 'survey',
              sourceLabel: ADMIN_TEMPLATE_SOURCE_LABELS.survey,
              id: row.id,
              name: row.name_override ?? cat?.name ?? '(uten navn)',
              category: row.category_id ? surveyCatById.get(row.category_id) ?? null : null,
              status: row.is_active ? 'active' : 'inactive',
              isSystem: cat?.isSystem ?? false,
              updatedAt: row.updated_at,
              editUrl: `/survey/admin?tab=maler&template=${encodeURIComponent(row.id)}`,
              hint: row.pack ? `pakke: ${row.pack}` : null,
            })
          }

          // Documents
          for (const r of docs.data ?? []) {
            const row = r as {
              id: string
              title: string
              space_id: string | null
              is_active: boolean
              updated_at: string | null
            }
            out.push({
              rowId: `documents:${row.id}`,
              source: 'documents',
              sourceLabel: ADMIN_TEMPLATE_SOURCE_LABELS.documents,
              id: row.id,
              name: row.title,
              category: null, // Documents categorise via wiki_spaces — would need a join
              status: row.is_active ? 'active' : 'inactive',
              isSystem: false,
              updatedAt: row.updated_at,
              editUrl: `/documents/admin?tab=maler&template=${encodeURIComponent(row.id)}`,
            })
          }

          // Learning
          const learningCatById = mapBy(learningCats.data, 'id', 'name')
          for (const r of learningCourses.data ?? []) {
            const row = r as {
              id: string
              title: string
              status: string
              category_id: string | null
              updated_at: string | null
            }
            const status: AdminTemplateStatus =
              row.status === 'published'
                ? 'active'
                : row.status === 'draft'
                  ? 'draft'
                  : row.status === 'archived'
                    ? 'archived'
                    : 'inactive'
            out.push({
              rowId: `learning:${row.id}`,
              source: 'learning',
              sourceLabel: ADMIN_TEMPLATE_SOURCE_LABELS.learning,
              id: row.id,
              name: row.title,
              category: row.category_id ? learningCatById.get(row.category_id) ?? null : null,
              status,
              isSystem: false,
              updatedAt: row.updated_at,
              editUrl: `/learning/courses/${encodeURIComponent(row.id)}`,
            })
          }

          // Registers — types are templates for records
          const registerCatById = mapBy(registerCats.data, 'id', 'name')
          for (const r of registerTypes.data ?? []) {
            const row = r as {
              id: string
              organization_id: string | null
              name: string
              is_active: boolean
              is_system: boolean
              updated_at: string | null
            }
            // System types from other orgs are already RLS-filtered;
            // org types must match this org. Belt-and-braces.
            if (row.organization_id !== null && row.organization_id !== orgId) continue
            out.push({
              rowId: `registers:${row.id}`,
              source: 'registers',
              sourceLabel: ADMIN_TEMPLATE_SOURCE_LABELS.registers,
              id: row.id,
              name: row.name,
              category: registerCatById.get(row.id) ?? null,
              status: !row.is_active ? 'inactive' : row.is_system ? 'system' : 'active',
              isSystem: row.is_system,
              updatedAt: row.updated_at,
              editUrl: `/registers/${encodeURIComponent(row.id)}`,
            })
          }

          out.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
          setRows(out)
          setFetchedFor(orgId)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Klarte ikke å laste maler')
        } finally {
          setLoading(false)
        }
      },
    [supabase, orgId],
  )

  useEffect(() => {
    if (orgId && fetchedFor !== orgId) void refresh()
  }, [orgId, fetchedFor, refresh])

  return { loading, error, rows, refresh }
}

function mapBy(
  data: unknown[] | null | undefined,
  keyField: string,
  valueField: string,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const r of data ?? []) {
    const row = r as Record<string, unknown>
    const k = row[keyField]
    const v = row[valueField]
    if (typeof k === 'string' && typeof v === 'string') out.set(k, v)
  }
  return out
}
