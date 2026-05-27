// AlertsBreakGlassPage — at /alerts/admin/break-glass. Initiate / approve /
// revoke sessions. Two-person rule enforced server-side.

import { useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import type { AlertBreakGlassSessionRow } from '../types'
import { BreakGlassApprovalCard } from '../components/admin/BreakGlassApprovalCard'
import { encryptField, bytesToHex } from '../../../src/lib/alerts/encryption'

export default function AlertsBreakGlassPage() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id
  const [sessions, setSessions] = useState<AlertBreakGlassSessionRow[]>([])
  const [justification, setJustification] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  async function load() {
    if (!supabase || !orgId) return
    const { data } = await supabase
      .from('alert_break_glass_session')
      .select('*')
      .eq('organization_id', orgId)
      .order('initiated_at', { ascending: false })
    setSessions((data ?? []) as AlertBreakGlassSessionRow[])
    const { data: userRow } = await supabase.auth.getUser()
    setCurrentUserId(userRow.user?.id ?? null)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, orgId])

  async function initiate() {
    if (!supabase || !orgId || !justification.trim()) return
    setBusy(true)
    setError(null)
    const enc = await encryptField(supabase, orgId, justification.trim())
    if (!enc) {
      setError('Krypteringsnøkkel mangler for organisasjonen.')
      setBusy(false)
      return
    }
    const { error: rpcErr } = await supabase.rpc('alerts_break_glass_initiate', {
      p_justification_encrypted: bytesToHex(enc.ciphertext),
      p_key_version: enc.version,
    })
    setBusy(false)
    if (rpcErr) {
      setError(rpcErr.message)
      return
    }
    setJustification('')
    await load()
  }

  if (!orgId || !supabase) return null

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Break-the-glass</h1>
      <p className="text-sm text-neutral-600">
        Nødtilgang når det vanlige varslingsutvalget ikke kan brukes (f.eks. når et medlem er anklaget).
        Krever to-personers godkjenning. Aktiv sesjon utløper etter 72 timer.
      </p>

      <div className="rounded border border-amber-300 bg-amber-50 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-amber-900">Initiér ny sesjon</h2>
        <textarea
          rows={4}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Hvorfor er nødtilgang nødvendig?"
          className="block w-full rounded border border-amber-300 px-2 py-1 text-sm"
        />
        {error && <p className="text-xs text-red-700">{error}</p>}
        <button
          type="button"
          onClick={() => void initiate()}
          disabled={busy || !justification.trim()}
          className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Initierer…' : 'Initiér nødtilgang'}
        </button>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Sesjoner</h2>
        {sessions.length === 0 && <p className="text-xs italic text-neutral-500">Ingen sesjoner enda.</p>}
        {sessions.map((s) => {
          if (s.state === 'pending') {
            return (
              <BreakGlassApprovalCard
                key={s.id}
                supabase={supabase}
                session={s}
                currentUserId={currentUserId ?? ''}
                onChanged={() => void load()}
                lang="nb"
              />
            )
          }
          return (
            <div key={s.id} className="rounded border border-neutral-200 bg-white p-3">
              <div className="text-sm font-medium">{s.state}</div>
              <div className="text-xs text-neutral-600">
                Initiert av {s.initiated_by.slice(0, 8)}… · {new Date(s.initiated_at).toLocaleString()}
              </div>
              {s.approved_at && (
                <div className="text-xs text-neutral-600">
                  Godkjent av {s.approved_by?.slice(0, 8)}… · {new Date(s.approved_at).toLocaleString()}
                </div>
              )}
              {s.expires_at && (
                <div className="text-xs text-neutral-600">
                  Utløper {new Date(s.expires_at).toLocaleString()}
                </div>
              )}
              {s.revoke_reason && (
                <p className="mt-1 text-xs italic text-neutral-700">{s.revoke_reason}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
