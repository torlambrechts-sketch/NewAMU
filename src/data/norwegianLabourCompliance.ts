import type { ComplianceItem } from '../types/council'

/**
 * Illustrative checklist themes tied to common topics in Norwegian working-life law.
 * Not legal advice — verify against current lovdata.no and your agreements (Hovedavtalen, etc.).
 */
export const defaultComplianceItems: Omit<ComplianceItem, 'done' | 'notes'>[] = [
  {
    id: 'c1',
    title: 'Arbeidsmiljøutvalg (AMU) der lov eller avtale krever det',
    description:
      'Sikre at AMU er opprettet og sammensatt i tråd med krav (f.eks. antall representanter, møtefrekvens).',
    lawRef: 'Arbeidsmiljøloven kap. 7 (bl.a. §§ 7-1–7-4)',
  },
  {
    id: 'c2',
    title: 'Verneombud og verneområde',
    description:
      'Verneombud skal velges der det er påkrevd; oppgaver og samarbeid med arbeidsgiver skal følges opp.',
    lawRef: 'Arbeidsmiljøloven §§ 6-1–6-4',
  },
  {
    id: 'c3',
    title: 'Bedriftsutvalg / samarbeidsorgan (der størrelse eller avtale tilsier)',
    description:
      'Ved behov: oppretthold møteplan, protokoller og dokumentasjon av drøftinger med ledelsen.',
    lawRef: 'Hovedavtalen / selskapets avtaler; se også regler om informasjon og drøfting',
  },
  {
    id: 'c4',
    title: 'Informasjon og drøfting ved vesentlige endringer',
    description:
      'Kartlegg prosesser ved omorganisering, nedbemanning eller overdragelse (virksomhetsoverdragelse).',
    lawRef: 'Arbeidsmiljøloven § 16-1; lov om virksomhetsoverdragelser mv.',
  },
  {
    id: 'c5',
    title: 'Valg av tillitsvalgte og representanter',
    description:
      'Gjennomfør valg etter demokratiske regler, dokumenter mandatperiode og varsling til arbeidsgiver.',
    lawRef: 'Valgreglement / tariffavtaler; AML kap. 7 for sikkerhetsrepresentasjon',
  },
  {
    id: 'c6',
    title: 'HMS-system og risikovurdering',
    description:
      'Rådet bør sikre at risikovurderinger og tiltak følges opp i samarbeid med verneombud og AMU.',
    lawRef: 'Arbeidsmiljøloven §§ 3-1, 5-1',
  },
  {
    id: 'c7',
    title: 'Møteprotokoller og journal',
    description:
      'Arkiver innkalling, agenda, protokoll og beslutninger fra rådsmøter og valg.',
    lawRef: 'Interne retningslinjer; dokumentasjonskrav i avtaler',
  },
]
