import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  DocumentAuditEntry,
  DocumentComment,
  DocumentVersionSnapshot,
  LibraryDocument,
} from '../types/documents'
import { DOCUMENT_TEMPLATES } from '../data/documentTemplates'
import { DocumentCenterContext, type DocumentCenterValue } from './documentCenterContext'
import { normalizeLibraryDocument } from '../lib/normalizeDocuments'
import { slugifyTitle } from '../lib/wikiSlug'

const STORAGE_KEY = 'atics-document-center-v2'
const LEGACY_KEY = 'atics-document-center-v1'

const DEMO_ACTOR = 'Demo bruker'

const DEFAULT_APPROVAL_STEPS = [
  { roleName: 'HMS-leder' },
  { roleName: 'Daglig leder' },
]

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
  const d = normalizeLibraryDocument({
    id: newId(),
    title: 'Eksempel: Avvikshåndtering',
    category: 'HMS',
    tags: ['avvik', 'internkontroll'],
    lawRef: 'Internkontrollforskriften § 5 (avvik)',
    owner: 'HMS-ansvarlig',
    workflowStatus: 'published',
    wikiSlug: 'eksempel-avvikshandtering',
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
    readingReceipts: [
      { id: newId(), roleLabel: 'HMS-ansvarlig', required: true, acknowledgedBy: DEMO_ACTOR, acknowledgedAt: now },
    ],
    complianceLinks: [{ requirementId: 'req-ik-5', satisfied: true, note: 'Illustrativ kobling' }],
  })
  return [d]
}

function migrateLegacy(raw: unknown): LibraryDocument[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => normalizeLibraryDocument(x as LibraryDocument))
  }
  if (raw && typeof raw === 'object' && 'documents' in raw) {
    const docs = (raw as { documents: unknown }).documents
    if (Array.isArray(docs)) {
      return docs.map((x) => normalizeLibraryDocument(x as LibraryDocument))
    }
  }
  return seedDocs()
}

function loadState(): LibraryDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      return migrateLegacy(parsed)
    }
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown
      const docs = migrateLegacy(parsed)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
      localStorage.removeItem(LEGACY_KEY)
      return docs
    }
    return seedDocs()
  } catch {
    return seedDocs()
  }
}

