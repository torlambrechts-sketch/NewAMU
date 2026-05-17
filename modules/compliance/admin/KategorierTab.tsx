// KategorierTab — admin CRUD for per-pack template categories.
//
// Shows the active pack's categories as a sortable list. System
// categories ("Vernerunder", "Internkontroll", …) ship pre-seeded per
// pack; admins can rename or deactivate them, and add their own
// alongside. Slug + pack are immutable post-creation. Position lets
// admins control the order categories appear in the sidebar/hub.
//
// Soft-delete (deleted_at) instead of hard-delete: every template that
// pointed at the row keeps its column intact until the admin reassigns
// (or until the FK ON DELETE SET NULL fires on hard-delete via the DB).

import { useEffect, useMemo, useState } from 'react'
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useActivePack } from '../../../src/context/packContextValue'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { ToggleSwitch } from '../../../src/components/ui/FormToggles'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { SlidePanel } from '../../../src/components/layout/SlidePanel'
import {
  WPSTD_FORM_FIELD_LABEL,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import { CategoryReorderList } from '../../../src/components/categories/CategoryReorderList'
import { useChecklistModule } from '../useChecklistModule'
import type { ComplianceCategoryRow } from '../types'

export function KategorierTab() {
  const { supabase } = useOrgSetupContext()
  const pack = useActivePack()
  const cl = useChecklistModule({ supabase })
  const { loadCategories } = cl

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const visible = useMemo(
    () =>
      cl.categories
        .filter((c) => c.pack === pack.slug)
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb')),
    [cl.categories, pack.slug],
  )

  const templateCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of cl.templates) {
      if (!t.category_id) continue
      m.set(t.category_id, (m.get(t.category_id) ?? 0) + 1)
    }
    return m
  }, [cl.templates])

  const [editTarget, setEditTarget] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; category: ComplianceCategoryRow }
    | null
  >(null)

  return (
    <div className="space-y-6">
      {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">
              Kategorier — {pack.shortName}
            </h2>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setEditTarget({ mode: 'create' })}
          >
            Ny kategori
          </Button>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Kategorier grupperer maler i sidemenyen og på forsiden av
          Sjekklister. Systemkategorier kommer ferdig med pakken — du kan
          gi dem nytt navn eller deaktivere dem, men ikke slette.
        </p>

        <div className="mt-5">
          <CategoryReorderList
            items={visible}
            emptyState={
              <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
                Ingen kategorier for {pack.shortName} ennå.
              </p>
            }
            onReorder={async (orderedIds) => {
              const byId = new Map(visible.map((c) => [c.id, c]))
              await Promise.all(
                orderedIds.map((id, idx) => {
                  const cat = byId.get(id)
                  const next = (idx + 1) * 10
                  if (!cat || cat.position === next) return Promise.resolve()
                  return cl.updateCategory({ categoryId: id, position: next })
                }),
              )
            }}
            renderItem={(c) => (
              <CategoryRow
                category={c}
                templateCount={templateCount.get(c.id) ?? 0}
                onEdit={() => setEditTarget({ mode: 'edit', category: c })}
                onToggleActive={(value) =>
                  cl.updateCategory({ categoryId: c.id, is_active: value })
                }
                onDelete={() => cl.softDeleteCategory(c.id)}
              />
            )}
          />
        </div>
      </ModuleSectionCard>

      {editTarget ? (
        <CategoryEditorPanel
          mode={editTarget.mode}
          category={editTarget.mode === 'edit' ? editTarget.category : null}
          packSlug={pack.slug}
          packLabel={pack.shortName}
          onClose={() => setEditTarget(null)}
          onSave={async (payload) => {
            if (editTarget.mode === 'create') {
              const id = await cl.createCategory({
                pack: pack.slug,
                slug: payload.slug,
                name: payload.name,
                description: payload.description,
                position: payload.position,
              })
              if (!id) return false
            } else {
              await cl.updateCategory({
                categoryId: editTarget.category.id,
                name: payload.name,
                description: payload.description,
                position: payload.position,
              })
            }
            setEditTarget(null)
            return true
          }}
        />
      ) : null}
    </div>
  )
}

// ── Row ─────────────────────────────────────────────────────────────────────

