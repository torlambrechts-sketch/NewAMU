import { useMemo, useState, useSyncExternalStore } from 'react'
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
} from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { PIN_GREEN } from '../../components/learning/LearningLayout'

const STATUS_LABEL = { published: 'Publisert', draft: 'Utkast', archived: 'Arkivert' }

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 60_000)
  return () => window.clearInterval(id)
}
function getClockSnapshot() {
  return Date.now()
}

export function WikiSpaceView() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const navigate = useNavigate()
  const docs = useDocuments()
  const { can } = useOrgSetupContext()
  const canManage = can('documents.manage')
  const timeNow = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot)

  const [newTitle, setNewTitle] = useState('')
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [urlTitle, setUrlTitle] = useState('')
  const [urlHref, setUrlHref] = useState('')
  const [busy, setBusy] = useState(false)

  const space = docs.spaces.find((s) => s.id === spaceId)
  const itemsInSpace = useMemo(
    () => docs.spaceItems.filter((i) => i.spaceId === spaceId),
    [docs.spaceItems, spaceId],
  )

  const pages = docs.pages
    .filter((p) => p.spaceId === spaceId)
    .filter((p) => filter === 'all' || p.status === filter)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  if (!space) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-center text-neutral-500">
        Mappe ikke funnet. <Link to="/documents" className="text-[#1a3d32] underline">← Tilbake</Link>
      </div>
    )
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !spaceId) return
    const page = await docs.createPage(spaceId, newTitle)
    setNewTitle('')
    navigate(`/documents/page/${page.id}/edit`)
  }

  async function handleAddUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!spaceId || !urlTitle.trim() || !urlHref.trim()) return
    setBusy(true)
    try {
      await docs.addSpaceUrl(spaceId, urlTitle, urlHref)
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
      await docs.uploadSpaceFile(spaceId, f)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link to="/documents" className="hover:text-[#1a3d32]">Documents</Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-neutral-800">{space.title}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="flex items-start gap-3">
          <span className="mt-1 text-3xl">{space.icon}</span>
          <div>
            <h1
              className="text-2xl font-semibold text-neutral-900"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              {space.title}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">{space.description}</p>
          </div>
        </div>
      </div>

      {/* New page */}
      <form onSubmit={(e) => void handleCreate(e)} className="mb-6 flex flex-wrap gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <FilePlus className="mt-2.5 size-4 shrink-0 text-neutral-400" />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Ny wiki-side — tittel"
          required
          className="min-w-[240px] flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
        />
        <button type="submit" className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]">
          Opprett
        </button>
      </form>

      {/* Files & URLs — all members can add when connected to Supabase */}
      {docs.backend === 'supabase' && (
        <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-800">Filer og lenker i mappen</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Last opp filer eller legg til eksterne referanser sammen med wiki-sider.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100">
              <Upload className="size-4" />
              Last opp fil
              <input type="file" className="hidden" onChange={(e) => void handleUpload(e)} disabled={busy} />
            </label>
          </div>
          <form onSubmit={(e) => void handleAddUrl(e)} className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
            <input
              value={urlTitle}
              onChange={(e) => setUrlTitle(e.target.value)}
              placeholder="Tittel på referanse"
              className="min-w-[160px] flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
            <input
              value={urlHref}
              onChange={(e) => setUrlHref(e.target.value)}
              placeholder="https://…"
              type="url"
              className="min-w-[200px] flex-[2] rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] disabled:opacity-40"
            >
              <Link2 className="size-4" />
              Legg til URL
            </button>
          </form>

          {itemsInSpace.length > 0 && (
            <ul className="mt-4 divide-y divide-neutral-100 rounded-lg border border-neutral-100">
              {itemsInSpace.map((it) => (
                <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    {it.kind === 'url' ? (
                      <ExternalLink className="size-4 shrink-0 text-[#1a3d32]" />
                    ) : (
                      <FileText className="size-4 shrink-0 text-neutral-500" />
                    )}
                    <span className="truncate font-medium text-neutral-800">{it.title}</span>
                    {it.kind === 'url' && it.url && (
                      <a href={it.url} target="_blank" rel="noreferrer" className="truncate text-xs text-[#1a3d32] underline">
                        {it.url}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {it.kind === 'file' && (
                      <button
                        type="button"
                        className="rounded p-1.5 text-[#1a3d32] hover:bg-neutral-100"
                        title="Åpne / last ned"
                        onClick={() => {
                          void (async () => {
                            const u = await docs.getSpaceFileUrl(it)
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
                        onClick={() => { if (confirm('Fjerne elementet?')) void docs.deleteSpaceItem(it) }}
                        className="rounded p-1.5 text-red-400 hover:bg-red-50"
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

      {/* Filters */}
      <div className="mb-4 flex gap-2">
        {(['all', 'published', 'draft'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === f ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
          >
            {f === 'all' ? 'Alle' : f === 'published' ? 'Publisert' : 'Utkast'}
          </button>
        ))}
      </div>

      {/* Page cards — same visual language as e-learning course grid */}
      {pages.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center text-sm text-neutral-500 shadow-sm">
          Ingen sider ennå — opprett en side eller bruk en mal fra forsiden.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {pages.map((p) => {
            const due = p.nextRevisionDueAt ? new Date(p.nextRevisionDueAt) : null
            const days = due ? Math.ceil((due.getTime() - timeNow) / (24 * 60 * 60 * 1000)) : null
            const revisionWarn = due != null && days != null && days <= 60

            return (
              <article
                key={p.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative h-28 shrink-0 bg-gradient-to-br from-[#1a3d32] via-[#234d3f] to-[#2f6b52]">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1a3d32]/95 to-[#143528] opacity-95" />
                  <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#1a3d32]">
                    {STATUS_LABEL[p.status]}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <Link
                    to={`/documents/page/${p.id}`}
                    className="font-serif text-lg font-semibold leading-snug text-[#1a3d32] hover:underline"
                  >
                    {p.title}
                  </Link>
                  {p.summary && <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{p.summary}</p>}

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="size-3.5 shrink-0" style={{ color: PIN_GREEN }} />
                      v{p.version}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5 shrink-0" style={{ color: PIN_GREEN }} />
                      {new Date(p.updatedAt).toLocaleDateString('no-NO')}
                    </span>
                  </div>

                  {p.nextRevisionDueAt && (
                    <div
                      className={`mt-3 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                        days != null && days < 0
                          ? 'bg-red-50 text-red-900'
                          : revisionWarn
                            ? 'bg-amber-50 text-amber-950'
                            : 'bg-neutral-50 text-neutral-700'
                      }`}
                    >
                      Neste revideringsdato: {new Date(p.nextRevisionDueAt).toLocaleDateString('no-NO')}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-1 border-t border-neutral-100 pt-3">
                    {p.legalRefs.slice(0, 3).map((r) => (
                      <span key={r} className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">{r}</span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-1 border-t border-neutral-100 pt-3">
                    {p.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => void docs.publishPage(p.id)}
                        title="Publiser"
                        className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="size-4" />
                      </button>
                    )}
                    <Link to={`/documents/page/${p.id}`} title="Forhåndsvis" className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100">
                      <Eye className="size-4" />
                    </Link>
                    <Link to={`/documents/page/${p.id}/edit`} title="Rediger" className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100">
                      <Pencil className="size-4" />
                    </Link>
                    {p.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => void docs.archivePage(p.id)}
                        title="Arkiver"
                        className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
                      >
                        <Archive className="size-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { if (confirm('Slett siden?')) void docs.deletePage(p.id) }}
                      title="Slett"
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
