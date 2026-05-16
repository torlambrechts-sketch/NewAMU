// Versjonshistorikk modal — source-aware. Reads from the per-source
// `<source>_template_versions` table written by the snapshot trigger.
// Restore is still a follow-up RPC; the modal is read-only.

import { useEffect, useState } from 'react'
import { Clock, Loader2, X } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { AdminTemplateSource } from '../../hooks/useAdminTemplates'

type VersionRow = {
  id: string
  snapshot: Record<string, unknown> | null
  changed_by: string | null
  created_at: string
}

const VERSIONS_TABLE: Record<AdminTemplateSource, string> = {
  compliance: 'compliance_template_versions',
  survey: 'survey_template_versions',
  documents: 'document_template_versions',
  learning: 'learning_template_versions',
  registers: 'register_template_versions',
}

/** Per-source snapshot field that holds the human-visible name. */
const NAME_FIELD: Record<AdminTemplateSource, string> = {
  compliance: 'name',
  survey: 'name_override',
  documents: 'label',
  learning: 'title',
  registers: 'name',
}

/** Per-source snapshot field that holds a description-ish blurb. */
const DESC_FIELD: Record<AdminTemplateSource, string> = {
  compliance: 'description',
  survey: 'description_override',
  documents: 'description',
  learning: 'description',
  registers: 'description',
}

export function TemplateHistoryModal({
  source,
  templateId,
  templateName,
  onClose,
}: {
  source: AdminTemplateSource
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
          .from(VERSIONS_TABLE[source])
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
  }, [supabase, source, templateId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const nameField = NAME_FIELD[source]
  const descField = DESC_FIELD[source]

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
              {versions.map((v) => {
                const snap = v.snapshot ?? {}
                const nameVal = snap[nameField] as string | undefined
                const descVal = snap[descField] as string | undefined | null
                return (
                  <li
                    key={v.id}
                    className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white p-3"
                  >
                    <Clock className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900">
                        {new Date(v.created_at).toLocaleString('nb-NO')}
                      </p>
                      {nameVal ? (
                        <p className="text-xs text-neutral-600">Navn: {nameVal}</p>
                      ) : null}
                      {descVal ? (
                        <p className="line-clamp-2 text-xs text-neutral-500">{descVal}</p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
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
