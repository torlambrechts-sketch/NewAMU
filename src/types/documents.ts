// ─── Document & Wiki Center — Core Types ─────────────────────────────────────
//
// Architecture: spaces → pages → ordered content blocks.
// Blocks are either rich-text or a reference to a named dynamic module.
// This keeps content portable and independently renderable.

// ─── Content blocks ───────────────────────────────────────────────────────────

export type TextBlock = {
  kind: 'text'
  body: string  // sanitised HTML from the rich-text editor
}

export type HeadingBlock = {
  kind: 'heading'
  level: 1 | 2 | 3
  text: string
}

export type AlertBlock = {
  kind: 'alert'
  /** 'info' | 'warning' | 'danger' | 'tip' */
  variant: 'info' | 'warning' | 'danger' | 'tip'
  text: string
}

export type DividerBlock = {
  kind: 'divider'
}

export type LawRefBlock = {
  kind: 'law_ref'
  /** Short reference, e.g. "IK-forskriften §5 nr. 1b" */
  ref: string
  description: string
  url?: string
}

/**
 * Dynamic module block — the content engine lazy-loads a named component
 * and passes the params object to it.
 */
export type ModuleBlock = {
  kind: 'module'
  /**
   * Registered module names:
   *   live_org_chart        — AMU board & verneombud from representatives hook
   *   live_risk_feed        — Top 3 ROS risks from internalControl hook
   *   action_button         — Navigates user to a route (e.g. report deviation)
   *   acknowledgement_footer— Read & Understood sign-off (only if page flagged)
   */
  moduleName: 'live_org_chart' | 'live_risk_feed' | 'action_button' | 'acknowledgement_footer'
  params?: Record<string, string | number | boolean>
}

export type ContentBlock = TextBlock | HeadingBlock | AlertBlock | DividerBlock | LawRefBlock | ModuleBlock

// ─── Page ─────────────────────────────────────────────────────────────────────

export type PageStatus = 'draft' | 'published' | 'archived'

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
  /** True → acknowledgement_footer module activates for this page */
  requiresAcknowledgement: boolean
  blocks: ContentBlock[]
  version: number
  createdAt: string
  updatedAt: string
  authorId: string
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
  createdAt: string
  updatedAt: string
}

// ─── Audit ledger (immutable) ─────────────────────────────────────────────────

export type AuditLedgerEntry = {
  id: string
  pageId: string
  pageTitle: string
  action: 'created' | 'updated' | 'published' | 'archived' | 'acknowledged'
  userId: string
  fromVersion?: number
  toVersion: number
  at: string
  /** Partial diff snapshot */
  snapshot?: string
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
