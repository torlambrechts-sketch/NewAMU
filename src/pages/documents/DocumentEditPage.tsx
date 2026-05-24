/* eslint-disable no-restricted-syntax -- Notion-style editor uses raw <input>
   for the inline title/subtitle, raw <textarea> for the auto-resizing
   paragraph editor, and raw <button> for the formatting toolbar / section
   reorder controls. Wrapping these in StandardInput/Button would force
   borders, padding, and chrome that breaks the design. See
   WikiPageTree.tsx and WikiCommentsRail.tsx for the same exception. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Bold,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  GitMerge,
  ImagePlus,
  Info,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Paperclip,
  Pencil,
  Plus,
  Quote,
  Redo2,
  Save,
  Send,
  ShieldCheck,
  Table as TableIcon,
  Trash2,
  Underline,
  Undo2,
  Upload,
  X,
} from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { ModulePageShell } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
import { DOCUMENTS_MODULE_TITLE } from '../../data/documentsNav'
import {
  Initials,
  ModeToggle,
  categoryToKind,
  DOC_KIND_LABEL,
  DocStatusPill,
  displayVersion,
  type DocsMode,
} from '../../components/documents/docsShared'
import type {
  ContentBlock,
  HeadingBlock,
  TextBlock,
} from '../../types/documents'
import { canEditWikiDocuments } from '../../lib/documentsAccess'

/**
 * Document editor — 3-column layout:
 *   • Sticky formatting toolbar (top)
 *   • Left ToC with reorder/delete + Statistikk box
 *   • Center Notion-style editable paper (sections + paragraphs)
 *   • Right sidebar: Endringslogg, Metadata, Lov-chips, Bekreftelse, Approvals
 *   • Sticky save bar (bottom)
 *
 * Reads from `useDocuments()` and writes through `updatePage()`.
 * Section model is reconstructed from the page's block array:
 *   - HeadingBlock(level=2) starts a new section
 *   - TextBlock paragraphs hang underneath the section heading
 * On save we serialise sections back into [Heading, Text, Text, …] blocks.
 */

type Section = {
  /** stable string id for keys (regenerated when a heading is created) */
  id: string
  n: string
  title: string
  paragraphs: string[]
}

function freshSectionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sec-${crypto.randomUUID()}`
  }
  return `sec-${Math.random().toString(36).slice(2, 10)}`
}

function blocksToSections(blocks: ContentBlock[] | undefined): Section[] {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return [
      {
        id: freshSectionId(),
        n: '1',
        title: 'Innledning',
        paragraphs: [''],
      },
    ]
  }
  const out: Section[] = []
  let current: Section | null = null
  let counter = 0
  for (const b of blocks) {
    if (b && b.kind === 'heading') {
      counter += 1
      current = {
        id: freshSectionId(),
        n: String(counter),
        title: String((b as HeadingBlock).text ?? ''),
        paragraphs: [],
      }
      out.push(current)
      continue
    }
    if (!current) {
      counter = 1
      current = { id: freshSectionId(), n: '1', title: 'Innledning', paragraphs: [] }
      out.push(current)
    }
    if (b && b.kind === 'text') {
      // Strip HTML for the simple text editor — the rich editor lives on the
      // /reference-edit route; this fast lane keeps blocks portable.
      const plain = String((b as TextBlock).body ?? '').replace(/<[^>]+>/g, '').trim()
      current.paragraphs.push(plain)
    }
  }
  if (out.length === 0) {
    out.push({ id: freshSectionId(), n: '1', title: 'Innledning', paragraphs: [''] })
  }
  return out
}

function sectionsToBlocks(sections: Section[]): ContentBlock[] {
  const blocks: ContentBlock[] = []
  for (const s of sections) {
    blocks.push({ kind: 'heading', level: 2, text: s.title } as HeadingBlock)
    for (const p of s.paragraphs) {
      blocks.push({
        kind: 'text',
        body: p ? `<p>${escapeHtml(p)}</p>` : '',
      } as TextBlock)
    }
  }
  return blocks
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Auto-resizing textarea (mirrors DocumentEdit.jsx AutoTextarea) ──────────
function AutoTextarea({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.style.height = '0px'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        'block w-full resize-none border-none bg-transparent p-0 outline-none focus:bg-amber-50/40',
        className ?? '',
      ].join(' ')}
      placeholder={placeholder}
      rows={1}
    />
  )
}

function InlineEdit({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={[
        'block w-full border-none bg-transparent p-0 outline-none focus:bg-amber-50/40',
        className ?? '',
      ].join(' ')}
    />
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof Bold
  label: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      className={[
        'inline-flex h-7 w-7 items-center justify-center rounded text-neutral-600 transition-colors',
        active ? 'bg-neutral-200 text-neutral-900' : 'hover:bg-neutral-100 hover:text-neutral-900',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      {children}
    </div>
  )
}

export function DocumentEditPage() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const docs = useDocuments()
  const { profile, orgProfiles, can, isAdmin } = useOrgSetupContext()

  const canEditDocs = canEditWikiDocuments(can, profile?.is_org_admin) || isAdmin

  // Hydrate the page if missing (deep-link)
  useEffect(() => {
    void docs.ensurePageLoaded(pageId)
  }, [docs, pageId])

  const page = docs.pages.find((p) => p.id === pageId)
  const space = page ? docs.spaces.find((s) => s.id === page.spaceId) : null
  const docKind = useMemo(() => categoryToKind(space?.category ?? null), [space?.category])

  // Editor mode toggle (Enkel / Avansert) — only affects the right sidebar
  const [mode, setMode] = useState<DocsMode>('advanced')
  const easy = mode === 'easy'

  // Local editor state
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [sections, setSections] = useState<Section[]>(() => [])
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [changelog, setChangelog] = useState('')
  const [requiresConfirmation, setRequiresConfirmation] = useState(false)
  const [nextReview, setNextReview] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [lovTags, setLovTags] = useState<string[]>([])
  const [newLov, setNewLov] = useState('')
  const [bumpMajor, setBumpMajor] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [dirty, setDirty] = useState(false)

  // Hydrate state from page
  useEffect(() => {
    if (!page) return
    setTitle(page.title)
    setSubtitle(
      `Gjeldende fra ${
        page.status === 'published'
          ? new Date(page.updatedAt).toLocaleDateString('nb-NO')
          : 'TBA'
      }. Neste revisjon ${
        page.nextRevisionDueAt
          ? new Date(page.nextRevisionDueAt).toLocaleDateString('nb-NO')
          : 'ikke planlagt'
      }.`,
    )
    const initialSections = blocksToSections(page.blocks)
    setSections(initialSections)
    setActiveSection(initialSections[0]?.id ?? null)
    setRequiresConfirmation(Boolean(page.requiresAcknowledgement))
    setNextReview(
      page.nextRevisionDueAt
        ? new Date(page.nextRevisionDueAt).toLocaleDateString('nb-NO')
        : '',
    )
    setOwnerId(page.authorId)
    setLovTags(Array.isArray(page.legalRefs) ? page.legalRefs.slice() : [])
    setChangelog('')
    setBumpMajor(false)
    setDirty(false)
    setSaveStatus('saved')
    setSavedAt(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate the editor only when the page identity or version changes; the inner `page` snapshot is fresh per run and re-running on every field change would obliterate user input.
  }, [page?.id, page?.version])

  const markDirty = useCallback(() => {
    setDirty(true)
    setSaveStatus('dirty')
  }, [])

  // Section editing helpers
  const updateSection = useCallback(
    (idx: number, partial: Partial<Section>) => {
      setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...partial } : s)))
      markDirty()
    },
    [markDirty],
  )
  const updateParagraph = useCallback(
    (secIdx: number, parIdx: number, text: string) => {
      setSections((prev) =>
        prev.map((s, i) =>
          i === secIdx
            ? { ...s, paragraphs: s.paragraphs.map((p, j) => (j === parIdx ? text : p)) }
            : s,
        ),
      )
      markDirty()
    },
    [markDirty],
  )
  const addParagraph = useCallback(
    (secIdx: number) => {
      setSections((prev) =>
        prev.map((s, i) => (i === secIdx ? { ...s, paragraphs: [...s.paragraphs, ''] } : s)),
      )
      markDirty()
    },
    [markDirty],
  )
  const removeParagraph = useCallback(
    (secIdx: number, parIdx: number) => {
      setSections((prev) =>
        prev.map((s, i) =>
          i === secIdx
            ? { ...s, paragraphs: s.paragraphs.filter((_, j) => j !== parIdx) }
            : s,
        ),
      )
      markDirty()
    },
    [markDirty],
  )
  const addSection = useCallback(() => {
    const id = freshSectionId()
    setSections((prev) => {
      const next = [...prev, { id, n: String(prev.length + 1), title: 'Ny seksjon', paragraphs: [''] }]
      return next.map((s, i) => ({ ...s, n: String(i + 1) }))
    })
    setActiveSection(id)
    markDirty()
  }, [markDirty])
  const removeSection = useCallback(
    (idx: number) => {
      const ok = window.confirm('Slett denne seksjonen?')
      if (!ok) return
      setSections((prev) => {
        const next = prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, n: String(i + 1) }))
        return next
      })
      markDirty()
    },
    [markDirty],
  )
  const moveSection = useCallback(
    (idx: number, dir: -1 | 1) => {
      setSections((prev) => {
        const next = [...prev]
        const target = idx + dir
        if (target < 0 || target >= next.length) return prev
        const tmp = next[idx]!
        next[idx] = next[target]!
        next[target] = tmp
        return next.map((s, i) => ({ ...s, n: String(i + 1) }))
      })
      markDirty()
    },
    [markDirty],
  )

  // Lov-chips
  const addLov = useCallback(() => {
    const v = newLov.trim()
    if (!v) return
    setLovTags((prev) => (prev.includes(v) ? prev : [...prev, v]))
    setNewLov('')
    markDirty()
  }, [newLov, markDirty])
  const removeLov = useCallback(
    (l: string) => {
      setLovTags((prev) => prev.filter((x) => x !== l))
      markDirty()
    },
    [markDirty],
  )

  // Display version numbers (current → next)
  const currentVersion = page ? displayVersion(page.version) : '0.0'
  const nextVersionNum = page ? (bumpMajor ? page.version + 1 : page.version) : 1
  const nextVersion = displayVersion(nextVersionNum)

  // Stats
  const stats = useMemo(() => {
    const totalParagraphs = sections.reduce((a, s) => a + s.paragraphs.length, 0)
    const words = sections.reduce(
      (a, s) => a + s.paragraphs.join(' ').split(/\s+/).filter(Boolean).length,
      0,
    )
    return {
      sections: sections.length,
      paragraphs: totalParagraphs,
      words,
    }
  }, [sections])

  // ── Save handlers ──────────────────────────────────────────────────────────
  const buildPatch = useCallback(() => {
    if (!page) return null
    const nextRevisionIso = (() => {
      const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(nextReview.trim())
      if (!m) return null
      const [, dd, mm, yyyy] = m
      const iso = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd))).toISOString()
      if (Number.isNaN(new Date(iso).getTime())) return null
      return iso
    })()
    return {
      title: title.trim() || page.title,
      summary: subtitle.trim(),
      blocks: sectionsToBlocks(sections),
      legalRefs: lovTags,
      requiresAcknowledgement: requiresConfirmation,
      nextRevisionDueAt: nextRevisionIso,
    } as const
  }, [page, title, subtitle, sections, lovTags, requiresConfirmation, nextReview])

  const handleSaveDraft = useCallback(async () => {
    if (!page) return
    setError(null)
    setBusy(true)
    setSaveStatus('saving')
    try {
      const patch = buildPatch()
      if (!patch) throw new Error('Kunne ikke bygge endringsobjekt')
      await docs.updatePage(page.id, { ...patch, status: 'draft' })
      setSaveStatus('saved')
      setSavedAt(new Date())
      setDirty(false)
    } catch (err) {
      console.error('Save draft failed', err)
      setError(err instanceof Error ? err.message : 'Kunne ikke lagre.')
      setSaveStatus('error')
    } finally {
      setBusy(false)
    }
  }, [page, docs, buildPatch])

  const handleSubmitForReview = useCallback(async () => {
    if (!page) return
    setError(null)
    setBusy(true)
    setSaveStatus('saving')
    try {
      const patch = buildPatch()
      if (!patch) throw new Error('Kunne ikke bygge endringsobjekt')
      await docs.updatePage(page.id, { ...patch, status: 'draft' })
      await docs.submitForReview(page.id)
      setSaveStatus('saved')
      setSavedAt(new Date())
      setDirty(false)
      navigate(`/documents/page/${page.id}`)
    } catch (err) {
      console.error('Submit for review failed', err)
      setError(err instanceof Error ? err.message : 'Kunne ikke sende til godkjenning.')
      setSaveStatus('error')
    } finally {
      setBusy(false)
    }
  }, [page, docs, buildPatch, navigate])

  // Autosave every 8s while dirty
  useEffect(() => {
    if (!dirty || !page) return
    const id = window.setTimeout(() => {
      void handleSaveDraft()
    }, 8000)
    return () => window.clearTimeout(id)
  }, [dirty, page, handleSaveDraft])

  // Loading / error gates
  if (!pageId) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ]}
        title="Dokument"
        notFound={{ title: 'Mangler dokument-ID', onBack: () => navigate('/documents') }}
      >
        {null}
      </ModulePageShell>
    )
  }

  if (!canEditDocs) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ]}
        title="Ingen tilgang"
      >
        <WarningBox>Du har ikke rettigheter til å redigere dokumenter.</WarningBox>
        <Button
          type="button"
          variant="secondary"
          className="mt-4"
          onClick={() => navigate('/documents')}
        >
          Tilbake til bibliotek
        </Button>
      </ModulePageShell>
    )
  }

  if (docs.pageHydrateLoading && !page) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ]}
        title="Laster dokument…"
        loading
        loadingLabel="Laster dokument…"
      >
        {null}
      </ModulePageShell>
    )
  }

  if (!page) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'HMS' },
          { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ]}
        title="Dokument"
        notFound={{
          title: 'Side ikke funnet',
          backLabel: '← Tilbake til bibliotek',
          onBack: () => navigate('/documents'),
        }}
      >
        {null}
      </ModulePageShell>
    )
  }

  const ownerName =
    orgProfiles.find((p) => p.id === ownerId)?.display_name ??
    orgProfiles.find((p) => p.id === page.authorId)?.display_name ??
    'Ukjent'
  const possibleOwners = orgProfiles.filter((p) => p.id)

  const totalRequired = docs.stats?.requireAck ?? 0
  const reConfirmCount = bumpMajor ? totalRequired : Math.round(totalRequired * 0.6)

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: DOCUMENTS_MODULE_TITLE, to: '/documents' },
        ...(space ? [{ label: space.title, to: `/documents/space/${space.id}` }] : []),
        {
          label: page.title.length > 32 ? `${page.title.slice(0, 30)}…` : page.title,
          to: `/documents/page/${page.id}`,
        },
        { label: 'Rediger' },
      ]}
      title={
        <span className="inline-flex items-center gap-2">
          <Pencil className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          Redigerer
        </span>
      }
      description={
        easy ? (
          <p className="text-sm text-neutral-600">Endringer publiseres som ny versjon.</p>
        ) : (
          <p className="text-sm text-neutral-600">
            Endringer publiseres som v{nextVersion}.{' '}
            {requiresConfirmation
              ? `${totalRequired} ansatte må bekrefte på nytt etter publisering.`
              : 'Bekreftelse ikke krevd.'}
          </p>
        )
      }
      headerActions={
        <>
          <Button
            variant="ghost"
            icon={<X className="h-4 w-4" aria-hidden />}
            onClick={() => navigate(`/documents/page/${page.id}`)}
          >
            Avbryt
          </Button>
          <ModeToggle mode={mode} onChange={setMode} />
          <Button
            variant="secondary"
            icon={<Eye className="h-4 w-4" aria-hidden />}
            onClick={() => navigate(`/documents/page/${page.id}`)}
          >
            Forhåndsvis
          </Button>
          <Button
            variant="secondary"
            icon={<Save className="h-4 w-4" aria-hidden />}
            onClick={() => {
              void handleSaveDraft()
            }}
            disabled={busy}
          >
            Lagre kladd
          </Button>
          <Button
            variant="primary"
            icon={<Send className="h-4 w-4" aria-hidden />}
            onClick={() => {
              void handleSubmitForReview()
            }}
            disabled={busy}
          >
            Send til godkjenning
          </Button>
        </>
      }
    >
      {error ? <WarningBox>{error}</WarningBox> : null}

      {/* Status / version banner */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white px-5 py-3"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      >
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <DocStatusPill status="kladd" />
          <span className="inline-flex items-center gap-1.5 rounded border border-neutral-200 px-2 py-1 font-semibold tabular-nums">
            v{currentVersion} <ArrowRight className="h-3 w-3 text-neutral-400" aria-hidden /> v
            {nextVersion}
          </span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-neutral-600 hover:text-neutral-900">
            <input
              type="checkbox"
              checked={bumpMajor}
              onChange={(e) => {
                setBumpMajor(e.target.checked)
                markDirty()
              }}
              className="h-3 w-3"
            />
            <span>Stor revisjon (bryt versjonsnummer)</span>
          </label>
          <span className="text-neutral-400">·</span>
          <span className="inline-flex items-center gap-1 text-neutral-600">
            {saveStatus === 'saved' ? (
              <>
                <Save className="h-3 w-3 text-green-600" aria-hidden />
                Lagret{' '}
                {savedAt
                  ? `kl ${savedAt.toLocaleTimeString('nb-NO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : ''}
              </>
            ) : saveStatus === 'saving' ? (
              <>
                <Save className="h-3 w-3 animate-pulse text-amber-500" aria-hidden />
                Lagrer…
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle className="h-3 w-3 text-red-600" aria-hidden />
                Feil
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 text-amber-500" aria-hidden />
                Endringer ikke lagret
              </>
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600">
          {requiresConfirmation ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900">
              <AlertCircle className="h-3 w-3" aria-hidden /> Publisering vil nullstille bekreftelser
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <Initials name={ownerName} size={20} /> {ownerName}
          </span>
        </div>
      </div>

      {/* Formatting toolbar */}
      <div
        className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-xl border border-neutral-200/80 bg-white px-3 py-1.5"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      >
        <select
          className="rounded border-none bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700 outline-none hover:bg-neutral-100 focus:bg-white"
          defaultValue="paragraph"
        >
          <option value="h2">Overskrift</option>
          <option value="paragraph">Brødtekst</option>
          <option value="quote">Sitat</option>
        </select>
        <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />
        <ToolbarButton icon={Bold} label="Fet" />
        <ToolbarButton icon={Italic} label="Kursiv" />
        <ToolbarButton icon={Underline} label="Understrek" />
        <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />
        <ToolbarButton icon={List} label="Punktliste" />
        <ToolbarButton icon={ListOrdered} label="Nummerert liste" />
        <ToolbarButton icon={Quote} label="Sitat" />
        <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />
        <ToolbarButton icon={LinkIcon} label="Lenke" />
        <ToolbarButton icon={Paperclip} label="Legg ved fil" />
        <ToolbarButton icon={ImagePlus} label="Bilde" />
        <ToolbarButton icon={TableIcon} label="Tabell" />
        <span className="mx-1 h-5 w-px bg-neutral-200" aria-hidden />
        <ToolbarButton icon={ShieldCheck} label="Sett inn lovverk-referanse" />
        <ToolbarButton icon={GitMerge} label="Sett inn lenke til relatert dokument" />
        <div className="ml-auto flex items-center gap-2 text-[10px] text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <Undo2 className="h-3 w-3" aria-hidden />
          </span>
          <span className="inline-flex items-center gap-1">
            <Redo2 className="h-3 w-3" aria-hidden />
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[9px]">⌘S</kbd> Lagre
          </span>
        </div>
      </div>

      {/* 3-column body */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        {/* LEFT — ToC */}
        <aside>
          <div className="sticky top-14">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Innhold
              </div>
              <button
                type="button"
                onClick={addSection}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-[#1a3d32]"
                title="Ny seksjon"
              >
                <Plus className="h-3 w-3" aria-hidden />
              </button>
            </div>
            <ul className="mt-2 space-y-0.5">
              {sections.map((s, i) => {
                const active = s.id === activeSection
                return (
                  <li key={s.id} className="group">
                    <button
                      type="button"
                      onClick={() => setActiveSection(s.id)}
                      className={[
                        'flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
                        active
                          ? 'bg-[#e7efe9] font-semibold text-[#1a3d32]'
                          : 'text-neutral-700 hover:bg-neutral-50',
                      ].join(' ')}
                    >
                      <span className="tabular-nums text-neutral-400">{s.n}</span>
                      <span className="min-w-0 flex-1 truncate">{s.title || 'Uten tittel'}</span>
                      {active ? (
                        <span className="hidden items-center gap-0.5 group-hover:inline-flex">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              moveSection(i, -1)
                            }}
                            className="rounded p-0.5 hover:bg-white"
                            title="Flytt opp"
                          >
                            <ChevronUp className="h-2.5 w-2.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              moveSection(i, 1)
                            }}
                            className="rounded p-0.5 hover:bg-white"
                            title="Flytt ned"
                          >
                            <ChevronDown className="h-2.5 w-2.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeSection(i)
                            }}
                            className="rounded p-0.5 text-red-600 hover:bg-white"
                            title="Slett"
                          >
                            <Trash2 className="h-2.5 w-2.5" aria-hidden />
                          </button>
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={addSection}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-neutral-300 px-2 py-1.5 text-[11px] font-semibold text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]"
            >
              <Plus className="h-3 w-3" aria-hidden /> Ny seksjon
            </button>

            {!easy ? (
              <div className="mt-5 rounded-md bg-[#fbf9f3] p-3 text-[11px]">
                <div className="font-semibold text-neutral-900">Statistikk</div>
                <ul className="mt-1.5 space-y-0.5 text-neutral-600">
                  <li className="flex justify-between">
                    <span>Seksjoner</span>
                    <span className="font-semibold tabular-nums text-neutral-900">
                      {stats.sections}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Avsnitt</span>
                    <span className="font-semibold tabular-nums text-neutral-900">
                      {stats.paragraphs}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Ord</span>
                    <span className="font-semibold tabular-nums text-neutral-900">
                      {stats.words}
                    </span>
                  </li>
                </ul>
              </div>
            ) : null}
          </div>
        </aside>

        {/* CENTER — Editor */}
        <article
          className="mx-auto w-full max-w-[720px] rounded-xl bg-white px-6 py-8 ring-1 ring-neutral-200/70 sm:px-10 sm:py-10 md:px-14 md:py-12"
          style={{
            fontFamily: "'Inter', sans-serif",
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          {/* Document header */}
          <div className="border-b border-neutral-100 pb-4">
            <div className="text-[12px] font-medium text-neutral-400">
              {DOC_KIND_LABEL[docKind]} · v{currentVersion} → v{nextVersion}
            </div>
            <InlineEdit
              value={title}
              onChange={(v) => {
                setTitle(v)
                markDirty()
              }}
              placeholder="Dokumenttittel…"
              className="mt-3 text-4xl font-bold leading-[1.15] tracking-tight text-neutral-900"
            />
            <AutoTextarea
              value={subtitle}
              onChange={(v) => {
                setSubtitle(v)
                markDirty()
              }}
              className="mt-3 text-[14px] text-neutral-500"
              placeholder="Undertekst, gjeldende fra…"
            />
          </div>

          {sections.map((s, secIdx) => (
            <section key={s.id} id={s.id} className="group/section relative mt-10 first:mt-6">
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-bold tabular-nums text-neutral-300">{s.n}</span>
                <InlineEdit
                  value={s.title}
                  onChange={(v) => updateSection(secIdx, { title: v })}
                  placeholder="Seksjonstittel…"
                  className="flex-1 text-[26px] font-bold leading-tight tracking-tight text-neutral-900"
                />
                <span className="hidden items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100">
                  <button
                    type="button"
                    onClick={() => moveSection(secIdx, -1)}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                    title="Flytt opp"
                  >
                    <ChevronUp className="h-3 w-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(secIdx, 1)}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                    title="Flytt ned"
                  >
                    <ChevronDown className="h-3 w-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSection(secIdx)}
                    className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-700"
                    title="Slett seksjon"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {s.paragraphs.map((p, parIdx) => (
                  <div
                    key={parIdx}
                    className="group/par relative -mx-2 rounded px-2 py-0.5 transition-colors hover:bg-neutral-50"
                  >
                    <AutoTextarea
                      value={p}
                      onChange={(v) => updateParagraph(secIdx, parIdx, v)}
                      className="text-[15.5px] leading-[1.65] text-neutral-700"
                      placeholder="Skriv et avsnitt…"
                    />
                    <button
                      type="button"
                      onClick={() => removeParagraph(secIdx, parIdx)}
                      className="absolute -right-7 top-1.5 hidden h-5 w-5 items-center justify-center rounded text-neutral-300 hover:bg-red-50 hover:text-red-600 group-hover/par:inline-flex"
                      title="Slett avsnitt"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addParagraph(secIdx)}
                  className="-ml-0.5 mt-1 inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-semibold text-neutral-400 hover:bg-neutral-50 hover:text-[#1a3d32]"
                >
                  <Plus className="h-3 w-3" aria-hidden /> Nytt avsnitt
                </button>
              </div>
            </section>
          ))}

          {/* Add new section CTA */}
          <button
            type="button"
            onClick={addSection}
            className="mt-10 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-neutral-200 px-3 py-3 text-xs font-semibold text-neutral-500 hover:border-[#1a3d32] hover:bg-neutral-50 hover:text-[#1a3d32]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Ny seksjon
          </button>
        </article>

        {/* RIGHT — sidebar settings */}
        <aside className="space-y-3" style={{ fontFamily: 'Inter, sans-serif' }}>
          {/* Endringslogg */}
          <div
            className="rounded-xl border border-neutral-200/80 bg-white p-4"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Endringslogg</h3>
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-900">
                Påkrevd
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              Beskriv hva som endres i v{nextVersion}. Vises i historikk.
            </p>
            <textarea
              value={changelog}
              onChange={(e) => {
                setChangelog(e.target.value)
                markDirty()
              }}
              rows={3}
              className="mt-2 w-full rounded-md border border-neutral-200 bg-neutral-50 p-2 text-xs outline-none focus:border-[#1a3d32] focus:bg-white"
              placeholder="Hva har du endret? F.eks. «Lagt til § 5.3 om sertifiseringskrav»"
            />
          </div>

          {/* Metadata */}
          <div
            className="rounded-xl border border-neutral-200/80 bg-white p-4"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <h3 className="text-sm font-semibold text-neutral-900">Metadata</h3>
            <div className="mt-3 space-y-2.5">
              <FieldGroup label="Eier">
                <select
                  value={ownerId}
                  onChange={(e) => {
                    setOwnerId(e.target.value)
                    markDirty()
                  }}
                  className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs outline-none focus:border-[#1a3d32] focus:bg-white"
                >
                  {possibleOwners.length === 0 ? (
                    <option value={page.authorId}>{ownerName}</option>
                  ) : (
                    possibleOwners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))
                  )}
                </select>
              </FieldGroup>
              <FieldGroup label="Mappe">
                <select
                  className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs outline-none focus:border-[#1a3d32] focus:bg-white"
                  defaultValue={page.spaceId}
                  onChange={() => markDirty()}
                  disabled
                  title="Flytt dokumentet via «Innstillinger»-fanen."
                >
                  {docs.spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </FieldGroup>
              <FieldGroup label="Neste revisjon">
                <input
                  type="text"
                  value={nextReview}
                  onChange={(e) => {
                    setNextReview(e.target.value)
                    markDirty()
                  }}
                  placeholder="dd.mm.åååå"
                  className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs tabular-nums outline-none focus:border-[#1a3d32] focus:bg-white"
                />
              </FieldGroup>
            </div>
          </div>

          {/* Lov-chips */}
          <div
            className="rounded-xl border border-neutral-200/80 bg-white p-4"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <h3 className="text-sm font-semibold text-neutral-900">Lovverk</h3>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              Koblede paragrafer. Vises på dokumentet og i compliance-rapporter.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {lovTags.map((l) => (
                <span
                  key={l}
                  className="inline-flex items-center gap-1 rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]"
                >
                  {l}
                  <button
                    type="button"
                    onClick={() => removeLov(l)}
                    className="text-[#14312a]/60 hover:text-red-700"
                    aria-label={`Fjern ${l}`}
                  >
                    <X className="h-2.5 w-2.5" aria-hidden />
                  </button>
                </span>
              ))}
              {lovTags.length === 0 ? (
                <span className="text-[11px] text-neutral-400">Ingen lovverk koblet</span>
              ) : null}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <input
                value={newLov}
                onChange={(e) => setNewLov(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addLov()
                  }
                }}
                placeholder="F.eks. AML § 3-1"
                className="flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs outline-none focus:border-[#1a3d32] focus:bg-white"
              />
              <button
                type="button"
                onClick={addLov}
                className="rounded-md bg-[#1a3d32] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#143028]"
              >
                Legg til
              </button>
            </div>
          </div>

          {/* Confirmation requirement */}
          <div
            className="rounded-xl border border-neutral-200/80 bg-white p-4"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <h3 className="text-sm font-semibold text-neutral-900">Bekreftelse</h3>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-900">Krever bekreftelse</div>
                <div className="mt-0.5 text-[11px] text-neutral-500">
                  Ansatte må aktivt bekrefte at de har lest dokumentet.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRequiresConfirmation((v) => !v)
                  markDirty()
                }}
                className={[
                  'relative mt-1 h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
                  requiresConfirmation ? 'bg-[#1a3d32]' : 'bg-neutral-300',
                ].join(' ')}
                aria-pressed={requiresConfirmation}
              >
                <span
                  className={[
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                    requiresConfirmation ? 'translate-x-4' : 'translate-x-0.5',
                  ].join(' ')}
                />
              </button>
            </div>
            {requiresConfirmation ? (
              <div className="mt-3 rounded-md bg-amber-50 p-2.5 text-[11px] text-amber-900 ring-1 ring-amber-100">
                <div className="flex items-start gap-1.5">
                  <Info className="mt-0.5 h-3 w-3 shrink-0 text-amber-700" aria-hidden />
                  <span>
                    Ved publisering av {bumpMajor ? 'stor revisjon' : 'denne versjonen'} må{' '}
                    {reConfirmCount} ansatte bekrefte på nytt.
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Approval flow */}
          {!easy ? (
            <div
              className="rounded-xl border border-neutral-200/80 bg-white p-4"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <h3 className="text-sm font-semibold text-neutral-900">Godkjenningsflyt</h3>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                Triggres når du klikker «Send til godkjenning».
              </p>
              <ol className="mt-3 space-y-1.5 text-xs">
                {[
                  { who: 'Verneombud', name: '—' },
                  { who: 'HMS-leder', name: '—' },
                  bumpMajor ? { who: 'Daglig leder', name: '—' } : null,
                ]
                  .filter(Boolean)
                  .map((s, i) => {
                    if (!s) return null
                    return (
                      <li
                        key={i}
                        className="flex items-center gap-2 rounded border border-neutral-200 bg-[#fbf9f3] px-2 py-1.5"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-600">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          <span className="text-neutral-900">{s.who}</span>
                          <span className="text-neutral-500"> · {s.name}</span>
                        </span>
                      </li>
                    )
                  })}
              </ol>
            </div>
          ) : null}

          {/* Vedlegg */}
          {!easy ? (
            <div
              className="rounded-xl border border-neutral-200/80 bg-white p-4"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <h3 className="text-sm font-semibold text-neutral-900">Vedlegg</h3>
              <ul className="mt-2 space-y-1.5">
                {(docs.spaceItems ?? [])
                  .filter((it) => it.spaceId === page.spaceId)
                  .slice(0, 5)
                  .map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center gap-2 rounded border border-neutral-200 px-2 py-1.5 text-xs"
                    >
                      {it.kind === 'file' ? (
                        <FileText className="h-3 w-3 shrink-0 text-neutral-500" aria-hidden />
                      ) : (
                        <LinkIcon className="h-3 w-3 shrink-0 text-neutral-500" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate text-neutral-700">
                        {it.title || it.fileName || 'Vedlegg'}
                      </span>
                      {it.fileSize ? (
                        <span className="shrink-0 text-[10px] tabular-nums text-neutral-400">
                          {Math.round(it.fileSize / 1024)} KB
                        </span>
                      ) : null}
                    </li>
                  ))}
                {(docs.spaceItems ?? []).filter((it) => it.spaceId === page.spaceId).length === 0 ? (
                  <li className="text-[11px] text-neutral-400">Ingen vedlegg ennå</li>
                ) : null}
              </ul>
              <button
                type="button"
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-2 py-1.5 text-[11px] font-semibold text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]"
              >
                <Upload className="h-3 w-3" aria-hidden /> Last opp vedlegg
              </button>
            </div>
          ) : null}
        </aside>
      </div>

      {/* Bottom sticky save bar */}
      <div
        className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white px-5 py-3"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      >
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {saveStatus === 'saved' ? (
            <span className="inline-flex items-center gap-1.5 text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Endringer lagret som kladd
            </span>
          ) : saveStatus === 'saving' ? (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <Save className="h-3.5 w-3.5 animate-pulse" aria-hidden /> Lagrer kladd…
            </span>
          ) : saveStatus === 'error' ? (
            <span className="inline-flex items-center gap-1.5 text-red-700">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden /> Kunne ikke lagre
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden /> Endringer ikke lagret
            </span>
          )}
          <span className="text-neutral-400">·</span>
          <span className="inline-flex items-center gap-1 tabular-nums text-neutral-600">
            v{currentVersion} → v{nextVersion}
          </span>
          {changelog === '' ? (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <AlertCircle className="h-3 w-3" aria-hidden /> Endringslogg mangler
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate(`/documents/page/${page.id}`)}>
            Avbryt
          </Button>
          <Button
            variant="secondary"
            icon={<Save className="h-4 w-4" aria-hidden />}
            onClick={() => {
              void handleSaveDraft()
            }}
            disabled={busy}
          >
            Lagre kladd
          </Button>
          <Button
            variant="primary"
            icon={<Send className="h-4 w-4" aria-hidden />}
            onClick={() => {
              void handleSubmitForReview()
            }}
            disabled={busy}
          >
            Send til godkjenning
          </Button>
        </div>
      </div>
    </ModulePageShell>
  )
}

