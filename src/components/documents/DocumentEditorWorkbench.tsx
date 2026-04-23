import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  CircleDot,
  ClipboardSignature,
  FileText,
  GraduationCap,
  History,
  LayoutTemplate,
  Megaphone,
  Pencil,
  PenLine,
  Plus,
  Scale,
  Scissors,
  Shield,
  Type,
  User,
} from 'lucide-react'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { WarningBox } from '../ui/AlertBox'
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect'
import { StandardInput } from '../ui/Input'
import { StandardTextarea } from '../ui/Textarea'
import { TipTapRichTextEditor } from './TipTapRichTextEditor'
import { DOCUMENT_EDITOR_SECTIONS, type DocumentEditorSectionId } from './documentEditorSections'
import { useDocuments } from '../../hooks/useDocuments'
import { useDirtyGuard } from '../../hooks/useDirtyGuard'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'
import type { ContentBlock, PageTemplate } from '../../types/documents'

const INITIAL_HTML = `<h1>Arbeidsavtale / HMS-dokument (utkast)</h1><p>Rediger dokumentet direkte på siden. Bruk <strong>Innhold</strong> for å sette inn standardseksjoner knyttet til arbeidsmiljøloven og internkontrollforskriften. TipTap gir overskrifter (H1–H3), lister, lenker, understreking og horisontal linje.</p><p></p>`

/** Vertical stack spacing for spec form (matches module form density). */
const SPEC_FORM_STACK = 'space-y-4'

type SidebarMode = 'content' | 'specification' | 'history'

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'hms', label: 'HMS / internkontroll' },
  { value: 'employment', label: 'Arbeidsavtale og arbeidsforhold' },
  { value: 'safety', label: 'Verne- og sikkerhetsdokument' },
  { value: 'procedure', label: 'Prosedyre og rutine' },
  { value: 'other', label: 'Annet' },
]

const SIGNATURE_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'Ingen signatur' },
  { value: 'employee', label: 'Krever arbeidstakers signatur' },
  { value: 'employer', label: 'Krever arbeidsgivers signatur' },
  { value: 'both', label: 'Begge parter' },
  { value: 'vo', label: 'Inkl. verneombud der relevant' },
]

const RECIPIENT_OPTIONS: SelectOption[] = [
  { value: 'employee', label: 'Arbeidstaker (du)' },
  { value: 'employer', label: 'Arbeidsgiver' },
]

const FIELD_TILES: { id: string; label: string; icon: typeof Type }[] = [
  { id: 'text', label: 'Tekstfelt', icon: Type },
  { id: 'signature', label: 'Signatur', icon: PenLine },
  { id: 'initials', label: 'Initialer', icon: ClipboardSignature },
  { id: 'date', label: 'Dato', icon: Calendar },
  { id: 'checkbox', label: 'Avkryssing', icon: CheckSquare },
  { id: 'radio', label: 'Valgknapper', icon: CircleDot },
]

const SECTION_ICONS: Record<DocumentEditorSectionId, typeof FileText> = {
  welcome: FileText,
  arbeidsmiljolov: Scale,
  internkontroll: Shield,
  risikovurdering: AlertTriangle,
  opplaering: GraduationCap,
  arbeidstid: LayoutTemplate,
  varsling: Megaphone,
  signaturblokk: PenLine,
  pagebreak: Scissors,
}

type HistoryEntry = {
  id: string
  savedAt: string
  label: string
  htmlSnapshot: string
}

