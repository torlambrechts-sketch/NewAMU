// Frameworks rendered in the /registers framework rail + pills.
//
// The catalogue's `regulation_ids` column carries lower-case slug ids
// such as 'aml', 'iso-45001', 'gdpr'. The new UI groups + colours
// these into the same eight frameworks the Klarert design uses. The
// list here is the single source of truth — both the rail (filter
// chips) and the framework pill on type tiles read from it.
//
// Each framework declares: id (matches a slug in regulation_ids),
// label (full Norwegian name), short (badge label), color (used for
// the chip background + active state), icon (Lucide name).

export type RegisterFrameworkDef = {
  id: string
  label: string
  short: string
  color: string
  icon: string
}

export const REGISTER_FRAMEWORKS: RegisterFrameworkDef[] = [
  { id: 'aml', label: 'Arbeidsmiljøloven', short: 'AML', color: '#1a3d32', icon: 'Scale' },
  { id: 'iso-45001', label: 'ISO 45001 — HMS', short: 'ISO 45001', color: '#2563EB', icon: 'BadgeCheck' },
  { id: 'iso-14001', label: 'ISO 14001 — Miljø', short: 'ISO 14001', color: '#16A34A', icon: 'Leaf' },
  { id: 'iso-9001', label: 'ISO 9001 — Kvalitet', short: 'ISO 9001', color: '#7C3AED', icon: 'Award' },
  { id: 'iso-27001', label: 'ISO 27001 — Informasjonssikkerhet', short: 'ISO 27001', color: '#0EA5E9', icon: 'ShieldCheck' },
  { id: 'gdpr', label: 'Personvern (GDPR)', short: 'GDPR', color: '#6366F1', icon: 'Lock' },
  { id: 'apenhetsloven', label: 'Åpenhetsloven', short: 'Åpenhetsl.', color: '#0E7490', icon: 'BookOpen' },
  { id: 'reach', label: 'REACH / CLP', short: 'REACH', color: '#C2410C', icon: 'FlaskConical' },
  { id: 'bokforing', label: 'Bokføringsloven', short: 'Bokf.', color: '#5A9C76', icon: 'BookOpen' },
]

/** Map a regulation slug to its framework def, or null when no entry exists. */
export function frameworkFor(regulationId: string | null | undefined): RegisterFrameworkDef | null {
  if (!regulationId) return null
  return REGISTER_FRAMEWORKS.find((f) => f.id === regulationId) ?? null
}

/**
 * Pick the "primary" framework for a register type, used as the lead
 * pill on tiles + table rows. Falls back to the first declared
 * regulation, or to a generic AML chip when nothing is declared
 * (system types always declare at least one).
 */
export function primaryFramework(regulationIds: string[]): RegisterFrameworkDef | null {
  if (regulationIds.length === 0) return null
  // Prefer ordering: AML > ISO* > GDPR > others (mirrors design seed).
  const order: string[] = [
    'aml',
    'iso-45001',
    'iso-14001',
    'iso-9001',
    'iso-27001',
    'gdpr',
    'apenhetsloven',
    'reach',
    'bokforing',
  ]
  const picked =
    order.find((slug) => regulationIds.includes(slug)) ?? regulationIds[0]
  return frameworkFor(picked)
}

/**
 * Returns true when a register type's regulation_ids overlaps with the
 * given framework id (the framework rail filter).
 */
export function typeMatchesFramework(
  regulationIds: string[],
  frameworkId: string | 'all',
): boolean {
  if (frameworkId === 'all') return true
  return regulationIds.includes(frameworkId)
}
