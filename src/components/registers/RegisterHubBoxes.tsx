// Card grid for /registers — replaces the previous list-of-categories
// view. Each card represents one register type (= one database) with
// its framework pill, lovpålagt / GDPR markers, total record count
// and the most-relevant per-type alerts (utgått, due-soon, CMR …).

import { Calendar, Check, Lock, ShieldCheck, User as UserIcon } from 'lucide-react'
import { RegisterFrameworkPill } from './RegisterFrameworkPill'
import { lucideByName } from './lucideByName'
import type { ResolvedRegisterType } from '../../hooks/useRegisters'
import type { RegisterStats } from '../../lib/registers/registerStats'

type Props = {
  types: ResolvedRegisterType[]
  statsByType: Map<string, RegisterStats>
  easy: boolean
  onOpen: (type: ResolvedRegisterType) => void
}

export function RegisterHubBoxes({ types, statsByType, easy, onOpen }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
      {types.map((t) => {
        const display = t.displayMetadata
        const stats = statsByType.get(t.id) ?? defaultStats()
        const Icon = lucideByName(display.icon)
        const issues =
          stats.reviewsOverdue + stats.reviewsDueSoon + stats.cmrCount

        return (
          <article
            key={t.id}
            onClick={() => onOpen(t)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(t)
              }
            }}
            role="button"
            tabIndex={0}
            className="cursor-pointer rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm transition-all hover:border-[#1a3d32]/40 hover:shadow-md focus:outline-none focus-visible:border-[#1a3d32] focus-visible:ring-2 focus-visible:ring-[#1a3d32]/30"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e7efe9] text-[#1a3d32]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <RegisterFrameworkPill regulationIds={t.regulationIds} />
                  {display.mandatory ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-[#e7efe9] px-1 py-0.5 text-[9px] font-bold text-[#14312a]">
                      <ShieldCheck className="h-2 w-2" />
                      Lovpålagt
                    </span>
                  ) : null}
                  {display.gdpr ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-purple-100 px-1 py-0.5 text-[9px] font-bold text-purple-800">
                      <Lock className="h-2 w-2" />
                      GDPR
                    </span>
                  ) : null}
                  {display.sensitive && !display.gdpr ? (
                    <Lock className="h-3 w-3 text-neutral-500" aria-label="Sensitivt" />
                  ) : null}
                  {!t.isSystem ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-neutral-100 px-1 py-0.5 text-[9px] font-bold text-neutral-700">
                      Egen
                    </span>
                  ) : null}
                </div>
                <h3
                  className="mt-1.5 text-sm font-semibold leading-tight text-neutral-900"
                  style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                >
                  {t.resolvedName}
                </h3>
              </div>
            </div>

            {!easy && t.description ? (
              <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-neutral-600">
                {t.description}
              </p>
            ) : null}

            <div className="mt-3 rounded-md bg-[#fbf9f3] px-3 py-2">
              <div className="flex items-baseline justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Oppføringer
                </div>
                <div
                  className="text-xl font-bold tabular-nums text-neutral-900"
                  style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                >
                  {stats.totalAll}
                </div>
              </div>
              {!easy ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                  {stats.reviewsOverdue > 0 ? (
                    <span className="rounded bg-red-100 px-1 py-0 font-semibold text-red-800">
                      {stats.reviewsOverdue} forfalt
                    </span>
                  ) : null}
                  {stats.reviewsDueSoon > 0 ? (
                    <span className="rounded bg-amber-100 px-1 py-0 font-semibold text-amber-900">
                      {stats.reviewsDueSoon} utløper
                    </span>
                  ) : null}
                  {stats.cmrCount > 0 ? (
                    <span className="rounded bg-red-100 px-1 py-0 font-semibold text-red-800">
                      {stats.cmrCount} CMR
                    </span>
                  ) : null}
                  {stats.drafts > 0 ? (
                    <span className="rounded bg-blue-100 px-1 py-0 font-semibold text-blue-800">
                      {stats.drafts} utkast
                    </span>
                  ) : null}
                  {stats.archived > 0 ? (
                    <span className="rounded bg-neutral-100 px-1 py-0 font-semibold text-neutral-700">
                      {stats.archived} arkivert
                    </span>
                  ) : null}
                  {issues === 0 && stats.drafts === 0 ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <Check className="h-2.5 w-2.5" /> Ingen avvik
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!easy ? (
              <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5 text-[10px] text-neutral-500">
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="h-2.5 w-2.5" /> {display.ownerRole ?? '—'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-2.5 w-2.5" />
                  {truncate(display.retentionLabel ?? 'Ikke satt', 28)}
                </span>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

function defaultStats(): RegisterStats {
  return {
    total: 0,
    totalAll: 0,
    reviewsOverdue: 0,
    reviewsDueSoon: 0,
    cmrCount: 0,
    drafts: 0,
    archived: 0,
    byChip: { all: 0 },
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
