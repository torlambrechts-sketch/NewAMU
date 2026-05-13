// Rolle-filtrering for Regelverk-dekning.
//
// Krav-katalogen (`regelverkRequirements.ts`) har ingen eksplisitt `roles[]`
// pr. nå, så vi infererer ansvarlig(e) rolle(r) heuristisk fra § og tittel.
// Når et eksplisitt `roles?: string[]`-felt legges til Requirement, vil
// `requirementRoles()` returnere det istedet og overstyre heuristikken.
//
// Role-slugs matcher `functional_role_catalog` brukt av RoleCompliance
// (verneombud, amu_leder, dpo, …).

import type { Requirement } from '../../../data/regelverkRequirements'

export type RoleSlug =
  | 'daglig_leder'
  | 'linje_leder'
  | 'hr_leder'
  | 'hms_koordinator'
  | 'verneombud'
  | 'hoved_verneombud'
  | 'amu_leder'
  | 'amu_medlem'
  | 'tillitsvalgt'
  | 'bht_kontakt'
  | 'brannvern_leder'
  | 'forstehjelp_ansvarlig'
  | 'dpo'
  | 'varslings_mottak'
  | 'arbeidstaker'

export type RoleOption = { slug: RoleSlug; label: string }

export const REGELVERK_ROLES: RoleOption[] = [
  { slug: 'daglig_leder', label: 'Daglig leder / Arbeidsgiver' },
  { slug: 'linje_leder', label: 'Linjeleder' },
  { slug: 'hr_leder', label: 'HR-leder' },
  { slug: 'hms_koordinator', label: 'HMS-koordinator' },
  { slug: 'verneombud', label: 'Verneombud' },
  { slug: 'hoved_verneombud', label: 'Hovedverneombud' },
  { slug: 'amu_leder', label: 'AMU-leder' },
  { slug: 'amu_medlem', label: 'AMU-medlem' },
  { slug: 'tillitsvalgt', label: 'Tillitsvalgt' },
  { slug: 'bht_kontakt', label: 'BHT-kontakt' },
  { slug: 'brannvern_leder', label: 'Brannvernleder' },
  { slug: 'forstehjelp_ansvarlig', label: 'Førstehjelpsansvarlig' },
  { slug: 'dpo', label: 'Personvernombud (DPO)' },
  { slug: 'varslings_mottak', label: 'Varslingsmottak' },
  { slug: 'arbeidstaker', label: 'Arbeidstaker' },
]

const ROLE_LABEL = new Map<string, string>(REGELVERK_ROLES.map((r) => [r.slug, r.label]))
export function roleLabel(slug: string): string {
  return ROLE_LABEL.get(slug) ?? slug
}

/** Lavercase-tekst for keyword-matching. */
function searchableText(req: Requirement): string {
  return `${req.lawRef} ${req.title} ${req.category} ${req.description ?? ''}`.toLowerCase()
}

/** Hovedheuristikk — kombinerer chapter-fingerprint og keyword-match. */
export function inferRequirementRoles(req: Requirement): RoleSlug[] {
  const text = searchableText(req)
  const roles = new Set<RoleSlug>()

  // Default — daglig leder er ansvarlig for at *alle* krav i AML/IK-f er overholdt.
  if (req.regelverkId === 'aml' || req.regelverkId === 'ik-f') {
    roles.add('daglig_leder')
  }

  // AML kapitler — bredt eierskap
  if (req.lawRef.startsWith('AML § 6') || /verneombud/.test(text)) {
    roles.add('verneombud')
    roles.add('hoved_verneombud')
  }
  if (req.lawRef.startsWith('AML § 7') || /\bamu\b|arbeidsmilj[øo]utvalg/.test(text)) {
    roles.add('amu_leder')
    roles.add('amu_medlem')
  }
  if (req.lawRef.startsWith('AML § 8') || /dr[øo]fting|tillitsvalgt/.test(text)) {
    roles.add('tillitsvalgt')
  }
  if (req.lawRef.startsWith('AML § 2A') || /varsl/.test(text)) {
    roles.add('varslings_mottak')
  }
  if (/bht|bedriftshelse/.test(text)) {
    roles.add('bht_kontakt')
  }
  if (/f[øo]rstehjelp/.test(text)) {
    roles.add('forstehjelp_ansvarlig')
  }
  if (/branneksp|brannvern|\bbrann\b|eksplosjon/.test(text) || req.regelverkId === 'brannvern') {
    roles.add('brannvern_leder')
  }
  if (/personvern|gdpr|personopplys/.test(text) || req.regelverkId === 'gdpr') {
    roles.add('dpo')
  }
  if (
    /likestilling|diskriminering|aktivitetsplikt|arp|redegj[øo]relse/.test(text) ||
    req.regelverkId === 'ldl'
  ) {
    roles.add('hr_leder')
  }
  if (
    /onboard|opplaering|opplæring|hms-?dokumentasjon|systematisk hms|kartlegg|risikovurdering|handlingsplan/.test(
      text,
    )
  ) {
    roles.add('hms_koordinator')
  }
  if (/oppsigelse|ansettelse|midlertidig|stilling|permisjon|arbeidstid|hviletid|overtid/.test(text)) {
    roles.add('linje_leder')
    roles.add('hr_leder')
  }
  if (/medvirkning|medvirke|melde|arbeidstakers\b/.test(text)) {
    roles.add('arbeidstaker')
  }

  return [...roles]
}

/** Returnerer eksplisitt `roles?: string[]` hvis lagt til på kravet,
 *  ellers inferert sett. */
export function requirementRoles(req: Requirement): RoleSlug[] {
  const maybe = (req as Requirement & { roles?: string[] }).roles
  if (Array.isArray(maybe) && maybe.length > 0) return maybe as RoleSlug[]
  return inferRequirementRoles(req)
}

export function requirementMatchesRole(req: Requirement, slug: string | null): boolean {
  if (!slug) return true
  return requirementRoles(req).includes(slug as RoleSlug)
}
