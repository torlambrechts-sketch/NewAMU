// Documents nav feed (documents-parity §T6) — supplies AticsShell with
// dynamically-built "Dokumenter" sidebar shortcuts from the org's
// nav-pinned template overrides, grouped by space.
//
// Mirrors modules/survey/useSurveyNav.ts. Read-only; admin pinning lives
// in DocumentTemplatesSettings via useDocuments.setOrgTemplateNavPinned.

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import type { SpaceCategory } from '../types/documents'

export type DocumentPinnedNavItem = {
  /** document_org_templates.id — also used as the deep-link query param. */
  templateId: string
  templateName: string
  category: SpaceCategory
  /** Stable bucket key used by the sidebar header collapse logic. The
   *  shape mirrors `surveyPinnedSubs`: one bucket per category, plus an
   *  uncategorised bucket when needed. */
  headerKey: string
  to: string
}

export type DocumentNavCategory = {
  id: string
  /** Norwegian display label, mirrored from documents space-category labels. */
  name: string
  position: number
  /** Cat 1 of the cross-module taxonomy (category-architecture §T2). */
  regulationId: string | null
}

export type UseDocumentNavReturn = {
  loading: boolean
  items: DocumentPinnedNavItem[]
  categories: DocumentNavCategory[]
}

type PinnedRow = {
  id: string
  label: string
  category: SpaceCategory
}

const CATEGORY_LABEL: Record<SpaceCategory, string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policyer',
  procedure: 'Prosedyrer',
  guide: 'Guider',
  template_library: 'Malbibliotek',
  varsling: 'Varsling',
  personal: 'Personal',
  personvern: 'Personvern',
  likestilling: 'Likestilling',
  protokoll: 'Protokoller',
  register: 'Registre',
  beredskap: 'Beredskap',
  bransje: 'Bransje',
}

const CATEGORY_ORDER: Record<SpaceCategory, number> = {
  hms_handbook: 1,
  policy: 2,
  procedure: 3,
  guide: 4,
  protokoll: 5,
  varsling: 6,
  personal: 7,
  personvern: 8,
  likestilling: 9,
  beredskap: 10,
  register: 11,
  bransje: 12,
  template_library: 99,
}

// Mirrors the deterministic backfill in 20260828120036 — keep aligned.
const CATEGORY_REGULATION: Record<SpaceCategory, string | null> = {
  hms_handbook: 'ik-f',
  procedure: 'ik-f',
  policy: null,
  guide: null,
  template_library: null,
  varsling: 'aml',
  personal: 'aml',
  personvern: 'gdpr',
  likestilling: 'ldl',
  protokoll: 'aml',
  register: 'aml',
  beredskap: 'aml',
  bransje: null,
}

export function useDocumentNav(): UseDocumentNavReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [pinned, setPinned] = useState<PinnedRow[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    void supabase
      .from('document_org_templates')
      .select('id, label, category, nav_pinned')
      .eq('organization_id', orgId)
      .eq('nav_pinned', true)
      .order('label', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setPinned([])
        } else {
          setPinned(
            ((data ?? []) as { id: string; label: string; category: SpaceCategory }[]).map(
              (r) => ({ id: r.id, label: r.label, category: r.category }),
            ),
          )
        }
        setFetchedFor(orgId)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const loading = targetKey !== null && targetKey !== fetchedFor

  const items = useMemo<DocumentPinnedNavItem[]>(
    () =>
      pinned.map((t) => ({
        templateId: t.id,
        templateName: t.label,
        category: t.category,
        headerKey: t.category,
        // Deep-link to the templates settings page filtered to this template
        // — matches the existing query param convention used by the wiki
        // editor when a template is selected.
        to: `/documents/templates?template=${encodeURIComponent(t.id)}`,
      })),
    [pinned],
  )

  const categories = useMemo<DocumentNavCategory[]>(() => {
    const present = new Set(items.map((i) => i.category))
    return [...present]
      .map((c) => ({
        id: c,
        name: CATEGORY_LABEL[c] ?? c,
        position: CATEGORY_ORDER[c] ?? 99,
        regulationId: CATEGORY_REGULATION[c] ?? null,
      }))
      .sort((a, b) => a.position - b.position)
  }, [items])

  return { loading, items, categories }
}
