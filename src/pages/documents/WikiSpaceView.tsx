import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FilePlus,
  FileText,
  Link2,
  Pencil,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useWikiPages, useWikiSpaces } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import { DocumentsModuleLayout } from '../../components/documents/DocumentsModuleLayout'

const STATUS_LABEL = { published: 'Publisert', draft: 'Utkast', archived: 'Arkivert' }

const BTN_PRIMARY =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-4 text-sm font-medium text-white hover:bg-[#142e26]'
const BTN_OUTLINE =
  'inline-flex h-10 items-center justify-center gap-2 rounded-none border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50'
const INPUT =
  'rounded-none border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]'
const CARD = 'rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm'

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 60_000)
  return () => window.clearInterval(id)
}
function getClockSnapshot() {
  return Date.now()
}

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [active])
}

export function WikiSpaceView() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const navigate = useNavigate()
  const wiki = useWikiSpaces()
  const spacePages = useWikiPages(spaceId)
  const { can } = useOrgSetupContext()
  const canManage = can('documents.manage')
  const timeNow = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)

  const [newTitle, setNewTitle] = useState('')
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [urlTitle, setUrlTitle] = useState('')
  const [urlHref, setUrlHref] = useState('')
  const [busy, setBusy] = useState(false)
  const [newPageOpen, setNewPageOpen] = useState(false)
  const [filesPanelOpen, setFilesPanelOpen] = useState(false)
  const [panelPageId, setPanelPageId] = useState<string | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)

  const space = wiki.spaces.find((s) => s.id === spaceId)
  const itemsInSpace = useMemo(
    () => wiki.spaceItems.filter((i) => i.spaceId === spaceId),
    [wiki.spaceItems, spaceId],
  )

  const pages = spacePages.pages
    .filter((p) => filter === 'all' || p.status === filter)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const panelPage = panelPageId ? spacePages.pages.find((p) => p.id === panelPageId) ?? null : null

  const anyOverlayOpen = newPageOpen || filesPanelOpen || Boolean(panelPageId)
  useBodyScrollLock(anyOverlayOpen)

  useEffect(() => {
    if (!anyOverlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNewPageOpen(false)
        setFilesPanelOpen(false)
        setPanelPageId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anyOverlayOpen])

  if (!space) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center text-neutral-500">
        Mappe ikke funnet.{' '}
        <Link to="/documents" className="text-[#1a3d32] underline">
          ← Tilbake
        </Link>
      </div>
    )
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !spaceId) return
    const page = await spacePages.createPage(newTitle)
    setNewTitle('')
    setNewPageOpen(false)
    navigate(`/documents/page/${page.id}/edit`)
  }

  async function handleAddUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!spaceId || !urlTitle.trim() || !urlHref.trim()) return
    setBusy(true)
    try {
      await wiki.addSpaceUrl(spaceId, urlTitle, urlHref)
      setUrlTitle('')
      setUrlHref('')
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f || !spaceId) return
    setBusy(true)
    try {
      await wiki.uploadSpaceFile(spaceId, f)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const revisionMeta = (p: (typeof pages)[0]) => {
    const due = p.nextRevisionDueAt ? new Date(p.nextRevisionDueAt) : null
    const days = due ? Math.ceil((due.getTime() - timeNow) / (24 * 60 * 60 * 1000)) : null
    const revisionWarn = due != null && days != null && days <= 60
    return { due, days, revisionWarn }
  }

  return (
    <DocumentsModuleLayout
      subHeader={
        <div className="mt-6 flex flex-col gap-3 border-b border-neutral-200/80 pb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="text-2xl">{space.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Aktiv mappe</p>
              <h2 className="font-serif text-xl font-semibold text-neutral-900">{space.title}</h2>
              <p className="mt-1 text-sm text-neutral-600">{space.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {wiki.ready && (
              <button type="button" onClick={() => setFilesPanelOpen(true)} className={BTN_OUTLINE}>
                <Upload className="size-4 shrink-0" aria-hidden />
                Filer og lenker
              </button>
            )}
            <button type="button" onClick={() => setNewPageOpen(true)} className={BTN_PRIMARY}>
              <FilePlus className="size-4 shrink-0" aria-hidden />
              Ny side
            </button>
          </div>
        </div>
      }
    >
      <div className="mb-4 mt-6 flex flex-wrap gap-2">
        {(['all', 'published', 'draft'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-none border px-3 py-2 text-xs font-medium ${
              filter === f
                ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
            }`}
          >
            {f === 'all' ? 'Alle' : f === 'published' ? 'Publisert' : 'Utkast'}
          </button>
        ))}
      </div>

      {pages.length === 0 ? (
        <p className={`${CARD} px-4 py-12 text-center text-sm text-neutral-500`}>
          Ingen sider ennå — trykk «Ny side» eller bruk en mal fra oversikten.
        </p>
      ) : (
        <div className="overflow-hidden rounded-none border border-neutral-200/90 bg-white shadow-sm">
          <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-neutral-900">Sider i mappen</h2>
            <p className="text-xs text-neutral-500">Klikk en rad for å åpne detaljer og handlinger.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Tittel</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Versjon</th>
                  <th className="px-4 py-3">Oppdatert</th>
                  <th className="px-4 py-3">Revisjon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {pages.map((p) => {
                  const { due, days, revisionWarn } = revisionMeta(p)
                  return (
                    <tr
                      key={p.id}
                      className="cursor-pointer transition-colors hover:bg-neutral-50"
                      onClick={() => setPanelPageId(p.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-[#1a3d32]">{p.title}</span>
                        {p.summary && <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{p.summary}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-none border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700">
                          {STATUS_LABEL[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">v{p.version}</td>
                      <td className="px-4 py-3 text-xs text-neutral-600">
                        {new Date(p.updatedAt).toLocaleDateString('no-NO')}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {!p.nextRevisionDueAt ? (
                          <span className="text-neutral-400">—</span>
                        ) : (
                          <span
                            className={
                              days != null && days < 0
                                ? 'font-medium text-red-800'
                                : revisionWarn
                                  ? 'font-medium text-amber-800'
                                  : 'text-neutral-600'
                            }
                          >
                            {due!.toLocaleDateString('no-NO')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {anyOverlayOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <button
            type="button"
            aria-label="Lukk"
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setNewPageOpen(false)
              setFilesPanelOpen(false)
              setPanelPageId(null)
            }}
          />
          <div
            ref={panelRef}
            className="relative flex h-full w-full max-w-lg flex-col border-l border-neutral-200 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">
                {newPageOpen
                  ? 'Ny wiki-side'
                  : filesPanelOpen
                    ? 'Filer og lenker'
                    : panelPage
                      ? panelPage.title
                      : 'Detaljer'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setNewPageOpen(false)
                  setFilesPanelOpen(false)
                  setPanelPageId(null)
                }}
                className="rounded-none p-2 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {newPageOpen && (
                <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
                  <p className="text-sm text-neutral-600">Opprett en tom side og gå rett til redigering.</p>
                  <div>
                    <label className="text-xs font-medium text-neutral-500">Tittel</label>
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Tittel på siden"
                      required
                      className={`${INPUT} mt-1 w-full`}
                    />
                  </div>
                  <button type="submit" className={BTN_PRIMARY}>
                    Opprett og rediger
                  </button>
                </form>
              )}

              {filesPanelOpen && wiki.ready && (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Last opp filer eller legg til eksterne referanser i denne mappen.
                  </p>
                  <label className={`${BTN_OUTLINE} cursor-pointer`}>
                    <Upload className="size-4 shrink-0" aria-hidden />
                    Last opp fil
                    <input type="file" className="hidden" onChange={(e) => void handleUpload(e)} disabled={busy} />
                  </label>
                  <form onSubmit={(e) => void handleAddUrl(e)} className="space-y-2 border-t border-neutral-100 pt-4">
                    <input
                      value={urlTitle}
                      onChange={(e) => setUrlTitle(e.target.value)}
                      placeholder="Tittel på referanse"
                      className={`${INPUT} w-full`}
                    />
                    <input
                      value={urlHref}
                      onChange={(e) => setUrlHref(e.target.value)}
                      placeholder="https://…"
                      type="url"
                      className={`${INPUT} w-full`}
                    />
                    <button type="submit" disabled={busy} className={BTN_PRIMARY}>
                      <Link2 className="size-4 shrink-0" aria-hidden />
                      Legg til URL
                    </button>
                  </form>
                  {itemsInSpace.length > 0 && (
                    <ul className="divide-y divide-neutral-100 rounded-none border border-neutral-200">
                      {itemsInSpace.map((it) => (
                        <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            {it.kind === 'url' ? (
                              <ExternalLink className="size-4 shrink-0 text-[#1a3d32]" />
                            ) : (
                              <FileText className="size-4 shrink-0 text-neutral-500" />
                            )}
                            <span className="truncate font-medium text-neutral-800">{it.title}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {it.kind === 'file' && (
                              <button
                                type="button"
                                className="rounded-none p-1.5 text-[#1a3d32] hover:bg-neutral-100"
                                title="Åpne / last ned"
                                onClick={() => {
                                  void (async () => {
                                    const u = await wiki.getSpaceFileUrl(it)
                                    if (u) window.open(u, '_blank', 'noopener,noreferrer')
                                  })()
                                }}
                              >
                                <ExternalLink className="size-4" />
                              </button>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('Fjerne elementet?')) void wiki.deleteSpaceItem(it)
                                }}
                                className="rounded-none p-1.5 text-red-400 hover:bg-red-50"
                                title="Slett"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {panelPage && !newPageOpen && !filesPanelOpen && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-none border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium">
                      {STATUS_LABEL[panelPage.status]}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-600">
                      <BookOpen className="size-3.5 shrink-0" style={{ color: PIN_GREEN }} />v{panelPage.version}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-600">
                      <Clock className="size-3.5 shrink-0" style={{ color: PIN_GREEN }} />
                      {new Date(panelPage.updatedAt).toLocaleDateString('no-NO')}
                    </span>
                  </div>
                  {panelPage.summary && <p className="text-sm text-neutral-600">{panelPage.summary}</p>}
                  {panelPage.nextRevisionDueAt && (
                    <p className="text-xs text-neutral-600">
                      Neste revisjon:{' '}
                      <strong>{new Date(panelPage.nextRevisionDueAt).toLocaleDateString('no-NO')}</strong>
                    </p>
                  )}
                  {panelPage.legalRefs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {panelPage.legalRefs.slice(0, 6).map((r) => (
                        <span key={r} className="rounded-none bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4">
                    <Link to={`/documents/page/${panelPage.id}`} className={`${BTN_OUTLINE} w-full justify-center`}>
                      <Eye className="size-4 shrink-0" aria-hidden />
                      Forhåndsvis
                    </Link>
                    <Link to={`/documents/page/${panelPage.id}/edit`} className={`${BTN_PRIMARY} w-full justify-center`}>
                      <Pencil className="size-4 shrink-0" aria-hidden />
                      Rediger
                    </Link>
                    {panelPage.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => void spacePages.publishPage(panelPage.id)}
                        className={`${BTN_OUTLINE} w-full justify-center text-emerald-800`}
                      >
                        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                        Publiser
                      </button>
                    )}
                    {panelPage.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => void spacePages.archivePage(panelPage.id)}
                        className={`${BTN_OUTLINE} w-full justify-center`}
                      >
                        <Archive className="size-4 shrink-0" aria-hidden />
                        Arkiver
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Slett siden?')) void spacePages.deletePage(panelPage.id)
                        setPanelPageId(null)
                      }}
                      className="rounded-none border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
                    >
                      <Trash2 className="mr-2 inline size-4 align-text-bottom" aria-hidden />
                      Slett
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DocumentsModuleLayout>
  )
}
