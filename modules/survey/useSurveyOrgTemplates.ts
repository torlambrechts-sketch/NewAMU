// Survey org-templates — per-org overrides and operational state for system
// catalog templates. The hook reads survey_org_templates joined with the
// survey_template_catalog row referenced by catalog_id, then merges
// override fields with COALESCE so consumers see a single resolved
// template object.
//
// Read + minimal admin mutations (toggle nav_pinned, set review_status).
// Override authoring is handled separately in the Maler import/export flow.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type {
  SurveyOrgTemplateRow,
  SurveyPackSlug,
  TemplateMetadataSchema,
} from './types'
import { SurveyOrgTemplateRowSchema } from './types'

type UseSurveyOrgTemplatesInput = {
  supabase: SupabaseClient | null
}

/**
 * Resolved view of a survey template — the override row joined with its
 * catalog row, with override fields applied via COALESCE. Consumers should
 * use this rather than reading the raw rows directly.
 */
export type ResolvedSurveyTemplate = {
  /** survey_org_templates.id (null when no override row exists for an
   *  org-authored catalog template that the org owns directly). */
  overrideId: string | null
  /** survey_template_catalog.id (text PK). */
  catalogId: string
  organizationId: string
  pack: SurveyPackSlug
  /** Resolved name — override or catalog. */
  name: string
  /** Resolved description — override or catalog. */
  description: string | null
  /** Resolved body (jsonb) — override or catalog. Parse via existing
   *  surveyTemplateCatalogTypes.CatalogTemplateBody when consuming. */
  body: unknown
  /** Resolved short name from catalog (no per-org override). */
  shortName: string | null
  /** Catalog-level (system or org-authored). */
  isSystem: boolean
  /** Per-org operational state (always from override row). */
  navPinned: boolean
  isActive: boolean
  reviewStatus: 'draft' | 'reviewed' | 'approved'
  cadenceHint: string | null
  /** Optional category assignment. Null = "Uten kategori". */
  categoryId: string | null
  /** Per-template metadata field declarations. */
  metadataSchema: TemplateMetadataSchema
}

export type UseSurveyOrgTemplatesReturn = {
  loading: boolean
  error: string | null
  templates: ResolvedSurveyTemplate[]
  forPack: (pack: SurveyPackSlug) => ResolvedSurveyTemplate[]
  pinnedForPack: (pack: SurveyPackSlug) => ResolvedSurveyTemplate[]
  refresh: () => Promise<void>
  setNavPinned: (overrideId: string, pinned: boolean) => Promise<void>
  setReviewStatus: (
    overrideId: string,
    status: 'draft' | 'reviewed' | 'approved',
  ) => Promise<void>
  /** Assign / clear the category on an org-template override. */
  setCategoryId: (overrideId: string, categoryId: string | null) => Promise<void>
  /** Replace the template's metadata_schema. */
  setMetadataSchema: (overrideId: string, schema: TemplateMetadataSchema) => Promise<void>
}

type CatalogJoin = {
  id: string
  name: string
  short_name: string | null
  description: string | null
  body: unknown
  is_system: boolean
}

type JoinedRow = SurveyOrgTemplateRow & {
  survey_template_catalog: CatalogJoin | null
}

