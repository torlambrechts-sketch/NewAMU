// Survey template editor — three-panel Studio layout (palette | canvas | properties).
//
// Accessed via /studio/survey/:templateId. templateId === 'new' creates a fresh
// template on first save. Auto-saves to survey_template_catalog.studio_blocks
// (+ derived body.questions) with a 1.5 s debounce.
//
// ?from=<id>  when templateId==='new' → fork/copy an existing template.
//
// Layout follows the section-builder shell pattern (DESIGN_SYSTEM §11):
// ModulePageShell + bordered card with fixed-height three-panel area.

import { useCallback, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useDirtyGuard } from '../../hooks/useDirtyGuard'
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Pencil,
  Play,
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
import { PALETTE_DRAG_PREFIX, StudioBlockPalette } from '../../../modules/studio/StudioBlockPalette'
import {
  buildNewBlock,
  CANVAS_DROP_ZONE_ID,
  CANVAS_TAIL_ID,
  StudioSurveyBlockCanvas,
} from '../../../modules/studio/StudioSurveyBlockCanvas'
import { StudioSurveyBlockCard } from '../../../modules/studio/StudioSurveyBlockCard'
import { StudioSurveyPropertyPanel } from '../../../modules/studio/StudioSurveyPropertyPanel'
import { useSurveyStudio } from '../../../modules/studio/useSurveyStudio'
import type { NewStudioBlock, PaletteItem } from '../../../modules/studio/types'

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

export function KlarertStudioSurveyEditorPage() {
  const { templateId = 'new' } = useParams<{ templateId: string }>()
  const [searchParams] = useSearchParams()
  const fromTemplateId = searchParams.get('from') ?? undefined
  const navigate = useNavigate()

  const studio = useSurveyStudio(templateId, fromTemplateId)
  useDirtyGuard(!studio.isSystemTemplate && studio.saveStatus === 'idle')
  const [advanced, setAdvanced] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const selectedBlock = studio.blocks.find((b) => b.id === selectedId) ?? null

  // DnD — context lifted here so palette chips (siblings of canvas) share it
  const [activeItem, setActiveItem] = useState<Active | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

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

  const handleTestRun = () => {
    if (studio.rowId) navigate(`/survey/templates/org/${studio.rowId}`)
  }

  const questionCount = studio.blocks.filter((b) => b.kind === 'question').length

  const [publishError, setPublishError] = useState<string | null>(null)

  const handlePublish = async () => {
    if (questionCount === 0) {
      setPublishError('Legg til minst ett spørsmål før du publiserer.')
      return
    }
    setPublishError(null)
    await studio.publishTemplate()
    navigate('/studio/survey')
  }

  const displayName = studio.templateName || 'Ny spørreundersøkelse'

  // Inline-editable title passed as ReactNode to ModulePageShell
  const titleNode = editingName && !studio.isSystemTemplate ? (
    <StandardInput
      ref={nameInputRef}
      value={studio.templateName}
      onChange={(e) => studio.updateName(e.target.value)}
      onBlur={() => setEditingName(false)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false) }}
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
      ].filter(Boolean).join(' ')}
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
      <Button
        variant="secondary"
        size="sm"
        onClick={handleTestRun}
        disabled={!studio.rowId}
        className="gap-1.5"
      >
        <Play className="h-3.5 w-3.5" />
        Test-kjør
      </Button>
      {studio.isSystemTemplate ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(`/studio/survey/new?from=${templateId}`)}
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
        { label: 'Spørreundersøkelser', to: '/studio/survey' },
        { label: displayName },
      ]}
      title={titleNode}
      headerActions={headerActions}
      loading={studio.loading}
      notFound={
        studio.loadError
          ? { title: studio.loadError, backHref: '/studio/survey', backLabel: '← Tilbake til maler' }
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

      {/* System template read-only notice */}
      {studio.isSystemTemplate && (
        <InfoBox>
          Dette er en systemmal og kan ikke redigeres.{' '}
          <button
            type="button"
            onClick={() => navigate(`/studio/survey/new?from=${templateId}`)}
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Kopier den for å lage din egen versjon.
          </button>
        </InfoBox>
      )}

      {/* Editor card — matches section-builder shell pattern (DESIGN_SYSTEM §11) */}
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
                !advanced ? 'bg-[#1a3d32] text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-700',
              ].join(' ')}
            >
              Enkel
            </button>
            <button
              type="button"
              onClick={() => setAdvanced(true)}
              className={[
                'rounded-full px-3 py-1 transition-colors',
                advanced ? 'bg-[#1a3d32] text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-700',
              ].join(' ')}
            >
              Avansert
            </button>
          </div>
          <p className="text-xs text-neutral-400">
            {advanced
              ? 'Alle bloktyper + forgrening tilgjengelig'
              : 'Klikk eller dra blokker fra venstre for å bygge undersøkelsen'}
          </p>
        </div>

        {/* Three-panel area — fixed viewport-relative height so panels scroll internally */}
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
              onAdd={handlePaletteAdd}
            />

            <StudioSurveyBlockCanvas
              blocks={studio.blocks}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRemove={handleRemove}
              disabled={studio.isSystemTemplate}
            />

            <StudioSurveyPropertyPanel
              block={selectedBlock}
              advanced={advanced}
              onUpdate={studio.updateBlock}
              onDeselect={() => setSelectedId(null)}
            />
          </div>

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
      </div>
    </ModulePageShell>
  )
}
