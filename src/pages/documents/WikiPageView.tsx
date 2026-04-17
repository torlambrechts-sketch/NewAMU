import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Pencil,
  Printer,
} from 'lucide-react'
import { useWikiPage, useWikiSpaces } from '../../hooks/useDocuments'
import { WikiBlockRenderer } from './WikiBlockRenderer'
import { AddTaskLink } from '../../components/tasks/AddTaskLink'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'
import { WikiPageTocRail } from './WikiPageTocRail'
import { WikiVersionDiffModal } from './WikiVersionDiffModal'
import {
  extractHeadingToc,
  readingMinutesFromBlocks,
} from '../../lib/wikiPageContent'
import type { WikiPage } from '../../types/documents'

const TEMPLATE_CLASS = {
  standard: 'max-w-3xl',
  wide: 'max-w-5xl',
  policy: 'max-w-2xl',
}

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 60_000)
  return () => window.clearInterval(id)
}
function getClockSnapshot() {
  return Date.now()
}

function startOfTodayMs() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function WikiPageView() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const wikiPage = useWikiPage(pageId)
  const wikiSpaces = useWikiSpaces()
  const {
    ensurePageLoaded,
    pageHydrateLoading,
    pageHydrateError,
    page,
    pages: allPages,
    versions,
    refreshDocuments,
  } = wikiPage
  const timeNow = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)

  const contentRootRef = useRef<HTMLDivElement>(null)
  const ackAnchorRef = useRef<HTMLDivElement>(null)
  const [diffOpen, setDiffOpen] = useState(false)

  const space = page ? wikiSpaces.spaces.find((s) => s.id === page.spaceId) : null

  useEffect(() => {
    void ensurePageLoaded(pageId)
  }, [ensurePageLoaded, pageId])

  useEffect(() => {
    if (!wikiPage.ready) return
    void refreshDocuments()
  }, [wikiPage.ready, refreshDocuments, pageId])

  const publishedNeighborsFixed = useMemo(() => {
    if (!page || page.status !== 'published') return { prev: null as WikiPage | null, next: null as WikiPage | null }
    const list = allPages
      .filter((p) => p.spaceId === page.spaceId && p.status === 'published')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    const i = list.findIndex((p) => p.id === page.id)
    if (i < 0) return { prev: null, next: null }
    return { prev: list[i + 1] ?? null, next: list[i - 1] ?? null }
  }, [allPages, page])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const alreadySigned = page ? wikiPage.hasAcknowledged(page.id, page.version) : false
  const ackRequiredForMe = page ? wikiPage.acknowledgementRequiredForMe(page) : false
  const showSignBadge = Boolean(page?.requiresAcknowledgement && ackRequiredForMe)
  const showAckSticky = Boolean(
    page &&
      page.requiresAcknowledgement &&
      page.status === 'published' &&
      ackRequiredForMe &&
      !alreadySigned,
  )

  const previousVersionSnapshot = useMemo(() => {
    if (!page) return null
    return versions.find((v) => v.version === page.version - 1) ?? null
  }, [page, versions])

  useEffect(() => {
    if (!showAckSticky) return
    const t = window.setTimeout(() => {
      ackAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 400)
    return () => window.clearTimeout(t)
  }, [showAckSticky, page?.id, page?.version])

  if (pageHydrateError && !page) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{pageHydrateError}</p>
        <Link to="/documents" className="mt-4 inline-block text-[#1a3d32] underline">
          ← Tilbake til dokumenter
        </Link>
      </div>
    )
  }

  if ((wikiPage.loading || pageHydrateLoading) && !page) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-neutral-600">
        <Loader2 className="size-8 animate-spin text-[#1a3d32]" aria-hidden />
        <p className="text-sm">Laster dokument…</p>
      </div>
    )
  }

  if (wikiPage.error && !page) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{wikiPage.error}</p>
        <Link to="/documents" className="mt-4 inline-block text-[#1a3d32] underline">
          ← Tilbake til dokumenter
        </Link>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center text-neutral-500">
        Side ikke funnet. <Link to="/documents" className="text-[#1a3d32] underline">← Tilbake</Link>
      </div>
    )
  }

  const legalRefs = Array.isArray(page.legalRefs) ? page.legalRefs : []
  const templateKey: keyof typeof TEMPLATE_CLASS =
    page.template === 'wide' || page.template === 'policy' || page.template === 'standard'
      ? page.template
      : 'standard'

  const blocks = Array.isArray(page.blocks) ? page.blocks : []
  const tocItems = extractHeadingToc(blocks)
  const readMin = readingMinutesFromBlocks(blocks)
  const readLabel = readMin > 0 ? `ca. ${readMin} min lesing` : null

  const due = page.nextRevisionDueAt ? new Date(page.nextRevisionDueAt) : null
  const daysToDue = due ? Math.ceil((due.getTime() - timeNow) / (24 * 60 * 60 * 1000)) : null
  const revisionSoon = due != null && daysToDue != null && daysToDue <= 60 && daysToDue >= 0
  const revisionOverdue = due != null && due.getTime() < startOfTodayMs()

  const { prev: prevPage, next: nextPage } = publishedNeighborsFixed

  return (
    <DocumentsModuleLayout
      className="wiki-page-print-root"
      subHeader={
        <nav className="mt-6 flex flex-wrap items-center gap-2 border-b border-neutral-200/80 pb-6 text-sm text-neutral-600 print:hidden">
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
        </nav>
      }
    >
      <WikiVersionDiffModal
        open={diffOpen}
        onClose={() => setDiffOpen(false)}
        currentVersion={page.version}
        currentBlocks={blocks}
        previous={previousVersionSnapshot}
      />

      {showAckSticky ? (
        <div
          className="wiki-no-print fixed bottom-0 left-0 right-0 z-[85] border-t border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-950 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] print:hidden"
          role="status"
        >
          Denne siden krever din bekreftelse ↓
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
        <WikiPageTocRail items={tocItems} contentRootRef={contentRootRef} />

        <div ref={contentRootRef} className="min-w-0 flex-1">
          {revisionOverdue && page.nextRevisionDueAt ? (
            <div className="print:hidden mb-6 border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              ⚠ Dette dokumentet er forfalt for revisjon siden{' '}
              {new Date(page.nextRevisionDueAt).toLocaleDateString('no-NO')}
            </div>
          ) : null}

            <div className={`${TEMPLATE_CLASS[templateKey]} mx-auto`}>
            <div className="wiki-print-header mb-8 flex flex-wrap items-start justify-between gap-4 print:block">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1
                    className="text-2xl font-bold text-neutral-900 md:text-3xl"
                    style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                  >
                    {page.title}
                  </h1>
                  <span
                    className={`rounded-none border px-2.5 py-0.5 text-xs font-semibold uppercase ${
                      page.status === 'published'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : page.status === 'draft'
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-neutral-200 bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {page.status === 'published' ? 'Publisert' : page.status === 'draft' ? 'Utkast' : 'Arkivert'}
                  </span>
                  {showSignBadge && alreadySigned && (
                    <span className="inline-flex items-center gap-1 rounded-none border border-[#1a3d32]/30 bg-[#1a3d32]/10 px-2.5 py-0.5 text-xs font-medium text-[#1a3d32]">
                      <CheckCircle2 className="size-3.5" /> Signert
                    </span>
                  )}
                  {page.version > 1 && previousVersionSnapshot ? (
                    <button
                      type="button"
                      onClick={() => setDiffOpen(true)}
                      className="print:hidden text-xs font-medium text-[#1a3d32] underline decoration-[#1a3d32]/40 underline-offset-2 hover:decoration-[#1a3d32]"
                    >
                      Vis endringer
                    </button>
                  ) : null}
                </div>
                {readLabel ? <p className="mt-1 text-sm text-neutral-500">{readLabel}</p> : null}
                {page.summary && <p className="mt-2 text-neutral-600">{page.summary}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    Sist oppdatert {new Date(page.updatedAt).toLocaleDateString('no-NO')}
                  </span>
                  <span>v{page.version}</span>
                  {page.nextRevisionDueAt && (
                    <span
                      className={`rounded-none border px-2 py-0.5 font-medium ${
                        daysToDue != null && daysToDue < 0
                          ? 'border-red-200 bg-red-50 text-red-800'
                          : daysToDue != null && daysToDue <= 60
                            ? 'border-amber-200 bg-amber-50 text-amber-900'
                            : 'border-neutral-200 bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      Neste revisjon: {new Date(page.nextRevisionDueAt).toLocaleDateString('no-NO')}
                    </span>
                  )}
                  {legalRefs.map((r) => (
                    <span key={r} className="rounded-none bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-[#1a3d32]">
                      {r}
                    </span>
                  ))}
                </div>
                {page.status === 'published' && revisionSoon && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
                    <AddTaskLink
                      title={`Revider dokument: ${page.title}`}
                      description={`Systematisk gjennomgang (IK-f §5). Frist: ${page.nextRevisionDueAt ? new Date(page.nextRevisionDueAt).toLocaleDateString('no-NO') : ''}. Oppdater innhold, publiser på nytt og innhent signaturer.`}
                      module="hse"
                      sourceType="manual"
                      sourceId={page.id}
                      sourceLabel={page.title}
                    >
                      Oppfølgingsoppgave (Kanban)
                    </AddTaskLink>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-none border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                >
                  <Printer className="size-3.5" />
                  Skriv ut / Last ned PDF
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/documents/page/${page.id}/edit`)}
                  className="inline-flex items-center gap-1.5 rounded-none border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                >
                  <Pencil className="size-3.5" />
                  Rediger
                </button>
              </div>
            </div>

            <WikiBlockRenderer
              blocks={blocks}
              pageId={page.id}
              pageVersion={page.version}
              acknowledgementAnchorRef={page.requiresAcknowledgement ? ackAnchorRef : undefined}
            />

            {page.status === 'published' && (prevPage || nextPage) ? (
              <nav
                className="print:hidden mt-12 flex flex-col gap-3 border-t border-neutral-200 pt-8 text-sm sm:flex-row sm:items-center sm:justify-between"
                aria-label="Navigasjon mellom sider"
              >
                {prevPage ? (
                  <Link
                    to={`/documents/page/${prevPage.id}`}
                    className="inline-flex items-center gap-2 font-medium text-[#1a3d32] hover:underline"
                  >
                    <ArrowLeft className="size-4 shrink-0" />
                    <span className="min-w-0 truncate">{prevPage.title}</span>
                    <span className="shrink-0 text-neutral-500">← Forrige side</span>
                  </Link>
                ) : (
                  <span />
                )}
                {nextPage ? (
                  <Link
                    to={`/documents/page/${nextPage.id}`}
                    className="inline-flex items-center gap-2 font-medium text-[#1a3d32] hover:underline sm:text-right"
                  >
                    <span className="shrink-0 text-neutral-500">Neste side →</span>
                    <span className="min-w-0 truncate">{nextPage.title}</span>
                    <ArrowRight className="size-4 shrink-0" />
                  </Link>
                ) : null}
              </nav>
            ) : null}

            {versions.length > 0 && (
              <div className="mt-10 rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm print:break-inside-avoid">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                  <History className="size-4 text-[#1a3d32]" />
                  Publiserte versjoner (arkiv)
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Hver publisering fryser forrige versjon for revisjon og tilsyn.
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {versions.map((v) => (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-100 pb-2 last:border-0"
                    >
                      <span className="font-medium text-neutral-800">
                        v{v.version} — {v.title}
                      </span>
                      <span className="text-xs text-neutral-500">{new Date(v.frozenAt).toLocaleString('no-NO')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </DocumentsModuleLayout>
  )
}
