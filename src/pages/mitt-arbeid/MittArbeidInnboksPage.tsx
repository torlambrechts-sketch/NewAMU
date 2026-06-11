// "Mitt arbeid · Innboks" — cross-module landing page that gathers every
// pending item touching the signed-in user into one surface. Compose
// over existing hooks (tasks / meetings / alerts / notifications) so
// the same RLS that protects each module still applies here.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Inbox,
  ListChecks,
  PenLine,
} from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useTaskItemsData } from '../../../modules/tasks/useTaskItemsData'
import { useMeetings } from '../../../modules/meetings'
import { useAlerts } from '../../../modules/alerts'
import { useNotifications } from '../../hooks/useNotifications'

const FOREST = '#1a3d32'
const CREAM_DEEP = '#EFE8DC'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('no-NO', { day: '2-digit', month: 'short' })
  } catch {
    return iso
  }
}

function alertStatusLabel(status: string): string {
  switch (status) {
    case 'received':
      return 'Mottatt'
    case 'triage':
      return 'Under triage'
    case 'investigation':
      return 'Etterforskning'
    case 'internal_review':
      return 'Intern gjennomgang'
    default:
      return status
  }
}

function relativeDays(iso: string | null): { label: string; tone: 'overdue' | 'today' | 'soon' | 'normal' } {
  if (!iso) return { label: 'Ingen frist', tone: 'normal' }
  const due = new Date(iso).getTime()
  const now = Date.now()
  const days = Math.ceil((due - now) / 86400000)
  if (days < 0) return { label: `${Math.abs(days)} dager forsinket`, tone: 'overdue' }
  if (days === 0) return { label: 'I dag', tone: 'today' }
  if (days <= 3) return { label: `Om ${days} dager`, tone: 'soon' }
  return { label: fmtDate(iso), tone: 'normal' }
}

