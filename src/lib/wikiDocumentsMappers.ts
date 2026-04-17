import type {
  AcknowledgementAudience,
  AuditLedgerEntry,
  Block,
  ComplianceReceipt,
  WikiPage,
  WikiPageVersionSnapshot,
  WikiSpace,
  WikiSpaceItem,
} from '../types/documents'

export function mapWikiSpace(row: {
  id: string
  title: string
  description: string
  category: string
  icon: string
  status: string
  created_at: string
  updated_at: string
}): WikiSpace {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    category: row.category as WikiSpace['category'],
    icon: row.icon ?? '📁',
    status: row.status as WikiSpace['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapWikiPage(
  row: {
    id: string
    space_id: string
    title: string
    summary: string | null
    status: string
    template: string
    legal_refs: string[] | null
    requires_acknowledgement: boolean
    acknowledgement_audience?: string | null
    acknowledgement_department_id?: string | null
    next_revision_due_at?: string | null
    revision_interval_months?: number | null
    blocks: unknown
    version: number
    author_id: string | null
    created_at: string
    updated_at: string
    word_count?: number | null
    sort_order?: number | null
    is_pinned?: boolean | null
    template_source_id?: string | null
  },
  authorFallback: string,
): WikiPage {
  const aud = (row.acknowledgement_audience ?? 'all_employees') as AcknowledgementAudience
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    summary: row.summary ?? '',
    status: row.status as WikiPage['status'],
    template: row.template as WikiPage['template'],
    legalRefs: row.legal_refs ?? [],
    requiresAcknowledgement: row.requires_acknowledgement,
    acknowledgementAudience: aud,
    acknowledgementDepartmentId: row.acknowledgement_department_id ?? null,
    nextRevisionDueAt: row.next_revision_due_at ?? null,
    revisionIntervalMonths: row.revision_interval_months ?? 12,
    blocks: (Array.isArray(row.blocks) ? row.blocks : []) as Block[],
    wordCount: row.word_count ?? undefined,
    sortOrder: row.sort_order ?? 0,
    isPinned: row.is_pinned === true,
    templateSourceId: row.template_source_id ?? undefined,
    version: row.version,
    authorId: row.author_id ?? authorFallback,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapWikiSpaceItem(row: {
  id: string
  space_id: string
  kind: string
  title: string
  file_path: string | null
  file_name: string | null
  mime_type: string | null
  file_size: number | null
  url: string | null
  created_at: string
}): WikiSpaceItem {
  return {
    id: row.id,
    spaceId: row.space_id,
    kind: row.kind as WikiSpaceItem['kind'],
    title: row.title,
    filePath: row.file_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    url: row.url,
    createdAt: row.created_at,
  }
}

export function mapWikiPageVersion(row: {
  id: string
  page_id: string
  version: number
  title: string
  summary: string | null
  status: string
  template: string
  legal_refs: string[] | null
  requires_acknowledgement: boolean
  acknowledgement_audience?: string | null
  acknowledgement_department_id?: string | null
  blocks: unknown
  next_revision_due_at?: string | null
  revision_interval_months?: number | null
  frozen_at: string
}): WikiPageVersionSnapshot {
  return {
    id: row.id,
    pageId: row.page_id,
    version: row.version,
    title: row.title,
    summary: row.summary ?? '',
    status: row.status,
    template: row.template,
    legalRefs: row.legal_refs ?? [],
    requiresAcknowledgement: row.requires_acknowledgement,
    acknowledgementAudience: (row.acknowledgement_audience ?? 'all_employees') as AcknowledgementAudience,
    acknowledgementDepartmentId: row.acknowledgement_department_id ?? null,
    blocks: (Array.isArray(row.blocks) ? row.blocks : []) as Block[],
    nextRevisionDueAt: row.next_revision_due_at ?? null,
    revisionIntervalMonths: row.revision_interval_months ?? 12,
    frozenAt: row.frozen_at,
  }
}

export function mapWikiLedger(row: {
  id: string
  page_id: string
  page_title: string
  action: string
  user_id: string
  from_version: number | null
  to_version: number
  at: string
}): AuditLedgerEntry {
  return {
    id: row.id,
    pageId: row.page_id,
    pageTitle: row.page_title,
    action: row.action as AuditLedgerEntry['action'],
    userId: row.user_id,
    fromVersion: row.from_version ?? undefined,
    toVersion: row.to_version,
    at: row.at,
  }
}

export function mapWikiReceipt(row: {
  id: string
  page_id: string
  page_title: string
  page_version: number
  user_id: string
  user_name: string
  acknowledged_at: string
}): ComplianceReceipt {
  return {
    id: row.id,
    pageId: row.page_id,
    pageTitle: row.page_title,
    pageVersion: row.page_version,
    userId: row.user_id,
    userName: row.user_name,
    acknowledgedAt: row.acknowledged_at,
  }
}
