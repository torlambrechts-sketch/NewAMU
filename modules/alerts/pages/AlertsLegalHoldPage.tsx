// AlertsLegalHoldPage — at /alerts/admin/legal-hold. Lists active holds
// org-wide and provides the impose form keyed by case_id.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import type { AlertLegalHoldRow, AlertLegalHoldReason } from '../types'

export default function AlertsLegalHoldPage() {
  const { supabase, organization } = useOrgSetupContext()
  const [holds, setHolds] = useState<AlertLegalHoldRow[]>([])
  const [reason, setReason] = useState<AlertLegalHoldReason>('regulatory')
  const [caseIdInput, setCaseIdInput] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!supabase || !organization?.id) return
    const { data } = await supabase
      .from('alert_legal_hold')
      .select('*')
      .eq('organization_id', organization.id)
      .order('imposed_at', { ascending: false })
    setHolds((data ?? []) as AlertLegalHoldRow[])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, organization?.id])

  async function impose() {
    if (!supabase || !organization?.id || !caseIdInput.trim() || !reference.trim()) return
    setBusy(true)
    setError(null)
    const { data: userRow } = await supabase.auth.getUser()
    const { error: insErr } = await supabase.from('alert_legal_hold').insert({
      case_id: caseIdInput.trim(),
      organization_id: organization.id,
      reason,
      reference: reference.trim(),
      imposed_by: userRow.user?.id ?? null,
      notes: notes || null,
    })
    setBusy(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setCaseIdInput('')
    setReference('')
    setNotes('')
    await load()
  }

  async function release(id: string) {
    if (!supabase) return
    setBusy(true)
    const { data: userRow } = await supabase.auth.getUser()
    await supabase
      .from('alert_legal_hold')
      .update({ released_at: new Date().toISOString(), released_by: userRow.user?.id ?? null })
      .eq('id', id)
    setBusy(false)
    await load()
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Beskyttelseshold (legal hold)</h1>
      <p className="text-sm text-neutral-600">
        Et hold suspenderer retensjons-sletting på en sak. Hold må oppheves manuelt.
      </p>
      <div className="rounded border border-neutral-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold">Innfør hold</h2>
        <input
          type="text"
          value={caseIdInput}
          onChange={(e) => setCaseIdInput(e.target.value)}
          placeholder="Saks-id (UUID)"
          className="block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as AlertLegalHoldReason)}
          className="block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="regulatory">Tilsynssak</option>
          <option value="criminal">Straffesak</option>
          <option value="litigation">Sivilsak</option>
          <option value="internal_review">Intern revisjon</option>
        </select>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Referanse / saksnr."
          className="block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notater (valgfritt)"
          className="block w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        {error && <p className="text-xs text-red-700">{error}</p>}
        <button
          type="button"
          onClick={() => void impose()}
          disabled={busy || !caseIdInput.trim() || !reference.trim()}
          className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          Innfør hold
        </button>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Alle hold</h2>
        {holds.length === 0 && <p className="text-xs italic text-neutral-500">Ingen hold registrert.</p>}
        {holds.map((h) => (
          <div
            key={h.id}
            className={`rounded border p-3 ${h.released_at ? 'border-neutral-200 bg-neutral-50' : 'border-red-300 bg-red-50'}`}
          >
            <div className="flex justify-between items-center">
              <div>
                <Link to={`/alerts/${h.case_id}`} className="font-mono text-xs underline">
                  {h.case_id.slice(0, 8)}…
                </Link>
                <div className="text-sm font-medium">{h.reason} — {h.reference}</div>
                <div className="text-[10px] text-neutral-500">
                  Innført {new Date(h.imposed_at).toLocaleString()}
                  {h.released_at && ` · Opphevet ${new Date(h.released_at).toLocaleString()}`}
                </div>
              </div>
              {!h.released_at && (
                <button
                  type="button"
                  onClick={() => void release(h.id)}
                  disabled={busy}
                  className="rounded border border-neutral-300 px-3 py-1 text-xs"
                >
                  Opphev
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
