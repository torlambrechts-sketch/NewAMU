// LearningKategorierSection — admin CRUD for learning_categories.
// Mirrors compliance/admin/KategorierTab + survey/admin/SurveyKategorierTab.
// No pack-pill switcher because e-learning doesn't have packs.

import { useMemo, useState } from 'react'
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { WarningBox } from '../../components/ui/AlertBox'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { SlidePanel } from '../../components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import { CategoryReorderList } from '../../components/categories/CategoryReorderList'
import { useLearningCategories } from '../../hooks/useLearningCategories'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useLearning } from '../../hooks/useLearning'
import type { LearningCategory } from '../../types/learning'

export function KategorierSection() {
  const { supabase } = useOrgSetupContext()
  const cats = useLearningCategories({ supabase })
  const learning = useLearning()

  const visible = useMemo(
    () =>
      [...cats.categories].sort(
        (a, b) =>
          a.position - b.position || a.name.localeCompare(b.name, 'nb'),
      ),
    [cats.categories],
  )

  // Course count per category — admins want to know how much moves when
  // they rename / deactivate.
  const courseCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of learning.courses) {
      const id = c.categoryId
      if (!id) continue
      m.set(id, (m.get(id) ?? 0) + 1)
    }
    return m
  }, [learning.courses])

  const [editTarget, setEditTarget] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; category: LearningCategory }
    | null
  >(null)

  return (
    <div className="space-y-6">
      {cats.error ? <WarningBox>{cats.error}</WarningBox> : null}

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">Kategorier</h2>
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
          Kategorier grupperer kurs i kurslisten og i sidemenyen. Systemkategorier
          (HMS-grunnopplæring, Brann, Førstehjelp …) kommer ferdig med
          organisasjonen — du kan gi dem nytt navn eller deaktivere dem, men
          ikke slette.
        </p>

        <div className="mt-5">
          <CategoryReorderList
            items={visible}
            emptyState={
              <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
                Ingen kategorier ennå.
              </p>
            }
            onReorder={async (orderedIds) => {
              const byId = new Map(visible.map((c) => [c.id, c]))
              await Promise.all(
                orderedIds.map((id, idx) => {
                  const cat = byId.get(id)
                  const next = (idx + 1) * 10
                  if (!cat || cat.position === next) return Promise.resolve()
                  return cats.updateCategory({ categoryId: id, position: next })
                }),
              )
            }}
            renderItem={(c) => (
              <CategoryRow
                category={c}
                courseCount={courseCount.get(c.id) ?? 0}
                onEdit={() => setEditTarget({ mode: 'edit', category: c })}
                onToggleActive={(value) =>
                  cats.updateCategory({ categoryId: c.id, is_active: value })
                }
                onDelete={() => cats.softDeleteCategory(c.id)}
              />
            )}
          />
        </div>
      </ModuleSectionCard>

      {editTarget ? (
        <CategoryEditorPanel
          mode={editTarget.mode}
          category={editTarget.mode === 'edit' ? editTarget.category : null}
          onClose={() => setEditTarget(null)}
          onSave={async (payload) => {
            if (editTarget.mode === 'create') {
              const id = await cats.createCategory({
                slug: payload.slug,
                name: payload.name,
                description: payload.description,
                position: payload.position,
              })
              if (!id) return false
            } else {
              await cats.updateCategory({
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
  courseCount,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  category: LearningCategory
  courseCount: number
  onEdit: () => void
  onToggleActive: (value: boolean) => void | Promise<void>
  onDelete: () => void | Promise<void>
}) {
  const handleDelete = async () => {
    if (category.is_system) return
    const ok = window.confirm(
      `Slette kategorien «${category.name}»? Kurs som tilhører denne kategorien beholdes, men flyttes til "Annet".`,
    )
    if (!ok) return
    await onDelete()
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button variant="ghost" onClick={onEdit} className="h-auto min-w-0 flex-1 flex-col items-start justify-start rounded-none p-0 text-left font-normal hover:bg-transparent">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-900">{category.name}</span>
            {category.is_system ? <Badge variant="info">System</Badge> : null}
            {!category.is_active ? <Badge variant="neutral">Inaktiv</Badge> : null}
            <Badge variant="neutral">
              {courseCount} {courseCount === 1 ? 'kurs' : 'kurs'}
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
  onClose,
  onSave,
}: {
  mode: 'create' | 'edit'
  category: LearningCategory | null
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
      titleId="form-edit-learning-category"
      title={mode === 'create' ? 'Ny kategori' : `Rediger ${category?.name ?? 'kategori'}`}
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
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="learncat-name">
            Navn <span className="text-red-500">*</span>
          </label>
          <StandardInput
            id="learncat-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (mode === 'create' && slug === '') {
                setSlug(slugFromName(e.target.value))
              }
            }}
            placeholder="F.eks. Konflikthåndtering"
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="learncat-slug">
            Slug
          </label>
          <p className="mb-1 text-xs text-neutral-500">
            Stabil intern identifikator. Kan ikke endres etter opprettelse.
          </p>
          <StandardInput
            id="learncat-slug"
            value={slug}
            onChange={(e) => setSlug(slugFromName(e.target.value))}
            placeholder="konflikthandtering"
            disabled={mode === 'edit'}
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="learncat-description">
            Beskrivelse
          </label>
          <StandardTextarea
            id="learncat-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Hva slags kurs tilhører denne kategorien?"
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="learncat-position">
            Posisjon
          </label>
          <p className="mb-1 text-xs text-neutral-500">
            Lavere tall vises først. Standardkategorier bruker 10–60.
          </p>
          <StandardInput
            id="learncat-position"
            type="number"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            min={0}
          />
        </div>

        {isSystem ? (
          <p className="text-xs text-neutral-500">
            Dette er en systemkategori. Du kan endre navn og posisjon, men
            ikke slug.
          </p>
        ) : null}
      </div>
    </SlidePanel>
  )
}