function formatNowLabel(d: Date) {
  return d.toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function htmlFromWikiBlocks(blocks: ContentBlock[]): string {
  const t = blocks.find((b): b is Extract<ContentBlock, { kind: 'text' }> => b.kind === 'text')
  return t?.body?.trim() ? t.body : '<p></p>'
}

function mergeHtmlIntoBlocks(blocks: ContentBlock[], html: string): ContentBlock[] {
  const body = html.trim() ? html : '<p></p>'
  const idx = blocks.findIndex((b) => b.kind === 'text')
  if (idx >= 0) {
    return blocks.map((b, i) => (i === idx ? { kind: 'text' as const, body: body } : b))
  }
  return [{ kind: 'text', body: body }, ...blocks]
}

function mergeHtmlIntoPagePayload(page: PageTemplate['page'], html: string): PageTemplate['page'] {
  return { ...page, blocks: mergeHtmlIntoBlocks(page.blocks, html) }
}

export type DocumentEditorWorkbenchProps = {
  /** `demo` — lokal state (standard test). `persist` — lagre tittel + TipTap-HTML til wiki-side. */
  mode?: 'demo' | 'persist'
  pageId?: string
  /** Når satt med `mode="persist"`: lagre til `document_org_templates` (organisasjonsmal), ikke wiki-side. */
  orgTemplateId?: string
  onExit?: () => void
  /** Vis toppintro («Dokumentredaktør — UI-test»). Av for innebygd bruk. */
  showHeader?: boolean
}

/**
 * PandaDoc-style TipTap-dokumentflate med sidepanel (seksjoner, spesifikasjon, historikk).
 * `mode="demo"` — kun lokalt. `mode="persist"` — wiki: `pageId` + `useDocuments`; organisasjonsmal: `orgTemplateId` (lagrer via `saveOrgCustomTemplate`).
 */
export function DocumentEditorWorkbench({
  mode = 'demo',
  pageId,
  orgTemplateId,
  onExit,
  showHeader = true,
}: DocumentEditorWorkbenchProps = {}) {
  const docs = useDocuments()
  const persistOrgTemplate = mode === 'persist' && Boolean(orgTemplateId)
  const orgTemplateRow = useMemo(
    () => (persistOrgTemplate && orgTemplateId ? docs.orgCustomTemplates.find((t) => t.id === orgTemplateId) : undefined),
    [persistOrgTemplate, orgTemplateId, docs.orgCustomTemplates],
  )
  const originalPage = mode === 'persist' && pageId && !persistOrgTemplate ? docs.pages.find((p) => p.id === pageId) : undefined
  const original = persistOrgTemplate ? orgTemplateRow?.pagePayload : originalPage

  const [html, setHtml] = useState(() => (mode === 'persist' && original ? htmlFromWikiBlocks(original.blocks) : INITIAL_HTML))
  const [editor, setEditor] = useState<Editor | null>(null)
  const [documentTitle, setDocumentTitle] = useState(() => (mode === 'persist' && original ? original.title : 'Side 1'))
  const [titleDraft, setTitleDraft] = useState(() => (mode === 'persist' && original ? original.title : 'Side 1'))
  const [titleEditing, setTitleEditing] = useState(false)
  const [persistDirty, setPersistDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const hydratedKeyRef = useRef<string | null>(null)
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('content')
  const [recipient, setRecipient] = useState('employee')

  const [specCategory, setSpecCategory] = useState('hms')
  const [specAuthor, setSpecAuthor] = useState('')
  const [specSignature, setSpecSignature] = useState('both')
  const [specCompliance, setSpecCompliance] = useState(
    'Dokumentet skal oppfylle krav i arbeidsmiljøloven og internkontrollforskriften der det er relevant for valgt kategori.',
  )
  const [specValidFrom, setSpecValidFrom] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [lastEditorActivity, setLastEditorActivity] = useState(() => formatNowLabel(new Date()))

  const handleHtmlChange = useCallback(
    (next: string) => {
      setHtml(next)
      setLastEditorActivity(formatNowLabel(new Date()))
      if (mode === 'persist') setPersistDirty(true)
    },
    [mode],
  )

  useEffect(() => {
    if (mode !== 'persist' || !pageId || persistOrgTemplate) return
    void docs.ensurePageLoaded(pageId)
  }, [mode, pageId, persistOrgTemplate, docs])

  useLayoutEffect(() => {
    if (mode !== 'persist') return
    if (persistOrgTemplate) {
      if (!orgTemplateId || !orgTemplateRow?.pagePayload) return
      const p = orgTemplateRow.pagePayload
      const key = `org:${orgTemplateId}:${orgTemplateRow.label}:${JSON.stringify(p.blocks).slice(0, 120)}`
      if (hydratedKeyRef.current === key) return
      hydratedKeyRef.current = key
      const nextHtml = htmlFromWikiBlocks(p.blocks)
      const nextTitle = (p.title || orgTemplateRow.label || 'Uten tittel').trim()
      queueMicrotask(() => {
        setHtml(nextHtml)
        setDocumentTitle(nextTitle)
        setTitleDraft(nextTitle)
        setTitleEditing(false)
        setPersistDirty(false)
        lastHistoryHtmlRef.current = nextHtml
        setHistory([
          {
            id: crypto.randomUUID(),
            savedAt: new Date().toISOString(),
            label: 'Mal fra biblioteket',
            htmlSnapshot: nextHtml,
          },
        ])
      })
      return
    }
    if (!pageId || !originalPage) return
    const key = `${pageId}:${originalPage.updatedAt}:${originalPage.version}`
    if (hydratedKeyRef.current === key) return
    hydratedKeyRef.current = key
    const nextHtml = htmlFromWikiBlocks(original.blocks)
    const nextTitle = original.title || 'Uten tittel'
    queueMicrotask(() => {
      setHtml(nextHtml)
      setDocumentTitle(nextTitle)
      setTitleDraft(nextTitle)
      setTitleEditing(false)
      setPersistDirty(false)
      lastHistoryHtmlRef.current = nextHtml
      setHistory([
        {
          id: crypto.randomUUID(),
          savedAt: new Date().toISOString(),
          label: 'Versjon fra server',
          htmlSnapshot: nextHtml,
        },
      ])
    })
  }, [mode, persistOrgTemplate, orgTemplateId, orgTemplateRow, pageId, original, originalPage])

  const [history, setHistory] = useState<HistoryEntry[]>(() => [
    {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      label: 'Startversjon',
      htmlSnapshot: INITIAL_HTML,
    },
  ])

  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHistoryHtmlRef = useRef(INITIAL_HTML)

  useEffect(() => {
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current)
    historyDebounceRef.current = setTimeout(() => {
      if (html === lastHistoryHtmlRef.current) return
      lastHistoryHtmlRef.current = html
      setHistory((prev) => {
        const now = new Date()
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          savedAt: now.toISOString(),
          label: `Automatisk lagring · ${formatNowLabel(now)}`,
          htmlSnapshot: html,
        }
        const next = [entry, ...prev]
        return next.slice(0, 40)
      })
    }, 1200)
    return () => {
      if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current)
    }
  }, [html])

  useEffect(() => {
    if (!titleEditing) return
    const id = window.requestAnimationFrame(() => {
      const el = document.getElementById('doc-page-title-input')
      if (el instanceof HTMLInputElement) {
        el.focus()
        el.select()
      }
    })
    return () => window.cancelAnimationFrame(id)
  }, [titleEditing])

  const commitDocumentTitle = useCallback(async () => {
    const next = titleDraft.trim() || 'Uten tittel'
    setDocumentTitle(next)
    setTitleDraft(next)
    setTitleEditing(false)
    if (mode !== 'persist' || !original) return
    setSaveError(null)
    try {
      if (persistOrgTemplate && orgTemplateId && orgTemplateRow) {
        const nextPage = mergeHtmlIntoPagePayload(orgTemplateRow.pagePayload, html)
        await docs.saveOrgCustomTemplate({
          id: orgTemplateId,
          label: next,
          description: orgTemplateRow.description,
          category: orgTemplateRow.category,
          legalBasis: orgTemplateRow.legalBasis,
          page: { ...nextPage, title: next },
        })
        setPersistDirty(false)
        return
      }
      if (pageId) {
        await docs.updatePage(pageId, { title: next })
        setPersistDirty(true)
      }
    } catch (e) {
      setSaveError(getSupabaseErrorMessage(e))
    }
  }, [titleDraft, mode, pageId, original, persistOrgTemplate, orgTemplateId, orgTemplateRow, html, docs])

  const handleSavePersist = useCallback(async () => {
    if (mode !== 'persist' || !original) return
    setSaving(true)
    setSaveError(null)
    try {
      if (persistOrgTemplate && orgTemplateId && orgTemplateRow) {
        const title = documentTitle.trim() || orgTemplateRow.label
        const nextPage = mergeHtmlIntoPagePayload(orgTemplateRow.pagePayload, html)
        await docs.saveOrgCustomTemplate({
          id: orgTemplateId,
          label: title,
          description: orgTemplateRow.description,
          category: orgTemplateRow.category,
          legalBasis: orgTemplateRow.legalBasis,
          page: { ...nextPage, title },
        })
        setPersistDirty(false)
      } else {
        if (!pageId || !originalPage) return
        const nextBlocks = mergeHtmlIntoBlocks(originalPage.blocks, html)
        await docs.updatePage(pageId, {
          title: documentTitle.trim() || originalPage.title,
          blocks: nextBlocks,
        })
        setPersistDirty(false)
      }
      const now = new Date()
      setHistory((prev) => {
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          savedAt: now.toISOString(),
          label: `Lagret manuelt · ${formatNowLabel(now)}`,
          htmlSnapshot: html,
        }
        return [entry, ...prev].slice(0, 40)
      })
      lastHistoryHtmlRef.current = html
    } catch (e) {
      setSaveError(getSupabaseErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }, [
    mode,
    original,
    originalPage,
    pageId,
    html,
    documentTitle,
    docs,
    persistOrgTemplate,
    orgTemplateId,
    orgTemplateRow,
  ])

  const insertSectionHtml = useCallback(
    (fragment: string) => {
      if (editor) {
        editor.chain().focus().insertContent(fragment + '<p></p>').run()
        return
      }
      setHtml((prev) => `${prev}<p></p>${fragment}`)
    },
    [editor],
  )

  const restoreHistoryEntry = useCallback((entry: HistoryEntry) => {
    setHtml(entry.htmlSnapshot)
    setLastEditorActivity(formatNowLabel(new Date()))
    lastHistoryHtmlRef.current = entry.htmlSnapshot
    if (editor) {
      editor.commands.setContent(entry.htmlSnapshot, { emitUpdate: false })
    }
  }, [editor])

  useDirtyGuard(mode === 'persist' && persistDirty)

  const recipientOptionsWithDot = useMemo(
    () =>
      RECIPIENT_OPTIONS.map((o) => ({
        ...o,
        suffix: o.value === recipient ? (
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-orange-500" aria-hidden />
        ) : undefined,
      })),
    [recipient],
  )

  const body = (
    <ModuleSectionCard className="overflow-hidden p-0">
      <div className="flex min-h-[min(720px,calc(100vh-220px))] flex-col lg:flex-row">
        {/* Canvas column — document uses full horizontal width of this column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#eef2f0]">
          <div className="flex w-full items-center justify-between border-b border-neutral-200/80 bg-white/90 px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 pr-2">
              {titleEditing ? (
                <StandardInput
                  id="doc-page-title-input"
                  className="max-w-md py-1.5 text-xs font-semibold uppercase tracking-wide"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitDocumentTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitDocumentTitle()
                    }
                    if (e.key === 'Escape') {
                      setTitleDraft(documentTitle)
                      setTitleEditing(false)
                    }
                  }}
                  aria-label="Dokumenttittel"
                />
              ) : (
                <span className="truncate text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {documentTitle}
                </span>
              )}
              {!titleEditing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-neutral-500 hover:text-neutral-800"
                  aria-label="Endre dokumenttittel"
                  onClick={() => {
                    setTitleDraft(documentTitle)
                    setTitleEditing(true)
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button type="button" variant="ghost" size="icon" aria-label="Legg til side">
                <Plus className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Flere handlinger">
                <span className="text-lg leading-none text-neutral-500">⋯</span>
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            <div className="flex min-h-0 w-full flex-1 flex-col border-neutral-200/90 bg-white shadow-sm lg:border-r-0">
              <div className="min-h-0 flex-1 border-b border-neutral-100">
                <TipTapRichTextEditor
                  key={mode === 'persist' && original ? `p-${pageId}-${original.updatedAt}` : 'demo'}
                  value={html}
                  onChange={handleHtmlChange}
                  toolbar="full"
                  onEditorReady={setEditor}
                  placeholder="Skriv eller lim inn dokumenttekst…"
                  className="rounded-none border-0 shadow-none [&_.tiptap-editor-root]:min-h-[min(520px,calc(100vh-320px))] [&_.tiptap-editor-root]:px-4 [&_.tiptap-editor-root]:py-6 sm:[&_.tiptap-editor-root]:px-8 md:[&_.tiptap-editor-root]:min-h-[560px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="flex w-full shrink-0 border-t border-neutral-200/80 bg-neutral-50 lg:w-[360px] lg:border-l lg:border-t-0">
          <div
            className="flex w-12 flex-col items-center gap-1 border-r border-neutral-200/80 py-3"
            role="tablist"
            aria-label="Sidepanel"
          >
            <Button
              type="button"
              variant={sidebarMode === 'content' ? 'primary' : 'ghost'}
              size="icon"
              className="rounded-full"
              aria-pressed={sidebarMode === 'content'}
              onClick={() => setSidebarMode('content')}
              aria-label="Innhold"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={sidebarMode === 'specification' ? 'primary' : 'ghost'}
              size="icon"
              className="rounded-full"
              aria-pressed={sidebarMode === 'specification'}
              onClick={() => setSidebarMode('specification')}
              aria-label="Dokumentspesifikasjon"
            >
              <User className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={sidebarMode === 'history' ? 'primary' : 'ghost'}
              size="icon"
              className="rounded-full"
              aria-pressed={sidebarMode === 'history'}
              onClick={() => setSidebarMode('history')}
              aria-label="Historikk"
            >
              <History className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {sidebarMode === 'content' ? (
              <>
                <h2 className="text-sm font-semibold text-neutral-900">Innhold</h2>
                <p className="mt-1 text-xs text-neutral-500">Klikk for å sette inn seksjoner (TipTap innhold).</p>

                <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Blokker</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {DOCUMENT_EDITOR_SECTIONS.map((sec) => {
                    const Icon = SECTION_ICONS[sec.id]
                    return (
                      <Button
                        key={sec.id}
                        type="button"
                        variant="secondary"
                        className="h-auto flex-col gap-1.5 py-3 text-center"
                        onClick={() => insertSectionHtml(sec.html)}
                        title={sec.description}
                      >
                        <Icon className="h-4 w-4 text-neutral-600" />
                        <span className="w-full text-[11px] font-medium leading-tight text-neutral-800">
                          {sec.shortLabel}
                        </span>
                      </Button>
                    )
                  })}
                </div>

                <p className="mt-6 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Utfyllbare felt for
                </p>
                <div className="mt-2">
                  <SearchableSelect
                    value={recipient}
                    options={recipientOptionsWithDot}
                    onChange={setRecipient}
                    placeholder="Velg mottaker"
                    triggerClassName="py-2 text-xs"
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {FIELD_TILES.map((f) => {
                    const Icon = f.icon
                    const fieldHtml: Record<string, string> = {
                      text: `<p><strong>${recipient === 'employer' ? 'Arbeidsgiver' : 'Arbeidstaker'} — ${f.label}:</strong> <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></p>`,
                      signature: `<p><strong>Signatur (${recipient === 'employer' ? 'arbeidsgiver' : 'arbeidstaker'}):</strong> <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u> &nbsp; Dato: <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></p>`,
                      initials: `<p><strong>Initialer:</strong> <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></p>`,
                      date: `<p><strong>Dato:</strong> <u>&nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></p>`,
                      checkbox: `<p>☐ &nbsp;${f.label}</p>`,
                      radio: `<p>○ &nbsp;Alternativ 1 &nbsp;&nbsp;&nbsp; ○ &nbsp;Alternativ 2</p>`,
                    }
                    return (
                      <Button
                        key={f.id}
                        type="button"
                        variant="secondary"
                        className="h-auto flex-col gap-1 border border-orange-100 bg-orange-50/80 py-2.5 hover:bg-orange-50"
                        onClick={() => insertSectionHtml(fieldHtml[f.id] ?? `<p>${f.label}</p>`)}
                        title={`Sett inn ${f.label}`}
                      >
                        <Icon className="h-4 w-4 text-orange-800/90" />
                        <span className="text-[11px] font-medium text-neutral-800">{f.label}</span>
                      </Button>
                    )
                  })}
                </div>
              </>
            ) : sidebarMode === 'specification' ? (
              <>
                <h2 className="text-sm font-semibold text-neutral-900">Dokumentspesifikasjon</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Metadata for klassifisering, ansvar, signatur og samsvar.
                </p>

                <div className={SPEC_FORM_STACK}>
                  <div className="mt-4">
                    <label className="text-xs font-medium text-neutral-700" htmlFor="doc-spec-category">
                      Kategori
                    </label>
                    <SearchableSelect
                      className="mt-1.5"
                      value={specCategory}
                      options={CATEGORY_OPTIONS}
                      onChange={setSpecCategory}
                      placeholder="Velg kategori"
                      triggerClassName="py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-700" htmlFor="doc-spec-author">
                      Forfatter / ansvarlig
                    </label>
                    <StandardInput
                      id="doc-spec-author"
                      className="mt-1.5"
                      value={specAuthor}
                      onChange={(e) => setSpecAuthor(e.target.value)}
                      placeholder="Navn eller rolle"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-700" htmlFor="doc-spec-signature">
                      Signaturkrav
                    </label>
                    <SearchableSelect
                      className="mt-1.5"
                      value={specSignature}
                      options={SIGNATURE_OPTIONS}
                      onChange={setSpecSignature}
                      placeholder="Velg krav"
                      triggerClassName="py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-700" htmlFor="doc-spec-compliance">
                      Samsvarskrav og lovhenvisning
                    </label>
                    <StandardTextarea
                      id="doc-spec-compliance"
                      className="mt-1.5 min-h-[100px] resize-y"
                      value={specCompliance}
                      onChange={(e) => setSpecCompliance(e.target.value)}
                      placeholder="F.eks. AML kap. 2, internkontrollforskriften § 5 …"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-700" htmlFor="doc-spec-valid-from">
                      Tidsstempel / gyldig fra
                    </label>
                    <StandardInput
                      id="doc-spec-valid-from"
                      className="mt-1.5"
                      type="datetime-local"
                      value={specValidFrom}
                      onChange={(e) => setSpecValidFrom(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      Sist aktivitet i redaktør: <span className="font-medium text-neutral-700">{lastEditorActivity}</span>
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-neutral-900">Historikk</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {mode === 'persist'
                    ? 'Øyeblikksbilder under redigering (lokalt i nettleseren). Lagre innhold med «Lagre» over dokumentet.'
                    : 'Automatiske øyeblikksbilder av dokumentinnhold (TipTap HTML) under redigering — kun lokalt.'}
                </p>
                <ul className="mt-4 space-y-2">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-600 shadow-sm"
                    >
                      <div className="font-medium text-neutral-900">{h.label}</div>
                      <div className="mt-0.5 text-[11px] text-neutral-500">
                        {new Date(h.savedAt).toLocaleString('nb-NO')}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-2 w-full"
                        onClick={() => restoreHistoryEntry(h)}
                      >
                        Gjenopprett denne versjonen
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </ModuleSectionCard>
  )

  if (mode === 'persist') {
    if (persistOrgTemplate) {
      if (!orgTemplateId) {
        return <WarningBox>Mangler mal-ID.</WarningBox>
      }
      if (docs.loading && !orgTemplateRow) {
        return <p className="text-sm text-neutral-600">Laster mal…</p>
      }
      if (!orgTemplateRow?.pagePayload) {
        return (
          <>
            <WarningBox>Fant ikke organisasjonsmalen.</WarningBox>
            {onExit ? (
              <Button type="button" variant="secondary" className="mt-4" onClick={onExit}>
                Tilbake
              </Button>
            ) : null}
          </>
        )
      }
    } else {
      if (!pageId) {
        return <WarningBox>Mangler side-ID.</WarningBox>
      }
      if (docs.loading && !originalPage) {
        return <p className="text-sm text-neutral-600">Laster dokument…</p>
      }
      if (!originalPage) {
        return (
          <>
            <WarningBox>Fant ikke dokumentet.</WarningBox>
            {onExit ? (
              <Button type="button" variant="secondary" className="mt-4" onClick={onExit}>
                Tilbake
              </Button>
            ) : null}
          </>
        )
      }
    }
  }

  const headerBlock =
    showHeader ? (
      <div className="mb-6 flex flex-col gap-4 border-b border-neutral-200/80 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-neutral-900">
            {mode === 'persist' ? 'Rediger dokument' : 'Dokumentredaktør — UI-test'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-600">
            {mode === 'persist'
              ? 'TipTap-redaktør med samme arbeidsflate som dokument-testen. Innhold lagres i første tekstblokk på wiki-siden.'
              : 'PandaDoc-inspirert arbeidsflate med TipTap (tiptap.dev), fullbred dokumentflate og dokumentspesifikasjon i sidepanelet. Kun lokalt utkast — ingen integrasjon.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
          {mode === 'persist' ? (
            <>
              {persistDirty ? <Badge variant="draft">Ulagrede endringer</Badge> : <Badge variant="signed">Lagret</Badge>}
              <Button type="button" variant="secondary" onClick={onExit}>
                Tilbake til oversikt
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={saving || !persistDirty}
                onClick={() => void handleSavePersist()}
              >
                {saving ? 'Lagrer…' : 'Lagre'}
              </Button>
            </>
          ) : (
            <>
              <Badge variant="draft">Utkast</Badge>
              <Button variant="secondary">
                Forhåndsvisning
              </Button>
              <Button variant="primary" icon={<FileText className="h-4 w-4" />}>
                Send (demo)
              </Button>
            </>
          )}
        </div>
      </div>
    ) : mode === 'persist' ? (
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {persistDirty ? <Badge variant="draft">Ulagrede endringer</Badge> : <Badge variant="signed">Lagret</Badge>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
          {onExit ? (
            <Button type="button" variant="secondary" onClick={onExit}>
              Tilbake
            </Button>
          ) : null}
          <Button type="button" variant="primary" disabled={saving || !persistDirty} onClick={() => void handleSavePersist()}>
            {saving ? 'Lagrer…' : 'Lagre'}
          </Button>
        </div>
      </div>
    ) : null

  return (
    <>
      {saveError ? (
        <div className="mb-4">
          <WarningBox>{saveError}</WarningBox>
        </div>
      ) : null}
      {headerBlock}
      {body}
    </>
  )
}
