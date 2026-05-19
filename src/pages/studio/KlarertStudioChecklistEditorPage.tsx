// Checklist template editor — KlarertStudioShell chrome with DnD.
// Three-panel layout: palette | canvas | property inspector.
// Accessed via /studio/checklist/:templateId  (templateId='new' creates on first save).
// ?from=<id> forks an existing template.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Copy, X, Zap } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Active,
} from '@dnd-kit/core'
import { useDirtyGuard } from '../../hooks/useDirtyGuard'
import { StudioBlockPalette, PALETTE_DRAG_PREFIX } from '../../../modules/studio/StudioBlockPalette'
import {
  buildNewChecklistBlock,
  CHECKLIST_CANVAS_DROP_ZONE_ID,
  CHECKLIST_CANVAS_TAIL_ID,
  StudioChecklistBlockCanvas,
} from '../../../modules/studio/checklist/StudioChecklistBlockCanvas'
import { StudioChecklistBlockCard } from '../../../modules/studio/checklist/StudioChecklistBlockCard'
import { StudioChecklistPropertyPanel } from '../../../modules/studio/checklist/StudioChecklistPropertyPanel'
import { useChecklistStudio } from '../../../modules/studio/checklist/useChecklistStudio'
import { CHECKLIST_PALETTE, type ChecklistPaletteItem, type NewChecklistStudioBlock } from '../../../modules/studio/checklist/checklistBlocks'
import type { PaletteItem } from '../../../modules/studio/types'
import { KlarertStudioShell } from '../../components/studio/KlarertStudioShell'

// Adapt ChecklistPaletteItem → PaletteItem for rendering only.
function toRenderPaletteItem(item: ChecklistPaletteItem): PaletteItem {
  const base = { label: item.label, hint: item.hint, advancedOnly: item.advancedOnly }
  if (item.kind === 'section') return { kind: 'section', ...base }
  return { kind: 'question', questionType: 'text', ...base }
}

