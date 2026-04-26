// ─── Document & Wiki Center — Core Types ─────────────────────────────────────
//
// Architecture: spaces → pages → ordered content blocks.
// Blocks are either rich-text or a reference to a named dynamic module.
// This keeps content portable and independently renderable.

// ─── Content blocks ───────────────────────────────────────────────────────────

/** Stable id for editor ordering / drag-and-drop; optional on legacy JSON from DB */
export type ContentBlockInstance = {
  instanceId?: string
}

export type TextBlock = ContentBlockInstance & {
  kind: 'text'
  body: string  // sanitised HTML from the rich-text editor
}

export type HeadingBlock = ContentBlockInstance & {
  kind: 'heading'
  level: 1 | 2 | 3
  text: string
}

export type AlertBlock = ContentBlockInstance & {
  kind: 'alert'
  /** 'info' | 'warning' | 'danger' | 'tip' */
  variant: 'info' | 'warning' | 'danger' | 'tip'
  text: string
}

export type DividerBlock = ContentBlockInstance & {
  kind: 'divider'
}

export type LawRefBlock = ContentBlockInstance & {
  kind: 'law_ref'
  /** Short reference, e.g. "IK-forskriften §5 nr. 1b" */
  ref: string
  description: string
  url?: string
}

export type ImageBlock = ContentBlockInstance & {
  kind: 'image'
  url: string
  caption?: string
  /** Accessibility — use meaningful text (WCAG) */
  alt?: string
  width?: 'full' | 'wide' | 'medium'
}

export type TableBlock = ContentBlockInstance & {
  kind: 'table'
  headers: string[]
  rows: string[][]
  caption?: string
}

/**
 * Dynamic module block — the content engine lazy-loads a named component
 * and passes the params object to it.
 */
export type ModuleBlock = ContentBlockInstance & {
  kind: 'module'
  /**
   * Registered module names:
   *   live_org_chart        — AMU board & verneombud from representatives hook
   *   live_risk_feed        — Top 3 ROS risks from internalControl hook
   *   action_button         — Navigates user to a route (e.g. report deviation)
   *   acknowledgement_footer— Read & Understood sign-off (only if page flagged)
   *   emergency_stop_procedure — AML §6-3 stansingsrett; contact from representatives + org members
   */
  moduleName:
    | 'live_org_chart'
    | 'live_risk_feed'
    | 'action_button'
    | 'acknowledgement_footer'
    | 'emergency_stop_procedure'
  params?: Record<string, string | number | boolean>
}

export type ContentBlock =
  | TextBlock
  | HeadingBlock
  | AlertBlock
  | DividerBlock
  | LawRefBlock
  | ImageBlock
  | TableBlock
  | ModuleBlock

// ─── Page ─────────────────────────────────────────────────────────────────────

export type PageStatus = 'draft' | 'published' | 'archived'

/** Who must acknowledge when requiresAcknowledgement is true */
export type AcknowledgementAudience = 'all_employees' | 'leaders_only' | 'safety_reps_only' | 'department'

/** Wiki retention classification — matches `wiki_retention_categories.slug` */
export type WikiRetentionCategorySlug =
  | 'hms_dokument'
  | 'personaldokument'
  | 'opplaeringslogg'
  | 'amu_protokoll'
  | 'varslingssak'
  | 'personvern'
  | 'intern_prosedyre'
  | 'okonomidokument'
  | 'ad_hoc'

export type WikiRetentionCategoryRow = {
  slug: WikiRetentionCategorySlug | string
  label: string
  minYears: number
  maxYears: number | null
  legalRefs: string[]
  description: string | null
}

/** Primary language of the document (short BCP 47 codes used in DB) */
export type WikiPageLang = 'nb' | 'nn' | 'en'

export type WikiPage = {
  id: string
  spaceId: string
  title: string
  /** Optional short description shown in space overview */
  summary?: string
  status: PageStatus
  /** Template hint — used by renderer (standard | wide | policy) */
  template: 'standard' | 'wide' | 'policy'
  /** IK-forskriften / AML references this page satisfies */
  legalRefs: string[]
  /** Primary language of page body (accessibility); default nb when omitted */
  lang?: WikiPageLang
  /** True → acknowledgement_footer module activates for this page */
  requiresAcknowledgement: boolean
  /** Defaults to all_employees when omitted (legacy templates) */
  acknowledgementAudience?: AcknowledgementAudience
  /** When audience is department */
  acknowledgementDepartmentId?: string | null
  /** Next mandatory review (IK-f §5 — systematic review) */
  nextRevisionDueAt?: string | null
  revisionIntervalMonths?: number
  /** Page contains personal data — drives viewer banner and optional RLS for sensitive categories */
  containsPii?: boolean
  /** e.g. helse, lonn — overlap with helse|fagforeningsmedlemskap|etnisitet triggers hr.sensitive RLS */
  piiCategories?: string[]
  piiLegalBasis?: string | null
  piiRetentionNote?: string | null
  /** References `wiki_retention_categories.slug` */
  retentionCategory?: WikiRetentionCategorySlug | string | null
  retainMinimumYears?: number | null
  retainMaximumYears?: number | null
  /** Set when page is archived — drives `scheduledDeletionAt` when max years set */
  archivedAt?: string | null
  /** Generated in DB when archived_at + retain_maximum_years */
  scheduledDeletionAt?: string | null
  blocks: ContentBlock[]
  version: number
  createdAt: string
  updatedAt: string
  authorId: string
  /** When true, publish must go through reviewer approval (P2.1). */
  reviewRequired?: boolean
  /** Bruker-id for godkjenner når `reviewRequired` er satt. */
  reviewerId?: string | null
}

