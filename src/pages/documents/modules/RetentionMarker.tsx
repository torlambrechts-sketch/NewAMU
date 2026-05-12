// RetentionMarker — viser oppbevarings­plikt for et dokument.
//
// Hjelper bruker forstå hvor lenge dokumentet skal beholdes og hvilken
// lovhjemmel det springer fra. Compliance-formål: dokumentere
// retention-policy direkte i dokumentet.

import { Archive } from 'lucide-react'

type Props = {
  category?: string
  minYears?: number
  legalRef?: string
}

const CATEGORY_LABEL: Record<string, string> = {
  hms_dokument: 'HMS-dokument',
  personaldokument: 'Personal­dokument',
  opplaeringslogg: 'Opplærings­logg',
  amu_protokoll: 'AMU-protokoll',
  varslingssak: 'Varslings­sak',
  personvern: 'Personvern',
  intern_prosedyre: 'Intern prosedyre',
  okonomidokument: 'Økonomi­dokument',
  eksponering_60ar: 'Eksponerings­register',
  ad_hoc: 'Ad-hoc',
}

export function RetentionMarker({
  category = 'ad_hoc',
  minYears = 1,
  legalRef,
}: Props) {
  const label = CATEGORY_LABEL[category] ?? category
  return (
    <div className="not-prose my-4 flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50/70 px-3 py-2 text-xs text-neutral-700">
      <Archive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" />
      <div>
        <strong>Oppbevaring:</strong> minst {minYears} år ({label})
        {legalRef ? (
          <>
            {' · '}
            <span className="text-neutral-500">{legalRef}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}
