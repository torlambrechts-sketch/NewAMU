import { useEffect, useId, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Loader2, Search } from 'lucide-react'
import { StandardInput } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { useDocumentSearch } from '../../hooks/useDocumentSearch'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { WikiDocumentSearchResult } from '../../types/documents'

function statusBadgeVariant(s: WikiDocumentSearchResult['status']): 'success' | 'draft' | 'neutral' {
  if (s === 'published') return 'success'
  if (s === 'draft') return 'draft'
  return 'neutral'
}

const STATUS_LABEL: Record<WikiDocumentSearchResult['status'], string> = {
  published: 'Publisert',
  draft: 'Utkast',
  archived: 'Arkivert',
}

export type DocumentSearchModalProps = {
  open: boolean
  onClose: () => void
}

export function DocumentSearchModal({ open, onClose }: DocumentSearchModalProps) {
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()
  const docs = useDocuments()
  const { query, setQuery, results, loading, error, clear } = useDocumentSearch(supabase, organization?.id)
  const titleId = useId()
  const inputWrapRef = useRef<HTMLDivElement>(null)

  const spaceTitleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of docs.spaces) m.set(s.id, s.title)
    return m
  }, [docs.spaces])

  useEffect(() => {
    if (!open) return
    clear()
    const t = window.setTimeout(() => {
      inputWrapRef.current?.querySelector('input')?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [open, clear])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function handlePick(r: WikiDocumentSearchResult) {
    navigate(`/documents/page/${r.id}`)
    onClose()
    clear()
  }

  const trimmed = query.trim()
  const showEmpty = trimmed.length >= 2 && !loading && !error && results.length === 0

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <div className="border-b border-neutral-100 px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold text-neutral-900">
            Søk i dokumenter
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">Ctrl+K eller Cmd+K — minst to tegn</p>
        </div>
        <div className="p-4">
          <div ref={inputWrapRef} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <StandardInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søk i tittel, beskrivelse og innhold…"
              className="pl-9"
              aria-describedby={`${titleId}-hint`}
            />
          </div>
          <p id={`${titleId}-hint`} className="mt-2 text-[11px] text-neutral-400">
            Kun dokumenter du har tilgang til vises (serverkontroll).
          </p>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          {loading ? (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-neutral-600">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Søker…
            </div>
          ) : null}
          {!loading && showEmpty ? (
            <p className="mt-6 text-center text-sm text-neutral-600">
              Ingen resultater for &quot;{trimmed}&quot;
            </p>
          ) : null}
          {!loading && results.length > 0 ? (
            <ul className="mt-4 max-h-[50vh] space-y-1 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(r)}
                    className="flex w-full flex-col gap-1 rounded-lg border border-transparent px-3 py-2.5 text-left hover:border-neutral-200 hover:bg-neutral-50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">{r.title}</span>
                      <Badge variant={statusBadgeVariant(r.status)} className="shrink-0">
                        {STATUS_LABEL[r.status]}
                      </Badge>
                    </div>
                    <div className="text-xs text-neutral-500">
                      {spaceTitleById.get(r.spaceId) ?? 'Mappe'}
                      {' · '}
                      {new Date(r.updatedAt).toLocaleString('nb-NO', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </div>
                    {r.summary ? <p className="line-clamp-2 text-xs text-neutral-600">{r.summary}</p> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
