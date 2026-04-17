/* eslint-disable react-refresh/only-export-components -- provider + hooks in one module */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AcknowledgementAudience,
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
import {
  mapWikiLedger,
  mapWikiPage,
  mapWikiPageVersion,
  mapWikiReceipt,
  mapWikiSpace,
  mapWikiSpaceItem,
} from '../lib/wikiDocumentsMappers'

export const DEMO_USER_NAME = 'Demo User'

type DocumentsState = {
  spaces: WikiSpace[]
  pages: WikiPage[]
  auditLedger: AuditLedgerEntry[]
  receipts: ComplianceReceipt[]
  spaceItems: WikiSpaceItem[]
  pageVersions: WikiPageVersionSnapshot[]
}

type LegalCoverageRow = { ref: string; label: string; templateIds: string[] }

type OrgTemplateSetting = { templateId: string; enabled: boolean }

type OrgCustomTemplate = {
  id: string
  label: string
  description: string
  category: SpaceCategory
  legalBasis: string[]
  pagePayload: Omit<WikiPage, 'id' | 'spaceId' | 'createdAt' | 'updatedAt' | 'authorId' | 'version' | 'wordCount'>
}

function emptyState(): DocumentsState {
  return { spaces: [], pages: [], auditLedger: [], receipts: [], spaceItems: [], pageVersions: [] }
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
    spaces: (spacesRes.data ?? []).map(mapWikiSpace),
    pages: (pagesRes.data ?? []).map((r) => mapWikiPage(r as Parameters<typeof mapWikiPage>[0], authorFallback)),
    auditLedger: (ledgerRes.data ?? []).map(mapWikiLedger),
    receipts: (receiptsRes.data ?? []).map(mapWikiReceipt),
    spaceItems: (itemsRes.data ?? []).map((r) => mapWikiSpaceItem(r as Parameters<typeof mapWikiSpaceItem>[0])),
    pageVersions: (verRes.data ?? []).map((r) => mapWikiPageVersion(r as Parameters<typeof mapWikiPageVersion>[0])),
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
  const authorFallback = userId ?? ''

  const ready = !!(supabase && orgId && userId)
  const initialSnap = ready ? readSnap(orgId, userId) : null

  const [remoteState, setRemoteState] = useState<DocumentsState>(() => initialSnap ?? emptyState())
  const [legalCoverage, setLegalCoverage] = useState<LegalCoverageRow[]>([])
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
      await supabase.rpc('wiki_ensure_org_defaults')
      const [covRes, tplRes, setRes, customRes, data] = await Promise.all([
        supabase.from('wiki_legal_coverage_items').select('ref, label, template_ids').order('ref'),
        supabase
          .from('document_system_templates')
          .select('id, label, description, category, legal_basis, page_payload, sort_order')
          .order('sort_order', { ascending: true }),
        supabase.from('document_org_template_settings').select('template_id, enabled').eq('organization_id', orgId),
        supabase.from('document_org_templates').select('*').eq('organization_id', orgId).order('created_at'),
        fetchAllForOrg(supabase, orgId, authorFallback),
      ])
      if (covRes.error) throw covRes.error
      if (tplRes.error) throw tplRes.error
      if (setRes.error) throw setRes.error
      if (customRes.error) throw customRes.error

      setLegalCoverage(
        (covRes.data ?? []).map((r) => ({
          ref: r.ref,
          label: r.label,
          templateIds: (r.template_ids as string[]) ?? [],
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
        const mapped = mapWikiPage(data as Parameters<typeof mapWikiPage>[0], authorFallback)
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
      .map((t) => ({
        id: t.id,
        label: t.label,
        description: t.description,
        legalBasis: t.legalBasis,
        category: t.category,
        page: t.pagePayload,
      }))
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
      const { error: e } = await supabase.from('document_org_templates').upsert(row, { onConflict: 'id' })
      if (e) throw e
      const { data: rowOut, error: selErr } = await supabase.from('document_org_templates').select('*').eq('id', id).single()
      if (selErr) throw selErr
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
      const { error: e } = await supabase.from('document_org_templates').delete().eq('id', id).eq('organization_id', orgId)
      if (e) throw e
      setOrgCustomTemplates((prev) => prev.filter((t) => t.id !== id))
    },
    [supabase, orgId],
  )

  const insertLedgerRemote = useCallback(
    async (page: WikiPage, action: AuditLedgerEntry['action'], fromVersion?: number) => {
      if (!supabase || !orgId || !userId) return
      const { data: ins, error: e } = await supabase
        .from('wiki_audit_ledger')
        .insert({
          organization_id: orgId,
          page_id: page.id,
          page_title: page.title,
          action,
          user_id: userId,
          from_version: fromVersion ?? null,
          to_version: page.version,
        })
        .select('*')
        .single()
      if (e) throw e
      const entry = mapWikiLedger(ins as Parameters<typeof mapWikiLedger>[0])
      mergeState((s) => ({ ...s, auditLedger: [entry, ...s.auditLedger] }))
    },
    [supabase, orgId, userId, mergeState],
  )

  const createSpace = useCallback(
    async (title: string, description: string, category: WikiSpace['category'], icon: string) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
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
      const space = mapWikiSpace(data as Parameters<typeof mapWikiSpace>[0])
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
      const { data, error: e } = await supabase.from('wiki_spaces').update(dbPatch).eq('id', id).eq('organization_id', orgId).select('*').single()
      if (e) throw e
      const space = mapWikiSpace(data as Parameters<typeof mapWikiSpace>[0])
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
        >
      >,
    ) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const id = crypto.randomUUID()
      const pageRow = {
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
      }
      const { data, error: pe } = await supabase.from('wiki_pages').insert(pageRow).select('*').single()
      if (pe) throw pe
      const page = mapWikiPage(data as Parameters<typeof mapWikiPage>[0], authorFallback)
      await insertLedgerRemote(page, 'created')
      mergeState((s) => ({ ...s, pages: [page, ...s.pages] }))
      return page
    },
    [supabase, orgId, userId, authorFallback, insertLedgerRemote, mergeState],
  )

  const updatePage = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          WikiPage,
          | 'title'
          | 'summary'
          | 'blocks'
          | 'legalRefs'
          | 'requiresAcknowledgement'
          | 'template'
          | 'acknowledgementAudience'
          | 'acknowledgementDepartmentId'
          | 'revisionIntervalMonths'
          | 'nextRevisionDueAt'
        >
      >,
    ) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.title !== undefined) dbPatch.title = patch.title
      if (patch.summary !== undefined) dbPatch.summary = patch.summary
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
      const { data, error: e } = await supabase.from('wiki_pages').update(dbPatch).eq('id', id).eq('organization_id', orgId).select('*').single()
      if (e) throw e
      const updated = mapWikiPage(data as Parameters<typeof mapWikiPage>[0], authorFallback)
      mergeState((s) => ({ ...s, pages: s.pages.map((p) => (p.id === id ? updated : p)) }))
    },
    [supabase, orgId, userId, authorFallback, mergeState],
  )

  const publishPage = useCallback(
    async (id: string) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
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
        requires_acknowledgement: old.requiresAcknowledgement,
        acknowledgement_audience: old.acknowledgementAudience ?? 'all_employees',
        acknowledgement_department_id: old.acknowledgementDepartmentId ?? null,
        blocks: old.blocks as unknown as Record<string, unknown>[],
        next_revision_due_at: old.nextRevisionDueAt,
        revision_interval_months: interval,
        created_by: userId,
      }
      const { data: verRow, error: snapErr } = await supabase.from('wiki_page_versions').insert(snap).select('*').single()
      if (snapErr) throw snapErr

      const { data, error: e } = await supabase
        .from('wiki_pages')
        .update({
          status: 'published',
          version: nextVersion,
          next_revision_due_at: nextDue.toISOString(),
        })
        .eq('id', id)
        .eq('organization_id', orgId)
        .select('*')
        .single()
      if (e) throw e
      const page = mapWikiPage(data as Parameters<typeof mapWikiPage>[0], authorFallback)
      await insertLedgerRemote(page, 'published', fromVersion)
      const snapMapped = mapWikiPageVersion(verRow as Parameters<typeof mapWikiPageVersion>[0])
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
      const { data, error: e } = await supabase
        .from('wiki_pages')
        .update({ status: 'archived', version: nextVersion })
        .eq('id', id)
        .eq('organization_id', orgId)
        .select('*')
        .single()
      if (e) throw e
      const page = mapWikiPage(data as Parameters<typeof mapWikiPage>[0], authorFallback)
      await insertLedgerRemote(page, 'archived', fromVersion)
      mergeState((s) => ({ ...s, pages: s.pages.map((p) => (p.id === id ? page : p)) }))
    },
    [supabase, orgId, userId, remoteState.pages, authorFallback, insertLedgerRemote, mergeState],
  )

  const deletePage = useCallback(
    async (id: string) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const { error: e } = await supabase.from('wiki_pages').delete().eq('id', id).eq('organization_id', orgId)
      if (e) throw e
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
    async (pageId: string, userName: string) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const display = userName.trim() || profile?.display_name?.trim() || DEMO_USER_NAME
      const page = remoteState.pages.find((p) => p.id === pageId)
      if (!page) return
      if (!acknowledgementRequiredForMe(page)) return
      const dup = remoteState.receipts.some(
        (r) => r.pageId === pageId && r.userId === userId && r.pageVersion === page.version,
      )
      if (dup) return
      const { data: recRow, error: re } = await supabase
        .from('wiki_compliance_receipts')
        .insert({
          organization_id: orgId,
          page_id: pageId,
          page_title: page.title,
          page_version: page.version,
          user_id: userId,
          user_name: display,
        })
        .select('*')
        .single()
      if (re) throw re
      await insertLedgerRemote(page, 'acknowledged')
      const receipt = mapWikiReceipt(recRow as Parameters<typeof mapWikiReceipt>[0])
      mergeState((s) => ({ ...s, receipts: [receipt, ...s.receipts] }))
    },
    [
      supabase,
      orgId,
      userId,
      remoteState.pages,
      remoteState.receipts,
      profile?.display_name,
      acknowledgementRequiredForMe,
      insertLedgerRemote,
      mergeState,
    ],
  )

  const hasAcknowledged = useCallback(
    (pageId: string, version: number) => {
      if (!userId) return false
      return remoteState.receipts.some((r) => r.pageId === pageId && r.userId === userId && r.pageVersion === version)
    },
    [remoteState.receipts, userId],
  )

  const addSpaceUrl = useCallback(
    async (spaceId: string, title: string, url: string) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const { data, error: e } = await supabase
        .from('wiki_space_items')
        .insert({
          organization_id: orgId,
          space_id: spaceId,
          kind: 'url',
          title: title.trim(),
          url: url.trim(),
        })
        .select('*')
        .single()
      if (e) throw e
      const item = mapWikiSpaceItem(data as Parameters<typeof mapWikiSpaceItem>[0])
      mergeState((s) => ({ ...s, spaceItems: [item, ...s.spaceItems] }))
    },
    [supabase, orgId, userId, mergeState],
  )

  const uploadSpaceFile = useCallback(
    async (spaceId: string, file: File) => {
      if (!supabase || !orgId || !userId) throw new Error('Ikke tilkoblet')
      const safe = file.name.replace(/[^\w.\-åæøÅÆØ ()[\]]+/g, '_')
      const path = `${orgId}/${spaceId}/${crypto.randomUUID()}-${safe}`
      const { error: upErr } = await supabase.storage.from('wiki_space_files').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) throw upErr
      const { data, error: insErr } = await supabase
        .from('wiki_space_items')
        .insert({
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
        .select('*')
        .single()
      if (insErr) throw insErr
      const item = mapWikiSpaceItem(data as Parameters<typeof mapWikiSpaceItem>[0])
      mergeState((s) => ({ ...s, spaceItems: [item, ...s.spaceItems] }))
    },
    [supabase, orgId, userId, mergeState],
  )

  const deleteSpaceItem = useCallback(
    async (item: WikiSpaceItem) => {
      if (!supabase || !orgId) throw new Error('Ikke tilkoblet')
      if (item.kind === 'file' && item.filePath) {
        await supabase.storage.from('wiki_space_files').remove([item.filePath])
      }
      const { error: e } = await supabase.from('wiki_space_items').delete().eq('id', item.id).eq('organization_id', orgId)
      if (e) throw e
      mergeState((s) => ({ ...s, spaceItems: s.spaceItems.filter((i) => i.id !== item.id) }))
    },
    [supabase, orgId, mergeState],
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
    const published = remoteState.pages.filter((p) => p.status === 'published').length
    const drafts = remoteState.pages.filter((p) => p.status === 'draft').length
    const requireAck = remoteState.pages.filter((p) => p.requiresAcknowledgement && p.status === 'published').length
    const acknowledged = remoteState.receipts.length
    return { published, drafts, requireAck, acknowledged, total: remoteState.pages.length }
  }, [remoteState.pages, remoteState.receipts])

  const versionsForPage = useCallback(
    (pageId: string) => remoteState.pageVersions.filter((v) => v.pageId === pageId).sort((a, b) => b.version - a.version),
    [remoteState.pageVersions],
  )

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
      legalCoverage: ready ? legalCoverage : STATIC_LEGAL_COVERAGE,
      pageTemplates,
      systemTemplatesCatalog: systemTemplates,
      orgTemplateSettings,
      orgCustomTemplates,
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
      addSpaceUrl,
      uploadSpaceFile,
      deleteSpaceItem,
      getSpaceFileUrl,
      legalCoverage,
      pageTemplates,
      systemTemplates,
      orgTemplateSettings,
      orgCustomTemplates,
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
      versions,
      receipts: v.receipts,
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
      saveOrgCustomTemplate: v.saveOrgCustomTemplate,
      deleteOrgCustomTemplate: v.deleteOrgCustomTemplate,
      refreshDocuments: v.refreshDocuments,
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
      pages: v.pages,
      pageTemplates: v.pageTemplates,
      receipts: v.receipts,
      stats: v.stats,
      refreshDocuments: v.refreshDocuments,
    }),
    [v],
  )
}
