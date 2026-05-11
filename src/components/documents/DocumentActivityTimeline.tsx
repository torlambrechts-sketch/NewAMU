// Read-only timeline of audit events for a wiki page.
//
// Surfaces the existing wiki_audit_ledger so authors and reviewers can see who
// did what, when. Pattern mirrors modules/tasks/components/TaskActivityFeed.tsx
// (chronological, INSERT-only, no edit controls). The ledger is shared across
// the editor right rail and the view page so the same history is available
// regardless of how the user enters the document.

import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  History,
  ShieldAlert,
  ThumbsUp,
  Upload,
} from 'lucide-react'
import type { AuditLedgerEntry } from '../../types/documents'

type Props = {
  pageId: string
  entries: AuditLedgerEntry[]
  /** Map of user id → display name; falls back to the raw id. */
  resolveUserName?: (userId: string) => string
  /** Show empty state copy. */
  emptyLabel?: string
  /** When provided, "Sammenlign" appears on published/approved entries that
   *  carry a fromVersion so the reviewer can jump to the side-by-side diff
   *  in the Versjoner tab. */
  onCompareVersion?: (fromVersion: number) => void
}

const ACTION_LABEL: Record<AuditLedgerEntry['action'], string> = {
  created: 'opprettet dokumentet',
  updated: 'oppdaterte dokumentet',
  published: 'publiserte ny versjon',
  archived: 'arkiverte dokumentet',
  acknowledged: 'bekreftet «Lest og forstått»',
  annual_review_completed: 'fullførte årlig revisjon',
  submitted_for_review: 'sendte til godkjenning',
  approved: 'godkjente og publiserte',
  changes_requested: 'ba om endringer',
}

function ActionIcon({ action }: { action: AuditLedgerEntry['action'] }) {
  const cls = 'size-3.5'
  switch (action) {
    case 'created':
      return <FileText className={cls} aria-hidden />
    case 'updated':
      return <FileText className={cls} aria-hidden />
    case 'published':
    case 'approved':
      return <Upload className={cls} aria-hidden />
    case 'archived':
      return <History className={cls} aria-hidden />
    case 'acknowledged':
      return <ThumbsUp className={cls} aria-hidden />
    case 'annual_review_completed':
      return <ClipboardCheck className={cls} aria-hidden />
    case 'submitted_for_review':
      return <CheckCircle2 className={cls} aria-hidden />
    case 'changes_requested':
      return <ShieldAlert className={cls} aria-hidden />
  }
}

export function DocumentActivityTimeline({
  pageId,
  entries,
  resolveUserName,
  emptyLabel,
  onCompareVersion,
}: Props) {
  const forPage = entries
    .filter((e) => e.pageId === pageId)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))

  if (forPage.length === 0) {
    return (
      <p className="rounded border border-dashed border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500">
        {emptyLabel ?? 'Ingen hendelser registrert ennå.'}
      </p>
    )
  }

  return (
    <ol className="space-y-2">
      {forPage.map((entry) => {
        const name = resolveUserName?.(entry.userId) ?? entry.userId.slice(0, 8)
        const versionLabel =
          entry.fromVersion && entry.fromVersion !== entry.toVersion
            ? `v${entry.fromVersion} → v${entry.toVersion}`
            : `v${entry.toVersion}`
        return (
          <li
            key={entry.id}
            className="flex items-start gap-2 rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs"
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e6f4ef] text-[#0f766e]">
              <ActionIcon action={entry.action} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-neutral-800">
                <span className="font-medium">{name}</span>{' '}
                <span className="text-neutral-600">{ACTION_LABEL[entry.action]}</span>{' '}
                <span className="text-neutral-400">({versionLabel})</span>
              </p>
              <p className="mt-0.5 text-[10px] text-neutral-400">
                {new Date(entry.at).toLocaleString('nb-NO')}
              </p>
              {entry.snapshot ? (
                <p className="mt-1 line-clamp-2 text-[11px] italic text-neutral-500">{entry.snapshot}</p>
              ) : null}
              {onCompareVersion &&
              (entry.action === 'published' || entry.action === 'approved') &&
              entry.fromVersion &&
              entry.fromVersion !== entry.toVersion ? (
                <button
                  type="button"
                  className="mt-1 inline-flex items-center text-[11px] text-[#0f766e] underline"
                  onClick={() => onCompareVersion(entry.fromVersion!)}
                >
                  Sammenlign v{entry.fromVersion} → v{entry.toVersion}
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
