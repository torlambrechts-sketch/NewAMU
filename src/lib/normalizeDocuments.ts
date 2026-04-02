import type { LibraryDocument } from '../types/documents'
import { slugifyTitle } from './wikiSlug'

export function normalizeLibraryDocument(raw: Partial<LibraryDocument> & { id: string; title: string }): LibraryDocument {
  const now = new Date().toISOString()
  return {
    id: raw.id,
    title: raw.title,
    wikiSlug: raw.wikiSlug ?? slugifyTitle(raw.title),
    category: raw.category ?? 'Generelt',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    lawRef: raw.lawRef,
    owner: raw.owner ?? 'Ukjent',
    workflowStatus: raw.workflowStatus ?? 'draft',
    currentHtml: raw.currentHtml ?? '<p></p>',
    publishedHtml: raw.publishedHtml,
    publishedAt: raw.publishedAt,
    publishedVersionNumber: raw.publishedVersionNumber ?? 0,
    versions: Array.isArray(raw.versions) ? raw.versions : [],
    audit: Array.isArray(raw.audit) ? raw.audit : [],
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    comments: Array.isArray(raw.comments) ? raw.comments : [],
    approvalSteps: Array.isArray(raw.approvalSteps) ? raw.approvalSteps : [],
    nextReviewDueAt: raw.nextReviewDueAt,
    readingReceipts: Array.isArray(raw.readingReceipts) ? raw.readingReceipts : [],
    complianceLinks: Array.isArray(raw.complianceLinks) ? raw.complianceLinks : [],
    externalLinks: Array.isArray(raw.externalLinks) ? raw.externalLinks : [],
    templateVariables:
      raw.templateVariables && typeof raw.templateVariables === 'object' ? raw.templateVariables : {},
    prePublishChecklist: Array.isArray(raw.prePublishChecklist) ? raw.prePublishChecklist : undefined,
    prePublishChecksDone:
      Array.isArray(raw.prePublishChecksDone) && raw.prePublishChecklist
        ? raw.prePublishChecksDone
        : raw.prePublishChecklist
          ? raw.prePublishChecklist.map(() => false)
          : undefined,
    lastSignature: raw.lastSignature,
  }
}
