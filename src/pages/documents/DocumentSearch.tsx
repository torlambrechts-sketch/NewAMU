import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useDocumentCenter } from '../../hooks/useDocumentCenter'
import { stripHtmlForSearch } from '../../lib/wikiLinks'

export function DocumentSearch() {
  const { documents } = useDocumentCenter()
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return documents
      .filter((d) => {
        const blob = [
          d.title,
          d.category,
          d.tags.join(' '),
          d.lawRef ?? '',
          stripHtmlForSearch(d.currentHtml),
          stripHtmlForSearch(d.publishedHtml ?? ''),
        ]
          .join(' ')
          .toLowerCase()
        return blob.includes(t)
      })
      .slice(0, 50)
  }, [documents, q])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/documents" className="text-sm text-emerald-800 hover:underline">
        ← Bibliotek
      </Link>
      <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Søk i dokumenter</h1>
      <p className="text-sm text-neutral-600">Fulltekstsøk i tittel, metadata og innhold (utkast + publisert).</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Skriv søkeord…"
          className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-12 pr-4 text-lg"
          autoFocus
        />
      </div>
      <ul className="space-y-3">
        {results.map((doc) => (
          <li key={doc.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <Link to={`/documents/${doc.id}`} className="font-semibold text-[#2D403A] hover:underline">
              {doc.title}
            </Link>
            <p className="text-xs text-neutral-500">
              {doc.category} · {doc.workflowStatus}
            </p>
          </li>
        ))}
      </ul>
      {q.trim() && results.length === 0 ? (
        <p className="text-sm text-neutral-500">Ingen treff.</p>
      ) : null}
    </div>
  )
}
