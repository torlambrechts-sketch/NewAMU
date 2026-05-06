import type { ModuleLegalReference } from '../../src/components/module/ModuleLegalBanner'

/**
 * Legal references for the Task management module.
 *
 * Anchored in arbeidsmiljøloven (AML) and Internkontrollforskriften (IK).
 * Compliance officer sign-off:
 * - Tasks delegated under HMS must be traceable, time-bound and reviewed
 *   (IK-forskriften § 5 nr. 6 + § 5 nr. 7).
 * - Risk-related tasks (kritisk prioritet) trigger the management sign-off
 *   workflow inherited from the existing TasksPage (AML § 4-1, § 4-3).
 * - Personvern: assignees and watchers see only minimum necessary fields
 *   (GDPR Art. 5(1)(c) data minimisation).
 */
export const TASK_MODULE_LEGAL_REFERENCES: ModuleLegalReference[] = [
  {
    code: 'AML § 3-1 — systematisk HMS-arbeid',
    text: (
      <>
        Arbeidsgiver skal sikre at kartlegging, planlegging og oppfølging av tiltak skjer fortløpende.
        Oppgaver i denne modulen er sporbare ledd i den systematiske oppfølgingen.
      </>
    ),
  },
  {
    code: 'AML § 4-1 og § 4-3 — fullt forsvarlig arbeidsmiljø',
    text: (
      <>
        Tiltak rettet mot fysisk og psykososialt arbeidsmiljø skal følges opp med ansvarlig, frist og
        verifisering. Kritiske oppgaver krever ledelsens medsignatur før de kan lukkes.
      </>
    ),
  },
  {
    code: 'IK-forskriften § 5 nr. 6 og 7',
    text: (
      <>
        Avvik og forbedringstiltak skal håndteres systematisk: ansvarlig, frist, gjennomføring og
        evaluering dokumenteres. Modulen knytter hver oppgave til kilde, frist og signatur.
      </>
    ),
  },
  {
    code: 'AML § 6-2 — verneombud',
    text: (
      <>
        Verneombud og tillitsvalgte kan tildeles ansvar eller settes som «watcher» på oppgaver, slik
        at medvirkning er reell og synlig i sporloggen.
      </>
    ),
  },
  {
    code: 'AML § 7-2 — arbeidsmiljøutvalg',
    text: (
      <>
        Tiltak vedtatt i AMU følges opp som oppgaver med kobling til møteprotokoll. Lukkede saker er
        synlige i revisjonsloggen for senere AMU-behandling.
      </>
    ),
  },
  {
    code: 'GDPR Art. 5 nr. 1 c — dataminimering',
    text: (
      <>
        Oppgaver eksponerer kun nødvendige opplysninger om ansvarlig og leder. Kommentarer og
        notater begrenses til arbeidsrelevante forhold.
      </>
    ),
  },
]
