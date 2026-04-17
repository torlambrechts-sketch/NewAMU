/* eslint-disable react-refresh/only-export-components -- provider + hooks in one module */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import type {
  AuditLedgerEntry,
  Block,
  ComplianceReceipt,
  PageTemplate,
  SpaceCategory,
  WikiPage,
  WikiPageVersionSnapshot,
  WikiSpace,
  WikiSpaceItem,
} from '../types/documents'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import { LEGAL_COVERAGE as STATIC_LEGAL_COVERAGE, PAGE_TEMPLATES as STATIC_PAGE_TEMPLATES } from '../data/documentTemplates'
import * as docsApi from '../api/documents.api'
import {
  hasAcknowledgedCurrentVersion,
  maxReceiptVersionForUser,
  userMustAcknowledgePage,
} from '../lib/wikiCompliance'

export const DEMO_USER_NAME = 'Demo User'

type DocumentsState = {
  spaces: WikiSpace[]
  pages: WikiPage[]
  auditLedger: AuditLedgerEntry[]
  receipts: ComplianceReceipt[]
  spaceItems: WikiSpaceItem[]
  pageVersions: WikiPageVersionSnapshot[]
}

type LegalCoverageRow = { id: string; ref: string; label: string; templateIds: string[] }

export type WikiComplianceSummaryRow = {
  id: string
  ref: string
  requirement: string
  category: string
  organization_id: string
  covered_count: number
  earliest_revision_due: string | null
  has_overdue: boolean
}

export type OrgPeerProfile = {
  id: string
  display_name: string
  department_id?: string | null
  learning_metadata?: Record<string, unknown> | null
  is_org_admin?: boolean | null
}

type OrgTemplateSetting = { templateId: string; enabled: boolean; customBlocks: Block[] | null }

type OrgCustomTemplate = {
  id: string
  label: string
  description: string
  category: SpaceCategory
  legalBasis: string[]
  pagePayload: Omit<WikiPage, 'id' | 'spaceId' | 'createdAt' | 'updatedAt' | 'authorId' | 'version' | 'wordCount' | 'sortOrder' | 'isPinned'>
}

function emptyState(): DocumentsState {
  return { spaces: [], pages: [], auditLedger: [], receipts: [], spaceItems: [], pageVersions: [] }
}

function cloneBlocksSafe(blocks: Block[]): Block[] {
  return JSON.parse(JSON.stringify(blocks)) as Block[]
}

function snapKey(orgId: string, userId: string) {
  return `atics-documents-snap:${orgId}:${userId}`
}

function readSnap(orgId: string, userId: string): DocumentsState | null {
  try {
    const raw = sessionStorage.getItem(snapKey(orgId, userId))
    if (!raw) return null
    return JSON.parse(raw) as DocumentsState
  } catch {
    return null
  }
}

