import { createContext } from 'react'
import type { DocumentTemplate, LibraryDocument } from '../types/documents'

export type DocumentCenterValue = {
  documents: LibraryDocument[]
  templates: DocumentTemplate[]
  /** Master documentation checklist (suggested documents) — id -> done */
  masterChecklistProgress: Record<string, boolean>
  setMasterChecklistItem: (itemId: string, done: boolean) => void
  stats: {
    total: number
    published: number
    review: number
    dueReview: number
    pendingReads: number
  }
  createFromTemplate: (templateId: string, title?: string) => LibraryDocument | null
  createBlank: () => LibraryDocument
  updateDocument: (
    id: string,
    patch: Partial<
      Pick<
        LibraryDocument,
        | 'title'
        | 'category'
        | 'tags'
        | 'lawRef'
        | 'owner'
        | 'currentHtml'
        | 'workflowStatus'
        | 'wikiSlug'
        | 'templateVariables'
        | 'prePublishChecksDone'
        | 'externalLinks'
        | 'complianceLinks'
        | 'readingReceipts'
        | 'nextReviewDueAt'
        | 'attachments'
      >
    >,
  ) => void
  addAttachment: (documentId: string, file: File) => Promise<{ ok: true } | { ok: false; error: string }>
  removeAttachment: (documentId: string, attachmentId: string) => void
  saveVersion: (id: string, note?: string) => void
  submitForReview: (id: string) => void
  approveStep: (documentId: string, stepId: string) => void
  publish: (id: string) => void
  startRevision: (id: string) => void
  archive: (id: string) => void
  rejectReview: (id: string) => void
  addComment: (documentId: string, html: string, anchor?: string) => void
  resolveComment: (documentId: string, commentId: string) => void
  confirmReading: (documentId: string, receiptId: string) => void
  exportJson: () => string
  importJson: (json: string) => { ok: true } | { ok: false; error: string }
  resetDemo: () => void
}

export const DocumentCenterContext = createContext<DocumentCenterValue | null>(null)
