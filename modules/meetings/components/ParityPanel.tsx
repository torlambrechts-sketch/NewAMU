// AML § 7-1 (2) parity tile + quorum indicator for the meeting.
// Reads server-computed `meeting_parity_check` (RPC) so RLS-filtered
// attendee counts are always trusted.

import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert } from 'lucide-react'
import type { MeetingParityCheck } from '../types'

export function ParityPanel({
  meetingId,
  loader,
  refreshKey,
}: {
  meetingId: string
  loader: (meetingId: string) => Promise<MeetingParityCheck | null>
  refreshKey?: number
}) {
  const [data, setData] = useState<MeetingParityCheck | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Defer initial setState so we don't trigger a cascading render
    // inside the effect's synchronous body.
    const start = window.setTimeout(() => {
      if (!cancelled) setLoading(true)
    }, 0)
    void loader(meetingId).then((res) => {
      if (!cancelled) {
        setData(res)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
      window.clearTimeout(start)
    }
  }, [meetingId, loader, refreshKey])

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3 text-xs text-neutral-500">
        Beregner paritet …
      </div>
    )
  }
  if (!data) return null

  const parityOk = data.parity_ok
  const quorumOk = data.quorum_ok

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div
        className={`rounded-lg border p-3 ${parityOk ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-300 bg-amber-50/60'}`}
      >
        <div className="flex items-center gap-2">
          {parityOk ? (
            <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden />
          ) : (
            <ShieldAlert className="h-4 w-4 text-amber-700" aria-hidden />
          )}
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
            Paritet (AML § 7-1 (2))
          </p>
        </div>
        <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">
          {data.employer_count} : {data.employee_count}
        </p>
        <p className="mt-0.5 text-[11px] text-neutral-600">
          {parityOk
            ? 'Lik representasjon — arbeidsgiver og arbeidstaker'
            : 'Ulik representasjon — vurder vara fra underrepresentert side'}
          {data.bht_count > 0 ? ` · BHT: ${data.bht_count}` : ''}
        </p>
      </div>
      <div
        className={`rounded-lg border p-3 ${quorumOk ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-300 bg-amber-50/60'}`}
      >
        <div className="flex items-center gap-2">
          {quorumOk ? (
            <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden />
          ) : (
            <ShieldAlert className="h-4 w-4 text-amber-700" aria-hidden />
          )}
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
            Beslutningsdyktighet
          </p>
        </div>
        <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">
          {data.total_present_or_accepted}
          <span className="text-base font-medium text-neutral-500"> / {data.quorum_min || '?'}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-neutral-600">
          {quorumOk
            ? 'Quorum oppfylt — møtet er beslutningsdyktig'
            : `Mangler ${Math.max(0, data.quorum_min - data.total_present_or_accepted)} for quorum`}
        </p>
      </div>
    </div>
  )
}