function writeSnap(orgId: string, userId: string, state: DocumentsState) {
  try {
    sessionStorage.setItem(snapKey(orgId, userId), JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function clearSnap(orgId: string, userId: string) {
  try {
    sessionStorage.removeItem(snapKey(orgId, userId))
  } catch {
    /* ignore */
  }
}

function useDocumentsStore() {
  const { supabase, organization, user, profile, isAdmin: isOrgAdminFromPerms } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = user?.id
  const authorFallback = userId ?? ''

  const ready = !!(supabase && orgId && userId)
  const initialSnap = ready ? readSnap(orgId, userId) : null

  const [remoteState, setRemoteState] = useState<DocumentsState>(() => initialSnap ?? emptyState())
  const [legalCoverage, setLegalCoverage] = useState<LegalCoverageRow[]>([])
  const [complianceSummary, setComplianceSummary] = useState<WikiComplianceSummaryRow[]>([])
  const [coverageOwnerByItemId, setCoverageOwnerByItemId] = useState<Record<string, string | null>>({})
  const [orgPeerProfiles, setOrgPeerProfiles] = useState<OrgPeerProfile[]>([])
  const [systemTemplates, setSystemTemplates] = useState<
    { id: string; label: string; description: string; category: SpaceCategory; legalBasis: string[]; pagePayload: PageTemplate['page'] }[]
  >([])
  const [orgTemplateSettings, setOrgTemplateSettings] = useState<OrgTemplateSetting[]>([])
  const [orgCustomTemplates, setOrgCustomTemplates] = useState<OrgCustomTemplate[]>([])
  const [loading, setLoading] = useState(ready)
  const [error, setError] = useState<string | null>(null)
  const [pageHydrate, setPageHydrate] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  })

  const isOrgAdmin = profile?.is_org_admin === true || isOrgAdminFromPerms

  const mergeState = useCallback(
    (fn: (prev: DocumentsState) => DocumentsState) => {
      if (!orgId || !userId) return
      setRemoteState((prev) => {
        const next = fn(prev)
        writeSnap(orgId, userId, next)
        return next
      })
    },
    [orgId, userId],
  )

  const refreshDocuments = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      await docsApi.apiWikiEnsureOrgDefaults(supabase)
      const [
        covRows,
        sumRows,
        assignRows,
        peersRows,
        tplRows,
        setRows,
        customRows,
        data,
      ] = await Promise.all([
        docsApi.apiFetchLegalCoverage(supabase),
        docsApi.apiFetchComplianceSummary(supabase, orgId),
        docsApi.apiFetchCoverageAssignments(supabase, orgId),
        docsApi.apiFetchOrgPeerProfiles(supabase, orgId),
        docsApi.apiFetchSystemTemplates(supabase),
        docsApi.apiFetchOrgTemplateSettings(supabase, orgId),
        docsApi.apiFetchOrgCustomTemplates(supabase, orgId),
        docsApi.apiFetchAllForOrg(supabase, orgId, authorFallback),
      ])

      setLegalCoverage(
        covRows.map((r) => ({
          id: r.id,
          ref: r.ref,
          label: r.label,
          templateIds: r.template_ids ?? [],
        })),
      )
      setComplianceSummary(sumRows as WikiComplianceSummaryRow[])
      const ownMap: Record<string, string | null> = {}
      for (const row of assignRows) {
        ownMap[(row as { coverage_item_id: string }).coverage_item_id] = (row as { owner_id: string | null }).owner_id
      }
      setCoverageOwnerByItemId(ownMap)
      setOrgPeerProfiles(
        peersRows.map((p) => ({
          id: p.id,
          display_name: p.display_name ?? 'Bruker',
          department_id: p.department_id ?? null,
          learning_metadata: p.learning_metadata ?? null,
          is_org_admin: p.is_org_admin ?? null,
        })),
      )
      setSystemTemplates(
        tplRows.map((r) => ({
          id: r.id as string,
          label: r.label as string,
          description: (r.description as string) ?? '',
          category: r.category as SpaceCategory,
          legalBasis: (r.legal_basis as string[]) ?? [],
          pagePayload: r.page_payload as PageTemplate['page'],
        })),
      )
      setOrgTemplateSettings(
        setRows.map((r) => ({
          templateId: (r as { template_id: string }).template_id,
          enabled: (r as { enabled: boolean }).enabled,
          customBlocks: Array.isArray((r as { custom_blocks?: unknown }).custom_blocks)
            ? ((r as { custom_blocks: Block[] }).custom_blocks as Block[])
            : null,
        })),
      )
      setOrgCustomTemplates(
        customRows.map((r) => ({
          id: r.id as string,
          label: r.label as string,
          description: (r.description as string) ?? '',
          category: r.category as SpaceCategory,
          legalBasis: (r.legal_basis as string[]) ?? [],
          pagePayload: r.page_payload as OrgCustomTemplate['pagePayload'],
        })),
      )
      setRemoteState({
        spaces: data.spaces,
        pages: data.pages,
        auditLedger: data.auditLedger,
        receipts: data.receipts,
        spaceItems: data.spaceItems,
        pageVersions: data.pageVersions,
      })
      writeSnap(orgId, userId, data)
    } catch (e) {
      setError(getSupabaseErrorMessage(e))
      clearSnap(orgId, userId)
      setRemoteState(emptyState())
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, userId, authorFallback])

  useEffect(() => {
    if (!ready) {
      setLoading(false)
      setError(ready ? null : 'Logg inn med organisasjon for å bruke dokumenter.')
      setRemoteState(emptyState())
      return
    }
    void refreshDocuments()
  }, [ready, refreshDocuments])

  const ensurePageLoaded = useCallback(
    async (pageId: string | undefined) => {
      if (!pageId || !supabase || !orgId || !userId) return
      setPageHydrate({ loading: true, error: null })
      try {
        const mapped = await docsApi.apiFetchWikiPageById(supabase, orgId, pageId, authorFallback)
        if (!mapped) {
          setPageHydrate({ loading: false, error: null })
          return
        }
        mergeState((s) => {
          if (s.pages.some((p) => p.id === mapped.id)) return s
          return { ...s, pages: [...s.pages, mapped] }
        })
        setPageHydrate({ loading: false, error: null })
      } catch (e) {
        setPageHydrate({ loading: false, error: getSupabaseErrorMessage(e) })
      }
    },
    [supabase, orgId, userId, authorFallback, mergeState],
  )

  const pageTemplates: PageTemplate[] = useMemo(() => {
    if (!ready) return STATIC_PAGE_TEMPLATES
    const enabled = (tid: string) => {
      const row = orgTemplateSettings.find((s) => s.templateId === tid)
      return row ? row.enabled : true
    }
    const system: PageTemplate[] = systemTemplates
      .filter((t) => enabled(t.id))
      .map((t) => {
        const row = orgTemplateSettings.find((s) => s.templateId === t.id)
        const custom = row?.customBlocks
        const pagePayload = t.pagePayload as PageTemplate['page']
        const page =
          custom && custom.length > 0
            ? { ...pagePayload, blocks: cloneBlocksSafe(custom) }
            : pagePayload
        return {
          id: t.id,
          label: t.label,
          description: t.description,
          legalBasis: t.legalBasis,
          category: t.category,
          page,
        }
      })
    const custom: PageTemplate[] = orgCustomTemplates.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      legalBasis: t.legalBasis,
      category: t.category,
      page: t.pagePayload,
    }))
    return [...system, ...custom]
  }, [ready, systemTemplates, orgTemplateSettings, orgCustomTemplates])

  const setSystemTemplateEnabled = useCallback(
    async (templateId: string, enabled: boolean) => {
      if (!supabase || !orgId) return
      const existing = orgTemplateSettings.find((x) => x.templateId === templateId)
      await docsApi.apiUpsertOrgTemplateSetting(supabase, orgId, {
        organization_id: orgId,
        template_id: templateId,
        enabled,
        custom_blocks: existing?.customBlocks ?? null,
      })
      setOrgTemplateSettings((prev) => {
        const next = prev.filter((x) => x.templateId !== templateId)
        next.push({ templateId, enabled, customBlocks: existing?.customBlocks ?? null })
        return next
      })
    },
    [supabase, orgId, orgTemplateSettings],
  )

  const saveSystemTemplateCustomBlocks = useCallback(
    async (templateId: string, blocks: Block[]) => {
      if (!supabase || !orgId) throw new Error('Ikke tilkoblet')
      const existing = orgTemplateSettings.find((x) => x.templateId === templateId)
      const payload = {
        organization_id: orgId,
        template_id: templateId,
        enabled: existing?.enabled ?? true,
        custom_blocks: blocks.length > 0 ? blocks : null,
      }
      await docsApi.apiUpsertOrgTemplateSetting(supabase, orgId, payload)
      setOrgTemplateSettings((prev) => {
        const next = prev.filter((x) => x.templateId !== templateId)
        next.push({
          templateId,
          enabled: existing?.enabled ?? true,
          customBlocks: blocks.length > 0 ? cloneBlocksSafe(blocks) : null,
        })
        return next
      })
    },
    [supabase, orgId, orgTemplateSettings],
  )

  const saveOrgCustomTemplate = useCallback(
    async (input: {
      id?: string
      label: string
      description: string
      category: SpaceCategory
      legalBasis: string[]
      page: PageTemplate['page']
    }) => {
      if (!supabase || !orgId || !userId) return
      const id = input.id ?? crypto.randomUUID()
      const row = {
        id,
        organization_id: orgId,
        label: input.label.trim(),
        description: input.description.trim(),
        category: input.category,
        legal_basis: input.legalBasis,
        page_payload: input.page,
      }
      await docsApi.apiUpsertOrgCustomTemplate(supabase, row)
      const rowOut = await docsApi.apiSelectOrgCustomTemplate(supabase, id)
      const mapped = {
        id: rowOut.id,
        label: rowOut.label,
        description: rowOut.description ?? '',
        category: rowOut.category as SpaceCategory,
        legalBasis: (rowOut.legal_basis as string[]) ?? [],
        pagePayload: rowOut.page_payload as OrgCustomTemplate['pagePayload'],
      }
      setOrgCustomTemplates((prev) => {
        const i = prev.findIndex((x) => x.id === id)
        if (i < 0) return [mapped, ...prev]
        const copy = [...prev]
        copy[i] = mapped
        return copy
      })
      return id
    },
    [supabase, orgId, userId],
  )

  const deleteOrgCustomTemplate = useCallback(
    async (id: string) => {
      if (!supabase || !orgId) return
      await docsApi.apiDeleteOrgCustomTemplate(supabase, orgId, id)
      setOrgCustomTemplates((prev) => prev.filter((t) => t.id !== id))
    },
    [supabase, orgId],
  )

  const insertLedgerRemote = useCallback(
    async (page: WikiPage, action: AuditLedgerEntry['action'], fromVersion?: number) => {
      if (!supabase || !orgId || !userId) return
      const entry = await docsApi.apiInsertAuditLedger(supabase, orgId, userId, {
        page_id: page.id,
        page_title: page.title,
        action,
        from_version: fromVersion ?? null,
        to_version: page.version,
      })
      mergeState((s) => ({ ...s, auditLedger: [entry, ...s.auditLedger] }))
    },
    [supabase, orgId, userId, mergeState],
  )

  const createSpace = useCallback(
    async (title: string, description: string, category: WikiSpace['category'], icon: string) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const id = crypto.randomUUID()
      const space = await docsApi.apiCreateWikiSpace(supabase, orgId, {
        id,
        title: title.trim(),
        description: description.trim(),
        category,
        icon,
        status: 'active',
      })
      mergeState((s) => ({ ...s, spaces: [...s.spaces, space] }))
      return space
    },
    [supabase, orgId, userId, mergeState],
  )

  const updateSpace = useCallback(
    async (id: string, patch: Partial<WikiSpace>) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const dbPatch: Record<string, unknown> = {}
      if (patch.title !== undefined) dbPatch.title = patch.title
      if (patch.description !== undefined) dbPatch.description = patch.description
      if (patch.category !== undefined) dbPatch.category = patch.category
      if (patch.icon !== undefined) dbPatch.icon = patch.icon
      if (patch.status !== undefined) dbPatch.status = patch.status
      const space = await docsApi.apiUpdateWikiSpace(supabase, orgId, id, dbPatch)
      mergeState((s) => ({ ...s, spaces: s.spaces.map((sp) => (sp.id === id ? space : sp)) }))
    },
    [supabase, orgId, userId, mergeState],
  )

  const createPage = useCallback(
    async (
      spaceId: string,
      title: string,
      template: WikiPage['template'] = 'standard',
      blocks: Block[] = [],
      opts?: Partial<
        Pick<
          WikiPage,
          | 'legalRefs'
          | 'requiresAcknowledgement'
          | 'summary'
          | 'acknowledgementAudience'
          | 'acknowledgementDepartmentId'
          | 'revisionIntervalMonths'
          | 'nextRevisionDueAt'
          | 'templateSourceId'
        >
      >,
    ) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const id = crypto.randomUUID()
      const maxSort = remoteState.pages.filter((p) => p.spaceId === spaceId).reduce((m, p) => Math.max(m, p.sortOrder), -1)
      const pageRow: Record<string, unknown> = {
        id,
        organization_id: orgId,
        space_id: spaceId,
        title: title.trim(),
        summary: opts?.summary ?? '',
        status: 'draft' as const,
        template,
        legal_refs: opts?.legalRefs ?? [],
        requires_acknowledgement: opts?.requiresAcknowledgement ?? false,
        acknowledgement_audience: opts?.acknowledgementAudience ?? 'all_employees',
        acknowledgement_department_id: opts?.acknowledgementDepartmentId ?? null,
        revision_interval_months: opts?.revisionIntervalMonths ?? 12,
        blocks: blocks as unknown as Record<string, unknown>[],
        version: 1,
        author_id: userId,
        sort_order: maxSort + 1,
      }
      if (opts?.templateSourceId) pageRow.template_source_id = opts.templateSourceId
      const page = await docsApi.apiInsertWikiPage(supabase, pageRow, authorFallback)
      await insertLedgerRemote(page, 'created')
      mergeState((s) => ({ ...s, pages: [page, ...s.pages] }))
      return page
    },
    [supabase, orgId, userId, authorFallback, insertLedgerRemote, mergeState, remoteState.pages],
  )

  const searchWikiPages = useCallback(
    async (query: string) => {
      if (!supabase || !orgId) return [] as { id: string; space_id: string; title: string; summary: string; status: string; updated_at: string }[]
      const q = query.trim()
      if (!q) return []
      return docsApi.apiSearchWikiPages(supabase, orgId, q)
    },
    [supabase, orgId],
  )

  const reorderPagesInSpace = useCallback(
    async (spaceId: string, orderedPageIds: string[]) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      await docsApi.apiReorderWikiPagesInSpace(supabase, orgId, spaceId, orderedPageIds)
      mergeState((s) => ({
        ...s,
        pages: s.pages.map((p) => {
          const idx = orderedPageIds.indexOf(p.id)
          if (p.spaceId !== spaceId || idx < 0) return p
          return { ...p, sortOrder: idx }
        }),
      }))
    },
    [supabase, orgId, userId, mergeState],
  )

  const movePageToSpace = useCallback(
    async (pageId: string, newSpaceId: string) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const inTarget = remoteState.pages.filter((p) => p.spaceId === newSpaceId)
      const maxSort = inTarget.reduce((m, p) => Math.max(m, p.sortOrder), -1)
      const updated = await docsApi.apiUpdateWikiPage(
        supabase,
        orgId,
        pageId,
        {
          space_id: newSpaceId,
          sort_order: maxSort + 1,
          updated_at: new Date().toISOString(),
        },
        authorFallback,
      )
      mergeState((s) => ({ ...s, pages: s.pages.map((p) => (p.id === pageId ? updated : p)) }))
    },
    [supabase, orgId, userId, remoteState.pages, authorFallback, mergeState],
  )

  const updatePage = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          WikiPage,
          | 'title'
          | 'summary'
          | 'status'
          | 'blocks'
          | 'legalRefs'
          | 'requiresAcknowledgement'
          | 'template'
          | 'acknowledgementAudience'
          | 'acknowledgementDepartmentId'
          | 'revisionIntervalMonths'
          | 'nextRevisionDueAt'
          | 'spaceId'
          | 'sortOrder'
          | 'isPinned'
        >
      >,
    ) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.title !== undefined) dbPatch.title = patch.title
      if (patch.summary !== undefined) dbPatch.summary = patch.summary
      if (patch.status !== undefined) dbPatch.status = patch.status
      if (patch.blocks !== undefined) dbPatch.blocks = patch.blocks
      if (patch.legalRefs !== undefined) dbPatch.legal_refs = patch.legalRefs
      if (patch.requiresAcknowledgement !== undefined) {
        dbPatch.requires_acknowledgement = patch.requiresAcknowledgement
      }
      if (patch.template !== undefined) dbPatch.template = patch.template
      if (patch.acknowledgementAudience !== undefined) {
        dbPatch.acknowledgement_audience = patch.acknowledgementAudience
      }
      if (patch.acknowledgementDepartmentId !== undefined) {
        dbPatch.acknowledgement_department_id = patch.acknowledgementDepartmentId
      }
      if (patch.revisionIntervalMonths !== undefined) {
        dbPatch.revision_interval_months = patch.revisionIntervalMonths
      }
      if (patch.nextRevisionDueAt !== undefined) {
        dbPatch.next_revision_due_at = patch.nextRevisionDueAt
      }
      if (patch.spaceId !== undefined) dbPatch.space_id = patch.spaceId
      if (patch.sortOrder !== undefined) dbPatch.sort_order = patch.sortOrder
      if (patch.isPinned !== undefined) dbPatch.is_pinned = patch.isPinned
      const updated = await docsApi.apiUpdateWikiPage(supabase, orgId, id, dbPatch, authorFallback)
      mergeState((s) => ({ ...s, pages: s.pages.map((p) => (p.id === id ? updated : p)) }))
    },
    [supabase, orgId, userId, authorFallback, mergeState],
  )

  const publishPage = useCallback(
    async (id: string, opts?: { minorRevision?: boolean }) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const old = remoteState.pages.find((p) => p.id === id)
      if (!old) return
      const fromVersion = old.version
      const nextVersion = old.version + 1
      const interval = old.revisionIntervalMonths ?? 12
      const nextDue = new Date()
      nextDue.setMonth(nextDue.getMonth() + interval)
      const isMinor = opts?.minorRevision === true

      const snap = {
        organization_id: orgId,
        page_id: old.id,
        version: old.version,
        title: old.title,
        summary: old.summary ?? '',
        status: old.status,
        template: old.template,
        legal_refs: old.legalRefs,
        requires_acknowledgement: old.requiresAcknowledgement,
        acknowledgement_audience: old.acknowledgementAudience ?? 'all_employees',
        acknowledgement_department_id: old.acknowledgementDepartmentId ?? null,
        blocks: old.blocks as unknown as Record<string, unknown>[],
        next_revision_due_at: old.nextRevisionDueAt,
        revision_interval_months: interval,
        created_by: userId,
        is_minor_revision: isMinor,
      }
      const snapMapped = await docsApi.apiInsertWikiPageVersion(supabase, snap)

      const page = await docsApi.apiUpdateWikiPage(
        supabase,
        orgId,
        id,
        {
          status: 'published',
          version: nextVersion,
          next_revision_due_at: nextDue.toISOString(),
          updated_at: new Date().toISOString(),
        },
        authorFallback,
      )
      await insertLedgerRemote(page, 'published', fromVersion)
      mergeState((s) => ({
        ...s,
        pages: s.pages.map((p) => (p.id === id ? page : p)),
        pageVersions: [snapMapped, ...s.pageVersions],
      }))
    },
    [supabase, orgId, userId, remoteState.pages, authorFallback, insertLedgerRemote, mergeState],
  )

  const archivePage = useCallback(
    async (id: string) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const old = remoteState.pages.find((p) => p.id === id)
      if (!old) return
      const fromVersion = old.version
      const nextVersion = old.version + 1
      const page = await docsApi.apiUpdateWikiPage(
        supabase,
        orgId,
        id,
        { status: 'archived', version: nextVersion, updated_at: new Date().toISOString() },
        authorFallback,
      )
      await insertLedgerRemote(page, 'archived', fromVersion)
      mergeState((s) => ({ ...s, pages: s.pages.map((p) => (p.id === id ? page : p)) }))
    },
    [supabase, orgId, userId, remoteState.pages, authorFallback, insertLedgerRemote, mergeState],
  )

  const deletePage = useCallback(
    async (id: string) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      await docsApi.apiDeleteWikiPage(supabase, orgId, id)
      mergeState((s) => ({
        ...s,
        pages: s.pages.filter((p) => p.id !== id),
        pageVersions: s.pageVersions.filter((v) => v.pageId !== id),
        receipts: s.receipts.filter((r) => r.pageId !== id),
        auditLedger: s.auditLedger.filter((a) => a.pageId !== id),
      }))
    },
    [supabase, orgId, userId, mergeState],
  )

  const acknowledgementRequiredForMe = useCallback(
    (page: WikiPage) =>
      page.requiresAcknowledgement &&
      userMustAcknowledgePage(page, {
        isOrgAdmin,
        departmentId: profile?.department_id,
        learningMetadata: profile?.learning_metadata as Record<string, unknown> | null | undefined,
      }),
    [isOrgAdmin, profile?.department_id, profile?.learning_metadata],
  )

  const acknowledge = useCallback(
    async (pageId: string) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const display = profile?.display_name?.trim() || DEMO_USER_NAME
      const page = remoteState.pages.find((p) => p.id === pageId)
      if (!page) return
      if (!acknowledgementRequiredForMe(page)) return
      if (hasAcknowledgedCurrentVersion(page, userId, remoteState.receipts, remoteState.pageVersions)) return
      const receipt = await docsApi.apiInsertComplianceReceipt(supabase, orgId, userId, {
        page_id: pageId,
        page_title: page.title,
        page_version: page.version,
        user_name: display,
      })
      await insertLedgerRemote(page, 'acknowledged')
      mergeState((s) => ({ ...s, receipts: [receipt, ...s.receipts] }))
    },
    [
      supabase,
      orgId,
      userId,
      remoteState.pages,
      remoteState.receipts,
      remoteState.pageVersions,
      profile?.display_name,
      acknowledgementRequiredForMe,
      insertLedgerRemote,
      mergeState,
    ],
  )

  const hasAcknowledged = useCallback(
    (pageId: string, version: number) => {
      if (!userId) return false
      const page = remoteState.pages.find((p) => p.id === pageId)
      if (!page || page.version !== version) return false
      return hasAcknowledgedCurrentVersion(page, userId, remoteState.receipts, remoteState.pageVersions)
    },
    [remoteState.pages, remoteState.receipts, remoteState.pageVersions, userId],
  )

  const queueAckReminderNotifications = useCallback(
    async (pageId: string) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const page = remoteState.pages.find((p) => p.id === pageId)
      if (!page || page.status !== 'published' || !page.requiresAcknowledgement) {
        throw new Error('Siden krever ikke bekreftelse eller er ikke publisert.')
      }
      const eligible = orgPeerProfiles.filter((peer) =>
        userMustAcknowledgePage(page, {
          isOrgAdmin: peer.is_org_admin === true,
          departmentId: peer.department_id,
          learningMetadata: peer.learning_metadata,
        }),
      )
      const signed = new Set(
        eligible
          .filter((peer) =>
            hasAcknowledgedCurrentVersion(page, peer.id, remoteState.receipts, remoteState.pageVersions),
          )
          .map((p) => p.id),
      )
      const unsigned = eligible.filter((p) => !signed.has(p.id))
      if (unsigned.length === 0) throw new Error('Alle i målgruppen har allerede signert denne versjonen.')
      const rows = unsigned.map((peer) => ({
        organization_id: orgId,
        rule_id: null,
        step_id: null,
        step_type: 'send_notification',
        config_json: {
          title: 'Påminnelse: dokument krever bekreftelse',
          body: `Du har ikke bekreftet at du har lest «${page.title}» (versjon ${page.version}).`,
        },
        context_json: {
          pageId: page.id,
          pageTitle: page.title,
          pageVersion: page.version,
          audience: page.acknowledgementAudience ?? 'all_employees',
          targetUserId: peer.id,
          kind: 'wiki_ack_reminder',
        },
        status: 'pending',
      }))
      await docsApi.apiInsertWorkflowQueueRows(supabase, rows)
    },
    [supabase, orgId, userId, remoteState.pages, remoteState.receipts, remoteState.pageVersions, orgPeerProfiles],
  )

  const addSpaceUrl = useCallback(
    async (spaceId: string, title: string, url: string) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const item = await docsApi.apiInsertSpaceUrl(supabase, orgId, spaceId, title, url)
      mergeState((s) => ({ ...s, spaceItems: [item, ...s.spaceItems] }))
    },
    [supabase, orgId, userId, mergeState],
  )

  const uploadSpaceFile = useCallback(
    async (spaceId: string, file: File) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const safe = file.name.replace(/[^\w.\-åæøÅÆØ ()[\]]+/g, '_')
      const path = `${orgId}/${spaceId}/${crypto.randomUUID()}-${safe}`
      await docsApi.apiStorageUploadWikiFile(supabase, path, file)
      const item = await docsApi.apiInsertSpaceFileRow(supabase, orgId, userId, {
        space_id: spaceId,
        title: file.name,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
      })
      mergeState((s) => ({ ...s, spaceItems: [item, ...s.spaceItems] }))
    },
    [supabase, orgId, userId, mergeState],
  )

  const deleteSpaceItem = useCallback(
    async (item: WikiSpaceItem) => {
      if (!supabase || !orgId) throw new Error('Ikke tilkoblet')
      if (item.kind === 'file' && item.filePath) {
        await docsApi.apiStorageRemoveWikiFiles(supabase, [item.filePath])
      }
      await docsApi.apiDeleteSpaceItem(supabase, orgId, item.id)
      mergeState((s) => ({ ...s, spaceItems: s.spaceItems.filter((i) => i.id !== item.id) }))
    },
    [supabase, orgId, mergeState],
  )

  const getSpaceFileUrl = useCallback(
    async (item: WikiSpaceItem) => {
      if (!supabase || item.kind !== 'file' || !item.filePath) return null
      return docsApi.apiStorageSignedUrl(supabase, item.filePath, 3600)
    },
    [supabase],
  )

  const stats = useMemo(() => {
    const published = remoteState.pages.filter((p) => p.status === 'published').length
    const drafts = remoteState.pages.filter((p) => p.status === 'draft').length
    const requireAck = remoteState.pages.filter((p) => p.requiresAcknowledgement && p.status === 'published').length
    const acknowledged = remoteState.receipts.length
    return { published, drafts, requireAck, acknowledged, total: remoteState.pages.length }
  }, [remoteState.pages, remoteState.receipts])

  const templateUsageCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of remoteState.pages) {
      const tid = p.templateSourceId
      if (!tid) continue
      m.set(tid, (m.get(tid) ?? 0) + 1)
    }
    return m
  }, [remoteState.pages])

  const legalCoverageDisplay = useMemo((): LegalCoverageRow[] => {
    if (legalCoverage.length > 0) return legalCoverage
    return STATIC_LEGAL_COVERAGE.map((r) => ({
      id: `static-${r.ref}`,
      ref: r.ref,
      label: r.label,
      templateIds: r.templateIds,
    }))
  }, [legalCoverage])

  const setCoverageItemOwner = useCallback(
    async (coverageItemId: string, ownerId: string | null) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const row = {
        organization_id: orgId,
        coverage_item_id: coverageItemId,
        owner_id: ownerId,
        updated_at: new Date().toISOString(),
      }
      await docsApi.apiUpsertCoverageAssignment(supabase, row)
      setCoverageOwnerByItemId((prev) => ({ ...prev, [coverageItemId]: ownerId }))
    },
    [supabase, orgId, userId],
  )

  const versionsForPage = useCallback(
    (pageId: string) => remoteState.pageVersions.filter((v) => v.pageId === pageId).sort((a, b) => b.version - a.version),
    [remoteState.pageVersions],
  )

  const myRecentWikiEdits = useMemo(() => {
    if (!userId) return []
    const seen = new Set<string>()
    const out: { pageId: string; pageTitle: string; at: string; action: AuditLedgerEntry['action'] }[] = []
    for (const e of remoteState.auditLedger) {
      if (e.userId !== userId) continue
      if (e.action !== 'updated' && e.action !== 'published' && e.action !== 'created') continue
      if (seen.has(e.pageId)) continue
      seen.add(e.pageId)
      out.push({ pageId: e.pageId, pageTitle: e.pageTitle, at: e.at, action: e.action })
      if (out.length >= 5) break
    }
    return out
  }, [remoteState.auditLedger, userId])

  const myAcknowledgementBuckets = useMemo(() => {
    if (!userId) return { needsSignature: [] as WikiPage[], outdated: [] as WikiPage[] }
    const ctx = {
      isOrgAdmin,
      departmentId: profile?.department_id,
      learningMetadata: profile?.learning_metadata as Record<string, unknown> | null | undefined,
    }
    const needsSignature: WikiPage[] = []
    const outdated: WikiPage[] = []
    for (const p of remoteState.pages) {
      if (p.status !== 'published' || !p.requiresAcknowledgement) continue
      if (!userMustAcknowledgePage(p, ctx)) continue
      const maxRv = maxReceiptVersionForUser(p.id, userId, remoteState.receipts)
      const ok = hasAcknowledgedCurrentVersion(p, userId, remoteState.receipts, remoteState.pageVersions)
      if (ok) continue
      if (maxRv == null) needsSignature.push(p)
      else outdated.push(p)
    }
    return { needsSignature, outdated }
  }, [userId, remoteState.pages, remoteState.receipts, remoteState.pageVersions, isOrgAdmin, profile?.department_id, profile?.learning_metadata])

  const pageHydrateLoading = pageHydrate.loading
  const pageHydrateError = pageHydrate.error

  const value = useMemo(
    () => ({
      ready,
      loading,
      error,
      pageHydrateLoading,
      pageHydrateError,
      ensurePageLoaded,
      spaces: remoteState.spaces,
      pages: remoteState.pages,
      auditLedger: remoteState.auditLedger,
      receipts: remoteState.receipts,
      spaceItems: remoteState.spaceItems,
      pageVersions: remoteState.pageVersions,
      versionsForPage,
      addSpaceUrl,
      uploadSpaceFile,
      deleteSpaceItem,
      getSpaceFileUrl,
      legalCoverage: legalCoverageDisplay,
      complianceSummary,
      coverageOwnerByItemId,
      orgPeerProfiles,
      setCoverageItemOwner,
      pageTemplates,
      systemTemplatesCatalog: systemTemplates,
      orgTemplateSettings,
      orgCustomTemplates,
      refreshDocuments,
      setSystemTemplateEnabled,
      saveSystemTemplateCustomBlocks,
      saveOrgCustomTemplate,
      deleteOrgCustomTemplate,
      templateUsageCounts,
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
      acknowledgementRequiredForMe,
      queueAckReminderNotifications,
      myAcknowledgementBuckets,
      searchWikiPages,
      reorderPagesInSpace,
      movePageToSpace,
      myRecentWikiEdits,
    }),
    [
      ready,
      loading,
      error,
      pageHydrateLoading,
      pageHydrateError,
      ensurePageLoaded,
      remoteState,
      versionsForPage,
      searchWikiPages,
      reorderPagesInSpace,
      movePageToSpace,
      myRecentWikiEdits,
      addSpaceUrl,
      uploadSpaceFile,
      deleteSpaceItem,
      getSpaceFileUrl,
      legalCoverageDisplay,
      complianceSummary,
      coverageOwnerByItemId,
      orgPeerProfiles,
      setCoverageItemOwner,
      pageTemplates,
      systemTemplates,
      orgTemplateSettings,
      orgCustomTemplates,
      refreshDocuments,
      setSystemTemplateEnabled,
      saveSystemTemplateCustomBlocks,
      saveOrgCustomTemplate,
      deleteOrgCustomTemplate,
      templateUsageCounts,
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
      acknowledgementRequiredForMe,
      queueAckReminderNotifications,
      myAcknowledgementBuckets,
    ],
  )

  return value
}

