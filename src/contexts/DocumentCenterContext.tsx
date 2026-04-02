import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { DocumentAuditEntry, DocumentVersionSnapshot, LibraryDocument } from '../types/documents'
import { DOCUMENT_TEMPLATES } from '../data/documentTemplates'
import { DocumentCenterContext, type DocumentCenterValue } from './documentCenterContext'

const STORAGE_KEY = 'atics-document-center-v1'

const DEMO_ACTOR = 'Demo bruker'

function newId(): string {
  return crypto.randomUUID()
}

function auditEntry(action: string, detail?: string): DocumentAuditEntry {
  return {
    id: newId(),
    at: new Date().toISOString(),
    action,
    actor: DEMO_ACTOR,
    detail,
  }
}

function seedDocs(): LibraryDocument[] {
  const now = new Date().toISOString()
  const d: LibraryDocument = {
    id: newId(),
    title: 'Eksempel: Avvikshåndtering',
    category: 'HMS',
    tags: ['avvik', 'internkontroll'],
    lawRef: 'Internkontrollforskriften § 5 (avvik)',
    owner: 'HMS-ansvarlig',
    workflowStatus: 'published',
    currentHtml:
      '<h2>Avvikshåndtering</h2><p>Alle avvik skal registreres og følges opp.</p><ol><li>Registrer</li><li>Vurder</li><li>Tiltak</li><li>Verifiser</li></ol>',
    publishedHtml:
      '<h2>Avvikshåndtering</h2><p>Alle avvik skal registreres og følges opp.</p><ol><li>Registrer</li><li>Vurder</li><li>Tiltak</li><li>Verifiser</li></ol>',
    publishedAt: now,
    publishedVersionNumber: 1,
    versions: [
      {
        id: newId(),
        versionNumber: 1,
        html: '<h2>Avvikshåndtering</h2><p>Alle avvik skal registreres og følges opp.</p>',
        title: 'Eksempel: Avvikshåndtering',
        savedAt: now,
        savedBy: DEMO_ACTOR,
        note: 'Første publisering',
      },
    ],
    audit: [auditEntry('document_created', 'Opprettet fra eksempel'), auditEntry('published', 'Versjon 1 publisert')],
    createdAt: now,
    updatedAt: now,
  }
  return [d]
}

function loadState(): LibraryDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedDocs()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return seedDocs()
    return parsed as LibraryDocument[]
  } catch {
    return seedDocs()
  }
}

