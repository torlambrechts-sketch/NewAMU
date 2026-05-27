// AccusedPanel — list + add accused entries on a case. Names are encrypted
// client-side via the org's DEK before insert. Right-of-reply field is
// editable until the case closes.

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
  display_name_encrypted: string
  role_or_title: string | null
  reporter_relationship: string | null
  notified_at: string | null
  notification_method: string | null
  right_of_reply_encrypted: string | null
  right_of_reply_received_at: string | null
}

type DecryptedRow = Row & { displayName: string | null; rightOfReply: string | null }

export function AccusedPanel({ supabase, caseId, orgId, caseClosed, lang }: Props) {
  const [rows, setRows] = useState<DecryptedRow[]>([])
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newRel, setNewRel] = useState('')

  async function load() {
    const { data } = await supabase
      .from('alert_accused')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at')
    const raw = (data ?? []) as Row[]
    const decrypted: DecryptedRow[] = await Promise.all(
      raw.map(async (r) => {
        const nameBytes = hexToBytes(r.display_name_encrypted)
        const name = nameBytes ? await decryptField(supabase, orgId, nameBytes) : null
        let reply: string | null = null
        if (r.right_of_reply_encrypted) {
          const replyBytes = hexToBytes(r.right_of_reply_encrypted)
          reply = replyBytes ? await decryptField(supabase, orgId, replyBytes) : null
        }
        return { ...r, displayName: name, rightOfReply: reply }
      }),
    )
    setRows(decrypted)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  async function addAccused() {
    if (!newName.trim()) return
    setBusy(true)
    const enc = await encryptField(supabase, orgId, newName.trim())
    if (!enc) {
      alert(
        lang === 'nb'
          ? 'Krypteringsnøkkel mangler for organisasjonen — kontakt admin.'
          : 'Encryption key missing — contact admin.',
      )
      setBusy(false)
      return
    }
    const { error } = await supabase.from('alert_accused').insert({
      case_id: caseId,
      organization_id: orgId,
      display_name_encrypted: bytesToHex(enc.ciphertext),
      display_name_key_version: enc.version,
      role_or_title: newRole.trim() || null,
      reporter_relationship: newRel.trim() || null,
    })
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    setNewName('')
    setNewRole('')
    setNewRel('')
    await load()
  }

  async function saveRightOfReply(rowId: string, text: string) {
    setBusy(true)
    const enc = await encryptField(supabase, orgId, text)
    if (!enc) {
      setBusy(false)
      return
    }
    await supabase
      .from('alert_accused')
      .update({
        right_of_reply_encrypted: bytesToHex(enc.ciphertext),
        right_of_reply_key_version: enc.version,
        right_of_reply_received_at: new Date().toISOString(),
      })
      .eq('id', rowId)
    setBusy(false)
    await load()
  }

  async function recordNotified(rowId: string, method: string) {
    setBusy(true)
    await supabase
      .from('alert_accused')
      .update({ notified_at: new Date().toISOString(), notification_method: method })
      .eq('id', rowId)
    setBusy(false)
    await load()
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{lang === 'nb' ? 'Anklagede' : 'Accused'}</h3>
      {rows.length === 0 && (
        <p className="text-xs text-neutral-500">
          {lang === 'nb' ? 'Ingen anklagede registrert.' : 'No accused recorded.'}
        </p>
      )}
      {rows.map((r) => (
        <div key={r.id} className="rounded border border-neutral-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{r.displayName ?? '[dekrypteringsfeil]'}</div>
              {r.role_or_title && <div className="text-xs text-neutral-500">{r.role_or_title}</div>}
              {r.reporter_relationship && (
                <div className="text-xs text-neutral-500">
                  {lang === 'nb' ? 'Forhold til varsler' : 'Relationship to reporter'}: {r.reporter_relationship}
                </div>
              )}
            </div>
            {!r.notified_at ? (
              <button
                type="button"
                disabled={busy || caseClosed}
                onClick={() => void recordNotified(r.id, 'email')}
                className="rounded border border-neutral-300 px-2 py-1 text-xs"
              >
                {lang === 'nb' ? 'Marker varslet' : 'Mark notified'}
              </button>
            ) : (
              <span className="text-xs text-neutral-500">
                {lang === 'nb' ? 'Varslet' : 'Notified'} {new Date(r.notified_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="mt-2">
            <label className="text-[10px] font-semibold uppercase text-neutral-500">
              {lang === 'nb' ? 'Tilsvar' : 'Right of reply'}
            </label>
            <textarea
              rows={3}
              defaultValue={r.rightOfReply ?? ''}
              disabled={caseClosed}
              onBlur={(e) => {
                if (e.target.value !== (r.rightOfReply ?? '')) {
                  void saveRightOfReply(r.id, e.target.value)
                }
              }}
              className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-xs"
            />
            {r.right_of_reply_received_at && (
              <div className="text-[10px] text-neutral-500">
                {lang === 'nb' ? 'Mottatt' : 'Received'}: {new Date(r.right_of_reply_received_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      ))}
      {!caseClosed && (
        <div className="rounded border border-dashed border-neutral-300 p-3">
          <div className="text-xs font-semibold mb-2">
            {lang === 'nb' ? 'Legg til anklaget' : 'Add accused'}
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={lang === 'nb' ? 'Navn' : 'Name'}
            className="block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          <input
            type="text"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            placeholder={lang === 'nb' ? 'Stilling' : 'Role'}
            className="mt-2 block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          <input
            type="text"
            value={newRel}
            onChange={(e) => setNewRel(e.target.value)}
            placeholder={lang === 'nb' ? 'Forhold til varsler' : 'Relationship to reporter'}
            className="mt-2 block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => void addAccused()}
            disabled={busy || !newName.trim()}
            className="mt-2 rounded bg-neutral-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
          >
            {lang === 'nb' ? 'Legg til' : 'Add'}
          </button>
        </div>
      )}
    </section>
  )
}
