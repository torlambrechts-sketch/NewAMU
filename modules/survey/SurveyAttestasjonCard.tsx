// SurveyAttestasjonCard — surfaces "X of Y completed" + the per-survey
// k-anonymity threshold so admins can see at a glance whether a survey
// has reached the publish bar (anonymous packs) or how many recipients
// have attested (identified packs like leverandørkontroll).
//
// Used on SurveyDetailView's Oversikt tab; designed to be lifted into
// the per-vendor reporting page (/vendors) without changes.

import { useMemo } from 'react'
import { CheckCircle2, Lock, Users } from 'lucide-react'
import { Badge } from '../../src/components/ui/Badge'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import type { SurveyInvitationRow, SurveyRow } from './types'

type Props = {
  s: Pick<SurveyRow, 'is_anonymous' | 'anonymity_threshold' | 'status'>
  invitations: ReadonlyArray<Pick<SurveyInvitationRow, 'status'>>
  responseCount: number
}

export function SurveyAttestasjonCard({ s, invitations, responseCount }: Props) {
  const stats = useMemo(() => {
    const total = invitations.length
    const completed = invitations.filter((i) => i.status === 'completed').length
    const denominator = total > 0 ? total : responseCount
    const numerator = total > 0 ? completed : responseCount
    const pct = denominator > 0 ? Math.min(100, Math.round((numerator / denominator) * 100)) : 0
    return { total, completed, denominator, numerator, pct }
  }, [invitations, responseCount])

  const thresholdMet = responseCount >= s.anonymity_threshold
  const remaining = Math.max(0, s.anonymity_threshold - responseCount)
  const isClosed = s.status === 'closed'

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#1a3d32]" aria-hidden />
          <div>
            <p className="text-sm font-medium text-neutral-800">
              {s.is_anonymous ? 'Deltakelse & k-anonymitet' : 'Attestasjon & deltakelse'}
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              {s.is_anonymous
                ? `Resultater kan publiseres når minst ${s.anonymity_threshold} respondenter har svart (k-anonymitet).`
                : 'Hver inviterte mottaker registreres som attestert når undersøkelsen er fullført.'}
            </p>
          </div>
        </div>
        {isClosed ? (
          <Badge variant="neutral">
            <Lock className="mr-1 inline h-3 w-3" aria-hidden /> Lukket
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-neutral-900">
          {stats.numerator}
        </span>
        <span className="text-sm text-neutral-500">
          {stats.denominator > 0 ? `av ${stats.denominator} ${s.is_anonymous ? 'svar' : 'attestert'}` : 'svar registrert'}
        </span>
        {stats.denominator > 0 ? (
          <span className="ml-1 text-sm font-medium text-neutral-700">({stats.pct}%)</span>
        ) : null}
      </div>

      {stats.denominator > 0 ? (
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={stats.denominator}
          aria-valuenow={stats.numerator}
        >
          <div
            className={
              'h-full rounded-full ' +
              (thresholdMet ? 'bg-emerald-500' : 'bg-[#1a3d32]')
            }
            style={{ width: `${stats.pct}%` }}
          />
        </div>
      ) : null}

      {s.is_anonymous ? (
        <div className="mt-4 flex items-center gap-2 text-sm">
          {thresholdMet ? (
            <Badge variant="success">
              <CheckCircle2 className="mr-1 inline h-3 w-3" aria-hidden /> Terskel oppfylt (k≥{s.anonymity_threshold})
            </Badge>
          ) : (
            <Badge variant="warning">
              {remaining === 1 ? '1 svar mangler' : `${remaining} svar mangler`} til k≥{s.anonymity_threshold}
            </Badge>
          )}
        </div>
      ) : null}
    </ModuleSectionCard>
  )
}
