/** Document center — Phase 1 (demo, localStorage). Not legal advice. */

export type DocumentWorkflowStatus = 'draft' | 'in_review' | 'published' | 'archived'

export type DocumentVersionSnapshot = {
  id: string
  versionNumber: number
  html: string
  title: string
  savedAt: string
  savedBy: string
  note?: string
}

export type DocumentAuditEntry = {
  id: string
  at: string
  action: string
  actor: string
  detail?: string
}

export type LibraryDocument = {
  id: string
  title: string
  category: string
  tags: string[]
  /** Optional reference, e.g. «Internkontrollforskriften § 5» */
  lawRef?: string
  owner: string
  workflowStatus: DocumentWorkflowStatus
  /** Working body (HTML) */
  currentHtml: string
  /** Set when published — what readers see */
  publishedHtml?: string
  publishedAt?: string
  publishedVersionNumber: number
  versions: DocumentVersionSnapshot[]
  audit: DocumentAuditEntry[]
  createdAt: string
  updatedAt: string
}

export type DocumentTemplate = {
  id: string
  title: string
  description: string
  category: string
  suggestedTags: string[]
  lawRef?: string
  html: string
}
