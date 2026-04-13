/**
 * Konsekvenskategorier — hva som rammes ved uønsket hendelse (typisk gradering 1–5 per kategori).
 */
export const ROS_CONSEQUENCE_CATEGORIES = [
  {
    id: 'life_health',
    label: 'Liv og helse',
    hint: 'Død, fysisk eller psykisk skade, sykdomsutbrudd',
  },
  {
    id: 'economy_material',
    label: 'Økonomi / materielle verdier',
    hint: 'Bygninger, utstyr, infrastruktur, tap av inntekter',
  },
  {
    id: 'nature_environment',
    label: 'Natur og miljø',
    hint: 'Forurensning, sårbare områder, artsmangfold',
  },
  {
    id: 'critical_infrastructure',
    label: 'Samfunnsvikt / kritisk infrastruktur',
    hint: 'Strøm, vann, e-kom, veier, kjerne- og velferdstjenester',
  },
  {
    id: 'reputation_trust',
    label: 'Omdømme og tillit',
    hint: 'Tillit til etat, bedrift eller politikere',
  },
] as const

export type RosConsequenceCategoryId = (typeof ROS_CONSEQUENCE_CATEGORIES)[number]['id'] | ''

export function consequenceCategoryLabel(id: string | undefined): string {
  if (!id) return '—'
  const hit = ROS_CONSEQUENCE_CATEGORIES.find((c) => c.id === id)
  return hit?.label ?? id
}
