// Top-level Endringslogg panel. Pass either:
//   - `entityKind` + `entityId` to fetch from audit_events_read, OR
//   - `events` directly (storybook / demo mode).
//
// Renders day-grouped event rows. Loading / empty / error / no-access
// states from spec §6.3.

import { useCallback, useMemo, useRef, useState } from 'react'
import { Loader2, History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditEvent } from '../../lib/audit/diffShape'
import { useEntityTimeline, groupEventsByDay } from '../../lib/audit/useEntityTimeline'
import { readPermalinkEventId } from '../../lib/audit/permalink'
import { getAuditScope } from '../../lib/audit/auditRegistry'
import { Button } from '../ui/Button'
import { EntityTimelineRow } from './EntityTimelineRow'

type LiveProps = {
  supabase: SupabaseClient | null
  entityKind: string
  entityId: string
  /** Defaults to entity_kind. Used to look up the scope label / accent
   *  from the registry. Pass when the entity belongs to a scope whose
   *  registry key isn't its own kind (rare). */
  scopeId?: string
  events?: never
}

type StaticProps = {
  supabase?: never
  entityKind?: never
  entityId?: never
  events: AuditEvent[]
}

export type EntityTimelineProps = (LiveProps | StaticProps) & {
  /** Optional accent for the panel header. Defaults to compliance green. */
  accent?: string
  /** Hide the panel header when embedded inside an already-titled container. */
  hideHeader?: boolean
}

export function EntityTimeline(props: EntityTimelineProps) {
  const { t } = useTranslation()
  const accent = props.accent ?? '#1a3d32'
  const isLive = 'supabase' in props && props.supabase !== undefined

  return (
    <aside
      className="flex h-full min-h-[280px] flex-col rounded-lg border border-neutral-200 bg-white"
      aria-label={t('endringslogg.title', 'Endringslogg')}
    >
      {props.hideHeader ? null : (
        <header className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white"
            style={{ backgroundColor: accent }}
            aria-hidden
          >
            <History className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-neutral-900">
            {t('endringslogg.title', 'Endringslogg')}
          </h2>
        </header>
      )}
      <div className="flex-1 overflow-auto p-3">
        {isLive ? (
          <LiveBody
            supabase={props.supabase as SupabaseClient | null}
            entityKind={props.entityKind as string}
            entityId={props.entityId as string}
            scopeId={(props as LiveProps).scopeId}
          />
        ) : (
          <StaticBody events={(props as StaticProps).events} />
        )}
      </div>
    </aside>
  )
}

function LiveBody({
  supabase,
  entityKind,
  entityId,
  scopeId,
}: {
  supabase: SupabaseClient | null
  entityKind: string
  entityId: string
  scopeId?: string
}) {
  // Warn loudly when a consumer renders for an unregistered scope —
  // R7 mitigation from spec §11. Side-effect import was probably missed.
  const effectiveScopeId = scopeId ?? entityKind
  if (typeof window !== 'undefined' && !getAuditScope(effectiveScopeId)) {
    console.warn(
      `[EntityTimeline] No AuditScope registered for "${effectiveScopeId}". ` +
        `Add a side-effect import of the module's audit-scope file before this component mounts.`,
    )
  }
  const { events, loading, error, reload } = useEntityTimeline({ supabase, entityKind, entityId })
  return <Body events={events} loading={loading} error={error} reload={reload} />
}

function StaticBody({ events }: { events: AuditEvent[] }) {
  return <Body events={events} loading={false} error={null} reload={undefined} />
}

function Body({
  events,
  loading,
  error,
  reload,
}: {
  events: AuditEvent[]
  loading: boolean
  error: string | null
  reload?: () => Promise<void>
}) {
  const { t } = useTranslation()
  // Lazy init reads window.location once at mount, no effect needed.
  const [highlightId] = useState<string | null>(() => readPermalinkEventId())
  const listRef = useRef<HTMLDivElement | null>(null)

  const groups = useMemo(() => groupEventsByDay(events), [events])

  // Roving focus: ↑/↓ move between rows, Esc collapses focused row.
  // Implemented at the container so we don't have to hand-roll a
  // per-row ref dance. Walks the toggle buttons that EntityTimelineRow
  // renders (they have aria-controls + aria-expanded attrs).
  const onKeyDown = useCallback((evt: React.KeyboardEvent<HTMLDivElement>) => {
    if (evt.key !== 'ArrowDown' && evt.key !== 'ArrowUp' && evt.key !== 'Escape') return
    const root = listRef.current
    if (!root) return
    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('button[aria-controls][aria-expanded]'),
    )
    const active = document.activeElement
    const idx = active instanceof HTMLElement ? buttons.indexOf(active as HTMLButtonElement) : -1
    if (evt.key === 'ArrowDown') {
      const next = buttons[idx + 1] ?? buttons[0]
      if (next) {
        evt.preventDefault()
        next.focus()
      }
    } else if (evt.key === 'ArrowUp') {
      const prev = buttons[idx - 1] ?? buttons[buttons.length - 1]
      if (prev) {
        evt.preventDefault()
        prev.focus()
      }
    } else if (evt.key === 'Escape') {
      // Only collapse if the focused row is currently expanded.
      if (active instanceof HTMLButtonElement && active.getAttribute('aria-expanded') === 'true') {
        evt.preventDefault()
        active.click()
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span>Laster…</span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-neutral-600">
        <p>{t('endringslogg.loadError', 'Klarte ikke laste endringsloggen. Prøv igjen.')}</p>
        {reload ? (
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            {t('endringslogg.retry', 'Prøv igjen')}
          </Button>
        ) : null}
      </div>
    )
  }
  if (events.length === 0) {
    return (
      <p className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-sm italic text-neutral-500">
        {t('endringslogg.emptyState', 'Ingen hendelser ennå. Endringer logges automatisk.')}
      </p>
    )
  }

  return (
    <div ref={listRef} className="space-y-5" onKeyDown={onKeyDown}>
      {groups.map((group) => (
        <section key={group.dayKey} aria-label={group.dayLabel}>
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            {group.dayLabel}
          </p>
          <ol className="space-y-1" aria-label={t('endringslogg.title', 'Endringslogg')}>
            {group.events.map((ev, idx) => (
              <EntityTimelineRow
                key={ev.id}
                event={ev}
                isLast={idx === group.events.length - 1}
                highlighted={ev.id === highlightId}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
