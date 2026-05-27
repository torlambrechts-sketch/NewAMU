// Public anonymous-submission page — v1.1.
//
// Mounted at /alerts/public/:slug. Top of page = DangerRedirectBanner.
// Then an anonymity_mode picker (4-way), a versioned form resolved from
// alert_intake_form_version, save-and-resume controls, optional voice
// composer, and self-identification warnings on the description field.
// Submits via the v2 RPC (public_submit_alert_v2) through the existing
// alerts-public-submit edge function.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Lock, Loader2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../../../src/lib/supabaseClient'
import type { AlertSystemTemplateRow, AlertAnonymityMode, AlertPiiHint } from '../types'
import { parseSystemTemplateRow } from '../types'
import { ALERT_KIND_LABEL } from '../alertsLabels'
import { DangerRedirectBanner } from '../components/intake/DangerRedirectBanner'
import { AnonymityModePicker } from '../components/intake/AnonymityModePicker'
import { SelfIdentificationScanner } from '../components/intake/SelfIdentificationScanner'
import { SaveAndResumeBar } from '../components/intake/SaveAndResumeBar'
import { VoiceComposer } from '../components/intake/VoiceComposer'
import {
  resolveIntakeForm,
  type ResolvedIntakeForm,
  type IntakeField,
} from '../../../src/lib/alerts/intakeFormResolver'
import {
  encryptField,
  hmacEmail,
  bytesToHex,
} from '../../../src/lib/alerts/encryption'

const R = 'rounded-lg'

function piiHintLabel(hint: AlertPiiHint | undefined, lang: 'nb' | 'en'): string | null {
  if (!hint || hint === 'low') return null
  if (hint === 'medium') {
    return lang === 'nb'
      ? 'Inneholder antakelig personopplysninger — del bare det som er nødvendig.'
      : 'Likely contains personal data — share only what is necessary.'
  }
  return lang === 'nb'
    ? 'Høy risiko for personopplysninger — vurder om navn på enkeltpersoner kan utelates.'
    : 'High risk of personal data — consider omitting individual names.'
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'org-missing' }
  | { kind: 'ready'; orgName: string; orgId: string; templates: AlertSystemTemplateRow[] }
  | { kind: 'error'; message: string }

type ResumeState = {
  resumed: boolean
  accessKey?: string
  systemTemplateId?: string
  intakeFormVersionId?: string
  payloadEncrypted?: string
  keyVersion?: number
  locale?: string
}

