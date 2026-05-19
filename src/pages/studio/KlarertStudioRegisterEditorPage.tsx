// Register-type Studio editor — KlarertStudioShell chrome with DnD.
// Three-panel layout: palette | canvas (+ description) | property inspector.
// Accessed via /studio/register/:typeId  (typeId='new' creates on first save).
// ?from=<id> forks an existing type.

import { useCallback, useEffect, useState } from 'react'
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
  buildNewRegisterFieldBlock,
  REGISTER_CANVAS_DROP_ZONE_ID,
  REGISTER_CANVAS_TAIL_ID,
  StudioRegisterFieldCanvas,
} from '../../../modules/studio/register/StudioRegisterFieldCanvas'
import { StudioRegisterFieldCard } from '../../../modules/studio/register/StudioRegisterFieldCard'
import { StudioRegisterFieldPropertyPanel } from '../../../modules/studio/register/StudioRegisterFieldPropertyPanel'
import { useRegisterTypeStudio } from '../../../modules/studio/register/useRegisterTypeStudio'
import {
  REGISTER_FIELD_PALETTE,
  type RegisterFieldBlock,
  type RegisterPaletteItem,
} from '../../../modules/studio/register/registerFieldBlocks'
import type { PaletteItem } from '../../../modules/studio/types'
import { KlarertStudioShell } from '../../components/studio/KlarertStudioShell'

const REGISTER_PALETTE_DRAG_PREFIX = `${PALETTE_DRAG_PREFIX}register:`

function toRenderPaletteItem(item: RegisterPaletteItem): PaletteItem {
  return {
    kind: 'question',
    questionType: 'text',
    label: item.label,
    hint: item.hint,
    dragId: `${REGISTER_PALETTE_DRAG_PREFIX}${item.fieldKind}`,
  }
}

const GENERIC_PALETTE: PaletteItem[] = REGISTER_FIELD_PALETTE.map(toRenderPaletteItem)

const PALETTE_MAP: Record<string, RegisterPaletteItem> = Object.fromEntries(
  REGISTER_FIELD_PALETTE.map((item) => [
    `${REGISTER_PALETTE_DRAG_PREFIX}${item.fieldKind}`,
    item,
  ]),
)