export function MittArbeidInnboksPage() {
  const { profile, user, can } = useOrgSetupContext()
  const tasks = useTaskItemsData()
  const meetings = useMeetings()
  const alerts = useAlerts()
  const { unreadList } = useNotifications()
  // Confidentiality gate: only show varslingssaker panel to roles with
  // committee membership (or full alerts manage right). RLS on
  // alert_cases protects the rows, but rendering "0 cases" still
  // reveals existence; not rendering the panel at all is the cleaner
  // pattern (AML kap. 2 A taushetsplikt).
  const canSeeAlerts =
    can('alerts.committee') ||
    can('alerts.committee_confidential') ||
    can('alerts.committee_escalated') ||
    can('alerts.manage')

  const displayName = useMemo(() => {
    const n = profile?.display_name?.trim()
    if (n) return n
    const e = user?.email?.split('@')[0]
    return e || 'deg'
  }, [profile?.display_name, user?.email])

  // Open tasks assigned to me. Match on the stable assignee_user_id /
  // owner_user_id link (H1.1); fall back to display-name match only for
  // legacy rows that predate the uuid backfill (both ids null).
  const myUserId = user?.id ?? null
  const myName = profile?.display_name?.trim() ?? ''
  const myTasks = useMemo(() => {
    const open = tasks.items.filter((t) => t.status !== 'closed' && t.status !== 'cancelled')
    const mine = open.filter((t) => {
      const byId =
        myUserId != null && (t.assigneeUserId === myUserId || t.ownerUserId === myUserId)
      const legacy =
        t.assigneeUserId == null &&
        t.ownerUserId == null &&
        myName !== '' &&
        (t.assigneeName === myName || t.ownerName === myName)
      return byId || legacy
    })
    // Sort: overdue first, then by due date ascending
    return mine.sort((a, b) => {
      const ad = a.dueDate ?? '9999'
      const bd = b.dueDate ?? '9999'
      return ad.localeCompare(bd)
    })
  }, [tasks.items, myUserId, myName])

  // Upcoming meetings I'm invited to (planned, in the future). Today the
  // participant join is via `participant_member_ids[]` so the precise
  // me-only filter requires the org_member id — the post-_120500 attendee
  // roster is the canonical source but is fetched per-meeting in detail
  // view. For the inbox MVP we show all planned meetings in the next 14
  // days; tightening to "me only" is a follow-up.
  const myMeetings = useMemo(() => {
    const now = Date.now()
    const horizon = now + 14 * 86400000
    return meetings.meetings
      .filter((m) => {
        if (m.status !== 'planned') return false
        if (!m.scheduled_at) return false
        const t = new Date(m.scheduled_at).getTime()
        return t >= now && t <= horizon
      })
      .sort((a, b) =>
        (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''),
      )
  }, [meetings.meetings])

  // Active alerts cases — only computed for committee roles. RLS on
  // alert_cases additionally guards individual rows; rendering this
  // panel at all reveals existence, so we hide it for non-committee.
  const myAlerts = useMemo(() => {
    if (!canSeeAlerts) return []
    return alerts.cases
      .filter((c) => c.status !== 'closed' && c.status !== 'dismissed')
      .sort((a, b) => (b.received_at ?? '').localeCompare(a.received_at ?? ''))
      .slice(0, 5)
  }, [alerts.cases, canSeeAlerts])

  const overdueCount = myTasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now()).length

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
          <Inbox className="size-3.5" aria-hidden />
          Mitt arbeid · Innboks
        </div>
        <h1
          className="mt-2 font-serif text-3xl font-medium tracking-tight text-neutral-900 md:text-4xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          God dag, {displayName}.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
          Alt som venter på meg, samlet på ett sted. Oppgaver, varslingssaker, møter
          og signaturer du må behandle for å holde virksomheten i samsvar.
        </p>
      </div>

      {/* KPI row */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={ListChecks}
          label="Mine oppgaver"
          value={myTasks.length}
          accent={overdueCount > 0 ? '#b03020' : FOREST}
          hint={overdueCount > 0 ? `${overdueCount} forsinket` : 'Åpne'}
          to="/tasks/management"
        />
        {canSeeAlerts ? (
          <KpiCard
            icon={AlertTriangle}
            label="Varslingssaker"
            value={myAlerts.length}
            accent="#c46a2a"
            hint="Aktive saker"
            to="/alerts"
          />
        ) : (
          <KpiCard
            icon={CalendarClock}
            label="Møter i dag"
            value={
              myMeetings.filter((m) => {
                if (!m.scheduled_at) return false
                const t = new Date(m.scheduled_at)
                const now = new Date()
                return (
                  t.getFullYear() === now.getFullYear() &&
                  t.getMonth() === now.getMonth() &&
                  t.getDate() === now.getDate()
                )
              }).length
            }
            accent="#0e7490"
            hint="I dag"
            to="/meetings"
          />
        )}
        <KpiCard
          icon={CalendarClock}
          label="Møter neste 14 dager"
          value={myMeetings.length}
          accent="#0891b2"
          hint="Planlagte"
          to="/meetings"
        />
        <KpiCard
          icon={PenLine}
          label="Mine signaturer"
          // Show only the documents-review stream — that's what the
          // dedicated signatures page also surfaces from
          // wiki_review_requests. Including tasks_sign here would
          // double-count items that don't appear on /mitt-arbeid/
          // signaturer, so the two counts wouldn't match.
          value={unreadList.filter((n) => n.category === 'documents_review').length}
          accent="#a88332"
          hint="Krever underskrift"
          to="/mitt-arbeid/signaturer"
        />
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ListPanel
          title="Oppgaver tildelt meg"
          icon={ListChecks}
          accent={FOREST}
          empty="Ingen åpne oppgaver tildelt deg."
          to="/tasks/management"
          toLabel="Åpne Oppgaver"
        >
          {myTasks.slice(0, 6).map((t) => {
            const rel = relativeDays(t.dueDate)
            return (
              <Link
                key={t.id}
                to={`/tasks/management?taskId=${t.id}`}
                className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 transition-colors hover:border-neutral-400"
              >
                <ListChecks className="size-4 shrink-0 text-neutral-400 group-hover:text-neutral-700" aria-hidden />
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
                  </div>
                </div>
                <ArrowUpRight className="size-3.5 shrink-0 text-neutral-300 group-hover:text-neutral-600" aria-hidden />
              </Link>
            )
          })}
        </ListPanel>

        <ListPanel
          title="Møter du er invitert til"
          icon={CalendarClock}
          accent="#0891b2"
          empty="Ingen planlagte møter de neste 14 dagene."
          to="/meetings"
          toLabel="Åpne Møter"
        >
          {myMeetings.slice(0, 6).map((m) => (
            <Link
              key={m.id}
              to={`/meetings/${m.id}`}
              className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 transition-colors hover:border-neutral-400"
            >
              <CalendarClock className="size-4 shrink-0 text-neutral-400 group-hover:text-neutral-700" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-800">{m.title}</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {fmtDate(m.scheduled_at)} ·{' '}
                  {m.scheduled_at
                    ? new Date(m.scheduled_at).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </p>
              </div>
              <ArrowUpRight className="size-3.5 shrink-0 text-neutral-300 group-hover:text-neutral-600" aria-hidden />
            </Link>
          ))}
        </ListPanel>

        {canSeeAlerts ? (
          <ListPanel
            title="Aktive varslingssaker"
            icon={AlertTriangle}
            accent="#c46a2a"
            empty="Ingen aktive saker. Trygt på vakt."
            to="/alerts"
            toLabel="Åpne Varslinger"
          >
            {myAlerts.map((c) => (
              <Link
                key={c.id}
                to={`/alerts/${c.id}`}
                className="group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 transition-colors hover:border-neutral-400"
              >
                <AlertTriangle className="size-4 shrink-0 text-neutral-400 group-hover:text-neutral-700" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-800">{c.title}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {alertStatusLabel(c.status)}
                    {c.severity ? ` · ${c.severity}` : ''}
                  </p>
                </div>
                <ArrowUpRight className="size-3.5 shrink-0 text-neutral-300 group-hover:text-neutral-600" aria-hidden />
              </Link>
            ))}
          </ListPanel>
        ) : null}

        <ListPanel
          title="Varsler og mentions"
          icon={Inbox}
          accent={FOREST}
          empty="Ingen uleste varsler."
          to="/notifications"
          toLabel="Åpne alle varsler"
        >
          {unreadList.slice(0, 6).map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5"
            >
              <Inbox className="size-4 shrink-0 text-neutral-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-800">{n.title}</p>
                {n.body ? (
                  <p className="truncate text-[11px] text-neutral-500">{n.body}</p>
                ) : null}
              </div>
            </div>
          ))}
        </ListPanel>
      </div>

      <p className="mt-10 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
        Mitt arbeid · Innboks · Kilde: oppgaver · møter · varslingssaker · varsler
      </p>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  hint,
  to,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true'; style?: React.CSSProperties }>
  label: string
  value: number
  accent: string
  hint: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-400"
    >
      <div className="flex items-center justify-between">
        <Icon className="size-5 text-neutral-400 group-hover:text-neutral-700" aria-hidden="true" />
        <span className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">{hint}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className="font-serif text-3xl font-medium tabular-nums"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif", color: accent }}
        >
          {value}
        </span>
      </div>
      <p className="text-xs font-medium text-neutral-600">{label}</p>
    </Link>
  )
}

function ListPanel({
  title,
  icon: Icon,
  accent,
  empty,
  to,
  toLabel,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: 'true'; style?: React.CSSProperties }>
  accent: string
  empty: string
  to: string
  toLabel: string
  children: React.ReactNode
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-5"
      style={{ background: CREAM_DEEP }}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-4" aria-hidden="true" style={{ color: accent }} />
          <h2
            className="font-serif text-lg font-medium text-neutral-900"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {title}
          </h2>
        </div>
        <Link
          to={to}
          className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500 hover:text-neutral-800"
        >
          {toLabel}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </header>
      <div className="flex flex-col gap-2">
        {hasChildren ? children : (
          <p className="text-sm text-neutral-500">{empty}</p>
        )}
      </div>
    </section>
  )
}
