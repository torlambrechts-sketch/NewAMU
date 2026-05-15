// Alerts nav feed — supplies AticsShell with dynamically-built "Varslinger"
// sub-entries from `alert_system_templates` overlaid with the org's
// `alert_org_template_settings` (toggle/category/nav_pinned/override_name).
// Mirrors useMeetingsNav / useComplianceNav.

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'

export type AlertsPinnedNavItem = {
  templateId: string
  templateSlug: string
  templateName: string
  kind: string
  /** Stable category id, null = uncategorised. */
  categoryId: string | null
  /** Header bucket key (categoryId ?? '__uncat__'). */
  headerKey: string
  navPinned: boolean
  position: number
  /** Deep-link path including ?template=. */
  to: string
}

export type AlertsNavCategory = {
  id: string
  slug: string
  name: string
  position: number
}

export type UseAlertsNavReturn = {
  loading: boolean
  items: AlertsPinnedNavItem[]
  categories: AlertsNavCategory[]
}

type SystemTemplateRow = {
  id: string
  slug: string
  label: string
  kind: string
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

export function useAlertsNav(): UseAlertsNavReturn {
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
        .from('alert_system_templates')
        .select('id, slug, label, kind, default_category_slug, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true }),
      supabase
        .from('alert_org_template_settings')
        .select('system_template_id, enabled, nav_pinned, position, category_id, override_name')
        .eq('organization_id', orgId),
      supabase
        .from('alert_template_categories')
        .select('id, slug, name, position')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('position', { ascending: true })
        .order('name', { ascending: true }),
    ])
      .catch((e) => {
        if (cancelled) return null
        console.warn('useAlertsNav fetch failed', e)
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

  const categories = useMemo<AlertsNavCategory[]>(() => {
    return categoryRows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      position: c.position,
    }))
  }, [categoryRows])

  const items = useMemo<AlertsPinnedNavItem[]>(() => {
    const settingsById = new Map<string, OrgSettingRow>()
    for (const s of settingRows) settingsById.set(s.system_template_id, s)
    const categoryBySlug = new Map<string, CategoryRow>()
    for (const c of categoryRows) categoryBySlug.set(c.slug, c)

    return templateRows
      .filter((t) => {
        const setting = settingsById.get(t.id)
        return setting ? setting.enabled : true
      })
      .map((t) => {
        const setting = settingsById.get(t.id)
        const categoryId =
          setting?.category_id ??
          (t.default_category_slug ? categoryBySlug.get(t.default_category_slug)?.id ?? null : null)
        return {
          templateId: t.id,
          templateSlug: t.slug,
          templateName: setting?.override_name ?? t.label,
          kind: t.kind,
          categoryId,
          headerKey: categoryId ?? '__uncat__',
          navPinned: setting?.nav_pinned ?? false,
          position: setting?.position ?? t.sort_order,
          to: `/alerts?template=${encodeURIComponent(t.id)}`,
        } satisfies AlertsPinnedNavItem
      })
      .sort((a, b) => a.position - b.position || a.templateName.localeCompare(b.templateName, 'nb'))
  }, [templateRows, settingRows, categoryRows])

  return { loading, items, categories }
}
