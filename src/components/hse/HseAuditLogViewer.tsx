import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'

export interface HseAuditLogViewerProps {
  supabase: SupabaseClient | null
  recordId: string
  /** When set, only rows for this table; otherwise all tables matching `record_id`. */
  tableName?: string
  /** Max rows to load (newest first). */
  maxRows?: number
}

type AuditRow = {
  id: string
  organization_id: string
  table_name: string
  record_id: string
  action: string
  changed_by: string | null
  changed_at: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_fields: string[] | null
}

const NOISE_FIELDS = new Set(['updated_at', 'changed_at'])

const ACTION_BADGE: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-800 border-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
  DELETE: 'bg-red-100 text-red-800 border-red-200',
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'medium' })
  } catch {
    return iso
  }
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function filterChangedFields(fields: string[] | null | undefined): string[] {
  if (!fields?.length) return []
  return fields.filter((f) => !NOISE_FIELDS.has(f))
}

function shallowDiffKeys(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): string[] {
  const keys = new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])
  return [...keys]
    .filter((k) => {
      if (NOISE_FIELDS.has(k)) return false
      const a = oldData?.[k]
      const b = newData?.[k]
      return JSON.stringify(a) !== JSON.stringify(b)
    })
    .sort()
}

function diffKeysForEntry(entry: AuditRow): string[] {
  if (entry.action === 'UPDATE') {
    const fromList = filterChangedFields(entry.changed_fields ?? undefined)
    if (fromList.length > 0) return fromList
    return shallowDiffKeys(entry.old_data, entry.new_data)
  }
  if (entry.action === 'INSERT') {
    return Object.keys(entry.new_data ?? {})
      .filter((k) => !NOISE_FIELDS.has(k))
      .sort()
  }
  if (entry.action === 'DELETE') {
    return Object.keys(entry.old_data ?? {})
      .filter((k) => !NOISE_FIELDS.has(k))
      .sort()
  }
  return []
}

export function HseAuditLogViewer({
  supabase,
  recordId,
  tableName,
  maxRows = 50,
}: HseAuditLogViewerProps) {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [profiles, setProfiles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    try {
      let q = supabase
        .from('hse_audit_log')
        .select('*')
        .eq('record_id', recordId)
        .order('changed_at', { ascending: false })
        .limit(maxRows)
      if (tableName) q = q.eq('table_name', tableName)
      const { data, error: qErr } = await q
      if (qErr) throw qErr
      const list = (data ?? []) as AuditRow[]
      setRows(list)

      const ids = [...new Set(list.map((r) => r.changed_by).filter(Boolean))] as string[]
      if (ids.length === 0) {
        setProfiles({})
        return
      }
      const { data: profRows, error: pErr } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ids)
      if (pErr) {
        setProfiles({})
        return
      }
      const map: Record<string, string> = {}
      for (const p of profRows ?? []) {
        const id = typeof (p as { id?: string }).id === 'string' ? (p as { id: string }).id : ''
        if (!id) continue
        const dn = (p as { display_name?: string | null }).display_name
        map[id] = dn?.trim() || id
      }
      setProfiles(map)
    } catch (e) {
      setRows([])
      setError(e instanceof Error ? e.message : 'Kunne ikke laste revisjonslogg.')
    } finally {
      setLoading(false)
    }
  }, [supabase, recordId, tableName, maxRows])

  useEffect(() => {
    void load()
  }, [load])

  const actorLabel = useCallback(
    (changedBy: string | null) => {
      if (!changedBy) return 'Systemtrigger'
      return profiles[changedBy] ?? changedBy
    },
    [profiles],
  )

  return (
    <div className="px-5 py-4">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Laster historikk…
        </div>
      )}
      {!loading && rows.length === 0 && !error && (
        <p className="text-sm text-neutral-500">Ingen loggføringer for denne posten.</p>
      )}
      {!loading && rows.length > 0 && (
        <ol className="relative space-y-6 border-l border-neutral-200 pl-5">
          {rows.map((entry) => {
            const badgeClass = ACTION_BADGE[entry.action] ?? 'bg-neutral-100 text-neutral-700 border-neutral-200'
            const tagFields = filterChangedFields(entry.changed_fields)
            const diffKeys = diffKeysForEntry(entry)
            const isOpen = expandedId === entry.id

            return (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[calc(0.625rem+1px)] top-1.5 size-2.5 rounded-full border border-neutral-300 bg-white" />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-neutral-500">{formatTs(entry.changed_at)}</p>
                    <p className="mt-0.5 text-sm text-neutral-800">
                      Aktør:{' '}
                      <span className="font-medium">{actorLabel(entry.changed_by)}</span>
                    </p>
                  </div>
                  <span
                    className={`rounded border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${badgeClass}`}
                  >
                    {entry.action}
                  </span>
                </div>
                {entry.action === 'UPDATE' && tagFields.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tagFields.map((f) => (
                      <span
                        key={f}
                        className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                {diffKeys.length > 0 && (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1a3d32] hover:underline"
                    onClick={() => setExpandedId(isOpen ? null : entry.id)}
                  >
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    Vis detaljer
                  </button>
                )}
                {isOpen && diffKeys.length > 0 && (
                  <div className="mt-3 overflow-x-auto rounded border border-neutral-200 bg-white">
                    <table className="w-full min-w-[280px] border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50">
                          <th className="px-2 py-1.5 font-semibold text-neutral-700">Felt</th>
                          <th className="px-2 py-1.5 font-semibold text-neutral-700">Før</th>
                          <th className="px-2 py-1.5 font-semibold text-neutral-700">Etter</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffKeys.map((key) => {
                          const oldVal = entry.old_data?.[key]
                          const newVal = entry.new_data?.[key]
                          return (
                            <tr key={key} className="border-b border-neutral-100 last:border-0">
                              <td className="px-2 py-1.5 font-mono text-[11px] text-neutral-800">{key}</td>
                              <td className="max-w-[40%] break-words px-2 py-1.5 text-neutral-600">
                                {formatCell(oldVal)}
                              </td>
                              <td className="max-w-[40%] break-words px-2 py-1.5 text-neutral-900">
                                {formatCell(newVal)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
