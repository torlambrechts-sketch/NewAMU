import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AuditLedgerEntry,
  ComplianceReceipt,
  ContentBlock,
  WikiPage,
  WikiSpace,
} from '../types/documents'
import { SEED_SPACES } from '../data/documentTemplates'

const STORAGE_KEY = 'atics-documents-v2'

// ─── Demo user (localStorage only) ───────────────────────────────────────────
export const DEMO_USER_ID = 'user-demo'
export const DEMO_USER_NAME = 'Demo User'

// ─── State ────────────────────────────────────────────────────────────────────

type DocumentsState = {
  spaces: WikiSpace[]
  pages: WikiPage[]
  auditLedger: AuditLedgerEntry[]
  receipts: ComplianceReceipt[]
}

function load(): DocumentsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as DocumentsState
      return {
        spaces: Array.isArray(p.spaces) ? p.spaces : SEED_SPACES,
        pages: Array.isArray(p.pages) ? p.pages : [],
        auditLedger: Array.isArray(p.auditLedger) ? p.auditLedger : [],
        receipts: Array.isArray(p.receipts) ? p.receipts : [],
      }
    }
  } catch { /* ignore */ }
  return { spaces: SEED_SPACES, pages: [], auditLedger: [], receipts: [] }
}

function save(state: DocumentsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function ledgerEntry(
  page: WikiPage,
  action: AuditLedgerEntry['action'],
  fromVersion?: number,
): AuditLedgerEntry {
  return {
    id: crypto.randomUUID(),
    pageId: page.id,
    pageTitle: page.title,
    action,
    userId: DEMO_USER_ID,
    fromVersion,
    toVersion: page.version,
    at: new Date().toISOString(),
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDocuments() {
  const [state, setState] = useState<DocumentsState>(load)

  useEffect(() => { save(state) }, [state])

  // ── Spaces ──────────────────────────────────────────────────────────────────

  const createSpace = useCallback((
    title: string,
    description: string,
    category: WikiSpace['category'],
    icon: string,
  ) => {
    const now = new Date().toISOString()
    const space: WikiSpace = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      category,
      icon,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    setState((s) => ({ ...s, spaces: [...s.spaces, space] }))
    return space
  }, [])

  const updateSpace = useCallback((id: string, patch: Partial<WikiSpace>) => {
    setState((s) => ({
      ...s,
      spaces: s.spaces.map((sp) =>
        sp.id === id ? { ...sp, ...patch, updatedAt: new Date().toISOString() } : sp,
      ),
    }))
  }, [])

  // ── Pages ───────────────────────────────────────────────────────────────────

  const createPage = useCallback((
    spaceId: string,
    title: string,
    template: WikiPage['template'] = 'standard',
    blocks: ContentBlock[] = [],
    opts?: Partial<Pick<WikiPage, 'legalRefs' | 'requiresAcknowledgement' | 'summary'>>,
  ) => {
    const now = new Date().toISOString()
    const page: WikiPage = {
      id: crypto.randomUUID(),
      spaceId,
      title: title.trim(),
      summary: opts?.summary ?? '',
      status: 'draft',
      template,
      legalRefs: opts?.legalRefs ?? [],
      requiresAcknowledgement: opts?.requiresAcknowledgement ?? false,
      blocks,
      version: 1,
      createdAt: now,
      updatedAt: now,
      authorId: DEMO_USER_ID,
    }
    const entry = ledgerEntry(page, 'created')
    setState((s) => ({
      ...s,
      pages: [...s.pages, page],
      auditLedger: [entry, ...s.auditLedger],
    }))
    return page
  }, [])

  const updatePage = useCallback((
    id: string,
    patch: Partial<Pick<WikiPage, 'title' | 'summary' | 'blocks' | 'legalRefs' | 'requiresAcknowledgement' | 'template'>>,
  ) => {
    setState((s) => {
      const old = s.pages.find((p) => p.id === id)
      if (!old) return s
      const fromVersion = old.version
      const next: WikiPage = {
        ...old,
        ...patch,
        version: old.version + 1,
        updatedAt: new Date().toISOString(),
      }
      const entry = ledgerEntry(next, 'updated', fromVersion)
      return {
        ...s,
        pages: s.pages.map((p) => (p.id === id ? next : p)),
        auditLedger: [entry, ...s.auditLedger],
      }
    })
  }, [])

  const publishPage = useCallback((id: string) => {
    setState((s) => {
      const old = s.pages.find((p) => p.id === id)
      if (!old) return s
      const fromVersion = old.version
      const next: WikiPage = {
        ...old,
        status: 'published',
        version: old.version + 1,
        updatedAt: new Date().toISOString(),
      }
      const entry = ledgerEntry(next, 'published', fromVersion)
      return {
        ...s,
        pages: s.pages.map((p) => (p.id === id ? next : p)),
        auditLedger: [entry, ...s.auditLedger],
      }
    })
  }, [])

  const archivePage = useCallback((id: string) => {
    setState((s) => {
      const old = s.pages.find((p) => p.id === id)
      if (!old) return s
      const fromVersion = old.version
      const next: WikiPage = {
        ...old,
        status: 'archived',
        version: old.version + 1,
        updatedAt: new Date().toISOString(),
      }
      const entry = ledgerEntry(next, 'archived', fromVersion)
      return {
        ...s,
        pages: s.pages.map((p) => (p.id === id ? next : p)),
        auditLedger: [entry, ...s.auditLedger],
      }
    })
  }, [])

  const deletePage = useCallback((id: string) => {
    setState((s) => ({ ...s, pages: s.pages.filter((p) => p.id !== id) }))
  }, [])

  // ── Acknowledge / sign-off ──────────────────────────────────────────────────

  const acknowledge = useCallback((pageId: string, userName: string) => {
    setState((s) => {
      const page = s.pages.find((p) => p.id === pageId)
      if (!page) return s
      const already = s.receipts.some(
        (r) => r.pageId === pageId && r.userId === DEMO_USER_ID && r.pageVersion === page.version,
      )
      if (already) return s
      const receipt: ComplianceReceipt = {
        id: crypto.randomUUID(),
        pageId,
        pageTitle: page.title,
        pageVersion: page.version,
        userId: DEMO_USER_ID,
        userName: userName.trim() || DEMO_USER_NAME,
        acknowledgedAt: new Date().toISOString(),
      }
      const entry = ledgerEntry(page, 'acknowledged')
      return {
        ...s,
        receipts: [receipt, ...s.receipts],
        auditLedger: [entry, ...s.auditLedger],
      }
    })
  }, [])

  const hasAcknowledged = useCallback(
    (pageId: string, version: number) =>
      state.receipts.some(
        (r) => r.pageId === pageId && r.userId === DEMO_USER_ID && r.pageVersion === version,
      ),
    [state.receipts],
  )

  // ── Derived stats ───────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const published = state.pages.filter((p) => p.status === 'published').length
    const drafts = state.pages.filter((p) => p.status === 'draft').length
    const requireAck = state.pages.filter((p) => p.requiresAcknowledgement && p.status === 'published').length
    const acknowledged = state.receipts.length
    return { published, drafts, requireAck, acknowledged, total: state.pages.length }
  }, [state])

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState(load())
  }, [])

  return {
    spaces: state.spaces,
    pages: state.pages,
    auditLedger: state.auditLedger,
    receipts: state.receipts,
    stats,
    createSpace,
    updateSpace,
    createPage,
    updatePage,
    publishPage,
    archivePage,
    deletePage,
    acknowledge,
    hasAcknowledged,
    resetDemo,
  }
}
