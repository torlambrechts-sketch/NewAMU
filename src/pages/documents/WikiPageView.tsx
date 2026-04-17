import { useEffect, useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Clock, History, Loader2, Pencil } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { WikiBlockRenderer } from './WikiBlockRenderer'
import { AddTaskLink } from '../../components/tasks/AddTaskLink'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'

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

export function WikiPageView() {
  const { pageId } = useParams<{ pageId: string }>()
  const navigate = useNavigate()
  const docs = useDocuments()
  const { ensurePageLoaded, pageHydrateLoading, pageHydrateError } = docs
  const timeNow = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)

  const page = docs.pages.find((p) => p.id === pageId)
  const space = page ? docs.spaces.find((s) => s.id === page.spaceId) : null

  useEffect(() => {
    void ensurePageLoaded(pageId)
  }, [ensurePageLoaded, pageId])

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

  if ((docs.loading || pageHydrateLoading) && !page) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-neutral-600">
        <Loader2 className="size-8 animate-spin text-[#1a3d32]" aria-hidden />
        <p className="text-sm">Laster dokument…</p>
      </div>
    )
  }

  if (docs.error && !page) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{docs.error}</p>
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

  const alreadySigned = docs.hasAcknowledged(page.id, page.version)
  const showSignBadge =
    page.requiresAcknowledgement && docs.acknowledgementRequiredForMe(page)
  const versions = docs.versionsForPage(page.id)
  const due = page.nextRevisionDueAt ? new Date(page.nextRevisionDueAt) : null
  const daysToDue = due
    ? Math.ceil((due.getTime() - timeNow) / (24 * 60 * 60 * 1000))
    : null
  const revisionSoon = due != null && daysToDue != null && daysToDue <= 60

  return (
    <DocumentsModuleLayout
      subHeader={
        <nav className="mt-6 flex flex-wrap items-center gap-2 border-b border-neutral-200/80 pb-6 text-sm text-neutral-600">
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
      <div className={`${TEMPLATE_CLASS[templateKey]} mx-auto mt-6`}>
        {/* Page header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-2xl font-bold text-neutral-900 md:text-3xl"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                {page.title}
              </h1>
              <span className={`rounded-none border px-2.5 py-0.5 text-xs font-semibold uppercase ${
                page.status === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : page.status === 'draft' ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-neutral-200 bg-neutral-100 text-neutral-600'
              }`}>
                {page.status === 'published' ? 'Publisert' : page.status === 'draft' ? 'Utkast' : 'Arkivert'}
              </span>
              {showSignBadge && alreadySigned && (
                <span className="inline-flex items-center gap-1 rounded-none border border-[#1a3d32]/30 bg-[#1a3d32]/10 px-2.5 py-0.5 text-xs font-medium text-[#1a3d32]">
                  <CheckCircle2 className="size-3.5" /> Signert
                </span>
              )}
            </div>
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
              <div className="mt-3 flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={() => navigate(`/documents/page/${page.id}/edit`)}
            className="inline-flex items-center gap-1.5 rounded-none border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
          >
            <Pencil className="size-3.5" />
            Rediger
          </button>
        </div>

        {/* Content */}
        <WikiBlockRenderer
          blocks={Array.isArray(page.blocks) ? page.blocks : []}
          pageId={page.id}
          pageVersion={page.version}
          lang={page.lang ?? 'nb'}
        />

        {versions.length > 0 && (
          <div className="mt-10 rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
              <History className="size-4 text-[#1a3d32]" />
              Publiserte versjoner (arkiv)
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Hver publisering fryser forrige versjon for revisjon og tilsyn.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-100 pb-2 last:border-0">
                  <span className="font-medium text-neutral-800">
                    v{v.version} — {v.title}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {new Date(v.frozenAt).toLocaleString('no-NO')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DocumentsModuleLayout>
  )
}
