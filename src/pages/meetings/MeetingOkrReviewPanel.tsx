// MeetingOkrReviewPanel — interactive body of the okr_status data binding in
// the meeting Datapakke (H2.2). Lists every KR with health + progress and
// lets attendees record a check-in directly from the meeting; the check-in
// carries meeting_id so planning shows a «fra møte»-chip on the history.

import { useCallback, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { OkrBindingKr } from '../../../modules/meetings/useMeetingDataBindings'
import {
  OKRCheckinDialog,
  type CheckinDialogTarget,
  type CheckinFormPayload,
} from '../../components/okr/OKRCheckinDialog'
import type { Confidence } from '../../components/okr/types'
import { CONFIDENCE_BG, CONFIDENCE_LABEL } from '../../components/okr/types'

function tierOf(confidence: number): Confidence {
  if (confidence >= 0.7) return 'on_track'
  if (confidence >= 0.4) return 'at_risk'
  return 'off_track'
}

const TIER_VALUE: Record<Confidence, number> = {
  on_track: 0.85,
  at_risk: 0.55,
  off_track: 0.25,
}

export function MeetingOkrReviewPanel({
  meetingId,
  rows,
  onChanged,
}: {
  meetingId: string
  rows: OkrBindingKr[]
  onChanged: () => void | Promise<void>
}) {
  const { supabase } = useOrgSetupContext()
  const [target, setTarget] = useState<CheckinDialogTarget | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openCheckin = useCallback((k: OkrBindingKr) => {
    setTarget({
      krId: k.krId,
      krTitle: k.krTitle,
      objectiveTitle: `${k.objectiveLabel} — ${k.objectiveTitle}`,
      currentValue: k.currentValue,
      unit: k.unit,
      confidence: tierOf(k.confidence),
      isRollup: k.isRollup,
    })
  }, [])

  const submit = useCallback(
    async (payload: CheckinFormPayload) => {
      if (!supabase) return
      setError(null)
      const { error: rpcErr } = await supabase.rpc('okr_record_checkin', {
        p_kr_id: payload.krId,
        p_confidence: TIER_VALUE[payload.confidence],
        p_value: payload.value ?? null,
        p_note: payload.note ?? null,
        p_meeting_id: meetingId,
      })
      if (rpcErr) {
        setError(rpcErr.message)
        return
      }
      await onChanged()
    },
    [supabase, meetingId, onChanged],
  )

  if (rows.length === 0) return null

  return (
    <div className="mt-3">
      <ul className="divide-y divide-neutral-200/60 rounded-md border border-neutral-200/80 bg-white">
        {rows.map((k) => {
          const tier = tierOf(k.confidence)
          const pct =
            k.target > 0 ? Math.round((Math.max(0, k.currentValue) / k.target) * 100) : 0
          return (
            <li key={k.krId} className="flex items-center gap-2 px-2.5 py-2">
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white ${CONFIDENCE_BG[tier]}`}
              >
                {CONFIDENCE_LABEL[tier]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-neutral-900" title={k.krTitle}>
                  {k.krTitle}
                </p>
                <p className="text-[10px] text-neutral-500">
                  {k.objectiveLabel} · {Math.min(100, pct)} %
                  {k.isRollup ? ' · beregnes fra oppgaver' : ''}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<CheckCircle2 className="h-3 w-3" />}
                onClick={() => openCheckin(k)}
              >
                Sjekk inn
              </Button>
            </li>
          )
        })}
      </ul>
      {error ? <p className="mt-1.5 text-[11px] text-red-600">{error}</p> : null}
      <OKRCheckinDialog
        open={target !== null}
        target={target}
        onClose={() => setTarget(null)}
        onSubmit={submit}
      />
    </div>
  )
}
