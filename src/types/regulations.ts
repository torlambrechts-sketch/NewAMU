// Regulation = Cat 1 of the cross-module two-level taxonomy
// (category-architecture §T1). Owns the legal/standards basis a per-org
// category sits under (compliance pack, survey pack, learning category,
// wiki space). Per-org rows so customers can add their own; is_system
// marks the seeded baseline.

export type Regulation = {
  id: string
  organizationId: string
  name: string
  shortName: string
  description: string
  legalAuthority: string | null
  position: number
  isActive: boolean
  isSystem: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Stable ids for the baseline regulations seeded by
 *  `provision_regulations_baseline_for_org`. Codepaths that need to
 *  reference a specific regulation (e.g. backfill maps, source-type →
 *  regulation lookups) use these constants instead of the display
 *  string. Keep aligned with the seed migration. */
export const REGULATION_IDS = {
  aml: 'aml',
  ikF: 'ik-f',
  iso9001: 'iso-9001',
  iso14001: 'iso-14001',
  iso45001: 'iso-45001',
  apenhetsloven: 'apenhetsloven',
  gdpr: 'gdpr',
  likestilling: 'likestilling',
  iso19011: 'iso-19011',
} as const

export type RegulationId = (typeof REGULATION_IDS)[keyof typeof REGULATION_IDS]
