import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileStack, Plus, Search } from 'lucide-react'
import { useDocumentCenter } from '../../hooks/useDocumentCenter'
import type { LibraryDocument } from '../../types/documents'

function statusLabel(s: LibraryDocument['workflowStatus']): string {
  switch (s) {
    case 'draft':
      return 'Utkast'
    case 'in_review':
      return 'Til godkjenning'
    case 'published':
      return 'Publisert'
    case 'archived':
      return 'Arkivert'
    default:
      return s
  }
}

function statusClass(s: LibraryDocument['workflowStatus']): string {
  switch (s) {
    case 'published':
      return 'bg-emerald-100 text-emerald-900'
    case 'in_review':
      return 'bg-amber-100 text-amber-900'
    case 'draft':
      return 'bg-neutral-100 text-neutral-800'
    case 'archived':
      return 'bg-neutral-200 text-neutral-600'
    default:
      return 'bg-neutral-100'
  }
}

export function DocumentLibrary() {
  const { documents, stats } = useDocumentCenter()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('all')

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (status !== 'all' && d.workflowStatus !== status) return false
      if (!q.trim()) return true
      const t = q.toLowerCase()
      return (
        d.title.toLowerCase().includes(t) ||
        d.category.toLowerCase().includes(t) ||
        d.tags.some((x) => x.toLowerCase().includes(t)) ||
        (d.lawRef?.toLowerCase().includes(t) ?? false)
      )
    })
  }, [documents, q, status])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Dokumentsenter</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Fase 1: bibliotek, versjoner, arbeidsflyt (utkast → godkjenning → publisert), eierskap og revisjonslogg.
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Ikke juridisk rådgivning — tilpass og verifiser mot{' '}
            <a href="https://lovdata.no" className="text-emerald-800 underline" target="_blank" rel="noreferrer">
              lovdata.no
            </a>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/documents/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[#2D403A] px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="size-4" />
            Nytt dokument
          </Link>
          <Link
            to="/documents/templates"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#2D403A]"
          >
            <FileStack className="size-4" />
            Fra mal
          </Link>
          <Link to="/documents/settings" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm text-[#2D403A]">
            Innstillinger
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div>
          <span className="text-xs font-medium text-neutral-500">Totalt</span>
          <p className="text-lg font-semibold text-[#2D403A]">{stats.total}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-neutral-500">Publisert</span>
          <p className="text-lg font-semibold text-emerald-800">{stats.published}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-neutral-500">Til godkjenning</span>
          <p className="text-lg font-semibold text-amber-800">{stats.review}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk i tittel, kategori, tagger, lovhenvisning…"
            className="w-full rounded-full border border-neutral-200 bg-white py-2 pl-10 pr-4 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Alle statuser</option>
          <option value="draft">Utkast</option>
          <option value="in_review">Til godkjenning</option>
          <option value="published">Publisert</option>
          <option value="archived">Arkivert</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-600">
              <th className="px-4 py-3 font-medium">Dokument</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium">Eier</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Versjon</th>
              <th className="px-4 py-3 text-right font-medium">Handling</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((d) => (
              <tr key={d.id} className="hover:bg-neutral-50/50">
                <td className="px-4 py-3">
                  <Link to={`/documents/${d.id}`} className="font-medium text-[#2D403A] hover:underline">
                    {d.title}
                  </Link>
                  {d.lawRef ? <div className="text-xs text-neutral-500 line-clamp-1">{d.lawRef}</div> : null}
                </td>
                <td className="px-4 py-3 text-neutral-700">{d.category}</td>
                <td className="px-4 py-3 text-neutral-700">{d.owner}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(d.workflowStatus)}`}>
                    {statusLabel(d.workflowStatus)}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {d.workflowStatus === 'published' ? `v${d.publishedVersionNumber}` : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/documents/${d.id}`} className="text-xs font-medium text-emerald-800 hover:underline">
                    Åpne
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen treff.</p>
        ) : null}
      </div>
    </div>
  )
}
