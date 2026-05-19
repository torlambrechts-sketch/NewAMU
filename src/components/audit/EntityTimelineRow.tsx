// One event row — collapsed by default, click to expand.
// Spec §2 (collapsed anatomy) + §4 (expanded diff renderers).

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { twMerge } from 'tailwind-merge'
import type { AuditEvent } from '../../lib/audit/diffShape'
import { EntityTimelineActionChip } from './EntityTimelineActionChip'
import { railDotClass } from './entityTimelineActionTone'
import { EntityTimelineActor } from './EntityTimelineActor'
import { DiffSingleField } from './diff/DiffSingleField'
import { DiffMultiField } from './diff/DiffMultiField'
import { DiffTextBlock } from './diff/DiffTextBlock'
import { DiffNullCard } from './diff/DiffNullCard'
import { copyEventPermalink } from '../../lib/audit/permalink'
import { Button } from '../ui/Button'

function relativeTime(iso: string, t: ReturnType<typeof useTranslation>['t']): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.max(0, Math.round((now - then) / 1000))
  if (diffSec < 90) return t('endringslogg.relativeJustNow', 'akkurat nå')
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return t('endringslogg.relativeMinutes', { count: diffMin, defaultValue: `for ${diffMin} minutter siden` })
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return t('endringslogg.relativeHours', { count: diffHr, defaultValue: `for ${diffHr} timer siden` })
  const diffDay = Math.round(diffHr / 24)
  return t('endringslogg.relativeDays', { count: diffDay, defaultValue: `for ${diffDay} dager siden` })
}

function absoluteTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export type EntityTimelineRowProps = {
  event: AuditEvent
  /** Render last-in-day with no continuing rail segment. */
  isLast?: boolean
  /** Highlight when this is the deep-linked event. */
  highlighted?: boolean
}

export function EntityTimelineRow({ event, isLast = false, highlighted = false }: EntityTimelineRowProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<boolean>(highlighted)
  const [copied, setCopied] = useState<boolean>(false)
  const detailsId = useId()
  const rowRef = useRef<HTMLLIElement | null>(null)

  // Scroll-into-view when this row is the permalink target. Once only.
  useEffect(() => {
    if (highlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasDiff = event.diff != null
  const dotClass = railDotClass(event.action)

  const onCopyLink = async () => {
    const ok = await copyEventPermalink(event.id)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <li
      ref={rowRef}
      className={twMerge(
        'group relative pl-7',
        highlighted ? 'rounded-md ring-2 ring-indigo-300' : null,
      )}
    >
      {/* Rail (vertical line) + dot */}
      <span
        className={twMerge(
          'absolute left-2 top-1.5 h-2 w-2 rounded-full transition-all motion-reduce:transition-none',
          dotClass,
          expanded ? 'h-2.5 w-2.5' : 'group-hover:h-2.5 group-hover:w-2.5',
        )}
        aria-hidden
      />
      {!isLast ? (
        <span
          className="absolute left-[9px] top-4 w-0.5 bg-neutral-300"
          style={{ bottom: '-12px' }}
          aria-hidden
        />
      ) : null}

      {/* Row body — wide row-toggle; Button's centred layout doesn't fit
          this use case (we need left-aligned summary + right-aligned
          chevron), so we use a native button with explicit a11y. */}
      {/* eslint-disable-next-line no-restricted-syntax -- wide row toggle, no Button variant covers this */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-controls={detailsId}
        aria-expanded={expanded}
        className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
      >
        <div className="flex items-start gap-2.5">
          <EntityTimelineActor actor={event.actor} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-neutral-900">
              <span className="font-semibold">{event.actor.name}</span>{' '}
              <span className="text-neutral-700">{stripActorPrefix(event.summary_nb, event.actor.name)}</span>
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
              <EntityTimelineActionChip action={event.action} />
              <span title={absoluteTimestamp(event.occurred_at)}>{relativeTime(event.occurred_at, t)}</span>
              {event.location ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{event.location}</span>
                </>
              ) : null}
              {event.privileged ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <AlertTriangle className="h-3 w-3" aria-hidden /> privilegert
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <ChevronDown
            className={twMerge(
              'mt-1 h-4 w-4 shrink-0 text-neutral-400 transition-transform motion-reduce:transition-none',
              expanded ? 'rotate-180' : '',
            )}
            aria-hidden
          />
        </div>
      </button>

      {/* Expanded body */}
      {expanded ? (
        <div id={detailsId} className="mt-2 ml-9 mr-2 mb-3 space-y-3">
          {event.diff?.kind === 'single_field' ? <DiffSingleField diff={event.diff} /> : null}
          {event.diff?.kind === 'multi_field' ? <DiffMultiField diff={event.diff} /> : null}
          {event.diff?.kind === 'text_block' ? <DiffTextBlock diff={event.diff} /> : null}
          {!hasDiff ? (
            <DiffNullCard
              action={event.action}
              summary={event.summary_nb}
              detail={event.actor.external_label ?? undefined}
            />
          ) : null}
          {event.diff?.kind === 'list_change' ? (
            // P3 — list_change renderer pending. Show the field name and
            // the +/− counts so the row still carries usable signal.
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
              <p className="font-semibold uppercase tracking-wider text-neutral-500">
                {event.diff.field_label_nb}
              </p>
              <p className="mt-1">
                +{event.diff.added.length} lagt til · −{event.diff.removed.length} fjernet
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopyLink}
              className="px-2 text-xs font-medium text-neutral-600 hover:text-neutral-900"
            >
              {copied
                ? t('endringslogg.copyPermalinkDone', 'Permalink kopiert')
                : t('endringslogg.copyPermalink', 'Kopier permalink')}
            </Button>
            <span className="text-[11px] text-neutral-400" title={absoluteTimestamp(event.occurred_at)}>
              {absoluteTimestamp(event.occurred_at)}
            </span>
          </div>
        </div>
      ) : null}
    </li>
  )
}

// Server pre-renders summary_nb with the actor's display name as the
// subject. When the row also shows the bolded name + chip, leading
// "<Name> " in the summary becomes a redundant duplicate; strip it for
// cleaner reading. Falls back to the full string when the name is not
// the prefix (literal-template overrides).
function stripActorPrefix(summary: string, actorName: string): string {
  const expected = `${actorName} `
  return summary.startsWith(expected) ? summary.slice(expected.length) : summary
}
