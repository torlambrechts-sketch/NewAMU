import type { ModuleLegalReference } from '../../src/components/module/ModuleLegalBanner'

/** Regelverk for organisasjonsundersøkelser — brukt i {@link ModuleLegalBanner} (samme mønster som ROS/SJA). */
export const SURVEY_MODULE_LEGAL_REFERENCES: ModuleLegalReference[] = [
  {
    code: 'AML § 3-1 og § 4-3',
    text: (
      <>
        Arbeidsgiver skal kartlegge risiko for sykdom og skade, herunder psykososiale forhold, og bruke anerkjente
        kartleggingsverktøy der det trengs.
      </>
    ),
  },
  {
    code: 'AML § 7-2 og vernombud',
    text: (
      <>
        Resultater fra organisasjonsundersøkelser skal fremlegges for vernombudet. Lignende fremleggelse for
        arbeidsmiljøutvalget når slikt finnes.
      </>
    ),
  },
  {
    code: 'Personopplysningsloven / GDPR',
    text: (
      <>
        Personvern by design (Art. 25): anonyme undersøkelser lagrer ikke svar knyttet til identifiserbare brukere;
        små grupper maskeres for å beskytte enkeltpersoner.
      </>
    ),
  },
  {
    code: 'Åpenhetsloven § 4',
    text: (
      <>
        Dokumentasjon fra leverandører om anstendige arbeidsforhold kan innhentes gjennom egenerklæringer og
        oppfølging av underleverandørkjeder.
      </>
    ),
  },
]

/** Noen flere pekere for detaljsiden (AMU, tiltak) — vist sammen med modulbanneret. */
export const SURVEY_DETAIL_EXTRA_LEGAL_REFERENCES: ModuleLegalReference[] = [
  {
    code: 'AML § 7-2 (2)(e) · AMU',
    text: (
      <>Undersøkelsesresultater skal fremlegges for arbeidsmiljøutvalget der slikt finnes, og følges opp i protokoll.</>
    ),
  },
  {
    code: 'IK-forskriften § 5',
    text: (
      <>Systematisk HMS-arbeid: kartlegging, vurdering, tiltak og oppfølging — inkl. dokumentasjon av undersøkelser og tiltak.</>
    ),
  },
]
