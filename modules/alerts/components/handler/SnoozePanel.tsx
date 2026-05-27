// SnoozePanel — pick snoozed_until + snooze_reason. Hides from "needs
// attention" inbox until the date passes.

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type Props = {
  supabase: SupabaseClient
  caseId: string
  current: { snoozedUntil: string | null; reason: string | null }
  onChanged: () => void
  lang: 'nb' | 'en'
}

export function SnoozePanel({ supabase, caseId, current, onChanged, lang }: Props) {
  const [until, setUntil] = useState(current.snoozedUntil?.slice(0, 16) ?? '')
  const [reason, setReason] = useState(current.reason ?? '')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const { error } = await supabase
      .from('alert_cases')
      .update({
        snoozed_until: until ? new Date(until).toISOString() : null,
        snooze_reason: reason || null,
      })
      .eq('id', caseId)
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    onChanged()
  }

  async function clear() {
    setBusy(true)
    await supabase
      .from('alert_cases')
      .update({ snoozed_until: null, snooze_reason: null })
      .eq('id', caseId)
    setBusy(false)
    onChanged()
  }

  return (
    <div className="rounded border border-neutral-200 bg-white p-4 space-y-2">
      <h3 className="text-sm font-semibold">{lang === 'nb' ? 'Utsett saken' : 'Snooze case'}</h3>
      <label className="block text-xs">
        <span className="font-semibold">{lang === 'nb' ? 'Utsett til' : 'Snooze until'}</span>
        <input
          type="datetime-local"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
        />
      </label>
      <label className="block text-xs">
        <span className="font-semibold">{lang === 'nb' ? 'Grunn' : 'Reason'}</span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !until}
          className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {lang === 'nb' ? 'Lagre utsettelse' : 'Save snooze'}
        </button>
        {current.snoozedUntil && (
          <button
            type="button"
            onClick={() => void clear()}
            disabled={busy}
            className="rounded border border-neutral-300 px-3 py-1.5 text-xs"
          >
            {lang === 'nb' ? 'Fjern utsettelse' : 'Clear snooze'}
          </button>
        )}
      </div>
    </div>
  )
}
