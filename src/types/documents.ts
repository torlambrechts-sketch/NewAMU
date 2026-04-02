/** Document center — Phase 1–2 (demo, localStorage). Not legal advice. */

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

/** Inline comment thread (Phase 2 wiki collaboration). */
export type DocumentComment = {
  id: string
  /** Optional anchor: paragraph index or custom id */
  anchor?: string
  html: string
  author: string
  createdAt: string
  resolved?: boolean
}

export type ApprovalStep = {
  id: string
  roleName: string
  status: 'pending' | 'approved'
  approvedBy?: string
  approvedAt?: string
}

export type ReadingReceipt = {
  id: string
  roleLabel: string
  required: boolean
  acknowledgedBy?: string
  acknowledgedAt?: string
}

export type ComplianceLink = {
  requirementId: string
  satisfied: boolean
  note?: string
}

export type ExternalModuleLink = {
  id: string
  label: string
  path: string
  /** Group for filtering, e.g. Internkontroll, HMS */
  category?: string
}

/** Uploaded file stored as data URL (demo; size limits apply). */
export type DocumentAttachment = {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  /** base64 data URL */
  dataUrl: string
  uploadedAt: string
  uploadedBy: string
}

export type ElectronicSignature = {
  signedAt: string
  signedBy: string
  method: 'demo_attestation'
  statement: string
}

export type LibraryDocument = {
  id: string
  title: string
  /** URL-friendly slug for [[wiki links]] resolution */
  wikiSlug?: string
  category: string
  tags: string[]
  lawRef?: string
  owner: string
  workflowStatus: DocumentWorkflowStatus
  currentHtml: string
  publishedHtml?: string
  publishedAt?: string
  publishedVersionNumber: number
  versions: DocumentVersionSnapshot[]
  audit: DocumentAuditEntry[]
  createdAt: string
  updatedAt: string
  /** Phase 2: discussion */
  comments: DocumentComment[]
  /** Phase 2: multi-step approval before publish */
  approvalSteps: ApprovalStep[]
  /** Phase 2: optional periodic re-confirmation */
  nextReviewDueAt?: string
  /** Phase 2: must acknowledge having read (e.g. ledere) */
  readingReceipts: ReadingReceipt[]
  /** Phase 2: map to compliance matrix rows */
  complianceLinks: ComplianceLink[]
  /** Phase 2: quick links to other atics modules */
  externalLinks: ExternalModuleLink[]
  /** Uploaded files (PDF, images, etc.) */
  attachments: DocumentAttachment[]
  /** Phase 2: template variable values {{key}} */
  templateVariables?: Record<string, string>
  /** Copied from template: checklist before first publish */
  prePublishChecklist?: string[]
  /** Parallel booleans for checklist */
  prePublishChecksDone?: boolean[]
  /** Last formal sign-off on publish (demo — not BankID) */
  lastSignature?: ElectronicSignature
}

export type DocumentTemplate = {
  id: string
  title: string
  description: string
  category: string
  suggestedTags: string[]
  lawRef?: string
  html: string
  /** Placeholders replaced on create, e.g. {{virksomhet}} */
  variableKeys?: string[]
  /** Checklist shown before first publish */
  prePublishChecklist?: string[]
}

export type ComplianceRequirement = {
  id: string
  label: string
  lawRef?: string
  category: string
}
