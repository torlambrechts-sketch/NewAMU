import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Loader2, Search, X } from 'lucide-react'
import { useWikiSpaces } from '../../hooks/useDocuments'

const STATUS_BADGE: Record<string, string> = {
  published: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  draft: 'border-amber-200 bg-amber-50 text-amber-800',
  archived: 'border-neutral-200 bg-neutral-100 text-neutral-600',
}

const STATUS_LABEL: Record<string, string> = {
  published: 'Publisert',
  draft: 'Utkast',
  archived: 'Arkivert',
}

export function DocumentsSearchBar() {
  const location = useLocation()
  const wiki = useWikiSpaces()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<
    { id: string; space_id: string; title: string; summary: string; status: string; updated_at: string }[]
  >([])
  const [err, setErr] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const inDocuments = location.pathname.startsWith('/documents')

  const runSearch = useCallback(
    async (term: string) => {
      if (!wiki.ready || !term.trim()) {
        setResults([])
        return
      }
      setLoading(true)
      setErr(null)
      try {
        const rows = await wiki.searchWikiPages(term)
        setResults(rows)
      } catch (e) {
        setResults([])
        setErr(e instanceof Error ? e.message : 'Søk feilet')
      } finally {
        setLoading(false)
      }
    },
    [wiki],
  )

  useEffect(() => {
    const t = window.setTimeout(() => {
      void runSearch(q)
    }, 280)
    return () => window.clearTimeout(t)
  }, [q, runSearch])

  useEffect(() => {
    if (!inDocuments) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inDocuments])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const el = rootRef.current
      if (el && e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!inDocuments || !wiki.ready) return null

  return (
    <div ref={rootRef} className="relative w-full max-w-md min-w-[200px]">
      <label className="sr-only" htmlFor="documents-global-search">
        Søk i dokumenter
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden />
        <input
          id="documents-global-search"
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Søk sider… (Ctrl+F)"
          className="w-full rounded-none border border-neutral-200 bg-white py-2 pl-9 pr-9 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
        />
        {q ? (
          <button
            type="button"
            onClick={() => {
              setQ('')
              setResults([])
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:bg-neutral-100"
            aria-label="Tøm"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      {open && (q.trim() || results.length > 0 || loading || err) ? (
        <div className="absolute right-0 z-[120] mt-1 max-h-[min(70vh,420px)] w-[min(100vw-2rem,28rem)] overflow-y-auto rounded-lg border border-neutral-200 bg-white py-2 shadow-xl">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Søker…
            </div>
          ) : err ? (
            <p className="px-3 py-2 text-sm text-red-700">{err}</p>
          ) : !q.trim() ? (
            <p className="px-3 py-2 text-xs text-neutral-500">Skriv for å søke i tittel og beskrivelse.</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-neutral-600">Ingen treff.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {Object.entries(
                results.reduce<Record<string, typeof results>>((acc, row) => {
                  const sid = row.space_id
                  if (!acc[sid]) acc[sid] = []
                  acc[sid].push(row)
                  return acc
                }, {}),
              ).map(([spaceId, rows]) => {
                const sp = wiki.spaces.find((s) => s.id === spaceId)
                return (
                  <li key={spaceId} className="px-2 py-2">
                    <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      {sp?.title ?? 'Ukjent mappe'}
                    </p>
                    <ul className="space-y-0.5">
                      {rows.map((r) => (
                        <li key={r.id}>
                          <Link
                            to={`/documents/page/${r.id}`}
                            onClick={() => {
                              setOpen(false)
                              setQ('')
                            }}
                            className="flex items-start gap-2 rounded px-2 py-2 hover:bg-neutral-50"
                          >
                            <span
                              className={`mt-0.5 shrink-0 rounded-none border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                STATUS_BADGE[r.status] ?? STATUS_BADGE.draft
                              }`}
                            >
                              {STATUS_LABEL[r.status] ?? r.status}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-neutral-900">{r.title}</span>
                              {r.summary ? (
                                <span className="mt-0.5 line-clamp-2 block text-xs text-neutral-500">{r.summary}</span>
                              ) : null}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
