// Loads admin-relevant audit entries from two parallel sources:
//   1) `hse_audit_log` — generic table audit (org settings, roles,
//      integrations, workflow_rules, compliance_packs, internal_packs,
//      survey_org_templates, …)
//   2) `studio_revisions` — Studio-mediated revisions for the 4
//      template tables that don't have hse_audit_log triggers
//      (document_org_templates, meeting_org_templates, register_types,
//      learning_courses). Without merging these in, the Tilpass
//      wizard's copies into those modules would never show up in the
//      Audit-logg-seksjonen — a compliance gap for Arbeidstilsynet.
//
// Pagination is cursor-based on (changed_at desc, id desc). Both
// streams use the same cursor so a single composite cursor advances
// through the merge-sorted view.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { formatDateTime } from './format'
import type { AuditEntry } from './types'

interface RawAuditRow {
  id: string
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_by: string | null
  changed_at: string
  changed_fields: string[] | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}

interface StudioRevisionRow {
  id: string
  row_table: string
  row_id: string
  organization_id: string | null
  prev_payload: Record<string, unknown> | null
  next_payload: Record<string, unknown> | null
  changed_by: string | null
  changed_at: string
}

// hse_audit_log scope — admin-touched tables that have an audit trigger.
const ADMIN_TABLES = [
  'organizations',
  'locations',
  'departments',
  'role_definitions',
  'role_permissions',
  'user_roles',
  'invitations',
  'org_integrations',
  'workflow_rules',
  'compliance_packs',
  'internal_packs',
  'compliance_checklist_templates',
  'document_org_template_settings',
  'meeting_org_template_settings',
  'survey_org_templates',
  'register_org_settings',
]

// studio_revisions scope — admin-touched template tables that
// capture changes through studio_capture_revision instead.
const STUDIO_TABLES = [
  'document_org_templates',
  'meeting_org_templates',
  'register_types',
  'learning_courses',
]

const TABLE_LABELS: Record<string, string> = {
  organizations: 'Organisasjon',
  locations: 'Lokasjon',
  departments: 'Avdeling',
  role_definitions: 'Rolle',
  role_permissions: 'Tilgang',
  user_roles: 'Brukerrolle',
  invitations: 'Invitasjon',
  org_integrations: 'Integrasjon',
  workflow_rules: 'Arbeidsflyt',
  compliance_packs: 'Mal-pakke',
  internal_packs: 'Intern pakke',
  compliance_checklist_templates: 'Sjekkliste-mal',
  document_org_template_settings: 'Dokumentmal-innstilling',
  meeting_org_template_settings: 'Møtemal-innstilling',
  survey_org_templates: 'Undersøkelses-mal',
  register_org_settings: 'Register-innstilling',
  document_org_templates: 'Dokumentmal',
  meeting_org_templates: 'Møtemal',
  register_types: 'Register',
  learning_courses: 'Kurs',
}

const ACTION_LABELS: Record<RawAuditRow['action'], string> = {
  INSERT: 'opprettet',
  UPDATE: 'oppdaterte',
  DELETE: 'slettet',
}

function describeHse(row: RawAuditRow): string {
  const label = TABLE_LABELS[row.table_name] ?? row.table_name
  const action = ACTION_LABELS[row.action]
  const data = (row.new_data ?? row.old_data ?? {}) as Record<string, unknown>
  const name = pickName(data)
  if (name) return `${label} «${name}» ${action}`
  if (row.changed_fields && row.changed_fields.length > 0) {
    return `${label} ${action} — endrede felter: ${row.changed_fields.slice(0, 4).join(', ')}`
  }
  return `${label} ${action}`
}

function describeStudio(row: StudioRevisionRow): { action: string; detail: string } {
  const label = TABLE_LABELS[row.row_table] ?? row.row_table
  const isInsert = row.prev_payload == null
  const isDelete = row.next_payload == null
  const action: RawAuditRow['action'] = isDelete
    ? 'DELETE'
    : isInsert
      ? 'INSERT'
      : 'UPDATE'
  const data = (row.next_payload ?? row.prev_payload ?? {}) as Record<string, unknown>
  const name = pickName(data)
  return {
    action: ACTION_LABELS[action],
    detail: name
      ? `${label} «${name}» ${ACTION_LABELS[action]}`
      : `${label} ${ACTION_LABELS[action]}`,
  }
}

function pickName(data: Record<string, unknown>): string | null {
  if (typeof data.name === 'string') return data.name
  if (typeof data.title === 'string') return data.title
  if (typeof data.label === 'string') return data.label
  if (typeof data.short_name === 'string') return data.short_name
  if (typeof data.display_name === 'string') return data.display_name
  if (typeof data.email === 'string') return data.email
  if (typeof data.kind === 'string') return data.kind
  if (typeof data.slug === 'string') return data.slug
  return null
}

const DEFAULT_PAGE_SIZE = 50

