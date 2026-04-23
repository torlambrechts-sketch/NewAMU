/* eslint-disable react-refresh/only-export-components -- provider + hook + store in one module */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AcknowledgementAudience,
  AuditLedgerEntry,
  ComplianceReceipt,
  ContentBlock,
  PageTemplate,
  SpaceCategory,
  WikiPage,
  WikiPageLang,
  WikiPageVersionSnapshot,
  WikiRetentionCategoryRow,
  WikiSpace,
  WikiSpaceItem,
} from '../types/documents'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import {
  LEGAL_COVERAGE as STATIC_LEGAL_COVERAGE,
  PAGE_TEMPLATES as STATIC_PAGE_TEMPLATES,
} from '../data/documentTemplates'
import { WIKI_RETENTION_CATEGORIES_STATIC } from '../data/wikiRetentionCategories'
import * as wikiAnnualApi from '../api/wikiAnnualReview'

const STORAGE_KEY = 'atics-documents-v2'
const LOCAL_ORG_TEMPLATES_KEY = 'atics-document-org-templates-v1'

/** @deprecated Local demo only */
export const DEMO_USER_ID = 'user-demo'
/** @deprecated Local demo only */
export const DEMO_USER_NAME = 'Demo User'

type DocumentsState = {
  spaces: WikiSpace[]
  pages: WikiPage[]
  auditLedger: AuditLedgerEntry[]
  receipts: ComplianceReceipt[]
  spaceItems: WikiSpaceItem[]
  pageVersions: WikiPageVersionSnapshot[]
}

type LegalCoverageRow = { ref: string; label: string; templateIds: string[]; maxRevisionMonths: number | null }

type OrgTemplateSetting = { templateId: string; enabled: boolean }

export type OrgCustomTemplate = {
  id: string
  label: string
  description: string
  category: SpaceCategory
  legalBasis: string[]
  pagePayload: Omit<WikiPage, 'id' | 'spaceId' | 'createdAt' | 'updatedAt' | 'authorId' | 'version'>
}

