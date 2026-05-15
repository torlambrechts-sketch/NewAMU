// Public anonymous-submission page for varslinger / GDPR-brudd / HMS-avvik.
//
// Mounted at /alerts/public/:slug (and as a redirect target from legacy
// /varsle/:slug). Loads the org by slug, lists the active alert templates
// the org has enabled, lets the visitor pick one + fill the public form
// fields declared by the template's definition, and submits via
// public_submit_alert RPC.
//
// Anonymity by default. Reporter chooses anonymous vs identified at the
// final step — the field is whitelisted by the RPC, so no client-side
// tampering can de-anonymise.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Lock, Loader2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../../../src/lib/supabaseClient'
import type { AlertSystemTemplateRow, AlertPublicFormField, AlertPiiHint } from '../types'
import { parseSystemTemplateRow } from '../types'
import { ALERT_KIND_LABEL } from '../alertsLabels'

const R = 'rounded-lg'

function piiHintLabel(hint: AlertPiiHint | undefined): string | null {
  if (!hint || hint === 'low') return null
  if (hint === 'medium') return 'Inneholder antakelig personopplysninger — del bare det som er nødvendig.'
  return 'Høy risiko for personopplysninger — vurder om navn på enkeltpersoner kan utelates.'
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'org-missing' }
  | { kind: 'ready'; orgName: string; templates: AlertSystemTemplateRow[] }
  | { kind: 'error'; message: string }

