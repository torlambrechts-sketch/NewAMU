import type { AmlReportKind } from '../types/orgHealth'

/** Illustrative mapping to AML themes — not legal advice. */
export const AML_REPORT_KINDS: {
  id: AmlReportKind
  label: string
  hint: string
}[] = [
  {
    id: 'work_injury_illness',
    label: 'Arbeidsskade / sykdom',
    hint: 'Hendelser knyttet til arbeidsskade eller yrkessykdom (jf. AML kap. om varsling og oppfølging).',
  },
  {
    id: 'near_miss',
    label: 'Nestenulykke',
    hint: 'Forhold som kunne ført til personskade (ROS, avvik).',
  },
  {
    id: 'harassment_discrimination',
    label: 'Trakassering / diskriminering',
    hint: 'Uønsket atferd knyttet til kjønn, alder, etnisitet, funksjonsevne m.m.',
  },
  {
    id: 'violence_threat',
    label: 'Vold / trusler',
    hint: 'Fysisk vold, trakassering med voldspotensial, trusler på arbeidsplassen.',
  },
  {
    id: 'psychosocial',
    label: 'Psykososialt arbeidsmiljø',
    hint: 'Belastning, mobbing, organisatoriske forhold som påvirker helse.',
  },
  {
    id: 'whistleblowing',
    label: 'Varsling (kritikkverdige forhold)',
    hint: 'Varsling om lovbrudd eller alvorlige kritikkverdige forhold i virksomheten.',
  },
  {
    id: 'other',
    label: 'Annet (AML-relevant)',
    hint: 'Øvrige forhold som bør følges opp etter interne rutiner.',
  },
]

export function labelForAmlReportKind(kind: AmlReportKind): string {
  return AML_REPORT_KINDS.find((k) => k.id === kind)?.label ?? kind
}
