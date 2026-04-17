/**
 * Pure Supabase calls for the documents/wiki module — no React.
 * Used by useDocuments; keeps data access testable and centralized.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AuditLedgerEntry,
  ComplianceReceipt,
  PageTemplate,
  SpaceCategory,
  WikiPage,
  WikiPageVersionSnapshot,
  WikiSpace,
  WikiSpaceItem,
} from '../types/documents'
import {
  mapWikiLedger,
  mapWikiPage,
  mapWikiPageVersion,
  mapWikiReceipt,
  mapWikiSpace,
  mapWikiSpaceItem,
} from '../lib/wikiDocumentsMappers'

export type DocumentsRawSnapshot = {
  spaces: WikiSpace[]
  pages: WikiPage[]
  auditLedger: AuditLedgerEntry[]
  receipts: ComplianceReceipt[]
  spaceItems: WikiSpaceItem[]
  pageVersions: WikiPageVersionSnapshot[]
}

export async function apiWikiEnsureOrgDefaults(supabase: SupabaseClient) {
  const { error } = await supabase.rpc('wiki_ensure_org_defaults')
  if (error) throw error
}

export type LegalCoverageApiRow = {
  id: string
  ref: string
  label: string
  requirement: string
  category: string
  template_ids: string[]
  mandatory_for_all: boolean
  min_employees: number
  max_revision_months: number
  legal_consequence: string | null
}

export async function apiFetchLegalCoverage(supabase: SupabaseClient): Promise<LegalCoverageApiRow[]> {
  const { data, error } = await supabase
    .from('wiki_legal_coverage_items')
    .select(
      'id, ref, label, requirement, category, template_ids, mandatory_for_all, min_employees, max_revision_months, legal_consequence',
    )
    .order('ref')
  if (error) throw error
  return (data ?? []) as LegalCoverageApiRow[]
}

export async function apiFetchComplianceSummary(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('wiki_compliance_summary').select('*').eq('organization_id', orgId)
  if (error) throw error
  return data ?? []
}

export async function apiFetchCoverageAssignments(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from('wiki_legal_coverage_item_assignments')
    .select('coverage_item_id, owner_id')
    .eq('organization_id', orgId)
  if (error) throw error
  return data ?? []
}

export type PeerProfileRow = {
  id: string
  display_name: string
  department_id?: string | null
  learning_metadata?: Record<string, unknown> | null
  is_org_admin?: boolean | null
}

export async function apiFetchOrgPeerProfiles(supabase: SupabaseClient, orgId: string): Promise<PeerProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, department_id, learning_metadata, is_org_admin')
    .eq('organization_id', orgId)
    .order('display_name')
  if (error) throw error
  return (data ?? []) as PeerProfileRow[]
}

export async function apiFetchSystemTemplates(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('document_system_templates')
    .select('id, label, description, category, legal_basis, page_payload, sort_order')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function apiFetchOrgTemplateSettings(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('document_org_template_settings').select('template_id, enabled, custom_blocks').eq('organization_id', orgId)
  if (error) throw error
  return data ?? []
}

export async function apiFetchOrgCustomTemplates(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase.from('document_org_templates').select('*').eq('organization_id', orgId).order('created_at')
  if (error) throw error
  return data ?? []
}

export async function apiFetchAllForOrg(
  supabase: SupabaseClient,
  orgId: string,
  authorFallback: string,
): Promise<DocumentsRawSnapshot> {
  const [spacesRes, pagesRes, ledgerRes, receiptsRes, itemsRes, verRes] = await Promise.all([
    supabase.from('wiki_spaces').select('*').eq('organization_id', orgId).order('created_at'),
    supabase
      .from('wiki_pages')
      .select('*')
      .eq('organization_id', orgId)
      .order('space_id')
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false }),
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

export type SpacePageCursor = { sortOrder: number; id: string } | null

const PAGE_BATCH = 20

/** Keyset pagination: stable order sort_order asc, id asc */
export async function apiFetchWikiPagesInSpacePage(
  supabase: SupabaseClient,
  orgId: string,
  spaceId: string,
  authorFallback: string,
  opts?: { after?: SpacePageCursor; limit?: number; status?: WikiPage['status'] },
): Promise<{ pages: WikiPage[]; nextCursor: SpacePageCursor }> {
  const limit = opts?.limit ?? PAGE_BATCH
  const after = opts?.after ?? null

  let q = supabase
    .from('wiki_pages')
    .select('*')
    .eq('organization_id', orgId)
    .eq('space_id', spaceId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit + 1)

  if (opts?.status) {
    q = q.eq('status', opts.status)
  }

  if (after) {
    const so = after.sortOrder
    const id = after.id
    // Keyset: (sort_order, id) strictly greater than cursor (id is uuid text, safe for filter)
    q = q.or(`sort_order.gt.${so},and(sort_order.eq.${so},id.gt.${id})`)
  }

  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as Parameters<typeof mapWikiPage>[0][]
  const mapped = rows.map((r) => mapWikiPage(r, authorFallback))
  const hasMore = mapped.length > limit
  const slice = hasMore ? mapped.slice(0, limit) : mapped
  const last = slice[slice.length - 1]
  const nextCursor: SpacePageCursor =
    hasMore && last ? { sortOrder: last.sortOrder, id: last.id } : null
  return { pages: slice, nextCursor }
}

