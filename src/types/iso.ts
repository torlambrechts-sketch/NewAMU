// ISO IMS — shared TypeScript types for all ISO-related pages and hooks.
//
// Covers: settings (active standards), gap analysis sessions/responses,
// Statement of Applicability (ISO 27001), and standard clause taxonomy.
// DB tables are defined in migrations 20260914100002 and 20260914100003.

import type { CompliancePackSlug } from '../../modules/compliance/types'

// Standards that can be part of an IMS (same set as the 4 ISO pack slugs).
export type IsoStandard = 'iso-9001' | 'iso-14001' | 'iso-45001' | 'iso-27001'

export const ISO_STANDARDS: IsoStandard[] = [
  'iso-9001',
  'iso-14001',
  'iso-45001',
  'iso-27001',
]

export const ISO_STANDARD_LABELS: Record<IsoStandard, string> = {
  'iso-9001':  'ISO 9001:2015 — Kvalitetsstyring',
  'iso-14001': 'ISO 14001:2015 — Miljøstyring',
  'iso-45001': 'ISO 45001:2018 — Arbeidsmiljøstyring',
  'iso-27001': 'ISO 27001:2022 — Informasjonssikkerhet',
}

export const ISO_STANDARD_SHORT: Record<IsoStandard, string> = {
  'iso-9001':  'ISO 9001',
  'iso-14001': 'ISO 14001',
  'iso-45001': 'ISO 45001',
  'iso-27001': 'ISO 27001',
}

// The corresponding compliance pack slug for each standard.
export const ISO_STANDARD_PACK: Record<IsoStandard, CompliancePackSlug> = {
  'iso-9001':  'iso-9001',
  'iso-14001': 'iso-14001',
  'iso-45001': 'iso-45001',
  'iso-27001': 'iso-27001',
}

// ── organization_iso_settings ────────────────────────────────────────────────

export type IsoSettings = {
  id: string
  organizationId: string
  activeStandards: IsoStandard[]
  certificationTargets: Partial<Record<IsoStandard, string | null>>
  createdAt: string
  updatedAt: string
}

// ── iso_standard_clauses ─────────────────────────────────────────────────────

export type IsoClause = {
  id: string
  standard: IsoStandard
  clauseId: string
  title: string
  parentId: string | null
  isLeaf: boolean
  position: number
}

// ── Gap analysis ─────────────────────────────────────────────────────────────

export type GapSessionStatus = 'in_progress' | 'completed'

export type IsoGapSession = {
  id: string
  organizationId: string
  standard: IsoStandard
  status: GapSessionStatus
  scorePct: number | null
  completedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type GapRating = 0 | 1 | 2 | 3

export const GAP_RATING_LABELS: Record<GapRating, string> = {
  0: 'Ikke implementert',
  1: 'Delvis implementert',
  2: 'I stor grad implementert',
  3: 'Fullt implementert',
}

export type IsoGapResponse = {
  id: string
  sessionId: string
  clauseId: string
  rating: GapRating
  notes: string | null
  taskIds: string[]
  createdAt: string
  updatedAt: string
}

// ── ISO 27001 SoA ─────────────────────────────────────────────────────────────

export type SoAImplementationStatus =
  | 'not_started'
  | 'planned'
  | 'in_progress'
  | 'implemented'

export const SOA_STATUS_LABELS: Record<SoAImplementationStatus, string> = {
  not_started: 'Ikke startet',
  planned:     'Planlagt',
  in_progress: 'Pågår',
  implemented: 'Implementert',
}

export type AnnexATheme =
  | 'organizational'
  | 'people'
  | 'physical'
  | 'technological'

export const ANNEX_A_THEME_LABELS: Record<AnnexATheme, string> = {
  organizational: 'Organisatoriske tiltak (A.5)',
  people:         'Personaltiltak (A.6)',
  physical:       'Fysiske tiltak (A.7)',
  technological:  'Teknologiske tiltak (A.8)',
}

export type AnnexAControl = {
  id: string
  theme: AnnexATheme
  controlId: string
  title: string
  description: string
  position: number
}

export type IsoSoAEntry = {
  id: string
  organizationId: string
  controlId: string
  applicable: boolean
  exclusionReason: string | null
  implementationStatus: SoAImplementationStatus
  responsibleId: string | null
  targetDate: string | null
  createdAt: string
  updatedAt: string
}
