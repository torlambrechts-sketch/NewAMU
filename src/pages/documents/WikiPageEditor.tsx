import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Columns2,
  Copy,
  Eye,
  GripVertical,
  LayoutPanelLeft,
  Loader2,
  PanelRight,
  Plus,
  Redo2,
  Save,
  Search,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useDocumentTemplates, useWikiPage, useWikiSpaces } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { MarkdownShortcutKind } from '../../components/learning/RichTextEditor'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { DocumentsSearchBar } from '../../components/documents/DocumentsSearchBar'
import type { AcknowledgementAudience, Block, SpaceCategory } from '../../types/documents'
import { WikiBlockRenderer } from './WikiBlockRenderer'
import { WikiEditorCommandPalette, type PaletteEntry } from './WikiEditorCommandPalette'
import { WikiBlockEditor } from './wikiBlockEditors'

const AUTOSAVE_MS = 3000
const UNDO_MAX = 50
const DRAFT_LS_PREFIX = 'atics-wiki-draft:'

type LayoutMode = 'canvas-split' | 'canvas-only' | 'preview-only'
type RightPanel = 'meta' | 'settings' | 'preview'

const TPL_CATEGORY_LABELS: Record<SpaceCategory, string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veiledning',
  template_library: 'Malbibliotek',
}

function draftStorageKey(pageId: string) {
  return `${DRAFT_LS_PREFIX}${pageId}`
}

function cloneBlocks(b: Block[]): Block[] {
  return JSON.parse(JSON.stringify(b)) as Block[]
}

function emptyBlock(kind: Block['kind'], palette?: PaletteEntry): Block {
  switch (kind) {
    case 'heading':
      return { kind: 'heading', level: 2, text: 'Ny overskrift' }
    case 'text':
      return { kind: 'text', body: '<p>Skriv her…</p>' }
    case 'alert':
      return { kind: 'alert', variant: 'info', text: 'Tekst her' }
    case 'divider':
      return { kind: 'divider' }
    case 'law_ref':
      return { kind: 'law_ref', ref: '', description: '' }
    case 'image':
      return { kind: 'image', storagePath: '', caption: '', width: 'medium' }
    case 'module': {
      const name = palette?.moduleName ?? 'live_org_chart'
      return { kind: 'module', moduleName: name, params: {} }
    }
    default:
      return { kind: 'text', body: '<p></p>' }
  }
}