export type DocumentsContextValue = ReturnType<typeof useDocumentsStore>

const DocumentsContext = createContext<DocumentsContextValue | null>(null)

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const value = useDocumentsStore()
  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>
}

export function DocumentsLayout() {
  return (
    <DocumentsProvider>
      <Outlet />
    </DocumentsProvider>
  )
}

function useDocumentsContext(): DocumentsContextValue {
  const ctx = useContext(DocumentsContext)
  if (!ctx) {
    throw new Error('Documents hooks must be used within DocumentsProvider')
  }
  return ctx
}

/** Full documents API (legacy / convenience). */
export function useDocuments(): DocumentsContextValue {
  return useDocumentsContext()
}

export function useWikiSpaces() {
  const v = useDocumentsContext()
  return useMemo(
    () => ({
      ready: v.ready,
      loading: v.loading,
      error: v.error,
      spaces: v.spaces,
      spaceItems: v.spaceItems,
      createSpace: v.createSpace,
      updateSpace: v.updateSpace,
      createPage: v.createPage,
      publishPage: v.publishPage,
      addSpaceUrl: v.addSpaceUrl,
      uploadSpaceFile: v.uploadSpaceFile,
      deleteSpaceItem: v.deleteSpaceItem,
      getSpaceFileUrl: v.getSpaceFileUrl,
      refreshDocuments: v.refreshDocuments,
      searchWikiPages: v.searchWikiPages,
      myRecentWikiEdits: v.myRecentWikiEdits,
    }),
    [v],
  )
}

