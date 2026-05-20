import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, CloudUpload, Hash, Loader2, MessageSquare, Send, GitPullRequest } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
import { TipTapRichTextEditor } from '../../components/documents/TipTapRichTextEditor'
import { canEditWikiDocuments } from '../../lib/documentsAccess'
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

function firstTextHtml(blocks: ContentBlock[]): string {
  const t = blocks.find((b): b is Extract<ContentBlock, { kind: 'text' }> => b.kind === 'text')
  return t?.body?.trim() ? t.body : '<p></p>'
}

function mergeHtml(blocks: ContentBlock[], html: string): ContentBlock[] {
  const body = html.trim() ? html : '<p></p>'
  const idx = blocks.findIndex((b) => b.kind === 'text')
  if (idx >= 0) return blocks.map((b, i) => (i === idx ? { kind: 'text' as const, body } : b))
  return [{ kind: 'text', body }, ...blocks]
}

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
  const [hydrated, setHydrated] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    if (pageId) void docs.ensurePageLoaded(pageId)
  }, [docs, pageId])

  // Hydrate the editor once the page is loaded.
  useEffect(() => {
    if (page && !hydrated) {
      setHtml(firstTextHtml(page.blocks))
      setHydrated(true)
    }
  }, [page, hydrated])

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
      if (!pageId || !page) return
      setSaveState('saving')
      try {
        await docs.updatePage(pageId, { blocks: mergeHtml(page.blocks, nextHtml) })
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    },
    [docs, pageId, page],
  )

  const handleChange = useCallback(
    (next: string) => {
      setHtml(next)
      setSaveState('dirty')
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => void persist(next), 1200)
    },
    [persist],
  )

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
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
            icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            onClick={() => navigate(`/documents/page/${page.id}?tab=diskusjon`)}
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
                navigate(`/documents/page/${page.id}?tab=diskusjon`)
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
          className="rounded-xl border-0 shadow-none [&_.tiptap-editor-root]:mx-auto [&_.tiptap-editor-root]:max-w-[820px] [&_.tiptap-editor-root]:px-8 [&_.tiptap-editor-root]:py-10"
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
