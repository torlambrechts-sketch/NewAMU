// SurveyHubRecordsShell — two-column Records-shell for the survey hub.
//
// Renders INSIDE an existing ModulePageShell (no wrapping shell here).
// Left rail: category chips (mobile) + vertical list (desktop).
// Right card: tab strip (Undersøkelser / Maler / Resultater) + search + 4 view modes.
//
// Category rail active state: forest green (#e7efe9 / #1a3d32) per design.
// Tab strip active state: survey purple (#7c3aed) — hub-level accent.

import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Columns3,
  Eye,
  EyeOff,
  FileText,
  Flame,
  Globe,
  GripVertical,
  Hash,
  LayoutGrid,
  Link2,
  Mail,
  MessageCircle,
  Rows3,
  Scan,
  Search,
  Send,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import type { BadgeVariant } from '../../src/components/ui/Badge'
import type { SurveyRow, SurveyCategoryRow } from './types'
import type { SurveyTemplateCatalogRow } from './surveyTemplateCatalogTypes'
import { ResponseRing } from './components/ResponseRing'

// ─── Accent — purple for tab strip, green for category rail ──────────────────

const ACCENT = '#7c3aed'

// Category rail green active state (design-spec)
const CAT_ACTIVE_BG     = '#e7efe9'
const CAT_ACTIVE_BORDER = '#1a3d32'
const CAT_ACTIVE_TEXT   = '#14312a'

// ─── Display types ────────────────────────────────────────────────────────────

type SurveyDisplayStatus = 'kladd' | 'aktiv' | 'lukket' | 'arkivert'

