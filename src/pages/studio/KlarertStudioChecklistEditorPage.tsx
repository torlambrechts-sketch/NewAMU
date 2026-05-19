// Checklist template editor — three-panel Studio layout (palette | canvas | properties).
//
// Accessed via /studio/checklist/:templateId. templateId === 'new' creates a
// fresh template on first save. Auto-saves to
// compliance_checklist_templates.studio_blocks (+ derived definition.items)
// with a 1.5 s debounce.
//
// ?from=<id> when templateId==='new' → fork/copy an existing template.

import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useDirtyGuard } from '../../hooks/useDirtyGuard'
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Pencil,
  Zap,
} from 'lucide-react'
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

// Adapt ChecklistPaletteItem → PaletteItem for rendering only (label, hint,
// advancedOnly). The original ChecklistPaletteItem is stored in DnD data so
// handleDragEnd can recover it without any string-keyed lookup or cast.
function toRenderPaletteItem(item: ChecklistPaletteItem): PaletteItem {
  const base = { label: item.label, hint: item.hint, advancedOnly: item.advancedOnly }
  if (item.kind === 'section') return { kind: 'section', ...base }
  // Map to 'text' questionType for icon rendering — the real item kind is
  // carried via DnD data.current.checklistPaletteItem, not this render shape.
  return { kind: 'question', questionType: 'text', ...base }
}

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

