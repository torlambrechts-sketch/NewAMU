// Per-attendee RSVP editor — used in the Deltakere tab. The chair sets
// accepted/declined/tentative and optionally records a reason; declining
// surfaces a "Aktiver vara" affordance for AT-side seats.

import { useState } from 'react'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { WPSTD_FORM_FIELD_LABEL } from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type { MeetingAttendeeRow, MeetingRsvpStatus, MeetingSide } from '../types'

const STATUS_VARIANT: Record<MeetingRsvpStatus, 'success' | 'danger' | 'warning' | 'neutral'> = {
  accepted: 'success',
  declined: 'danger',
  tentative: 'warning',
  no_response: 'neutral',
}

const STATUS_LABEL: Record<MeetingRsvpStatus, string> = {
  accepted: 'Bekreftet',
  declined: 'Avslått',
  tentative: 'Foreløpig',
  no_response: 'Avventer',
}

const SIDE_LABEL: Record<MeetingSide, string> = {
  employer: 'AG',
  employee: 'AT',
  bht: 'BHT',
  external: 'Ekstern',
  observer: 'Observatør',
}

export function RsvpRosterRow({
  attendee,
  memberName,
  memberRole,
  candidateSubstitutes,
  canManage,
  onSetRsvp,
  onActivateSubstitute,
}: {
  attendee: MeetingAttendeeRow
  memberName: string
  memberRole?: string
  candidateSubstitutes: Array<{ id: string; name: string; side: MeetingSide | null }>
  canManage: boolean
  onSetRsvp: (status: MeetingRsvpStatus, reason: string | null) => Promise<boolean>
  onActivateSubstitute: (substituteMemberId: string) => Promise<boolean>
}) {
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState(attendee.rsvp_reason ?? '')
  const [busy, setBusy] = useState(false)
  const [subPickerOpen, setSubPickerOpen] = useState(false)

  const sameSideSubs = candidateSubstitutes.filter((s) => s.side === attendee.side)

  async function setStatus(status: MeetingRsvpStatus) {
    setBusy(true)
    try {
      const trimmed = reason.trim()
      await onSetRsvp(status, trimmed.length > 0 ? trimmed : null)
      if (status !== 'declined') setReasonOpen(false)
    } finally {
      setBusy(false)
    }
  }

  async function activate(substituteMemberId: string) {
    setBusy(true)
    try {
      await onActivateSubstitute(substituteMemberId)
      setSubPickerOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3 last:border-0 sm:flex-row sm:items-start sm:gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-neutral-900">{memberName}</p>
          {attendee.side ? <Badge variant="info">{SIDE_LABEL[attendee.side]}</Badge> : null}
          <Badge variant={STATUS_VARIANT[attendee.rsvp_status]}>
            {STATUS_LABEL[attendee.rsvp_status]}
          </Badge>
        </div>
        {memberRole ? <p className="text-xs text-neutral-500">{memberRole}</p> : null}
        {attendee.rsvp_reason ? (
          <p className="mt-1 text-[11px] text-neutral-600">«{attendee.rsvp_reason}»</p>
        ) : null}
        {attendee.substitute_for_member_id ? (
          <p className="mt-1 text-[11px] text-emerald-700">
            Vara aktivert
            {attendee.substitute_activated_at
              ? ` ${new Date(attendee.substitute_activated_at).toLocaleDateString('nb-NO')}`
              : ''}
          </p>
        ) : null}
      </div>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={attendee.rsvp_status === 'accepted' ? 'primary' : 'ghost'}
            size="sm"
            disabled={busy}
            onClick={() => void setStatus('accepted')}
          >
            Bekreft
          </Button>
          <Button
            variant={attendee.rsvp_status === 'tentative' ? 'primary' : 'ghost'}
            size="sm"
            disabled={busy}
            onClick={() => void setStatus('tentative')}
          >
            Foreløpig
          </Button>
          <Button
            variant={attendee.rsvp_status === 'declined' ? 'danger' : 'ghost'}
            size="sm"
            disabled={busy}
            onClick={() => setReasonOpen((v) => !v)}
          >
            Avslå
          </Button>
          {attendee.rsvp_status === 'declined' && sameSideSubs.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setSubPickerOpen((v) => !v)}
            >
              Aktiver vara
            </Button>
          ) : null}
        </div>
      ) : null}
      {reasonOpen ? (
        <div className="w-full sm:w-80">
          <label className="block">
            <span className={WPSTD_FORM_FIELD_LABEL}>Begrunnelse</span>
            <StandardTextarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Hvorfor kan ikke medlemmet delta?"
              className="mt-1.5"
            />
          </label>
          <div className="mt-1.5 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReasonOpen(false)}>
              Avbryt
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={busy}
              onClick={() => void setStatus('declined')}
            >
              Lagre avslag
            </Button>
          </div>
        </div>
      ) : null}
      {subPickerOpen ? (
        <div className="w-full rounded-md border border-neutral-200 bg-neutral-50/60 p-2 sm:w-80">
          <p className={WPSTD_FORM_FIELD_LABEL}>Velg vara fra samme side</p>
          <ul className="mt-1.5 space-y-1">
            {sameSideSubs.map((s) => (
              <li key={s.id}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void activate(s.id)}
                  className="w-full justify-start"
                >
                  {s.name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  )
}
