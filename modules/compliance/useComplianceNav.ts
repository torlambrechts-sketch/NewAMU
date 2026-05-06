// Compliance navigation feed — supplies the AticsShell sidebar with
// dynamically-built entries from the org's licensed packs and pinned
// templates. Filters by the active pack focus when ?pack= is present
// in the URL (the focus principle: switching pack switches the sidebar
// to that regulation's templates).
//
// Read-only. Used by AticsShell at module-tree level, so kept lean —
// one query, no mutations, no Zod (templates are already validated by
// useChecklistModule when the page opens).

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { usePacks } from './usePacks'
import type { CompliancePackSlug } from './types'

export type CompliancePinnedNavItem = {
  templateId: string
  templateSlug: string
  name: string
  pack: CompliancePackSlug
  /** Path including ?template= and ?pack= so a deep link reproduces the view. */
  to: string
}

export type UseComplianceNavReturn = {
  loading: boolean
  /** Whether the org has any licensed pack at all. */
  hasAnyPack: boolean
  /** Pinned templates for the active pack focus (or all if none active). */
  items: CompliancePinnedNavItem[]
}

type PinnedTemplateRow = {
  id: string
  slug: string
  name: string
  pack: CompliancePackSlug
}

export function useComplianceNav(): UseComplianceNavReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const { packs, loading: packsLoading } = usePacks({ supabase })
  const [searchParams] = useSearchParams()
  const activePackParam = searchParams.get('pack')

  const [pinned, setPinned] = useState<PinnedTemplateRow[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    supabase
      .from('compliance_checklist_templates')
      .select('id, slug, name, pack')
      .eq('organization_id', orgId)
      .eq('nav_pinned', true)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        setPinned(error ? [] : ((data ?? []) as PinnedTemplateRow[]))
        setFetchedFor(orgId)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const loading = targetKey !== null && targetKey !== fetchedFor

  const items = useMemo<CompliancePinnedNavItem[]>(() => {
    const licensedSlugs = new Set(packs.map((p) => p.slug))

    // Default focus = first licensed pack (matches PackProvider fallback).
    const focusSlug =
      activePackParam && licensedSlugs.has(activePackParam as CompliancePackSlug)
        ? (activePackParam as CompliancePackSlug)
        : (packs[0]?.slug ?? null)

    return pinned
      .filter((t) => licensedSlugs.has(t.pack))
      .filter((t) => focusSlug === null || t.pack === focusSlug)
      .map((t) => ({
        templateId: t.id,
        templateSlug: t.slug,
        name: t.name,
        pack: t.pack,
        to: `/compliance/checklists?template=${encodeURIComponent(t.slug)}&pack=${encodeURIComponent(t.pack)}`,
      }))
  }, [pinned, packs, activePackParam])

  return {
    loading: loading || packsLoading,
    hasAnyPack: packs.length > 0,
    items,
  }
}
