// Public status-check page — query by access_key only. Returns minimal
// data (status, updatedAt, ack_due, public notes). Never exposes
// identity fields. In production, hit through an Edge Function that
// rate-limits via alerts_public_status_throttle.

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { getSupabaseBrowserClient } from '../../../src/lib/supabaseClient'
import { ALERT_STATUS_LABEL } from '../alertsLabels'
import type { AlertStatus } from '../types'

const R = 'rounded-lg'

type StatusResult =
  | { found: false }
  | {
      found: true
      status: AlertStatus
      updatedAt: string
      acknowledgementDueAt: string
      acknowledgedAt: string | null
      closedAt: string | null
      publicNotes: Array<{ body: string; createdAt: string }>
    }

export function PublicAlertStatusPage() {
  const [searchParams] = useSearchParams()
  const initial = searchParams.get('key') ?? ''
  const [key, setKey] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<StatusResult | { error: string } | null>(null)
  const supabase = getSupabaseBrowserClient()

  async function lookup() {
    if (!supabase || !key.trim()) return
    setBusy(true)
    setResult(null)
    // Route through the alerts-public-status Edge Function so the IP-based
    // throttle (§4.1 T4) fires. The function calls public_alert_status
    // internally with service_role after the rate-limit check.
    const { data, error } = await supabase.functions.invoke('alerts-public-status', {
      body: { accessKey: key.trim() },
    })
    setBusy(false)
    if (error) {
      // Fallback: if the function isn't deployed, surface a friendlier message
      // than the raw connection error. The DB RPC is intentionally NOT called
      // directly so the throttle is never bypassed.
      setResult({ error: 'Tjenesten er midlertidig utilgjengelig. Prøv igjen om litt.' })
      return
    }
    if (data && typeof data === 'object' && 'error' in data) {
      const errBody = data as { error: string; retryAfterSec?: number }
      setResult({
        error: errBody.error === 'too_many_attempts'
          ? 'For mange forsøk. Vent en time og prøv igjen.'
          : errBody.error,
      })
      return
    }
    setResult(data as StatusResult)
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-4 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-2xl font-semibold text-neutral-900">Status for sak</h1>
        <p className="mt-2 text-sm text-neutral-600">Lim inn saksnøkkelen du fikk ved innsending.</p>
        <div className={`${R} mt-6 space-y-3 border border-neutral-200 bg-white p-5`}>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Saksnøkkel (UUID)"
            className={`${R} w-full border border-neutral-300 px-3 py-2 font-mono text-sm`}
          />
          <button
            type="button"
            onClick={() => void lookup()}
            disabled={busy || !key.trim()}
            className={`${R} w-full bg-[#b91c1c] py-2.5 text-sm font-medium text-white disabled:opacity-50`}
          >
            {busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : 'Hent status'}
          </button>
          {result && 'error' in result ? <p className="text-sm text-red-700">{result.error}</p> : null}
          {result && 'found' in result && result.found === false ? (
            <p className="text-sm text-neutral-600">Ukjent nøkkel.</p>
          ) : null}
          {result && 'found' in result && result.found ? (
            <div className="text-sm text-neutral-800">
              <p>
                <strong>Status:</strong> {ALERT_STATUS_LABEL[result.status] ?? result.status}
              </p>
              <p className="mt-1 text-neutral-600">
                Sist oppdatert: {new Date(result.updatedAt).toLocaleString('no-NO')}
              </p>
              {result.acknowledgedAt ? (
                <p className="mt-1 text-neutral-600">
                  Bekreftet mottak: {new Date(result.acknowledgedAt).toLocaleString('no-NO')}
                </p>
              ) : (
                <p className="mt-1 text-neutral-600">
                  Forventet bekreftelse innen: {new Date(result.acknowledgementDueAt).toLocaleString('no-NO')}
                </p>
              )}
              {result.closedAt ? (
                <p className="mt-1 text-emerald-700">
                  Saken er lukket: {new Date(result.closedAt).toLocaleString('no-NO')}
                </p>
              ) : null}
              {result.publicNotes.length > 0 ? (
                <div className="mt-4 space-y-2 border-t border-neutral-200 pt-3">
                  <p className="text-[10px] font-bold uppercase text-neutral-600">Meldinger fra mottaket</p>
                  {result.publicNotes.map((n, i) => (
                    <div key={i} className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
                      <p className="whitespace-pre-wrap">{n.body}</p>
                      <p className="mt-1 text-[10px] text-neutral-500">
                        {new Date(n.createdAt).toLocaleString('no-NO')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="mt-6 text-center text-xs">
          <Link to="/login" className="text-[#1a3d32] underline">Innlogging</Link>
        </p>
      </div>
    </div>
  )
}