/** Immutable snapshot when a version was published (audit) */
export type WikiPageVersionSnapshot = {
  id: string
  pageId: string
  version: number
  title: string
  summary: string
  status: string
  template: string
  legalRefs: string[]
  /** Language at publish time (optional for legacy rows) */
  lang?: WikiPageLang
  requiresAcknowledgement: boolean
  acknowledgementAudience: AcknowledgementAudience
  acknowledgementDepartmentId: string | null
  blocks: ContentBlock[]
  nextRevisionDueAt: string | null
  revisionIntervalMonths: number
  frozenAt: string
}

// ─── Space ────────────────────────────────────────────────────────────────────

export type SpaceCategory = 'hms_handbook' | 'policy' | 'procedure' | 'guide' | 'template_library'

export type WikiSpace = {
  id: string
  title: string
  description: string
  category: SpaceCategory
  /** Emoji or icon identifier */
  icon: string
  status: 'active' | 'archived'
  /** Org AMU folder — published pages visible to all members (server RLS). */
  isAmuSpace?: boolean
  /** Optional parent folder (max depth 3 including root). */
  parentSpaceId?: string | null
  createdAt: string
  updatedAt: string
}

/** Files and external links attached to a folder (space) */
export type WikiSpaceItemKind = 'file' | 'url'

export type WikiSpaceItem = {
  id: string
  spaceId: string
  kind: WikiSpaceItemKind
  title: string
  filePath: string | null
  fileName: string | null
  mimeType: string | null
  fileSize: number | null
  url: string | null
  createdAt: string
}

// ─── Audit ledger (immutable) ─────────────────────────────────────────────────

export type AuditLedgerEntry = {
  id: string
  pageId: string
  pageTitle: string
  action:
    | 'created'
    | 'updated'
    | 'published'
    | 'archived'
    | 'acknowledged'
    | 'annual_review_completed'
    | 'submitted_for_review'
    | 'approved'
    | 'changes_requested'
  userId: string
  fromVersion?: number
  toVersion: number
  at: string
  /** Partial diff snapshot */
  snapshot?: string
}

/** Row from `search_wiki_pages` RPC (mapped on the client). */
export type WikiDocumentSearchResult = {
  id: string
  title: string
  summary: string | null
  status: PageStatus
  spaceId: string
  updatedAt: string
  rank: number
}

export type WikiReviewRequestStatus = 'pending' | 'approved' | 'changes_requested'

export type WikiReviewRequest = {
  id: string
  pageId: string
  pageVersion: number
  requesterId: string
  reviewerId: string
  status: WikiReviewRequestStatus
  reviewerComment: string | null
  createdAt: string
  resolvedAt: string | null
}

export type WikiPageComment = {
  id: string
  pageId: string
  blockIndex: number
  body: string
  authorId: string
  authorName: string
  resolved: boolean
  createdAt: string
}

export type WikiMentionNotification = {
  id: string
  recipientUserId: string
  actorUserId: string
  actorName: string
  pageId: string | null
  context: 'editor' | 'comment'
  snippet: string
  createdAt: string
  readAt: string | null
}

export type WikiPageViewStats = {
  pageId: string
  uniqueViewers: number
  viewsLast30: number
}

// ─── Compliance receipts ──────────────────────────────────────────────────────

export type ComplianceReceipt = {
  id: string
  pageId: string
  pageTitle: string
  pageVersion: number
  userId: string
  userName: string
  acknowledgedAt: string
}

// ─── Template scaffold ────────────────────────────────────────────────────────

export type PageTemplate = {
  id: string
  label: string
  description: string
  /** Legal bases this template addresses */
  legalBasis: string[]
  category: SpaceCategory
  /** Pre-filled page scaffold */
  page: Omit<WikiPage, 'id' | 'spaceId' | 'createdAt' | 'updatedAt' | 'authorId' | 'version'>
}
