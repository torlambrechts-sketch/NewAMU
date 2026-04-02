import { createContext } from 'react'
import type { DocumentTemplate, LibraryDocument } from '../types/documents'

export type DocumentCenterValue = {
  documents: LibraryDocument[]
  templates: DocumentTemplate[]
  stats: { total: number; published: number; review: number }
  createFromTemplate: (templateId: string, title?: string) => LibraryDocument | null
  createBlank: () => LibraryDocument
  updateDocument: (
    id: string,
    patch: Partial<
      Pick<LibraryDocument, 'title' | 'category' | 'tags' | 'lawRef' | 'owner' | 'currentHtml' | 'workflowStatus'>
    >,
  ) => void
  saveVersion: (id: string, note?: string) => void
  submitForReview: (id: string) => void
  publish: (id: string) => void
  startRevision: (id: string) => void
  archive: (id: string) => void
  rejectReview: (id: string) => void
  exportJson: () => string
  importJson: (json: string) => { ok: true } | { ok: false; error: string }
  resetDemo: () => void
}

export const DocumentCenterContext = createContext<DocumentCenterValue | null>(null)
