// Audit log card on the register-detail page. Reads
// register_record_revisions for records in the current type, joins
// to profiles to surface the actor name, and renders the latest 10
// changes with appropriate icons.
//
// The revisions table is already RLS-protected: members can read
// only revisions for records in their org.

import { useEffect, useMemo, useState } from 'react'
import { FileEdit, History, Plus, RefreshCw, AlertCircle, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type AuditEntry = {
  id: string
  when: string
  actorName: string
  action: string
  detail: string
  tone: 'success' | 'warning' | 'neutral'
  icon: 'Plus' | 'FileEdit' | 'AlertCircle' | 'RefreshCw' | 'Trash2'
}

type Props = {
  registerTypeId: string
  /** Easy mode hides the detail body row. */
  easy?: boolean
  /** How many entries to surface (default 10). */
  limit?: number
}

export function RegisterAuditLogCard({ registerTypeId, easy = false, limit = 10 }: Props) {
  const orgSetup = useOrgSetupContext()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = orgSetup.supabase
    const orgId = orgSetup.organization?.id ?? null
    if (!supabase || !orgId || !registerTypeId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        // 1. Pull recent revisions for records that belong to this type.
        const { data: revs, error: e1 } = await supabase
          .from('register_record_revisions')
          .select(
            'id, changed_at, changed_by, values_before, values_after, status_before, status_after, record_id, register_records!inner(register_type_id, organization_id)',
          )
          .eq('register_records.register_type_id', registerTypeId)
          .eq('register_records.organization_id', orgId)
          .order('changed_at', { ascending: false })
          .limit(limit)
        if (e1) throw e1

        // 2. Resolve actor display names (best-effort — RLS may hide rows).
        const actorIds = Array.from(
          new Set(
            (revs ?? [])
              .map((r) => (r as { changed_by: string | null }).changed_by)
              .filter((x): x is string => typeof x === 'string'),
          ),
        )
        let actorById = new Map<string, string>()
        if (actorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', actorIds)
          for (const p of (profiles ?? []) as { id: string; display_name: string }[]) {
            actorById.set(p.id, p.display_name)
          }
        }

        if (cancelled) return
        setEntries(
          (revs ?? []).map((row) => {
            const r = row as {
              id: string
              changed_at: string
              changed_by: string | null
              values_before: Record<string, unknown>
              values_after: Record<string, unknown>
              status_before: string | null
              status_after: string | null
            }
            const isCreate = isEmptyJson(r.values_before)
            const statusChanged = r.status_before !== r.status_after
            const actor =
              (r.changed_by ? actorById.get(r.changed_by) : null) ??
              (r.changed_by ? 'Bruker' : 'System')
            const action = isCreate
              ? 'opprettet'
              : statusChanged
                ? `endret status til «${labelStatus(r.status_after)}»`
                : 'oppdaterte'
            const detail = isCreate
              ? `Opprettet ny rad #${r.id.slice(0, 6)}`
              : summariseDiff(r.values_before, r.values_after)
            const tone: AuditEntry['tone'] = isCreate
              ? 'success'
              : statusChanged && r.status_after === 'archived'
                ? 'neutral'
                : 'warning'
            const icon: AuditEntry['icon'] = isCreate
              ? 'Plus'
              : r.changed_by === null
                ? 'RefreshCw'
                : 'FileEdit'
            return {
              id: r.id,
              when: formatWhen(r.changed_at),
              actorName: actor,
              action,
              detail,
              tone,
              icon,
            }
          }),
        )
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Kunne ikke laste auditlogg')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orgSetup, registerTypeId, limit])

  const items = useMemo(() => entries, [entries])

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-900">Audit-logg</h3>
      {error ? (
        <p className="mt-3 text-xs text-red-700">{error}</p>
      ) : loading && items.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">Laster auditlogg …</p>
      ) : items.length === 0 ? (
        <p className="mt-3 rounded border border-dashed border-neutral-200 px-3 py-4 text-center text-[11px] text-neutral-500">
          Ingen hendelser for dette registeret ennå.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-2 rounded-md border border-neutral-200/80 bg-[#fbf9f3]/60 p-2.5"
            >
              <span
                className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                  a.tone === 'success'
                    ? 'bg-green-100 text-green-700'
                    : a.tone === 'warning'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-neutral-100 text-neutral-600',
                ].join(' ')}
              >
                <AuditIcon name={a.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-semibold text-neutral-900">{a.actorName}</span>{' '}
                    <span className="text-neutral-500">{a.action}</span>
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-neutral-400">
                    {a.when}
                  </span>
                </div>
                {!easy ? <p className="mt-0.5 text-[11px] text-neutral-700">{a.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      <Button
        variant="ghost"
        size="sm"
        icon={<History className="h-3 w-3" />}
        className="mt-3"
        type="button"
        onClick={() => {
          /* Future: open a full audit log dialog. */
        }}
      >
        Se hele loggen
      </Button>
    </div>
  )
}

function AuditIcon({ name }: { name: AuditEntry['icon'] }) {
  if (name === 'Plus') return <Plus className="h-3.5 w-3.5" />
  if (name === 'FileEdit') return <FileEdit className="h-3.5 w-3.5" />
  if (name === 'AlertCircle') return <AlertCircle className="h-3.5 w-3.5" />
  if (name === 'RefreshCw') return <RefreshCw className="h-3.5 w-3.5" />
  return <Trash2 className="h-3.5 w-3.5" />
}

function isEmptyJson(v: Record<string, unknown>): boolean {
  return !v || Object.keys(v).length === 0
}

function summariseDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const changed: string[] = []
  for (const k of keys) {
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) changed.push(k)
  }
  if (changed.length === 0) return 'Ingen feltendringer'
  if (changed.length === 1) return `Endret feltet «${changed[0]}»`
  if (changed.length <= 3) return `Endret feltene ${changed.map((k) => `«${k}»`).join(', ')}`
  return `Endret ${changed.length} felter`
}

function labelStatus(s: string | null): string {
  if (s === 'active') return 'Aktiv'
  if (s === 'draft') return 'Utkast'
  if (s === 'archived') return 'Arkivert'
  return s ?? '—'
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(2)
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${yy} ${hh}:${mi}`
}
