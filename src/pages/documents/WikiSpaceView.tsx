import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, CheckCircle2, Eye, FilePlus, Pencil, Trash2 } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'

const STATUS_STYLE = {
  published: 'bg-emerald-100 text-emerald-800',
  draft: 'bg-amber-100 text-amber-800',
  archived: 'bg-neutral-200 text-neutral-600',
}
const STATUS_LABEL = { published: 'Publisert', draft: 'Utkast', archived: 'Arkivert' }

export function WikiSpaceView() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const navigate = useNavigate()
  const docs = useDocuments()
  const [newTitle, setNewTitle] = useState('')
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')

  const space = docs.spaces.find((s) => s.id === spaceId)
  const pages = docs.pages
    .filter((p) => p.spaceId === spaceId)
    .filter((p) => filter === 'all' || p.status === filter)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  if (!space) return (
    <div className="mx-auto max-w-[1400px] px-4 py-12 text-center text-neutral-500">
      Mappe ikke funnet. <Link to="/documents" className="text-[#1a3d32] underline">← Tilbake</Link>
    </div>
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !spaceId) return
    const page = await docs.createPage(spaceId, newTitle)
    setNewTitle('')
    navigate(`/documents/page/${page.id}/edit`)
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
            <h1 className="text-2xl font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              {space.title}
            </h1>
            <p className="mt-1 text-sm text-neutral-600">{space.description}</p>
          </div>
        </div>
      </div>

      {/* New page form */}
      <form onSubmit={handleCreate} className="mb-6 flex flex-wrap gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <FilePlus className="mt-2.5 size-4 shrink-0 text-neutral-400" />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Ny side — tittel"
          required
          className="min-w-[240px] flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
        />
        <button type="submit" className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]">
          Opprett
        </button>
      </form>

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

      {/* Page list */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        {pages.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-neutral-500">Ingen sider ennå — opprett en side eller bruk en mal fra forsiden.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/80 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Tittel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Versjon</th>
                <th className="px-4 py-3">Sist oppdatert</th>
                <th className="px-4 py-3">Hjemmel</th>
                <th className="px-4 py-3 text-right">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pages.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50/50">
                  <td className="px-4 py-3">
                    <Link to={`/documents/page/${p.id}`} className="font-medium text-[#1a3d32] hover:underline">
                      {p.title}
                    </Link>
                    {p.requiresAcknowledgement && (
                      <span className="ml-2 rounded-full bg-[#1a3d32]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#1a3d32]">Sign</span>
                    )}
                    {p.summary && <div className="mt-0.5 text-xs text-neutral-500 line-clamp-1">{p.summary}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">v{p.version}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {new Date(p.updatedAt).toLocaleDateString('no-NO')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.legalRefs.slice(0, 2).map((r) => (
                        <span key={r} className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[10px] text-neutral-600">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
