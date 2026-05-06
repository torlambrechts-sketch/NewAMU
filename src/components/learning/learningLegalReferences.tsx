import type { ModuleLegalReference } from '../module/ModuleLegalBanner'

/** Regelverk for e-læring — brukt i {@link ModuleLegalBanner} (samme mønster som ROS/SJA/Survey). */
export const LEARNING_MODULE_LEGAL_REFERENCES: ModuleLegalReference[] = [
  {
    code: 'AML § 3-2',
    text: (
      <>
        Arbeidsgiver skal sørge for at arbeidstaker får den opplæring, øvelse og instruksjon som er nødvendig
        for å utføre arbeidet på en sikker og forsvarlig måte.
      </>
    ),
  },
  {
    code: 'AML § 6-5',
    text: (
      <>
        Verneombud skal få den opplæringen som er nødvendig for å kunne utføre vervet på en forsvarlig måte —
        minimum 40-timers grunnkurs.
      </>
    ),
  },
  {
    code: 'IK-forskriften § 5 nr. 2',
    text: (
      <>
        Internkontroll innebærer at virksomheten skal sørge for at arbeidstakerne har tilstrekkelige
        kunnskaper og ferdigheter i det systematiske helse-, miljø- og sikkerhetsarbeidet.
      </>
    ),
  },
  {
    code: 'GDPR art. 6(1)(c)',
    text: (
      <>
        Behandling av opplæringsdata har rettslig grunnlag i lovpålagt opplæring (AML, IK-forskriften).
        Personvern by design — kun nødvendig data lagres, og slettes ved opphørt arbeidsforhold.
      </>
    ),
  },
]
