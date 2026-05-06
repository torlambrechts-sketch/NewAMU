import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  Calendar,
  Download,
  Gavel,
  Info,
  LayoutGrid,
  List as ListIcon,
  ListChecks,
  Paperclip,
  PlayCircle,
  Scale,
  User,
  Users,
} from 'lucide-react'
import {
  MODULE_TABLE_TH,
  MODULE_TABLE_TR_BODY,
  ModuleLegalBanner,
  ModulePageShell,
  ModuleSectionCard,
} from '../../src/components/module'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import { Badge, type BadgeVariant } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { AMU_MODULE_LEGAL_REFERENCES, AMU_DETAIL_EXTRA_LEGAL_REFERENCES } from './amuLegalReferences'
import type { AmuHook } from './tabs/types'
import type {
  AmuAgendaItem,
  AmuAttendance,
  AmuDecision,
  AmuMeeting,
  AmuMember,
} from './types'

const SERIF: React.CSSProperties = { fontFamily: "'Libre Baskerville', Georgia, serif" }
const NB_MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

type ViewMode = 'list' | 'box'
type DetailTab = 'informasjon' | 'saksliste' | 'vedtak' | 'fremmote' | 'vedlegg' | 'lovverk'

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

function attStatusBadge(s: AmuAttendance['status']): ReactNode {
  if (s === 'present') return <Badge variant="success">Til stede</Badge>
  if (s === 'digital') return <Badge variant="info">Digitalt</Badge>
  if (s === 'excused') return <Badge variant="warning">Meldt forfall</Badge>
  return <Badge variant="danger">Ikke møtt</Badge>
}