function saveDocs(docs: LibraryDocument[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
}

function ensureSlug(d: LibraryDocument): LibraryDocument {
  const slug = d.wikiSlug?.trim() || slugifyTitle(d.title)
  if (d.wikiSlug === slug) return d
  return { ...d, wikiSlug: slug }
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
    const t = title?.trim() || tpl.title
    const vars: Record<string, string> = {}
    for (const k of tpl.variableKeys ?? []) {
      vars[k] = ''
    }
    vars['virksomhet'] = vars['virksomhet'] ?? ''
    vars['dato'] = now.slice(0, 10)

    const doc = normalizeLibraryDocument({
      id: newId(),
      title: t,
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
      templateVariables: Object.keys(vars).length ? vars : undefined,
      prePublishChecklist: tpl.prePublishChecklist ? [...tpl.prePublishChecklist] : undefined,
      prePublishChecksDone: tpl.prePublishChecklist ? tpl.prePublishChecklist.map(() => false) : undefined,
    })
    setDocuments((prev) => [ensureSlug(doc), ...prev])
    return ensureSlug(doc)
  }, [])

  const createBlank = useCallback(() => {
    const now = new Date().toISOString()
    const doc = normalizeLibraryDocument({
      id: newId(),
      title: 'Nytt dokument',
      category: 'Generelt',
      tags: [],
      owner: DEMO_ACTOR,
      workflowStatus: 'draft',
      currentHtml: '<p>Skriv innhold her. Bruk <code>[[Tittel på annet dokument]]</code> for wiki-lenker.</p>',
      publishedVersionNumber: 0,
      versions: [],
      audit: [auditEntry('document_created', 'Tomt dokument')],
      createdAt: now,
      updatedAt: now,
    })
    setDocuments((prev) => [ensureSlug(doc), ...prev])
    return ensureSlug(doc)
  }, [])

  const updateDocument = useCallback(
    (
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
        >
      >,
    ) => {
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d
          const next = { ...d, ...patch, updatedAt: new Date().toISOString() }
          if (patch.title !== undefined && patch.wikiSlug === undefined) {
            next.wikiSlug = slugifyTitle(patch.title)
          }
          return ensureSlug(next)
        }),
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
              approvalSteps: [],
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
      prev.map((d) => {
        if (d.id !== id || d.workflowStatus !== 'draft') return d
        const steps =
          d.approvalSteps.length > 0
            ? d.approvalSteps.map((s) => ({ ...s, status: 'pending' as const, approvedBy: undefined, approvedAt: undefined }))
            : DEFAULT_APPROVAL_STEPS.map((s) => ({
                id: newId(),
                roleName: s.roleName,
                status: 'pending' as const,
              }))
        return {
          ...d,
          workflowStatus: 'in_review',
          approvalSteps: steps,
          audit: [auditEntry('submitted_review', 'Sendt til godkjenning (flernivå)'), ...d.audit],
          updatedAt: new Date().toISOString(),
        }
      }),
    )
  }, [])

  const approveStep = useCallback((documentId: string, stepId: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== documentId) return d
        const steps = d.approvalSteps.map((s) =>
          s.id === stepId
            ? { ...s, status: 'approved' as const, approvedBy: DEMO_ACTOR, approvedAt: new Date().toISOString() }
            : s,
        )
        return {
          ...d,
          approvalSteps: steps,
          audit: [auditEntry('approval_step', `Godkjent: ${steps.find((x) => x.id === stepId)?.roleName ?? stepId}`), ...d.audit],
          updatedAt: new Date().toISOString(),
        }
      }),
    )
  }, [])

  const publish = useCallback((id: string) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d
        if (d.workflowStatus !== 'draft' && d.workflowStatus !== 'in_review') return d

        if (d.prePublishChecklist?.length) {
          const done = d.prePublishChecksDone ?? []
          const allChecked = d.prePublishChecklist.every((_, i) => done[i])
          if (!allChecked) {
            return d
          }
        }

        if (d.approvalSteps.length > 0) {
          const allOk = d.approvalSteps.every((s) => s.status === 'approved')
          if (!allOk) return d
        }

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
        const sig = {
          signedAt: new Date().toISOString(),
          signedBy: DEMO_ACTOR,
          method: 'demo_attestation' as const,
          statement: 'Jeg bekrefter at innholdet er korrekt i henhold til interne krav (demo, ikke BankID).',
        }
        const receipts =
          d.readingReceipts.length > 0
            ? d.readingReceipts.map((r) => ({ ...r, acknowledgedBy: undefined, acknowledgedAt: undefined }))
            : [{ id: newId(), roleLabel: 'Alle ledere', required: true }]

        return {
          ...d,
          workflowStatus: 'published',
          publishedHtml: d.currentHtml,
          publishedAt: new Date().toISOString(),
          publishedVersionNumber: nextPub,
          versions: [snap, ...d.versions],
          approvalSteps: [],
          lastSignature: sig,
          readingReceipts: receipts,
          audit: [auditEntry('published', `Publisert versjon ${nextPub} (attestert)`), ...d.audit],
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
              approvalSteps: [],
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

  const addComment = useCallback((documentId: string, html: string, anchor?: string) => {
    const c: DocumentComment = {
      id: newId(),
      anchor,
      html,
      author: DEMO_ACTOR,
      createdAt: new Date().toISOString(),
    }
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === documentId
          ? {
              ...d,
              comments: [c, ...d.comments],
              audit: [auditEntry('comment_added', 'Kommentar lagt til'), ...d.audit],
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    )
  }, [])

  const resolveComment = useCallback((documentId: string, commentId: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === documentId
          ? {
              ...d,
              comments: d.comments.map((c) => (c.id === commentId ? { ...c, resolved: true } : c)),
              audit: [auditEntry('comment_resolved', 'Kommentar løst'), ...d.audit],
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    )
  }, [])

  const confirmReading = useCallback((documentId: string, receiptId: string) => {
    const at = new Date().toISOString()
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === documentId
          ? {
              ...d,
              readingReceipts: d.readingReceipts.map((r) =>
                r.id === receiptId ? { ...r, acknowledgedBy: DEMO_ACTOR, acknowledgedAt: at } : r,
              ),
              audit: [auditEntry('reading_confirmed', 'Lesebekreftelse registrert'), ...d.audit],
              updatedAt: at,
            }
          : d,
      ),
    )
  }, [])

  const exportJson = useCallback(() => {
    return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), documents }, null, 2)
  }, [documents])

  const importJson = useCallback((json: string): { ok: true } | { ok: false; error: string } => {
    try {
      const raw = JSON.parse(json) as { documents?: unknown }
      if (!raw.documents || !Array.isArray(raw.documents)) {
        return { ok: false, error: 'Forventet { documents: [...] }' }
      }
      setDocuments(raw.documents.map((x) => normalizeLibraryDocument(x as LibraryDocument)))
      return { ok: true }
    } catch {
      return { ok: false, error: 'Ugyldig JSON' }
    }
  }, [])

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_KEY)
    setDocuments(seedDocs())
  }, [])

  const stats = useMemo(() => {
    const published = documents.filter((d) => d.workflowStatus === 'published').length
    const review = documents.filter((d) => d.workflowStatus === 'in_review').length
    const dueReview = documents.filter(
      (d) => d.nextReviewDueAt && new Date(d.nextReviewDueAt) <= new Date() && d.workflowStatus === 'published',
    ).length
    const pendingReads = documents.reduce((acc, d) => {
      if (d.workflowStatus !== 'published') return acc
      return (
        acc +
        d.readingReceipts.filter((r) => r.required && !r.acknowledgedAt).length
      )
    }, 0)
    return { total: documents.length, published, review, dueReview, pendingReads }
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
      approveStep,
      addComment,
      resolveComment,
      confirmReading,
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
      approveStep,
      addComment,
      resolveComment,
      confirmReading,
      exportJson,
      importJson,
      resetDemo,
    ],
  )

  return <DocumentCenterContext.Provider value={value}>{children}</DocumentCenterContext.Provider>
}
