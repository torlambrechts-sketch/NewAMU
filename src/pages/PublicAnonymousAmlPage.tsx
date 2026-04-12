import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Send } from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { AML_REPORT_KINDS } from '../data/amlAnonymousReporting'
import type { AmlReportKind } from '../types/orgHealth'
import { DEFAULT_ANONYMOUS_AML_PAGE, type AnonymousAmlPageSettings } from '../types/workplaceReportingCase'

const FOREST = '#1a3d32'

function normalizeSettings(raw: unknown): AnonymousAmlPageSettings {
  if (!raw || typeof raw !== 'object' || Object.keys(raw as object).length === 0) {
    return { ...DEFAULT_ANONYMOUS_AML_PAGE }
  }
  const o = raw as Record<string, unknown>
  return {
    pageTitle:
      typeof o.pageTitle === 'string' && o.pageTitle.trim()
        ? o.pageTitle.trim()
        : DEFAULT_ANONYMOUS_AML_PAGE.pageTitle,
    leadParagraph:
      typeof o.leadParagraph === 'string' ? o.leadParagraph : DEFAULT_ANONYMOUS_AML_PAGE.leadParagraph,
    footerNote: typeof o.footerNote === 'string' ? o.footerNote : DEFAULT_ANONYMOUS_AML_PAGE.footerNote,
  }
}

export function PublicAnonymousAmlPage() {
  const { slug } = useParams<{ slug: string }>()
  const supabase = getSupabaseBrowserClient()
  const [settings, setSettings] = useState<AnonymousAmlPageSettings>({ ...DEFAULT_ANONYMOUS_AML_PAGE })
  const [loadingSettings, setLoadingSettings] = useState(!!slug)
  const [reportKind, setReportKind] = useState<AmlReportKind>('psychosocial')
  const [reportUrgency, setReportUrgency] = useState<'low' | 'medium' | 'high'>('medium')
  const [reportDetails, setReportDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !slug) {
      setLoadingSettings(false)
      return
    }
    setLoadingSettings(true)
    const { data, error: e } = await supabase.rpc('public_anonymous_aml_page_settings', { p_org_slug: slug })
    if (e) setError(e.message)
    else setSettings(normalizeSettings(data))
    setLoadingSettings(false)
  }, [supabase, slug])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !slug) return
    setBusy(true)
    setError(null)
    const detailsIndicated = reportDetails.trim().length > 0
    const { error: err } = await supabase.rpc('public_submit_anonymous_aml_report', {
      p_org_slug: slug,
      p_kind: reportKind,
      p_urgency: reportUrgency,
      p_details_indicated: detailsIndicated,
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setReportDetails('')
    setDone(true)
  }

  if (!slug) {
    return <p className="p-8 text-neutral-600">Ugyldig lenke.</p>
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2] px-4 py-10 text-neutral-900">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl" style={{ color: FOREST }}>
            {settings.pageTitle}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">{settings.leadParagraph}</p>
        </div>

        <div className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <strong>Anonym kanal.</strong> Fritekst du skriver nedenfor <strong>lagres ikke</strong> — kun kategori,
          hastegrad og om du indikerte merknad. Henvisninger til AML er illustrative — verifiser mot lovdata.no og
          interne rutiner.
        </div>

        {loadingSettings ? (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" />
            Laster…
          </div>
        ) : done ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            Takk — meldingen er registrert anonymt.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <div>
              <label className="text-xs font-medium text-neutral-500">Kategori</label>
              <select
                value={reportKind}
                onChange={(e) => setReportKind(e.target.value as AmlReportKind)}
                className="mt-1 w-full max-w-lg rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                {AML_REPORT_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-neutral-500">{AML_REPORT_KINDS.find((k) => k.id === reportKind)?.hint}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">Hastegrad</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {(
                  [
                    ['low', 'Lav'],
                    ['medium', 'Middels'],
                    ['high', 'Høy'],
                  ] as const
                ).map(([v, lab]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setReportUrgency(v)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                      reportUrgency === v
                        ? 'text-white'
                        : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                    style={reportUrgency === v ? { backgroundColor: FOREST } : undefined}
                  >
                    {lab}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">
                Merknad (valgfritt) — lagres <strong>ikke</strong>
              </label>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={4}
                placeholder="Skriv her om du vil — innholdet brukes ikke ved innsending."
                className="mt-1 w-full rounded-lg border border-dashed border-amber-300/80 bg-amber-50/30 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-neutral-500">Vi registrerer kun om du skrev noe (ja/nei), ikke teksten.</p>
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: FOREST }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send anonymt
            </button>
          </form>
        )}

        {settings.footerNote ? (
          <p className="text-center text-xs text-neutral-500">{settings.footerNote}</p>
        ) : null}
      </div>
    </div>
  )
}
