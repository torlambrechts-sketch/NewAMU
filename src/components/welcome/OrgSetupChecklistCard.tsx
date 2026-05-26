// Day-1 setup checklist rendered on /app for fresh orgs.
//
// A new org's first login used to land on a dashboard full of zeros and
// donut charts that mean nothing. This card sits at the top of the home
// page for the first 30 days and guides four concrete first actions:
// invite a teammate, kjør første sjekkliste, publiser første dokument,
// planlegg første møte. Each step is derived from a cheap HEAD count
// against the org's own data — no schema change, no setup-flag columns
// to drift. Once all four are done (or 30 days pass), the card hides
// itself permanently for that org instance.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'

const SETUP_GRACE_DAYS = 30

interface SetupStep {
  id: 'invite' | 'compliance' | 'documents' | 'meeting'
  icon: LucideIcon
  label: string
  body: string
  to: string
  cta: string
  done: boolean
}

interface OrgSetupChecklistCardProps {
  supabase: SupabaseClient | null
  organizationId: string | null
  organizationCreatedAt?: string | null
}

export function OrgSetupChecklistCard({
  supabase,
  organizationId,
  organizationCreatedAt,
}: OrgSetupChecklistCardProps) {
  const [counts, setCounts] = useState<{
    members: number
    executions: number
    pages: number
    meetings: number
  } | null>(null)
  // Memoise Date.now() at mount; the 30-day grace window doesn't need
  // tick-level accuracy. react-hooks/purity forbids raw Date.now() in
  // render — this is the idiomatic alternative used elsewhere in the
  // codebase (PublishReportButton, useCertExpiryWarningCount).
  const [nowMs] = useState(() => Date.now())

  const orgAgeDays = useMemo(() => {
    if (!organizationCreatedAt) return 0
    const created = new Date(organizationCreatedAt).getTime()
    if (Number.isNaN(created)) return 0
    return Math.floor((nowMs - created) / (24 * 60 * 60 * 1000))
  }, [organizationCreatedAt, nowMs])

  useEffect(() => {
    let cancelled = false
    if (!supabase || !organizationId) return

    async function load() {
      if (!supabase) return
      const [members, executions, pages, meetings] = await Promise.all([
        supabase
          .from('organization_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        supabase
          .from('compliance_checklist_executions')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        supabase
          .from('wiki_pages')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
        supabase
          .from('meetings')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
      ])
      if (cancelled) return
      setCounts({
        members: members.count ?? 0,
        executions: executions.count ?? 0,
        pages: pages.count ?? 0,
        meetings: meetings.count ?? 0,
      })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [supabase, organizationId])

  const steps = useMemo<SetupStep[]>(() => {
    const c = counts ?? { members: 0, executions: 0, pages: 0, meetings: 0 }
    return [
      {
        id: 'invite',
        icon: UserPlus,
        label: 'Inviter et teammedlem',
        body: 'Compliance er lagarbeid. Legg til verneombud, BHT-kontakt eller HR-kollega slik at flere kan signere og kvittere.',
        to: '/organisation',
        cta: 'Inviter',
        done: c.members > 1,
      },
      {
        id: 'compliance',
        icon: ClipboardCheck,
        label: 'Kjør din første sjekkliste',
        body: 'Velg en mal fra biblioteket — for eksempel "AML §3-1 systematisk HMS" — og dokumenter at en rutine er fulgt.',
        to: '/compliance/checklists',
        cta: 'Velg mal',
        done: c.executions > 0,
      },
      {
        id: 'documents',
        icon: FileText,
        label: 'Publiser ditt første dokument',
        body: 'Bygg HMS-håndboken fra maler bundet til hjemmel. Ansatte kvitterer; sporbarheten blir riktig fra dag én.',
        to: '/documents',
        cta: 'Velg mal',
        done: c.pages > 0,
      },
      {
        id: 'meeting',
        icon: Calendar,
        label: 'Planlegg ditt første møte',
        body: 'AMU, drøfting eller årsrapport — alle møter loggføres med protokoll, hjemmel og signaturer.',
        to: '/meetings',
        cta: 'Opprett møte',
        done: c.meetings > 0,
      },
    ]
  }, [counts])

  if (!supabase || !organizationId) return null
  if (counts === null) return null
  if (orgAgeDays > SETUP_GRACE_DAYS) return null

  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  return (
    <section
      aria-labelledby="org-setup-heading"
      className="overflow-hidden rounded-lg border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-white shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-100/80 px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
            aria-hidden
          >
            <Sparkles className="size-4" />
          </div>
          <div>
            <h2 id="org-setup-heading" className="text-base font-semibold text-neutral-900">
              Kom i gang med Klarert
            </h2>
            <p className="mt-0.5 text-xs text-neutral-600">
              Fire korte steg som gir deg en revisjonsklar start — anbefalt i løpet av første uke.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex h-1.5 w-32 overflow-hidden rounded-full bg-emerald-100">
            <span
              className="h-full bg-emerald-600 transition-[width]"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </span>
          <span className="font-semibold tabular-nums text-emerald-800">
            {doneCount}/{steps.length}
          </span>
        </div>
      </header>

      <ol className="divide-y divide-emerald-100/70">
        {steps.map((step) => {
          const StepIcon = step.icon
          return (
            <li key={step.id} className="flex items-start gap-3 px-5 py-3.5">
              <div className="mt-0.5 shrink-0" aria-hidden>
                {step.done ? (
                  <CheckCircle2 className="size-5 text-emerald-600" />
                ) : (
                  <Circle className="size-5 text-neutral-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StepIcon className="size-3.5 text-neutral-400" aria-hidden />
                  <p
                    className={
                      step.done
                        ? 'text-sm font-semibold text-neutral-500 line-through'
                        : 'text-sm font-semibold text-neutral-900'
                    }
                  >
                    {step.label}
                  </p>
                </div>
                {!step.done ? (
                  <p className="mt-0.5 max-w-prose text-xs text-neutral-600">{step.body}</p>
                ) : null}
              </div>
              {!step.done ? (
                <Link
                  to={step.to}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors outline-none hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2"
                >
                  {step.cta}
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              ) : (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Fullført
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
