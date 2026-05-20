import { Archive, Check, PenLine, Search, Send, Signature } from 'lucide-react'
import type { WikiPage, WikiReviewRequest } from '../../types/documents'

/**
 * Five-stage approval pipeline (Claude Design "Rec08 — Godkjenningsløype").
 *
 * Kladd → Gjennomgang → Godkjenning → Publisering → Aktiv. Stage state is
 * derived from the page status and its latest review request, so the
 * pipeline always reflects reality without a separate workflow table.
 */

type StageState = 'done' | 'current' | 'pending'

const ICONS = { draft: PenLine, review: Search, approve: Signature, publish: Send, archive: Archive }

export function DocumentApprovalPipeline({
  page,
  requests,
}: {
  page: WikiPage
  requests: WikiReviewRequest[]
}) {
  const latest = requests
    .filter((r) => r.pageId === page.id)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

  const published = page.status === 'published'
  const archived = page.status === 'archived'
  const pendingReview = latest?.status === 'pending'
  const approved = latest?.status === 'approved'

  const stageState = (stage: keyof typeof ICONS): StageState => {
    switch (stage) {
      case 'draft':
        return 'done'
      case 'review':
        if (published || archived || approved) return 'done'
        return latest ? 'done' : pendingReview ? 'current' : 'pending'
      case 'approve':
        if (published || archived) return 'done'
        if (approved) return 'done'
        return pendingReview ? 'current' : 'pending'
      case 'publish':
        if (published) return 'current'
        if (archived) return 'done'
        return 'pending'
      case 'archive':
        return archived ? 'done' : 'pending'
      default:
        return 'pending'
    }
  }

  const stages: { id: keyof typeof ICONS; title: string; sub: string }[] = [
    { id: 'draft', title: 'Kladd', sub: 'Under utarbeidelse' },
    { id: 'review', title: 'Gjennomgang', sub: 'Verneombud / fagansvarlig' },
    { id: 'approve', title: 'Godkjenning', sub: pendingReview ? 'Venter på signatur' : 'Signatur kreves' },
    { id: 'publish', title: 'Publisering', sub: 'Distribueres til ansatte' },
    { id: 'archive', title: 'Aktiv · arkivert', sub: 'Neste revisjon' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {stages.map((stage, i) => {
        const state = stageState(stage.id)
        const Icon = ICONS[stage.id]
        const done = state === 'done'
        const current = state === 'current'
        return (
          <div key={stage.id} className="relative">
            {i > 0 ? (
              <span
                className={`absolute -left-1.5 top-5 hidden h-px w-3 sm:block ${
                  done || current ? 'bg-[#0f766e]' : 'bg-neutral-200'
                }`}
                aria-hidden
              />
            ) : null}
            <div
              className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                done
                  ? 'border-[#0f766e] bg-[#0f766e] text-white'
                  : current
                    ? 'border-[#0f766e] bg-white text-[#0f766e]'
                    : 'border-neutral-300 bg-white text-neutral-400'
              }`}
            >
              {done ? <Check className="h-5 w-5" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}
            </div>
            <p className={`text-sm font-semibold ${done || current ? 'text-neutral-900' : 'text-neutral-500'}`}>
              {stage.title}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500">{stage.sub}</p>
            {current ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#0f766e]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0f766e]" />
                Pågår
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
