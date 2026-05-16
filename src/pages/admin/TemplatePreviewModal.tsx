// Forhåndsvisning av en sjekkliste-mal — read-only list of items as
// they would appear during execution. Useful as a sanity check before
// activating a template. Compliance-only today; other sources need
// their own preview shape (survey questions, document page tree,
// learning modules, register record schema) and will get dedicated
// preview modals as their inline editors land.

import { useEffect, useState } from 'react'
import { Eye, Loader2, X } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { parseChecklistDefinition } from '../../../modules/compliance/schema'
import { detectLawRefs } from '../../lib/lawRefDetector'

type Item = {
  id?: string
  prompt: string
  type: string
  required?: boolean
  severity_default?: string | null
  law_ref?: string | null
  help?: string | null
}

const TYPE_LABEL: Record<string, string> = {
  yes_no_na: 'Ja / Nei / Ikke aktuelt',
  text: 'Tekst',
  number: 'Tall',
  photo: 'Bilde',
  signature: 'Signatur',
}

export function TemplatePreviewModal({
  templateId,
  templateName,
  onClose,
}: {
  templateId: string
  templateName: string
  onClose: () => void
}) {
  const { supabase } = useOrgSetupContext()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error: err } = await supabase
          .from('compliance_checklist_templates')
          .select('definition')
          .eq('id', templateId)
          .maybeSingle()
        if (cancelled) return
        if (err) throw err
        const def = parseChecklistDefinition(data?.definition)
        setItems(def.items as Item[])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste forhåndsvisning.')
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
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              <Eye className="size-3" /> Forhåndsvisning
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
          ) : items.length === 0 ? (
            <p className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center text-sm text-neutral-600">
              Denne malen har ingen punkter ennå.
            </p>
          ) : (
            <ol className="space-y-2">
              {items.map((it, i) => (
                <li
                  key={it.id ?? i}
                  className="rounded-md border border-neutral-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900">
                        <span className="text-neutral-400">{i + 1}.</span> {it.prompt}
                      </p>
                      {it.help ? (
                        <p className="mt-0.5 text-xs text-neutral-600">{it.help}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                        {TYPE_LABEL[it.type] ?? it.type}
                      </span>
                      {it.required ? (
                        <span className="text-[10px] font-bold uppercase text-rose-700">Påkrevd</span>
                      ) : null}
                    </div>
                  </div>
                  {it.law_ref ? (
                    <p className="mt-1.5 font-mono text-[10px] text-neutral-500">
                      Lovref: {it.law_ref}
                    </p>
                  ) : null}
                  {(() => {
                    const detected = detectLawRefs(`${it.prompt} ${it.help ?? ''}`)
                      .filter((d) => d.ref !== it.law_ref)
                    if (detected.length === 0) return null
                    return (
                      <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-purple-700">
                        <span className="font-semibold uppercase">Auto-funn:</span>
                        {detected.map((d) => (
                          <span
                            key={d.ref}
                            className="rounded-full bg-purple-50 px-1.5 py-0.5 font-mono text-purple-900"
                            title={`Foreslått av ${d.source}-detektoren`}
                          >
                            {d.ref}
                          </span>
                        ))}
                      </p>
                    )
                  })()}
                </li>
              ))}
            </ol>
          )}
        </div>
        <footer className="border-t border-neutral-100 px-5 py-3 text-[11px] text-neutral-500">
          {items.length} punkt{items.length === 1 ? '' : 'er'}. Forhåndsvisning er en lesemodus —
          ingen data lagres.
        </footer>
      </div>
    </div>
  )
}