export function useWikiPages(spaceId: string | undefined) {
  const v = useDocumentsContext()
  const pages = useMemo(
    () => (spaceId ? v.pages.filter((p) => p.spaceId === spaceId) : []),
    [v.pages, spaceId],
  )
  const spaceItems = useMemo(
    () => (spaceId ? v.spaceItems.filter((i) => i.spaceId === spaceId) : []),
    [v.spaceItems, spaceId],
  )
  const createPageInSpace = useCallback(
    (
      title: string,
      template?: WikiPage['template'],
      blocks?: Block[],
      opts?: Parameters<typeof v.createPage>[4],
    ) => {
      if (!spaceId) throw new Error('Mangler spaceId')
      return v.createPage(spaceId, title, template, blocks, opts)
    },
    [v, spaceId],
  )
  return useMemo(
    () => ({
      ready: v.ready,
      loading: v.loading,
      error: v.error,
      pages,
      spaceItems,
      createPage: createPageInSpace,
      deletePage: v.deletePage,
      publishPage: v.publishPage,
      archivePage: v.archivePage,
      refreshDocuments: v.refreshDocuments,
      updatePage: v.updatePage,
      reorderPagesInSpace: v.reorderPagesInSpace,
      movePageToSpace: v.movePageToSpace,
    }),
    [v, pages, spaceItems, createPageInSpace],
  )
}

