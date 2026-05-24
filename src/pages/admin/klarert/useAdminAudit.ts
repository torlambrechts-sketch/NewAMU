// Loads admin-relevant audit entries from `hse_audit_log` with
// cursor-style pagination. Source tables are the ones the admin shell
// can mutate (org settings, roles, integrations, workflow_rules, etc.).

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
  'document_org_template_settings',
  'meeting_org_template_settings',
  'survey_org_templates',
  'register_org_settings',
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
  document_org_template_settings: 'Dokumentmal',
  meeting_org_template_settings: 'Møtemal',
  survey_org_templates: 'Undersøkelses-mal',
  register_org_settings: 'Register-innstilling',
}

const ACTION_LABELS: Record<RawAuditRow['action'], string> = {
  INSERT: 'opprettet',
  UPDATE: 'oppdaterte',
  DELETE: 'slettet',
}

function describeDetail(row: RawAuditRow): string {
  const label = TABLE_LABELS[row.table_name] ?? row.table_name
  const action = ACTION_LABELS[row.action]
  const data = (row.new_data ?? row.old_data ?? {}) as Record<string, unknown>
  const name =
    typeof data.name === 'string'
      ? data.name
      : typeof data.short_name === 'string'
        ? data.short_name
        : typeof data.display_name === 'string'
          ? data.display_name
          : typeof data.email === 'string'
            ? data.email
            : typeof data.kind === 'string'
              ? data.kind
              : typeof data.slug === 'string'
                ? data.slug
                : null
  if (name) return `${label} «${name}» ${action}`
  if (row.changed_fields && row.changed_fields.length > 0) {
    return `${label} ${action} — endrede felter: ${row.changed_fields.slice(0, 4).join(', ')}`
  }
  return `${label} ${action}`
}

// Re-exported for symmetry with the other admin sections.
const formatWhen = (iso: string) => formatDateTime(iso)

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

export function useAdminAudit(pageSize: number = DEFAULT_PAGE_SIZE): AdminAuditResult {
  const { supabase, organization } = useOrgSetupContext()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  // Composite cursor — see fetchPage for why id is required.
  const [cursor, setCursor] = useState<{ changedAt: string; id: string } | null>(null)

  const fetchPage = useCallback(
    async (
      before: { changedAt: string; id: string } | null,
    ): Promise<{ rows: AuditEntry[]; nextCursor: { changedAt: string; id: string } | null }> => {
      if (!supabase || !organization?.id) return { rows: [], nextCursor: null }
      let q = supabase
        .from('hse_audit_log')
        .select('id, table_name, record_id, action, changed_by, changed_at, changed_fields, old_data, new_data')
        .eq('organization_id', organization.id)
        .in('table_name', ADMIN_TABLES)
        // Composite ordering — id breaks ties when multiple rows share
        // a `changed_at` timestamp (audit rows batched in the same
        // transaction land on the same microsecond). Without the id
        // tie-breaker, cursor-paging silently skipped those rows.
        .order('changed_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(pageSize + 1) // one extra row so we can detect more pages
      if (before) {
        // (changed_at, id) < (before.changedAt, before.id), expressed as the
        // OR-form Postgres needs: either earlier timestamp OR same
        // timestamp with smaller id (descending id within same ts).
        q = q.or(
          `changed_at.lt.${before.changedAt},and(changed_at.eq.${before.changedAt},id.lt.${before.id})`,
        )
      }
      const { data, error: e } = await q
      if (e) throw e
      const all = (data ?? []) as RawAuditRow[]
      const hasMorePages = all.length > pageSize
      const page = hasMorePages ? all.slice(0, pageSize) : all

      const userIds = Array.from(
        new Set(page.map((r) => r.changed_by).filter((x): x is string => !!x)),
      )
      const userMap = new Map<string, string>()
      if (userIds.length > 0) {
        const profRes = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .in('id', userIds)
        if (!profRes.error && profRes.data) {
          for (const p of profRes.data as { id: string; display_name: string; email: string | null }[]) {
            userMap.set(p.id, p.display_name || p.email || 'Ukjent')
          }
        }
      }

      const rows: AuditEntry[] = page.map((r) => ({
        id: r.id,
        when: formatWhen(r.changed_at),
        who: r.changed_by ? userMap.get(r.changed_by) ?? 'System' : 'System',
        action: ACTION_LABELS[r.action] ?? r.action,
        detail: describeDetail(r),
        table: TABLE_LABELS[r.table_name] ?? r.table_name,
      }))
      const last = page[page.length - 1]
      const nextCursor =
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
