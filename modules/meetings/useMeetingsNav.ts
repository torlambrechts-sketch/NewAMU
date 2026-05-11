// Meetings nav feed — supplies AticsShell with dynamically-built "Møter"
// sub-entries from `meeting_system_templates` overlaid with the org's
// `meeting_org_template_settings` (toggle/category/nav_pinned/override_name).
// Mirrors useSurveyNav: sidebar reads the system catalog directly so a
// missing per-org settings row never empties the menu.

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'

export type MeetingsPinnedNavItem = {
  templateId: string
  templateSlug: string
  templateName: string
  framework: string
  /** Stable category id, null = uncategorised. */
  categoryId: string | null
  /** Header bucket key for the sidebar (categoryId ?? '__uncat__'). */
  headerKey: string
  /** Pinned-only flag (admins choose which templates surface as sidebar
   *  shortcuts). Non-pinned templates are still browseable from /meetings. */
  navPinned: boolean
  /** Position in the sidebar within the category. */
  position: number
  /** Deep-link path including ?template=. */
  to: string
}

export type MeetingsNavCategory = {
  id: string
  slug: string
  name: string
  position: number
}

export type UseMeetingsNavReturn = {
  loading: boolean
  items: MeetingsPinnedNavItem[]
  categories: MeetingsNavCategory[]
}

type SystemTemplateRow = {
  id: string
  slug: string
  label: string
  framework: string
  default_category_slug: string | null
  sort_order: number
  is_active: boolean
}

type OrgSettingRow = {
  system_template_id: string
  enabled: boolean
  nav_pinned: boolean
  position: number
  category_id: string | null
  override_name: string | null
}

type CategoryRow = {
  id: string
  slug: string
  name: string
  position: number
}

export function useMeetingsNav(): UseMeetingsNavReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [templateRows, setTemplateRows] = useState<SystemTemplateRow[]>([])
  const [settingRows, setSettingRows] = useState<OrgSettingRow[]>([])
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    void Promise.all([
      supabase
        .from('meeting_system_templates')
        .select('id, slug, label, framework, default_category_slug, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true }),
      supabase
        .from('meeting_org_template_settings')
        .select('system_template_id, enabled, nav_pinned, position, category_id, override_name')
        .eq('organization_id', orgId),
      supabase
        .from('meeting_template_categories')
        .select('id, slug, name, position')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('position', { ascending: true })
        .order('name', { ascending: true }),
    ])
      .catch((e) => {
        if (cancelled) return null
        console.warn('useMeetingsNav fetch failed', e)
        setFetchedFor(orgId)
        return null
      })
      .then((res) => {
        if (!res || cancelled) return
        const [tplRes, settingsRes, catRes] = res
        setTemplateRows(tplRes.error ? [] : ((tplRes.data ?? []) as SystemTemplateRow[]))
        setSettingRows(settingsRes.error ? [] : ((settingsRes.data ?? []) as OrgSettingRow[]))
        setCategoryRows(catRes.error ? [] : ((catRes.data ?? []) as CategoryRow[]))
        setFetchedFor(orgId)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const loading = targetKey !== null && targetKey !== fetchedFor

  const categories = useMemo<MeetingsNavCategory[]>(() => {
    return categoryRows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      position: c.position,
    }))
  }, [categoryRows])

  const items = useMemo<MeetingsPinnedNavItem[]>(() => {
    const settingsById = new Map<string, OrgSettingRow>()
    for (const s of settingRows) settingsById.set(s.system_template_id, s)

    const categoryBySlug = new Map<string, CategoryRow>()
    for (const c of categoryRows) categoryBySlug.set(c.slug, c)

    return templateRows
      .filter((t) => {
        const setting = settingsById.get(t.id)
        // Default: enabled when no settings row yet (provision fn may be in flight).
        return setting ? setting.enabled : true
      })
      .map((t) => {
        const setting = settingsById.get(t.id)
        // Per-org category wins; fallback to system default_category_slug.
        const categoryId =
          setting?.category_id ??
          (t.default_category_slug ? categoryBySlug.get(t.default_category_slug)?.id ?? null : null)
        return {
          templateId: t.id,
          templateSlug: t.slug,
          templateName: setting?.override_name ?? t.label,
          framework: t.framework,
          categoryId,
          headerKey: categoryId ?? '__uncat__',
          navPinned: setting?.nav_pinned ?? false,
          position: setting?.position ?? t.sort_order,
          to: `/meetings?template=${encodeURIComponent(t.id)}`,
        } satisfies MeetingsPinnedNavItem
      })
      .sort((a, b) => a.position - b.position || a.templateName.localeCompare(b.templateName, 'nb'))
  }, [templateRows, settingRows, categoryRows])

  return { loading, items, categories }
}