type MappedSurvey = {
  id: string
  catalogId: string | null
  title: string
  pack: string
  status: SurveyDisplayStatus
  surveyType: string
  due: string
  dueRaw: Date | null
  startDate: string
  responseCount: number
  invitationCount: number
  isAnonymous: boolean
  /** No DB column yet — always empty until migration adds distribution_channels */
  channels: string[]
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SurveyDisplayStatus, { label: string; variant: BadgeVariant }> = {
  kladd:    { label: 'Kladd',    variant: 'draft' },
  aktiv:    { label: 'Aktiv',    variant: 'active' },
  lukket:   { label: 'Lukket',   variant: 'signed' },
  arkivert: { label: 'Arkivert', variant: 'neutral' },
}

// ─── Kanban columns ───────────────────────────────────────────────────────────

const KANBAN_COLS: { id: SurveyDisplayStatus; label: string; accent: string }[] = [
  { id: 'kladd',    label: 'Kladd',    accent: '#a3a3a3' },
  { id: 'aktiv',    label: 'Aktiv',    accent: '#2563EB' },
  { id: 'lukket',   label: 'Lukket',   accent: '#2F7757' },
  { id: 'arkivert', label: 'Arkivert', accent: '#6b7280' },
]

// ─── View modes ───────────────────────────────────────────────────────────────

const VIEW_MODES = [
  { id: 'tabell',    label: 'Tabell',    Icon: Rows3 },
  { id: 'bokser',    label: 'Bokser',    Icon: LayoutGrid },
  { id: 'tidslinje', label: 'Tidslinje', Icon: CalendarDays },
  { id: 'tavle',     label: 'Tavle',     Icon: Columns3 },
] as const
type ViewMode = (typeof VIEW_MODES)[number]['id']

// ─── Month labels ─────────────────────────────────────────────────────────────

const MONTH_LABELS: Record<string, string> = {
  '01': 'Januar', '02': 'Februar', '03': 'Mars',     '04': 'April',
  '05': 'Mai',    '06': 'Juni',    '07': 'Juli',     '08': 'August',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember',
}

// ─── Survey type label ────────────────────────────────────────────────────────

const SURVEY_TYPE_LABEL: Record<string, string> = {
  internal:   'Ansatte',
  external:   'Leverandør',
  pulse:      'Puls',
  exit:       'Sluttsamtale',
  onboarding: 'Onboarding',
}

// ─── Channel icon map ─────────────────────────────────────────────────────────

const CHANNEL_ICON_MAP: Record<string, LucideIcon> = {
  'e-post':   Mail,
  'SMS':      MessageCircle,
  'Slack':    Hash,
  'intranett': Globe,
  'QR-plakat': Scan,
  'lenke':    Link2,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryIcon(name: string): LucideIcon {
  const l = name.toLowerCase()
  if (l.includes('verne'))                                    return ShieldCheck
  if (l.includes('brann'))                                    return Flame
  if (l.includes('maskin') || l.includes('truck') || l.includes('utstyr')) return Truck
  if (l.includes('lev') || l.includes('vendor'))              return Truck
  return FileText
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChannelBadge({ ch }: { ch: string }) {
  const Icon = CHANNEL_ICON_MAP[ch] ?? Send
  return (
    <span className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
      <Icon className="h-2.5 w-2.5" aria-hidden /> {ch}
    </span>
  )
}

/** Survey kind icon. variant='green' for box/card views, 'neutral' for table rows. */
function RowIcon({
  title,
  size = 'default',
  variant = 'neutral',
}: {
  title: string
  size?: 'default' | 'lg'
  variant?: 'neutral' | 'green'
}) {
  const lower = title.toLowerCase()
  let Icon: LucideIcon = ClipboardList

  if (variant === 'green') {
    const szCls  = size === 'lg' ? 'h-10 w-10 rounded-lg' : 'h-9 w-9 rounded-lg'
    const icoCls = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
    if (lower.includes('brann'))                               Icon = Flame
    else if (lower.includes('truck') || lower.includes('maskin')) Icon = Truck
    else if (lower.includes('verne'))                          Icon = ShieldCheck
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${szCls} bg-[#e7efe9] text-[#1a3d32]`}>
        <Icon className={icoCls} aria-hidden />
      </span>
    )
  }

  let bg = 'bg-neutral-100'
  let fg = 'text-neutral-600'
  if (lower.includes('brann'))                                         { Icon = Flame;       bg = 'bg-orange-50'; fg = 'text-orange-500' }
  else if (lower.includes('truck') || lower.includes('maskin'))        { Icon = Truck;       bg = 'bg-blue-50';   fg = 'text-blue-500' }
  else if (lower.includes('verne'))                                    { Icon = ShieldCheck; bg = 'bg-green-50';  fg = 'text-green-600' }

  const szCls  = size === 'lg' ? 'h-10 w-10 rounded-lg' : 'h-7 w-7 rounded-md'
  const icoCls = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${szCls} ${bg}`}>
      <Icon className={`${icoCls} ${fg}`} aria-hidden />
    </span>
  )
}

function StatusPill({ status }: { status: SurveyDisplayStatus }) {
  const { label, variant } = STATUS_CONFIG[status]
  return <Badge variant={variant}>{label}</Badge>
}

function ViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
      {VIEW_MODES.map(({ id, label, Icon }) => {
        const active = id === value
        return (
          <button
            key={id}
            type="button"
            title={label}
            onClick={() => onChange(id)}
            className={[
              'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200'
                : 'text-neutral-500 hover:text-neutral-800',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden md:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Entries — table view ─────────────────────────────────────────────────────

function EntriesTable({ entries, onOpen }: { entries: MappedSurvey[]; onOpen: (id: string) => void }) {
  if (entries.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen undersøkelser i denne kategorien ennå.
      </div>
    )
  }
  return (
    <>
      {/* Mobile: compact list */}
      <ul className="divide-y divide-neutral-100 sm:hidden">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onOpen(e.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 active:bg-neutral-100"
            >
              <RowIcon title={e.title} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-neutral-900">{e.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                  <span>{SURVEY_TYPE_LABEL[e.surveyType] ?? e.surveyType}</span>
                  <span>·</span>
                  <span className="tabular-nums">{e.due}</span>
                </div>
              </div>
              <StatusPill status={e.status} />
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-300" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop: full table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50/60">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Undersøkelse</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Periode</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Svar</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Distribusjon</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Anonym</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Eier</th>
              <th className="w-8 px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {entries.map((e) => (
              <tr
                key={e.id}
                className="cursor-pointer transition-colors hover:bg-neutral-50/70"
                onClick={() => onOpen(e.id)}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <RowIcon title={e.title} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-neutral-900">{e.title}</div>
                      <div className="text-[11px] text-neutral-500">{SURVEY_TYPE_LABEL[e.surveyType] ?? e.surveyType}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3"><StatusPill status={e.status} /></td>
                <td className="px-5 py-3 tabular-nums text-neutral-600">
                  <span>{e.startDate}</span>
                  <span className="mx-1 text-neutral-300">–</span>
                  <span>{e.due}</span>
                </td>
                <td className="px-5 py-3">
                  {e.invitationCount > 0 ? (
                    <div className="flex items-center gap-2">
                      <ResponseRing value={e.responseCount / e.invitationCount} size={32} strokeWidth={3} />
                      <div className="text-[11px] tabular-nums text-neutral-700">
                        <div className="font-semibold">{e.responseCount}<span className="font-normal text-neutral-400">/{e.invitationCount}</span></div>
                        <div className="text-[10px] text-neutral-500">svarprosent</div>
                      </div>
                    </div>
                  ) : (
                    <span className="tabular-nums text-neutral-700">{e.responseCount} svar</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {e.channels.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {e.channels.map((ch) => <ChannelBadge key={ch} ch={ch} />)}
                    </div>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {e.isAnonymous ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a3d32]">
                      <EyeOff className="h-3 w-3" /> Ja
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-neutral-600">
                      <Eye className="h-3 w-3" /> Nei
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-neutral-500">
                  <span className="text-[11px]">—</span>
                </td>
                <td className="px-5 py-3 text-right text-neutral-300">›</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── Entries — box view ───────────────────────────────────────────────────────

function EntriesBoxes({ entries, onOpen }: { entries: MappedSurvey[]; onOpen: (id: string) => void }) {
  if (entries.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen undersøkelser i denne kategorien ennå.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((e) => (
        <article
          key={e.id}
          onClick={() => onOpen(e.id)}
          className="cursor-pointer rounded-xl border border-neutral-200/80 bg-white p-4 transition-all hover:border-[#1a3d32]/40 hover:shadow-md"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-start gap-3">
            <RowIcon title={e.title} variant="green" />
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-semibold leading-tight text-neutral-900">{e.title}</div>
              <div className="mt-0.5 truncate text-[11px] text-neutral-500">{SURVEY_TYPE_LABEL[e.surveyType] ?? e.surveyType}</div>
            </div>
            {e.isAnonymous && (
              <span title="Anonym" className="shrink-0 rounded-full bg-[#e7efe9] p-1 text-[#1a3d32]">
                <EyeOff className="h-3 w-3" aria-hidden />
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <StatusPill status={e.status} />
            <span className="text-[11px] tabular-nums text-neutral-500">{e.startDate} – {e.due}</span>
          </div>

          {e.invitationCount > 0 ? (
            <div className="mt-3 flex items-center gap-3 rounded-md bg-[#fbf9f3] px-3 py-2.5">
              <ResponseRing value={e.responseCount / e.invitationCount} size={48} strokeWidth={4} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Svar</div>
                <div className="text-sm font-bold tabular-nums text-neutral-900">
                  {e.responseCount} <span className="text-xs font-normal text-neutral-500">av {e.invitationCount}</span>
                </div>
                <div className="text-[10px] text-neutral-500">svarprosent</div>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-dashed border-neutral-200 px-3 py-2.5 text-center text-[11px] text-neutral-500">
              Ikke startet
            </div>
          )}

          {e.channels.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-neutral-100 pt-2.5">
              {e.channels.map((ch) => <ChannelBadge key={ch} ch={ch} />)}
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

// ─── Entries — timeline view ──────────────────────────────────────────────────

function EntriesTimeline({ entries, onOpen }: { entries: MappedSurvey[]; onOpen: (id: string) => void }) {
  const sorted = [...entries].sort((a, b) => {
    if (!a.dueRaw && !b.dueRaw) return 0
    if (!a.dueRaw) return 1
    if (!b.dueRaw) return -1
    return a.dueRaw.getTime() - b.dueRaw.getTime()
  })
  const groups: Record<string, MappedSurvey[]> = {}
  sorted.forEach((e) => {
    if (!e.dueRaw) return
    const mm   = String(e.dueRaw.getMonth() + 1).padStart(2, '0')
    const yyyy = String(e.dueRaw.getFullYear())
    const key  = `${mm}.${yyyy}`
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  })

  if (Object.keys(groups).length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen undersøkelser med sluttdato i denne kategorien.
      </div>
    )
  }

  return (
    <div className="p-5">
      <div className="space-y-5">
        {Object.entries(groups).map(([monthKey, list]) => {
          const [mm, yyyy] = monthKey.split('.')
          return (
            <div key={monthKey}>
              <div className="mb-2 flex items-baseline gap-2">
                <h4 className="text-sm font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  {MONTH_LABELS[mm]} {yyyy}
                </h4>
                <span className="text-[11px] tabular-nums text-neutral-400">{list.length} undersøkelser</span>
              </div>
              <ol className="relative border-l-2 border-neutral-200 pl-5">
                {list.map((e) => {
                  const day = e.dueRaw ? String(e.dueRaw.getDate()).padStart(2, '0') : '?'
                  const dotColor =
                    e.status === 'aktiv'    ? 'bg-blue-600' :
                    e.status === 'lukket'   ? 'bg-[#2F7757]' :
                    'bg-neutral-400'
                  const DotIcon =
                    e.status === 'lukket' ? CheckCircle2 :
                    e.status === 'aktiv'  ? AlertTriangle : ChevronRight
                  return (
                    <li key={e.id} className="relative mb-2.5 last:mb-0">
                      <span className={`absolute -left-[28px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${dotColor}`}>
                        <DotIcon className="h-2.5 w-2.5 text-white" aria-hidden />
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpen(e.id)}
                        className="block w-full rounded-md border border-neutral-200/80 bg-white px-3 py-2 text-left hover:border-[#1a3d32]/40 hover:bg-[#fbf9f3]"
                        style={{ transition: 'border-color .15s' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 shrink-0 text-center">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{MONTH_LABELS[mm]?.slice(0, 3)}</div>
                            <div className="text-base font-bold tabular-nums leading-none text-neutral-900">{day}</div>
                          </div>
                          <div className="h-8 w-px bg-neutral-200" />
                          <RowIcon title={e.title} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-neutral-900">{e.title}</div>
                            <div className="text-[11px] text-neutral-500">{SURVEY_TYPE_LABEL[e.surveyType] ?? e.surveyType}</div>
                          </div>
                          <StatusPill status={e.status} />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Entries — kanban view ────────────────────────────────────────────────────

function EntriesKanban({ entries, onOpen }: { entries: MappedSurvey[]; onOpen: (id: string) => void }) {
  const buckets = Object.fromEntries(KANBAN_COLS.map((c) => [c.id, [] as MappedSurvey[]]))
  entries.forEach((e) => {
    if (buckets[e.status] !== undefined) buckets[e.status].push(e)
    else buckets['kladd'].push(e)
  })

  return (
    <div className="grid grid-cols-2 gap-3 overflow-x-auto p-3 md:grid-cols-4">
      {KANBAN_COLS.map((col) => {
        const items = buckets[col.id] ?? []
        return (
          <div key={col.id} className="flex min-h-[400px] flex-col rounded-lg border border-neutral-200/80 bg-[#fbf9f3]/60">
            <div className="flex items-center justify-between border-b border-neutral-200/70 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: col.accent }} />
                <span className="text-xs font-semibold text-neutral-900">{col.label}</span>
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 ring-1 ring-neutral-200">{items.length}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2 p-2">
              {items.length === 0 ? (
                <div className="rounded-md border border-dashed border-neutral-200 p-3 text-center text-[11px] text-neutral-400">Ingen</div>
              ) : (
                items.map((e) => (
                  <article
                    key={e.id}
                    onClick={() => onOpen(e.id)}
                    className="cursor-pointer rounded-md border border-neutral-200/80 bg-white p-2.5 hover:border-[#1a3d32]/40 hover:shadow-sm"
                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)', transition: 'border-color .15s' }}
                  >
                    <div className="flex items-start gap-2">
                      <RowIcon title={e.title} />
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-xs font-medium leading-tight text-neutral-900">{e.title}</div>
                        <div className="mt-0.5 truncate text-[10px] text-neutral-500">{SURVEY_TYPE_LABEL[e.surveyType] ?? e.surveyType}</div>
                      </div>
                      {e.isAnonymous && <EyeOff aria-label="Anonym" className="mt-0.5 h-3 w-3 shrink-0 text-[#1a3d32]" aria-hidden />}
                    </div>
                    {e.invitationCount > 0 ? (
                      <div className="mt-2 flex items-center gap-2 rounded-sm bg-[#fbf9f3] px-2 py-1.5">
                        <ResponseRing value={e.responseCount / e.invitationCount} size={28} strokeWidth={3} />
                        <div className="text-[10px] tabular-nums leading-tight">
                          <div className="font-semibold text-neutral-900">{e.responseCount}/{e.invitationCount}</div>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-1.5 flex items-center justify-between border-t border-neutral-100 pt-1.5 text-[10px]">
                      <span className="tabular-nums text-neutral-500">{e.due}</span>
                      <span className="tabular-nums text-neutral-500">{e.responseCount} svar</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Maler — table view ───────────────────────────────────────────────────────

function MalerTable({
  templates,
  surveys,
  onNewSurvey,
}: {
  templates: SurveyTemplateCatalogRow[]
  surveys: SurveyRow[]
  onNewSurvey: () => void
}) {
  if (templates.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen aktive maler i denne kategorien.
      </div>
    )
  }
  return (
    <>
      {/* Mobile: compact list */}
      <ul className="divide-y divide-neutral-100 sm:hidden">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <RowIcon title={t.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-neutral-900">{t.name}</div>
              <div className="text-[11px] text-neutral-500">{t.pack}</div>
            </div>
            <Button variant="primary" size="sm" icon={<Send className="h-3 w-3" />} onClick={onNewSurvey}>Send ut</Button>
          </li>
        ))}
      </ul>

      {/* Desktop: full table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50/60">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Mal</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Spørsmål</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Cadence</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Lov</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Anonym</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Kjøringer</th>
              <th className="w-32 px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {templates.map((t) => {
              const questionCount = t.body?.questions?.length ?? 0
              const kjøringer = surveys.filter((s) => s.catalog_id === t.id).length
              return (
                <tr key={t.id} className="cursor-pointer transition-colors hover:bg-neutral-50/70">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <RowIcon title={t.name} />
                      <div>
                        <div className="font-medium text-neutral-900">{t.name}</div>
                        {t.description ? (
                          <div className="line-clamp-1 text-[11px] text-neutral-500">{t.description}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-neutral-800">{questionCount}</td>
                  <td className="px-5 py-3 text-neutral-700">{t.estimated_minutes} min</td>
                  <td className="px-5 py-3">
                    {t.law_ref ? (
                      <span className="rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]">{t.law_ref}</span>
                    ) : (
                      <span className="text-[10px] text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {t.recommend_anonymous ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a3d32]">
                        <EyeOff className="h-3 w-3" /> Ja
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-neutral-600">
                        <Eye className="h-3 w-3" /> Nei
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-neutral-800">{kjøringer}</td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="primary" size="sm" icon={<Send className="h-3 w-3" />} onClick={onNewSurvey}>Send ut</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── Maler — box view ─────────────────────────────────────────────────────────

function MalerBoxes({
  templates,
  surveys,
  onNewSurvey,
}: {
  templates: SurveyTemplateCatalogRow[]
  surveys: SurveyRow[]
  onNewSurvey: () => void
}) {
  if (templates.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-neutral-500">
        Ingen aktive maler i denne kategorien.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => {
        const questionCount = t.body?.questions?.length ?? 0
        const kjøringer = surveys.filter((s) => s.catalog_id === t.id).length
        return (
          <article
            key={t.id}
            className="flex flex-col rounded-xl border border-neutral-200/80 bg-white"
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-start gap-3 p-4 pb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e7efe9] text-[#1a3d32]">
                <RowIcon title={t.name} size="default" variant="green" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Mal · {t.pack}</div>
                <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-tight text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                  {t.name}
                </h3>
              </div>
              {t.recommend_anonymous && (
                <span title="Anbefalt anonym" className="shrink-0 rounded-full bg-[#e7efe9] p-1 text-[#1a3d32]">
                  <EyeOff className="h-3 w-3" aria-hidden />
                </span>
              )}
            </div>

            {t.description ? (
              <div className="border-t border-dashed border-neutral-200 px-4 py-2.5">
                <p className="line-clamp-2 text-[11px] text-neutral-600">{t.description}</p>
              </div>
            ) : null}

            <div className="border-t border-neutral-100 bg-[#fbf9f3] px-4 py-2 text-[11px]">
              <div className="grid grid-cols-3 gap-1 text-center">
                <div>
                  <div className="font-semibold tabular-nums text-neutral-900">{questionCount}</div>
                  <div className="text-[10px] text-neutral-500">spørsmål</div>
                </div>
                <div>
                  <div className="font-semibold tabular-nums text-neutral-900">{kjøringer}</div>
                  <div className="text-[10px] text-neutral-500">kjøringer</div>
                </div>
                <div>
                  <div className="font-semibold tabular-nums text-neutral-900">{t.estimated_minutes}m</div>
                  <div className="text-[10px] text-neutral-500">snitt</div>
                </div>
              </div>
            </div>

            {t.law_ref && (
              <div className="px-4 py-1.5">
                <span className="rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]">{t.law_ref}</span>
              </div>
            )}

            <div className="mt-auto flex items-center justify-between border-t border-neutral-100 px-4 py-2.5">
              <button type="button" className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800">Rediger ›</button>
              <Button variant="primary" size="sm" icon={<Send className="h-3 w-3" />} onClick={onNewSurvey}>Send ut</Button>
            </div>
          </article>
        )
      })}
    </div>
  )
}

// ─── Resultater tab ───────────────────────────────────────────────────────────

function ResultaterTab({ surveys, onOpen }: { surveys: SurveyRow[]; onOpen: (id: string) => void }) {
  const withData = surveys.filter((s) => s.response_count > 0 || s.invitation_count > 0)
  const totalResp = surveys.reduce((acc, s) => acc + s.response_count, 0)
  const totalInv  = surveys.reduce((acc, s) => acc + s.invitation_count, 0)
  const avgPct    = totalInv > 0 ? Math.round((totalResp / totalInv) * 100) : 0

  // eNPS: can't compute without answer data from hub — show placeholder
  const riskCount = 0 // would need answer data per survey

  return (
    <div className="space-y-5 p-5">
      {/* KPI strip — 4 cards per design */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Snitt svarprosent</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-[#1a3d32]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>{avgPct}%</div>
          <div className="text-[11px] text-neutral-500">på tvers av aktive</div>
        </div>
        <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Snitt eNPS</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-[#1a3d32]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>—</div>
          <div className="text-[11px] text-neutral-500">på tvers av undersøkelser</div>
        </div>
        <div className="rounded-md bg-amber-50 px-3 py-2.5 ring-1 ring-amber-100">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Røde flagg</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-amber-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>{riskCount}</div>
          <div className="text-[11px] text-amber-800">krever oppfølging</div>
        </div>
        <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Innsamlede svar</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-[#1a3d32]" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>{totalResp}</div>
          <div className="text-[11px] text-neutral-500">totalt</div>
        </div>
      </div>

      {/* Per-survey table */}
      {withData.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">Ingen svar registrert ennå.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50/60">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Undersøkelse</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Svarprosent</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Snittscore</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">eNPS</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Distribusjon</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Avsluttet</th>
                <th className="w-8 px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[...withData].sort((a, b) => b.response_count - a.response_count).map((s) => {
                const rate   = s.invitation_count > 0 ? s.response_count / s.invitation_count : null
                const dueStr = s.end_date ? new Date(s.end_date).toLocaleDateString('nb-NO', { dateStyle: 'short' }) : '—'
                return (
                  <tr key={s.id} className="cursor-pointer transition-colors hover:bg-neutral-50/70" onClick={() => onOpen(s.id)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <RowIcon title={s.title} />
                        <div>
                          <div className="font-medium text-neutral-900">{s.title}</div>
                          <div className="text-[11px] text-neutral-500">{s.response_count} av {s.invitation_count} svarte</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {rate != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                            <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.round(rate * 100))}%`, background: rate >= 0.7 ? '#1a3d32' : rate >= 0.4 ? '#c98a2b' : '#b3382a' }} />
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-neutral-900">{Math.round(rate * 100)}%</span>
                        </div>
                      ) : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-neutral-700">
                      <span className="text-neutral-400">—</span>
                    </td>
                    <td className="px-5 py-3 tabular-nums">
                      <span className="text-neutral-400">—</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-neutral-400">—</span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-neutral-700">{dueStr}</td>
                    <td className="px-5 py-3 text-right text-neutral-300">›</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  surveys: SurveyRow[]
  templates: SurveyTemplateCatalogRow[]
  categories: SurveyCategoryRow[]
  /** map from catalogId → categoryId (resolved via orgTemplates) */
  categoryByCatalogId: Map<string, string | null>
  loading: boolean
  canManage: boolean
  onNewSurvey: () => void
  onNavigate: (path: string) => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SurveyHubRecordsShell({
  surveys,
  templates,
  categories,
  categoryByCatalogId,
  loading,
  onNewSurvey,
  onNavigate,
}: Props) {
  const [activeTab, setActiveTab] = useState<'surveys' | 'maler' | 'resultater'>('surveys')
  const [view, setView]           = useState<ViewMode>('tabell')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [search, setSearch]       = useState('')

  // Map raw surveys to display shape
  const mappedSurveys = useMemo<MappedSurvey[]>(() =>
    surveys.map((s) => {
      const dueRaw = s.end_date ? new Date(s.end_date) : null
      const statusMap: Record<string, SurveyDisplayStatus> = {
        draft:    'kladd',
        active:   'aktiv',
        closed:   'lukket',
        archived: 'arkivert',
      }
      const startRaw = s.start_date ? new Date(s.start_date) : null
      return {
        id:            s.id,
        catalogId:     s.catalog_id ?? null,
        title:         s.title,
        pack:          s.pack,
        status:        statusMap[s.status] ?? 'kladd',
        surveyType:    s.survey_type,
        due:           dueRaw ? dueRaw.toLocaleDateString('nb-NO', { dateStyle: 'short' }) : '—',
        dueRaw,
        startDate:     startRaw ? startRaw.toLocaleDateString('nb-NO', { dateStyle: 'short' }) : '—',
        responseCount:   s.response_count,
        invitationCount: s.invitation_count,
        isAnonymous:     s.is_anonymous,
        channels:        [],
      }
    }),
  [surveys])

  // Category rail items
  const categoryItems = useMemo(() => [
    { id: 'all', label: 'Alle', Icon: LayoutGrid as LucideIcon },
    ...categories
      .filter((c) => c.is_active)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, label: c.name, Icon: getCategoryIcon(c.name) })),
  ], [categories])

  // Template ids per category (via categoryByCatalogId)
  const tplIdsByCategory = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const tpl of templates) {
      const catId = categoryByCatalogId.get(tpl.id) ?? null
      if (catId) {
        const s = m.get(catId) ?? new Set<string>()
        s.add(tpl.id)
        m.set(catId, s)
      }
    }
    return m
  }, [templates, categoryByCatalogId])

  // Survey-to-category lookup (via catalog_id)
  const surveyCategorySet = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const s of mappedSurveys) {
      if (!s.catalogId) continue
      const catId = categoryByCatalogId.get(s.catalogId) ?? null
      if (!catId) continue
      const set = m.get(catId) ?? new Set<string>()
      set.add(s.id)
      m.set(catId, set)
    }
    return m
  }, [mappedSurveys, categoryByCatalogId])

  // Per-category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, { surveys: number; maler: number }> = {
      all: {
        surveys: mappedSurveys.length,
        maler:   templates.filter((t) => t.is_active).length,
      },
    }
    for (const [catId, tplSet] of tplIdsByCategory) {
      const surveySet = surveyCategorySet.get(catId) ?? new Set<string>()
      counts[catId] = {
        surveys: surveySet.size,
        maler:   templates.filter((t) => tplSet.has(t.id) && t.is_active).length,
      }
    }
    return counts
  }, [mappedSurveys, tplIdsByCategory, surveyCategorySet, templates])

  // Status sidebar stats
  const activeCount = surveys.filter((s) => s.status === 'active').length
  const draftCount  = surveys.filter((s) => s.status === 'draft').length
  const totalInv    = surveys.reduce((acc, s) => acc + s.invitation_count, 0)
  const totalResp   = surveys.reduce((acc, s) => acc + s.response_count, 0)
  const avgRatePct  = totalInv > 0 ? Math.round((totalResp / totalInv) * 100) : 0
  const hasPsychosocial = surveys.some((s) => s.survey_type === 'internal' && s.status === 'active')

  // Filtered surveys
  const displayedSurveys = useMemo(() => {
    let result = mappedSurveys
    if (activeCategory !== 'all') {
      const catSurveyIds = surveyCategorySet.get(activeCategory)
      result = catSurveyIds ? result.filter((s) => catSurveyIds.has(s.id)) : []
    }
    const q = search.trim().toLowerCase()
    if (q) result = result.filter((s) => s.title.toLowerCase().includes(q))
    return result
  }, [mappedSurveys, activeCategory, surveyCategorySet, search])

  // Filtered templates
  const displayedTemplates = useMemo(() => {
    let tpls = templates.filter((t) => t.is_active)
    if (activeCategory !== 'all') {
      const tplSet = tplIdsByCategory.get(activeCategory)
      tpls = tplSet ? tpls.filter((t) => tplSet.has(t.id)) : []
    }
    const q = search.trim().toLowerCase()
    if (q) tpls = tpls.filter((t) => t.name.toLowerCase().includes(q))
    return tpls
  }, [templates, activeCategory, tplIdsByCategory, search])

  // Hide grip icon import usage suppression
  void GripVertical

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-neutral-500">
        Laster undersøkelser…
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">

      {/* ── LEFT: Category rail ── */}
      <aside className="space-y-3">
        <div
          className="rounded-xl border border-neutral-200/80 bg-white"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <div className="hidden border-b border-neutral-100 px-4 py-3 lg:block">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Kategorier</h2>
          </div>

          {/* Mobile: horizontal chips */}
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 lg:hidden">
            {categoryItems.map(({ id, label, Icon }) => {
              const isActive = id === activeCategory
              const count    = categoryCounts[id]?.[activeTab === 'maler' ? 'maler' : 'surveys'] ?? 0
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveCategory(id)}
                  className={[
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    isActive ? 'text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
                  ].join(' ')}
                  style={isActive ? { background: CAT_ACTIVE_BORDER } : undefined}
                >
                  <Icon className="h-3 w-3" aria-hidden />
                  <span>{label}</span>
                  <span className={['rounded-full px-1 py-0 text-[10px] tabular-nums', isActive ? 'bg-white/20 text-white' : 'text-neutral-500'].join(' ')}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Desktop: vertical list — green active state per design */}
          <ul className="hidden py-1.5 lg:block">
            {categoryItems.map(({ id, label, Icon }) => {
              const isActive = id === activeCategory
              const count    = categoryCounts[id]?.[activeTab === 'maler' ? 'maler' : 'surveys'] ?? 0
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setActiveCategory(id)}
                    className={[
                      'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors',
                      isActive ? 'text-neutral-900' : 'text-neutral-700 hover:bg-neutral-50',
                    ].join(' ')}
                    style={isActive
                      ? { background: CAT_ACTIVE_BG, boxShadow: `inset 3px 0 0 ${CAT_ACTIVE_BORDER}` }
                      : undefined}
                  >
                    <Icon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: isActive ? CAT_ACTIVE_BORDER : '#6b7280' }}
                      aria-hidden
                    />
                    <span className={['min-w-0 flex-1 truncate', isActive ? 'font-semibold' : 'font-medium'].join(' ')}>
                      {label}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                      style={
                        isActive
                          ? { background: 'white', color: CAT_ACTIVE_TEXT }
                          : { background: '#f3f4f6', color: '#6b7280' }
                      }
                    >
                      {count}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Status nå */}
        <div className="hidden rounded-xl border border-neutral-200/80 bg-white p-4 lg:block" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Status nå</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            <li className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-neutral-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-green-500 opacity-60" />
                  <span className="relative h-2 w-2 rounded-full bg-green-600" />
                </span>
                Aktive
              </span>
              <span className="tabular-nums font-semibold text-neutral-900">{activeCount}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-neutral-700">
                <span className="h-2 w-2 rounded-full bg-neutral-400" />
                Kladder
              </span>
              <span className="tabular-nums font-semibold text-neutral-900">{draftCount}</span>
            </li>
          </ul>
          {totalInv > 0 && (
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Snitt svar</span>
                <span className="text-base font-bold tabular-nums text-[#1a3d32]">{avgRatePct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                <div className="h-1.5 rounded-full bg-[#1a3d32] transition-[width]" style={{ width: `${avgRatePct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Legal nudge */}
        {hasPsychosocial && (
          <div className="hidden rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 lg:block">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
              <div>
                <div className="font-semibold">Lovpålagt: psykososialt arbeidsmiljø</div>
                <div className="mt-0.5 text-amber-800">Kvartalsvis kartlegging kreves — AML § 4-3.</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── RIGHT: Content card ── */}
      <section className="space-y-3">
        <div
          className="rounded-xl border border-neutral-200/80 bg-white"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          {/* Header strip: tabs + search + view switcher */}
          <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            {/* Tabs — purple active per design spec for hub tab strip */}
            <nav className="flex items-center gap-1" aria-label="Faner">
              {([
                { id: 'surveys',    label: 'Undersøkelser', Icon: ClipboardList,  count: categoryCounts[activeCategory]?.surveys ?? 0 },
                { id: 'maler',      label: 'Maler',          Icon: ClipboardCheck, count: categoryCounts[activeCategory]?.maler   ?? 0 },
                { id: 'resultater', label: 'Resultater',     Icon: BarChart3,      count: surveys.filter((s) => s.response_count > 0).length },
              ] as const).map(({ id, label, Icon, count }) => {
                const active = activeTab === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                    ].join(' ')}
                    style={active ? { background: ACCENT } : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{label}</span>
                    <span
                      className={['ml-1.5 rounded-full px-2 py-0.5 text-xs', active ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'].join(' ')}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </nav>

            {/* Search + view switcher */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <input
                  type="search"
                  placeholder={activeTab === 'surveys' ? 'Søk i tittel…' : 'Søk i malnavn…'}
                  value={search}
                  onChange={(ev) => setSearch(ev.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#1a3d32] focus:bg-white sm:w-52"
                  style={{ transition: 'border-color .15s' }}
                />
              </div>
              {activeTab !== 'resultater' && (
                <ViewSwitcher value={view} onChange={setView} />
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-0">
            {activeTab === 'surveys' ? (
              <>
                {view === 'tabell'    && <EntriesTable    entries={displayedSurveys} onOpen={(id) => onNavigate(`/survey/${id}`)} />}
                {view === 'bokser'    && <EntriesBoxes    entries={displayedSurveys} onOpen={(id) => onNavigate(`/survey/${id}`)} />}
                {view === 'tidslinje' && <EntriesTimeline entries={displayedSurveys} onOpen={(id) => onNavigate(`/survey/${id}`)} />}
                {view === 'tavle'     && <EntriesKanban   entries={displayedSurveys} onOpen={(id) => onNavigate(`/survey/${id}`)} />}
              </>
            ) : activeTab === 'resultater' ? (
              <ResultaterTab surveys={surveys} onOpen={(id) => onNavigate(`/survey/${id}`)} />
            ) : (
              <>
                {view === 'bokser' ? (
                  <MalerBoxes templates={displayedTemplates} surveys={surveys} onNewSurvey={onNewSurvey} />
                ) : (
                  <MalerTable templates={displayedTemplates} surveys={surveys} onNewSurvey={onNewSurvey} />
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
