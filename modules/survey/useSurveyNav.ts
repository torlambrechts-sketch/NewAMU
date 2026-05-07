// Survey nav feed — supplies the AticsShell sidebar with dynamically-built
// "Undersøkelser" entries from the org's licensed packs and pinned templates.
// Filters by the active pack focus when ?pack= is present in the URL.
//
// Mirrors modules/compliance/useComplianceNav.ts. Read-only; no mutations
// (admin pinning lives in the Maler tab via useSurveyOrgTemplates updates,
// landing in a follow-up).

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useSurveyPacks } from './useSurveyPacks'
import type { SurveyPackSlug } from './types'

export type SurveyPinnedNavItem = {
  catalogId: string
  templateName: string
  pack: SurveyPackSlug
  /** Path including ?template= and ?pack= so a deep link reproduces the view. */
  to: string
}

export type UseSurveyNavReturn = {
  loading: boolean
  hasAnyPack: boolean
  items: SurveyPinnedNavItem[]
}

type PinnedRow = {
  catalog_id: string
  pack: SurveyPackSlug
  name_override: string | null
  catalog_name: string
}

export function useSurveyNav(): UseSurveyNavReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const { packs, loading: packsLoading } = useSurveyPacks({ supabase })
  const [searchParams] = useSearchParams()
  const activePackParam = searchParams.get('pack')

  const [pinned, setPinned] = useState<PinnedRow[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    supabase
      .from('survey_org_templates')
      .select('catalog_id, pack, name_override, survey_template_catalog!inner(name)')
      .eq('organization_id', orgId)
      .eq('nav_pinned', true)
      .eq('is_active', true)
      .is('deleted_at', null)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setPinned([])
        } else {
          const rows: PinnedRow[] = []
          for (const raw of data ?? []) {
            const catalog = (raw as { survey_template_catalog?: { name?: string } | null })
              .survey_template_catalog
            if (!catalog?.name) continue
            rows.push({
              catalog_id: (raw as { catalog_id: string }).catalog_id,
              pack: (raw as { pack: SurveyPackSlug }).pack,
              name_override: (raw as { name_override: string | null }).name_override,
              catalog_name: catalog.name,
            })
          }
          setPinned(rows)
        }
        setFetchedFor(orgId)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const loading = packsLoading || (targetKey !== null && targetKey !== fetchedFor)

  const items = useMemo<SurveyPinnedNavItem[]>(() => {
    const licensedSlugs = new Set(packs.map((p) => p.slug))
    const focusSlug =
      activePackParam && licensedSlugs.has(activePackParam as SurveyPackSlug)
        ? (activePackParam as SurveyPackSlug)
        : (packs[0]?.slug ?? null)

    return pinned
      .filter((t) => licensedSlugs.has(t.pack))
      .filter((t) => focusSlug === null || t.pack === focusSlug)
      .map((t) => ({
        catalogId: t.catalog_id,
        templateName: t.name_override ?? t.catalog_name,
        pack: t.pack,
        to: `/survey?template=${encodeURIComponent(t.catalog_id)}&pack=${encodeURIComponent(t.pack)}`,
      }))
      .sort((a, b) => a.templateName.localeCompare(b.templateName, 'nb'))
  }, [pinned, packs, activePackParam])

  return {
    loading,
    hasAnyPack: packs.length > 0,
    items,
  }
}
