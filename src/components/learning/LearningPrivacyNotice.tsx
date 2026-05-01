import { useState } from 'react'
import { Link } from 'react-router-dom'
import { InfoBox } from '../ui/AlertBox'
import { Button } from '../ui/Button'
import { isLearningPrivacyAcknowledged, setLearningPrivacyAcknowledged } from '../../lib/learningPrivacyAck'

/** GDPR Art. 13 — first session notice for learning data collection (GAP-C08). */
export function LearningPrivacyNotice() {
  const [open, setOpen] = useState(() => !isLearningPrivacyAcknowledged())

  if (!open) return null

  return (
    <div className="mb-6">
      <InfoBox>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1 text-sm text-amber-900">
            <p className="font-medium">Behandling av opplæringsdata</p>
            <p>
              Klarert lagrer din læringsfremdrift, kursresultater og kursbevis på vegne av arbeidsgiveren som ledd i
              dokumentasjon av opplæring (AML § 3-1, IK-forskriften § 5). Grunnlaget er arbeidsavtalen (GDPR art. 6(1)(b)).
              Du kan be om innsyn eller sletting hos dataansvarlig i organisasjonen. Mer om innstillinger:{' '}
              <Link to="/learning/settings" className="font-medium underline">
                E-læring — innstillinger
              </Link>
              .
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setLearningPrivacyAcknowledged()
              setOpen(false)
            }}
          >
            Jeg forstår
          </Button>
        </div>
      </InfoBox>
    </div>
  )
}