export function KlarertStudioChecklistEditorPage() {
  const { templateId = 'new' } = useParams<{ templateId: string }>()
  const [searchParams] = useSearchParams()
  const fromTemplateId = searchParams.get('from') ?? undefined
  const navigate = useNavigate()

  const studio = useChecklistStudio(templateId, fromTemplateId)
  useDirtyGuard(!studio.isSystemTemplate && studio.isDirty)

  useEffect(() => {
    if (studio.rowId && templateId === 'new') {
      navigate(`/studio/checklist/${studio.rowId}`, { replace: true })
    }
  }, [studio.rowId, templateId, navigate])

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')
  const [showInspector, setShowInspector] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  const selectedBlock = studio.blocks.find((b) => b.id === selectedId) ?? null
  const itemCount = studio.blocks.filter((b) => b.kind === 'checklist_item').length
  const advanced = mode === 'advanced'

  // ── DnD ──────────────────────────────────────────────────────────────────────
  const [activeItem, setActiveItem] = useState<Active | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // Stable lookup map: drag-id → ChecklistPaletteItem
  const checklistItemById = useMemo(() => {
    const map: Record<string, ChecklistPaletteItem> = {}
    for (const item of CHECKLIST_PALETTE) {
      const rendered = toRenderPaletteItem(item)
      const renderedId = `${PALETTE_DRAG_PREFIX}${rendered.kind}:${(rendered as { questionType?: string }).questionType ?? ''}`
      map[renderedId] = item
      const originalId = `${PALETTE_DRAG_PREFIX}${item.kind}:${item.itemType ?? ''}`
      map[originalId] = item
    }
    return map
  }, [])

  // ── Block handlers ────────────────────────────────────────────────────────────
  const handleAdd = useCallback(
    (block: NewChecklistStudioBlock, atIndex?: number) => {
      const id = studio.addBlock(block, atIndex)
      setSelectedId(id)
      return id
    },
    [studio.addBlock],
  )

  const handleRemove = useCallback(
    (id: string) => {
      studio.removeBlock(id)
      if (selectedId === id) setSelectedId(null)
    },
    [studio.removeBlock, selectedId],
  )

  const handlePaletteAdd = useCallback(
    (item: ChecklistPaletteItem) => {
      if (studio.isSystemTemplate) return
      handleAdd(buildNewChecklistBlock(item))
    },
    [studio.isSystemTemplate, handleAdd],
  )

  const handleGenericPaletteAdd = useCallback(
    (genericItem: PaletteItem) => {
      const id = `${PALETTE_DRAG_PREFIX}${genericItem.kind}:${(genericItem as { questionType?: string }).questionType ?? ''}`
      const checklistItem = checklistItemById[id]
      if (!checklistItem) return
      handlePaletteAdd(checklistItem)
    },
    [checklistItemById, handlePaletteAdd],
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveItem(event.active)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveItem(null)
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith(PALETTE_DRAG_PREFIX)) {
      const checklistItem = checklistItemById[activeId]
      if (!checklistItem) return
      const newBlock = buildNewChecklistBlock(checklistItem)
      const ids = studio.blocks.map((b) => b.id)
      if (overId === CHECKLIST_CANVAS_DROP_ZONE_ID || overId === CHECKLIST_CANVAS_TAIL_ID) {
        handleAdd(newBlock)
      } else {
        const insertAt = ids.indexOf(overId)
        handleAdd(newBlock, insertAt === -1 ? undefined : insertAt)
      }
      return
    }

    if (activeId !== overId) {
      const ids = studio.blocks.map((b) => b.id)
      const fromIndex = ids.indexOf(activeId)
      const toIndex = ids.indexOf(overId)
      if (fromIndex !== -1 && toIndex !== -1) studio.moveBlock(fromIndex, toIndex)
    }
  }

  // ── Publish ───────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (itemCount === 0) {
      setPublishError('Legg til minst ett sjekkpunkt før du publiserer.')
      return
    }
    setPublishError(null)
    const err = await studio.publishTemplate()
    if (!err) {
      toast.success(`«${studio.templateName.trim() || 'Ny sjekkliste'}» er publisert`)
      navigate('/studio/checklist')
    } else {
      toast.error(`Publisering feilet: ${err}`)
    }
  }

  // ── Top-bar actions ───────────────────────────────────────────────────────────
  const actions = studio.isSystemTemplate ? (
    <button
      type="button"
      onClick={() => navigate(`/studio/checklist/new?from=${templateId}`)}
      className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14312a]"
    >
      <Copy className="h-3.5 w-3.5" />
      Kopier og rediger
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void handlePublish()}
      disabled={itemCount === 0}
      className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14312a] disabled:opacity-40"
    >
      <Zap className="h-3.5 w-3.5" />
      Publiser
    </button>
  )

  // ── Alert banners ─────────────────────────────────────────────────────────────
  const hasBanners = !!publishError || (!!studio.saveError && studio.saveStatus === 'error') || studio.isSystemTemplate
  const banners = hasBanners ? (
    <>
      {publishError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{publishError}</span>
          <button type="button" onClick={() => setPublishError(null)} className="shrink-0 text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {studio.saveError && studio.saveStatus === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{studio.saveError}</span>
        </div>
      )}
      {studio.isSystemTemplate && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Dette er en systemmal og kan ikke redigeres.{' '}
            <button
              type="button"
              onClick={() => navigate(`/studio/checklist/new?from=${templateId}`)}
              className="font-semibold underline underline-offset-2 hover:no-underline"
            >
              Kopier den for å lage din egen versjon.
            </button>
          </span>
        </div>
      )}
    </>
  ) : undefined

  const genericPalette = CHECKLIST_PALETTE.map(toRenderPaletteItem)

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <KlarertStudioShell
        moduleLabel="Sjekklister"
        moduleHref="/studio/checklist"
        title={studio.templateName || 'Ny sjekkliste'}
        onTitleChange={studio.isSystemTemplate ? undefined : studio.updateName}
        titlePlaceholder="Ny sjekkliste"
        mode={mode}
        onModeChange={setMode}
        showInspector={showInspector}
        onToggleInspector={() => setShowInspector((v) => !v)}
        loading={studio.loading}
        loadError={studio.loadError}
        loadErrorBackLabel="← Tilbake til maler"
        saveStatus={studio.saveStatus}
        saveError={studio.saveError}
        readOnly={studio.isSystemTemplate}
        actions={actions}
        banners={banners}
        palette={
          <StudioBlockPalette
            advanced={advanced}
            disabled={studio.isSystemTemplate}
            onAdd={handleGenericPaletteAdd}
            items={genericPalette}
            hintText="Dra inn sjekkpunkter for sjekklisten."
          />
        }
        inspector={showInspector ? (
          <>
            <StudioChecklistPropertyPanel
              block={selectedBlock}
              advanced={advanced}
              pack={studio.templatePack}
              onUpdate={studio.updateBlock}
              onDeselect={() => setSelectedId(null)}
            />
            {!studio.isSystemTemplate && (
              <div className="border-t border-neutral-100 px-4 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-500">
                  <input
                    type="checkbox"
                    checked={studio.templateNavPinned}
                    onChange={(e) => studio.updateNavPinned(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#1a3d32]"
                  />
                  Fest i sidebar
                </label>
              </div>
            )}
          </>
        ) : undefined}
      >
        <StudioChecklistBlockCanvas
          blocks={studio.blocks}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRemove={handleRemove}
          disabled={studio.isSystemTemplate}
        />
      </KlarertStudioShell>

      <DragOverlay>
        {activeItem && (() => {
          const activeId = String(activeItem.id)
          if (activeId.startsWith(PALETTE_DRAG_PREFIX)) {
            const checklistItem = checklistItemById[activeId]
            return checklistItem ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-lg opacity-90">
                <span className="font-medium text-neutral-900">{checklistItem.label}</span>
                <span className="text-xs text-neutral-400">{checklistItem.hint}</span>
              </div>
            ) : null
          }
          const block = studio.blocks.find((b) => b.id === activeId)
          return block ? (
            <StudioChecklistBlockCard
              block={block}
              index={studio.blocks.findIndex((b) => b.id === block.id)}
              selected={false}
              onSelect={() => {}}
              onRemove={() => {}}
              disabled
            />
          ) : null
        })()}
      </DragOverlay>
    </DndContext>
  )
}