export function useWikiPage(pageId: string | undefined) {
  const v = useDocumentsContext()
  const page = useMemo(() => (pageId ? v.pages.find((p) => p.id === pageId) : undefined), [v.pages, pageId])
  const versions = useMemo(() => (pageId ? v.versionsForPage(pageId) : []), [v, pageId])
  return useMemo(
    () => ({
      ready: v.ready,
      loading: v.loading,
      error: v.error,
      pageHydrateLoading: v.pageHydrateLoading,
      pageHydrateError: v.pageHydrateError,
      ensurePageLoaded: v.ensurePageLoaded,
      page,
      pages: v.pages,
      versions,
      receipts: v.receipts,
      pageVersions: v.pageVersions,
      updatePage: v.updatePage,
      publishPage: v.publishPage,
      archivePage: v.archivePage,
      deletePage: v.deletePage,
      acknowledge: v.acknowledge,
      hasAcknowledged: v.hasAcknowledged,
      acknowledgementRequiredForMe: v.acknowledgementRequiredForMe,
      refreshDocuments: v.refreshDocuments,
    }),
    [v, page, versions],
  )
}

export function useDocumentTemplates() {
  const v = useDocumentsContext()
  return useMemo(
    () => ({
      ready: v.ready,
      loading: v.loading,
      error: v.error,
      pageTemplates: v.pageTemplates,
      systemTemplatesCatalog: v.systemTemplatesCatalog,
      orgTemplateSettings: v.orgTemplateSettings,
      orgCustomTemplates: v.orgCustomTemplates,
      setSystemTemplateEnabled: v.setSystemTemplateEnabled,
      saveSystemTemplateCustomBlocks: v.saveSystemTemplateCustomBlocks,
      saveOrgCustomTemplate: v.saveOrgCustomTemplate,
      deleteOrgCustomTemplate: v.deleteOrgCustomTemplate,
      refreshDocuments: v.refreshDocuments,
      templateUsageCounts: v.templateUsageCounts,
    }),
    [v],
  )
}

export function useComplianceDocs() {
  const v = useDocumentsContext()
  return useMemo(
    () => ({
      ready: v.ready,
      loading: v.loading,
      error: v.error,
      legalCoverage: v.legalCoverage,
      complianceSummary: v.complianceSummary,
      coverageOwnerByItemId: v.coverageOwnerByItemId,
      orgPeerProfiles: v.orgPeerProfiles,
      setCoverageItemOwner: v.setCoverageItemOwner,
      pages: v.pages,
      pageTemplates: v.pageTemplates,
      receipts: v.receipts,
      pageVersions: v.pageVersions,
      stats: v.stats,
      refreshDocuments: v.refreshDocuments,
      queueAckReminderNotifications: v.queueAckReminderNotifications,
    }),
    [v],
  )
}