export interface AdminAuditResult {
  entries: AuditEntry[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
}

interface Cursor {
  changedAt: string
  id: string
}

interface UnifiedRow {
  id: string
  changed_at: string
  source: 'hse' | 'studio'
  payload: RawAuditRow | StudioRevisionRow
}

export function useAdminAudit(pageSize: number = DEFAULT_PAGE_SIZE): AdminAuditResult {
  const { supabase, organization } = useOrgSetupContext()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  // Composite cursor across both streams. Both tables order by
  // (changed_at desc, id desc) — the merge is stable on that key.
  const [cursor, setCursor] = useState<Cursor | null>(null)

  const fetchPage = useCallback(
    async (
      before: Cursor | null,
    ): Promise<{ rows: AuditEntry[]; nextCursor: Cursor | null }> => {
      if (!supabase || !organization?.id) return { rows: [], nextCursor: null }

      // Fetch pageSize+1 from each stream so the merged result has
      // enough breadth even when one stream is sparse.
      const fetchLimit = pageSize + 1

      let hseQ = supabase
        .from('hse_audit_log')
        .select('id, table_name, record_id, action, changed_by, changed_at, changed_fields, old_data, new_data')
        .eq('organization_id', organization.id)
        .in('table_name', ADMIN_TABLES)
        .order('changed_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(fetchLimit)
      if (before) {
        hseQ = hseQ.or(
          `changed_at.lt.${before.changedAt},and(changed_at.eq.${before.changedAt},id.lt.${before.id})`,
        )
      }

      let studioQ = supabase
        .from('studio_revisions')
        .select('id, row_table, row_id, organization_id, prev_payload, next_payload, changed_by, changed_at')
        .eq('organization_id', organization.id)
        .in('row_table', STUDIO_TABLES)
        .order('changed_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(fetchLimit)
      if (before) {
        studioQ = studioQ.or(
          `changed_at.lt.${before.changedAt},and(changed_at.eq.${before.changedAt},id.lt.${before.id})`,
        )
      }

      const [hseRes, studioRes] = await Promise.all([hseQ, studioQ])
      if (hseRes.error) throw hseRes.error
      // studio_revisions failures are non-fatal — the hse log is the
      // primary surface, studio_revisions is best-effort enrichment.
      const hseRows = (hseRes.data ?? []) as RawAuditRow[]
      const studioRows = (studioRes.error
        ? []
        : (studioRes.data ?? [])) as StudioRevisionRow[]

      // Merge-sort the two streams.
      const unified: UnifiedRow[] = [
        ...hseRows.map((r) => ({
          id: r.id,
          changed_at: r.changed_at,
          source: 'hse' as const,
          payload: r,
        })),
        ...studioRows.map((r) => ({
          id: r.id,
          changed_at: r.changed_at,
          source: 'studio' as const,
          payload: r,
        })),
      ].sort((a, b) => {
        if (a.changed_at !== b.changed_at) return a.changed_at < b.changed_at ? 1 : -1
        return a.id < b.id ? 1 : -1
      })

      const hasMorePages = unified.length > pageSize
      const page = hasMorePages ? unified.slice(0, pageSize) : unified

      // Resolve user names. One round-trip across both streams.
      const userIds = Array.from(
        new Set(
          page
            .map((u) =>
              u.source === 'hse'
                ? (u.payload as RawAuditRow).changed_by
                : (u.payload as StudioRevisionRow).changed_by,
            )
            .filter((x): x is string => !!x),
        ),
      )
      const userMap = new Map<string, string>()
      if (userIds.length > 0) {
        const profRes = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .in('id', userIds)
        if (!profRes.error && profRes.data) {
          for (const p of profRes.data as {
            id: string
            display_name: string
            email: string | null
          }[]) {
            userMap.set(p.id, p.display_name || p.email || 'Ukjent')
          }
        }
      }

      const rows: AuditEntry[] = page.map((u) => {
        if (u.source === 'hse') {
          const r = u.payload as RawAuditRow
          return {
            id: `hse-${r.id}`,
            when: formatDateTime(r.changed_at),
            who: r.changed_by ? userMap.get(r.changed_by) ?? 'System' : 'System',
            action: ACTION_LABELS[r.action] ?? r.action,
            detail: describeHse(r),
            table: TABLE_LABELS[r.table_name] ?? r.table_name,
          }
        }
        const r = u.payload as StudioRevisionRow
        const desc = describeStudio(r)
        return {
          id: `studio-${r.id}`,
          when: formatDateTime(r.changed_at),
          who: r.changed_by ? userMap.get(r.changed_by) ?? 'System' : 'System',
          action: desc.action,
          detail: desc.detail,
          table: TABLE_LABELS[r.row_table] ?? r.row_table,
        }
      })

      const last = page[page.length - 1]
      const nextCursor: Cursor | null =
        hasMorePages && last
          ? { changedAt: last.changed_at, id: last.id }
          : null
      return { rows, nextCursor }
    },
    [supabase, organization?.id, pageSize],
  )

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const { rows, nextCursor } = await fetchPage(null)
      setEntries(rows)
      setCursor(nextCursor)
      setHasMore(nextCursor != null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste audit-logg')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id, fetchPage])

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const { rows, nextCursor } = await fetchPage(cursor)
      setEntries((prev) => [...prev, ...rows])
      setCursor(nextCursor)
      setHasMore(nextCursor != null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste flere oppføringer')
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore, fetchPage])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { entries, loading, loadingMore, error, hasMore, refresh, loadMore }
}