export async function apiFetchWikiPageById(
  supabase: SupabaseClient,
  orgId: string,
  pageId: string,
  authorFallback: string,
): Promise<WikiPage | null> {
  const { data, error } = await supabase
    .from('wiki_pages')
    .select('*')
    .eq('id', pageId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapWikiPage(data as Parameters<typeof mapWikiPage>[0], authorFallback)
}

export async function apiSearchWikiPages(
  supabase: SupabaseClient,
  orgId: string,
  query: string,
): Promise<{ id: string; space_id: string; title: string; summary: string; status: string; updated_at: string }[]> {
  const q = query.trim()
  if (!q) return []
  const { data, error } = await supabase
    .from('wiki_pages')
    .select('id, space_id, title, summary, status, updated_at')
    .eq('organization_id', orgId)
    .textSearch('search_vector', q, { type: 'websearch', config: 'norwegian' })
    .limit(40)
  if (error) throw error
  return (data ?? []) as { id: string; space_id: string; title: string; summary: string; status: string; updated_at: string }[]
}

export async function apiInsertAuditLedger(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  row: {
    page_id: string
    page_title: string
    action: AuditLedgerEntry['action']
    from_version: number | null
    to_version: number
  },
) {
  const { data, error } = await supabase
    .from('wiki_audit_ledger')
    .insert({
      organization_id: orgId,
      page_id: row.page_id,
      page_title: row.page_title,
      action: row.action,
      user_id: userId,
      from_version: row.from_version,
      to_version: row.to_version,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapWikiLedger(data as Parameters<typeof mapWikiLedger>[0])
}

export async function apiCreateWikiSpace(
  supabase: SupabaseClient,
  orgId: string,
  row: {
    id: string
    title: string
    description: string
    category: WikiSpace['category']
    icon: string
    status: WikiSpace['status']
  },
) {
  const { data, error } = await supabase
    .from('wiki_spaces')
    .insert({
      id: row.id,
      organization_id: orgId,
      title: row.title,
      description: row.description,
      category: row.category,
      icon: row.icon,
      status: row.status,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapWikiSpace(data as Parameters<typeof mapWikiSpace>[0])
}

export async function apiUpdateWikiSpace(
  supabase: SupabaseClient,
  orgId: string,
  id: string,
  dbPatch: Record<string, unknown>,
) {
  const { data, error } = await supabase.from('wiki_spaces').update(dbPatch).eq('id', id).eq('organization_id', orgId).select('*').single()
  if (error) throw error
  return mapWikiSpace(data as Parameters<typeof mapWikiSpace>[0])
}

export async function apiInsertWikiPage(
  supabase: SupabaseClient,
  pageRow: Record<string, unknown>,
  authorFallback: string,
) {
  const { data, error } = await supabase.from('wiki_pages').insert(pageRow).select('*').single()
  if (error) throw error
  return mapWikiPage(data as Parameters<typeof mapWikiPage>[0], authorFallback)
}

export async function apiUpdateWikiPage(
  supabase: SupabaseClient,
  orgId: string,
  id: string,
  dbPatch: Record<string, unknown>,
  authorFallback: string,
) {
  const { data, error } = await supabase.from('wiki_pages').update(dbPatch).eq('id', id).eq('organization_id', orgId).select('*').single()
  if (error) throw error
  return mapWikiPage(data as Parameters<typeof mapWikiPage>[0], authorFallback)
}

export async function apiDeleteWikiPage(supabase: SupabaseClient, orgId: string, id: string) {
  const { error } = await supabase.from('wiki_pages').delete().eq('id', id).eq('organization_id', orgId)
  if (error) throw error
}

export async function apiReorderWikiPagesInSpace(
  supabase: SupabaseClient,
  orgId: string,
  spaceId: string,
  orderedPageIds: string[],
) {
  const now = new Date().toISOString()
  for (let i = 0; i < orderedPageIds.length; i++) {
    const pid = orderedPageIds[i]!
    const { error } = await supabase
      .from('wiki_pages')
      .update({ sort_order: i, updated_at: now })
      .eq('id', pid)
      .eq('organization_id', orgId)
      .eq('space_id', spaceId)
    if (error) throw error
  }
}

export async function apiInsertWikiPageVersion(
  supabase: SupabaseClient,
  snap: Record<string, unknown>,
) {
  const { data, error } = await supabase.from('wiki_page_versions').insert(snap).select('*').single()
  if (error) throw error
  return mapWikiPageVersion(data as Parameters<typeof mapWikiPageVersion>[0])
}

export async function apiInsertComplianceReceipt(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  row: {
    page_id: string
    page_title: string
    page_version: number
    user_name: string
  },
) {
  const { data, error } = await supabase
    .from('wiki_compliance_receipts')
    .insert({
      organization_id: orgId,
      page_id: row.page_id,
      page_title: row.page_title,
      page_version: row.page_version,
      user_id: userId,
      user_name: row.user_name,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapWikiReceipt(data as Parameters<typeof mapWikiReceipt>[0])
}

export async function apiInsertSpaceUrl(
  supabase: SupabaseClient,
  orgId: string,
  spaceId: string,
  title: string,
  url: string,
) {
  const { data, error } = await supabase
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
  if (error) throw error
  return mapWikiSpaceItem(data as Parameters<typeof mapWikiSpaceItem>[0])
}

export async function apiInsertSpaceFileRow(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  row: {
    space_id: string
    title: string
    file_path: string
    file_name: string
    mime_type: string | null
    file_size: number
  },
) {
  const { data, error } = await supabase
    .from('wiki_space_items')
    .insert({
      organization_id: orgId,
      space_id: row.space_id,
      kind: 'file',
      title: row.title,
      file_path: row.file_path,
      file_name: row.file_name,
      mime_type: row.mime_type,
      file_size: row.file_size,
      created_by: userId,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapWikiSpaceItem(data as Parameters<typeof mapWikiSpaceItem>[0])
}

export async function apiDeleteSpaceItem(supabase: SupabaseClient, orgId: string, itemId: string) {
  const { error } = await supabase.from('wiki_space_items').delete().eq('id', itemId).eq('organization_id', orgId)
  if (error) throw error
}

export async function apiStorageUploadWikiFile(supabase: SupabaseClient, path: string, file: File) {
  const { error } = await supabase.storage.from('wiki_space_files').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
}

export async function apiStorageRemoveWikiFiles(supabase: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from('wiki_space_files').remove(paths)
  if (error) throw error
}

export async function apiStorageSignedUrl(supabase: SupabaseClient, filePath: string, expiresSec: number) {
  const { data, error } = await supabase.storage.from('wiki_space_files').createSignedUrl(filePath, expiresSec)
  if (error) return null
  return data?.signedUrl ?? null
}

export async function apiUpsertOrgTemplateSetting(
  supabase: SupabaseClient,
  orgId: string,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase.from('document_org_template_settings').upsert(payload, {
    onConflict: 'organization_id,template_id',
  })
  if (error) throw error
}

export async function apiUpsertOrgCustomTemplate(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
) {
  const { error } = await supabase.from('document_org_templates').upsert(row, { onConflict: 'id' })
  if (error) throw error
}

export async function apiSelectOrgCustomTemplate(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from('document_org_templates').select('*').eq('id', id).single()
  if (error) throw error
  return data as {
    id: string
    label: string
    description: string
    category: SpaceCategory
    legal_basis: string[]
    page_payload: PageTemplate['page']
  }
}

export async function apiDeleteOrgCustomTemplate(supabase: SupabaseClient, orgId: string, id: string) {
  const { error } = await supabase.from('document_org_templates').delete().eq('id', id).eq('organization_id', orgId)
  if (error) throw error
}

export async function apiUpsertCoverageAssignment(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
) {
  const { error } = await supabase.from('wiki_legal_coverage_item_assignments').upsert(row, {
    onConflict: 'organization_id,coverage_item_id',
  })
  if (error) throw error
}

export async function apiInsertWorkflowQueueRows(supabase: SupabaseClient, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return
  const { error } = await supabase.from('workflow_action_queue').insert(rows)
  if (error) throw error
}

export type WikiPagePresenceRow = {
  page_id: string
  user_id: string
  last_seen: string
}

export async function apiUpsertWikiPagePresence(
  supabase: SupabaseClient,
  orgId: string,
  pageId: string,
  userId: string,
) {
  const { error } = await supabase.from('wiki_page_presence').upsert(
    {
      organization_id: orgId,
      page_id: pageId,
      user_id: userId,
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'page_id,user_id' },
  )
  if (error) throw error
}

export async function apiDeleteWikiPagePresence(supabase: SupabaseClient, pageId: string, userId: string) {
  const { error } = await supabase.from('wiki_page_presence').delete().eq('page_id', pageId).eq('user_id', userId)
  if (error) throw error
}

/** Presence rows still considered "in editor" (stale rows excluded client-side if needed). */
export async function apiFetchWikiPagePresenceForPage(
  supabase: SupabaseClient,
  orgId: string,
  pageId: string,
  activeSinceIso: string,
): Promise<WikiPagePresenceRow[]> {
  const { data, error } = await supabase
    .from('wiki_page_presence')
    .select('page_id, user_id, last_seen')
    .eq('organization_id', orgId)
    .eq('page_id', pageId)
    .gte('last_seen', activeSinceIso)
  if (error) throw error
  return (data ?? []) as WikiPagePresenceRow[]
}
