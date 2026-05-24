// Loads the most recent admin-relevant audit entries for the
// Audit-log section. Source: `hse_audit_log` filtered to tables that
// the admin shell can mutate (org settings, roles, integrations,
// workflow_rules, compliance_packs).

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
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

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export interface AdminAuditResult {
  entries: AuditEntry[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useAdminAudit(limit = 50): AdminAuditResult {
  const { supabase, organization } = useOrgSetupContext()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('hse_audit_log')
        .select('id, table_name, record_id, action, changed_by, changed_at, changed_fields, old_data, new_data')
        .eq('organization_id', organization.id)
        .in('table_name', ADMIN_TABLES)
        .order('changed_at', { ascending: false })
        .limit(limit)
      if (e) throw e
      const rows = (data ?? []) as RawAuditRow[]

      const userIds = Array.from(
        new Set(rows.map((r) => r.changed_by).filter((x): x is string => !!x)),
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

      setEntries(
        rows.map((r) => ({
          id: r.id,
          when: formatWhen(r.changed_at),
          who: r.changed_by ? userMap.get(r.changed_by) ?? 'System' : 'System',
          action: ACTION_LABELS[r.action] ?? r.action,
          detail: describeDetail(r),
          table: TABLE_LABELS[r.table_name] ?? r.table_name,
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste audit-logg')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id, limit])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { entries, loading, error, refresh }
}
