// DsarRequestForm — DPO submits a new DSAR. Subject identifier is hashed
// client-side before storage so the DB never sees the email/phone.

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AlertDsarSubjectType } from '../../types'
import { hmacEmail, bytesToHex } from '../../../../src/lib/alerts/encryption'

type Props = {
  supabase: SupabaseClient
  orgId: string
  onCreated: (id: string) => void
  lang: 'nb' | 'en'
}

const SUBJECT_TYPES: Array<{ value: AlertDsarSubjectType; label: { nb: string; en: string } }> = [
  { value: 'reporter', label: { nb: 'Varsler', en: 'Reporter' } },
  { value: 'accused',  label: { nb: 'Anklaget', en: 'Accused' } },
  { value: 'witness',  label: { nb: 'Vitne',    en: 'Witness' } },
  { value: 'other',    label: { nb: 'Annet',    en: 'Other' } },
]

export function DsarRequestForm({ supabase, orgId, onCreated, lang }: Props) {
  const [subjectType, setSubjectType] = useState<AlertDsarSubjectType>('reporter')
  const [identifier, setIdentifier] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!identifier.trim()) return
    setBusy(true)
    setError(null)
    const mac = await hmacEmail(supabase, orgId, identifier.trim())
    if (!mac) {
      setError(lang === 'nb' ? 'Krypteringsnøkkel mangler.' : 'Encryption key missing.')
      setBusy(false)
      return
    }
    const { data: userRow } = await supabase.auth.getUser()
    const { data, error: insErr } = await supabase
      .from('alert_dsar_request')
      .insert({
        organization_id: orgId,
        subject_type: subjectType,
        subject_identifier_hash: bytesToHex(mac),
        received_by: userRow.user?.id ?? null,
      })
      .select('id')
      .single()
    setBusy(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    const row = data as { id: string }
    setIdentifier('')
    onCreated(row.id)
  }

  return (
    <section className="space-y-3 rounded border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold">{lang === 'nb' ? 'Ny DSAR-forespørsel' : 'New DSAR request'}</h3>
      <label className="block text-xs">
        <span className="font-semibold">{lang === 'nb' ? 'Type emne' : 'Subject type'}</span>
        <select
          value={subjectType}
          onChange={(e) => setSubjectType(e.target.value as AlertDsarSubjectType)}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
        >
          {SUBJECT_TYPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label[lang]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        <span className="font-semibold">
          {lang === 'nb' ? 'E-postadresse eller identifikator' : 'Email or identifier'}
        </span>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="bruker@eksempel.no"
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
        />
        <span className="mt-1 block text-[10px] italic text-neutral-500">
          {lang === 'nb'
            ? 'Lagres som HMAC — vi har ingen mulighet til å lese tilbake.'
            : 'Stored as HMAC — we cannot read it back.'}
        </span>
      </label>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !identifier.trim()}
        className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {lang === 'nb' ? 'Opprett DSAR' : 'Create DSAR'}
      </button>
    </section>
  )
}
