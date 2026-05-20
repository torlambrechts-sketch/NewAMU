import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, History, MessageCircleQuestion, Search } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useDocumentSearch } from '../../hooks/useDocumentSearch'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { StandardInput } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import type { PageStatus } from '../../types/documents'

/**
 * Dokumenter — Søk & oppslag (`/documents/sok`).
 *
 * Rebuilt from the Claude Design "Rec10" artboard — hero search over the
 * `search_wiki_pages` full-text RPC, status/space facets, and a recent-search
 * list. The Klarert AI answer card is a later sprint (S11).
 */

const STATUS_LABEL: Record<PageStatus, string> = {
  published: 'Publisert',
  draft: 'Kladd',
  archived: 'Arkivert',
}

const RECENT_KEY = 'klarert.documents.recentSearches'

function readRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}

export function DocumentsSokPage() {
  const docs = useDocuments()
  const { supabase, organization } = useOrgSetupContext()
  const navigate = useNavigate()
  const { query, setQuery, results, loading, error } = useDocumentSearch(supabase, organization?.id)

  const [statusFacet, setStatusFacet] = useState<PageStatus | ''>('')
  const [spaceFacet, setSpaceFacet] = useState('')
  const [recent, setRecent] = useState<string[]>(readRecent)

  const spaceById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of docs.spaces) map.set(s.id, s.title)
    return map
  }, [docs.spaces])

  // Persist the query as a recent search once results land for it.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2 || results.length === 0) return
    const id = window.setTimeout(() => {
      setRecent((prev) => {
        const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(0, 6)
        try {
          window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
        } catch {
          /* quota */
        }
        return next
      })
    }, 1200)
    return () => window.clearTimeout(id)
  }, [query, results.length])

  const filtered = useMemo(
    () =>
      results.filter((r) => {
        if (statusFacet && r.status !== statusFacet) return false
        if (spaceFacet && r.spaceId !== spaceFacet) return false
        return true
      }),
    [results, statusFacet, spaceFacet],
  )

  const statusFacetCounts = useMemo(() => {
    const counts: Record<PageStatus, number> = { published: 0, draft: 0, archived: 0 }
    for (const r of results) counts[r.status] += 1
    return counts
  }, [results])

  const spaceFacetCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of results) map.set(r.spaceId, (map.get(r.spaceId) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [results])

  const hasQuery = query.trim().length >= 2

  return (
    <div className="space-y-4">
      {/* Hero search */}
      <ModuleSectionCard className="!p-0 overflow-hidden">
        <div className="bg-gradient-to-b from-[#f1f6f5] to-white px-6 pb-5 pt-6">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-neutral-900">
            Hva leter du etter?
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Søk på tvers av {docs.pages.length} dokumenter og wiki-sider — tittel, sammendrag og innhold.
          </p>
          <div className="mt-4">
            <div className="flex items-center gap-2 rounded-xl border-2 border-[#0f766e] bg-white px-4 py-2.5 shadow-sm">
              <Search className="h-5 w-5 text-[#0f766e]" aria-hidden />
              <StandardInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="!border-0 !px-0 !text-base !shadow-none focus:!ring-0"
                placeholder="Søk i rutiner, prosedyrer og lovverk…"
              />
            </div>
          </div>
        </div>
      </ModuleSectionCard>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        {/* Results */}
        <ModuleSectionCard className="!p-0">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-neutral-900">
              {hasQuery ? `${filtered.length} treff` : 'Resultater'}
            </h3>
            {loading ? <span className="text-[11px] text-neutral-500">Søker…</span> : null}
          </div>
          {error ? <p className="px-5 py-4 text-sm text-red-700">{error}</p> : null}
          {!hasQuery ? (
            <p className="px-5 py-12 text-center text-sm text-neutral-500">
              Skriv minst to tegn for å søke.
            </p>
          ) : filtered.length === 0 && !loading ? (
            <p className="px-5 py-12 text-center text-sm text-neutral-500">
              Ingen treff på «{query.trim()}».
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {filtered.map((r) => (
                <li key={r.id}>
                  <Button
                    variant="ghost"
                    className="flex w-full items-start gap-3 rounded-none px-5 py-4 text-left font-normal hover:bg-neutral-50"
                    onClick={() => navigate(`/documents/page/${r.id}`)}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100">
                      <BookOpen className="h-4 w-4 text-neutral-600" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-neutral-900">{r.title}</span>
                        <Badge variant={r.status === 'published' ? 'success' : r.status === 'draft' ? 'draft' : 'neutral'}>
                          {STATUS_LABEL[r.status]}
                        </Badge>
                      </span>
                      <span className="block text-[11px] text-neutral-500">
                        {spaceById.get(r.spaceId) ?? 'Dokument'}
                      </span>
                      {r.summary ? (
                        <span className="mt-1 block text-[13px] text-neutral-700">{r.summary}</span>
                      ) : null}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ModuleSectionCard>

        {/* Facets + recent */}
        <div className="space-y-4">
          <ModuleSectionCard className="!p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Filtrer på</p>
            <p className="mt-3 text-[11px] font-semibold text-neutral-700">Status</p>
            <ul className="mt-1.5 space-y-1 text-[12px]">
              {(['published', 'draft', 'archived'] as PageStatus[]).map((st) => (
                <li key={st}>
                  <Button
                    variant="ghost"
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left font-normal ${
                      statusFacet === st ? 'bg-[#e6f2f0] text-[#0f766e]' : 'text-neutral-700'
                    }`}
                    onClick={() => setStatusFacet((prev) => (prev === st ? '' : st))}
                  >
                    <span>{STATUS_LABEL[st]}</span>
                    <span className="tabular-nums text-neutral-400">{statusFacetCounts[st]}</span>
                  </Button>
                </li>
              ))}
            </ul>
            {spaceFacetCounts.length > 0 ? (
              <>
                <p className="mt-3 text-[11px] font-semibold text-neutral-700">Mappe</p>
                <ul className="mt-1.5 space-y-1 text-[12px]">
                  {spaceFacetCounts.slice(0, 6).map(([sid, count]) => (
                    <li key={sid}>
                      <Button
                        variant="ghost"
                        className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left font-normal ${
                          spaceFacet === sid ? 'bg-[#e6f2f0] text-[#0f766e]' : 'text-neutral-700'
                        }`}
                        onClick={() => setSpaceFacet((prev) => (prev === sid ? '' : sid))}
                      >
                        <span className="truncate">{spaceById.get(sid) ?? 'Mappe'}</span>
                        <span className="tabular-nums text-neutral-400">{count}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </ModuleSectionCard>

          {recent.length > 0 ? (
            <ModuleSectionCard className="!p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Nylige søk</p>
              <ul className="mt-2 space-y-1 text-[12px]">
                {recent.map((q) => (
                  <li key={q}>
                    <Button
                      variant="ghost"
                      className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-normal text-neutral-600"
                      onClick={() => setQuery(q)}
                    >
                      <History className="h-3 w-3 text-neutral-400" aria-hidden />
                      <span className="truncate">{q}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </ModuleSectionCard>
          ) : (
            <ModuleSectionCard className="!p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Tips</p>
              <p className="mt-2 flex items-start gap-1.5 text-[12px] text-neutral-600">
                <MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                Søk på lov-anker (f.eks. «IK § 5»), eier eller stikkord. Nylige søk lagres her.
              </p>
            </ModuleSectionCard>
          )}
        </div>
      </div>
    </div>
  )
}
