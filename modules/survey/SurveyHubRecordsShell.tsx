// SurveyHubRecordsShell — two-column Records-shell for the survey hub.
//
// Renders INSIDE an existing ModulePageShell (no wrapping shell here).
// Left rail: category chips (mobile) + vertical list (desktop).
// Right card: tab strip (Undersøkelser / Maler) + search + 4 view modes.
//
// Mirrors the hub-mode pattern in modules/compliance/ChecklistsPage.tsx but
// adapted to survey data shapes and the purple accent (#7c3aed).

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
  FileText,
  Flame,
  LayoutGrid,
  Play,
  Rows3,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import type { BadgeVariant } from '../../src/components/ui/Badge'
import type { SurveyRow, SurveyCategoryRow } from './types'
import type { SurveyTemplateCatalogRow } from './surveyTemplateCatalogTypes'
import { ResponseRing } from './components/ResponseRing'

// ─── Accent ───────────────────────────────────────────────────────────────────

const ACCENT = '#7c3aed'
const ACCENT_BG = '#f3effe'
const ACCENT_FG = '#4c1d95'

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
  responseCount: number
  invitationCount: number
  isAnonymous: boolean
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

function RowIcon({ title, size = 'default' }: { title: string; size?: 'default' | 'lg' }) {
  const lower = title.toLowerCase()
  let Icon: LucideIcon = ClipboardList
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

// ─── Survey entries views ─────────────────────────────────────────────────────

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
                  <span>{e.pack}</span>
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
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Tittel</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Type</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Svarprosent</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Sluttdato</th>
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
                      <div className="text-[11px] text-neutral-500">#{e.id.slice(-4).toUpperCase()}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3"><StatusPill status={e.status} /></td>
                <td className="px-5 py-3 text-neutral-700">{SURVEY_TYPE_LABEL[e.surveyType] ?? e.surveyType}</td>
                <td className="px-5 py-3">
                  {e.invitationCount > 0 ? (
                    <div className="flex items-center gap-2">
                      <ResponseRing value={e.responseCount / e.invitationCount} size={32} strokeWidth={3} />
                      <span className="text-[11px] tabular-nums text-neutral-700">{e.responseCount}/{e.invitationCount}</span>
                    </div>
                  ) : (
                    <span className="tabular-nums text-neutral-700">{e.responseCount}</span>
                  )}
                </td>
                <td className="px-5 py-3 tabular-nums text-neutral-700">{e.due}</td>
                <td className="px-5 py-3 text-right text-neutral-300">›</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

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
          className="cursor-pointer rounded-xl border border-neutral-200/80 bg-white p-4 transition-all hover:shadow-md"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)', borderColor: undefined }}
          onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.borderColor = `${ACCENT}66` }}
          onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.borderColor = '' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: ACCENT_BG }}
            >
              <RowIcon title={e.title} size="default" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-semibold leading-tight text-neutral-900">{e.title}</div>
              <div className="mt-0.5 text-[11px] text-neutral-500">{SURVEY_TYPE_LABEL[e.surveyType] ?? e.surveyType}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <StatusPill status={e.status} />
            {e.isAnonymous && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[10px] font-semibold text-[#14312a]">Anonym</span>
            )}
          </div>
          {e.invitationCount > 0 ? (
            <div className="mt-3 flex items-center gap-3 rounded-md bg-[#fbf9f3] px-3 py-2.5">
              <ResponseRing value={e.responseCount / e.invitationCount} size={40} strokeWidth={4} />
              <div className="text-[11px] tabular-nums text-neutral-700">
                <div className="font-semibold text-neutral-900">{e.responseCount} <span className="font-normal text-neutral-400">av {e.invitationCount}</span></div>
                <div className="text-[10px] text-neutral-500">svarprosent</div>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5 text-[11px] text-neutral-500">
              <span className="tabular-nums">Sluttdato {e.due}</span>
              <span className="tabular-nums">{e.responseCount} svar</span>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

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
                <h4
                  className="text-sm font-semibold text-neutral-900"
                  style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                >
                  {MONTH_LABELS[mm]} {yyyy}
                </h4>
                <span className="text-[11px] tabular-nums text-neutral-400">{list.length} undersøkelser</span>
              </div>
              <ol className="relative border-l-2 border-neutral-200 pl-5">
                {list.map((e) => {
                  const day = e.dueRaw ? String(e.dueRaw.getDate()).padStart(2, '0') : '?'
                  const dotColor =
                    e.status === 'aktiv'    ? 'bg-blue-600' :
                    e.status === 'lukket'   ? 'bg-green-600' :
                    e.status === 'arkivert' ? 'bg-neutral-400' : 'bg-neutral-400'
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
                        className="block w-full rounded-md border border-neutral-200/80 bg-white px-3 py-2 text-left hover:bg-neutral-50"
                        style={{ transition: 'border-color .15s' }}
                        onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.borderColor = `${ACCENT}66` }}
                        onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.borderColor = '' }}
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
          <div key={col.id} className="flex min-h-[400px] flex-col rounded-lg border border-neutral-200/80 bg-neutral-50/60">
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
                    className="cursor-pointer rounded-md border border-neutral-200/80 bg-white p-2.5 hover:shadow-sm"
                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)', transition: 'border-color .15s' }}
                    onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.borderColor = `${ACCENT}66` }}
                    onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.borderColor = '' }}
                  >
                    <div className="flex items-start gap-2">
                      <RowIcon title={e.title} />
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-xs font-medium leading-tight text-neutral-900">{e.title}</div>
                        <div className="mt-0.5 text-[10px] text-neutral-500">{SURVEY_TYPE_LABEL[e.surveyType] ?? e.surveyType}</div>
                      </div>
                    </div>
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

