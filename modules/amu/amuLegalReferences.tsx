import type { ModuleLegalReference } from '../../src/components/module/ModuleLegalBanner'

/**
 * Regelverk for arbeidsmiljøutvalg (AMU).
 *
 * Same pattern as `surveyLegalReferences.tsx` — feeds {@link ModuleLegalBanner}
 * which is wired to the page-shell switch (the «Regelverk»-toggle) so HMS
 * personnel can hide / show the legal context strip while working.
 *
 * Sources:
 *  - Arbeidsmiljøloven (AML) — kap. 2 (varsling), kap. 3 (BHT, opplæring),
 *    kap. 4 (krav til arbeidsmiljø), kap. 5 (registrering), kap. 6
 *    (verneombud), kap. 7 (AMU).
 *  - Forskrift om systematisk helse-, miljø- og sikkerhetsarbeid
 *    (internkontrollforskriften) § 5 nr. 1–8.
 *  - Forskrift om organisering, ledelse og medvirkning § 3-18 (40-timers
 *    HMS-kurs for AMU-medlemmer og verneombud).
 *  - Personopplysningsloven / GDPR (varsling håndteres som personopplysning).
 *  - Forvaltningsloven § 13 / § 11 d (taushetsplikt for utvalgsmedlemmer som
 *    behandler følsomme personopplysninger).
 */
export const AMU_MODULE_LEGAL_REFERENCES: ModuleLegalReference[] = [
  {
    code: 'AML § 7-1 og § 7-2',
    text: (
      <>
        Virksomheter med 50 eller flere arbeidstakere skal ha arbeidsmiljøutvalg, med likt antall
        representanter fra arbeidsgiver- og arbeidstakersiden. AMU skal behandle HMS-arbeidet og
        avholde minst <strong>fire møter per år</strong>; referat skal gjøres tilgjengelig for alle
        ansatte.
      </>
    ),
  },
  {
    code: 'AML § 7-2 (2) og § 7-5',
    text: (
      <>
        AMU behandler HMS-planer, yrkesskader, sykefraværsoppfølging, varsling og bedriftshelse­
        tjenestens rapporter. Ledervervet roterer mellom partene hvert år (§ 7-5).
      </>
    ),
  },
  {
    code: 'IK-forskriften § 5',
    text: (
      <>
        Systematisk HMS-arbeid: kartlegging, vurdering, mål, tiltak og dokumentasjon. AMU skal
        følge opp at virksomheten har <strong>oppdaterte prosedyrer (§ 5 nr. 7)</strong> og
        gjennomgår systemet årlig <strong>(§ 5 nr. 8)</strong>.
      </>
    ),
  },
  {
    code: 'FOR § 3-18 — HMS-kurs',
    text: (
      <>
        AMU-medlemmer og verneombud skal ha <strong>40 timers HMS-opplæring</strong>. Kurset må
        være gyldig for hele mandatperioden; varsling før utløp er en del av virksomhetens
        opplæringsplan.
      </>
    ),
  },
]

/**
 * Ekstra refs til detaljvisninger / live-møte: varsling og personvern, siden møter ofte berører
 * konkrete varslingssaker og personidentifiserbare avvik.
 */
export const AMU_DETAIL_EXTRA_LEGAL_REFERENCES: ModuleLegalReference[] = [
  {
    code: 'AML kap. 2 A — Varsling',
    text: (
      <>
        Arbeidsgiver skal legge til rette for varsling og verne varsler mot gjengjeldelse. AMU skal
        informeres om aggregert varslingsstatistikk (§ 2 A-3) — ikke om personidentifiserbare
        opplysninger.
      </>
    ),
  },
  {
    code: 'Personopplysningsloven · Forvaltningsloven § 13',
    text: (
      <>
        Behandling av varsel, sykefravær og personskader er underlagt taushetsplikt. Utvalgs­
        medlemmer plikter å behandle slike opplysninger med diskresjon (jf. forvaltningsloven § 13
        og GDPR art. 5 og 32).
      </>
    ),
  },
]
