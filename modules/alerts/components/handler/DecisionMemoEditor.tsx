// DecisionMemoEditor — five-section memo editor. Saves encrypted; finalise
// button locks.

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { encryptField, decryptField, bytesToHex, hexToBytes } from '../../../../src/lib/alerts/encryption'

type Props = {
  supabase: SupabaseClient
  caseId: string
  orgId: string
  lang: 'nb' | 'en'
}

type MemoRow = {
  id: string
  facts_encrypted: string | null
  evidence_weighed_encrypted: string | null
  rules_encrypted: string | null
  conclusion_encrypted: string | null
  basis_encrypted: string | null
  finalised_at: string | null
  finalised_by: string | null
}

const SECTIONS: Array<{ key: keyof MemoRow; label: { nb: string; en: string } }> = [
  { key: 'facts_encrypted', label: { nb: 'Fakta', en: 'Facts' } },
  { key: 'evidence_weighed_encrypted', label: { nb: 'Vekting av bevis', en: 'Evidence weighed' } },
  { key: 'rules_encrypted', label: { nb: 'Regler', en: 'Rules' } },
  { key: 'conclusion_encrypted', label: { nb: 'Konklusjon', en: 'Conclusion' } },
  { key: 'basis_encrypted', label: { nb: 'Begrunnelse', en: 'Basis' } },
]

export function DecisionMemoEditor({ supabase, caseId, orgId, lang }: Props) {
  const [memo, setMemo] = useState<MemoRow | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('alert_decision_memo')
        .select('*')
        .eq('case_id', caseId)
        .maybeSingle()
      if (cancelled) return
      const row = (data as MemoRow | null) ?? null
      setMemo(row)
      if (row) {
        const decrypted: Record<string, string> = {}
        for (const sec of SECTIONS) {
          const enc = row[sec.key] as string | null
          if (enc) {
            const bytes = hexToBytes(enc)
            const plain = bytes ? await decryptField(supabase, orgId, bytes) : null
            decrypted[sec.key] = plain ?? ''
          }
        }
        if (!cancelled) setValues(decrypted)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, caseId, orgId])

  async function save(finalise: boolean) {
    setBusy(true)
    const payload: Record<string, string | number | null> = { key_version: 1 }
    for (const sec of SECTIONS) {
      const text = values[sec.key] ?? ''
      if (text.trim()) {
        const enc = await encryptField(supabase, orgId, text)
        if (enc) {
          payload[sec.key] = bytesToHex(enc.ciphertext)
        }
      } else {
        payload[sec.key] = null
      }
    }
    if (finalise) {
      const { data: userRow } = await supabase.auth.getUser()
      payload.finalised_at = new Date().toISOString()
      payload.finalised_by = userRow.user?.id ?? null
    }
    if (memo) {
      const { error } = await supabase.from('alert_decision_memo').update(payload).eq('id', memo.id)
      if (error) alert(error.message)
    } else {
      const { data: userRow } = await supabase.auth.getUser()
      const { error } = await supabase.from('alert_decision_memo').insert({
        ...payload,
        case_id: caseId,
        organization_id: orgId,
        drafted_by: userRow.user?.id ?? null,
      })
      if (error) alert(error.message)
    }
    setBusy(false)
    // Reload to get finalised_at updated.
    const { data } = await supabase
      .from('alert_decision_memo')
      .select('*')
      .eq('case_id', caseId)
      .maybeSingle()
    setMemo((data as MemoRow | null) ?? null)
  }

  const isLocked = memo?.finalised_at != null

  return (
    <section className="space-y-3 rounded border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold">{lang === 'nb' ? 'Vedtaksnotat' : 'Decision memo'}</h3>
      {isLocked && (
        <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {lang === 'nb' ? 'Notatet er låst — finalisert' : 'Memo locked — finalised'} {new Date(memo!.finalised_at!).toLocaleString()}
        </p>
      )}
      {SECTIONS.map((sec) => (
        <label key={sec.key} className="block text-xs">
          <span className="font-semibold">{sec.label[lang]}</span>
          <textarea
            rows={4}
            value={values[sec.key] ?? ''}
            disabled={isLocked}
            onChange={(e) => setValues({ ...values, [sec.key]: e.target.value })}
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
          />
        </label>
      ))}
      {!isLocked && (
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
            onClick={() => {
              if (confirm(lang === 'nb' ? 'Finalisere? Kan ikke endres etterpå.' : 'Finalise? Cannot be edited after.')) {
                void save(true)
              }
            }}
            disabled={busy}
            className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {lang === 'nb' ? 'Finalisere' : 'Finalise'}
          </button>
        </div>
      )}
    </section>
  )
}
