// WatermarkedExportButton — one-click export. Requires recipient + purpose
// before the call. Calls alerts-export-pdf edge function which generates
// the PDF and logs the row in alert_export.

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AlertExportType } from '../../types'

type Props = {
  supabase: SupabaseClient
  caseId: string
  exportType: AlertExportType
  dsarRequestId?: string
  lang: 'nb' | 'en'
}

export function WatermarkedExportButton({ supabase, caseId, exportType, dsarRequestId, lang }: Props) {
  const [open, setOpen] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [purpose, setPurpose] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function execute() {
    if (!recipient.trim() || !purpose.trim()) return
    setBusy(true)
    setError(null)
    const { data, error: invokeError } = await supabase.functions.invoke('alerts-export-pdf', {
      body: {
        caseId,
        exportType,
        recipient,
        purpose,
        dsarRequestId: dsarRequestId ?? null,
      },
    })
    setBusy(false)
    if (invokeError) {
      setError(invokeError.message)
      return
    }
    if (data && typeof data === 'object' && 'error' in data) {
      setError((data as { error: string }).error)
      return
    }
    const ok = data as { signedUrl?: string }
    if (ok.signedUrl) {
      window.open(ok.signedUrl, '_blank', 'noopener,noreferrer')
    }
    setOpen(false)
    setRecipient('')
    setPurpose('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white"
      >
        {lang === 'nb' ? 'Eksporter med vannmerke' : 'Export with watermark'}
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-[420px] p-5 space-y-3">
            <h4 className="text-sm font-semibold">
              {lang === 'nb' ? 'Eksporter sak' : 'Export case'}
            </h4>
            <label className="block text-xs">
              <span className="font-semibold">{lang === 'nb' ? 'Mottaker' : 'Recipient'}</span>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="advokat@eksempel.no"
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold">{lang === 'nb' ? 'Formål' : 'Purpose'}</span>
              <textarea
                rows={3}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
              />
            </label>
            {error && <p className="text-xs text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-neutral-300 px-3 py-1.5 text-xs"
              >
                {lang === 'nb' ? 'Avbryt' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void execute()}
                disabled={busy || !recipient.trim() || !purpose.trim()}
                className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {busy ? '…' : lang === 'nb' ? 'Eksporter' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