export function WikiPageEditor() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const wikiPage = useWikiPage(pageId)
  const wikiSpaces = useWikiSpaces()
  const documentTemplates = useDocumentTemplates()
  const { ensurePageLoaded, pageHydrateLoading, pageHydrateError, page: original, versions } = wikiPage
  const { departments, organization } = useOrgSetupContext()

  const space = original ? wikiSpaces.spaces.find((s) => s.id === original.spaceId) : null

  const hydratedKeyRef = useRef<string | null>(null)
  const draftRef = useRef({
    title: '',
    summary: '',
    blocks: [] as Block[],
    legalRefs: '',
    requiresAck: false,
    ackAudience: 'all_employees' as AcknowledgementAudience,
    ackDeptId: '',
    revisionMonths: '12',
    nextRevision: '',
    template: 'standard' as 'standard' | 'wide' | 'policy',
  })

  const [title, setTitle] = useState(() => original?.title ?? '')
  const [summary, setSummary] = useState(() => original?.summary ?? '')
  const [blocks, setBlocks] = useState<Block[]>(() => original?.blocks ?? [])
  const [legalRefs, setLegalRefs] = useState(() =>
    (Array.isArray(original?.legalRefs) ? original.legalRefs : []).join(', '),
  )
  const [requiresAck, setRequiresAck] = useState(() => original?.requiresAcknowledgement ?? false)
  const [ackAudience, setAckAudience] = useState<AcknowledgementAudience>(
    () => original?.acknowledgementAudience ?? 'all_employees',
  )
  const [ackDeptId, setAckDeptId] = useState(() => original?.acknowledgementDepartmentId ?? '')
  const [revisionMonths, setRevisionMonths] = useState(() => String(original?.revisionIntervalMonths ?? 12))
  const [nextRevision, setNextRevision] = useState(() =>
    original?.nextRevisionDueAt ? original.nextRevisionDueAt.slice(0, 10) : '',
  )
  const [template, setTemplate] = useState<'standard' | 'wide' | 'policy'>(() => original?.template ?? 'standard')
  const [dirty, setDirty] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [rightPanel, setRightPanel] = useState<RightPanel>('meta')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('canvas-split')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteKey, setPaletteKey] = useState(0)
  const [slashIdx, setSlashIdx] = useState<number | null>(null)
  const [saveTplOpen, setSaveTplOpen] = useState(false)
  const [tplLabel, setTplLabel] = useState('')
  const [tplDesc, setTplDesc] = useState('')
  const [tplCategory, setTplCategory] = useState<SpaceCategory>('hms_handbook')
  const [tplSaving, setTplSaving] = useState(false)

  const openPalette = useCallback(() => {
    setPaletteKey((k) => k + 1)
    setPaletteOpen(true)
  }, [])

  const [past, setPast] = useState<Block[][]>([])
  const [future, setFuture] = useState<Block[][]>([])

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    if (!pageId || !original) return
    const key = `${pageId}:${original.id}`
    if (hydratedKeyRef.current === key) return
    hydratedKeyRef.current = key
    const o = original
    let initialBlocks = Array.isArray(o.blocks) ? o.blocks : []
    let titleFromDraft: string | null = null
    let summaryFromDraft: string | null = null
    try {
      const raw = localStorage.getItem(draftStorageKey(pageId))
      if (raw) {
        const parsed = JSON.parse(raw) as { updatedAt?: string; blocks?: Block[]; title?: string; summary?: string }
        if (parsed?.updatedAt) {
          const serverTime = new Date(o.updatedAt).getTime()
          const draftTime = new Date(parsed.updatedAt).getTime()
          if (draftTime >= serverTime - 500) {
            if (typeof parsed.title === 'string') titleFromDraft = parsed.title
            if (typeof parsed.summary === 'string') summaryFromDraft = parsed.summary
            if (parsed.blocks && Array.isArray(parsed.blocks)) initialBlocks = parsed.blocks
          }
        }
      }
    } catch {
      /* ignore */
    }
    queueMicrotask(() => {
      setTitle(titleFromDraft ?? o.title ?? '')
      setSummary(summaryFromDraft ?? o.summary ?? '')
      setBlocks(initialBlocks)
      setLegalRefs((Array.isArray(o.legalRefs) ? o.legalRefs : []).join(', '))
      setRequiresAck(o.requiresAcknowledgement ?? false)
      setAckAudience(o.acknowledgementAudience ?? 'all_employees')
      setAckDeptId(o.acknowledgementDepartmentId ?? '')
      setRevisionMonths(String(o.revisionIntervalMonths ?? 12))
      setNextRevision(o.nextRevisionDueAt ? o.nextRevisionDueAt.slice(0, 10) : '')
      setTemplate(
        o.template === 'wide' || o.template === 'policy' || o.template === 'standard' ? o.template : 'standard',
      )
      setDirty(false)
      setSavedMsg(false)
      setSelectedIdx(null)
      setPast([])
      setFuture([])
    })
  }, [pageId, original])

  useEffect(() => {
    draftRef.current = {
      title,
      summary,
      blocks,
      legalRefs,
      requiresAck,
      ackAudience,
      ackDeptId,
      revisionMonths,
      nextRevision,
      template,
    }
  }, [title, summary, blocks, legalRefs, requiresAck, ackAudience, ackDeptId, revisionMonths, nextRevision, template])

  useEffect(() => {
    if (!pageId || !original) return
    try {
      localStorage.setItem(
        draftStorageKey(pageId),
        JSON.stringify({
          updatedAt: new Date().toISOString(),
          title,
          summary,
          blocks,
        }),
      )
    } catch {
      /* ignore */
    }
  }, [pageId, original, title, summary, blocks])

  useEffect(() => {
    void ensurePageLoaded(pageId)
  }, [ensurePageLoaded, pageId])

  const markDirty = useCallback(() => {
    setDirty(true)
    setSavedMsg(false)
  }, [])

  const pushPast = useCallback((snapshot: Block[]) => {
    setPast((p) => [...p.slice(-(UNDO_MAX - 1)), cloneBlocks(snapshot)])
    setFuture([])
  }, [])

  const setBlocksWithHistory = useCallback(
    (next: Block[] | ((prev: Block[]) => Block[]), recordUndo: boolean) => {
      setBlocks((prev) => {
        const resolved = typeof next === 'function' ? (next as (b: Block[]) => Block[])(prev) : next
        if (recordUndo) pushPast(prev)
        return resolved
      })
      markDirty()
    },
    [markDirty, pushPast],
  )

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p
      const prevSnap = p[p.length - 1]!
      setFuture((f) => [cloneBlocks(blocks), ...f])
      setBlocks(cloneBlocks(prevSnap))
      markDirty()
      return p.slice(0, -1)
    })
  }, [blocks, markDirty])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f
      const nextSnap = f[0]!
      setPast((p) => [...p, cloneBlocks(blocks)])
      setBlocks(cloneBlocks(nextSnap))
      markDirty()
      return f.slice(1)
    })
  }, [blocks, markDirty])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paletteOpen) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openPalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, undo, redo, openPalette])

  const runAutosave = useCallback(async () => {
    if (!original) return
    const d = draftRef.current
    const months = Math.max(1, parseInt(d.revisionMonths, 10) || 12)
    setAutosaveStatus('saving')
    try {
      const patch: Parameters<typeof wikiPage.updatePage>[1] = {
        title: d.title.trim() || original.title,
        summary: d.summary,
        blocks: d.blocks,
        legalRefs: d.legalRefs.split(',').map((s) => s.trim()).filter(Boolean),
        requiresAcknowledgement: d.requiresAck,
        template: d.template,
        acknowledgementAudience: d.ackAudience,
        acknowledgementDepartmentId: d.ackAudience === 'department' ? (d.ackDeptId || null) : null,
        revisionIntervalMonths: months,
        nextRevisionDueAt: d.nextRevision ? new Date(`${d.nextRevision}T12:00:00`).toISOString() : null,
      }
      if (original.status === 'draft') {
        patch.status = 'draft'
      }
      await wikiPage.updatePage(original.id, patch)
      setAutosaveStatus('saved')
      setDirty(false)
      window.setTimeout(() => setAutosaveStatus('idle'), 2000)
    } catch {
      setAutosaveStatus('idle')
    }
  }, [original, wikiPage])

  useEffect(() => {
    if (!dirty || !original) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      void runAutosave()
    }, AUTOSAVE_MS)
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [dirty, original, runAutosave, title, summary, blocks, legalRefs, requiresAck, template, ackAudience, ackDeptId, revisionMonths, nextRevision])

  const templateSourceId = original?.templateSourceId ?? null
  const sourceTemplate = useMemo(() => {
    if (!templateSourceId) return null
    return documentTemplates.systemTemplatesCatalog.find((t) => t.id === templateSourceId) ?? null
  }, [templateSourceId, documentTemplates.systemTemplatesCatalog])

  if (pageHydrateError && !original) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{pageHydrateError}</p>
        <Link to="/documents" className="mt-4 inline-block text-[#1a3d32] underline">
          ← Tilbake til dokumenter
        </Link>
      </div>
    )
  }

  if ((wikiPage.loading || pageHydrateLoading) && !original) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-neutral-600">
        <Loader2 className="size-8 animate-spin text-[#1a3d32]" aria-hidden />
        <p className="text-sm">Laster redigeringsdata…</p>
      </div>
    )
  }

  if (wikiPage.error && !original) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{wikiPage.error}</p>
        <Link to="/documents" className="mt-4 inline-block text-[#1a3d32] underline">
          ← Tilbake til dokumenter
        </Link>
      </div>
    )
  }

  if (!original) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center text-neutral-500">
        Side ikke funnet.{' '}
        <Link to="/documents" className="text-[#1a3d32] underline">
          ← Tilbake
        </Link>
      </div>
    )
  }

  const page = original

  async function handleSaveAsTemplate() {
    if (!tplLabel.trim()) return
    setTplSaving(true)
    try {
      const d = draftRef.current
      const legal = d.legalRefs.split(',').map((s) => s.trim()).filter(Boolean)
      await documentTemplates.saveOrgCustomTemplate({
        label: tplLabel.trim(),
        description: tplDesc.trim(),
        category: tplCategory,
        legalBasis: legal.length > 0 ? legal : sourceTemplate?.legalBasis ?? [],
        page: {
          title: d.title.trim() || page.title,
          summary: d.summary,
          status: 'draft',
          template: d.template,
          legalRefs: legal,
          requiresAcknowledgement: d.requiresAck,
          acknowledgementAudience: d.ackAudience,
          acknowledgementDepartmentId: d.ackAudience === 'department' ? d.ackDeptId || null : null,
          revisionIntervalMonths: Math.max(1, parseInt(d.revisionMonths, 10) || 12),
          nextRevisionDueAt: d.nextRevision ? new Date(`${d.nextRevision}T12:00:00`).toISOString() : null,
          blocks: cloneBlocks(d.blocks),
        },
      })
      setSaveTplOpen(false)
      setTplLabel('')
      setTplDesc('')
    } catch (e) {
      console.error(e)
    } finally {
      setTplSaving(false)
    }
  }

  async function persistToServer(opts?: { forceStatusDraft?: boolean }) {
    const d = draftRef.current
    const months = Math.max(1, parseInt(d.revisionMonths, 10) || 12)
    await wikiPage.updatePage(page.id, {
      title: d.title.trim() || page.title,
      summary: d.summary,
      blocks: d.blocks,
      legalRefs: d.legalRefs.split(',').map((s) => s.trim()).filter(Boolean),
      requiresAcknowledgement: d.requiresAck,
      template: d.template,
      acknowledgementAudience: d.ackAudience,
      acknowledgementDepartmentId: d.ackAudience === 'department' ? (d.ackDeptId || null) : null,
      revisionIntervalMonths: months,
      nextRevisionDueAt: d.nextRevision ? new Date(`${d.nextRevision}T12:00:00`).toISOString() : null,
      ...(opts?.forceStatusDraft || page.status === 'draft' ? { status: 'draft' as const } : {}),
    })
    setDirty(false)
    setSavedMsg(true)
  }

  async function handleSave() {
    await persistToServer({ forceStatusDraft: page.status !== 'published' })
  }

  async function handlePublish() {
    await persistToServer()
    await wikiPage.publishPage(page.id)
    try {
      if (pageId) localStorage.removeItem(draftStorageKey(pageId))
    } catch {
      /* ignore */
    }
    navigate(`/documents/page/${page.id}`)
  }

  function addFromPalette(entry: PaletteEntry) {
    const b = emptyBlock(entry.kind, entry)
    const at = slashIdx
    setBlocksWithHistory((prev) => {
      if (at != null) {
        const next = [...prev]
        next[at] = b
        queueMicrotask(() => setSelectedIdx(at))
        return next
      }
      const next = [...prev, b]
      queueMicrotask(() => setSelectedIdx(next.length - 1))
      return next
    }, true)
  }

  function convertTextBlockTo(idx: number, kind: MarkdownShortcutKind) {
    setBlocksWithHistory((prev) => {
      const copy = [...prev]
      const cur = copy[idx]
      if (!cur || cur.kind !== 'text') return prev
      if (kind === 'h2') copy[idx] = { kind: 'heading', level: 2, text: 'Overskrift' }
      else if (kind === 'h3') copy[idx] = { kind: 'heading', level: 3, text: 'Overskrift' }
      else if (kind === 'divider') copy[idx] = { kind: 'divider' }
      else if (kind === 'alert') copy[idx] = { kind: 'alert', variant: 'info', text: 'Tekst her' }
      return copy
    }, true)
  }

  const showCanvas = layoutMode !== 'preview-only'
  const showRightColumn = layoutMode === 'canvas-split'

  const canvasColClass =
    layoutMode === 'canvas-only' ? 'w-full' : layoutMode === 'preview-only' ? 'hidden' : 'w-[60%] min-w-0'
  const rightColClass = showRightColumn ? 'w-[40%] min-w-0 border-l border-neutral-200 pl-4' : 'hidden'

  return (
    <DocumentsModuleLayout
      headerActions={<DocumentsSearchBar />}
      subHeader={
        <div className="mt-6 space-y-3 border-b border-neutral-200/80 pb-6">
          <nav className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            <Link to="/documents" className="text-neutral-500 hover:text-[#1a3d32]">
              Bibliotek
            </Link>
            <span className="text-neutral-400">→</span>
            {space && (
              <>
                <Link to={`/documents/space/${space.id}`} className="text-neutral-500 hover:text-[#1a3d32]">
                  {space.title}
                </Link>
                <span className="text-neutral-400">→</span>
              </>
            )}
            <span className="font-medium text-neutral-800">{page.title}</span>
            <span className="ml-1 rounded-none border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
              Redigerer
            </span>
            <span className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
              {autosaveStatus === 'saving' ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> Lagrer…
                </>
              ) : autosaveStatus === 'saved' ? (
                <span className="text-emerald-700">Lagret</span>
              ) : null}
            </span>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Visning</span>
            <button
              type="button"
              onClick={() => setLayoutMode('canvas-only')}
              className={`inline-flex items-center gap-1 rounded-none border px-2 py-1 text-xs font-medium ${
                layoutMode === 'canvas-only' ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 bg-white text-neutral-700'
              }`}
              title="Kun redigering"
            >
              <LayoutPanelLeft className="size-3.5" /> Canvas
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('canvas-split')}
              className={`inline-flex items-center gap-1 rounded-none border px-2 py-1 text-xs font-medium ${
                layoutMode === 'canvas-split' ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 bg-white text-neutral-700'
              }`}
              title="Canvas + høyre panel"
            >
              <Columns2 className="size-3.5" /> Canvas + panel
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('preview-only')}
              className={`inline-flex items-center gap-1 rounded-none border px-2 py-1 text-xs font-medium ${
                layoutMode === 'preview-only' ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 bg-white text-neutral-700'
              }`}
              title="Kun forhåndsvisning"
            >
              <PanelRight className="size-3.5" /> Forhåndsvisning
            </button>
            <span className="mx-2 h-4 w-px bg-neutral-200" aria-hidden />
            <button
              type="button"
              onClick={undo}
              disabled={past.length === 0}
              className="rounded-none border border-neutral-200 px-2 py-1 text-xs text-neutral-700 disabled:opacity-40"
              title="Angre (Ctrl+Z)"
            >
              <Undo2 className="inline size-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={future.length === 0}
              className="rounded-none border border-neutral-200 px-2 py-1 text-xs text-neutral-700 disabled:opacity-40"
              title="Gjør om (Ctrl+Y)"
            >
              <Redo2 className="inline size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => openPalette()}
              className="inline-flex items-center gap-1 rounded-none border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
              title="Kommandopalett (Ctrl+K)"
            >
              <Search className="size-3.5" /> Blokk
            </button>
            <button
              type="button"
              onClick={() => {
                setTplLabel(title.trim() || page.title)
                setTplDesc(summary.trim())
                setTplCategory(
                  (sourceTemplate?.category as SpaceCategory | undefined) ??
                    wikiSpaces.spaces.find((s) => s.id === page.spaceId)?.category ??
                    'hms_handbook',
                )
                setSaveTplOpen(true)
              }}
              className="inline-flex items-center gap-1 rounded-none border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
              title="Lagre som organisasjonsmal"
            >
              <Copy className="size-3.5" /> Lagre som mal
            </button>
          </div>
        </div>
      }
    >
      {saveTplOpen ? (
        <div
          className="fixed inset-0 z-[250] flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-tpl-title"
        >
          <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="save-tpl-title" className="text-sm font-semibold text-neutral-900">
                Lagre som mal
              </h2>
              <button type="button" onClick={() => setSaveTplOpen(false)} className="rounded p-1 text-neutral-500 hover:bg-neutral-100" aria-label="Lukk">
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-medium text-neutral-500">Navn på mal</label>
                <input
                  value={tplLabel}
                  onChange={(e) => setTplLabel(e.target.value)}
                  className="mt-1 w-full rounded-none border border-neutral-200 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Beskrivelse</label>
                <textarea
                  value={tplDesc}
                  onChange={(e) => setTplDesc(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-none border border-neutral-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Kategori</label>
                <select
                  value={tplCategory}
                  onChange={(e) => setTplCategory(e.target.value as SpaceCategory)}
                  className="mt-1 w-full rounded-none border border-neutral-200 bg-white px-3 py-2"
                >
                  {(Object.keys(TPL_CATEGORY_LABELS) as SpaceCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {TPL_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-neutral-500">Blokker, layout, lovhenvisninger og signaturinnstillinger kopieres til malbiblioteket.</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSaveTplOpen(false)} className="rounded-none border border-neutral-200 px-3 py-2 text-sm">
                Avbryt
              </button>
              <button
                type="button"
                disabled={tplSaving || !tplLabel.trim()}
                onClick={() => void handleSaveAsTemplate()}
                className="rounded-none border border-[#1a3d32] bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {tplSaving ? 'Lagrer…' : 'Opprett mal'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <WikiEditorCommandPalette
        key={paletteKey}
        open={paletteOpen}
        onClose={() => {
          setPaletteOpen(false)
          setSlashIdx(null)
        }}
        onPick={(picked) => {
          addFromPalette(picked)
          setSlashIdx(null)
        }}
      />

      <div className={`mt-6 flex gap-0 ${layoutMode === 'preview-only' ? '' : 'min-h-[min(80vh,720px)]'}`}>
        {showCanvas ? (
          <div className={`flex flex-col ${canvasColClass}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Innholdsblokker</h2>
              <button
                type="button"
                onClick={() => openPalette()}
                className="inline-flex items-center gap-1 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-2 py-1 text-xs font-medium text-white"
              >
                <Plus className="size-3.5" /> Legg til
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {blocks.map((block, idx) => (
                <BlockItem
                  key={idx}
                  block={block}
                  selected={selectedIdx === idx}
                  onSelect={() => setSelectedIdx(idx === selectedIdx ? null : idx)}
                  onUpdate={(patch) => {
                    setBlocksWithHistory((prev) => prev.map((bl, i) => (i === idx ? { ...bl, ...patch } as Block : bl)), true)
                  }}
                  onRemove={() => {
                    setBlocksWithHistory((prev) => prev.filter((_, i) => i !== idx), true)
                    setSelectedIdx(null)
                  }}
                  onDuplicate={() => {
                    setBlocksWithHistory((prev) => {
                      const row = prev[idx]
                      if (!row) return prev
                      const dup = cloneBlocks([row])[0]!
                      const next = [...prev]
                      next.splice(idx + 1, 0, dup)
                      return next
                    }, true)
                  }}
                  onMove={(dir) => {
                    setBlocksWithHistory((prev) => {
                      const next = [...prev]
                      const j = idx + dir
                      if (j < 0 || j >= next.length) return prev
                      ;[next[idx], next[j]] = [next[j]!, next[idx]!]
                      return next
                    }, true)
                    setSelectedIdx(idx + dir)
                  }}
                  onSlashPalette={() => {
                    setSlashIdx(idx)
                    openPalette()
                  }}
                  onMarkdownShortcut={(kind) => convertTextBlockTo(idx, kind)}
                  isFirst={idx === 0}
                  isLast={idx === blocks.length - 1}
                  spaceId={page.spaceId}
                  orgId={organization?.id}
                />
              ))}
            </div>
          </div>
        ) : null}

        {showRightColumn ? (
          <div className={rightColClass}>
            <div className="mb-3 flex gap-1 border-b border-neutral-200 pb-2">
              {(
                [
                  { id: 'meta' as const, label: 'Metadata' },
                  { id: 'settings' as const, label: 'Innstillinger' },
                  { id: 'preview' as const, label: 'Forhåndsvisning' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRightPanel(t.id)}
                  className={`rounded-none px-2 py-1 text-xs font-medium ${
                    rightPanel === t.id ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="max-h-[min(80vh,720px)] overflow-y-auto">
              {rightPanel === 'meta' && (
                <div className="space-y-3 rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
                  <label className="text-xs font-medium text-neutral-500">Tittel</label>
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      markDirty()
                    }}
                    className="w-full rounded-none border border-neutral-200 px-3 py-2 text-base font-semibold focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                  />
                  <label className="mt-2 block text-xs font-medium text-neutral-500">Kort beskrivelse</label>
                  <input
                    value={summary}
                    onChange={(e) => {
                      setSummary(e.target.value)
                      markDirty()
                    }}
                    className="w-full rounded-none border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                  />
                  <div>
                    <span className="text-xs font-medium text-neutral-500">Status</span>
                    <p className="mt-1 text-sm font-medium capitalize text-neutral-800">{page.status}</p>
                  </div>
                </div>
              )}
              {rightPanel === 'settings' && (
                <div className="space-y-3 rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
                  <div>
                    <label className="text-xs font-medium text-neutral-500">Layout</label>
                    <select
                      value={template}
                      onChange={(e) => {
                        setTemplate(e.target.value as typeof template)
                        markDirty()
                      }}
                      className="mt-1 w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
                    >
                      <option value="standard">Standard</option>
                      <option value="wide">Bred</option>
                      <option value="policy">Policy (smal)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-500">Lovhenvisninger (kommaseparert)</label>
                    <input
                      value={legalRefs}
                      onChange={(e) => {
                        setLegalRefs(e.target.value)
                        markDirty()
                      }}
                      className="mt-1 w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={requiresAck}
                      onChange={(e) => {
                        setRequiresAck(e.target.checked)
                        markDirty()
                      }}
                      className="size-4 rounded border-neutral-300 text-[#1a3d32]"
                    />
                    Krever «Lest og forstått»-signatur
                  </label>
                  {requiresAck && (
                    <div className="space-y-2 pt-1">
                      <select
                        value={ackAudience}
                        onChange={(e) => {
                          setAckAudience(e.target.value as AcknowledgementAudience)
                          markDirty()
                        }}
                        className="w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
                      >
                        <option value="all_employees">Alle ansatte</option>
                        <option value="leaders_only">Kun ledere</option>
                        <option value="safety_reps_only">Kun verneombud</option>
                        <option value="department">Spesifikk avdeling</option>
                      </select>
                      {ackAudience === 'department' && (
                        <select
                          value={ackDeptId}
                          onChange={(e) => {
                            setAckDeptId(e.target.value)
                            markDirty()
                          }}
                          className="w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
                        >
                          <option value="">Velg avdeling…</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-neutral-500">Revisjon (måneder)</label>
                    <input
                      type="number"
                      min={1}
                      value={revisionMonths}
                      onChange={(e) => {
                        setRevisionMonths(e.target.value)
                        markDirty()
                      }}
                      className="mt-1 w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-500">Neste revisjon</label>
                    <input
                      type="date"
                      value={nextRevision}
                      onChange={(e) => {
                        setNextRevision(e.target.value)
                        markDirty()
                      }}
                      className="mt-1 w-full rounded-none border border-neutral-200 px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )}
              {rightPanel === 'preview' && (
                <div className="rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-xs text-neutral-500">Lesemodus — samme som publisert visning</p>
                  <WikiBlockRenderer blocks={blocks} pageId={page.id} pageVersion={page.version} />
                </div>
              )}
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!dirty}
                  className="flex w-full items-center justify-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26] disabled:opacity-40"
                >
                  <Save className="size-4" />
                  Lagre utkast
                </button>
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  className="flex w-full items-center justify-center gap-2 rounded-none border border-emerald-600 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  <CheckCircle2 className="size-4" />
                  Lagre og publiser
                </button>
                <Link
                  to={`/documents/page/${page.id}`}
                  className="flex items-center justify-center gap-2 rounded-none border border-neutral-200 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50"
                >
                  <Eye className="size-4" />
                  Åpne publisert visning
                </Link>
              </div>
              {savedMsg && (
                <div className="mt-3 flex items-center gap-2 rounded-none border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle2 className="size-4" /> Lagret
                </div>
              )}
              <div className="mt-4 rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-neutral-700">Versjonshistorikk</h3>
                {versions.length === 0 ? (
                  <p className="text-xs text-neutral-400">Ingen arkiverte versjoner ennå.</p>
                ) : (
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-neutral-600">
                    {versions.map((v) => (
                      <li key={v.id}>
                        v{v.version} · {new Date(v.frozenAt).toLocaleDateString('no-NO')}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {layoutMode === 'preview-only' ? (
          <div className="w-full min-w-0 border border-neutral-200/90 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-neutral-800">Forhåndsvisning</h2>
            <WikiBlockRenderer blocks={blocks} pageId={page.id} pageVersion={page.version} />
          </div>
        ) : null}
      </div>
    </DocumentsModuleLayout>
  )
}

function BlockItem({
  block,
  selected,
  onSelect,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
  onSlashPalette,
  onMarkdownShortcut,
  isFirst,
  isLast,
  spaceId,
  orgId,
}: {
  block: Block
  selected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<Block>) => void
  onRemove: () => void
  onDuplicate: () => void
  onMove: (dir: -1 | 1) => void
  onSlashPalette: () => void
  onMarkdownShortcut: (k: MarkdownShortcutKind) => void
  isFirst: boolean
  isLast: boolean
  spaceId: string
  orgId: string | undefined
}) {
  const kindLabel: Record<Block['kind'], string> = {
    heading: 'Overskrift',
    text: 'Tekst',
    alert: 'Varselboks',
    divider: 'Skillelinje',
    image: 'Bilde',
    law_ref: 'Lovhenvisning',
    module: 'Dynamisk widget',
  }

  return (
    <div className={`rounded-none border bg-white shadow-sm ${selected ? 'border-[#1a3d32]' : 'border-neutral-200'}`}>
      <div className="flex cursor-pointer items-center gap-2 px-3 py-2" onClick={onSelect}>
        <GripVertical className="size-4 shrink-0 text-neutral-300" />
        <span className="flex-1 text-xs font-medium text-neutral-500">{kindLabel[block.kind]}</span>
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={onDuplicate} className="rounded px-2 py-0.5 text-[10px] font-medium text-neutral-600 hover:bg-neutral-100">
            Dupliser
          </button>
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30">
            <ChevronUp className="size-3.5" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30">
            <ChevronDown className="size-3.5" />
          </button>
          <button type="button" onClick={onRemove} className="rounded p-1 text-red-400 hover:bg-red-50">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {selected && (
        <div className="border-t border-neutral-100 px-3 pb-3 pt-3">
          <WikiBlockEditor
            block={block}
            onUpdate={onUpdate}
            onSlashPalette={block.kind === 'text' ? onSlashPalette : undefined}
            onMarkdownShortcut={block.kind === 'text' ? onMarkdownShortcut : undefined}
            spaceId={spaceId}
            orgId={orgId}
          />
        </div>
      )}
    </div>
  )
}
