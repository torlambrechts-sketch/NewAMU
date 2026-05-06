import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarDays,
  Check,
  CircleDashed,
  Clock,
  Download,
  FileCheck2,
  Gavel,
  LayoutGrid,
  List as ListIcon,
  ListChecks,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
  ModuleLegalBanner,
  ModulePageShell,
  ModuleSectionCard,
} from '../../src/components/module'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { Badge, type BadgeVariant } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { useAmu } from './useAmu'
import { AmuMeetingDetail } from './AmuMeetingDetail'
import { AMU_MODULE_LEGAL_REFERENCES } from './amuLegalReferences'
import type {
  AmuAgendaItem,
  AmuDecision,
  AmuMeeting,
  AmuMember,
  AmuAnnualReport,
} from './types'

const SERIF: React.CSSProperties = { fontFamily: "'Libre Baskerville', Georgia, serif" }

type HubTabId =
  | 'moter'
  | 'saker'
  | 'vedtak'
  | 'medlemmer'
  | 'tiltak'
  | 'rapporter'
  | 'etterlevelse'
type ViewMode = 'list' | 'box'
type YearFilter = number | 'all'

type HubTab = {
  id: HubTabId
  label: string
  icon: LucideIcon
  count: number
}

// ── Helpers ────────────────────────────────────────────────────────────────
const NB_MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

