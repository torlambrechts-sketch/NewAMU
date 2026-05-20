import { Link } from 'react-router-dom'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import { Badge } from '../ui/Badge'
import type { AuditLedgerEntry, WikiPage, WikiSpace } from '../../types/documents'

/**
 * Right-hand side panel for the document viewer (Rec02).
 *
 * Three stacked cards — page info, an activity timeline and related pages.
 * Hidden by the viewer "size button" so the prose column can expand over it.
 */

const ACTION_LABEL: Record<AuditLedgerEntry['action'], string> = {
  created: 'opprettet siden',
  updated: 'redigerte siden',
  published: 'publiserte versjon',
  archived: 'arkiverte siden',
  acknowledged: 'signerte siden',
  annual_review_completed: 'fullførte årlig gjennomgang',
  submitted_for_review: 'sendte til godkjenning',
  approved: 'godkjente siden',
  changes_requested: 'ba om endringer',
}

const AVATAR_COLORS = ['#0f766e', '#b45309', '#7e22ce', '#1a3d32', '#1e40af']

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function avatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-800">{children}</dd>
    </div>
  )
}

export function WikiMetaPanel({
  page,
  space,
  ownerName,
  auditLedger,
  resolveUserName,
  backlinkIds,
  pageTitleById,
}: {
  page: WikiPage
  space: WikiSpace | null | undefined
  ownerName: string
  auditLedger: AuditLedgerEntry[]
  resolveUserName: (id: string) => string
  backlinkIds: string[]
  pageTitleById: (id: string) => string
}) {
  const timeline = auditLedger
    .filter((e) => e.pageId === page.id)
    .slice()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6)

  return (
    <div className="sticky top-4 flex flex-col gap-4 self-start">
      <ModuleSectionCard className="!p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sideinfo</p>
        <dl className="mt-2 space-y-2 text-xs">
          <MetaRow label="Eier">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                style={{ background: avatarColor(page.authorId) }}
              >
                {initials(ownerName)}
              </span>
              {ownerName}
            </span>
          </MetaRow>
          <MetaRow label="Versjon">
            <span className="tabular-nums">{page.version}</span>
          </MetaRow>
          {page.legalRefs.length > 0 ? (
            <MetaRow label="Lovverk">
              <span className="flex flex-wrap justify-end gap-1">
                {page.legalRefs.slice(0, 3).map((ref) => (
                  <Badge key={ref} variant="info">
                    {ref}
                  </Badge>
                ))}
              </span>
            </MetaRow>
          ) : null}
          <MetaRow label="Kategori">{space?.title ?? '—'}</MetaRow>
          {page.nextRevisionDueAt ? (
            <MetaRow label="Gyldig til">
              <span className="tabular-nums">
                {new Date(page.nextRevisionDueAt).toLocaleDateString('nb-NO')}
              </span>
            </MetaRow>
          ) : null}
          <MetaRow label="Språk">{(page.lang ?? 'nb').toUpperCase()}</MetaRow>
        </dl>
      </ModuleSectionCard>

      {timeline.length > 0 ? (
        <ModuleSectionCard className="!p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Tidslinje</p>
          <ul className="mt-2 space-y-2.5 text-xs">
            {timeline.map((entry) => {
              const name = resolveUserName(entry.userId)
              return (
                <li key={entry.id} className="flex items-start gap-2">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ background: avatarColor(entry.userId) }}
                  >
                    {initials(name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-neutral-800">
                      <span className="font-semibold">{name}</span> {ACTION_LABEL[entry.action]}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {new Date(entry.at).toLocaleString('nb-NO', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </ModuleSectionCard>
      ) : null}

      {backlinkIds.length > 0 ? (
        <ModuleSectionCard className="!p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Lenket fra</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {backlinkIds.map((id) => (
              <li key={id}>
                <Link to={`/documents/page/${id}`} className="text-[#0f766e] hover:underline">
                  {pageTitleById(id)}
                </Link>
              </li>
            ))}
          </ul>
        </ModuleSectionCard>
      ) : null}
    </div>
  )
}
