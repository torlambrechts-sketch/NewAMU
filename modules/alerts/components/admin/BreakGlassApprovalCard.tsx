// BreakGlassApprovalCard — shows a pending session with approve / revoke
// controls. Requires the caller to be different from initiator.

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AlertBreakGlassSessionRow } from '../../types'

type Props = {
  supabase: SupabaseClient
  session: AlertBreakGlassSessionRow
  currentUserId: string
  onChanged: () => void
  lang: 'nb' | 'en'
}

export function BreakGlassApprovalCard({ supabase, session, currentUserId, onChanged, lang }: Props) {
  const [busy, setBusy] = useState(false)
  const [revokeReason, setRevokeReason] = useState('')

  async function approve() {
    setBusy(true)
    const { error } = await supabase.rpc('alerts_break_glass_approve', { p_session_id: session.id })
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    onChanged()
  }

  async function revoke() {
    if (!revokeReason.trim()) return
    setBusy(true)
    const { error } = await supabase.rpc('alerts_break_glass_revoke', {
      p_session_id: session.id,
      p_reason: revokeReason,
    })
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    onChanged()
  }

  const isSameUser = session.initiated_by === currentUserId

  return (
    <div className="rounded border-2 border-red-300 bg-red-50 p-4">
      <div className="text-sm font-semibold text-red-900">
        {lang === 'nb' ? 'Break-the-glass: ventende godkjenning' : 'Break-the-glass: pending approval'}
      </div>
      <div className="mt-1 text-xs text-red-800">
        {lang === 'nb' ? 'Initiert av' : 'Initiated by'}: {session.initiated_by.slice(0, 8)}…
      </div>
      <div className="text-xs text-red-800">
        {lang === 'nb' ? 'Tidspunkt' : 'When'}: {new Date(session.initiated_at).toLocaleString()}
      </div>
      <p className="mt-2 text-xs italic text-red-800">
        {lang === 'nb'
          ? 'Begrunnelse er kryptert. Bekreft i samråd med initierende person via egen kanal.'
          : 'Justification is encrypted. Confirm with initiator via a separate channel.'}
      </p>
      {session.state === 'pending' && !isSameUser && (
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={() => void approve()}
            disabled={busy}
            className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {lang === 'nb' ? 'Godkjenn (aktiver 72t)' : 'Approve (activate 72h)'}
          </button>
          <div className="mt-2">
            <input
              type="text"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder={lang === 'nb' ? 'Grunn for å avvise' : 'Reason to deny'}
              className="block w-full rounded border border-neutral-300 px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => void revoke()}
              disabled={busy || !revokeReason.trim()}
              className="mt-1 rounded border border-red-300 px-3 py-1.5 text-xs text-red-800"
            >
              {lang === 'nb' ? 'Avvis' : 'Deny'}
            </button>
          </div>
        </div>
      )}
      {session.state === 'pending' && isSameUser && (
        <p className="mt-3 text-xs italic text-red-800">
          {lang === 'nb'
            ? 'Du initierte denne sesjonen. En annen styrerepresentant må godkjenne.'
            : 'You initiated this session. A different board user must approve.'}
        </p>
      )}
    </div>
  )
}
