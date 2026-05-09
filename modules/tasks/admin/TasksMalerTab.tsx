// TasksMalerTab — activate/deactivate and pin/unpin task templates for the org.
// System templates cannot be deleted but can be toggled and categorised.
// Custom templates (org-owned) can be fully managed here.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckSquare, Pin, PinOff } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { Badge } from '../../../src/components/ui/Badge'
import { ToggleSwitch } from '../../../src/components/ui/FormToggles'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { TaskKindIcon } from '../components/TaskKindIcon'
import type { TaskTemplateKind } from '../../../src/types/task'

type OrgTemplateRow = {
  id: string         // task_org_templates.id
  catalogId: string
  slug: string
  name: string
  description: string
  templateKind: TaskTemplateKind
  lawRefs: string[]
  isSystem: boolean
  isActive: boolean
  navPinned: boolean
  categoryId: string | null
}

type CategoryRow = { id: string; name: string; position: number }

export function TasksMalerTab() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [templates, setTemplates] = useState<OrgTemplateRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    const [tplRes, catRes] = await Promise.all([
      supabase
        .from('task_org_templates')
        .select(
          'id, catalog_id, category_id, nav_pinned, is_active, task_template_catalog(id, slug, name, description, template_kind, law_refs, is_system)',
        )
        .eq('organization_id', orgId)
        .is('deleted_at', null),
      supabase
        .from('task_template_categories')
        .select('id, name, position')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('position'),
    ])
    setLoading(false)
    if (tplRes.error) { setError(tplRes.error.message); return }

    setTemplates(
      (tplRes.data ?? []).map((r) => {
        const raw = r as Record<string, unknown>
        const cat = raw.task_template_catalog as Record<string, unknown> | null
        return {
          id: String(raw.id),
          catalogId: String(raw.catalog_id ?? ''),
          slug: cat ? String(cat.slug ?? '') : '',
          name: cat ? String(cat.name ?? '') : '(ukjent)',
          description: cat ? String(cat.description ?? '') : '',
          templateKind: (cat?.template_kind ?? 'oppgave') as TaskTemplateKind,
          lawRefs: (cat?.law_refs as string[]) ?? [],
          isSystem: Boolean(cat?.is_system),
          isActive: Boolean(raw.is_active),
          navPinned: Boolean(raw.nav_pinned),
          categoryId: raw.category_id ? String(raw.category_id) : null,
        }
      }),
    )

    if (!catRes.error) {
      setCategories(
        (catRes.data ?? []).map((c) => ({
          id: String(c.id),
          name: String(c.name),
          position: Number(c.position),
        })),
      )
    }
  }, [supabase, orgId])

  useEffect(() => { void load() }, [load])

  const toggle = async (id: string, field: 'is_active' | 'nav_pinned', current: boolean) => {
    if (!supabase) return
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, isActive: field === 'is_active' ? !current : t.isActive, navPinned: field === 'nav_pinned' ? !current : t.navPinned }
          : t,
      ),
    )
    await supabase.from('task_org_templates').update({ [field]: !current }).eq('id', id)
  }

  const updateCategory = async (id: string, categoryId: string | null) => {
    if (!supabase) return
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, categoryId } : t)))
    await supabase.from('task_org_templates').update({ category_id: categoryId }).eq('id', id)
  }

  const sorted = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name, 'nb')),
    [templates],
  )

  if (loading) return <p className="py-8 text-sm text-neutral-500">Laster maler…</p>

  return (
    <div className="space-y-4">
      {error && <WarningBox>{error}</WarningBox>}

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-5">
          <CheckSquare className="h-5 w-5 text-[#c2410c]" aria-hidden />
          <h2 className="text-base font-semibold text-neutral-900">Oppgavemaler</h2>
          <span className="ml-1 text-sm text-neutral-500">
            {templates.filter((t) => t.isActive).length} aktive
          </span>
        </div>

        <div className="overflow-x-auto -mx-5 md:-mx-6">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-neutral-200 bg-neutral-50 text-left">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Mal
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Kategori
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Aktiv
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Festet i meny
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} className="border-b border-neutral-200/60 hover:bg-neutral-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <TaskKindIcon kind={t.templateKind} className="h-4 w-4 text-[#c2410c]/60 shrink-0" />
                      <div>
                        <p className="font-medium text-neutral-900">{t.name}</p>
                        {t.description && (
                          <p className="text-xs text-neutral-500 line-clamp-1">{t.description}</p>
                        )}
                      </div>
                      {t.isSystem && (
                        <Badge variant="neutral" className="ml-1">System</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={t.categoryId ?? ''}
                      onChange={(e) => void updateCategory(t.id, e.target.value || null)}
                      className="w-40 rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 focus:border-[#c2410c] focus:outline-none"
                    >
                      <option value="">Uten kategori</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex justify-center">
                      <ToggleSwitch
                        checked={t.isActive}
                        onChange={() => void toggle(t.id, 'is_active', t.isActive)}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => void toggle(t.id, 'nav_pinned', t.navPinned)}
                      disabled={!t.isActive}
                      className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        t.navPinned
                          ? 'border-[#c2410c]/30 bg-orange-50 text-[#c2410c]'
                          : 'border-neutral-200 bg-white text-neutral-400 hover:border-neutral-300'
                      }`}
                      aria-label={t.navPinned ? 'Fjern fra meny' : 'Fest i meny'}
                    >
                      {t.navPinned
                        ? <><PinOff className="h-3.5 w-3.5" /> Festet</>
                        : <><Pin className="h-3.5 w-3.5" /> Fest</>
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ModuleSectionCard>
    </div>
  )
}
