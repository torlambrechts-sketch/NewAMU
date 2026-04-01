import type { LaborMetricKey } from '../types/orgHealth'

/**
 * Illustrative organizational / AML-aligned indicators.
 * Adjust to IA-system and tariff — not legal advice.
 */
export type MetricDefinition = {
  key: LaborMetricKey
  label: string
  description: string
  unit: string
  lawRef: string
}

export const LABOR_METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    key: 'work_environment_assessment',
    label: 'Arbeidsmiljøundersøkelse (oppfølging)',
    description:
      'Status eller resultatscore fra medarbeiderundersøkelse knyttet til psykososialt og fysisk miljø.',
    unit: 'score / status',
    lawRef: 'Arbeidsmiljøloven § 3-1 (systematisk HMS), § 4-3 (kartlegging)',
  },
  {
    key: 'risk_assessment_ros',
    label: 'Risikovurderinger (ROS) oppdatert',
    description: 'Antall gjennomførte / forfalte risikovurderinger i perioden.',
    unit: 'antall',
    lawRef: 'Arbeidsmiljøloven § 3-1',
  },
  {
    key: 'near_miss_reports',
    label: 'Nestenulykker / avvik rapportert',
    description: 'Antall rapporterte hendelser som gir læring før skade.',
    unit: 'antall',
    lawRef: 'Arbeidsmiljøloven § 3-2 (verneprosess)',
  },
  {
    key: 'whistleblower_cases',
    label: 'Varsling (intern)',
    description: 'Antall saker behandlet i varslingssystem (aggregert, uten persondata).',
    unit: 'antall',
    lawRef: 'Arbeidsmiljøloven § 2 A (varsling), lov om arbeidslivets varslingssystemer',
  },
  {
    key: 'training_hours_hms',
    label: 'HMS-opplæring (timer totalt)',
    description: 'Samlede timer opplæring i HMS / verneroller i perioden.',
    unit: 'timer',
    lawRef: 'Arbeidsmiljøloven § 3-2, § 7-2 (samarbeid)',
  },
  {
    key: 'violence_threats',
    label: 'Trusler / vold (rapportert)',
    description: 'Antall meldinger om trusler eller vold (for oppfølging og tiltak).',
    unit: 'antall',
    lawRef: 'Arbeidsmiljøloven § 4-3 (kartlegging), § 4-1 (krav til arbeidsmiljø)',
  },
  {
    key: 'follow_up_sick_leave',
    label: 'Oppfølgingsmøter sykefravær',
    description: 'Antall gjennomførte oppfølgingsmøter etter IA / interne rutiner.',
    unit: 'antall',
    lawRef: 'Arbeidsmiljøloven § 4-6 (tilrettelegging), IA-avtalen der relevant',
  },
]

export function definitionForKey(key: LaborMetricKey): MetricDefinition | undefined {
  return LABOR_METRIC_DEFINITIONS.find((d) => d.key === key)
}