// ─── Maler views ──────────────────────────────────────────────────────────────

function MalerTable({
  templates,
  onNewSurvey,
}: {
  templates: SurveyTemplateCatalogRow[]
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
            <Button variant="primary" size="sm" icon={<Play className="h-3 w-3" />} onClick={onNewSurvey}>Start</Button>
          </li>
        ))}
      </ul>
      {/* Desktop: full table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50/60">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Mal</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Estimert tid</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Pack</th>
              <th className="w-32 px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {templates.map((t) => (
              <tr key={t.id} className="cursor-pointer transition-colors hover:bg-neutral-50/70">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <RowIcon title={t.name} />
                    <div>
                      <div className="font-medium text-neutral-900">{t.name}</div>
                      {t.description ? (
                        <div className="text-[11px] text-neutral-500 line-clamp-1">{t.description}</div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 tabular-nums text-neutral-700">
                  {t.estimated_minutes} min
                </td>
                <td className="px-5 py-3">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: ACCENT_BG, color: ACCENT_FG }}
                  >
                    {t.pack}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <Button variant="primary" size="sm" icon={<Play className="h-3 w-3" />} onClick={onNewSurvey}>Start</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function MalerBoxes({
  templates,
  onNewSurvey,
}: {
  templates: SurveyTemplateCatalogRow[]
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
      {templates.map((t) => (
        <article
          key={t.id}
          className="flex flex-col rounded-xl border border-neutral-200/80 bg-white"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-start gap-3 p-4 pb-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: ACCENT_BG }}
            >
              <RowIcon title={t.name} size="lg" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Mal · {t.pack}</div>
              <h3
                className="mt-0.5 line-clamp-2 text-sm font-semibold leading-tight text-neutral-900"
                style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
              >
                {t.name}
              </h3>
            </div>
          </div>
          {t.description ? (
            <div className="border-t border-dashed border-neutral-200 px-4 py-2.5">
              <p className="line-clamp-3 text-[11px] text-neutral-600">{t.description}</p>
            </div>
          ) : null}
          <div className="border-t border-neutral-100 bg-neutral-50/60 px-4 py-2 text-[11px]">
            <div className="flex items-center gap-1">
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: ACCENT_BG, color: ACCENT_FG }}
              >
                {t.pack}
              </span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                {t.estimated_minutes} min
              </span>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-end border-t border-neutral-100 px-4 py-2.5">
            <Button variant="primary" size="sm" icon={<Play className="h-3 w-3" />} onClick={onNewSurvey}>Start</Button>
          </div>
        </article>
      ))}
    </div>
  )
}

// ─── Resultater tab ───────────────────────────────────────────────────────────

function ResultaterTab({ surveys, onOpen }: { surveys: SurveyRow[]; onOpen: (id: string) => void }) {
  const withData = surveys.filter((s) => s.response_count > 0 || s.invitation_count > 0)
  const totalResp = surveys.reduce((acc, s) => acc + s.response_count, 0)
  const totalInv  = surveys.reduce((acc, s) => acc + s.invitation_count, 0)
  const avgPct    = totalInv > 0 ? Math.round((totalResp / totalInv) * 100) : 0
  const activeWithData = surveys.filter((s) => s.status === 'active' && s.invitation_count > 0)
  const avgActive = activeWithData.length > 0
    ? Math.round(activeWithData.reduce((acc, s) => acc + s.response_count / s.invitation_count, 0) / activeWithData.length * 100)
    : 0

  return (
    <div className="p-5 space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Snitt svarprosent</div>
          <div className="mt-0.5 text-2xl font-bold tabular-nums text-[#1a3d32]">{avgPct}%</div>
          <div className="text-[11px] text-neutral-500">totalt</div>
        </div>
        <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Aktiv svarprosent</div>
          <div className="mt-0.5 text-2xl font-bold tabular-nums text-[#1a3d32]">{avgActive}%</div>
          <div className="text-[11px] text-neutral-500">pågående undersøkelser</div>
        </div>
        <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Innsamlede svar</div>
          <div className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900">{totalResp}</div>
          <div className="text-[11px] text-neutral-500">totalt</div>
        </div>
        <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Med svar</div>
          <div className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900">{withData.length}</div>
          <div className="text-[11px] text-neutral-500">av {surveys.length} undersøkelser</div>
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
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Svar / Inviterte</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">Avsluttet</th>
                <th className="w-8 px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[...withData].sort((a, b) => b.response_count - a.response_count).map((s) => {
                const rate = s.invitation_count > 0 ? s.response_count / s.invitation_count : null
                const dueStr = s.end_date ? new Date(s.end_date).toLocaleDateString('nb-NO', { dateStyle: 'short' }) : '—'
                return (
                  <tr key={s.id} className="cursor-pointer transition-colors hover:bg-neutral-50/70" onClick={() => onOpen(s.id)}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-neutral-900">{s.title}</div>
                      <div className="text-[11px] text-neutral-500">{s.survey_type}</div>
                    </td>
                    <td className="px-5 py-3">
                      {rate != null ? (
                        <div className="flex items-center gap-2">
                          <ResponseRing value={rate} size={32} strokeWidth={3} />
                          <span className="text-xs font-semibold tabular-nums text-neutral-900">{Math.round(rate * 100)}%</span>
                        </div>
                      ) : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-neutral-700">{s.response_count} / {s.invitation_count}</td>
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
      return {
        id:            s.id,
        catalogId:     s.catalog_id ?? null,
        title:         s.title,
        pack:          s.pack,
        status:        statusMap[s.status] ?? 'kladd',
        surveyType:    s.survey_type,
        due:           dueRaw ? dueRaw.toLocaleDateString('nb-NO', { dateStyle: 'short' }) : '—',
        dueRaw,
        responseCount:   s.response_count,
        invitationCount: s.invitation_count,
        isAnonymous:     s.is_anonymous,
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
    // Returns: categoryId → Set<surveyId>
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

  // Status sidebar stats (all surveys, not filtered)
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
                  style={isActive ? { background: ACCENT } : undefined}
                >
                  <Icon className="h-3 w-3" aria-hidden />
                  <span>{label}</span>
                  <span
                    className={['rounded-full px-1 py-0 text-[10px] tabular-nums', isActive ? 'bg-white/20 text-white' : 'text-neutral-500'].join(' ')}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Desktop: vertical list */}
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
                    style={isActive ? { background: `${ACCENT}18`, boxShadow: `inset 3px 0 0 ${ACCENT}` } : undefined}
                  >
                    <Icon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: isActive ? ACCENT : '#6b7280' }}
                      aria-hidden
                    />
                    <span className={['min-w-0 flex-1 truncate', isActive ? 'font-semibold' : 'font-medium'].join(' ')}>
                      {label}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                      style={
                        isActive
                          ? { background: 'white', color: ACCENT_FG }
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
          <div className="hidden rounded-xl border border-amber-200 bg-amber-50/70 p-3 lg:block text-[11px] text-amber-900">
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
            {/* Tabs */}
            <nav className="flex items-center gap-1" aria-label="Faner">
              {([
                { id: 'surveys',   label: 'Undersøkelser', Icon: ClipboardList,  count: categoryCounts[activeCategory]?.surveys ?? 0 },
                { id: 'maler',     label: 'Maler',          Icon: ClipboardCheck, count: categoryCounts[activeCategory]?.maler   ?? 0 },
                { id: 'resultater', label: 'Resultater',    Icon: BarChart3,      count: surveys.filter((s) => s.response_count > 0).length },
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
                  className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pl-7 pr-2 text-xs outline-none focus:bg-white sm:w-52"
                  style={{ transition: 'border-color .15s' }}
                  onFocus={(ev) => { ev.currentTarget.style.borderColor = ACCENT }}
                  onBlur={(ev) => { ev.currentTarget.style.borderColor = '' }}
                />
              </div>
              <ViewSwitcher value={view} onChange={setView} />
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
                  <MalerBoxes templates={displayedTemplates} onNewSurvey={onNewSurvey} />
                ) : (
                  <MalerTable templates={displayedTemplates} onNewSurvey={onNewSurvey} />
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
