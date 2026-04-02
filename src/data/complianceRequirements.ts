import type { ComplianceRequirement } from '../types/documents'

/** Illustrative requirements — verify against lovdata.no and your sector. */
export const DEFAULT_COMPLIANCE_REQUIREMENTS: ComplianceRequirement[] = [
  {
    id: 'req-ik-5',
    label: 'Internkontroll: skriftlig dokumentasjon av systematisk HMS-arbeid',
    lawRef: 'Forskrift om internkontroll (§ 5)',
    category: 'HMS',
  },
  {
    id: 'req-aml-43',
    label: 'Kartlegging av arbeidsmiljø (risikovurdering der nødvendig)',
    lawRef: 'Arbeidsmiljøloven § 4-3',
    category: 'HMS',
  },
  {
    id: 'req-varsling',
    label: 'Rutiner for mottak og oppfølging av varsler',
    lawRef: 'Lov om arbeidslivets varslingssystemer',
    category: 'Varsling',
  },
  {
    id: 'req-amu-7',
    label: 'Samarbeid om arbeidsmiljø (AMU der pliktig)',
    lawRef: 'Arbeidsmiljøloven kap. 7',
    category: 'Samarbeid',
  },
]
