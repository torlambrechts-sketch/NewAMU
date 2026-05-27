// WitnessPanel — list + add witness entries on a case. Anonymous witnesses
// supported (display_name nullable).

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptField, decryptField, bytesToHex, hexToBytes } from '../../../../src/lib/alerts/encryption'

type Props = {
  supabase: SupabaseClient
  caseId: string
  orgId: string
  caseClosed: boolean
  lang: 'nb' | 'en'
}

type Row = {
  id: string
  display_name_encrypted: string | null
  role_or_title: string | null
  relationship_to_case: string | null
  consented: boolean
  consent_recorded_at: string | null
  interview_at: string | null
}

type DecryptedRow = Row & { displayName: string | null }

export function WitnessPanel({ supabase, caseId, orgId, caseClosed, lang }: Props) {
  const [rows, setRows] = useState<DecryptedRow[]>([])
  const [anonymous, setAnonymous] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newRel, setNewRel] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('alert_witness')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at')
    const raw = (data ?? []) as Row[]
    const decrypted: DecryptedRow[] = await Promise.all(
      raw.map(async (r) => {
        let name: string | null = null
        if (r.display_name_encrypted) {
          const bytes = hexToBytes(r.display_name_encrypted)
          if (bytes) name = await decryptField(supabase, orgId, bytes)
        }
        return { ...r, displayName: name }
      }),
    )
    setRows(decrypted)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  async function add() {
    if (!anonymous && !newName.trim()) return
    setBusy(true)
    let encHex: string | null = null
    let encVersion: number | null = null
    if (!anonymous) {
      const enc = await encryptField(supabase, orgId, newName.trim())
      if (!enc) {
        setBusy(false)
        alert(lang === 'nb' ? 'Krypteringsnøkkel mangler.' : 'Encryption key missing.')
        return
      }
      encHex = bytesToHex(enc.ciphertext)
      encVersion = enc.version
    }
    const { error } = await supabase.from('alert_witness').insert({
      case_id: caseId,
      organization_id: orgId,
      display_name_encrypted: encHex,
      display_name_key_version: encVersion,
      role_or_title: newRole.trim() || null,
      relationship_to_case: newRel.trim() || null,
      consented: consent,
      consent_recorded_at: consent ? new Date().toISOString() : null,
    })
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    setNewName('')
    setNewRole('')
    setNewRel('')
    setConsent(false)
    setAnonymous(false)
    await load()
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{lang === 'nb' ? 'Vitner' : 'Witnesses'}</h3>
      {rows.length === 0 && (
        <p className="text-xs text-neutral-500">
          {lang === 'nb' ? 'Ingen vitner registrert.' : 'No witnesses recorded.'}
        </p>
      )}
      {rows.map((r) => (
        <div key={r.id} className="rounded border border-neutral-200 bg-white p-3">
          <div className="text-sm font-medium">
            {r.displayName ?? (lang === 'nb' ? '[anonymt vitne]' : '[anonymous witness]')}
          </div>
          {r.role_or_title && <div className="text-xs text-neutral-500">{r.role_or_title}</div>}
          {r.relationship_to_case && (
            <div className="text-xs text-neutral-500">{r.relationship_to_case}</div>
          )}
          {r.consented && r.consent_recorded_at && (
            <div className="mt-1 text-[10px] text-emerald-700">
              {lang === 'nb' ? 'Samtykke registrert' : 'Consent recorded'}{' '}
              {new Date(r.consent_recorded_at).toLocaleDateString()}
            </div>
          )}
          {r.interview_at && (
            <div className="text-[10px] text-neutral-500">
              {lang === 'nb' ? 'Intervjuet' : 'Interviewed'} {new Date(r.interview_at).toLocaleDateString()}
            </div>
          )}
        </div>
      ))}
      {!caseClosed && (
        <div className="rounded border border-dashed border-neutral-300 p-3 space-y-2">
          <div className="text-xs font-semibold">
            {lang === 'nb' ? 'Legg til vitne' : 'Add witness'}
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            {lang === 'nb' ? 'Anonymt vitne (uten navn)' : 'Anonymous witness (no name)'}
          </label>
          {!anonymous && (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={lang === 'nb' ? 'Navn' : 'Name'}
              className="block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          )}
          <input
            type="text"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            placeholder={lang === 'nb' ? 'Stilling' : 'Role'}
            className="block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          <input
            type="text"
            value={newRel}
            onChange={(e) => setNewRel(e.target.value)}
            placeholder={lang === 'nb' ? 'Forhold til saken' : 'Relationship to case'}
            className="block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              {lang === 'nb'
                ? 'Vitnet har samtykket til å bli ført opp.'
                : 'Witness has consented to being recorded.'}
            </span>
          </label>
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy || (!anonymous && !newName.trim())}
            className="rounded bg-neutral-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {lang === 'nb' ? 'Legg til' : 'Add'}
          </button>
        </div>
      )}
    </section>
  )
}