export function PublicAlertSubmitPage() {
  const { slug } = useParams<{ slug: string }>()
  const supabase = getSupabaseBrowserClient()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [reporterContact, setReporterContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState<{ accessKey: string; caseId: string } | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !slug) {
      setState({ kind: 'org-missing' })
      return
    }
    try {
      const orgRes = await supabase.rpc('public_alert_org_lookup', { p_slug: slug })
      if (orgRes.error || !orgRes.data || !(orgRes.data as { name?: string }).name) {
        setState({ kind: 'org-missing' })
        return
      }
      const orgName = (orgRes.data as { name: string }).name
      const tplRes = await supabase
        .from('alert_system_templates')
        .select('*')
        .eq('is_active', true)
        .eq('allows_anonymous', true)
        .order('sort_order')
      if (tplRes.error) {
        setState({ kind: 'error', message: tplRes.error.message })
        return
      }
      const templates = (tplRes.data ?? [])
        .map(parseSystemTemplateRow)
        .filter((t): t is AlertSystemTemplateRow => t !== null)
      setState({ kind: 'ready', orgName, templates })
      if (templates.length === 1) setSelectedTemplateId(templates[0]!.id)
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Ukjent feil' })
    }
  }, [supabase, slug])

  useEffect(() => {
    void load()
  }, [load])

  const selectedTemplate = useMemo<AlertSystemTemplateRow | null>(() => {
    if (state.kind !== 'ready' || !selectedTemplateId) return null
    return state.templates.find((t) => t.id === selectedTemplateId) ?? null
  }, [state, selectedTemplateId])

  const formFields: AlertPublicFormField[] = useMemo(() => {
    if (!selectedTemplate) return []
    return selectedTemplate.definition.publicFormFields ?? []
  }, [selectedTemplate])

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!supabase || !selectedTemplate || !slug) return
      setBusy(true)
      setSubmitError(null)
      try {
        const payload: Record<string, string> = { ...formValues }
        if (!isAnonymous && reporterContact.trim()) {
          payload.reporter_contact = reporterContact.trim()
        }
        const res = await supabase.rpc('public_submit_alert', {
          p_org_slug: slug,
          p_template_slug: selectedTemplate.id,
          p_payload: payload,
          p_captcha_token: null,
        })
        if (res.error) throw new Error(res.error.message)
        const data = res.data as { caseId?: string; accessKey?: string }
        if (!data?.accessKey || !data?.caseId) throw new Error('Uventet svar fra server.')
        setDone({ accessKey: data.accessKey, caseId: data.caseId })
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : 'Innsending feilet.')
      } finally {
        setBusy(false)
      }
    },
    [supabase, slug, selectedTemplate, formValues, isAnonymous, reporterContact]
  )

  if (!slug) return <p className="p-8 text-neutral-600">Ugyldig lenke.</p>

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" /> Laster…
          </p>
        </div>
      </div>
    )
  }

  if (state.kind === 'org-missing') {
    return (
      <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
        <div className="mx-auto max-w-lg">
          <h1 className="font-serif text-2xl font-semibold text-[#b91c1c]">Fant ikke virksomhet</h1>
          <p className="mt-2 text-sm text-neutral-600">Kontroller at lenken er riktig, og prøv igjen.</p>
        </div>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
        <div className="mx-auto max-w-lg">
          <h1 className="font-serif text-2xl font-semibold text-[#b91c1c]">Tjenesten er midlertidig utilgjengelig</h1>
          <p className="mt-2 text-sm text-neutral-600">{state.message}</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
        <div className="mx-auto max-w-lg">
          <h1 className="font-serif text-2xl font-semibold text-[#1a3d32]">Mottatt</h1>
          <div className={`${R} mt-8 border border-emerald-200 bg-white p-6`}>
            <p className="font-medium text-emerald-900">Saken er registrert hos {state.orgName}.</p>
            <p className="mt-2 text-sm text-neutral-700">
              Saksnøkkelen din (oppbevar trygt — du trenger den for å sjekke status):
            </p>
            <code className="mt-2 block break-all rounded bg-neutral-100 px-2 py-1 text-xs">{done.accessKey}</code>
            <p className="mt-4 text-xs text-neutral-500">
              Vi bekrefter mottak innen den fristen som gjelder for malen du valgte.
              Saksnøkkelen er det eneste vi har for å gjenkjenne deg — det finnes ingen
              gjenoppretting hvis du mister den.
            </p>
            <Link to={`/alerts/public/status?key=${encodeURIComponent(done.accessKey)}`} className="mt-4 inline-block text-sm font-medium text-[#1a3d32] underline">
              Sjekk status →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-6 text-[#b91c1c]" />
          <h1 className="font-serif text-2xl font-semibold text-neutral-900">Send varsel</h1>
        </div>
        <p className="mt-2 text-sm text-neutral-600">
          <strong>{state.orgName}</strong> — du kan velge å varsle anonymt. Du får en saksnøkkel
          etter innsending; oppbevar den trygt for senere statusoppslag.
        </p>

        {!selectedTemplate ? (
          <div className="mt-6 space-y-3">
            <label className="text-[10px] font-bold uppercase text-neutral-600">1. Velg type</label>
            <div className="space-y-2">
              {state.templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`${R} w-full border border-neutral-300 bg-white p-4 text-left hover:border-[#b91c1c] hover:bg-neutral-50`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{t.label}</span>
                    <span className="text-[10px] uppercase text-neutral-500">{ALERT_KIND_LABEL[t.kind]}</span>
                  </div>
                  {t.description ? <p className="mt-1 text-xs text-neutral-600">{t.description}</p> : null}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className={`${R} mt-6 space-y-4 border border-neutral-200 bg-white p-6`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{selectedTemplate.label}</p>
                <p className="text-xs text-neutral-500">{ALERT_KIND_LABEL[selectedTemplate.kind]}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTemplateId(null)}
                className="text-xs underline"
              >
                Bytt
              </button>
            </div>

            {selectedTemplate.definition.preparationGuidance ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {selectedTemplate.definition.preparationGuidance}
              </div>
            ) : null}

            {formFields.length === 0 ? (
              <p className="text-sm text-neutral-500">Denne malen mangler skjemafelt — kontakt mottaket.</p>
            ) : (
              formFields.map((f) => {
                const hint = piiHintLabel(f.piiHint)
                const value = formValues[f.key] ?? ''
                return (
                  <div key={f.key}>
                    <label className="text-[10px] font-bold uppercase text-neutral-600">
                      {f.label} {f.required ? <span className="text-red-700">*</span> : null}
                    </label>
                    {f.kind === 'longtext' ? (
                      <textarea
                        rows={5}
                        required={f.required}
                        value={value}
                        onChange={(e) => setFormValues({ ...formValues, [f.key]: e.target.value })}
                        className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`}
                      />
                    ) : f.kind === 'select' ? (
                      <select
                        required={f.required}
                        value={value}
                        onChange={(e) => setFormValues({ ...formValues, [f.key]: e.target.value })}
                        className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`}
                      >
                        <option value="">— velg —</option>
                        {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required={f.required}
                        value={value}
                        onChange={(e) => setFormValues({ ...formValues, [f.key]: e.target.value })}
                        className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`}
                      />
                    )}
                    {f.helpText ? <p className="mt-1 text-xs text-neutral-500">{f.helpText}</p> : null}
                    {hint ? <p className="mt-1 flex items-center gap-1 text-xs text-amber-700"><Lock className="size-3" /> {hint}</p> : null}
                  </div>
                )
              })
            )}

            <fieldset className="space-y-2 border-t border-neutral-200 pt-4">
              <legend className="text-[10px] font-bold uppercase text-neutral-600">Anonymitet</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={isAnonymous} onChange={() => setIsAnonymous(true)} />
                Varsle anonymt (anbefalt)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!isAnonymous} onChange={() => setIsAnonymous(false)} />
                Oppgi kontakt (e-post eller telefon — synlig kun for varslingsmottaket)
              </label>
              {!isAnonymous ? (
                <input
                  type="text"
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                  placeholder="varsler@e-post.no"
                  className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`}
                />
              ) : null}
            </fieldset>

            {submitError ? <p className="text-sm text-red-700">{submitError}</p> : null}

            <button
              type="submit"
              disabled={busy || formFields.length === 0}
              className={`${R} w-full bg-[#b91c1c] py-3 text-sm font-semibold text-white disabled:opacity-50`}
            >
              {busy ? 'Sender…' : 'Send varsel'}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-neutral-500">
          <Link to="/login" className="underline">Tilbake til innlogging</Link>
        </p>
      </div>
    </div>
  )
}