function CategoryRow({
  category,
  templateCount,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  category: ComplianceCategoryRow
  templateCount: number
  onEdit: () => void
  onToggleActive: (value: boolean) => void | Promise<void>
  onDelete: () => void | Promise<void>
}) {
  const handleDelete = async () => {
    if (category.is_system) return
    const ok = window.confirm(
      `Slette kategorien «${category.name}»? Maler som tilhører denne kategorien beholdes, men flyttes til "Uten kategori".`,
    )
    if (!ok) return
    await onDelete()
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button
          variant="ghost"
          onClick={onEdit}
          className="min-w-0 flex-1 flex-col items-start gap-0 rounded-md px-0 py-0 text-left font-normal hover:bg-transparent"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-900">{category.name}</span>
            {category.is_system ? <Badge variant="info">System</Badge> : null}
            {!category.is_active ? <Badge variant="neutral">Inaktiv</Badge> : null}
            <Badge variant="neutral">
              {templateCount} {templateCount === 1 ? 'mal' : 'maler'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            <span className="font-mono">{category.slug}</span>
            <span className="mx-1.5">·</span>
            <span>posisjon {category.position}</span>
            {category.description ? (
              <>
                <span className="mx-1.5">·</span>
                <span>{category.description}</span>
              </>
            ) : null}
          </p>
        </Button>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={onEdit}
          >
            Rediger
          </Button>
          {!category.is_system ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleDelete}
              aria-label="Slett kategori"
            >
              Slett
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-neutral-200/80 pt-3 text-xs text-neutral-700">
        <label className="inline-flex items-center gap-2">
          <ToggleSwitch
            checked={category.is_active}
            onChange={(v) => onToggleActive(v)}
            label="Aktiv"
          />
          <span>Aktiv</span>
        </label>
      </div>
    </>
  )
}

// ── Editor panel ────────────────────────────────────────────────────────────

type EditorPayload = {
  slug: string
  name: string
  description: string | null
  position: number
}

function CategoryEditorPanel({
  mode,
  category,
  packSlug,
  packLabel,
  onClose,
  onSave,
}: {
  mode: 'create' | 'edit'
  category: ComplianceCategoryRow | null
  packSlug: string
  packLabel: string
  onClose: () => void
  onSave: (payload: EditorPayload) => Promise<boolean>
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [position, setPosition] = useState(String(category?.position ?? 100))
  const [submitting, setSubmitting] = useState(false)

  const isSystem = Boolean(category?.is_system)
  const slugFromName = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const canSubmit =
    !submitting &&
    name.trim().length > 0 &&
    (mode === 'edit' || slug.trim().length > 0)

  const handleSave = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSave({
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim() || null,
        position: Number(position) || 100,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SlidePanel
      open
      onClose={onClose}
      titleId="form-edit-category"
      title={mode === 'create' ? `Ny kategori — ${packLabel}` : `Rediger ${category?.name ?? 'kategori'}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Avbryt
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={!canSubmit}>
            {submitting ? 'Lagrer …' : 'Lagre'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-xs text-neutral-500">
          Pakke: <span className="font-medium text-neutral-700">{packSlug}</span>
        </p>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cat-name">
            Navn <span className="text-red-500">*</span>
          </label>
          <StandardInput
            id="cat-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (mode === 'create' && slug === '') {
                // Auto-suggest a slug while the user is still typing the name.
                setSlug(slugFromName(e.target.value))
              }
            }}
            placeholder="F.eks. Brann og rømning"
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cat-slug">
            Slug
          </label>
          <p className="mb-1 text-xs text-neutral-500">
            Stabil intern identifikator (a-z, 0-9, bindestrek). Kan ikke endres etter opprettelse.
          </p>
          <StandardInput
            id="cat-slug"
            value={slug}
            onChange={(e) => setSlug(slugFromName(e.target.value))}
            placeholder="brann-og-romning"
            disabled={mode === 'edit'}
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cat-description">
            Beskrivelse
          </label>
          <StandardTextarea
            id="cat-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Hva slags maler tilhører denne kategorien?"
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cat-position">
            Posisjon
          </label>
          <p className="mb-1 text-xs text-neutral-500">
            Lavere tall vises først. Standardkategorier bruker 10–50.
          </p>
          <StandardInput
            id="cat-position"
            type="number"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            min={0}
          />
        </div>

        {isSystem ? (
          <p className="text-xs text-neutral-500">
            Dette er en systemkategori. Du kan endre navn og posisjon, men ikke slug eller pakke.
          </p>
        ) : null}
      </div>
    </SlidePanel>
  )
}
