// Legal references for the meetings module, consumed by <ModuleLegalBanner>.
// One entry per lovregime/standard the module touches. The dashboard
// drill-down + compliance planner pick these up via exact-string match
// against meeting_system_templates.law_refs[].

import type { ModuleLegalReference } from '../../src/components/module/ModuleLegalBanner'

export const MEETINGS_LEGAL_REFERENCES: ModuleLegalReference[] = [
  {
    code: 'AML § 7-2',
    text: 'Arbeidsmiljøutvalg — kvartalsvise møter, § 7-2 (2) årlige tema og § 7-2 (6) årsrapport.',
  },
  {
    code: 'AML § 6-2',
    text: 'Verneombud — møter og medvirkning. Kvartalsvis kadens.',
  },
  {
    code: 'AML § 8-2 / § 15-1',
    text: 'Drøftingsplikt ved omstilling og før beslutninger om arbeidsforhold.',
  },
  {
    code: 'AML § 2A-7 (5)',
    text: 'Varslingsutvalg. Konfidensielle møter med taushetsplikt og COI-vurdering.',
  },
  {
    code: 'IK-forskriften § 5 nr. 7',
    text: 'Systematisk dokumentasjon av møter, vedtak og oppfølging.',
  },
  {
    code: 'Forskrift om org. ledelse § 3-2',
    text: 'Minst 7 dagers innkallingsfrist for AMU og verneombudsmøter.',
  },
  {
    code: 'Likestillingsloven § 26 / § 26a',
    text: 'Årlig drøfting med aktivitetsplikt og lønnskartlegging.',
  },
  {
    code: 'Hovedavtalen § 9-3',
    text: 'Bedriftsutvalg og drøftingsmøter for tariffbundne virksomheter.',
  },
  {
    code: 'ISO 9001 / 14001 / 27001 / 45001 § 9.3',
    text: 'Ledelsens gjennomgang — årlig dekning av styringssystemet.',
  },
  {
    code: 'GDPR Art. 30 / 35',
    text: 'ROPA-årsgjennomgang og DPIA-møter.',
  },
]