export function KlarertStudioChecklistEditorPage() {
  const { templateId = 'new' } = useParams<{ templateId: string }>()
  const [searchParams] = useSearchParams()
  const fromTemplateId = searchParams.get('from') ?? undefined
  const navigate = useNavigate()

  const studio = useChecklistStudio(templateId, fromTemplateId)
  useDirtyGuard(!studio.isSystemTemplate && studio.saveStatus === 'idle')
  const [advanced, setAdvanced] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const selectedBlock = studio.blocks.find((b) => b.id === selectedId) ?? null
  const itemCount = studio.blocks.filter((b) => b.kind === 'checklist_item').length

  // DnD
  const [activeItem, setActiveItem] = useState<Active | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // Stable lookup map: drag-id → original ChecklistPaletteItem.
  // Keyed by the same formula PaletteChip uses for useDraggable.id so that
  // CHECKLIST_PALETTE is a module-level constant so this memo never re-runs.
  const checklistItemById = useMemo(() => {
    const map: Record<string, ChecklistPaletteItem> = {}
    for (const item of CHECKLIST_PALETTE) {
      // PaletteChip uses `${PALETTE_DRAG_PREFIX}${item.kind}:${item.questionType ?? ''}`
      // Our render adapter maps checklist_item → kind:'question', questionType:'text'
      // so register both the rendered key and the original key for safety.
      const rendered = toRenderPaletteItem(item)
      const renderedId = `${PALETTE_DRAG_PREFIX}${rendered.kind}:${(rendered as { questionType?: string }).questionType ?? ''}`
      map[renderedId] = item
      const originalId = `${PALETTE_DRAG_PREFIX}${item.kind}:${item.itemType ?? ''}`
      map[originalId] = item
    }
    return map
  }, [])

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

  // StudioBlockPalette calls back with the rendered PaletteItem; recover the
  // original ChecklistPaletteItem via the stable lookup map.
  const handleGenericPaletteAdd = useCallback(
    (genericItem: PaletteItem) => {
      const id = `${PALETTE_DRAG_PREFIX}${genericItem.kind}:${(genericItem as { questionType?: string }).questionType ?? ''}`
      const checklistItem = checklistItemById[id]
      if (!checklistItem) {
        console.warn('[StudioChecklist] palette item not found for id', id)
        return
      }
      handlePaletteAdd(checklistItem)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handlePaletteAdd],
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
      if (!checklistItem) {
        console.warn('[StudioChecklist] drag item not found for id', activeId)
        return
      }
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

  const [publishError, setPublishError] = useState<string | null>(null)

  const handlePublish = async () => {
    if (itemCount === 0) {
      setPublishError('Legg til minst ett sjekkpunkt før du publiserer.')
      return
    }
    setPublishError(null)
    await studio.publishTemplate()
    if (!studio.saveError) {
      navigate('/studio/checklist')
    }
  }

  const displayName = studio.templateName || 'Ny sjekkliste'

  const titleNode =
    editingName && !studio.isSystemTemplate ? (
      <StandardInput
        ref={nameInputRef}
        value={studio.templateName}
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
          if (!studio.isSystemTemplate) {
            setEditingName(true)
            setTimeout(() => nameInputRef.current?.select(), 0)
          }
        }}
        className={[
          'group flex items-center gap-2',
          !studio.isSystemTemplate && 'hover:text-[#1a3d32]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {displayName}
        {!studio.isSystemTemplate && (
          <Pencil className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-50" aria-hidden />
        )}
      </button>
    )

  const headerActions = (
    <div className="flex items-center gap-3">
      {!studio.isSystemTemplate && (
        <SaveIndicator
          status={studio.saveStatus}
          lastSavedAt={studio.lastSavedAt}
          saveError={studio.saveError}
        />
      )}
      {studio.isSystemTemplate ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(`/studio/checklist/new?from=${templateId}`)}
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
          disabled={itemCount === 0}
          className="gap-1.5"
        >
          <Zap className="h-3.5 w-3.5" />
          Publiser
        </Button>
      )}
    </div>
  )

  // Palette items adapted to the generic PaletteItem shape for StudioBlockPalette
  const genericPalette = CHECKLIST_PALETTE.map(toRenderPaletteItem)

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Studio', to: '/studio' },
        { label: 'Sjekklister', to: '/studio/checklist' },
        { label: displayName },
      ]}
      title={titleNode}
      headerActions={headerActions}
      loading={studio.loading}
      notFound={
        studio.loadError
          ? { title: studio.loadError, backHref: '/studio/checklist', backLabel: '← Tilbake til maler' }
          : undefined
      }
    >
      {(publishError ?? (studio.saveError && studio.saveStatus === 'error' ? studio.saveError : null)) && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{publishError ?? studio.saveError}</span>
          <button type="button" onClick={() => setPublishError(null)} className="shrink-0 text-red-400 hover:text-red-600" aria-label="Lukk">×</button>
        </div>
      )}

      {studio.isSystemTemplate && (
        <InfoBox>
          Dette er en systemmal og kan ikke redigeres.{' '}
          <button
            type="button"
            onClick={() => navigate(`/studio/checklist/new?from=${templateId}`)}
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Kopier den for å lage din egen versjon.
          </button>
        </InfoBox>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
        {/* Toolbar strip */}
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-50/60 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Modus
          </span>
          <div className="flex items-center overflow-hidden rounded-full border border-neutral-200 bg-white p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setAdvanced(false)}
              className={[
                'rounded-full px-3 py-1 transition-colors',
                !advanced
                  ? 'bg-[#1a3d32] text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700',
              ].join(' ')}
            >
              Enkel
            </button>
            <button
              type="button"
              onClick={() => setAdvanced(true)}
              className={[
                'rounded-full px-3 py-1 transition-colors',
                advanced
                  ? 'bg-[#1a3d32] text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700',
              ].join(' ')}
            >
              Avansert
            </button>
          </div>
          <p className="text-xs text-neutral-400">
            {advanced
              ? 'Foto, signatur og dato-blokker tilgjengelig'
              : 'Klikk eller dra blokker fra venstre for å bygge sjekklisten'}
          </p>
          {/* Sidebar pin toggle — only visible for editable org templates */}
          {!studio.isSystemTemplate && (
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-neutral-500">
              <input
                type="checkbox"
                checked={studio.templateNavPinned}
                onChange={(e) => studio.updateNavPinned(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#1a3d32]"
              />
              Fest i sidebar
            </label>
          )}
        </div>

        {/* Three-panel area */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex" style={{ height: 'calc(100vh - 18rem)' }}>
            <StudioBlockPalette
              advanced={advanced}
              disabled={studio.isSystemTemplate}
              onAdd={handleGenericPaletteAdd}
              items={genericPalette}
              hintText="Dra inn sjekkpunkter for sjekklisten."
            />

            <StudioChecklistBlockCanvas
              blocks={studio.blocks}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRemove={handleRemove}
              disabled={studio.isSystemTemplate}
            />

            <StudioChecklistPropertyPanel
              block={selectedBlock}
              advanced={advanced}
              pack={studio.templatePack}
              onUpdate={studio.updateBlock}
              onDeselect={() => setSelectedId(null)}
            />
          </div>

          <DragOverlay>
            {activeItem &&
              (() => {
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
      </div>
    </ModulePageShell>
  )
}
