import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Check,
  CloudUpload,
  GitPullRequest,
  Hash,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  Save,
  Send,
} from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
import { TipTapRichTextEditor } from '../../components/documents/TipTapRichTextEditor'
import { canEditWikiDocuments } from '../../lib/documentsAccess'
import {
  blocksAreEmpty,
  blocksToEditorHtml,
  editorHtmlToBlocks,
  isEmptyEditorHtml,
} from '../../lib/wikiEditorBlocks'
import { DOCUMENTS_MODULE_TITLE } from '../../data/documentsNav'
import type { ContentBlock } from '../../types/documents'

/**
 * Rec03 — Rich-text editor page.
 *
 * The clean full-page editing surface from the Claude Design handoff:
 * breadcrumb → Rediger, the document title, an autosave indicator and the
 * Kommentar / Send til godkjenning / Publiser actions, then the TipTap
 * toolbar + slash-menu canvas and a word-count footer. Replaces the
 * DocumentEditorWorkbench chrome for `/documents/page/:id/reference-edit`.
 */

function wordStats(html: string): { words: number; minutes: number } {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ')
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  return { words, minutes: Math.max(1, Math.round(words / 180)) }
}

type SaveState = 'saved' | 'saving' | 'dirty' | 'error'

export function WikiPageReferenceEditor() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const docs = useDocuments()
  const { can, profile, orgProfiles } = useOrgSetupContext()
  const canEdit = canEditWikiDocuments(can, profile?.is_org_admin)

  const page = docs.pages.find((p) => p.id === pageId)
  const space = page ? docs.spaces.find((s) => s.id === page.spaceId) : null

  const [html, setHtml] = useState<string>('<p></p>')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  /** Editor canvas width — false = lesemodus (820px), true = full bredde. */
  const [fullWidth, setFullWidth] = useState(false)
  const saveTimer = useRef<number | null>(null)
  const lastHydrated = useRef<string | null>(null)
  /** The block list the current editor HTML was serialised from — preserved
   *  (non-prose) blocks are restored by index against this on save. */
  const hydratedBlocks = useRef<ContentBlock[]>([])
  /** Latest unsaved HTML — flushed on unmount so navigating away never drops it. */
  const pendingHtml = useRef<string | null>(null)
  const flushRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (pageId) void docs.ensurePageLoaded(pageId)
  }, [docs, pageId])

  // Hydrate the editor from the page body. Re-runs whenever the page object
  // changes — so a stub page (empty blocks before ensurePageLoaded resolves)
  // is replaced by the real content once it loads. It will not clobber real
  // unsaved edits, but an *empty* editor is always re-hydrated so a hydration
  // race can't leave the editor blank.
  useEffect(() => {
    if (!page || saveState === 'saving') return
    if (saveState === 'dirty' && !isEmptyEditorHtml(html)) return
    const next = blocksToEditorHtml(page.blocks)
    if (next === lastHydrated.current) return
    lastHydrated.current = next
    hydratedBlocks.current = page.blocks
    setHtml(next)
    setSaveState('saved')
  }, [page, saveState, html])

  const wikiLinkPages = useMemo(
    () => docs.pages.map((p) => ({ id: p.id, title: p.title })),
    [docs.pages],
  )
  const mentionProfiles = useMemo(
    () =>
      orgProfiles
        .filter((p) => p.id && p.display_name)
        .map((p) => ({ id: p.id, label: p.display_name })),
    [orgProfiles],
  )

  const persist = useCallback(
    async (nextHtml: string) => {
      if (!pageId) return
      const nextBlocks = editorHtmlToBlocks(nextHtml, hydratedBlocks.current)
      // Safety net: never overwrite a document that has content with an empty
      // editor — that is always a hydration race, never a real edit.
      const live = docs.pages.find((p) => p.id === pageId)
      if (live && blocksAreEmpty(nextBlocks) && !blocksAreEmpty(live.blocks)) {
        setSaveState('error')
        setActionError(
          'Lagring avbrutt: editoren var tom mens dokumentet har innhold. Last siden på nytt før du redigerer.',
        )
        return
      }
      setSaveState('saving')
      try {
        await docs.updatePage(pageId, { blocks: nextBlocks })
        pendingHtml.current = null
        setActionError(null)
        setSaveState('saved')
      } catch (e) {
        setSaveState('error')
        setActionError(
          `Lagring feilet: ${e instanceof Error ? e.message : 'ukjent feil'}`,
        )
      }
    },
    [docs, pageId],
  )

  const handleChange = useCallback(
    (next: string) => {
      setHtml(next)
      pendingHtml.current = next
      setSaveState('dirty')
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => void persist(next), 1200)
    },
    [persist],
  )

  // Keep a current flush closure; the unmount cleanup calls the latest one.
  flushRef.current = () => {
    if (pendingHtml.current == null || !pageId) return
    const nextBlocks = editorHtmlToBlocks(pendingHtml.current, hydratedBlocks.current)
    const live = docs.pages.find((p) => p.id === pageId)
    // Same safety net as persist() — don't flush an empty editor over content.
    if (live && blocksAreEmpty(nextBlocks) && !blocksAreEmpty(live.blocks)) {
      pendingHtml.current = null
      return
    }
    void docs.updatePage(pageId, { blocks: nextBlocks })
    pendingHtml.current = null
  }

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      flushRef.current()
    },
    [],
  )

  const stats = useMemo(() => wordStats(html), [html])

  if (!pageId) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
        title="Rediger dokument"
        notFound={{ title: 'Mangler dokument-ID', onBack: () => navigate('/documents') }}
      >
        {null}
      </ModulePageShell>
    )
  }

  if (!page) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }]}
        title="Rediger dokument"
        loading={docs.pageHydrateLoading}
        loadingLabel="Laster dokument…"
        notFound={
          docs.pageHydrateLoading
            ? undefined
            : { title: 'Side ikke funnet', onBack: () => navigate('/documents') }
        }
      >
        {null}
      </ModulePageShell>
    )
  }

  const saveLabel: Record<SaveState, string> = {
    saved: 'Lagret · automatisk',
    saving: 'Lagrer…',
    dirty: 'Ulagrede endringer',
    error: 'Lagring feilet',
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ...(space ? [{ label: space.title, to: `/documents/space/${space.id}` }] : []),
        { label: page.title, to: `/documents/page/${page.id}` },
        { label: 'Rediger' },
      ]}
      title={page.title}
      description={
        <p className="max-w-3xl text-sm text-neutral-600">
          Redigeringsmodus. Endringer lagres automatisk. Du redigerer{' '}
          {page.status === 'draft' ? 'en kladd' : 'en publisert side'} (v{page.version}).
        </p>
      }
      headerActions={
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
            {saveState === 'saving' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : saveState === 'error' ? (
              <CloudUpload className="h-3.5 w-3.5 text-red-600" aria-hidden />
            ) : (
              <CloudUpload className="h-3.5 w-3.5 text-green-600" aria-hidden />
            )}
            {saveLabel[saveState]}
          </span>
          <Button
            variant="secondary"
            icon={
              fullWidth ? (
                <Minimize2 className="h-4 w-4" aria-hidden />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden />
              )
            }
            aria-pressed={fullWidth}
            onClick={() => setFullWidth((w) => !w)}
          >
            {fullWidth ? 'Lesebredde' : 'Full bredde'}
          </Button>
          <Button
            variant="secondary"
            icon={<Save className="h-4 w-4" aria-hidden />}
            disabled={!canEdit || saveState === 'saving'}
            onClick={async () => {
              if (saveTimer.current) window.clearTimeout(saveTimer.current)
              await persist(html)
            }}
          >
            Lagre
          </Button>
          <Button
            variant="secondary"
            icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            onClick={async () => {
              if (saveTimer.current) window.clearTimeout(saveTimer.current)
              if (pendingHtml.current != null) await persist(pendingHtml.current)
              navigate(`/documents/page/${page.id}?comments=1`)
            }}
          >
            Kommentar
          </Button>
          <Button
            variant="secondary"
            icon={<GitPullRequest className="h-4 w-4" aria-hidden />}
            disabled={busy || !canEdit}
            onClick={async () => {
              setActionError(null)
              setBusy(true)
              try {
                await docs.submitForReview(page.id)
                navigate(`/documents/page/${page.id}?comments=1`)
              } catch (e) {
                setActionError(e instanceof Error ? e.message : 'Kunne ikke sende til godkjenning.')
              } finally {
                setBusy(false)
              }
            }}
          >
            Send til godkjenning
          </Button>
          <Button
            icon={<Send className="h-4 w-4" aria-hidden />}
            disabled={busy || !canEdit}
            onClick={async () => {
              setActionError(null)
              setBusy(true)
              try {
                if (saveTimer.current) window.clearTimeout(saveTimer.current)
                await persist(html)
                await docs.publishPage(page.id)
                navigate(`/documents/page/${page.id}`)
              } catch (e) {
                setActionError(e instanceof Error ? e.message : 'Kunne ikke publisere.')
              } finally {
                setBusy(false)
              }
            }}
          >
            Publiser
          </Button>
        </div>
      }
    >
      {!canEdit ? (
        <WarningBox>Du har ikke skrivetilgang til dette dokumentet.</WarningBox>
      ) : null}
      {actionError ? <WarningBox>{actionError}</WarningBox> : null}

      <ModuleSectionCard className="!p-0 overflow-visible">
        <TipTapRichTextEditor
          value={html}
          onChange={handleChange}
          toolbar="full"
          readOnly={!canEdit}
          placeholder="Skriv dokumentteksten… trykk / for blokk-meny"
          wikiLinkPages={wikiLinkPages}
          mentionProfiles={mentionProfiles}
          className={`rounded-xl border-0 shadow-none [&_.tiptap-editor-root]:px-8 [&_.tiptap-editor-root]:py-10 ${
            fullWidth
              ? '[&_.tiptap-editor-root]:max-w-none'
              : '[&_.tiptap-editor-root]:mx-auto [&_.tiptap-editor-root]:max-w-[820px]'
          }`}
        />
      </ModuleSectionCard>

      <div className="flex items-center justify-between px-1 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5" aria-hidden />
          Trykk <kbd className="rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono">/</kbd> for blokk-meny
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5" aria-hidden />
          {stats.words} ord · {stats.minutes} min lesetid
        </span>
      </div>
    </ModulePageShell>
  )
}