function loadLocalOrgTemplates(): OrgCustomTemplate[] {
  try {
    const raw = localStorage.getItem(LOCAL_ORG_TEMPLATES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OrgCustomTemplate[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocalOrgTemplates(templates: OrgCustomTemplate[]) {
  try {
    localStorage.setItem(LOCAL_ORG_TEMPLATES_KEY, JSON.stringify(templates))
  } catch {
    /* ignore */
  }
}

function emptyLocalState(): DocumentsState {
  return { spaces: [], pages: [], auditLedger: [], receipts: [], spaceItems: [], pageVersions: [] }
}

function loadLocal(): DocumentsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as DocumentsState
      return {
        spaces: Array.isArray(p.spaces) ? p.spaces : [],
        pages: Array.isArray(p.pages) ? p.pages : [],
        auditLedger: Array.isArray(p.auditLedger) ? p.auditLedger : [],
        receipts: Array.isArray(p.receipts) ? p.receipts : [],
        spaceItems: Array.isArray((p as DocumentsState).spaceItems) ? (p as DocumentsState).spaceItems : [],
        pageVersions: Array.isArray((p as DocumentsState).pageVersions) ? (p as DocumentsState).pageVersions : [],
      }
    }
  } catch {
    /* ignore */
  }
  return emptyLocalState()
}

function saveLocal(state: DocumentsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
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

function mapSpace(row: {
  id: string
  title: string
  description: string
  category: string
  icon: string
  status: string
  created_at: string
  updated_at: string
  is_amu_space?: boolean | null
}): WikiSpace {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    category: row.category as WikiSpace['category'],
    icon: row.icon ?? '📁',
    status: row.status as WikiSpace['status'],
    isAmuSpace: row.is_amu_space ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPage(
  row: {
    id: string
    space_id: string
    title: string
    summary: string | null
    status: string
    template: string
    legal_refs: string[] | null
    lang?: string | null
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
    contains_pii?: boolean | null
    pii_categories?: string[] | null
    pii_legal_basis?: string | null
    pii_retention_note?: string | null
    retention_category?: string | null
    retain_minimum_years?: number | null
    retain_maximum_years?: number | null
    archived_at?: string | null
    scheduled_deletion_at?: string | null
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
    lang:
      row.lang === 'nn' || row.lang === 'en'
        ? (row.lang as WikiPageLang)
        : row.lang === 'nb'
          ? 'nb'
          : undefined,
    requiresAcknowledgement: row.requires_acknowledgement,
    acknowledgementAudience: aud,
    acknowledgementDepartmentId: row.acknowledgement_department_id ?? null,
    nextRevisionDueAt: row.next_revision_due_at ?? null,
    revisionIntervalMonths: row.revision_interval_months ?? 12,
    containsPii: row.contains_pii ?? false,
    piiCategories: Array.isArray(row.pii_categories) ? row.pii_categories : [],
    piiLegalBasis: row.pii_legal_basis ?? null,
    piiRetentionNote: row.pii_retention_note ?? null,
    retentionCategory: row.retention_category ?? null,
    retainMinimumYears: row.retain_minimum_years ?? null,
    retainMaximumYears: row.retain_maximum_years ?? null,
    archivedAt: row.archived_at ?? null,
    scheduledDeletionAt: row.scheduled_deletion_at ?? null,
    blocks: (Array.isArray(row.blocks) ? row.blocks : []) as ContentBlock[],
    version: row.version,
    authorId: row.author_id ?? authorFallback,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSpaceItem(row: {
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

function mapPageVersion(row: {
  id: string
  page_id: string
  version: number
  title: string
  summary: string | null
  status: string
  template: string
  legal_refs: string[] | null
  lang?: string | null
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
    lang:
      row.lang === 'nn' || row.lang === 'en'
        ? (row.lang as WikiPageLang)
        : row.lang === 'nb'
          ? 'nb'
          : undefined,
    requiresAcknowledgement: row.requires_acknowledgement,
    acknowledgementAudience: (row.acknowledgement_audience ?? 'all_employees') as AcknowledgementAudience,
    acknowledgementDepartmentId: row.acknowledgement_department_id ?? null,
    blocks: (Array.isArray(row.blocks) ? row.blocks : []) as ContentBlock[],
    nextRevisionDueAt: row.next_revision_due_at ?? null,
    revisionIntervalMonths: row.revision_interval_months ?? 12,
    frozenAt: row.frozen_at,
  }
}

function mapLedger(
  row: {
    id: string
    page_id: string
    page_title: string
    action: string
    user_id: string
    from_version: number | null
    to_version: number
    at: string
  },
): AuditLedgerEntry {
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

function mapWikiRetentionCategory(row: {
  slug: string
  label: string
  min_years: number
  max_years: number | null
  legal_refs: string[] | null
  description: string | null
}): WikiRetentionCategoryRow {
  return {
    slug: row.slug,
    label: row.label,
    minYears: row.min_years,
    maxYears: row.max_years,
    legalRefs: row.legal_refs ?? [],
    description: row.description,
  }
}

function mapReceipt(row: {
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

async function fetchAllForOrg(
  supabase: SupabaseClient,
  orgId: string,
  authorFallback: string,
): Promise<DocumentsState> {
  const [spacesRes, pagesRes, ledgerRes, receiptsRes, itemsRes, verRes] = await Promise.all([
    supabase.from('wiki_spaces').select('*').eq('organization_id', orgId).order('created_at'),
    supabase.from('wiki_pages').select('*').eq('organization_id', orgId),
    supabase.from('wiki_audit_ledger').select('*').eq('organization_id', orgId).order('at', { ascending: false }).limit(500),
    supabase.from('wiki_compliance_receipts').select('*').eq('organization_id', orgId),
    supabase.from('wiki_space_items').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
    supabase.from('wiki_page_versions').select('*').eq('organization_id', orgId).order('frozen_at', { ascending: false }),
  ])
  if (spacesRes.error) throw spacesRes.error
  if (pagesRes.error) throw pagesRes.error
  if (ledgerRes.error) throw ledgerRes.error
  if (receiptsRes.error) throw receiptsRes.error
  if (itemsRes.error) throw itemsRes.error
  if (verRes.error) throw verRes.error

  return {
    spaces: (spacesRes.data ?? []).map(mapSpace),
    pages: (pagesRes.data ?? []).map((r) => mapPage(r as Parameters<typeof mapPage>[0], authorFallback)),
    auditLedger: (ledgerRes.data ?? []).map(mapLedger),
    receipts: (receiptsRes.data ?? []).map(mapReceipt),
    spaceItems: (itemsRes.data ?? []).map((r) => mapSpaceItem(r as Parameters<typeof mapSpaceItem>[0])),
    pageVersions: (verRes.data ?? []).map((r) => mapPageVersion(r as Parameters<typeof mapPageVersion>[0])),
  }
}

function userMustAcknowledgePage(
  page: WikiPage,
  ctx: {
    isOrgAdmin: boolean
    departmentId: string | null | undefined
    learningMetadata: Record<string, unknown> | null | undefined
  },
): boolean {
  if (!page.requiresAcknowledgement) return false
  const aud: AcknowledgementAudience = page.acknowledgementAudience ?? 'all_employees'
  if (aud === 'all_employees') return true
  if (aud === 'leaders_only') return ctx.isOrgAdmin === true
  if (aud === 'safety_reps_only') {
    return ctx.learningMetadata?.is_safety_rep === true
  }
  if (aud === 'department') {
    if (!page.acknowledgementDepartmentId) return true
    return ctx.departmentId === page.acknowledgementDepartmentId
  }
  return true
}

function useDocumentsStore() {
  const { supabase, organization, user, profile, isAdmin: isOrgAdminFromPerms } = useOrgSetupContext()
  const orgId = organization?.id
  const userId = user?.id
  const authorFallback = userId ?? DEMO_USER_ID

  const useRemote = !!(supabase && orgId && userId)
  const initialSnap = useRemote && orgId && userId ? readSnap(orgId, userId) : null

  const [localState, setLocalState] = useState<DocumentsState>(() => loadLocal())
  const [remoteState, setRemoteState] = useState<DocumentsState>(
    () => initialSnap ?? emptyLocalState(),
  )
  const [legalCoverage, setLegalCoverage] = useState<LegalCoverageRow[]>([])
  const [systemTemplates, setSystemTemplates] = useState<
    { id: string; label: string; description: string; category: SpaceCategory; legalBasis: string[]; pagePayload: PageTemplate['page'] }[]
  >([])
  const [orgTemplateSettings, setOrgTemplateSettings] = useState<OrgTemplateSetting[]>([])
  const [orgCustomTemplates, setOrgCustomTemplates] = useState<OrgCustomTemplate[]>([])
  const [localOrgCustomTemplates, setLocalOrgCustomTemplates] = useState<OrgCustomTemplate[]>(() =>
    useRemote ? [] : loadLocalOrgTemplates(),
  )
  const [retentionCategories, setRetentionCategories] = useState<WikiRetentionCategoryRow[]>([])
  const [loading, setLoading] = useState(useRemote)
  const [error, setError] = useState<string | null>(null)
  /** Deep-link / stale cache: fetch one page by id when missing from state */
  const [pageHydrate, setPageHydrate] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  })

  const state = useRemote ? remoteState : localState

  const isOrgAdmin = profile?.is_org_admin === true || isOrgAdminFromPerms

  const ensurePageLoaded = useCallback(
    async (pageId: string | undefined) => {
      if (!pageId) return
      if (!useRemote || !supabase || !orgId || !userId) return
      setPageHydrate({ loading: true, error: null })
      try {
        const { data, error: qe } = await supabase
          .from('wiki_pages')
          .select('*')
          .eq('id', pageId)
          .eq('organization_id', orgId)
          .maybeSingle()
        if (qe) throw qe
        if (!data) {
          setPageHydrate({ loading: false, error: null })
          return
        }
        const mapped = mapPage(data as Parameters<typeof mapPage>[0], authorFallback)
        setRemoteState((s) => {
          if (s.pages.some((p) => p.id === mapped.id)) return s
          const next = { ...s, pages: [...s.pages, mapped] }
          writeSnap(orgId, userId, next)
          return next
        })
        setPageHydrate({ loading: false, error: null })
      } catch (e) {
        setPageHydrate({ loading: false, error: getSupabaseErrorMessage(e) })
      }
    },
    [useRemote, supabase, orgId, userId, authorFallback],
  )

  const refreshDocuments = useCallback(async () => {
    if (!supabase || !orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      await supabase.rpc('wiki_ensure_org_defaults')
      const [
        covRes,
        tplRes,
        setRes,
        customRes,
        retRes,
        data,
      ] = await Promise.all([
        supabase.from('wiki_legal_coverage_items').select('ref, label, template_ids, max_revision_months').order('ref'),
        supabase
          .from('document_system_templates')
          .select('id, label, description, category, legal_basis, page_payload, sort_order')
          .order('sort_order', { ascending: true }),
        supabase.from('document_org_template_settings').select('template_id, enabled').eq('organization_id', orgId),
        supabase.from('document_org_templates').select('*').eq('organization_id', orgId).order('created_at'),
        supabase
          .from('wiki_retention_categories')
          .select('slug, label, min_years, max_years, legal_refs, description')
          .order('slug'),
        fetchAllForOrg(supabase, orgId, authorFallback),
      ])
      if (covRes.error) throw covRes.error
      if (tplRes.error) throw tplRes.error
      if (setRes.error) throw setRes.error
      if (customRes.error) throw customRes.error
      if (retRes.error) {
        console.warn('wiki_retention_categories:', retRes.error.message)
        setRetentionCategories(WIKI_RETENTION_CATEGORIES_STATIC)
      } else {
        setRetentionCategories((retRes.data ?? []).map((r) => mapWikiRetentionCategory(r as Parameters<typeof mapWikiRetentionCategory>[0])))
      }

      setLegalCoverage(
        (covRes.data ?? []).map((r) => ({
          ref: r.ref,
          label: r.label,
          templateIds: (r.template_ids as string[]) ?? [],
          maxRevisionMonths:
            r.max_revision_months !== undefined && r.max_revision_months !== null
              ? Number(r.max_revision_months)
              : null,
        })),
      )
      setSystemTemplates(
        (tplRes.data ?? []).map((r) => ({
          id: r.id,
          label: r.label,
          description: r.description ?? '',
          category: r.category as SpaceCategory,
          legalBasis: (r.legal_basis as string[]) ?? [],
          pagePayload: r.page_payload as PageTemplate['page'],
        })),
      )
      setOrgTemplateSettings(
        (setRes.data ?? []).map((r) => ({ templateId: r.template_id, enabled: r.enabled })),
      )
      setOrgCustomTemplates(
        (customRes.data ?? []).map((r) => ({
          id: r.id,
          label: r.label,
          description: r.description ?? '',
          category: r.category as SpaceCategory,
          legalBasis: (r.legal_basis as string[]) ?? [],
          pagePayload: r.page_payload as OrgCustomTemplate['pagePayload'],
        })),
      )
      setRemoteState(data)
      writeSnap(orgId, userId, data)
    } catch (e) {
      // Transient network / CORS failures must not wipe the in-memory org snapshot — that breaks
      // the editor after a successful write when a follow-up refetch fails (e.g. "Failed to fetch").
      setError(getSupabaseErrorMessage(e))
      setRetentionCategories((prev) => (prev.length > 0 ? prev : WIKI_RETENTION_CATEGORIES_STATIC))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, userId, authorFallback])

  useEffect(() => {
    if (!useRemote) {
      setLoading(false)
      return
    }
    void refreshDocuments()
  }, [useRemote, refreshDocuments])

  useEffect(() => {
    if (!useRemote) {
      saveLocal(localState)
    }
  }, [useRemote, localState])

  useEffect(() => {
    if (useRemote) return
    setLocalOrgCustomTemplates(loadLocalOrgTemplates())
  }, [useRemote])

  const wikiRetentionCategories = useMemo(
    () => (retentionCategories.length > 0 ? retentionCategories : WIKI_RETENTION_CATEGORIES_STATIC),
    [retentionCategories],
  )

  const pageTemplates: PageTemplate[] = useMemo(() => {
    if (!useRemote) return STATIC_PAGE_TEMPLATES
    const enabled = (tid: string) => {
      const row = orgTemplateSettings.find((s) => s.templateId === tid)
      return row ? row.enabled : true
    }
    const system: PageTemplate[] = systemTemplates
      .filter((t) => enabled(t.id))
      .map((t) => ({
        id: t.id,
        label: t.label,
        description: t.description,
        legalBasis: t.legalBasis,
        category: t.category,
        page: t.pagePayload,
      }))
    const orgCustomSource = useRemote ? orgCustomTemplates : localOrgCustomTemplates
    const custom: PageTemplate[] = orgCustomSource.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      legalBasis: t.legalBasis,
      category: t.category,
      page: t.pagePayload,
    }))
    return [...system, ...custom]
  }, [useRemote, systemTemplates, orgTemplateSettings, orgCustomTemplates, localOrgCustomTemplates])

  const setSystemTemplateEnabled = useCallback(
    async (templateId: string, enabled: boolean) => {
      if (!supabase || !orgId) return
      const { error: e } = await supabase.from('document_org_template_settings').upsert(
        { organization_id: orgId, template_id: templateId, enabled },
        { onConflict: 'organization_id,template_id' },
      )
      if (e) throw e
      setOrgTemplateSettings((prev) => {
        const next = prev.filter((x) => x.templateId !== templateId)
        next.push({ templateId, enabled })
        return next
      })
    },
    [supabase, orgId],
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
      const id = input.id ?? crypto.randomUUID()
      if (!useRemote) {
        const row: OrgCustomTemplate = {
          id,
          label: input.label.trim(),
          description: input.description.trim(),
          category: input.category,
          legalBasis: input.legalBasis,
          pagePayload: input.page,
        }
        setLocalOrgCustomTemplates((prev) => {
          const next = prev.filter((x) => x.id !== id)
          next.push(row)
          saveLocalOrgTemplates(next)
          return next
        })
        return id
      }
      if (!supabase || !orgId || !userId) return
      const row = {
        id,
        organization_id: orgId,
        label: input.label.trim(),
        description: input.description.trim(),
        category: input.category,
        legal_basis: input.legalBasis,
        page_payload: input.page,
      }
      const { error: e } = await supabase.from('document_org_templates').upsert(row, { onConflict: 'id' })
      if (e) throw e
      await refreshDocuments()
      return id
    },
    [useRemote, supabase, orgId, userId, refreshDocuments],
  )

  const deleteOrgCustomTemplate = useCallback(
    async (id: string) => {
      if (!useRemote) {
        setLocalOrgCustomTemplates((prev) => {
          const next = prev.filter((x) => x.id !== id)
          saveLocalOrgTemplates(next)
          return next
        })
        return
      }
      if (!supabase || !orgId) return
      const { error: e } = await supabase.from('document_org_templates').delete().eq('id', id).eq('organization_id', orgId)
      if (e) throw e
      await refreshDocuments()
    },
    [useRemote, supabase, orgId, refreshDocuments],
  )

  const ledgerEntryLocal = useCallback(
    (page: WikiPage, action: AuditLedgerEntry['action'], fromVersion?: number): AuditLedgerEntry => ({
      id: crypto.randomUUID(),
      pageId: page.id,
      pageTitle: page.title,
      action,
      userId: authorFallback,
      fromVersion,
      toVersion: page.version,
      at: new Date().toISOString(),
    }),
    [authorFallback],
  )

  const createSpace = useCallback(
    async (title: string, description: string, category: WikiSpace['category'], icon: string) => {
      const now = new Date().toISOString()
      if (useRemote && supabase && orgId && userId) {
        const id = crypto.randomUUID()
        const row = {
          id,
          organization_id: orgId,
          title: title.trim(),
          description: description.trim(),
          category,
          icon,
          status: 'active' as const,
        }
        const { data, error: e } = await supabase.from('wiki_spaces').insert(row).select('*').single()
        if (e) throw e
        const space = mapSpace(data as Parameters<typeof mapSpace>[0])
        setRemoteState((s) => {
          const next = { ...s, spaces: [...s.spaces, space] }
          writeSnap(orgId, userId, next)
          return next
        })
        return space
      }
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
      setLocalState((s) => ({ ...s, spaces: [...s.spaces, space] }))
      return space
    },
    [useRemote, supabase, orgId, userId],
  )

  const updateSpace = useCallback(
    async (id: string, patch: Partial<WikiSpace>) => {
      if (useRemote && supabase && orgId && userId) {
        const dbPatch: Record<string, unknown> = {}
        if (patch.title !== undefined) dbPatch.title = patch.title
        if (patch.description !== undefined) dbPatch.description = patch.description
        if (patch.category !== undefined) dbPatch.category = patch.category
        if (patch.icon !== undefined) dbPatch.icon = patch.icon
        if (patch.status !== undefined) dbPatch.status = patch.status
        const { error: e } = await supabase.from('wiki_spaces').update(dbPatch).eq('id', id).eq('organization_id', orgId)
        if (e) throw e
        await refreshDocuments()
        return
      }
      setLocalState((s) => ({
        ...s,
        spaces: s.spaces.map((sp) =>
          sp.id === id ? { ...sp, ...patch, updatedAt: new Date().toISOString() } : sp,
        ),
      }))
    },
    [useRemote, supabase, orgId, userId, refreshDocuments],
  )

  const insertLedgerRemote = useCallback(
    async (page: WikiPage, action: AuditLedgerEntry['action'], fromVersion?: number) => {
      if (!supabase || !orgId || !userId) return
      const { error: e } = await supabase.from('wiki_audit_ledger').insert({
        organization_id: orgId,
        page_id: page.id,
        page_title: page.title,
        action,
        user_id: userId,
        from_version: fromVersion ?? null,
        to_version: page.version,
      })
      if (e) throw e
    },
    [supabase, orgId, userId],
  )

  const createPage = useCallback(
    async (
      spaceId: string,
      title: string,
      template: WikiPage['template'] = 'standard',
      blocks: ContentBlock[] = [],
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
        >
      > & { templateId?: string },
    ) => {
      const now = new Date().toISOString()
      if (useRemote && supabase && orgId && userId) {
        const id = crypto.randomUUID()
        const pageRow: Record<string, unknown> = {
          id,
          organization_id: orgId,
          space_id: spaceId,
          title: title.trim(),
          summary: opts?.summary ?? '',
          status: 'draft' as const,
          template,
          legal_refs: opts?.legalRefs ?? [],
          lang: 'nb' as const,
          requires_acknowledgement: opts?.requiresAcknowledgement ?? false,
          acknowledgement_audience: opts?.acknowledgementAudience ?? 'all_employees',
          acknowledgement_department_id: opts?.acknowledgementDepartmentId ?? null,
          revision_interval_months: opts?.revisionIntervalMonths ?? 12,
          blocks: blocks as unknown as Record<string, unknown>[],
          version: 1,
          author_id: userId,
        }
        if (opts?.templateId === 'tpl-personvern-ansatt') {
          pageRow.contains_pii = true
          pageRow.pii_categories = ['navn', 'lonn']
          pageRow.pii_legal_basis = '[FYLL INN: f.eks. GDPR art. 6 nr. 1 bokstav b — kontraktsforhold]'
          pageRow.pii_retention_note = '[FYLL INN: f.eks. slettes 5 år etter avsluttet arbeidsforhold der ikke annet følger av lov]'
        } else if (opts?.templateId === 'tpl-behandlingsprotokoll') {
          pageRow.contains_pii = true
          pageRow.pii_categories = ['navn', 'lonn']
          pageRow.pii_legal_basis = 'GDPR art. 30 — dokumentasjonsplikt for behandlingsansvarlig'
          pageRow.pii_retention_note = '[FYLL INN: oppbevaring per aktivitet, jf. behandlingsprotokollen]'
        }
        const { data, error: pe } = await supabase.from('wiki_pages').insert(pageRow).select('*').single()
        if (pe) throw pe
        const page = mapPage(data as Parameters<typeof mapPage>[0], authorFallback)
        await insertLedgerRemote(page, 'created')
        setRemoteState((s) => {
          if (s.pages.some((p) => p.id === page.id)) return s
          const next = { ...s, pages: [...s.pages, page] }
          if (orgId && userId) writeSnap(orgId, userId, next)
          return next
        })
        void refreshDocuments().catch((err) => {
          setError(getSupabaseErrorMessage(err))
        })
        return page
      }
      const page: WikiPage = {
        id: crypto.randomUUID(),
        spaceId,
        title: title.trim(),
        summary: opts?.summary ?? '',
        status: 'draft',
        template,
        legalRefs: opts?.legalRefs ?? [],
        lang: 'nb',
        requiresAcknowledgement: opts?.requiresAcknowledgement ?? false,
        acknowledgementAudience: opts?.acknowledgementAudience ?? 'all_employees',
        acknowledgementDepartmentId: opts?.acknowledgementDepartmentId ?? null,
        revisionIntervalMonths: opts?.revisionIntervalMonths ?? 12,
        nextRevisionDueAt: opts?.nextRevisionDueAt ?? null,
        containsPii:
          opts?.templateId === 'tpl-personvern-ansatt' || opts?.templateId === 'tpl-behandlingsprotokoll',
        piiCategories:
          opts?.templateId === 'tpl-personvern-ansatt' || opts?.templateId === 'tpl-behandlingsprotokoll'
            ? ['navn', 'lonn']
            : [],
        piiLegalBasis:
          opts?.templateId === 'tpl-personvern-ansatt'
            ? '[FYLL INN: f.eks. GDPR art. 6 nr. 1 bokstav b — kontraktsforhold]'
            : opts?.templateId === 'tpl-behandlingsprotokoll'
              ? 'GDPR art. 30 — dokumentasjonsplikt for behandlingsansvarlig'
              : null,
        piiRetentionNote:
          opts?.templateId === 'tpl-personvern-ansatt'
            ? '[FYLL INN: f.eks. slettes 5 år etter avsluttet arbeidsforhold der ikke annet følger av lov]'
            : opts?.templateId === 'tpl-behandlingsprotokoll'
              ? '[FYLL INN: oppbevaring per aktivitet, jf. behandlingsprotokollen]'
              : null,
        blocks,
        version: 1,
        createdAt: now,
        updatedAt: now,
        authorId: authorFallback,
      }
      const entry = ledgerEntryLocal(page, 'created')
      setLocalState((s) => ({
        ...s,
        pages: [...s.pages, page],
        auditLedger: [entry, ...s.auditLedger],
      }))
      return page
    },
    [useRemote, supabase, orgId, userId, authorFallback, insertLedgerRemote, refreshDocuments, ledgerEntryLocal],
  )

  const updatePage = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          WikiPage,
          | 'spaceId'
          | 'title'
          | 'summary'
          | 'blocks'
          | 'legalRefs'
          | 'lang'
          | 'requiresAcknowledgement'
          | 'template'
          | 'acknowledgementAudience'
          | 'acknowledgementDepartmentId'
          | 'revisionIntervalMonths'
          | 'nextRevisionDueAt'
          | 'containsPii'
          | 'piiCategories'
          | 'piiLegalBasis'
          | 'piiRetentionNote'
          | 'retentionCategory'
          | 'retainMinimumYears'
          | 'retainMaximumYears'
          | 'archivedAt'
        >
      >,
    ) => {
      if (useRemote && supabase && orgId && userId) {
        const old = remoteState.pages.find((p) => p.id === id)
        if (!old) {
          throw new Error(
            'Fant ikke dokumentet i denne økten. Gå tilbake til dokumentlisten og åpne siden på nytt, eller oppdater nettleseren.',
          )
        }
        const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (patch.spaceId !== undefined) dbPatch.space_id = patch.spaceId
        if (patch.title !== undefined) dbPatch.title = patch.title
        if (patch.summary !== undefined) dbPatch.summary = patch.summary
        if (patch.blocks !== undefined) dbPatch.blocks = patch.blocks
        if (patch.legalRefs !== undefined) dbPatch.legal_refs = patch.legalRefs
        if (patch.lang !== undefined) dbPatch.lang = patch.lang
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
        if (patch.containsPii !== undefined) dbPatch.contains_pii = patch.containsPii
        if (patch.piiCategories !== undefined) dbPatch.pii_categories = patch.piiCategories
        if (patch.piiLegalBasis !== undefined) dbPatch.pii_legal_basis = patch.piiLegalBasis
        if (patch.piiRetentionNote !== undefined) dbPatch.pii_retention_note = patch.piiRetentionNote
        if (patch.retentionCategory !== undefined) dbPatch.retention_category = patch.retentionCategory
        if (patch.retainMinimumYears !== undefined) dbPatch.retain_minimum_years = patch.retainMinimumYears
        if (patch.retainMaximumYears !== undefined) dbPatch.retain_maximum_years = patch.retainMaximumYears
        if (patch.archivedAt !== undefined) dbPatch.archived_at = patch.archivedAt
        const { data: row, error: e } = await supabase
          .from('wiki_pages')
          .update(dbPatch)
          .eq('id', id)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (e) throw new Error(getSupabaseErrorMessage(e))
        const updated = mapPage(row as Parameters<typeof mapPage>[0], authorFallback)
        setRemoteState((s) => {
          const next = { ...s, pages: s.pages.map((p) => (p.id === id ? updated : p)) }
          if (orgId && userId) writeSnap(orgId, userId, next)
          return next
        })
        void refreshDocuments().catch((err) => {
          setError(getSupabaseErrorMessage(err))
        })
        return
      }
      setLocalState((s) => {
        const old = s.pages.find((p) => p.id === id)
        if (!old) return s
        const next: WikiPage = {
          ...old,
          ...patch,
          spaceId: patch.spaceId ?? old.spaceId,
          updatedAt: new Date().toISOString(),
        }
        return {
          ...s,
          pages: s.pages.map((p) => (p.id === id ? next : p)),
        }
      })
    },
    [useRemote, supabase, orgId, userId, remoteState.pages, refreshDocuments, authorFallback],
  )

  const publishPage = useCallback(
    async (id: string) => {
      if (useRemote && supabase && orgId && userId) {
        const old = remoteState.pages.find((p) => p.id === id)
        if (!old) return
        const fromVersion = old.version
        const nextVersion = old.version + 1
        const interval = old.revisionIntervalMonths ?? 12
        const nextDue = new Date()
        nextDue.setMonth(nextDue.getMonth() + interval)

        const snap = {
          organization_id: orgId,
          page_id: old.id,
          version: old.version,
          title: old.title,
          summary: old.summary ?? '',
          status: old.status,
          template: old.template,
          legal_refs: old.legalRefs,
          lang: old.lang ?? 'nb',
          requires_acknowledgement: old.requiresAcknowledgement,
          acknowledgement_audience: old.acknowledgementAudience ?? 'all_employees',
          acknowledgement_department_id: old.acknowledgementDepartmentId ?? null,
          blocks: old.blocks as unknown as Record<string, unknown>[],
          next_revision_due_at: old.nextRevisionDueAt,
          revision_interval_months: interval,
          created_by: userId,
        }
        const { error: snapErr } = await supabase.from('wiki_page_versions').insert(snap)
        if (snapErr) throw snapErr

        const { data, error: e } = await supabase
          .from('wiki_pages')
          .update({
            status: 'published',
            version: nextVersion,
            next_revision_due_at: nextDue.toISOString(),
            archived_at: null,
          })
          .eq('id', id)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (e) throw e
        const page = mapPage(data as Parameters<typeof mapPage>[0], authorFallback)
        await insertLedgerRemote(page, 'published', fromVersion)
        setRemoteState((s) => {
          const next = { ...s, pages: s.pages.map((p) => (p.id === id ? page : p)) }
          if (orgId && userId) writeSnap(orgId, userId, next)
          return next
        })
        void refreshDocuments().catch((err) => {
          setError(getSupabaseErrorMessage(err))
        })
        return
      }
      setLocalState((s) => {
        const old = s.pages.find((p) => p.id === id)
        if (!old) return s
        const fromVersion = old.version
        const interval = old.revisionIntervalMonths ?? 12
        const nextDue = new Date()
        nextDue.setMonth(nextDue.getMonth() + interval)
        const snap: WikiPageVersionSnapshot = {
          id: crypto.randomUUID(),
          pageId: old.id,
          version: old.version,
          title: old.title,
          summary: old.summary ?? '',
          status: old.status,
          template: old.template,
          legalRefs: old.legalRefs,
          lang: old.lang ?? 'nb',
          requiresAcknowledgement: old.requiresAcknowledgement,
          acknowledgementAudience: old.acknowledgementAudience ?? 'all_employees',
          acknowledgementDepartmentId: old.acknowledgementDepartmentId ?? null,
          blocks: old.blocks,
          nextRevisionDueAt: old.nextRevisionDueAt ?? null,
          revisionIntervalMonths: interval,
          frozenAt: new Date().toISOString(),
        }
        const next: WikiPage = {
          ...old,
          status: 'published',
          version: old.version + 1,
          nextRevisionDueAt: nextDue.toISOString(),
          archivedAt: null,
          scheduledDeletionAt: undefined,
          updatedAt: new Date().toISOString(),
        }
        const entry = ledgerEntryLocal(next, 'published', fromVersion)
        return {
          ...s,
          pages: s.pages.map((p) => (p.id === id ? next : p)),
          pageVersions: [snap, ...s.pageVersions],
          auditLedger: [entry, ...s.auditLedger],
        }
      })
    },
    [useRemote, supabase, orgId, userId, remoteState.pages, authorFallback, insertLedgerRemote, refreshDocuments, ledgerEntryLocal],
  )

  const archivePage = useCallback(
    async (id: string) => {
      if (useRemote && supabase && orgId && userId) {
        const old = remoteState.pages.find((p) => p.id === id)
        if (!old) return
        const fromVersion = old.version
        const nextVersion = old.version + 1
        const { data, error: e } = await supabase
          .from('wiki_pages')
          .update({
            status: 'archived',
            version: nextVersion,
            archived_at: old.archivedAt ?? new Date().toISOString(),
          })
          .eq('id', id)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (e) throw e
        const page = mapPage(data as Parameters<typeof mapPage>[0], authorFallback)
        await insertLedgerRemote(page, 'archived', fromVersion)
        setRemoteState((s) => {
          const next = { ...s, pages: s.pages.map((p) => (p.id === id ? page : p)) }
          if (orgId && userId) writeSnap(orgId, userId, next)
          return next
        })
        void refreshDocuments().catch((err) => {
          setError(getSupabaseErrorMessage(err))
        })
        return
      }
      setLocalState((s) => {
        const old = s.pages.find((p) => p.id === id)
        if (!old) return s
        const fromVersion = old.version
        const next: WikiPage = {
          ...old,
          status: 'archived',
          version: old.version + 1,
          archivedAt: old.archivedAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        const entry = ledgerEntryLocal(next, 'archived', fromVersion)
        return {
          ...s,
          pages: s.pages.map((p) => (p.id === id ? next : p)),
          auditLedger: [entry, ...s.auditLedger],
        }
      })
    },
    [useRemote, supabase, orgId, userId, remoteState.pages, authorFallback, insertLedgerRemote, refreshDocuments, ledgerEntryLocal],
  )

  const deletePage = useCallback(
    async (id: string) => {
      if (useRemote && supabase && orgId && userId) {
        const { error: e } = await supabase.from('wiki_pages').delete().eq('id', id).eq('organization_id', orgId)
        if (e) throw e
        setRemoteState((s) => {
          const next = { ...s, pages: s.pages.filter((p) => p.id !== id) }
          if (orgId && userId) writeSnap(orgId, userId, next)
          return next
        })
        void refreshDocuments().catch((err) => {
          setError(getSupabaseErrorMessage(err))
        })
        return
      }
      setLocalState((s) => ({ ...s, pages: s.pages.filter((p) => p.id !== id) }))
    },
    [useRemote, supabase, orgId, userId, refreshDocuments],
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
    async (pageId: string, userName: string) => {
      const display = userName.trim() || profile?.display_name?.trim() || DEMO_USER_NAME
      if (useRemote && supabase && orgId && userId) {
        const page = remoteState.pages.find((p) => p.id === pageId)
        if (!page) return
        if (!acknowledgementRequiredForMe(page)) return
        const dup = remoteState.receipts.some(
          (r) => r.pageId === pageId && r.userId === userId && r.pageVersion === page.version,
        )
        if (dup) return
        const { error: re } = await supabase.from('wiki_compliance_receipts').insert({
          organization_id: orgId,
          page_id: pageId,
          page_title: page.title,
          page_version: page.version,
          user_id: userId,
          user_name: display,
        })
        if (re) throw re
        await insertLedgerRemote(page, 'acknowledged')
        void refreshDocuments().catch((err) => {
          setError(getSupabaseErrorMessage(err))
        })
        return
      }
      setLocalState((s) => {
        const page = s.pages.find((p) => p.id === pageId)
        if (!page) return s
        if (
          !userMustAcknowledgePage(page, {
            isOrgAdmin,
            departmentId: profile?.department_id,
            learningMetadata: profile?.learning_metadata as Record<string, unknown> | null | undefined,
          })
        ) {
          return s
        }
        const already = s.receipts.some(
          (r) => r.pageId === pageId && r.userId === authorFallback && r.pageVersion === page.version,
        )
        if (already) return s
        const receipt: ComplianceReceipt = {
          id: crypto.randomUUID(),
          pageId,
          pageTitle: page.title,
          pageVersion: page.version,
          userId: authorFallback,
          userName: display,
          acknowledgedAt: new Date().toISOString(),
        }
        const entry = ledgerEntryLocal(page, 'acknowledged')
        return {
          ...s,
          receipts: [receipt, ...s.receipts],
          auditLedger: [entry, ...s.auditLedger],
        }
      })
    },
    [
      useRemote,
      supabase,
      orgId,
      userId,
      remoteState.pages,
      remoteState.receipts,
      profile?.display_name,
      profile?.department_id,
      profile?.learning_metadata,
      isOrgAdmin,
      acknowledgementRequiredForMe,
      authorFallback,
      insertLedgerRemote,
      refreshDocuments,
      ledgerEntryLocal,
    ],
  )

  const hasAcknowledged = useCallback(
    (pageId: string, version: number) => {
      const uid = useRemote ? userId : authorFallback
      if (!uid) return false
      return state.receipts.some((r) => r.pageId === pageId && r.userId === uid && r.pageVersion === version)
    },
    [state.receipts, useRemote, userId, authorFallback],
  )

  const addSpaceUrl = useCallback(
    async (spaceId: string, title: string, url: string) => {
      if (!supabase || !orgId || !userId) return
      const { error: e } = await supabase.from('wiki_space_items').insert({
        organization_id: orgId,
        space_id: spaceId,
        kind: 'url',
        title: title.trim(),
        url: url.trim(),
      })
      if (e) throw e
      await refreshDocuments()
    },
    [supabase, orgId, userId, refreshDocuments],
  )

  const uploadSpaceFile = useCallback(
    async (spaceId: string, file: File) => {
      if (!supabase || !orgId || !userId) return
      const safe = file.name.replace(/[^\w.\-åæøÅÆØ ()[\]]+/g, '_')
      const path = `${orgId}/${spaceId}/${crypto.randomUUID()}-${safe}`
      const { error: upErr } = await supabase.storage.from('wiki_space_files').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) throw upErr
      const { error: insErr } = await supabase.from('wiki_space_items').insert({
        organization_id: orgId,
        space_id: spaceId,
        kind: 'file',
        title: file.name,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        created_by: userId,
      })
      if (insErr) throw insErr
      await refreshDocuments()
    },
    [supabase, orgId, userId, refreshDocuments],
  )

  const deleteSpaceItem = useCallback(
    async (item: WikiSpaceItem) => {
      if (!supabase || !orgId) return
      if (item.kind === 'file' && item.filePath) {
        await supabase.storage.from('wiki_space_files').remove([item.filePath])
      }
      const { error: e } = await supabase.from('wiki_space_items').delete().eq('id', item.id).eq('organization_id', orgId)
      if (e) throw e
      await refreshDocuments()
    },
    [supabase, orgId, refreshDocuments],
  )

  const getSpaceFileUrl = useCallback(
    async (item: WikiSpaceItem) => {
      if (!supabase || item.kind !== 'file' || !item.filePath) return null
      const { data, error: e } = await supabase.storage.from('wiki_space_files').createSignedUrl(item.filePath, 3600)
      if (e) return null
      return data?.signedUrl ?? null
    },
    [supabase],
  )

  const stats = useMemo(() => {
    const published = state.pages.filter((p) => p.status === 'published').length
    const drafts = state.pages.filter((p) => p.status === 'draft').length
    const requireAck = state.pages.filter((p) => p.requiresAcknowledgement && p.status === 'published').length
    const acknowledged = state.receipts.length
    return { published, drafts, requireAck, acknowledged, total: state.pages.length }
  }, [state.pages, state.receipts])

  const resetDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LOCAL_ORG_TEMPLATES_KEY)
    setLocalState(emptyLocalState())
    setLocalOrgCustomTemplates([])
    if (orgId && userId) clearSnap(orgId, userId)
    setRemoteState(emptyLocalState())
  }, [orgId, userId])

  const versionsForPage = useCallback(
    (pageId: string) => state.pageVersions.filter((v) => v.pageId === pageId).sort((a, b) => b.version - a.version),
    [state.pageVersions],
  )

  const fetchAnnualReview = useCallback(
    async (year: number) => {
      if (!supabase || !orgId) return { review: null as wikiAnnualApi.WikiAnnualReviewRow | null, items: [] as wikiAnnualApi.WikiAnnualReviewItemRow[] }
      return wikiAnnualApi.apiFetchAnnualReview(supabase, orgId, year)
    },
    [supabase, orgId],
  )

  const ensureAnnualReview = useCallback(
    async (year: number) => {
      if (!useRemote || !supabase || !orgId || !userId) return { review: null as wikiAnnualApi.WikiAnnualReviewRow | null, items: [] as wikiAnnualApi.WikiAnnualReviewItemRow[] }
      const existing = await wikiAnnualApi.apiFetchAnnualReview(supabase, orgId, year)
      if (existing.review) return existing
      const review = await wikiAnnualApi.apiInsertAnnualReview(supabase, orgId, year)
      const coverage = await wikiAnnualApi.apiFetchLegalCoverageRefs(supabase)
      const rowMap = new Map<string, { page_id: string | null; legal_ref: string; description: string }>()
      for (const c of coverage) {
        const key = `cov:${c.ref}`
        if (!rowMap.has(key)) {
          rowMap.set(key, { page_id: null, legal_ref: c.ref, description: c.label })
        }
      }
      const { data: pageRows, error: pe } = await supabase
        .from('wiki_pages')
        .select('id, title, legal_refs')
        .eq('organization_id', orgId)
      if (pe) throw pe
      for (const pr of pageRows ?? []) {
        const refs = (pr as { legal_refs?: string[] }).legal_refs
        if (!refs?.length) continue
        const ref0 = refs[0] ?? 'Dokument'
        rowMap.set(`page:${(pr as { id: string }).id}`, {
          page_id: (pr as { id: string }).id,
          legal_ref: ref0,
          description: (pr as { title: string }).title,
        })
      }
      await wikiAnnualApi.apiInsertAnnualReviewItems(supabase, review.id, [...rowMap.values()])
      await wikiAnnualApi.apiRecalcAnnualReviewProgress(supabase, review.id)
      return wikiAnnualApi.apiFetchAnnualReview(supabase, orgId, year)
    },
    [useRemote, supabase, orgId, userId],
  )

  const updateAnnualReviewItem = useCallback(
    async (
      reviewId: string,
      itemId: string,
      patch: { status: wikiAnnualApi.WikiAnnualReviewItemRow['status']; reviewer_notes?: string | null },
    ) => {
      if (!supabase || !orgId || !userId) return
      await wikiAnnualApi.apiUpdateAnnualReviewItem(supabase, itemId, {
        ...patch,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      await wikiAnnualApi.apiRecalcAnnualReviewProgress(supabase, reviewId)
    },
    [supabase, orgId, userId],
  )

  const finalizeAnnualReview = useCallback(
    async (reviewId: string, year: number, notes: string | null) => {
      if (!useRemote || !supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const hms = remoteState.spaces.find((s) => s.category === 'hms_handbook')
      if (!hms) throw new Error('Mangler HMS-håndbok-mappe.')
      const tpl = pageTemplates.find((t) => t.id === 'tpl-aarsgjennomgang')
      if (!tpl) throw new Error('Mal tpl-aarsgjennomgang ikke funnet.')
      const title = tpl.page.title.replace('[ÅR]', String(year))
      const summary = (tpl.page.summary ?? '').replace('[ÅR]', String(year))
      const blocks = JSON.parse(JSON.stringify(tpl.page.blocks)) as typeof tpl.page.blocks
      for (const b of blocks) {
        if (b.kind === 'heading' && 'text' in b && typeof b.text === 'string') {
          b.text = b.text.replace('[ÅR]', String(year))
        }
        if (b.kind === 'text' && 'body' in b && typeof b.body === 'string') {
          b.body = b.body.replace(/\[ÅR\]/g, String(year))
        }
      }
      const page = await createPage(hms.id, title, tpl.page.template, blocks, {
        legalRefs: tpl.page.legalRefs,
        requiresAcknowledgement: tpl.page.requiresAcknowledgement ?? false,
        summary,
        acknowledgementAudience: tpl.page.acknowledgementAudience,
        revisionIntervalMonths: tpl.page.revisionIntervalMonths,
      })
      await publishPage(page.id)
      const ledgerPage: WikiPage = {
        ...page,
        status: 'published',
        version: page.version + 1,
        nextRevisionDueAt: page.nextRevisionDueAt ?? null,
      }
      await insertLedgerRemote(ledgerPage, 'annual_review_completed')
      await wikiAnnualApi.apiCompleteAnnualReview(supabase, reviewId, userId, {
        completed_at: new Date().toISOString(),
        review_page_id: page.id,
        notes: notes?.trim() || null,
      })
      await refreshDocuments()
    },
    [
      useRemote,
      supabase,
      orgId,
      userId,
      remoteState.spaces,
      pageTemplates,
      createPage,
      publishPage,
      insertLedgerRemote,
      refreshDocuments,
    ],
  )

  return {
    backend: useRemote ? ('supabase' as const) : ('local' as const),
    loading: useRemote && loading,
    error,
    pageHydrateLoading: pageHydrate.loading,
    pageHydrateError: pageHydrate.error,
    ensurePageLoaded,
    spaces: state.spaces,
    pages: state.pages,
    auditLedger: state.auditLedger,
    receipts: state.receipts,
    spaceItems: state.spaceItems,
    pageVersions: state.pageVersions,
    versionsForPage,
    addSpaceUrl,
    uploadSpaceFile,
    deleteSpaceItem,
    getSpaceFileUrl,
    legalCoverage: useRemote
      ? legalCoverage
      : STATIC_LEGAL_COVERAGE.map((r) => ({
          ref: r.ref,
          label: r.label,
          templateIds: r.templateIds,
          maxRevisionMonths: r.maxRevisionMonths ?? null,
        })),
    wikiRetentionCategories,
    pageTemplates,
    systemTemplatesCatalog: systemTemplates,
    orgTemplateSettings,
    orgCustomTemplates: useRemote ? orgCustomTemplates : localOrgCustomTemplates,
    refreshDocuments,
    setSystemTemplateEnabled,
    saveOrgCustomTemplate,
    deleteOrgCustomTemplate,
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
    resetDemo,
    fetchAnnualReview,
    ensureAnnualReview,
    updateAnnualReviewItem,
    finalizeAnnualReview,
  }
}

export type DocumentsContextValue = ReturnType<typeof useDocumentsStore>

const DocumentsContext = createContext<DocumentsContextValue | null>(null)

/** Single shared wiki/documents store — avoids duplicate state per route (fixes blank wiki / crashes). */
export function DocumentsProvider({ children }: { children: ReactNode }) {
  const value = useDocumentsStore()
  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>
}

/** Route layout: wraps shell routes with shared documents context. */
export function DocumentsLayout() {
  return (
    <DocumentsProvider>
      <Outlet />
    </DocumentsProvider>
  )
}

export function useDocuments(): DocumentsContextValue {
  const ctx = useContext(DocumentsContext)
  if (!ctx) {
    throw new Error('useDocuments must be used within DocumentsProvider')
  }
  return ctx
}