function saveDocs(docs: LibraryDocument[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
}

export function DocumentCenterProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<LibraryDocument[]>(() => loadState())

  useEffect(() => {
    saveDocs(documents)
  }, [documents])

  const createFromTemplate = useCallback((templateId: string, title?: string) => {
    const tpl = DOCUMENT_TEMPLATES.find((t) => t.id === templateId)
    if (!tpl) return null
    const now = new Date().toISOString()
    const doc: LibraryDocument = {
      id: newId(),
      title: title?.trim() || tpl.title,
      category: tpl.category,
      tags: [...tpl.suggestedTags],
      lawRef: tpl.lawRef,
      owner: DEMO_ACTOR,
      workflowStatus: 'draft',
      currentHtml: tpl.html,
      publishedVersionNumber: 0,
      versions: [],
      audit: [auditEntry('document_created', `Mal: ${tpl.title}`)],
      createdAt: now,
      updatedAt: now,
    }
    setDocuments((prev) => [doc, ...prev])
    return doc
  }, [])

  const createBlank = useCallback(() => {
    const now = new Date().toISOString()
    const doc: LibraryDocument = {
      id: newId(),
      title: 'Nytt dokument',
      category: 'Generelt',
      tags: [],
      owner: DEMO_ACTOR,
      workflowStatus: 'draft',
      currentHtml: '<p>Skriv innhold her.</p>',
      publishedVersionNumber: 0,
      versions: [],
      audit: [auditEntry('document_created', 'Tomt dokument')],
      createdAt: now,
      updatedAt: now,
    }
    setDocuments((prev) => [doc, ...prev])
    return doc
  }, [])

  const updateDocument = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<LibraryDocument, 'title' | 'category' | 'tags' | 'lawRef' | 'owner' | 'currentHtml' | 'workflowStatus'>
      >,
    ) => {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                ...patch,
                updatedAt: new Date().toISOString(),
              }
            : d,
        ),
      )
    },
    [],
  )

  const rejectReview = useCallback((id: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === id && d.workflowStatus === 'in_review'
          ? {
              ...d,
              workflowStatus: 'draft',
              audit: [auditEntry('review_rejected', 'Tilbake til utkast'), ...d.audit],
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    )
  }, [])

  const saveVersion = useCallback((id: string, note?: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d
        const nextNum = Math.max(d.publishedVersionNumber, ...d.versions.map((v) => v.versionNumber), 0) + 1
        const snap: DocumentVersionSnapshot = {
          id: newId(),
          versionNumber: nextNum,
          html: d.currentHtml,
          title: d.title,
          savedAt: new Date().toISOString(),
          savedBy: DEMO_ACTOR,
          note,
        }
        return {
          ...d,
          versions: [snap, ...d.versions],
          audit: [auditEntry('version_saved', `Versjon ${nextNum}${note ? `: ${note}` : ''}`), ...d.audit],
          updatedAt: new Date().toISOString(),
        }
      }),
    )
  }, [])

  const submitForReview = useCallback((id: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === id && d.workflowStatus === 'draft'
          ? {
              ...d,
              workflowStatus: 'in_review',
              audit: [auditEntry('submitted_review', 'Sendt til godkjenning'), ...d.audit],
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    )
  }, [])

  const publish = useCallback((id: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d
        if (d.workflowStatus !== 'draft' && d.workflowStatus !== 'in_review') return d
        const nextPub = d.publishedVersionNumber + 1
        const snap: DocumentVersionSnapshot = {
          id: newId(),
          versionNumber: nextPub,
          html: d.currentHtml,
          title: d.title,
          savedAt: new Date().toISOString(),
          savedBy: DEMO_ACTOR,
          note: 'Publisert',
        }
        return {
          ...d,
          workflowStatus: 'published',
          publishedHtml: d.currentHtml,
          publishedAt: new Date().toISOString(),
          publishedVersionNumber: nextPub,
          versions: [snap, ...d.versions],
          audit: [auditEntry('published', `Publisert versjon ${nextPub}`), ...d.audit],
          updatedAt: new Date().toISOString(),
        }
      }),
    )
  }, [])

  const startRevision = useCallback((id: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === id && d.workflowStatus === 'published'
          ? {
              ...d,
              workflowStatus: 'draft',
              currentHtml: d.publishedHtml ?? d.currentHtml,
              audit: [auditEntry('revision_started', 'Ny revisjon basert på publisert versjon'), ...d.audit],
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    )
  }, [])

  const archive = useCallback((id: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              workflowStatus: 'archived',
              audit: [auditEntry('archived', 'Arkivert'), ...d.audit],
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    )
  }, [])

  const exportJson = useCallback(() => {
    return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), documents }, null, 2)
  }, [documents])

  const importJson = useCallback((json: string): { ok: true } | { ok: false; error: string } => {
    try {
      const raw = JSON.parse(json) as { documents?: LibraryDocument[] }
      if (!raw.documents || !Array.isArray(raw.documents)) {
        return { ok: false, error: 'Forventet { documents: [...] }' }
      }
      setDocuments(raw.documents)
      return { ok: true }
    } catch {
      return { ok: false, error: 'Ugyldig JSON' }
    }
  }, [])

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setDocuments(seedDocs())
  }, [])

  const stats = useMemo(() => {
    const published = documents.filter((d) => d.workflowStatus === 'published').length
    const review = documents.filter((d) => d.workflowStatus === 'in_review').length
    return { total: documents.length, published, review }
  }, [documents])

  const value = useMemo<DocumentCenterValue>(
    () => ({
      documents,
      templates: DOCUMENT_TEMPLATES,
      stats,
      createFromTemplate,
      createBlank,
      updateDocument,
      saveVersion,
      submitForReview,
      publish,
      startRevision,
      archive,
      rejectReview,
      exportJson,
      importJson,
      resetDemo,
    }),
    [
      documents,
      stats,
      createFromTemplate,
      createBlank,
      updateDocument,
      saveVersion,
      submitForReview,
      publish,
      startRevision,
      archive,
      rejectReview,
      exportJson,
      importJson,
      resetDemo,
    ],
  )

  return <DocumentCenterContext.Provider value={value}>{children}</DocumentCenterContext.Provider>
}