export function KlarertStudioRegisterEditorPage() {
  const { typeId = 'new' } = useParams<{ typeId: string }>()
  const [searchParams] = useSearchParams()
  const fromTypeId = searchParams.get('from') ?? undefined
  const navigate = useNavigate()

  const studio = useRegisterTypeStudio(typeId, fromTypeId)
  useDirtyGuard(!studio.isSystemType && studio.isDirty)

  useEffect(() => {
    if (studio.rowId && typeId === 'new') {
      navigate(`/studio/register/${studio.rowId}`, { replace: true })
    }
  }, [studio.rowId, typeId, navigate])

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')
  const [showInspector, setShowInspector] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  const selectedBlock = studio.blocks.find((b) => b.id === selectedId) ?? null
  const fieldCount = studio.blocks.length

  // ── DnD ──────────────────────────────────────────────────────────────────────
  const [activeItem, setActiveItem] = useState<Active | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // ── Block handlers ────────────────────────────────────────────────────────────
  const handleAdd = useCallback(
    (block: Omit<RegisterFieldBlock, 'id'>, atIndex?: number) => {
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
      const paletteItem: RegisterPaletteItem = PALETTE_MAP[activeId] ?? REGISTER_FIELD_PALETTE[0]
      const newBlock = buildNewRegisterFieldBlock(paletteItem)
      const ids = studio.blocks.map((b) => b.id)
      if (overId === REGISTER_CANVAS_DROP_ZONE_ID || overId === REGISTER_CANVAS_TAIL_ID) {
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

  const handleGenericPaletteAdd = useCallback(
    (genericItem: PaletteItem) => {
      if (studio.isSystemType) return
      const paletteItem = genericItem.dragId
        ? (PALETTE_MAP[genericItem.dragId] ?? REGISTER_FIELD_PALETTE[0])
        : REGISTER_FIELD_PALETTE[0]
      handleAdd(buildNewRegisterFieldBlock(paletteItem))
    },
    [studio.isSystemType, handleAdd],
  )

  // ── Publish ───────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (fieldCount === 0) {
      setPublishError('Legg til minst ett felt før du publiserer.')
      return
    }
    setPublishError(null)
    const err = await studio.publishType()
    if (!err) {
      toast.success(`«${studio.typeName.trim() || 'Ny registertype'}» er publisert`)
      navigate('/studio/register')
    } else {
      toast.error(`Publisering feilet: ${err}`)
    }
  }

  // ── Top-bar actions ───────────────────────────────────────────────────────────
  const actions = studio.isSystemType ? (
    <button
      type="button"
      onClick={() => navigate(`/studio/register/new?from=${typeId}`)}
      className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14312a]"
    >
      <Copy className="h-3.5 w-3.5" />
      Kopier og rediger
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void handlePublish()}
      disabled={fieldCount === 0}
      className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14312a] disabled:opacity-40"
    >
      <Zap className="h-3.5 w-3.5" />
      Publiser
    </button>
  )

  // ── Alert banners ─────────────────────────────────────────────────────────────
  const hasBanners = !!publishError || (!!studio.saveError && studio.saveStatus === 'error') || studio.isSystemType
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
      {studio.isSystemType && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Dette er en systemtype og kan ikke redigeres.{' '}
            <button
              type="button"
              onClick={() => navigate(`/studio/register/new?from=${typeId}`)}
              className="font-semibold underline underline-offset-2 hover:no-underline"
            >
              Kopier den for å lage din egen versjon.
            </button>
          </span>
        </div>
      )}
    </>
  ) : undefined

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <KlarertStudioShell
        moduleLabel="Registertyper"
        moduleHref="/studio/register"
        title={studio.typeName || 'Ny registertype'}
        onTitleChange={studio.isSystemType ? undefined : studio.updateName}
        titlePlaceholder="Ny registertype"
        mode={mode}
        onModeChange={setMode}
        showInspector={showInspector}
        onToggleInspector={() => setShowInspector((v) => !v)}
        loading={studio.loading}
        loadError={studio.loadError}
        loadErrorBackLabel="← Tilbake til registertyper"
        saveStatus={studio.saveStatus}
        saveError={studio.saveError}
        readOnly={studio.isSystemType}
        actions={actions}
        banners={banners}
        palette={
          <StudioBlockPalette
            disabled={studio.isSystemType}
            onAdd={handleGenericPaletteAdd}
            items={GENERIC_PALETTE}
            hintText="Dra inn felttyper for registertypen."
          />
        }
        inspector={showInspector ? (
          <>
            <StudioRegisterFieldPropertyPanel
              block={selectedBlock}
              onUpdate={studio.updateBlock}
              onDeselect={() => setSelectedId(null)}
            />
            {!studio.isSystemType && (
              <div className="border-t border-neutral-100 px-4 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-500">
                  <input
                    type="checkbox"
                    checked={studio.typeNavPinned}
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
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-500">Beskrivelse</label>
            <textarea
              value={studio.typeDescription}
              onChange={(e) => studio.updateDescription(e.target.value)}
              disabled={studio.isSystemType}
              rows={2}
              placeholder="Hva brukes denne registertypen til?"
              className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30 disabled:bg-neutral-50 disabled:text-neutral-400"
            />
          </div>

          <StudioRegisterFieldCanvas
            blocks={studio.blocks}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={handleRemove}
            disabled={studio.isSystemType}
          />
        </div>
      </KlarertStudioShell>

      <DragOverlay>
        {activeItem && (() => {
          const activeId = String(activeItem.id)
          if (activeId.startsWith(PALETTE_DRAG_PREFIX)) {
            const paletteItem = PALETTE_MAP[activeId]
            return paletteItem ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-lg opacity-90">
                <span className="font-medium text-neutral-900">{paletteItem.label}</span>
                <span className="text-xs text-neutral-400">{paletteItem.hint}</span>
              </div>
            ) : null
          }
          const block = studio.blocks.find((b) => b.id === activeId)
          return block ? (
            <StudioRegisterFieldCard
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
