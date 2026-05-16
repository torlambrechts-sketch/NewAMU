// Versjonshistorikk modal for a single compliance template. Reads from
// `compliance_template_versions` (append-only snapshot log written by
// the snapshot trigger). Today the modal is read-only — restoring a
// version is a follow-up RPC that needs careful RLS design.

import { useEffect, useState } from 'react'
import { Clock, Loader2, X } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type VersionRow = {
  id: string
  snapshot: { name?: string; description?: string | null; is_active?: boolean } | null
  changed_by: string | null
  created_at: string
}

export function TemplateHistoryModal({
  templateId,
  templateName,
  onClose,
}: {
  templateId: string
  templateName: string
  onClose: () => void
}) {
  const { supabase } = useOrgSetupContext()
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error: err } = await supabase
          .from('compliance_template_versions')
          .select('id, snapshot, changed_by, created_at')
          .eq('template_id', templateId)
          .order('created_at', { ascending: false })
          .limit(50)
        if (cancelled) return
        if (err) throw err
        setVersions((data ?? []) as VersionRow[])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste historikk.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, templateId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Versjonshistorikk
            </p>
            <h2 className="truncate text-base font-semibold text-neutral-900">{templateName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Loader2 className="size-4 animate-spin" /> Laster …
            </div>
          ) : error ? (
            <p className="text-sm text-rose-700">{error}</p>
          ) : versions.length === 0 ? (
            <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
              Ingen versjoner registrert ennå. Hver gang malen oppdateres lagres en versjon
              automatisk.
            </div>
          ) : (
            <ol className="space-y-2">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white p-3"
                >
                  <Clock className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">
                      {new Date(v.created_at).toLocaleString('nb-NO')}
                    </p>
                    {v.snapshot?.name ? (
                      <p className="text-xs text-neutral-600">Navn: {v.snapshot.name}</p>
                    ) : null}
                    {v.snapshot?.description ? (
                      <p className="line-clamp-2 text-xs text-neutral-500">
                        {v.snapshot.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
        <footer className="border-t border-neutral-100 px-5 py-3 text-[11px] text-neutral-500">
          Gjenopprett-knapp kommer i en senere fase. Inntil videre vises siste 50 endringer som
          revisjons­spor.
        </footer>
      </div>
    </div>
  )
}