export function useSurveyOrgTemplates(
  input: UseSurveyOrgTemplatesInput,
): UseSurveyOrgTemplatesReturn {
  const { supabase } = input
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [rows, setRows] = useState<JoinedRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    try {
      const { data, error: respErr } = await supabase
        .from('survey_org_templates')
        .select(
          '*, survey_template_catalog!inner(id, name, short_name, description, body, is_system)',
        )
        .eq('organization_id', orgId)
        .is('deleted_at', null)
      if (respErr) throw respErr

      // Validate the org_template part with Zod; pass through the joined
      // catalog payload as-is (catalog rows already have their own validation
      // path elsewhere in modules/survey/).
      const ok: JoinedRow[] = []
      let failed = 0
      for (const raw of data ?? []) {
        const parsed = SurveyOrgTemplateRowSchema.safeParse(raw)
        if (parsed.success) {
          const joined = (raw as { survey_template_catalog?: CatalogJoin | null })
            .survey_template_catalog
          ok.push({ ...parsed.data, survey_template_catalog: joined ?? null })
        } else {
          failed += 1
        }
      }
      setRows(ok)
      setFetchedFor(orgId)
      if (failed > 0) {
        setError(`Kunne ikke tolke ${failed} maloverstyringer.`)
      } else {
        setError(null)
      }
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
      setFetchedFor(orgId)
    }
  }, [supabase, orgId])

  useEffect(() => {
    if (!supabase || !orgId) return
    void load()
  }, [load, supabase, orgId])

  const loading = targetKey !== null && targetKey !== fetchedFor

  const templates = useMemo<ResolvedSurveyTemplate[]>(() => {
    return rows
      .filter((r) => r.survey_template_catalog !== null)
      .map((r) => {
        const c = r.survey_template_catalog as CatalogJoin
        return {
          overrideId: r.id,
          catalogId: c.id,
          organizationId: r.organization_id,
          pack: r.pack,
          name: r.name_override ?? c.name,
          description: r.description_override ?? c.description,
          body: r.body_override ?? c.body,
          shortName: c.short_name,
          isSystem: c.is_system,
          navPinned: r.nav_pinned,
          isActive: r.is_active,
          reviewStatus: r.review_status,
          cadenceHint: r.cadence_hint,
          categoryId: r.category_id,
          metadataSchema: r.metadata_schema,
        }
      })
  }, [rows])

  const forPack = useCallback(
    (pack: SurveyPackSlug) => templates.filter((t) => t.pack === pack && t.isActive),
    [templates],
  )

  const pinnedForPack = useCallback(
    (pack: SurveyPackSlug) =>
      templates.filter((t) => t.pack === pack && t.isActive && t.navPinned),
    [templates],
  )

  const applyPatch = useCallback(
    async (
      overrideId: string,
      patch: {
        nav_pinned?: boolean
        review_status?: 'draft' | 'reviewed' | 'approved'
        category_id?: string | null
        metadata_schema?: TemplateMetadataSchema
      },
    ): Promise<void> => {
      if (!supabase || !orgId) return
      try {
        const { data, error: upErr } = await supabase
          .from('survey_org_templates')
          .update(patch)
          .eq('id', overrideId)
          .eq('organization_id', orgId)
          .select(
            '*, survey_template_catalog!inner(id, name, short_name, description, body, is_system)',
          )
          .single()
        if (upErr) throw upErr
        const parsed = SurveyOrgTemplateRowSchema.safeParse(data)
        if (parsed.success) {
          const joined = (data as { survey_template_catalog?: CatalogJoin | null })
            .survey_template_catalog
          setRows((prev) =>
            prev.map((r) =>
              r.id === overrideId
                ? { ...parsed.data, survey_template_catalog: joined ?? null }
                : r,
            ),
          )
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  const setNavPinned = useCallback(
    (overrideId: string, pinned: boolean) => applyPatch(overrideId, { nav_pinned: pinned }),
    [applyPatch],
  )

  const setReviewStatus = useCallback(
    (overrideId: string, status: 'draft' | 'reviewed' | 'approved') =>
      applyPatch(overrideId, { review_status: status }),
    [applyPatch],
  )

  const setCategoryId = useCallback(
    (overrideId: string, categoryId: string | null) =>
      applyPatch(overrideId, { category_id: categoryId }),
    [applyPatch],
  )

  const setMetadataSchema = useCallback(
    (overrideId: string, schema: TemplateMetadataSchema) =>
      applyPatch(overrideId, { metadata_schema: schema }),
    [applyPatch],
  )

  return useMemo(
    () => ({
      loading,
      error,
      templates,
      forPack,
      pinnedForPack,
      refresh: load,
      setNavPinned,
      setReviewStatus,
      setCategoryId,
      setMetadataSchema,
    }),
    [
      loading,
      error,
      templates,
      forPack,
      pinnedForPack,
      load,
      setNavPinned,
      setReviewStatus,
      setCategoryId,
      setMetadataSchema,
    ],
  )
}
