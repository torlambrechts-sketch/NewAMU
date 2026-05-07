// SurveyKategorierTab — admin CRUD for survey_template_categories.
// Mirrors modules/compliance/admin/KategorierTab.tsx; same UX, swapped
// hook + scope. Uses the active pack from the topbar pack switcher
// (SurveyPackSwitcher) — admins flip pack to author categories per pack.

import { useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { ToggleSwitch } from '../../../src/components/ui/FormToggles'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { SlidePanel } from '../../../src/components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../../src/components/layout/WorkplaceStandardFormPanel'
import { useSurveyCategories } from '../useSurveyCategories'
import { useSurveyOrgTemplates } from '../useSurveyOrgTemplates'
import { useSurveyPacks, findLicensedPack } from '../useSurveyPacks'
import type { SurveyCategoryRow, SurveyPackSlug } from '../types'

type Props = { supabase: SupabaseClient | null }

export function SurveyKategorierTab({ supabase }: Props) {
  const cats = useSurveyCategories({ supabase })
  const orgTemplates = useSurveyOrgTemplates({ supabase })
  const { packs } = useSurveyPacks({ supabase })

  // Admin chooses which pack to author categories for via a pill row;
  // defaults to the first licensed pack so the page isn't empty on load.
  // Uses set-state-during-render to avoid the lint-flagged "setState
  // inside useEffect" pattern.
  const [selectedPack, setSelectedPack] = useState<SurveyPackSlug | null>(null)
  const firstLicensed = findLicensedPack(packs, null)
  if (selectedPack === null && firstLicensed) {
    setSelectedPack(firstLicensed.slug)
  }

  const visible = useMemo(
    () =>
      selectedPack
        ? cats.categories
            .filter((c) => c.pack === selectedPack)
            .sort(
              (a, b) =>
                a.position - b.position || a.name.localeCompare(b.name, 'nb'),
            )
        : [],
    [cats.categories, selectedPack],
  )

  // Count templates per category so the row badge tells admins how much
  // moves when they rename / deactivate.
  const templateCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of orgTemplates.templates) {
      if (!t.categoryId) continue
      m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1)
    }
    return m
  }, [orgTemplates.templates])

  const [editTarget, setEditTarget] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; category: SurveyCategoryRow }
    | null
  >(null)

  const activePack = packs.find((p) => p.slug === selectedPack) ?? null

  return (
    <div className="space-y-6">
      {cats.error ? <WarningBox>{cats.error}</WarningBox> : null}

      {packs.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Pakke:
          </span>
          {packs.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => setSelectedPack(p.slug)}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                selectedPack === p.slug
                  ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
              ].join(' ')}
            >
              {p.short_name}
            </button>
          ))}
        </div>
      ) : null}

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#1a3d32]" aria-hidden />
            <h2 className="text-lg font-semibold text-neutral-900">
              Kategorier — {activePack?.short_name ?? '…'}
            </h2>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setEditTarget({ mode: 'create' })}
            disabled={!selectedPack}
          >
            Ny kategori
          </Button>
        </div>
        <p className="mt-1.5 text-sm text-neutral-600">
          Kategorier grupperer maler i sidemenyen og på forsiden av
          Undersøkelser. Systemkategorier kommer ferdig med pakken — du kan
          gi dem nytt navn eller deaktivere dem, men ikke slette.
        </p>

        <ul className="mt-5 space-y-3">
          {visible.length === 0 ? (
            <li className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
              Ingen kategorier for {activePack?.short_name ?? 'denne pakken'} ennå.
            </li>
          ) : (
            visible.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                templateCount={templateCount.get(c.id) ?? 0}
                onEdit={() => setEditTarget({ mode: 'edit', category: c })}
                onToggleActive={(value) =>
                  cats.updateCategory({ categoryId: c.id, is_active: value })
                }
                onDelete={() => cats.softDeleteCategory(c.id)}
              />
            ))
          )}
        </ul>
      </ModuleSectionCard>

      {editTarget && selectedPack ? (
        <CategoryEditorPanel
          mode={editTarget.mode}
          category={editTarget.mode === 'edit' ? editTarget.category : null}
          packSlug={selectedPack}
          packLabel={activePack?.short_name ?? selectedPack}
          onClose={() => setEditTarget(null)}
          onSave={async (payload) => {
            if (editTarget.mode === 'create') {
              const id = await cats.createCategory({
                pack: selectedPack,
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
  templateCount,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  category: SurveyCategoryRow
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
    <li className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
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
        </button>

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
    </li>
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
  category: SurveyCategoryRow | null
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
      titleId="form-edit-survey-category"
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
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="surveycat-name">
            Navn <span className="text-red-500">*</span>
          </label>
          <StandardInput
            id="surveycat-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (mode === 'create' && slug === '') {
                setSlug(slugFromName(e.target.value))
              }
            }}
            placeholder="F.eks. Pulsmåling 1-2-3"
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="surveycat-slug">
            Slug
          </label>
          <p className="mb-1 text-xs text-neutral-500">
            Stabil intern identifikator (a-z, 0-9, bindestrek). Kan ikke endres etter opprettelse.
          </p>
          <StandardInput
            id="surveycat-slug"
            value={slug}
            onChange={(e) => setSlug(slugFromName(e.target.value))}
            placeholder="pulsmaling-1-2-3"
            disabled={mode === 'edit'}
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="surveycat-description">
            Beskrivelse
          </label>
          <StandardTextarea
            id="surveycat-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Hva slags maler tilhører denne kategorien?"
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="surveycat-position">
            Posisjon
          </label>
          <p className="mb-1 text-xs text-neutral-500">
            Lavere tall vises først. Standardkategorier bruker 10–30.
          </p>
          <StandardInput
            id="surveycat-position"
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
