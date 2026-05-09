// TasksKategorierTab — CRUD for task_template_categories.
// Drag-to-reorder via CategoryReorderList; each category groups templates
// in the hub tile grid and the sidebar nav header.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { CategoryReorderList } from '../../../src/components/categories/CategoryReorderList'
import { SlidePanel } from '../../../src/components/layout/SlidePanel'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
  WPSTD_FORM_LEAD,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'

type CategoryRow = {
  id: string
  name: string
  description: string
  position: number
}

type FormState = { name: string; description: string }

const EMPTY_FORM: FormState = { name: '', description: '' }

export function TasksKategorierTab() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [panelTarget, setPanelTarget] = useState<
    { mode: 'create' } | { mode: 'edit'; row: CategoryRow } | null
  >(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    const { data, error: e } = await supabase
      .from('task_template_categories')
      .select('id, name, description, position')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('position')
      .order('name')
    setLoading(false)
    if (e) { setError(e.message); return }
    setCategories(
      (data ?? []).map((r) => ({
        id: String(r.id),
        name: String(r.name ?? ''),
        description: String(r.description ?? ''),
        position: Number(r.position ?? 100),
      })),
    )
  }, [supabase, orgId])

  useEffect(() => { void load() }, [load])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setPanelTarget({ mode: 'create' })
  }

  const openEdit = (row: CategoryRow) => {
    setForm({ name: row.name, description: row.description })
    setPanelTarget({ mode: 'edit', row })
  }

  const savePanel = async () => {
    if (!supabase || !orgId || !form.name.trim()) return
    setSaving(true)
    try {
      if (panelTarget?.mode === 'create') {
        const maxPos = categories.length > 0 ? Math.max(...categories.map((c) => c.position)) + 10 : 10
        const { data } = await supabase
          .from('task_template_categories')
          .insert({ organization_id: orgId, name: form.name.trim(), description: form.description.trim(), position: maxPos })
          .select('id, name, description, position')
          .single()
        if (data) {
          setCategories((prev) => [
            ...prev,
            { id: String(data.id), name: String(data.name), description: String(data.description ?? ''), position: Number(data.position) },
          ])
        }
      } else if (panelTarget?.mode === 'edit') {
        const id = panelTarget.row.id
        await supabase
          .from('task_template_categories')
          .update({ name: form.name.trim(), description: form.description.trim() })
          .eq('id', id)
        setCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, name: form.name.trim(), description: form.description.trim() } : c)),
        )
      }
      setPanelTarget(null)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!supabase) return
    setCategories((prev) => prev.filter((c) => c.id !== id))
    await supabase
      .from('task_template_categories')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
  }

  const handleReorder = async (orderedIds: string[]) => {
    if (!supabase) return
    setCategories((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c]))
      return orderedIds.flatMap((id, i) => {
        const c = byId.get(id)
        return c ? [{ ...c, position: (i + 1) * 10 }] : []
      })
    })
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from('task_template_categories').update({ position: (i + 1) * 10 }).eq('id', id),
      ),
    )
  }

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb')),
    [categories],
  )

  const panelTitle = panelTarget?.mode === 'edit' ? 'Rediger kategori' : 'Ny kategori'

  return (
    <>
      <div className="space-y-4">
        {error && <WarningBox>{error}</WarningBox>}

        <ModuleSectionCard className="p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-[#c2410c]" aria-hidden />
              <h2 className="text-base font-semibold text-neutral-900">Kategorier</h2>
              <span className="text-sm text-neutral-500">{categories.length}</span>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={openCreate}
            >
              Ny kategori
            </Button>
          </div>

          {loading ? (
            <p className="py-4 text-sm text-neutral-500">Laster kategorier…</p>
          ) : sorted.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 py-10 text-center">
              <p className="text-sm text-neutral-500">Ingen kategorier ennå.</p>
              <div className="mt-3 inline-flex">
                <Button variant="secondary" size="sm" onClick={openCreate}>
                  Opprett første kategori
                </Button>
              </div>
            </div>
          ) : (
            <CategoryReorderList
              items={sorted}
              onReorder={handleReorder}
              renderItem={(cat) => (
                <div className="flex w-full items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs text-neutral-500">{cat.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(cat)}
                      className="rounded p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                      aria-label="Rediger"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(cat.id)}
                      className="rounded p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label="Slett"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
              emptyState={null}
            />
          )}
        </ModuleSectionCard>
      </div>

      <SlidePanel
        open={panelTarget !== null}
        onClose={() => setPanelTarget(null)}
        titleId="task-cat-panel-title"
        title={panelTitle}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPanelTarget(null)}>
              Avbryt
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void savePanel()}
              disabled={saving || !form.name.trim()}
            >
              {saving ? 'Lagrer…' : 'Lagre'}
            </Button>
          </div>
        }
      >
        <div className="divide-y divide-neutral-200/60">
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Navn *</p>
              <p className={`${WPSTD_FORM_LEAD} mt-1`}>Vises i hubben og som meny-overskrift</p>
            </div>
            <div>
              <StandardInput
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="f.eks. Avvik & Hendelser"
              />
            </div>
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</p>
              <p className={`${WPSTD_FORM_LEAD} mt-1`}>Kort forklaring av hva kategorien dekker</p>
            </div>
            <div>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Valgfri beskrivelse…"
                className="w-full rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#c2410c] focus:outline-none focus:ring-1 focus:ring-[#c2410c]/20"
              />
            </div>
          </div>
        </div>
      </SlidePanel>
    </>
  )
}