function fmtDate(iso: string | null | undefined, includeTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const m = NB_MONTHS[d.getMonth()]
  const y = d.getFullYear()
  if (!includeTime) return `${day}. ${m} ${y}`
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day}. ${m} ${y} · ${hh}:${mm}`
}

function daysFromNow(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.round((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function meetingStatusBadge(s: AmuMeeting['status']): { variant: BadgeVariant; label: string } {
  if (s === 'signed') return { variant: 'success', label: 'Signert' }
  if (s === 'in_progress') return { variant: 'warning', label: 'Pågår nå' }
  if (s === 'scheduled') return { variant: 'info', label: 'Planlagt' }
  if (s === 'completed') return { variant: 'neutral', label: 'Avsluttet' }
  if (s === 'archived') return { variant: 'neutral', label: 'Arkivert' }
  return { variant: 'draft', label: 'Utkast' }
}

function agendaSourceLabel(t: AmuAgendaItem['source_type']): string {
  switch (t) {
    case 'auto_deviation':
      return 'Avvik (auto)'
    case 'auto_sick_leave':
      return 'Sykefravær (auto)'
    case 'auto_whistleblowing':
      return 'Varsling (auto)'
    case 'auto_inspection':
      return 'Vernerunde (auto)'
    case 'auto_hms_plan':
      return 'HMS-plan (auto)'
    case 'employee_proposal':
      return 'Ansatt-forslag'
    case 'standard':
      return 'Lovpålagt'
    default:
      return 'Sak'
  }
}

function agendaStatusBadge(s: AmuAgendaItem['status']): ReactNode {
  if (s === 'decided') return <Badge variant="success">Vedtatt</Badge>
  if (s === 'active') return <Badge variant="warning">Pågår</Badge>
  if (s === 'deferred') return <Badge variant="neutral">Utsatt</Badge>
  return <Badge variant="draft">Venter</Badge>
}

function memberSideLabel(side: AmuMember['side']): string {
  return side === 'employer' ? 'Arbeidsgiver' : side === 'employee' ? 'Arbeidstaker' : 'BHT'
}

function memberRoleLabel(m: AmuMember): string {
  return m.role === 'leader'
    ? 'Leder'
    : m.role === 'deputy_leader'
      ? 'Nestleder'
      : m.voting
        ? 'Medlem'
        : 'Observatør'
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ── Building blocks ────────────────────────────────────────────────────────
function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex items-center rounded-md border border-neutral-300 bg-white">
      {([
        ['list', ListIcon, 'Liste'],
        ['box', LayoutGrid, 'Boks'],
      ] as const).map(([id, Icon, label], i) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className={[
            'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors',
            i === 0 ? 'rounded-l-md' : 'rounded-r-md border-l border-neutral-300',
            value === id
              ? 'bg-neutral-100 text-neutral-900'
              : 'text-neutral-700 hover:bg-neutral-50',
          ].join(' ')}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}

function HubSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative max-w-sm flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
      <StandardInput
        className="pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function HubTabButton({
  tab,
  active,
  onClick,
}: {
  tab: HubTab
  active: boolean
  onClick: () => void
}) {
  const Icon = tab.icon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'bg-[#1a3d32] text-white hover:bg-[#14312a]'
          : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {tab.label}
      {tab.count > 0 ? (
        <span
          className={`ml-0.5 rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
            active ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-700'
          }`}
        >
          {tab.count}
        </span>
      ) : null}
    </button>
  )
}

// ── Panels ─────────────────────────────────────────────────────────────────
function MeetingsPanel({
  meetings,
  agendaItems,
  view,
  search,
  onOpen,
}: {
  meetings: AmuMeeting[]
  agendaItems: AmuAgendaItem[]
  view: ViewMode
  search: string
  onOpen: (id: string) => void
}) {
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return meetings
      .filter(
        (m) =>
          !q ||
          m.title.toLowerCase().includes(q) ||
          (m.location ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
  }, [meetings, search])

  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-neutral-500">Ingen møter funnet.</p>
  }

  if (view === 'box') {
    return (
      <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((m) => {
          const ui = meetingStatusBadge(m.status)
          const itemCount = agendaItems.filter((a) => a.meeting_id === m.id).length
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpen(m.id)}
              className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7efe9] text-[#1a3d32]">
                  <CalendarDays className="h-5 w-5" aria-hidden />
                </div>
                <Badge variant={ui.variant}>{ui.label}</Badge>
              </div>
              <div className="min-w-0">
                <h3
                  className="line-clamp-2 text-base font-semibold leading-snug text-neutral-900"
                  style={SERIF}
                >
                  {m.title}
                </h3>
                <p className="mt-1.5 text-sm text-neutral-600">{fmtDate(m.scheduled_at, true)}</p>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
                  {m.location ?? '—'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
                  {itemCount} saker
                </span>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-neutral-50/60">
        <tr>
          <th className={MODULE_TABLE_TH}>Møte</th>
          <th className={MODULE_TABLE_TH}>Tidspunkt</th>
          <th className={MODULE_TABLE_TH}>Sted</th>
          <th className={MODULE_TABLE_TH}>Saker</th>
          <th className={MODULE_TABLE_TH}>Status</th>
          <th className={MODULE_TABLE_TH} />
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => {
          const ui = meetingStatusBadge(m.status)
          const itemCount = agendaItems.filter((a) => a.meeting_id === m.id).length
          return (
            <tr
              key={m.id}
              className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
              onClick={() => onOpen(m.id)}
            >
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e7efe9] text-[#1a3d32]">
                    <span className="text-[11px] font-semibold">Q{m.sequence_no}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-900">{m.title}</div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {m.year} · møte nr {m.sequence_no}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3 text-neutral-700">{fmtDate(m.scheduled_at, true)}</td>
              <td className="px-5 py-3 text-neutral-700">
                {m.location ?? '—'}
                {m.is_hybrid ? ' · hybrid' : ''}
              </td>
              <td className="px-5 py-3 tabular-nums text-neutral-700">{itemCount}</td>
              <td className="px-5 py-3">
                <Badge variant={ui.variant}>{ui.label}</Badge>
              </td>
              <td className="px-5 py-3 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpen(m.id)
                  }}
                >
                  Åpne <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function AgendaPanel({
  agendaItems,
  meetings,
  members,
  view,
  search,
}: {
  agendaItems: AmuAgendaItem[]
  meetings: AmuMeeting[]
  members: AmuMember[]
  view: ViewMode
  search: string
}) {
  const meetingMap = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings])
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return agendaItems
      .filter(
        (a) =>
          !q || a.title.toLowerCase().includes(q) || (a.legal_ref ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const ma = meetingMap.get(a.meeting_id)
        const mb = meetingMap.get(b.meeting_id)
        return (
          new Date(mb?.scheduled_at ?? 0).getTime() - new Date(ma?.scheduled_at ?? 0).getTime()
        )
      })
  }, [agendaItems, meetingMap, search])

  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-neutral-500">Ingen saker funnet.</p>
  }

  if (view === 'box') {
    return (
      <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((it) => {
          const meeting = meetingMap.get(it.meeting_id)
          const presenter = it.presenter_id ? memberMap.get(it.presenter_id) : null
          return (
            <div
              key={it.id}
              className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="rounded-md bg-[#f4f1ea] px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                  {agendaSourceLabel(it.source_type)}
                </span>
                {agendaStatusBadge(it.status)}
              </div>
              <h3
                className="line-clamp-2 text-base font-semibold leading-snug text-neutral-900"
                style={SERIF}
              >
                {it.title}
              </h3>
              <p className="text-sm text-neutral-600">
                {meeting?.title ?? '—'} · {fmtDate(meeting?.scheduled_at)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                {presenter ? (
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
                    {presenter.display_name}
                  </span>
                ) : null}
                {it.legal_ref ? (
                  <span className="font-mono text-[10px] text-neutral-500">{it.legal_ref}</span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-neutral-50/60">
        <tr>
          <th className={MODULE_TABLE_TH}>Sak</th>
          <th className={MODULE_TABLE_TH}>Møte</th>
          <th className={MODULE_TABLE_TH}>Kilde</th>
          <th className={MODULE_TABLE_TH}>Hjemmel</th>
          <th className={MODULE_TABLE_TH}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((it) => {
          const meeting = meetingMap.get(it.meeting_id)
          const presenter = it.presenter_id ? memberMap.get(it.presenter_id) : null
          return (
            <tr key={it.id} className={MODULE_TABLE_TR_BODY}>
              <td className="px-5 py-3">
                <div className="font-medium text-neutral-900">{it.title}</div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  {presenter?.display_name ?? '—'}
                </div>
              </td>
              <td className="px-5 py-3 text-neutral-700">{meeting?.title ?? '—'}</td>
              <td className="px-5 py-3 text-neutral-700">{agendaSourceLabel(it.source_type)}</td>
              <td className="px-5 py-3 text-neutral-700">{it.legal_ref ?? '—'}</td>
              <td className="px-5 py-3">{agendaStatusBadge(it.status)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function DecisionsPanel({
  decisions,
  agendaItems,
  meetings,
  members,
  view,
  search,
}: {
  decisions: AmuDecision[]
  agendaItems: AmuAgendaItem[]
  meetings: AmuMeeting[]
  members: AmuMember[]
  view: ViewMode
  search: string
}) {
  const itemMap = useMemo(() => new Map(agendaItems.map((a) => [a.id, a])), [agendaItems])
  const meetingMap = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings])
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return decisions.filter((d) => !q || d.decision_text.toLowerCase().includes(q))
  }, [decisions, search])

  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-neutral-500">Ingen vedtak funnet.</p>
  }

  if (view === 'box') {
    return (
      <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
        {rows.map((d) => {
          const it = itemMap.get(d.agenda_item_id)
          const meeting = it ? meetingMap.get(it.meeting_id) : null
          const r = d.responsible_member_id ? memberMap.get(d.responsible_member_id) : null
          return (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7efe9] text-[#1a3d32]">
                  <Gavel className="h-5 w-5" aria-hidden />
                </div>
                <Badge variant="success">
                  {d.votes_for}–{d.votes_against}–{d.votes_abstained}
                </Badge>
              </div>
              <h3 className="text-base font-semibold leading-snug text-neutral-900" style={SERIF}>
                {d.decision_text}
              </h3>
              <p className="text-sm text-neutral-600">
                {meeting?.title ?? '—'}
                {it ? ` · sak ${it.position}` : ''}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                {r ? (
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
                    {r.display_name}
                  </span>
                ) : null}
                {d.due_date ? (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
                    Frist {fmtDate(d.due_date)}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-neutral-50/60">
        <tr>
          <th className={MODULE_TABLE_TH}>Vedtak</th>
          <th className={MODULE_TABLE_TH}>Møte</th>
          <th className={MODULE_TABLE_TH}>Avstemming</th>
          <th className={MODULE_TABLE_TH}>Ansvarlig</th>
          <th className={MODULE_TABLE_TH}>Frist</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => {
          const it = itemMap.get(d.agenda_item_id)
          const meeting = it ? meetingMap.get(it.meeting_id) : null
          const r = d.responsible_member_id ? memberMap.get(d.responsible_member_id) : null
          return (
            <tr key={d.id} className={MODULE_TABLE_TR_BODY}>
              <td className="px-5 py-3">
                <div className="font-medium text-neutral-900">{d.decision_text}</div>
                {it ? (
                  <div className="mt-0.5 text-xs text-neutral-500">
                    Sak {it.position}: {it.title}
                  </div>
                ) : null}
              </td>
              <td className="px-5 py-3 text-neutral-700">{meeting?.title ?? '—'}</td>
              <td className="px-5 py-3 tabular-nums text-neutral-700">
                {d.votes_for}–{d.votes_against}–{d.votes_abstained}
              </td>
              <td className="px-5 py-3 text-neutral-700">{r?.display_name ?? '—'}</td>
              <td className="px-5 py-3 text-neutral-700">
                {d.due_date ? fmtDate(d.due_date) : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function MembersPanel({
  members,
  view,
  search,
}: {
  members: AmuMember[]
  view: ViewMode
  search: string
}) {
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter(
      (m) =>
        !q ||
        m.display_name.toLowerCase().includes(q) ||
        (m.function_label ?? '').toLowerCase().includes(q),
    )
  }, [members, search])

  function hmsBadge(m: AmuMember): ReactNode {
    if (!m.hms_training_valid_until) return <Badge variant="draft">Ikke påkrevd</Badge>
    const days = daysFromNow(m.hms_training_valid_until)
    if (days == null) return <Badge variant="draft">—</Badge>
    if (days < 0) return <Badge variant="danger">Utløpt</Badge>
    if (days < 90) return <Badge variant="warning">Utløper om {days} d</Badge>
    return <Badge variant="success">Gyldig</Badge>
  }

  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-neutral-500">Ingen medlemmer funnet.</p>
  }

  if (view === 'box') {
    return (
      <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((m) => (
          <div
            key={m.id}
            className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f1ea] text-[12px] font-semibold text-neutral-700">
                {initials(m.display_name)}
              </span>
              {hmsBadge(m)}
            </div>
            <div className="min-w-0">
              <h3
                className="text-base font-semibold leading-snug text-neutral-900"
                style={SERIF}
              >
                {m.display_name}
              </h3>
              <p className="mt-1 text-sm text-neutral-600">{m.function_label ?? '—'}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                {memberSideLabel(m.side)}
              </span>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                {memberRoleLabel(m)}
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-neutral-50/60">
        <tr>
          <th className={MODULE_TABLE_TH}>Medlem</th>
          <th className={MODULE_TABLE_TH}>Side</th>
          <th className={MODULE_TABLE_TH}>Funksjon</th>
          <th className={MODULE_TABLE_TH}>Rolle</th>
          <th className={MODULE_TABLE_TH}>HMS-kurs</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id} className={MODULE_TABLE_TR_BODY}>
            <td className="px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4f1ea] text-[11px] font-semibold text-neutral-700">
                  {initials(m.display_name)}
                </span>
                <div>
                  <div className="font-medium text-neutral-900">{m.display_name}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    Mandat til {fmtDate(m.term_end)}
                  </div>
                </div>
              </div>
            </td>
            <td className="px-5 py-3 text-neutral-700">{memberSideLabel(m.side)}</td>
            <td className="px-5 py-3 text-neutral-700">{m.function_label ?? '—'}</td>
            <td className="px-5 py-3 text-neutral-700">{memberRoleLabel(m)}</td>
            <td className="px-5 py-3">{hmsBadge(m)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

type ActionRow = {
  id: string
  title: string
  responsible_id: string | null
  due_date: string | null
}

function ActionsPanel({
  actions,
  members,
  view,
  search,
}: {
  actions: ActionRow[]
  members: AmuMember[]
  view: ViewMode
  search: string
}) {
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return actions.filter((a) => !q || a.title.toLowerCase().includes(q))
  }, [actions, search])

  function dueBadge(a: ActionRow): ReactNode {
    const days = daysFromNow(a.due_date)
    if (days == null) return <Badge variant="draft">Ingen frist</Badge>
    if (days < 0) return <Badge variant="danger">Forfalt {Math.abs(days)} d</Badge>
    if (days < 30) return <Badge variant="warning">{days} d igjen</Badge>
    return <Badge variant="info">{days} d igjen</Badge>
  }

  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-neutral-500">Ingen tiltak funnet.</p>
  }

  if (view === 'box') {
    return (
      <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((a) => (
          <div
            key={a.id}
            className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7efe9] text-[#1a3d32]">
                <CircleDashed className="h-5 w-5" aria-hidden />
              </div>
              {dueBadge(a)}
            </div>
            <h3 className="text-base font-semibold leading-snug text-neutral-900" style={SERIF}>
              {a.title}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
                {a.responsible_id ? (memberMap.get(a.responsible_id)?.display_name ?? '—') : '—'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
                {fmtDate(a.due_date)}
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-neutral-50/60">
        <tr>
          <th className={MODULE_TABLE_TH}>Tiltak</th>
          <th className={MODULE_TABLE_TH}>Ansvarlig</th>
          <th className={MODULE_TABLE_TH}>Frist</th>
          <th className={MODULE_TABLE_TH}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id} className={MODULE_TABLE_TR_BODY}>
            <td className="px-5 py-3 font-medium text-neutral-900">{a.title}</td>
            <td className="px-5 py-3 text-neutral-700">
              {a.responsible_id ? (memberMap.get(a.responsible_id)?.display_name ?? '—') : '—'}
            </td>
            <td className="px-5 py-3 text-neutral-700">{fmtDate(a.due_date)}</td>
            <td className="px-5 py-3">{dueBadge(a)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ReportsPanel({
  reports,
  view,
  search,
}: {
  reports: AmuAnnualReport[]
  view: ViewMode
  search: string
}) {
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return reports.filter((r) => !q || String(r.year).includes(q))
  }, [reports, search])

  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-neutral-500">Ingen rapporter funnet.</p>
  }

  function statusBadge(s: AmuAnnualReport['status']): ReactNode {
    if (s === 'signed') return <Badge variant="success">Signert</Badge>
    if (s === 'archived') return <Badge variant="neutral">Arkivert</Badge>
    return <Badge variant="draft">Kladd</Badge>
  }

  if (view === 'box') {
    return (
      <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7efe9] text-[#1a3d32]">
                <FileCheck2 className="h-5 w-5" aria-hidden />
              </div>
              {statusBadge(r.status)}
            </div>
            <h3 className="text-base font-semibold leading-snug text-neutral-900" style={SERIF}>
              Årsrapport {r.year}
            </h3>
            <p className="text-sm text-neutral-600">
              {r.signed_at ? `Signert ${fmtDate(r.signed_at)} · BankID` : 'Under arbeid'}
            </p>
            <div className="mt-1 border-t border-neutral-100 pt-3">
              <Button size="sm" variant="ghost" type="button" icon={<Download className="h-3.5 w-3.5" />}>
                Last ned PDF
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-neutral-50/60">
        <tr>
          <th className={MODULE_TABLE_TH}>År</th>
          <th className={MODULE_TABLE_TH}>Signert</th>
          <th className={MODULE_TABLE_TH}>Status</th>
          <th className={MODULE_TABLE_TH} />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={MODULE_TABLE_TR_BODY}>
            <td className="px-5 py-3 font-semibold text-neutral-900">{r.year}</td>
            <td className="px-5 py-3 text-neutral-700">
              {r.signed_at ? `${fmtDate(r.signed_at)} · BankID` : '—'}
            </td>
            <td className="px-5 py-3">{statusBadge(r.status)}</td>
            <td className="px-5 py-3 text-right">
              <Button size="sm" variant="ghost" type="button" icon={<Download className="h-3.5 w-3.5" />}>
                PDF
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Live meeting hero ──────────────────────────────────────────────────────
function formatHHMMSS(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000))
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function LiveMeetingHero({
  meeting,
  agendaCount,
  presentCount,
  totalMembers,
  onOpen,
}: {
  meeting: AmuMeeting
  agendaCount: number
  presentCount: number
  totalMembers: number
  onOpen: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const elapsed = formatHHMMSS(now - new Date(meeting.scheduled_at).getTime())

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-wrap items-center gap-3 rounded-xl bg-[#1a3d32] px-4 py-3 text-left text-white shadow-sm transition-colors hover:bg-[#14312a] sm:gap-4 sm:px-5"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/95 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-700 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-700" />
        </span>
        Pågår nå
      </span>
      <span className="flex-1 truncate text-sm font-semibold sm:text-base" style={SERIF}>
        {meeting.title}
      </span>
      <span className="hidden text-xs text-white/80 sm:inline">
        {agendaCount} saker · {presentCount}/{totalMembers} til stede
      </span>
      <span className="rounded bg-white/15 px-2 py-0.5 font-mono text-xs tabular-nums">{elapsed}</span>
      <span className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#1a3d32] hover:bg-neutral-100">
        Gå inn i møterom
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </span>
    </button>
  )
}

// ── Compliance scorecard panel ─────────────────────────────────────────────
type CompRow = {
  label: string
  ok: boolean
  partial?: boolean
  ref: string
  detail: string
}

function CompliancePanel({ rows }: { rows: CompRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 px-5 py-5 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className={`flex items-start gap-3 rounded-lg border p-3 ${
            row.ok
              ? 'border-neutral-200 bg-white'
              : row.partial
                ? 'border-amber-200 bg-amber-50'
                : 'border-red-200 bg-red-50'
          }`}
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              row.ok
                ? 'bg-green-100 text-green-700'
                : row.partial
                  ? 'bg-amber-200 text-amber-800'
                  : 'bg-red-100 text-red-700'
            }`}
          >
            {row.ok ? (
              <Check className="h-3 w-3" strokeWidth={3} />
            ) : row.partial ? (
              <AlertTriangle className="h-3 w-3" strokeWidth={3} />
            ) : (
              <X className="h-3 w-3" strokeWidth={3} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-neutral-900">{row.label}</p>
              <span className="font-mono text-[10px] text-neutral-500">{row.ref}</span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-600">{row.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
const TAB_META: Record<HubTabId, { title: string; placeholder: string }> = {
  moter: { title: 'Møter', placeholder: 'Søk i møter…' },
  saker: { title: 'Saker', placeholder: 'Søk i saker eller hjemmel…' },
  vedtak: { title: 'Vedtak', placeholder: 'Søk i vedtak…' },
  medlemmer: { title: 'Medlemmer', placeholder: 'Søk etter navn eller funksjon…' },
  tiltak: { title: 'Tiltak', placeholder: 'Søk i tiltak…' },
  rapporter: { title: 'Årsrapporter', placeholder: 'Søk på år…' },
  etterlevelse: { title: 'Etterlevelse', placeholder: '' },
}

export function AmuPage({
  tabs: hubRootTabs,
  hideAdminNav: _hideAdminNav = false,
}: {
  /** Ytre faner (f.eks. Møter / Innstillinger) fra `AmuHubPage`. */
  tabs?: ReactNode
  hideAdminNav?: boolean
} = {}) {
  const amu = useAmu()
  const currentYear = new Date().getFullYear()
  const [activeTab, setActiveTab] = useState<HubTabId>('moter')
  const [view, setView] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [openMeetingId, setOpenMeetingId] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState<YearFilter>(currentYear)

  // ── Available years (derived from data) ────────────────────────────────
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    years.add(currentYear)
    amu.meetings.forEach((m) => years.add(m.year))
    amu.annualReports.forEach((r) => years.add(r.year))
    return Array.from(years).sort((a, b) => b - a)
  }, [amu.meetings, amu.annualReports, currentYear])

  // Helper: meeting -> year (already on AmuMeeting); decisions -> via agenda meeting.
  const meetingYearById = useMemo(
    () => new Map(amu.meetings.map((m) => [m.id, m.year])),
    [amu.meetings],
  )
  const itemMeetingYearById = useMemo(() => {
    const map = new Map<string, number | null>()
    amu.agendaItems.forEach((a) => {
      map.set(a.id, meetingYearById.get(a.meeting_id) ?? null)
    })
    return map
  }, [amu.agendaItems, meetingYearById])

  function yearMatches(y: number | null): boolean {
    if (yearFilter === 'all') return true
    return y === yearFilter
  }

  // ── Filtered datasets ──────────────────────────────────────────────────
  const filteredMeetings = useMemo(
    () => amu.meetings.filter((m) => yearMatches(m.year)),
    [amu.meetings, yearFilter],
  )
  const filteredAgenda = useMemo(
    () => amu.agendaItems.filter((a) => yearMatches(meetingYearById.get(a.meeting_id) ?? null)),
    [amu.agendaItems, meetingYearById, yearFilter],
  )
  const filteredDecisions = useMemo(
    () => amu.decisions.filter((d) => yearMatches(itemMeetingYearById.get(d.agenda_item_id) ?? null)),
    [amu.decisions, itemMeetingYearById, yearFilter],
  )
  const filteredReports = useMemo(
    () => amu.annualReports.filter((r) => yearMatches(r.year)),
    [amu.annualReports, yearFilter],
  )

  // Action items derived from decisions with a responsible + due_date — year-filtered
  const allActions: ActionRow[] = useMemo(
    () =>
      amu.decisions
        .filter((d) => d.due_date)
        .map<ActionRow>((d) => ({
          id: d.id,
          title: d.decision_text,
          responsible_id: d.responsible_member_id,
          due_date: d.due_date,
        }))
        .sort((a, b) => new Date(a.due_date ?? 0).getTime() - new Date(b.due_date ?? 0).getTime()),
    [amu.decisions],
  )
  const filteredActions = useMemo(() => {
    if (yearFilter === 'all') return allActions
    return allActions.filter((a) => {
      if (!a.due_date) return false
      return new Date(a.due_date).getFullYear() === yearFilter
    })
  }, [allActions, yearFilter])

  // ── Derived stats / KPIs ───────────────────────────────────────────────
  const comp = amu.compliance
  const employer = amu.members.filter((m) => m.side === 'employer' && m.active).length
  const employee = amu.members.filter((m) => m.side === 'employee' && m.active).length
  const meetingsHeld = filteredMeetings.filter((m) => m.status === 'signed').length
  const meetingsRequired = comp?.meetings_required ?? 4
  const meetingsScheduled = filteredMeetings.length
  const expiringHmsCount = amu.members.filter((m) => {
    const d = daysFromNow(m.hms_training_valid_until ?? null)
    return d != null && d < 90
  }).length

  // ── Live meeting (any year) ────────────────────────────────────────────
  const liveMeeting = useMemo(
    () => amu.meetings.find((m) => m.status === 'in_progress'),
    [amu.meetings],
  )
  const liveAgendaCount = liveMeeting
    ? amu.agendaItems.filter((a) => a.meeting_id === liveMeeting.id).length
    : 0
  const livePresentCount = liveMeeting
    ? amu.attendance.filter(
        (a) =>
          a.meeting_id === liveMeeting.id && (a.status === 'present' || a.status === 'digital'),
      ).length
    : 0

  // ── Compliance rows for Etterlevelse panel ─────────────────────────────
  const complianceRows: CompRow[] = useMemo(() => {
    if (!comp) return []
    const requiredYearLabel = yearFilter === 'all' ? currentYear : yearFilter
    return [
      {
        label: 'Minst 4 møter i året',
        ok: comp.meetings_held >= comp.meetings_required,
        partial: meetingsScheduled >= comp.meetings_required,
        ref: 'AML § 7-2',
        detail: `${comp.meetings_held} avholdt · ${meetingsScheduled} berammet i ${requiredYearLabel}`,
      },
      {
        label: 'Lik representasjon (paritet)',
        ok: comp.parity_ok,
        ref: 'AML § 7-1 (2)',
        detail:
          employer === employee
            ? `${employer} fra hver side`
            : `${employer} arbeidsgiver vs ${employee} arbeidstaker — krever justering`,
      },
      {
        label: 'BHT representert',
        ok: comp.bht_present,
        ref: 'AML § 7-1 (3)',
        detail: amu.committee?.bht_provider ?? (comp.bht_present ? 'BHT er representert' : 'Mangler'),
      },
      {
        label: 'HMS-kurs (40t) gyldig for alle',
        ok: comp.hms_training_all_valid,
        ref: 'FOR § 3-18',
        detail:
          comp.hms_training_all_valid && expiringHmsCount === 0
            ? 'Alle gyldige'
            : expiringHmsCount > 0
              ? `${expiringHmsCount} utløper innen 90 dager`
              : 'En eller flere har utløpt',
      },
      {
        label: `Årsrapport ${requiredYearLabel - 1} signert`,
        ok: comp.annual_report_signed,
        ref: 'AML § 7-2 (6)',
        detail: comp.annual_report_signed ? 'Signert og arkivert' : 'Ikke signert',
      },
      {
        label: 'Rotering av lederverv',
        ok: comp.legal_refs_satisfied.some((r) => r.includes('7-5')),
        ref: 'AML § 7-5',
        detail: amu.committee
          ? `${amu.committee.term_start.slice(0, 4)}: ${amu.committee.chair_side === 'employee' ? 'arbeidstakerside' : 'arbeidsgiverside'}`
          : 'Konfigurer utvalg',
      },
      {
        label: 'Innkalling ≥ 14 dager før møte',
        ok: true,
        ref: 'God praksis',
        detail: 'Auto-utsendelse aktivert',
      },
      {
        label: 'Referat distribueres til alle ansatte',
        ok: true,
        ref: 'AML § 7-2 (6)',
        detail: 'Auto-distribusjon på · arbeidsflyt aktiv',
      },
    ]
  }, [
    comp,
    yearFilter,
    currentYear,
    meetingsScheduled,
    employer,
    employee,
    expiringHmsCount,
    amu.committee,
  ])

  const tabs: HubTab[] = [
    { id: 'moter', label: 'Møter', icon: CalendarDays, count: filteredMeetings.length },
    { id: 'saker', label: 'Saker', icon: ListChecks, count: filteredAgenda.length },
    { id: 'vedtak', label: 'Vedtak', icon: Gavel, count: filteredDecisions.length },
    { id: 'medlemmer', label: 'Medlemmer', icon: Users, count: amu.members.length },
    { id: 'tiltak', label: 'Tiltak', icon: CircleDashed, count: filteredActions.length },
    { id: 'rapporter', label: 'Rapporter', icon: FileCheck2, count: filteredReports.length },
    {
      id: 'etterlevelse',
      label: 'Etterlevelse',
      icon: ShieldCheck,
      count: complianceRows.filter((r) => !r.ok).length,
    },
  ]

  const kpis = [
    {
      big: `${meetingsHeld}/${meetingsRequired}`,
      title: 'Møter avholdt',
      sub:
        yearFilter === 'all'
          ? 'AML § 7-2 · alle år'
          : `${meetingsScheduled} planlagt i ${yearFilter} · AML § 7-2`,
    },
    {
      big: comp?.parity_ok === false ? 'Skjev' : 'OK',
      title: 'Sammensetning',
      sub: `${employer} arb.giver · ${employee} arb.taker`,
    },
    {
      big: expiringHmsCount > 0 ? String(expiringHmsCount) : 'Alle',
      title: 'HMS-kurs',
      sub: expiringHmsCount > 0 ? 'Utløper innen 90 d' : 'Gyldige · FOR § 3-18',
    },
    {
      big: String(filteredActions.length),
      title: 'Åpne tiltak',
      sub:
        yearFilter === 'all'
          ? 'Vedtak under oppfølging'
          : `Med frist i ${yearFilter}`,
    },
  ]

  // ── Detail mode (drilled into a single meeting) ────────────────────────
  if (openMeetingId) {
    return (
      <AmuMeetingDetail
        amu={amu}
        meetingId={openMeetingId}
        onBack={() => setOpenMeetingId(null)}
        hubRootTabs={hubRootTabs}
      />
    )
  }

  // ── Hub view ───────────────────────────────────────────────────────────
  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Medvirkning' }, { label: 'AMU-møter' }]}
      title="AMU-møter"
      description={
        amu.committee
          ? `${amu.committee.name} · ${amu.committee.term_start.slice(0, 4)}–${amu.committee.term_end.slice(0, 4)}`
          : undefined
      }
      headerActions={
        <>
          <Button variant="secondary" type="button" icon={<ListChecks className="h-4 w-4" />}>
            Maler
          </Button>
          {amu.canManage ? (
            <Button variant="primary" type="button" icon={<Plus className="h-4 w-4" />}>
              Nytt møte
            </Button>
          ) : null}
        </>
      }
      tabs={hubRootTabs}
      loading={amu.loading}
    >
      <ModuleLegalBanner
        title="Regelverk for arbeidsmiljøutvalg"
        intro={
          <p>
            Arbeidsmiljøutvalget (AMU) er lovpålagt for virksomheter med 50 eller flere ansatte (eller 20+
            når en av partene krever det) og forankres i arbeidsmiljølovens kapittel 7, internkontroll­
            forskriften § 5 og forskrift om organisering, ledelse og medvirkning § 3-18.
          </p>
        }
        references={AMU_MODULE_LEGAL_REFERENCES}
      />

      {amu.error ? <WarningBox>{amu.error}</WarningBox> : null}

      {liveMeeting ? (
        <LiveMeetingHero
          meeting={liveMeeting}
          agendaCount={liveAgendaCount}
          presentCount={livePresentCount}
          totalMembers={amu.members.length}
          onOpen={() => {
            setOpenMeetingId(liveMeeting.id)
            void amu.loadMeetingDetail(liveMeeting.id).catch(() => {})
          }}
        />
      ) : null}

      <LayoutScoreStatRow items={kpis} />

      <ModuleSectionCard className="!p-0">
        <LayoutTable1PostingsShell
          wrap={false}
          titleTypography="sans"
          title={TAB_META[activeTab].title}
          headerActions={
            <div className="flex items-center gap-2">
              <div className="hidden min-w-[140px] sm:block">
                <SearchableSelect
                  value={yearFilter === 'all' ? 'all' : String(yearFilter)}
                  options={[
                    { value: 'all', label: 'Alle år' },
                    ...availableYears.map((y) => ({ value: String(y), label: String(y) })),
                  ]}
                  onChange={(v) => setYearFilter(v === 'all' ? 'all' : Number(v))}
                />
              </div>
              {activeTab !== 'etterlevelse' ? (
                <ViewToggle value={view} onChange={setView} />
              ) : null}
            </div>
          }
          toolbar={
            <>
              {activeTab !== 'etterlevelse' ? (
                <HubSearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder={TAB_META[activeTab].placeholder}
                />
              ) : (
                <span className="text-sm text-neutral-600">
                  Samsvarsstatus mot AML kap. 7, IK-forskriften § 5 og FOR § 3-18.
                </span>
              )}
              <div className="flex flex-wrap items-stretch gap-2">
                {tabs.map((t) => (
                  <HubTabButton
                    key={t.id}
                    tab={t}
                    active={t.id === activeTab}
                    onClick={() => {
                      setActiveTab(t.id)
                      setSearch('')
                    }}
                  />
                ))}
              </div>
            </>
          }
        >
          {activeTab === 'moter' && (
            <MeetingsPanel
              meetings={filteredMeetings}
              agendaItems={amu.agendaItems}
              view={view}
              search={search}
              onOpen={(id) => {
                setOpenMeetingId(id)
                void amu.loadMeetingDetail(id).catch(() => {})
              }}
            />
          )}
          {activeTab === 'saker' && (
            <AgendaPanel
              agendaItems={filteredAgenda}
              meetings={amu.meetings}
              members={amu.members}
              view={view}
              search={search}
            />
          )}
          {activeTab === 'vedtak' && (
            <DecisionsPanel
              decisions={filteredDecisions}
              agendaItems={amu.agendaItems}
              meetings={amu.meetings}
              members={amu.members}
              view={view}
              search={search}
            />
          )}
          {activeTab === 'medlemmer' && (
            <MembersPanel members={amu.members} view={view} search={search} />
          )}
          {activeTab === 'tiltak' && (
            <ActionsPanel actions={filteredActions} members={amu.members} view={view} search={search} />
          )}
          {activeTab === 'rapporter' && (
            <ReportsPanel reports={filteredReports} view={view} search={search} />
          )}
          {activeTab === 'etterlevelse' && <CompliancePanel rows={complianceRows} />}
        </LayoutTable1PostingsShell>
      </ModuleSectionCard>
    </ModulePageShell>
  )
}
