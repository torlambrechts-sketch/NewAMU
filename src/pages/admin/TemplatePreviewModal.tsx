// Forhåndsvisning av en mal — read-only render of the template's
// canonical content. Source-aware: each source's content blob has a
// different shape (checklist items / survey questions / document
// page blocks / learning modules / register field schema), so the
// modal branches per source. Each renderer is intentionally
// conservative — flat list view, no rich block rendering — so the
// preview stays fast and predictable.
//
// Auto-lovref detector runs on the rendered text and surfaces
// "Auto-funn" purple badges next to items that mention an AML / IK-f
// / GDPR / LDL / ISO 45001 paragraph.

import { useEffect, useState } from 'react'
import { Eye, Loader2, X } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { parseChecklistDefinition } from '../../../modules/compliance/schema'
import { detectLawRefs } from '../../lib/lawRefDetector'
import type { AdminTemplateSource } from '../../hooks/useAdminTemplates'

type PreviewItem = {
  key: string
  title: string
  /** Optional short type label rendered as a pill (e.g. «Ja/Nei/Ikke aktuelt»). */
  typeLabel?: string
  /** Optional help / sub-text rendered below the title. */
  body?: string | null
  /** Optional inline ref string (e.g. an existing law_ref). */
  ref?: string | null
  required?: boolean
}

const TYPE_LABEL: Record<string, string> = {
  yes_no_na: 'Ja / Nei / Ikke aktuelt',
  text: 'Tekst',
  number: 'Tall',
  photo: 'Bilde',
  signature: 'Signatur',
}

const REGISTER_KIND_LABEL: Record<string, string> = {
  text: 'Tekst',
  number: 'Tall',
  date: 'Dato',
  boolean: 'Ja/Nei',
  select: 'Valg fra liste',
  select_multi: 'Flervalg',
  doc_ref: 'Dokumentreferanse',
  location_ref: 'Lokasjon',
}

