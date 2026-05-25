// "Mitt arbeid · Mine oppgaver" — focused personal task queue.
// Same data source as /tasks/management, narrowed to tasks where the
// signed-in user is assignee or owner by display-name match. A
// proper assignee_member_id link is a follow-up (see useTaskItemsData
// comment); the name-string match is the best we can do today.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, ListChecks } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useTaskItemsData } from '../../../modules/tasks/useTaskItemsData'
import type { TaskItemRow } from '../../../modules/tasks/useTaskItemsData'

const CREAM_DEEP = '#EFE8DC'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function relativeDays(iso: string | null): { label: string; tone: 'overdue' | 'today' | 'soon' | 'normal' } {
  if (!iso) return { label: 'Ingen frist', tone: 'normal' }
  const due = new Date(iso).getTime()
  const days = Math.ceil((due - Date.now()) / 86400000)
  if (days < 0) return { label: `${Math.abs(days)} dager forsinket`, tone: 'overdue' }
  if (days === 0) return { label: 'I dag', tone: 'today' }
  if (days <= 3) return { label: `Om ${days} dager`, tone: 'soon' }
  return { label: fmtDate(iso), tone: 'normal' }
}

export function MittArbeidOppgaverPage() {
  const { profile } = useOrgSetupContext()
  const tasks = useTaskItemsData()
  const myName = profile?.display_name?.trim() ?? ''

  const myOpen = useMemo<TaskItemRow[]>(() => {
    const open = tasks.items.filter(
      (t) => t.status !== 'closed' && t.status !== 'cancelled',
    )
    if (!myName) return []
    return open
      .filter((t) => t.assigneeName === myName || t.ownerName === myName)
      .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
  }, [tasks.items, myName])

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
          <ListChecks className="size-3.5" aria-hidden />
          Mitt arbeid · Mine oppgaver
        </div>
        <h1
          className="mt-2 font-serif text-3xl font-medium tracking-tight text-neutral-900 md:text-4xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          Mine oppgaver
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
          Åpne oppgaver tildelt deg eller hvor du er eier. Sortert etter
          frist — forsinkede oppgaver vises først.
        </p>
      </div>

      {!myName ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Sett visningsnavn i profil for å se mine oppgaver. Oppgaver knytter
          ansvarlig via tekstnavn i dag — en bruker-ID-kobling er planlagt.
          <Link
            to="/profile"
            className="ml-2 underline-offset-2 hover:underline"
          >
            Åpne profil
          </Link>
        </div>
      ) : myOpen.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <CheckCircle2 className="size-6 text-emerald-600" aria-hidden />
          <div>
            <p className="font-medium text-emerald-900">Ingen åpne oppgaver tildelt deg.</p>
            <p className="text-sm text-emerald-700">Du er ajour.</p>
          </div>
        </div>
      ) : (
        <section
          className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-5"
          style={{ background: CREAM_DEEP }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              {myOpen.length} {myOpen.length === 1 ? 'oppgave' : 'oppgaver'}
            </span>
            <Link
              to="/tasks/management"
              className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500 hover:text-neutral-800"
            >
              Åpne oppgavestyring
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          {myOpen.map((t) => {
            const rel = relativeDays(t.dueDate)
            return (
              <Link
                key={t.id}
                to={`/tasks/management?selected=${t.id}`}
                className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 transition-colors hover:border-neutral-400"
              >
                <ListChecks
                  className="size-4 shrink-0 text-neutral-400 group-hover:text-neutral-700"
                  aria-hidden
                  style={{ color: rel.tone === 'overdue' ? '#b03020' : undefined }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-800">{t.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                    <span
                      className={
                        rel.tone === 'overdue'
                          ? 'font-semibold text-rose-600'
                          : rel.tone === 'today'
                          ? 'font-semibold text-amber-700'
                          : 'text-neutral-500'
                      }
                    >
                      {rel.label}
                    </span>
                    {t.priority !== 'medium' ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="uppercase tracking-wide">{t.priority}</span>
                      </>
                    ) : null}
                    {t.templateKind ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{t.templateKind}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <ArrowUpRight
                  className="size-3.5 shrink-0 text-neutral-300 group-hover:text-neutral-600"
                  aria-hidden
                />
              </Link>
            )
          })}
        </section>
      )}

      <p className="mt-10 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
        Mitt arbeid · Mine oppgaver · Filtrert på assignee/eier {' '}
        = display_name (forbedring planlagt)
      </p>
    </div>
  )
}