export function PublicAlertSubmitPage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const supabase = getSupabaseBrowserClient()
  const resumeState = (location.state ?? {}) as ResumeState

  const [lang, setLang] = useState<'nb' | 'en'>(
    resumeState.locale === 'en' ? 'en' : 'nb',
  )
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    resumeState.systemTemplateId ?? null,
  )
  const [resolvedForm, setResolvedForm] = useState<ResolvedIntakeForm | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [anonymityMode, setAnonymityMode] = useState<AlertAnonymityMode>('fully_anonymous')
  const [reporterContact, setReporterContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [draftAccessKey, setDraftAccessKey] = useState<string | null>(resumeState.accessKey ?? null)
  const [draftExpiresAt, setDraftExpiresAt] = useState<string | null>(null)
  const [done, setDone] = useState<{ accessKey: string; caseId: string } | null>(null)
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
  const [voiceTranscribe, setVoiceTranscribe] = useState(false)

  const transcriptionEnabled =
    typeof window !== 'undefined' &&
    (import.meta.env.VITE_ALERTS_WHISPER_ENABLED ?? '').toString().toLowerCase() === 'true'

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
      const orgRow = orgRes.data as { name: string; id?: string }
      const tplRes = await supabase
        .from('alert_system_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (tplRes.error) {
        setState({ kind: 'error', message: tplRes.error.message })
        return
      }
      const templates = (tplRes.data ?? [])
        .map(parseSystemTemplateRow)
        .filter((t): t is AlertSystemTemplateRow => t !== null)
      // Look up org id for encryption.
      const { data: orgIdRow } = await supabase
        .from('organizations')
        .select('id')
        .eq('alerts_public_slug', slug)
        .maybeSingle()
      const orgId = (orgIdRow as { id?: string } | null)?.id ?? orgRow.id ?? ''
      setState({ kind: 'ready', orgName: orgRow.name, orgId, templates })
      if (templates.length === 1) setSelectedTemplateId(templates[0]!.id)
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Ukjent feil' })
    }
  }, [supabase, slug])

  useEffect(() => {
    void load()
  }, [load])

  // Resolve the form schema when a template is selected.
  useEffect(() => {
    let cancelled = false
    if (!supabase || !slug || !selectedTemplateId) {
      setResolvedForm(null)
      return
    }
    void resolveIntakeForm(supabase, slug, selectedTemplateId).then((form) => {
      if (!cancelled) setResolvedForm(form)
    })
    return () => {
      cancelled = true
    }
  }, [supabase, slug, selectedTemplateId])

  const selectedTemplate = useMemo<AlertSystemTemplateRow | null>(() => {
    if (state.kind !== 'ready' || !selectedTemplateId) return null
    return state.templates.find((t) => t.id === selectedTemplateId) ?? null
  }, [state, selectedTemplateId])

  const formFields: IntakeField[] = useMemo(() => resolvedForm?.fields ?? [], [resolvedForm])

  const saveDraft = useCallback(async () => {
    if (!supabase || !slug || !selectedTemplate || state.kind !== 'ready') return
    if (!resolvedForm?.versionId) {
      setSubmitError(
        lang === 'nb'
          ? 'Kan ikke lagre kladd — skjemaversjon ikke konfigurert.'
          : 'Cannot save draft — form version not configured.',
      )
      return
    }
    setSavingDraft(true)
    setSubmitError(null)
    try {
      const payload: Record<string, string> = { ...formValues }
      if ((anonymityMode === 'pseudonymous' || anonymityMode === 'confidential' || anonymityMode === 'open')
          && reporterContact.trim()) {
        payload.reporter_contact = reporterContact.trim()
      }
      // Encrypt the whole payload as one blob for the draft.
      const enc = await encryptField(supabase, state.orgId, JSON.stringify(payload))
      if (!enc) {
        setSubmitError(
          lang === 'nb'
            ? 'Kan ikke lagre kladd — krypteringsnøkkel mangler for denne organisasjonen.'
            : 'Cannot save draft — encryption key missing for this organisation.',
        )
        return
      }
      const { data, error } = await supabase.rpc('public_save_alert_draft', {
        p_org_slug: slug,
        p_system_template_id: selectedTemplate.id,
        p_intake_form_version_id: resolvedForm.versionId,
        p_payload_encrypted: bytesToHex(enc.ciphertext),
        p_key_version: enc.version,
        p_access_key: draftAccessKey,
        p_submission_locale: lang,
        p_voice_intake_id: null,
      })
      if (error) {
        setSubmitError(error.message)
        return
      }
      if (Array.isArray(data) && data.length > 0) {
        const row = data[0] as { access_key: string; expires_at: string }
        setDraftAccessKey(row.access_key)
        setDraftExpiresAt(row.expires_at)
      }
    } finally {
      setSavingDraft(false)
    }
  }, [supabase, slug, selectedTemplate, state, resolvedForm, formValues, anonymityMode, reporterContact, draftAccessKey, lang])

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!supabase || !selectedTemplate || !slug || state.kind !== 'ready' || !resolvedForm) return
      if (!resolvedForm.versionId) {
        setSubmitError(
          lang === 'nb'
            ? 'Skjemaversjon mangler — kontakt mottaket.'
            : 'Form version missing — contact the committee.',
        )
        return
      }
      setBusy(true)
      setSubmitError(null)
      try {
        const payload: Record<string, string> = { ...formValues }
        let reporterIdentifierEncryptedHex: string | null = null
        let reporterEmailHashedHex: string | null = null
        let reporterIdentifierKeyVersion: number | null = null
        let titleEncryptedHex: string | null = null
        let descEncryptedHex: string | null = null
        let titleKeyVersion: number | null = null
        let descKeyVersion: number | null = null

        // Encrypt title + description if a DEK is provisioned for this org.
        const titleVal = payload.title ?? ''
        const descVal = payload.description ?? ''

        const titleEnc = await encryptField(supabase, state.orgId, titleVal)
        if (titleEnc) {
          titleEncryptedHex = bytesToHex(titleEnc.ciphertext)
          titleKeyVersion = titleEnc.version
        }
        const descEnc = await encryptField(supabase, state.orgId, descVal)
        if (descEnc) {
          descEncryptedHex = bytesToHex(descEnc.ciphertext)
          descKeyVersion = descEnc.version
        }
        if (
          anonymityMode !== 'fully_anonymous'
          && reporterContact.trim()
        ) {
          const idEnc = await encryptField(supabase, state.orgId, reporterContact.trim())
          if (idEnc) {
            reporterIdentifierEncryptedHex = bytesToHex(idEnc.ciphertext)
            reporterIdentifierKeyVersion = idEnc.version
          }
          if (/.+@.+\..+/.test(reporterContact.trim())) {
            const mac = await hmacEmail(supabase, state.orgId, reporterContact.trim())
            if (mac) reporterEmailHashedHex = bytesToHex(mac)
          }
        }

        // Strip plaintext identity from payload when encrypted form succeeded.
        if (titleEncryptedHex) delete payload.title
        if (descEncryptedHex) delete payload.description

        // Upload voice if present.
        let voiceIntakeId: string | null = null
        if (voiceBlob) {
          const path = `${state.orgId}/voice/draft-${(draftAccessKey ?? crypto.randomUUID()).slice(0, 8)}/${Date.now()}.webm`
          const { error: uploadErr } = await supabase.storage
            .from('alert-attachments')
            .upload(path, voiceBlob, { contentType: voiceBlob.type, upsert: false })
          if (!uploadErr) {
            // Service-role-only insert; we go through the edge function path.
            const voiceResp = await supabase.functions.invoke('alerts-public-submit', {
              body: {
                mode: 'register_voice',
                orgSlug: slug,
                storagePath: path,
                durationSeconds: 0,
                requestTranscription: voiceTranscribe,
              },
            })
            const voiceData = voiceResp.data as { voiceIntakeId?: string } | null | undefined
            if (voiceData?.voiceIntakeId) voiceIntakeId = voiceData.voiceIntakeId
          }
        }

        const { data, error } = await supabase.functions.invoke('alerts-public-submit', {
          body: {
            mode: 'submit_v2',
            orgSlug: slug,
            templateSlug: selectedTemplate.id,
            intakeFormVersionId: resolvedForm.versionId,
            anonymityMode,
            payload,
            titleEncryptedHex,
            descriptionEncryptedHex: descEncryptedHex,
            titleKeyVersion,
            descriptionKeyVersion: descKeyVersion,
            reporterIdentifierEncryptedHex,
            reporterIdentifierKeyVersion,
            reporterEmailHashedHex,
            voiceIntakeId,
            draftAccessKey,
            submissionLocale: lang,
            captchaToken: null,
          },
        })
        if (error) throw new Error(error.message)
        if (data && typeof data === 'object' && 'error' in data) {
          const e = data as { error: string }
          if (e.error === 'captcha_required') {
            throw new Error(lang === 'nb' ? 'Captcha mangler. Last siden på nytt.' : 'Captcha missing. Reload the page.')
          }
          if (e.error === 'captcha_failed') {
            throw new Error(lang === 'nb' ? 'Captcha-verifisering feilet.' : 'Captcha verification failed.')
          }
          throw new Error(e.error)
        }
        const ok = data as { caseId?: string; accessKey?: string }
        if (!ok?.accessKey || !ok?.caseId) {
          throw new Error(lang === 'nb' ? 'Uventet svar fra server.' : 'Unexpected server response.')
        }
        setDone({ accessKey: ok.accessKey, caseId: ok.caseId })
        setDraftAccessKey(null)
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : (lang === 'nb' ? 'Innsending feilet.' : 'Submission failed.'))
      } finally {
        setBusy(false)
      }
    },
    [
      supabase,
      slug,
      selectedTemplate,
      state,
      resolvedForm,
      formValues,
      anonymityMode,
      reporterContact,
      voiceBlob,
      voiceTranscribe,
      draftAccessKey,
      lang,
    ],
  )

  if (!slug) {
    return <p className="p-8 text-neutral-600">{lang === 'nb' ? 'Ugyldig lenke.' : 'Invalid link.'}</p>
  }

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" /> {lang === 'nb' ? 'Laster…' : 'Loading…'}
          </p>
        </div>
      </div>
    )
  }

  if (state.kind === 'org-missing') {
    return (
      <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
        <div className="mx-auto max-w-lg">
          <h1 className="font-serif text-2xl font-semibold text-[#b91c1c]">
            {lang === 'nb' ? 'Fant ikke virksomhet' : 'Organisation not found'}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            {lang === 'nb' ? 'Kontroller at lenken er riktig, og prøv igjen.' : 'Verify the link is correct and try again.'}
          </p>
        </div>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
        <div className="mx-auto max-w-lg">
          <h1 className="font-serif text-2xl font-semibold text-[#b91c1c]">
            {lang === 'nb' ? 'Tjenesten er midlertidig utilgjengelig' : 'Service temporarily unavailable'}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">{state.message}</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
        <div className="mx-auto max-w-lg">
          <h1 className="font-serif text-2xl font-semibold text-[#1a3d32]">
            {lang === 'nb' ? 'Mottatt' : 'Received'}
          </h1>
          <div className={`${R} mt-8 border border-emerald-200 bg-white p-6`}>
            <p className="font-medium text-emerald-900">
              {lang === 'nb' ? `Saken er registrert hos ${state.orgName}.` : `Case registered with ${state.orgName}.`}
            </p>
            <p className="mt-2 text-sm text-neutral-700">
              {lang === 'nb'
                ? 'Saksnøkkelen din (oppbevar trygt — du trenger den for å sjekke status):'
                : 'Your access key (keep safe — required to check status):'}
            </p>
            <code className="mt-2 block break-all rounded bg-neutral-100 px-2 py-1 text-xs">{done.accessKey}</code>
            <p className="mt-4 text-xs text-neutral-500">
              {lang === 'nb'
                ? 'Vi bekrefter mottak innen den fristen som gjelder for malen du valgte. Det finnes ingen gjenoppretting hvis du mister nøkkelen.'
                : 'We will acknowledge receipt within the deadline that applies to the chosen template. There is no recovery if you lose the key.'}
            </p>
            <Link
              to={`/alerts/public/status?key=${encodeURIComponent(done.accessKey)}`}
              className="mt-4 inline-block text-sm font-medium text-[#1a3d32] underline"
            >
              {lang === 'nb' ? 'Sjekk status →' : 'Check status →'}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-6 text-[#b91c1c]" />
            <h1 className="font-serif text-2xl font-semibold text-neutral-900">
              {lang === 'nb' ? 'Send varsel' : 'Submit a report'}
            </h1>
          </div>
          <div className="text-xs">
            <button onClick={() => setLang('nb')} className={`mr-2 ${lang === 'nb' ? 'font-bold' : 'underline'}`}>
              Norsk
            </button>
            <button onClick={() => setLang('en')} className={lang === 'en' ? 'font-bold' : 'underline'}>
              English
            </button>
          </div>
        </div>

        <DangerRedirectBanner lang={lang} />

        <p className="mt-2 text-sm text-neutral-600">
          <strong>{state.orgName}</strong> —{' '}
          {lang === 'nb'
            ? 'du kan velge å varsle anonymt. Du får en saksnøkkel etter innsending; oppbevar den trygt for senere statusoppslag.'
            : 'you may report anonymously. After submission you get an access key — keep it safe to check status later.'}
        </p>

        {!selectedTemplate ? (
          <div className="mt-6 space-y-3">
            <label className="text-[10px] font-bold uppercase text-neutral-600">
              {lang === 'nb' ? '1. Velg type' : '1. Choose category'}
            </label>
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
            <p className="text-xs text-neutral-500 mt-3">
              {lang === 'nb' ? 'Har du startet en kladd? ' : 'Started a draft? '}
              <Link to="/alerts/public/resume" className="underline">
                {lang === 'nb' ? 'Fortsett her' : 'Resume here'}
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className={`${R} mt-6 space-y-4 border border-neutral-200 bg-white p-6`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{selectedTemplate.label}</p>
                <p className="text-xs text-neutral-500">{ALERT_KIND_LABEL[selectedTemplate.kind]}</p>
              </div>
              <button type="button" onClick={() => setSelectedTemplateId(null)} className="text-xs underline">
                {lang === 'nb' ? 'Bytt' : 'Change'}
              </button>
            </div>

            <SaveAndResumeBar
              accessKey={draftAccessKey}
              expiresAt={draftExpiresAt}
              isSaving={savingDraft}
              onSave={() => void saveDraft()}
              lang={lang}
            />

            {selectedTemplate.definition.preparationGuidance ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {selectedTemplate.definition.preparationGuidance}
              </div>
            ) : null}

            <AnonymityModePicker
              value={anonymityMode}
              onChange={setAnonymityMode}
              lang={lang}
              allowsAnonymous={selectedTemplate.allows_anonymous}
            />

            {formFields.length === 0 ? (
              <p className="text-sm text-neutral-500">
                {lang === 'nb' ? 'Denne malen mangler skjemafelt — kontakt mottaket.' : 'No form fields defined — contact the committee.'}
              </p>
            ) : (
              formFields.map((f) => {
                const hint = piiHintLabel(f.piiHint, lang)
                const value = formValues[f.key] ?? ''
                const isDescription = f.key === 'description' || f.kind === 'longtext'
                return (
                  <div key={f.key}>
                    <label className="text-[10px] font-bold uppercase text-neutral-600">
                      {f.label} {f.required ? <span className="text-red-700">*</span> : null}
                    </label>
                    {f.kind === 'longtext' ? (
                      <>
                        <textarea
                          rows={6}
                          required={f.required}
                          value={value}
                          onChange={(e) => setFormValues({ ...formValues, [f.key]: e.target.value })}
                          className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`}
                        />
                        {isDescription && value.length > 20 && (
                          <SelfIdentificationScanner text={value} lang={lang} />
                        )}
                      </>
                    ) : f.kind === 'select' ? (
                      <select
                        required={f.required}
                        value={value}
                        onChange={(e) => setFormValues({ ...formValues, [f.key]: e.target.value })}
                        className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`}
                      >
                        <option value="">— {lang === 'nb' ? 'velg' : 'select'} —</option>
                        {f.options?.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
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
                    {hint ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                        <Lock className="size-3" /> {hint}
                      </p>
                    ) : null}
                  </div>
                )
              })
            )}

            {(anonymityMode === 'pseudonymous' ||
              anonymityMode === 'confidential' ||
              anonymityMode === 'open') && (
              <div>
                <label className="text-[10px] font-bold uppercase text-neutral-600">
                  {lang === 'nb' ? 'Kontakt (e-post eller telefon)' : 'Contact (email or phone)'}{' '}
                  {anonymityMode !== 'fully_anonymous' && <span className="text-red-700">*</span>}
                </label>
                <input
                  type="text"
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                  required={anonymityMode !== 'fully_anonymous'}
                  placeholder="varsler@e-post.no"
                  className={`${R} mt-1 w-full border border-neutral-300 px-3 py-2 text-sm`}
                />
                <p className="mt-1 text-xs text-neutral-500">
                  {lang === 'nb'
                    ? 'Synlig kun for varslingsmottaket. Aldri brukt i e-postvarsler — kun saksnummer + lenke sendes.'
                    : 'Visible only to the committee. Never used in email notifications — only case number + link is sent.'}
                </p>
              </div>
            )}

            <VoiceComposer
              lang={lang}
              onChange={(blob, transcribe) => {
                setVoiceBlob(blob)
                setVoiceTranscribe(transcribe)
              }}
              transcriptionEnabled={transcriptionEnabled}
            />

            {resolvedForm?.privacyNoticeNb && lang === 'nb' && (
              <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-xs">
                {resolvedForm.privacyNoticeNb}
              </div>
            )}
            {resolvedForm?.privacyNoticeEn && lang === 'en' && (
              <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-xs">
                {resolvedForm.privacyNoticeEn}
              </div>
            )}

            {submitError ? <p className="text-sm text-red-700">{submitError}</p> : null}

            <button
              type="submit"
              disabled={busy || formFields.length === 0}
              className={`${R} w-full bg-[#b91c1c] py-3 text-sm font-semibold text-white disabled:opacity-50`}
            >
              {busy ? (lang === 'nb' ? 'Sender…' : 'Submitting…') : lang === 'nb' ? 'Send varsel' : 'Submit'}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-neutral-500">
          <Link to="/login" className="underline">
            {lang === 'nb' ? 'Tilbake til innlogging' : 'Back to login'}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default PublicAlertSubmitPage