export function TemplatePreviewModal({
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
  const [items, setItems] = useState<PreviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emptyHint, setEmptyHint] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    void (async () => {
      try {
        if (source === 'compliance') {
          const { data, error: err } = await supabase
            .from('compliance_checklist_templates')
            .select('definition')
            .eq('id', templateId)
            .maybeSingle()
          if (err) throw err
          const def = parseChecklistDefinition(data?.definition)
          if (cancelled) return
          setItems(
            def.items.map((it, i) => {
              const item = it as {
                id?: string
                prompt: string
                type: string
                required?: boolean
                law_ref?: string | null
                help?: string | null
              }
              return {
                key: item.id ?? String(i),
                title: item.prompt,
                typeLabel: TYPE_LABEL[item.type] ?? item.type,
                body: item.help ?? null,
                ref: item.law_ref ?? null,
                required: item.required,
              }
            }),
          )
          setEmptyHint('Denne sjekklisten har ingen punkter ennå.')
        } else if (source === 'survey') {
          // Survey content lives in catalog.body (or override body).
          const { data: ovr, error: e0 } = await supabase
            .from('survey_org_templates')
            .select('body_override, catalog_id')
            .eq('id', templateId)
            .maybeSingle()
          if (e0) throw e0
          let body: unknown = (ovr as { body_override?: unknown } | null)?.body_override ?? null
          if (!body && ovr) {
            const { data: cat } = await supabase
              .from('survey_template_catalog')
              .select('body')
              .eq('id', (ovr as { catalog_id: string }).catalog_id)
              .maybeSingle()
            body = (cat as { body?: unknown } | null)?.body ?? null
          }
          if (cancelled) return
          setItems(extractSurveyQuestions(body))
          setEmptyHint('Denne undersøkelsen har ingen spørsmål ennå.')
        } else if (source === 'documents') {
          const { data, error: err } = await supabase
            .from('document_org_templates')
            .select('page_payload')
            .eq('id', templateId)
            .maybeSingle()
          if (err) throw err
          if (cancelled) return
          setItems(extractDocumentBlocks((data as { page_payload?: unknown } | null)?.page_payload))
          setEmptyHint('Denne dokument-malen har ingen blokker ennå.')
        } else if (source === 'learning') {
          const { data, error: err } = await supabase
            .from('learning_courses')
            .select('content, description')
            .eq('id', templateId)
            .maybeSingle()
          if (err) throw err
          if (cancelled) return
          setItems(extractLearningModules((data as { content?: unknown } | null)?.content))
          setEmptyHint('Dette kurset har ingen moduler ennå.')
        } else if (source === 'registers') {
          const { data, error: err } = await supabase
            .from('register_types')
            .select('metadata_schema')
            .eq('id', templateId)
            .maybeSingle()
          if (err) throw err
          if (cancelled) return
          setItems(
            extractRegisterFields(
              (data as { metadata_schema?: unknown } | null)?.metadata_schema,
            ),
          )
          setEmptyHint('Denne registertypen har ingen felter ennå.')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste forhåndsvisning.')
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
              {emptyHint ?? 'Tomt innhold.'}
            </p>
          ) : (
            <ol className="space-y-2">
              {items.map((it, i) => {
                const detected = detectLawRefs(`${it.title} ${it.body ?? ''}`).filter(
                  (d) => d.ref !== it.ref,
                )
                return (
                  <li
                    key={it.key}
                    className="rounded-md border border-neutral-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900">
                          <span className="text-neutral-400">{i + 1}.</span> {it.title}
                        </p>
                        {it.body ? (
                          <p className="mt-0.5 text-xs text-neutral-600">{it.body}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {it.typeLabel ? (
                          <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                            {it.typeLabel}
                          </span>
                        ) : null}
                        {it.required ? (
                          <span className="text-[10px] font-bold uppercase text-rose-700">
                            Påkrevd
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {it.ref ? (
                      <p className="mt-1.5 font-mono text-[10px] text-neutral-500">
                        Ref: {it.ref}
                      </p>
                    ) : null}
                    {detected.length > 0 ? (
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
                    ) : null}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
        <footer className="border-t border-neutral-100 px-5 py-3 text-[11px] text-neutral-500">
          {items.length} element{items.length === 1 ? '' : 'er'}. Forhåndsvisning er en lesemodus —
          ingen data lagres.
        </footer>
      </div>
    </div>
  )
}

// ── Source-specific extractors ─────────────────────────────────────────────

function extractSurveyQuestions(body: unknown): PreviewItem[] {
  if (!body || typeof body !== 'object') return []
  const root = body as { sections?: unknown[]; questions?: unknown[] }
  const items: PreviewItem[] = []
  let idx = 0
  const collect = (q: unknown) => {
    if (!q || typeof q !== 'object') return
    const obj = q as { id?: string; prompt?: string; text?: string; type?: string; required?: boolean }
    items.push({
      key: obj.id ?? String(idx++),
      title: obj.prompt ?? obj.text ?? '(uten spørsmålstekst)',
      typeLabel: obj.type ?? undefined,
      required: obj.required,
    })
  }
  if (Array.isArray(root.sections)) {
    for (const s of root.sections) {
      const sec = s as { questions?: unknown[] }
      if (Array.isArray(sec.questions)) for (const q of sec.questions) collect(q)
    }
  } else if (Array.isArray(root.questions)) {
    for (const q of root.questions) collect(q)
  }
  return items
}

function extractDocumentBlocks(payload: unknown): PreviewItem[] {
  if (!payload || typeof payload !== 'object') return []
  // page_payload can be an array of blocks OR { blocks: [...] }
  const blocks = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { blocks?: unknown[] }).blocks)
      ? (payload as { blocks: unknown[] }).blocks
      : []
  return blocks.map((b, i) => {
    const obj = b as { type?: string; kind?: string; heading?: string; title?: string; text?: string; body?: string; name?: string }
    const type = obj.type ?? obj.kind ?? 'block'
    const title = obj.heading ?? obj.title ?? obj.name ?? obj.text?.slice(0, 80) ?? obj.body?.slice(0, 80) ?? type
    return {
      key: String(i),
      title,
      typeLabel: type,
      body: obj.text && obj.text !== title ? obj.text.slice(0, 200) : null,
    }
  })
}

function extractLearningModules(content: unknown): PreviewItem[] {
  if (!content || typeof content !== 'object') return []
  const arr = Array.isArray(content)
    ? content
    : Array.isArray((content as { modules?: unknown[] }).modules)
      ? (content as { modules: unknown[] }).modules
      : []
  return arr.map((m, i) => {
    const obj = m as { id?: string; title?: string; kind?: string; estimatedMinutes?: number }
    return {
      key: obj.id ?? String(i),
      title: obj.title ?? '(uten tittel)',
      typeLabel: obj.kind ?? 'modul',
      body: obj.estimatedMinutes != null ? `~${obj.estimatedMinutes} min` : null,
    }
  })
}

function extractRegisterFields(schema: unknown): PreviewItem[] {
  if (!schema || typeof schema !== 'object') return []
  const fields = Array.isArray((schema as { fields?: unknown[] }).fields)
    ? ((schema as { fields: unknown[] }).fields as unknown[])
    : []
  return fields.map((f, i) => {
    const obj = f as { key?: string; label?: string; kind?: string; required?: boolean; options?: unknown[] }
    return {
      key: obj.key ?? String(i),
      title: obj.label ?? obj.key ?? '(uten navn)',
      typeLabel: REGISTER_KIND_LABEL[obj.kind ?? ''] ?? obj.kind ?? 'felt',
      required: obj.required,
      body: Array.isArray(obj.options) && obj.options.length > 0 ? `${obj.options.length} valg` : null,
    }
  })
}
