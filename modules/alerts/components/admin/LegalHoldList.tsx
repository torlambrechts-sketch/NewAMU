// LegalHoldList — per-case legal-hold history with impose / release controls.

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AlertLegalHoldRow, AlertLegalHoldReason } from '../../types'

type Props = {
  supabase: SupabaseClient
  caseId: string
  orgId: string
  lang: 'nb' | 'en'
}

const REASON_OPTIONS: Array<{ value: AlertLegalHoldReason; label: { nb: string; en: string } }> = [
  { value: 'criminal',       label: { nb: 'Straffesak',                 en: 'Criminal case' } },
  { value: 'litigation',     label: { nb: 'Sivilsak',                   en: 'Civil litigation' } },
  { value: 'regulatory',     label: { nb: 'Tilsynssak',                 en: 'Regulatory case' } },
  { value: 'internal_review',label: { nb: 'Intern revisjon',            en: 'Internal review' } },
]

export function LegalHoldList({ supabase, caseId, orgId, lang }: Props) {
  const [holds, setHolds] = useState<AlertLegalHoldRow[]>([])
  const [reason, setReason] = useState<AlertLegalHoldReason>('regulatory')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('alert_legal_hold')
      .select('*')
      .eq('case_id', caseId)
      .order('imposed_at', { ascending: false })
    setHolds((data ?? []) as AlertLegalHoldRow[])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  async function impose() {
    if (!reference.trim()) return
    setBusy(true)
    const { data: userRow } = await supabase.auth.getUser()
    const { error } = await supabase.from('alert_legal_hold').insert({
      case_id: caseId,
      organization_id: orgId,
      reason,
      reference: reference.trim(),
      imposed_by: userRow.user?.id ?? null,
      notes: notes || null,
    })
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    setReference('')
    setNotes('')
    await load()
  }

  async function release(holdId: string) {
    setBusy(true)
    const { data: userRow } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('alert_legal_hold')
      .update({ released_at: new Date().toISOString(), released_by: userRow.user?.id ?? null })
      .eq('id', holdId)
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    await load()
  }

  return (
    <section className="space-y-3 rounded border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-semibold">{lang === 'nb' ? 'Beskyttelseshold' : 'Legal hold'}</h3>
      {holds.length === 0 && (
        <p className="text-xs text-neutral-500">{lang === 'nb' ? 'Ingen hold registrert.' : 'No holds recorded.'}</p>
      )}
      {holds.map((h) => (
        <div key={h.id} className={`rounded border p-3 ${h.released_at ? 'border-neutral-200 bg-neutral-50' : 'border-red-300 bg-red-50'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">
                {REASON_OPTIONS.find((r) => r.value === h.reason)?.label[lang] ?? h.reason}
              </div>
              <div className="text-xs text-neutral-600">Referanse: {h.reference}</div>
              <div className="text-[10px] text-neutral-500">
                {lang === 'nb' ? 'Innført' : 'Imposed'} {new Date(h.imposed_at).toLocaleString()}
              </div>
              {h.released_at && (
                <div className="text-[10px] text-neutral-500">
                  {lang === 'nb' ? 'Opphevet' : 'Released'} {new Date(h.released_at).toLocaleString()}
                </div>
              )}
              {h.notes && <p className="mt-1 text-xs italic text-neutral-700">{h.notes}</p>}
            </div>
            {!h.released_at && (
              <button
                type="button"
                onClick={() => void release(h.id)}
                disabled={busy}
                className="rounded border border-neutral-300 px-2 py-1 text-xs"
              >
                {lang === 'nb' ? 'Opphev' : 'Release'}
              </button>
            )}
          </div>
        </div>
      ))}
      <div className="rounded border border-dashed border-neutral-300 p-3 space-y-2">
        <div className="text-xs font-semibold">{lang === 'nb' ? 'Innfør nytt hold' : 'Impose new hold'}</div>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as AlertLegalHoldReason)}
          className="block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        >
          {REASON_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label[lang]}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={lang === 'nb' ? 'Referanse (saksnr., journalnr.)' : 'Reference'}
          className="block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={lang === 'nb' ? 'Notater (valgfritt)' : 'Notes (optional)'}
          className="block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => void impose()}
          disabled={busy || !reference.trim()}
          className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {lang === 'nb' ? 'Innfør hold' : 'Impose hold'}
        </button>
      </div>
    </section>
  )
}
