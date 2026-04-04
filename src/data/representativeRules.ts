/**
 * Illustrative role requirements for AMU / employee representation (Norway).
 * Adjust to your tariff agreement and company size — not legal advice.
 */

export type RequirementCategory = 'training' | 'documentation' | 'process'

export type RoleRequirement = {
  id: string
  roleKeys: string[]
  title: string
  description: string
  category: RequirementCategory
  lawRef: string
}

/** Role keys must match RepresentativeOfficeRole in types */
export const REPRESENTATIVE_ROLE_REQUIREMENTS: RoleRequirement[] = [
  {
    id: 'req-train-amu',
    roleKeys: [
      'employee_chair',
      'employee_deputy',
      'employee_member',
      'leadership_chair',
      'leadership_deputy',
      'leadership_member',
    ],
    title: 'Opplæring i samarbeid og arbeidsmiljø',
    description:
      'Medlemmer i arbeidsmiljøutvalget bør ha opplæring som gir tilfredsstillende kunnskap om arbeidsmiljøarbeid og samarbeid (typisk gjennomført eller planlagt).',
    category: 'training',
    lawRef: 'Arbeidsmiljøloven § 7-2 (samarbeid om arbeidsmiljøarbeid)',
  },
  {
    id: 'req-train-safety',
    roleKeys: ['employee_chair', 'employee_deputy', 'employee_member'],
    title: 'Kunnskap om HMS og vernerollen',
    description:
      'Sikre at arbeidstakerrepresentanter forstår verneombudets rolle og samspillet i AMU.',
    category: 'training',
    lawRef: 'Arbeidsmiljøloven kap. 7 (verneombud, AMU)',
  },
  {
    id: 'req-doc-election',
    roleKeys: ['employee_chair', 'employee_deputy', 'employee_member'],
    title: 'Dokumentasjon av valg',
    description:
      'Valg av arbeidstakerrepresentanter skal kunne dokumenteres (innkalling, stemmerett, resultat). Ved anonymt valg: protokoll uten å knytte stemmer til person.',
    category: 'documentation',
    lawRef: 'Interne retningslinjer / Hovedavtalen der relevant',
  },
  {
    id: 'req-5050',
    roleKeys: [
      'employee_chair',
      'employee_deputy',
      'employee_member',
      'leadership_chair',
      'leadership_deputy',
      'leadership_member',
    ],
    title: 'Lik representasjon (50/50)',
    description:
      'Arbeidsmiljøutvalget skal ha lik representasjon fra arbeidstaker- og arbeidsgiversiden (med mindre annet er avtalt etter lov).',
    category: 'process',
    lawRef: 'Arbeidsmiljøloven § 7-2',
  },
]

export function requirementsForRole(roleKey: string): RoleRequirement[] {
  return REPRESENTATIVE_ROLE_REQUIREMENTS.filter((r) => r.roleKeys.includes(roleKey))
}
