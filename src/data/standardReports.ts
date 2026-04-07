export type StandardReportId =
  | 'amu_annual'
  | 'annual_ik'
  | 'arp'
  | 'sick_privacy'
  | 'training_incidents'
  | 'cost_friction'
  | 'compliance_score'

export type StandardReportCategory = {
  id: string
  title: string
  reports: {
    id: StandardReportId
    title: string
    description: string
  }[]
}

export const STANDARD_REPORT_CATEGORIES: StandardReportCategory[] = [
  {
    id: 'statutory',
    title: 'Lovpålagte rapporter',
    reports: [
      {
        id: 'amu_annual',
        title: 'AMU årsrapport',
        description:
          'Møter, hendelser, sykefravær, opplæring og tiltak — samlet for arbeidsmiljøutvalget.',
      },
      {
        id: 'annual_ik',
        title: 'Årlig gjennomgang (IK § 5.8)',
        description: 'Systematisk gjennomgang av HMS: dokumenter, vernerunder, ROS og mål.',
      },
      {
        id: 'arp',
        title: 'ARP — aktivitets- og redegjørelsesplikt',
        description: 'Likestilling og rekruttering: kjønn, lønn, deltid og permisjon der data finnes.',
      },
    ],
  },
  {
    id: 'privacy_analytics',
    title: 'Personvern og analyse',
    reports: [
      {
        id: 'sick_privacy',
        title: 'Sykefravær per avdeling (k-anonymitet)',
        description: 'Test av anonymitetsgrense — rader skjules når avdelingen er for liten.',
      },
      {
        id: 'training_incidents',
        title: 'Opplæring vs. hendelser',
        description: 'Kryssmodul-indikator: sammenheng mellom HMS-opplæring og hendelser (illustrativ).',
      },
      {
        id: 'cost_friction',
        title: 'Cost of friction',
        description: 'Estimert økonomisk tap fra fravær og hendelser med org.timepris.',
      },
      {
        id: 'compliance_score',
        title: 'Compliance-score',
        description: 'Aggregert samsvarspoeng fra materialisert visning — kan oppdateres manuelt.',
      },
    ],
  },
]
