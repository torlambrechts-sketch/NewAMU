// InterviewRecord — structured interview-record form. Encrypts notes /
// decisions / next-steps via the org DEK before insert. Locks after
// 24h or finalisation.

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptField, bytesToHex } from '../../../../src/lib/alerts/encryption'

type Props = {
  supabase: SupabaseClient
  caseId: string
  orgId: string
  lang: 'nb' | 'en'
}

type Question = { key: string; text: string; notes: string }

const DEFAULT_QUESTIONS: Question[] = [
  { key: 'q1', text: '', notes: '' },
]

export function InterviewRecord({ supabase, caseId, orgId, lang }: Props) {
  const [intervieweeKind, setIntervieweeKind] = useState<'accused' | 'witness' | 'external' | 'reporter'>('witness')
  const [intervieweeId, setIntervieweeId] = useState<string | null>(null)
  const [channel, setChannel] = useState<'in_person' | 'phone' | 'video' | 'written'>('in_person')
  const [interviewAt, setInterviewAt] = useState(new Date().toISOString().slice(0, 16))
  const [location, setLocation] = useState('')
  const [consent, setConsent] = useState('')
  const [recording, setRecording] = useState(false)
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS)
  const [decisions, setDecisions] = useState('')
  const [nextSteps, setNextSteps] = useState('')
  const [accusedOptions, setAccusedOptions] = useState<Array<{ id: string; label: string }>>([])
  const [witnessOptions, setWitnessOptions] = useState<Array<{ id: string; label: string }>>([])
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    async function loadOptions() {
      const { data: acc } = await supabase.from('alert_accused').select('id, role_or_title').eq('case_id', caseId)
      setAccusedOptions((acc ?? []).map((a) => ({ id: (a as { id: string }).id, label: (a as { role_or_title?: string | null }).role_or_title ?? 'anklagaet' })))
      const { data: wit } = await supabase.from('alert_witness').select('id, role_or_title').eq('case_id', caseId)
      setWitnessOptions((wit ?? []).map((w) => ({ id: (w as { id: string }).id, label: (w as { role_or_title?: string | null }).role_or_title ?? 'vitne' })))
    }
    void loadOptions()
  }, [supabase, caseId])

  async function save(finalise: boolean) {
    setBusy(true)
    const { data: userRow } = await supabase.auth.getUser()
    const userId = userRow.user?.id
    if (!userId) {
      setBusy(false)
      return
    }
    const notesPlain = JSON.stringify(questions)
    const notesEnc = await encryptField(supabase, orgId, notesPlain)
    const decEnc = decisions ? await encryptField(supabase, orgId, decisions) : null
    const nextEnc = nextSteps ? await encryptField(supabase, orgId, nextSteps) : null
    const consentEnc = consent ? await encryptField(supabase, orgId, consent) : null
    const { error } = await supabase.from('alert_interview').insert({
      case_id: caseId,
      organization_id: orgId,
      interviewee_kind: intervieweeKind,
      interviewee_accused_id: intervieweeKind === 'accused' ? intervieweeId : null,
      interviewee_witness_id: intervieweeKind === 'witness' ? intervieweeId : null,
      interviewers: [userId],
      interview_at: new Date(interviewAt).toISOString(),
      location: location || null,
      channel,
      consent_statement_encrypted: consentEnc ? bytesToHex(consentEnc.ciphertext) : null,
      consent_key_version: consentEnc?.version ?? null,
      consent_received_at: consent ? new Date().toISOString() : null,
      recording,
      questions: questions.map((q) => ({ key: q.key, text: q.text })),
      notes_encrypted: notesEnc ? bytesToHex(notesEnc.ciphertext) : null,
      notes_key_version: notesEnc?.version ?? null,
      decisions_encrypted: decEnc ? bytesToHex(decEnc.ciphertext) : null,
      decisions_key_version: decEnc?.version ?? null,
      next_steps_encrypted: nextEnc ? bytesToHex(nextEnc.ciphertext) : null,
      next_steps_key_version: nextEnc?.version ?? null,
      finalised_at: finalise ? new Date().toISOString() : null,
      finalised_by: finalise ? userId : null,
      created_by: userId,
    })
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    setSavedAt(new Date().toISOString())
  }

  return (
    <section className="space-y-3 rounded border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold">{lang === 'nb' ? 'Intervjureferat' : 'Interview record'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs">
          <span className="font-semibold">{lang === 'nb' ? 'Type intervjuobjekt' : 'Interviewee'}</span>
          <select
            value={intervieweeKind}
            onChange={(e) => {
              setIntervieweeKind(e.target.value as typeof intervieweeKind)
              setIntervieweeId(null)
            }}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
          >
            <option value="accused">{lang === 'nb' ? 'Anklaget' : 'Accused'}</option>
            <option value="witness">{lang === 'nb' ? 'Vitne' : 'Witness'}</option>
            <option value="reporter">{lang === 'nb' ? 'Varsler' : 'Reporter'}</option>
            <option value="external">{lang === 'nb' ? 'Ekstern part' : 'External'}</option>
          </select>
        </label>
        {(intervieweeKind === 'accused' || intervieweeKind === 'witness') && (
          <label className="text-xs">
            <span className="font-semibold">{lang === 'nb' ? 'Velg' : 'Select'}</span>
            <select
              value={intervieweeId ?? ''}
              onChange={(e) => setIntervieweeId(e.target.value || null)}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
            >
              <option value="">— —</option>
              {(intervieweeKind === 'accused' ? accusedOptions : witnessOptions).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs">
          <span className="font-semibold">{lang === 'nb' ? 'Dato + tid' : 'Date + time'}</span>
          <input
            type="datetime-local"
            value={interviewAt}
            onChange={(e) => setInterviewAt(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
          />
        </label>
        <label className="text-xs">
          <span className="font-semibold">{lang === 'nb' ? 'Kanal' : 'Channel'}</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as typeof channel)}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
          >
            <option value="in_person">{lang === 'nb' ? 'Fysisk' : 'In person'}</option>
            <option value="phone">{lang === 'nb' ? 'Telefon' : 'Phone'}</option>
            <option value="video">Video</option>
            <option value="written">{lang === 'nb' ? 'Skriftlig' : 'Written'}</option>
          </select>
        </label>
        <label className="text-xs col-span-2">
          <span className="font-semibold">{lang === 'nb' ? 'Sted' : 'Location'}</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
          />
        </label>
        <label className="text-xs col-span-2">
          <span className="font-semibold">{lang === 'nb' ? 'Samtykkeerklæring' : 'Consent statement'}</span>
          <textarea
            rows={2}
            value={consent}
            onChange={(e) => setConsent(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
          />
        </label>
        <label className="text-xs col-span-2 flex items-center gap-2">
          <input type="checkbox" checked={recording} onChange={(e) => setRecording(e.target.checked)} />
          {lang === 'nb' ? 'Møtet er tatt opp' : 'Meeting recorded'}
        </label>
      </div>

      <div>
        <div className="text-xs font-semibold mb-2">{lang === 'nb' ? 'Spørsmål + notater' : 'Questions + notes'}</div>
        {questions.map((q, i) => (
          <div key={q.key} className="mb-3 rounded border border-neutral-200 p-2">
            <input
              type="text"
              value={q.text}
              onChange={(e) => {
                const next = [...questions]
                next[i] = { ...q, text: e.target.value }
                setQuestions(next)
              }}
              placeholder={lang === 'nb' ? 'Spørsmål' : 'Question'}
              className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <textarea
              rows={3}
              value={q.notes}
              onChange={(e) => {
                const next = [...questions]
                next[i] = { ...q, notes: e.target.value }
                setQuestions(next)
              }}
              placeholder={lang === 'nb' ? 'Notater' : 'Notes'}
              className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setQuestions([...questions, { key: `q${questions.length + 1}`, text: '', notes: '' }])}
          className="rounded border border-neutral-300 px-3 py-1 text-xs"
        >
          + {lang === 'nb' ? 'Legg til spørsmål' : 'Add question'}
        </button>
      </div>

      <label className="block text-xs">
        <span className="font-semibold">{lang === 'nb' ? 'Beslutninger' : 'Decisions'}</span>
        <textarea
          rows={3}
          value={decisions}
          onChange={(e) => setDecisions(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
        />
      </label>
      <label className="block text-xs">
        <span className="font-semibold">{lang === 'nb' ? 'Neste steg' : 'Next steps'}</span>
        <textarea
          rows={3}
          value={nextSteps}
          onChange={(e) => setNextSteps(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
        />
      </label>

      {savedAt && (
        <p className="text-xs text-emerald-700">
          {lang === 'nb' ? 'Lagret' : 'Saved'} {new Date(savedAt).toLocaleString()}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void save(false)}
          disabled={busy}
          className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {lang === 'nb' ? 'Lagre kladd' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={() => void save(true)}
          disabled={busy}
          className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {lang === 'nb' ? 'Lagre og lås' : 'Save and lock'}
        </button>
      </div>
    </section>
  )
}