function memberSideLabel(side: AmuMember['side']): string {
  return side === 'employer' ? 'Arbeidsgiver' : side === 'employee' ? 'Arbeidstaker' : 'BHT'
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

// ── Informasjon ────────────────────────────────────────────────────────────
function InfoTab({
  meeting,
  items,
  decisions,
  attendance,
  committeeName,
}: {
  meeting: AmuMeeting
  items: AmuAgendaItem[]
  decisions: AmuDecision[]
  attendance: AmuAttendance[]
  committeeName: string
}) {
  const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'digital').length
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Innkalling</p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">
              {meeting.title} for {committeeName}. {items.length} saker er meldt inn. Møtet følger
              arbeidsmiljøloven kapittel 7 og internkontrollforskriften § 5.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Forberedelser</p>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
              <li>• Innkalling sendt minst 14 dager før møte</li>
              <li>• Saker fra avvik, varsling og sykefravær lagt til automatisk</li>
              <li>• Vedlegg tilgjengelig for alle medlemmer</li>
            </ul>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Detaljer</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Dato</dt>
                <dd className="font-medium text-neutral-900">{fmtDate(meeting.scheduled_at, true)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Sted</dt>
                <dd className="font-medium text-neutral-900">
                  {meeting.location ?? '—'}
                  {meeting.is_hybrid ? ' · hybrid' : ''}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Møte nr.</dt>
                <dd className="font-medium text-neutral-900">
                  Q{meeting.sequence_no}/{meeting.year}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Saker</dt>
                <dd className="font-medium text-neutral-900">{items.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500">Vedtak</dt>
                <dd className="font-medium text-neutral-900">{decisions.length}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Fremmøte</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-2xl font-bold tabular-nums text-green-700">{presentCount}</p>
                <p className="text-xs text-neutral-500">Til stede</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{attendance.length}</p>
                <p className="text-xs text-neutral-500">Innkalt totalt</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModuleSectionCard>
  )
}

// ── Saksliste ──────────────────────────────────────────────────────────────
function AgendaTab({
  items,
  memberMap,
  view,
}: {
  items: AmuAgendaItem[]
  memberMap: Map<string, AmuMember>
  view: ViewMode
}) {
  if (items.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-neutral-500">Ingen saker enda.</p>
  }
  if (view === 'box') {
    return (
      <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => {
          const presenter = it.presenter_id ? memberMap.get(it.presenter_id) : null
          return (
            <div
              key={it.id}
              className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7efe9] text-[12px] font-semibold text-[#1a3d32]">
                  {it.position}
                </span>
                {agendaStatusBadge(it.status)}
              </div>
              <h3
                className="line-clamp-2 text-base font-semibold leading-snug text-neutral-900"
                style={SERIF}
              >
                {it.title}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                  {agendaSourceLabel(it.source_type)}
                </span>
                {it.legal_ref ? (
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                    {it.legal_ref}
                  </span>
                ) : null}
              </div>
              {presenter ? (
                <div className="mt-1 flex items-center gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                  <User className="h-3.5 w-3.5 text-neutral-500" aria-hidden />
                  {presenter.display_name}
                </div>
              ) : null}
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
          <th className={MODULE_TABLE_TH}>#</th>
          <th className={MODULE_TABLE_TH}>Sak</th>
          <th className={MODULE_TABLE_TH}>Kilde</th>
          <th className={MODULE_TABLE_TH}>Hjemmel</th>
          <th className={MODULE_TABLE_TH}>Saksbehandler</th>
          <th className={MODULE_TABLE_TH}>Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <tr key={it.id} className={MODULE_TABLE_TR_BODY}>
            <td className="px-5 py-3 tabular-nums text-neutral-500">{it.position}</td>
            <td className="px-5 py-3 font-medium text-neutral-900">{it.title}</td>
            <td className="px-5 py-3 text-neutral-700">{agendaSourceLabel(it.source_type)}</td>
            <td className="px-5 py-3 text-neutral-700">{it.legal_ref ?? '—'}</td>
            <td className="px-5 py-3 text-neutral-700">
              {it.presenter_id ? (memberMap.get(it.presenter_id)?.display_name ?? '—') : '—'}
            </td>
            <td className="px-5 py-3">{agendaStatusBadge(it.status)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Vedtak ─────────────────────────────────────────────────────────────────
function DecisionsTab({
  decisions,
  itemMap,
  memberMap,
  view,
}: {
  decisions: AmuDecision[]
  itemMap: Map<string, AmuAgendaItem>
  memberMap: Map<string, AmuMember>
  view: ViewMode
}) {
  if (decisions.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-neutral-500">Ingen vedtak enda.</p>
  }
  if (view === 'box') {
    return (
      <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
        {decisions.map((d) => {
          const it = itemMap.get(d.agenda_item_id)
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
              {it ? (
                <p className="text-sm text-neutral-600">
                  Sak {it.position}: {it.title}
                </p>
              ) : null}
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
                    {fmtDate(d.due_date)}
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
          <th className={MODULE_TABLE_TH}>Sak</th>
          <th className={MODULE_TABLE_TH}>Vedtak</th>
          <th className={MODULE_TABLE_TH}>Avstemming</th>
          <th className={MODULE_TABLE_TH}>Ansvarlig</th>
          <th className={MODULE_TABLE_TH}>Frist</th>
        </tr>
      </thead>
      <tbody>
        {decisions.map((d) => {
          const it = itemMap.get(d.agenda_item_id)
          const r = d.responsible_member_id ? memberMap.get(d.responsible_member_id) : null
          return (
            <tr key={d.id} className={MODULE_TABLE_TR_BODY}>
              <td className="px-5 py-3 text-neutral-700">{it ? `Sak ${it.position}` : '—'}</td>
              <td className="px-5 py-3 font-medium text-neutral-900">{d.decision_text}</td>
              <td className="px-5 py-3 tabular-nums text-neutral-700">
                {d.votes_for}–{d.votes_against}–{d.votes_abstained}
              </td>
              <td className="px-5 py-3 text-neutral-700">{r?.display_name ?? '—'}</td>
              <td className="px-5 py-3 text-neutral-700">{d.due_date ? fmtDate(d.due_date) : '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Fremmøte ───────────────────────────────────────────────────────────────
function AttendanceTab({
  attendance,
  memberMap,
  view,
}: {
  attendance: AmuAttendance[]
  memberMap: Map<string, AmuMember>
  view: ViewMode
}) {
  if (attendance.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-neutral-500">Ingen fremmøte registrert ennå.</p>
  }
  if (view === 'box') {
    return (
      <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3">
        {attendance.map((a) => {
          const m = memberMap.get(a.member_id)
          if (!m) return null
          return (
            <div
              key={`${a.meeting_id}-${a.member_id}`}
              className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f1ea] text-[12px] font-semibold text-neutral-700">
                  {initials(m.display_name)}
                </span>
                {attStatusBadge(a.status)}
              </div>
              <h3 className="text-base font-semibold leading-snug text-neutral-900" style={SERIF}>
                {m.display_name}
              </h3>
              <p className="text-sm text-neutral-600">{m.function_label ?? '—'}</p>
              <span className="self-start rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                {memberSideLabel(m.side)}
              </span>
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
          <th className={MODULE_TABLE_TH}>Medlem</th>
          <th className={MODULE_TABLE_TH}>Side</th>
          <th className={MODULE_TABLE_TH}>Funksjon</th>
          <th className={MODULE_TABLE_TH}>Status</th>
        </tr>
      </thead>
      <tbody>
        {attendance.map((a) => {
          const m = memberMap.get(a.member_id)
          if (!m) return null
          return (
            <tr key={`${a.meeting_id}-${a.member_id}`} className={MODULE_TABLE_TR_BODY}>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e7efe9] text-[11px] font-semibold text-[#1a3d32]">
                    {initials(m.display_name)}
                  </span>
                  <span className="font-medium text-neutral-900">{m.display_name}</span>
                </div>
              </td>
              <td className="px-5 py-3 text-neutral-700">{memberSideLabel(m.side)}</td>
              <td className="px-5 py-3 text-neutral-700">{m.function_label ?? '—'}</td>
              <td className="px-5 py-3">{attStatusBadge(a.status)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Vedlegg (placeholder) ─────────────────────────────────────────────────
function AttachmentsTab({ view }: { view: ViewMode }) {
  // Real attachment store can be wired in later; for now show a structured placeholder
  // so the tab matches the v4 design and is testable from the UI.
  return (
    <div className="px-5 py-10 text-center text-sm text-neutral-500">
      Vedlegg knyttes til møtet via Dokumenter-modulen. {view === 'box' ? 'Boks-visning' : 'Listevisning'} blir aktivert
      når dokumenter kobles til.
    </div>
  )
}

// ── Lovverk ───────────────────────────────────────────────────────────────
function LovverkTab() {
  return (
    <ModuleLegalBanner
      title="Lovgrunnlag for AMU-møtet"
      intro={
        <p>
          Møtet og protokollen oppfyller arbeidsmiljølovens krav til AMU-arbeid og dokumentasjon. Saker som
          berører varsling eller personalsaker behandles under taushetsplikt.
        </p>
      }
      references={[...AMU_MODULE_LEGAL_REFERENCES, ...AMU_DETAIL_EXTRA_LEGAL_REFERENCES]}
    />
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export function AmuMeetingDetail({
  amu,
  meetingId,
  onBack,
  hubRootTabs,
}: {
  amu: AmuHook
  meetingId: string
  onBack: () => void
  hubRootTabs?: ReactNode
}) {
  const [tab, setTab] = useState<DetailTab>('informasjon')
  const [view, setView] = useState<ViewMode>('list')

  const meeting = amu.meetings.find((m) => m.id === meetingId)
  const items = useMemo(
    () =>
      amu.agendaItems
        .filter((a) => a.meeting_id === meetingId)
        .slice()
        .sort((a, b) => a.position - b.position),
    [amu.agendaItems, meetingId],
  )
  const itemIds = useMemo(() => new Set(items.map((i) => i.id)), [items])
  const decisions = useMemo(
    () => amu.decisions.filter((d) => itemIds.has(d.agenda_item_id)),
    [amu.decisions, itemIds],
  )
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const memberMap = useMemo(() => new Map(amu.members.map((m) => [m.id, m])), [amu.members])
  const attendance = useMemo(
    () => amu.attendance.filter((a) => a.meeting_id === meetingId),
    [amu.attendance, meetingId],
  )

  if (!meeting) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Medvirkning' },
          { label: 'AMU-møter' },
          { label: 'Møte' },
        ]}
        title="Møtet finnes ikke"
        headerActions={
          <Button
            variant="secondary"
            type="button"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={onBack}
          >
            Tilbake til oversikt
          </Button>
        }
        tabs={hubRootTabs}
      >
        <WarningBox>Fant ikke møtet du ba om — det kan være slettet eller arkivert.</WarningBox>
      </ModulePageShell>
    )
  }

  const ui = meetingStatusBadge(meeting.status)

  const tabItems: TabItem[] = [
    { id: 'informasjon', label: 'Informasjon', icon: Info },
    { id: 'saksliste', label: 'Saksliste', icon: ListChecks, badgeCount: items.length },
    { id: 'vedtak', label: 'Vedtak', icon: Gavel, badgeCount: decisions.length },
    { id: 'fremmote', label: 'Fremmøte', icon: Users, badgeCount: attendance.length },
    { id: 'vedlegg', label: 'Vedlegg', icon: Paperclip },
    { id: 'lovverk', label: 'Lovverk', icon: Scale },
  ]

  const showShell = tab !== 'informasjon' && tab !== 'lovverk'
  const sectionTitle: Record<DetailTab, string> = {
    informasjon: 'Informasjon',
    saksliste: 'Saksliste',
    vedtak: 'Vedtak',
    fremmote: 'Fremmøte',
    vedlegg: 'Vedlegg',
    lovverk: 'Lovverk',
  }

  const tabsNode = (
    <Tabs items={tabItems} activeId={tab} onChange={(id) => setTab(id as DetailTab)} />
  )

  const headerActions = (
    <>
      <Button
        variant="secondary"
        type="button"
        size="sm"
        icon={<ArrowLeft className="h-3.5 w-3.5" />}
        onClick={onBack}
      >
        Tilbake til oversikt
      </Button>
      {meeting.status === 'signed' ? (
        <Button type="button" size="sm" icon={<Download className="h-3.5 w-3.5" />}>
          Last ned referat
        </Button>
      ) : meeting.status === 'in_progress' ? (
        <Button type="button" size="sm" icon={<PlayCircle className="h-3.5 w-3.5" />}>
          Fortsett møtet
        </Button>
      ) : meeting.status === 'scheduled' || meeting.status === 'draft' ? (
        amu.canManage ? (
          <Button
            type="button"
            size="sm"
            icon={<PlayCircle className="h-3.5 w-3.5" />}
            onClick={() => void amu.startMeeting(meeting.id)}
          >
            Start møtet
          </Button>
        ) : null
      ) : null}
    </>
  )

  const description = (
    <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
      <span>{fmtDate(meeting.scheduled_at, true)}</span>
      <span className="text-neutral-300">·</span>
      <span>
        {meeting.location ?? '—'}
        {meeting.is_hybrid ? ' · hybrid' : ''}
      </span>
      <Badge variant={ui.variant}>{ui.label}</Badge>
    </div>
  )

  const tabsForShell = hubRootTabs ? (
    <div className="flex flex-col gap-2">
      {hubRootTabs}
      {tabsNode}
    </div>
  ) : (
    tabsNode
  )

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Medvirkning' },
        { label: 'AMU-møter' },
        { label: meeting.title },
      ]}
      title={meeting.title}
      description={description}
      headerActions={headerActions}
      tabs={tabsForShell}
      loading={amu.loading}
    >
      {amu.error ? <WarningBox>{amu.error}</WarningBox> : null}

      {tab === 'informasjon' ? (
        <InfoTab
          meeting={meeting}
          items={items}
          decisions={decisions}
          attendance={attendance}
          committeeName={amu.committee?.name ?? 'AMU'}
        />
      ) : null}

      {tab === 'lovverk' ? <LovverkTab /> : null}

      {showShell ? (
        <ModuleSectionCard className="!p-0">
          <LayoutTable1PostingsShell
            wrap={false}
            titleTypography="sans"
            title={sectionTitle[tab]}
            headerActions={<ViewToggle value={view} onChange={setView} />}
            toolbar={<span className="text-xs text-neutral-500" />}
          >
            {tab === 'saksliste' ? <AgendaTab items={items} memberMap={memberMap} view={view} /> : null}
            {tab === 'vedtak' ? (
              <DecisionsTab decisions={decisions} itemMap={itemMap} memberMap={memberMap} view={view} />
            ) : null}
            {tab === 'fremmote' ? (
              <AttendanceTab attendance={attendance} memberMap={memberMap} view={view} />
            ) : null}
            {tab === 'vedlegg' ? <AttachmentsTab view={view} /> : null}
          </LayoutTable1PostingsShell>
        </ModuleSectionCard>
      ) : null}
    </ModulePageShell>
  )
}
