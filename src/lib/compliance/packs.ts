// Compliance regulation packs — UI configuration only.
//
// A "pack" re-skins the same compliance_checklist_* primitive as either the
// AML / Internkontrollforskriften view (AMU + vernerunder vocabulary) or the
// ISO 45001 internal-audit view. The DB stores rows tagged with `pack`; this
// file describes how each pack is presented to the user.
//
// Closed schema: components must not branch on `pack.slug`. If a per-pack
// difference is required, add a field to CompliancePack here.

import type { CompliancePackSlug, ComplianceSeverity } from '../../../modules/compliance/types'

export type PackLegalReference = {
  code: string
  text: string
}

export type CompliancePack = {
  slug: CompliancePackSlug
  /** Short brand label used in the switcher and breadcrumbs. */
  shortName: string
  /** Plural label shown as the page title. */
  pluralLabel: string
  /** Singular noun for the create CTA, e.g. "Ny vernerunde". */
  ctaLabel: string
  /** One-line page description (Bokmål). */
  description: string
  /** Legal references rendered in <ModuleLegalBanner>. */
  legalReferences: PackLegalReference[]
  /** Labels for the three KPI tiles in this pack's view. */
  kpiLabels: {
    open: string
    critical: string
    ytd: string
  }
  /** Auditor-readable severity labels used in <Badge>. */
  severityLabels: Record<ComplianceSeverity, string>
}

export const AML_AMU_PACK: CompliancePack = {
  slug: 'aml-amu',
  shortName: 'AML',
  pluralLabel: 'Vernerunder',
  ctaLabel: 'Ny vernerunde',
  description: 'Vernerunder og avvik etter arbeidsmiljøloven og internkontrollforskriften.',
  legalReferences: [
    { code: 'AML §3-1', text: 'Krav til systematisk HMS-arbeid (internkontroll).' },
    { code: 'AML §4-1', text: 'Generelle krav til arbeidsmiljøet.' },
    { code: 'IK-forskriften §5', text: 'Internkontrollens innhold (sjekklister, avvik, oppfølging).' },
  ],
  kpiLabels: {
    open: 'Åpne vernerunder',
    critical: 'Kritiske avvik',
    ytd: 'Vernerunder i år',
  },
  severityLabels: {
    critical: 'Kritisk avvik',
    high: 'Vesentlig avvik',
    medium: 'Mindre avvik',
    low: 'Forbedringspotensial',
  },
}

export const ISO_45001_PACK: CompliancePack = {
  slug: 'iso-45001',
  shortName: 'ISO 45001',
  pluralLabel: 'Internrevisjoner',
  ctaLabel: 'Ny internrevisjon',
  description: 'Internrevisjoner og samsvarssjekk mot ISO 45001 (arbeidsmiljøstyringssystem).',
  legalReferences: [
    { code: 'ISO 45001 §9.2', text: 'Internal audit — planlegg, gjennomfør, dokumenter og rapporter.' },
    { code: 'ISO 45001 §10.2', text: 'Incident, nonconformity and corrective action.' },
    { code: 'ISO 45001 §10.3', text: 'Continual improvement.' },
  ],
  kpiLabels: {
    open: 'Pågående revisjoner',
    critical: 'Major NCs',
    ytd: 'Fullførte i år',
  },
  severityLabels: {
    critical: 'Major NC',
    high: 'Major NC',
    medium: 'Minor NC',
    low: 'Observation',
  },
}

export const PACKS: Record<CompliancePackSlug, CompliancePack> = {
  'aml-amu': AML_AMU_PACK,
  'iso-45001': ISO_45001_PACK,
}

export const PACK_ORDER: CompliancePackSlug[] = ['aml-amu', 'iso-45001']

export const DEFAULT_PACK_SLUG: CompliancePackSlug = 'aml-amu'

export function getPack(slug: string | null | undefined): CompliancePack {
  if (slug && (slug === 'aml-amu' || slug === 'iso-45001')) {
    return PACKS[slug]
  }
  return PACKS[DEFAULT_PACK_SLUG]
}
