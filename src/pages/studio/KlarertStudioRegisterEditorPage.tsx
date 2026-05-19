// Register-type Studio editor — two-panel layout (palette | canvas | properties).
//
// Accessed via /studio/register/:typeId. typeId === 'new' creates a fresh
// register type on first save. Auto-saves to register_types.metadata_schema
// (+ register_org_settings) with a 1.5 s debounce.
//
// ?from=<id> when typeId==='new' → fork/copy an existing type.

import { useCallback, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useDirtyGuard } from '../../hooks/useDirtyGuard'
import { AlertTriangle, Check, Copy, Loader2, Pencil, Zap } from 'lucide-react'
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
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { InfoBox } from '../../components/ui/AlertBox'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
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

// Each register palette item is adapted to kind='question' for the generic
// StudioBlockPalette renderer, but given a unique dragId so DnD-kit can
// distinguish them — without this every chip would share id 'palette:question:text'.
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

// Module-level constants — built once, never re-rendered.
const GENERIC_PALETTE: PaletteItem[] = REGISTER_FIELD_PALETTE.map(toRenderPaletteItem)

// drag-id → RegisterPaletteItem, keyed by the same dragId used above.
const PALETTE_MAP: Record<string, RegisterPaletteItem> = Object.fromEntries(
  REGISTER_FIELD_PALETTE.map((item) => [
    `${REGISTER_PALETTE_DRAG_PREFIX}${item.fieldKind}`,
    item,
  ]),
)

function SaveIndicator({
  status,
  lastSavedAt,
  saveError,
}: {
  status: string
  lastSavedAt: Date | null
  saveError: string | null
}) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Lagrer…
      </span>
    )
  }
  if (status === 'saved' && lastSavedAt) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Check className="h-3.5 w-3.5 text-emerald-500" />
        Auto-lagret
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="text-xs text-red-500" title={saveError ?? undefined}>
        Lagring feilet
      </span>
    )
  }
  return null
}

export function KlarertStudioRegisterEditorPage() {
  const { typeId = 'new' } = useParams<{ typeId: string }>()
  const [searchParams] = useSearchParams()
  const fromTypeId = searchParams.get('from') ?? undefined
  const navigate = useNavigate()

  const studio = useRegisterTypeStudio(typeId, fromTypeId)
  useDirtyGuard(!studio.isSystemType && studio.saveStatus === 'idle')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const selectedBlock = studio.blocks.find((b) => b.id === selectedId) ?? null
  const fieldCount = studio.blocks.length

  // DnD
  const [activeItem, setActiveItem] = useState<Active | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // Use module-level constants — no per-render allocation needed.

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
      // dragId = `palette:register:<fieldKind>` — direct lookup in PALETTE_MAP.
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

  // Palette click — StudioBlockPalette calls back with generic PaletteItem.
  // The dragId on the item encodes the fieldKind; use it for direct lookup.
  const handleGenericPaletteAdd = useCallback(
    (genericItem: PaletteItem) => {
      if (studio.isSystemType) return
      const paletteItem = genericItem.dragId ? (PALETTE_MAP[genericItem.dragId] ?? REGISTER_FIELD_PALETTE[0]) : REGISTER_FIELD_PALETTE[0]
      handleAdd(buildNewRegisterFieldBlock(paletteItem))
    },
    [studio.isSystemType, handleAdd],
  )

  const [publishError, setPublishError] = useState<string | null>(null)

  const handlePublish = async () => {
    if (fieldCount === 0) {
      setPublishError('Legg til minst ett felt før du publiserer.')
      return
    }
    setPublishError(null)
    await studio.publishType()
    navigate('/studio/register')
  }

  const displayName = studio.typeName || 'Ny registertype'

  const titleNode =
    editingName && !studio.isSystemType ? (
      <StandardInput
        ref={nameInputRef}
        value={studio.typeName}
        onChange={(e) => studio.updateName(e.target.value)}
        onBlur={() => setEditingName(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false)
        }}
        className="h-9 w-72 text-base font-semibold"
        autoFocus
      />
    ) : (
      <button
        type="button"
        onClick={() => {
          if (!studio.isSystemType) {
            setEditingName(true)
            setTimeout(() => nameInputRef.current?.select(), 0)
          }
        }}
        className={[
          'group flex items-center gap-2',
          !studio.isSystemType && 'hover:text-[#1a3d32]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {displayName}
        {!studio.isSystemType && (
          <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-50" aria-hidden />
        )}
      </button>
    )

  const headerActions = (
    <div className="flex items-center gap-3">
      {!studio.isSystemType && (
        <SaveIndicator
          status={studio.saveStatus}
          lastSavedAt={studio.lastSavedAt}
          saveError={studio.saveError}
        />
      )}
      {studio.isSystemType ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(`/studio/register/new?from=${typeId}`)}
          className="gap-1.5"
        >
          <Copy className="h-3.5 w-3.5" />
          Kopier og rediger
        </Button>
      ) : (
        <Button
          variant="primary"
          size="sm"
          onClick={handlePublish}
          disabled={fieldCount === 0}
          className="gap-1.5"
        >
          <Zap className="h-3.5 w-3.5" />
          Publiser
        </Button>
      )}
    </div>
  )

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Studio', to: '/studio' },
        { label: 'Registertyper', to: '/studio/register' },
        { label: displayName },
      ]}
      title={titleNode}
      headerActions={headerActions}
      loading={studio.loading}
      notFound={
        studio.loadError
          ? { title: studio.loadError, backHref: '/studio/register', backLabel: '← Tilbake til registertyper' }
          : undefined
      }
    >
      {publishError && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{publishError}</span>
          <button type="button" onClick={() => setPublishError(null)} className="shrink-0 text-red-400 hover:text-red-600" aria-label="Lukk">×</button>
        </div>
      )}

      {studio.isSystemType && (
        <InfoBox>
          Dette er en systemtype og kan ikke redigeres.{' '}
          <button
            type="button"
            onClick={() => navigate(`/studio/register/new?from=${typeId}`)}
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Kopier den for å lage din egen versjon.
          </button>
        </InfoBox>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
        {/* Toolbar strip */}
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-50/60 px-4 py-2.5">
          <p className="text-xs text-neutral-400">
            Klikk eller dra felttyper fra venstre for å bygge registertypen
          </p>
          {/* Nav pin toggle */}
          {!studio.isSystemType && (
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-neutral-500">
              <input
                type="checkbox"
                checked={studio.typeNavPinned}
                onChange={(e) => studio.updateNavPinned(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#1a3d32]"
              />
              Fest i sidebar
            </label>
          )}
        </div>

        {/* Two-panel + property panel */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex" style={{ height: 'calc(100vh - 18rem)' }}>
            <StudioBlockPalette
              disabled={studio.isSystemType}
              onAdd={handleGenericPaletteAdd}
              items={GENERIC_PALETTE}
              hintText="Dra inn felttyper for registertypen."
            />

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              {/* Description field */}
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

            <StudioRegisterFieldPropertyPanel
              block={selectedBlock}
              onUpdate={studio.updateBlock}
              onDeselect={() => setSelectedId(null)}
            />
          </div>

          <DragOverlay>
            {activeItem &&
              (() => {
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
      </div>
    </ModulePageShell>
  )
}
