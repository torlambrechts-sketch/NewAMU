// Survey template editor — three-panel Studio layout (palette | canvas | properties).
//
// Accessed via /studio/survey/:templateId. templateId === 'new' creates a fresh
// template on first save. Auto-saves to survey_template_catalog.studio_blocks
// (+ derived body.questions) with a 1.5 s debounce.
//
// ?from=<id>  when templateId==='new' → fork/copy an existing template.

import { useCallback, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Info,
  Loader2,
  Pencil,
  Play,
  Zap,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StudioBlockPalette } from '../../../modules/studio/StudioBlockPalette'
import { StudioSurveyBlockCanvas } from '../../../modules/studio/StudioSurveyBlockCanvas'
import { StudioSurveyPropertyPanel } from '../../../modules/studio/StudioSurveyPropertyPanel'
import { useSurveyStudio } from '../../../modules/studio/useSurveyStudio'
import type { NewStudioBlock } from '../../../modules/studio/types'

function SaveIndicator({ status, lastSavedAt }: { status: string; lastSavedAt: Date | null }) {
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
    return <span className="text-xs text-red-500">Lagring feilet</span>
  }
  return null
}

export function KlarertStudioSurveyEditorPage() {
  const { templateId = 'new' } = useParams<{ templateId: string }>()
  const [searchParams] = useSearchParams()
  const fromTemplateId = searchParams.get('from') ?? undefined
  const navigate = useNavigate()

  const studio = useSurveyStudio(templateId, fromTemplateId)
  const [advanced, setAdvanced] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const selectedBlock = studio.blocks.find((b) => b.id === selectedId) ?? null

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

  const handleTestRun = () => {
    if (studio.rowId) {
      navigate(`/survey/templates/org/${studio.rowId}`)
    }
  }

  const handlePublish = async () => {
    await studio.publishTemplate()
    navigate('/studio/survey')
  }

  if (studio.loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#fafaf9]">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (studio.loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#fafaf9]">
        <p className="text-sm text-red-600">{studio.loadError}</p>
        <Button variant="ghost" onClick={() => navigate('/studio')}>
          Tilbake til Studio
        </Button>
      </div>
    )
  }

  const displayName = studio.templateName || 'Ny spørreundersøkelse'

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#fafaf9]">
      {/* ── Read-only banner (system templates) ───────────────────── */}
      {studio.isSystemTemplate && (
        <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              Dette er en systemmal og kan ikke redigeres. Kopier den for å lage din egen versjon.
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/studio/survey/new?from=${templateId}`)}
            className="ml-4 shrink-0 gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            Kopier og rediger
          </Button>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2.5 shadow-sm">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="flex items-center gap-1 text-neutral-500 hover:text-neutral-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Studio-hjem
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
          <button
            type="button"
            onClick={() => navigate('/studio/survey')}
            className="text-neutral-500 hover:text-neutral-800"
          >
            Spørreundersøkelser
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
          {editingName && !studio.isSystemTemplate ? (
            <StandardInput
              ref={nameInputRef}
              value={studio.templateName}
              onChange={(e) => studio.updateName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false)
              }}
              className="h-7 w-48 py-0 text-sm font-medium"
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
                'group flex items-center gap-1 max-w-48 truncate font-medium text-neutral-900',
                !studio.isSystemTemplate && 'hover:text-[#1a3d32]',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="truncate">{displayName}</span>
              {!studio.isSystemTemplate && (
                <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60" aria-hidden />
              )}
            </button>
          )}
        </div>

        {/* Mode toggle + save + actions */}
        <div className="flex items-center gap-3">
          {/* Simple / Advanced pill */}
          <div className="flex items-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setAdvanced(false)}
              className={[
                'rounded-full px-3 py-1 transition-colors',
                !advanced ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500',
              ].join(' ')}
            >
              Enkel
            </button>
            <button
              type="button"
              onClick={() => setAdvanced(true)}
              className={[
                'rounded-full px-3 py-1 transition-colors',
                advanced ? 'bg-[#1a3d32] text-white shadow-sm' : 'text-neutral-500',
              ].join(' ')}
            >
              Avansert
            </button>
          </div>

          {!studio.isSystemTemplate && (
            <SaveIndicator status={studio.saveStatus} lastSavedAt={studio.lastSavedAt} />
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestRun}
            disabled={!studio.rowId || studio.rowId === 'new'}
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
              className="gap-1.5 bg-[#1a3d32] hover:bg-[#1a3d32]/90"
            >
              <Copy className="h-3.5 w-3.5" />
              Kopier og rediger
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handlePublish}
              className="gap-1.5 bg-[#1a3d32] hover:bg-[#1a3d32]/90"
            >
              <Zap className="h-3.5 w-3.5" />
              Publiser
            </Button>
          )}
        </div>
      </header>

      {/* ── Three-panel body ────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <StudioBlockPalette advanced={advanced} />

        <StudioSurveyBlockCanvas
          blocks={studio.blocks}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onMove={studio.moveBlock}
          disabled={studio.isSystemTemplate}
        />

        <StudioSurveyPropertyPanel
          block={selectedBlock}
          advanced={advanced}
          onUpdate={studio.updateBlock}
          onDeselect={() => setSelectedId(null)}
        />
      </div>
    </div>
  )
}
