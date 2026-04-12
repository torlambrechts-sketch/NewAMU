import type { AnonymousAmlReport } from './orgHealth'

export type WorkplaceCaseCategory =
  | 'work_environment'
  | 'coworkers'
  | 'health_safety'
  | 'management'
  | 'ethics'
  | 'policy_violation'
  | 'other'

export type WorkplaceCaseStatus = 'received' | 'triage' | 'in_progress' | 'closed'

/** Extra fields vary by category; all optional at type level, UI enforces relevance. */
export type WorkplaceCaseDetails = {
  locationOrUnit?: string
  desiredFollowUp?: string
  relationshipOrTheme?: string
  riskOrConsequence?: string
  immediateMeasures?: string
  managementContext?: string
  ethicalQuestion?: string
  policyReference?: string
}

export type WorkplaceCase = {
  id: string
  createdAt: string
  updatedAt: string
  category: WorkplaceCaseCategory
  status: WorkplaceCaseStatus
  title: string
  description: string
  details: WorkplaceCaseDetails
  /** If true, only creator + admin + varsling committee see the row in the list. */
  confidential: boolean
  createdByUserId: string
}

/** Page copy for the public anonym AML-kanal (`/varsle/...` er egen varsling). */
export type AnonymousAmlPageSettings = {
  /** Vises øverst på den eksterne siden */
  pageTitle: string
  leadParagraph: string
  /** Valgfritt — f.eks. kontaktlinje */
  footerNote: string
}

export type WorkplaceReportingStore = {
  cases: WorkplaceCase[]
  /** Aggregerte anonyme AML-innsendelser (ingen fritekst lagret). */
  anonymousAmlReports: AnonymousAmlReport[]
  anonymousAmlPage: AnonymousAmlPageSettings
}

export const DEFAULT_ANONYMOUS_AML_PAGE: AnonymousAmlPageSettings = {
  pageTitle: 'Anonym arbeidsmiljøhenvendelse',
  leadParagraph:
    'Velg kategori og hastegrad. Fritekst du eventuelt skriver lagres ikke — kun om du skrev noe (ja/nei) registreres.',
  footerNote: 'Ved akutt fare: ring 113. For strukturert varsling med oppfølging, bruk organisasjonens offisielle varslingskanal.',
}
