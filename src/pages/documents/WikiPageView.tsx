import { useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Clock, History, Pencil } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { WikiBlockRenderer } from './WikiBlockRenderer'
import { AddTaskLink } from '../../components/tasks/AddTaskLink'

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
  const timeNow = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)

  const page = docs.pages.find((p) => p.id === pageId)
  const space = page ? docs.spaces.find((s) => s.id === page.spaceId) : null

  if (!page) return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 text-center text-neutral-500">
      Side ikke funnet. <Link to="/documents" className="text-[#1a3d32] underline">← Tilbake</Link>
    </div>
  )

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
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <Link to="/documents" className="hover:text-[#1a3d32]">Documents</Link>
        {space && (
          <>
            <span>›</span>
            <Link to={`/documents/space/${space.id}`} className="hover:text-[#1a3d32]">{space.title}</Link>
          </>
        )}
        <span>›</span>
        <span className="text-neutral-800">{page.title}</span>
      </nav>

      <div className={`${TEMPLATE_CLASS[page.template]} mx-auto`}>
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
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                page.status === 'published' ? 'bg-emerald-100 text-emerald-800'
                : page.status === 'draft' ? 'bg-amber-100 text-amber-800'
                : 'bg-neutral-200 text-neutral-600'
              }`}>
                {page.status === 'published' ? 'Publisert' : page.status === 'draft' ? 'Utkast' : 'Arkivert'}
              </span>
              {showSignBadge && alreadySigned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#1a3d32]/10 px-2.5 py-0.5 text-xs font-medium text-[#1a3d32]">
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
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    daysToDue != null && daysToDue < 0
                      ? 'bg-red-100 text-red-800'
                      : daysToDue != null && daysToDue <= 60
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  Neste revisjon: {new Date(page.nextRevisionDueAt).toLocaleDateString('no-NO')}
                </span>
              )}
              {page.legalRefs.map((r) => (
                <span key={r} className="rounded bg-[#1a3d32]/8 px-1.5 py-0.5 font-mono text-[#1a3d32]">{r}</span>
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
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Pencil className="size-3.5" />
            Rediger
          </button>
        </div>

        {/* Content */}
        <WikiBlockRenderer blocks={page.blocks} pageId={page.id} pageVersion={page.version} />

        {versions.length > 0 && (
          <div className="mt-10 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
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
    </div>
  )
}
