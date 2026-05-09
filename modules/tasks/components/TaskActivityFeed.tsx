// TaskActivityFeed — read-only audit trail from task_activity_log.
// INSERT-only RLS means no row can be altered after creation.

import { useCallback, useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'

type ActivityEntry = {
  id: string
  action: string
  actorName: string
  payload: Record<string, unknown>
  createdAt: string
}

type Props = { taskItemId: string }

const ACTION_LABEL: Record<string, string> = {
  status_change: 'Status endret',
  comment_added: 'Kommentar lagt til',
  subtask_done: 'Deloppgave fullført',
  subtask_added: 'Deloppgave lagt til',
  evidence_added: 'Bevis lagt til',
  assignee_changed: 'Tildeling endret',
  reviewer_assigned: 'Gjennomgåer tildelt',
  approved: 'Godkjent',
  reviewed: 'Gjennomgått',
  vo_notified: 'Verneombud varslet',
  amu_notified: 'AMU varslet',
  arbeidstilsynet_notified: 'Arbeidstilsynet varslet',
  created: 'Oppgave opprettet',
  deleted: 'Slettet',
  field_updated: 'Felt oppdatert',
}

function fmtTs(s: string) {
  try {
    return new Date(s).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return s
  }
}

function describe(entry: ActivityEntry): string {
  const { action, payload } = entry
  if (action === 'status_change') {
    const from = payload.from_status as string | undefined
    const to = payload.to_status as string | undefined
    if (from && to) return `${from} → ${to}`
  }
  if (action === 'subtask_done') {
    return payload.subtask_title ? String(payload.subtask_title) : ''
  }
  return ''
}

export function TaskActivityFeed({ taskItemId }: Props) {
  const { supabase } = useOrgSetupContext()
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('task_activity_log')
      .select('id, action, actor_name, payload, created_at')
      .eq('task_item_id', taskItemId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) {
      setEntries(
        data.map((r) => ({
          id: String(r.id),
          action: String(r.action ?? ''),
          actorName: String(r.actor_name ?? 'System'),
          payload: (r.payload ?? {}) as Record<string, unknown>,
          createdAt: String(r.created_at),
        })),
      )
    }
  }, [supabase, taskItemId])

  useEffect(() => {
    void load()
  }, [load])

  const visible = showAll ? entries : entries.slice(0, 8)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-neutral-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Aktivitetslogg {entries.length > 0 ? `· ${entries.length}` : ''}
        </span>
      </div>

      {entries.length === 0 && (
        <p className="text-xs text-neutral-400">Ingen aktivitet registrert ennå.</p>
      )}

      {entries.length > 0 && (
        <ol className="relative border-l border-neutral-200 pl-4 space-y-3">
          {visible.map((e) => {
            const detail = describe(e)
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[1.35rem] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-neutral-200 bg-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                </span>
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-medium text-neutral-800">
                      {ACTION_LABEL[e.action] ?? e.action}
                    </span>
                    {detail && (
                      <span className="text-xs text-neutral-500">{detail}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    {e.actorName} · {fmtTs(e.createdAt)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {entries.length > 8 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-neutral-500 underline-offset-2 hover:text-neutral-700 hover:underline"
        >
          {showAll ? 'Vis færre' : `Vis alle ${entries.length} hendelser`}
        </button>
      )}
    </div>
  )
}
