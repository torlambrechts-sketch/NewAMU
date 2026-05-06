// Compliance pack — type definitions only.
//
// As of the DB-driven packs migration, runtime pack content lives in
// public.compliance_packs (per-org). This file holds the TypeScript shape
// the rest of the app consumes. Fetching is in modules/compliance/usePacks.

import type {
  CompliancePackSlug,
  ComplianceSeverity,
} from '../../../modules/compliance/types'

export type PackLegalReference = {
  code: string
  text: string
}

export type PackKpiLabels = {
  open: string
  critical: string
  ytd: string
}

export type PackSeverityLabels = Record<ComplianceSeverity, string>

export type CompliancePack = {
  slug: CompliancePackSlug
  shortName: string
  pluralLabel: string
  ctaLabel: string
  description: string
  legalReferences: PackLegalReference[]
  kpiLabels: PackKpiLabels
  severityLabels: PackSeverityLabels
  position: number
  isActive: boolean
}
