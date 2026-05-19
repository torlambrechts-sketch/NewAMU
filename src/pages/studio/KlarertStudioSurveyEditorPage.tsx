// Klarert Studio — survey template editor.
// Uses KlarertStudioShell for chrome; useSurveyStudio for persistence.
// DndContext wraps the shell so palette chips and canvas share one drag context.
// Accessed via /studio/survey/:templateId  (templateId='new' creates on first save).

import { useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Copy, Play, X, Zap } from 'lucide-react'
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
import { useSurveyStudio } from '../../../modules/studio/useSurveyStudio'
import {
  PALETTE_DRAG_PREFIX,
  StudioBlockPalette,
} from '../../../modules/studio/StudioBlockPalette'
import {
  buildNewBlock,
  CANVAS_DROP_ZONE_ID,
  CANVAS_TAIL_ID,
  StudioSurveyBlockCanvas,
} from '../../../modules/studio/StudioSurveyBlockCanvas'
import { StudioSurveyBlockCard } from '../../../modules/studio/StudioSurveyBlockCard'
import { StudioSurveyPropertyPanel } from '../../../modules/studio/StudioSurveyPropertyPanel'
import type { NewStudioBlock, PaletteItem } from '../../../modules/studio/types'
import { KlarertStudioShell } from '../../components/studio/KlarertStudioShell'

export function KlarertStudioSurveyEditorPage() {
  const { templateId = 'new' } = useParams<{ templateId: string }>()
  const [searchParams] = useSearchParams()
  const fromTemplateId = searchParams.get('from') ?? undefined
  const navigate = useNavigate()

  const studio = useSurveyStudio(templateId, fromTemplateId)
  useDirtyGuard(!studio.isSystemTemplate && studio.saveStatus === 'idle')

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')
  const [showInspector, setShowInspector] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  const advanced = mode === 'advanced'
  const selectedBlock = studio.blocks.find((b) => b.id === selectedId) ?? null
  const questionCount = studio.blocks.filter((b) => b.kind === 'question').length

  // ── DnD ──────────────────────────────────────────────────────────────────────
  const [activeItem, setActiveItem] = useState<Active | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // ── Block handlers ────────────────────────────────────────────────────────────
  const handleAdd = useCallback(
    (block: NewStudioBlock, atIndex?: number) => {
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
    (item: PaletteItem) => {
      if (studio.isSystemTemplate) return
      handleAdd(buildNewBlock(item))
    },
    [studio.isSystemTemplate, handleAdd],
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
      const item: PaletteItem | undefined = active.data.current?.paletteItem
      if (!item) return
      const newBlock = buildNewBlock(item)
      const ids = studio.blocks.map((b) => b.id)
      if (overId === CANVAS_DROP_ZONE_ID || overId === CANVAS_TAIL_ID) {
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
    if (questionCount === 0) {
      setPublishError('Legg til minst ett spørsmål før du publiserer.')
      return
    }
    setPublishError(null)
    await studio.publishTemplate()
    if (!studio.saveError) {
      toast.success(`«${studio.templateName.trim() || 'Ny spørreundersøkelse'}» er publisert`)
      navigate('/studio/survey')
    } else {
      toast.error(`Publisering feilet: ${studio.saveError}`)
    }
  }

  const displayName = studio.templateName || 'Ny spørreundersøkelse'

  // ── Top-bar actions ───────────────────────────────────────────────────────────
  const actions = (
    <>
      {studio.rowId && (
        <button
          type="button"
          onClick={() => navigate(`/survey/templates/org/${studio.rowId}`)}
          className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
          disabled={!studio.rowId}
        >
          <Play className="h-3.5 w-3.5" />
          Test-kjør
        </button>
      )}

      {studio.isSystemTemplate ? (
        <button
          type="button"
          onClick={() => navigate(`/studio/survey/new?from=${templateId}`)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14312a]"
        >
          <Copy className="h-3.5 w-3.5" />
          Kopier og rediger
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={questionCount === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#14312a] disabled:opacity-40"
        >
          <Zap className="h-3.5 w-3.5" />
          Publiser
        </button>
      )}
    </>
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
              onClick={() => navigate(`/studio/survey/new?from=${templateId}`)}
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
  // DndContext wraps the shell so palette + canvas share the same drag context.
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <KlarertStudioShell
        moduleLabel="Spørreundersøkelser"
        moduleHref="/studio/survey"
        title={displayName}
        onTitleChange={studio.isSystemTemplate ? undefined : studio.updateName}
        titlePlaceholder="Ny spørreundersøkelse"
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
            onAdd={handlePaletteAdd}
          />
        }
        inspector={showInspector ? (
          <StudioSurveyPropertyPanel
            block={selectedBlock}
            advanced={advanced}
            onUpdate={studio.updateBlock}
            onDeselect={() => setSelectedId(null)}
          />
        ) : undefined}
      >
        <StudioSurveyBlockCanvas
          blocks={studio.blocks}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRemove={handleRemove}
          disabled={studio.isSystemTemplate}
        />
      </KlarertStudioShell>

      {/* DragOverlay renders into a portal — outside the shell */}
      <DragOverlay>
        {activeItem && (() => {
          const activeId = String(activeItem.id)
          if (activeId.startsWith(PALETTE_DRAG_PREFIX)) {
            const item: PaletteItem | undefined = activeItem.data.current?.paletteItem
            return item ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-lg opacity-90">
                <span className="font-medium text-neutral-900">{item.label}</span>
                <span className="text-xs text-neutral-400">{item.hint}</span>
              </div>
            ) : null
          }
          const block = studio.blocks.find((b) => b.id === activeId)
          return block ? (
            <StudioSurveyBlockCard
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
