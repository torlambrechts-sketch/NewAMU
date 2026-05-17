// Compact countdown pills for case timing constraints.
//
// - AlertGdprDeadlineBadge: GDPR Art. 33 72-hour Datatilsynet clock for
//   kind='gdpr_breach' cases. Green when >24h left, amber 12–24h, red <12h
//   or expired.
// - AlertAcknowledgementBadge: AML § 2A-3 5-virkedager kvittering. Green
//   when acknowledged, amber when within 24h of due, red when overdue.

import { useMemo } from 'react'
import { Badge } from '../../../src/components/ui/Badge'
import type { AlertCaseRow } from '../types'

type BadgeProps = { case_: AlertCaseRow }

function diffHours(future: string | null | undefined, from: Date = new Date()): number | null {
  if (!future) return null
  const ms = new Date(future).getTime() - from.getTime()
  if (Number.isNaN(ms)) return null
  return ms / 36e5
}

function fmtRemaining(hours: number): string {
  if (hours <= 0) {
    const overdueH = Math.abs(hours)
    if (overdueH < 1) return 'over frist'
    if (overdueH < 24) return `${Math.floor(overdueH)}t over`
    return `${Math.floor(overdueH / 24)}d over`
  }
  if (hours < 1) return `${Math.floor(hours * 60)}min`
  if (hours < 24) return `${Math.floor(hours)}t`
  return `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}t`
}

export function AlertGdprDeadlineBadge({ case_ }: BadgeProps) {
  const hours = useMemo(() => diffHours(case_.investigation_due_at), [case_.investigation_due_at])
  if (case_.kind !== 'gdpr_breach' || hours == null) return null

  const reported = !!case_.datatilsynet_reported_at
  if (reported) {
    const wasInTime = (case_.datatilsynet_reported_at as string) <= (case_.investigation_due_at as string)
    return (
      <Badge variant={wasInTime ? 'success' : 'high'}>
        {wasInTime ? 'Datatilsynet meldt i tide' : 'Datatilsynet meldt for sent'}
      </Badge>
    )
  }
  const variant = hours <= 0 ? 'critical' : hours < 12 ? 'high' : hours < 24 ? 'warning' : 'info'
  const label = hours <= 0 ? `72t frist passert (${fmtRemaining(hours)})` : `72t-frist: ${fmtRemaining(hours)} igjen`
  return <Badge variant={variant}>{label}</Badge>
}

export function AlertAcknowledgementBadge({ case_ }: BadgeProps) {
  const hours = useMemo(() => diffHours(case_.acknowledgement_due_at), [case_.acknowledgement_due_at])
  if (case_.acknowledged_at) {
    const wasInTime = case_.acknowledged_at <= case_.acknowledgement_due_at
    return (
      <Badge variant={wasInTime ? 'success' : 'warning'}>
        {wasInTime ? 'Kvittert i tide' : 'Kvittert for sent'}
      </Badge>
    )
  }
  if (hours == null) return null
  const variant = hours <= 0 ? 'critical' : hours < 24 ? 'warning' : 'info'
  const label = hours <= 0 ? `Kvittering forsinket (${fmtRemaining(hours)})` : `Kvittering om ${fmtRemaining(hours)}`
  return <Badge variant={variant}>{label}</Badge>
}
