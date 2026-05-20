import { Check, GitMerge, RotateCcw, Trash2, X } from 'lucide-react'
import type { WikiCommentEvent } from '../../types/documents'

/**
 * Comment lifecycle change log (Claude Design "Rec06 — Forslag / sporing av
 * endringer"). Renders the append-only wiki_comment_events feed — one entry
 * per resolve / reopen / acknowledge / accept / reject / delete.
 */

const EVENT_META: Record<
  WikiCommentEvent['event'],
  { label: string; icon: typeof Check; tone: string }
> = {
  resolved: { label: 'løste en kommentar', icon: Check, tone: 'text-emerald-700 bg-emerald-50' },
  reopened: { label: 'gjenåpnet en kommentar', icon: RotateCcw, tone: 'text-amber-700 bg-amber-50' },
  acknowledged: { label: 'bekreftet en kommentar', icon: Check, tone: 'text-[#0f766e] bg-[#e6f2f0]' },
  accepted: { label: 'godtok et forslag', icon: GitMerge, tone: 'text-emerald-700 bg-emerald-50' },
  rejected: { label: 'avviste et forslag', icon: X, tone: 'text-red-700 bg-red-50' },
  deleted: { label: 'slettet en kommentar', icon: Trash2, tone: 'text-neutral-600 bg-neutral-100' },
}

export function WikiCommentEventLog({ events }: { events: WikiCommentEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Ingen sporede endringer ennå. Når en kommentar løses, gjenåpnes eller slettes, logges det her.
      </p>
    )
  }
  return (
    <ul className="space-y-2.5">
      {events.map((e) => {
        const meta = EVENT_META[e.event]
        const Icon = meta.icon
        return (
          <li key={e.id} className="flex items-start gap-2.5">
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-neutral-800">
                <span className="font-semibold">{e.actorName}</span> {meta.label}
              </p>
              <p className="text-[11px] text-neutral-500">
                {new Date(e.createdAt).toLocaleString('nb-NO', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {e.note ? ` · ${e.note}` : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
