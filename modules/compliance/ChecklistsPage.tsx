// ChecklistsPage — three-mode landing for compliance checklists.
//
//   hub        no params    — ComboApp-style: category rail + Enkel/Avansert
//                             toggle + 4 view modes (Tabell/Bokser/Tidslinje/Tavle)
//   pack       ?pack=<slug> — pack lens with KPI row + execution list
//   template   ?template=<slug> — single-template focus
//
// Hub mode mirrors the ComboApp design: left category rail with per-category
// counts; right card with tab strip, search, view-mode switcher, and content.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  ClipboardList,
  Columns3,
  Flame,
  LayoutGrid,
  Play,
  Plus,
  Rows3,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
} from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleLegalBanner } from '../../src/components/module/ModuleLegalBanner'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import type { BadgeVariant } from '../../src/components/ui/Badge'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { FilterBar, SavedViewsControl } from '../../src/components/ui/FilterBar'
import { FilterChip } from '../../src/components/ui/FilterChip'
import { useLicensedPacks } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useSavedViews } from '../../src/hooks/useSavedViews'
import { useChecklistModule } from './useChecklistModule'
import { ComplianceCreateForm } from './ComplianceCreateForm'
import type { ComplianceExecutionRow, CompliancePackSlug } from './types'

// Filter payload shape persisted in `module_saved_views.filters` for
// the "compliance_checklists" module slug. Empty arrays = no filter.
type ChecklistFilters = {
  categoryIds: string[]
  statuses: DisplayStatus[]
  templateIds: string[]
}

const EMPTY_FILTERS: ChecklistFilters = {
  categoryIds: [],
  statuses: [],
  templateIds: [],
}

function filtersEqual(a: ChecklistFilters, b: ChecklistFilters): boolean {
  const eq = (x: readonly string[], y: readonly string[]) =>
    x.length === y.length && x.every((v, i) => v === y[i])
  const sort = (xs: readonly string[]) => [...xs].sort()
  return (
    eq(sort(a.categoryIds), sort(b.categoryIds)) &&
    eq(sort(a.statuses), sort(b.statuses)) &&
    eq(sort(a.templateIds), sort(b.templateIds))
  )
}

function countActiveFilters(f: ChecklistFilters): number {
  return f.categoryIds.length + f.statuses.length + f.templateIds.length
}

function filtersFromSearchParams(params: URLSearchParams): ChecklistFilters {
  const get = (key: string) => {
    const raw = params.get(key)
    return raw ? raw.split(',').filter(Boolean) : []
  }
  const validStatuses = new Set<DisplayStatus>(['kladd', 'pågår', 'fullført', 'forsinket'])
  return {
    categoryIds: get('cat'),
    statuses: get('status').filter((s): s is DisplayStatus => validStatuses.has(s as DisplayStatus)),
    templateIds: get('tpl'),
  }
}

function filtersToSearchParams(f: ChecklistFilters, base: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base)
  if (f.categoryIds.length > 0) next.set('cat', f.categoryIds.join(','))
  else next.delete('cat')
  if (f.statuses.length > 0) next.set('status', f.statuses.join(','))
  else next.delete('status')
  if (f.templateIds.length > 0) next.set('tpl', f.templateIds.join(','))
  else next.delete('tpl')
  return next
}

// ─── Status mapping (DB → display) ───────────────────────────────────────────

type DisplayStatus = 'kladd' | 'pågår' | 'fullført' | 'forsinket'

const STATUS_CONFIG: Record<DisplayStatus, { label: string; variant: BadgeVariant }> = {
  kladd: { label: 'Kladd', variant: 'draft' },
  pågår: { label: 'Pågår', variant: 'active' },
  fullført: { label: 'Fullført', variant: 'signed' },
  forsinket: { label: 'Forsinket', variant: 'danger' },
}

// Legacy (pack/template modes keep old labels to avoid breaking those views)
const STATUS_LABEL: Record<ComplianceExecutionRow['status'], string> = {
  draft: 'Kladd',
  active: 'Pågår',
  signed: 'Fullført',
}

function statusBadgeVariant(
  status: ComplianceExecutionRow['status'],
): 'draft' | 'active' | 'signed' {
  if (status === 'signed') return 'signed'
  if (status === 'active') return 'active'
  return 'draft'
}

function formatDate(input: string | null) {
  if (!input) return '—'
  try {
    return new Date(input).toLocaleDateString('nb-NO', { dateStyle: 'short' })
  } catch {
    return input
  }
}

// ─── Mapped execution (design-friendly row) ───────────────────────────────────

type MappedExecution = {
  id: string
  tplId: string
  tplName: string
  location: string
  status: DisplayStatus
  due: string
  /** raw date for sorting */
  dueRaw: Date | null
  assignee: string
}

function mapStatus(row: ComplianceExecutionRow): DisplayStatus {
  if (row.status === 'signed') return 'fullført'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = row.scheduled_for ? new Date(row.scheduled_for) : null
  if (due && due < today) return 'forsinket'
  if (row.status === 'active') return 'pågår'
  return 'kladd'
}

// ─── Row icon (table + boxes) ─────────────────────────────────────────────────

function RowIcon({ title, size = 'default' }: { title: string; size?: 'default' | 'lg' }) {
  const lower = title.toLowerCase()
  let Icon: LucideIcon = ClipboardCheck
  let bg = 'bg-neutral-100'
  let fg = 'text-neutral-600'
  if (lower.includes('brann')) { Icon = Flame; bg = 'bg-orange-50'; fg = 'text-orange-500' }
  else if (lower.includes('truck') || lower.includes('løft') || lower.includes('maskin')) { Icon = Truck; bg = 'bg-blue-50'; fg = 'text-blue-500' }
  else if (lower.includes('bygg') || lower.includes('egenkontroll')) { Icon = Building2; bg = 'bg-teal-50'; fg = 'text-teal-600' }
  else if (lower.includes('verne') || lower.includes('vernerunde')) { Icon = ShieldCheck; bg = 'bg-green-50'; fg = 'text-green-600' }

  const szCls = size === 'lg'
    ? 'h-10 w-10 rounded-lg'
    : 'h-7 w-7 rounded-md'
  const iconCls = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${szCls} ${bg}`}>
      <Icon className={`${iconCls} ${fg}`} aria-hidden />
    </span>
  )
}

// ─── Initials avatar ──────────────────────────────────────────────────────────

function Initials({ name, size = 24 }: { name: string; size?: number }) {
  const parts = name.split(' ').filter(Boolean)
  const ini = ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: '#e7efe9', color: '#1a3d32', fontSize: Math.max(9, Math.round(size * 0.42)) }}
    >
      {ini}
    </span>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, tone = 'forest' }: { value: number; tone?: 'forest' | 'danger' }) {
  const color = tone === 'danger' ? '#b3382a' : '#1a3d32'
  return (
    <div className="w-full overflow-hidden rounded-full bg-neutral-200/70" style={{ height: 4 }}>
      <div style={{ width: `${Math.round(value * 100)}%`, height: '100%', background: color, transition: 'width .35s ease' }} />
    </div>
  )
}

// ─── View switcher ────────────────────────────────────────────────────────────

const VIEW_MODES = [
  { id: 'tabell', label: 'Tabell', Icon: Rows3 },
  { id: 'bokser', label: 'Bokser', Icon: LayoutGrid },
  { id: 'tidslinje', label: 'Tidslinje', Icon: CalendarDays },
  { id: 'tavle', label: 'Tavle', Icon: Columns3 },
] as const
type ViewMode = (typeof VIEW_MODES)[number]['id']

// Initial page size for hub mode entry list — expand via "Vis alle" button.
const HUB_PAGE_SIZE = 50

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

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: DisplayStatus }) {
  const { label, variant } = STATUS_CONFIG[status]
  return <Badge variant={variant}>{label}</Badge>
}

// ─── Kanban columns ───────────────────────────────────────────────────────────

const KANBAN_COLS: { id: DisplayStatus | 'kladd'; label: string; accent: string }[] = [
  { id: 'kladd', label: 'Kladd', accent: '#a3a3a3' },
  { id: 'pågår', label: 'Pågår', accent: '#2563EB' },
  { id: 'forsinket', label: 'Forsinket', accent: '#b3382a' },
  { id: 'fullført', label: 'Fullført', accent: '#2F7757' },
]

// ─── Entries views ────────────────────────────────────────────────────────────

function EntriesTable({
  entries,
  easy,
  onOpen,
}: {
  entries: MappedExecution[]
  easy: boolean
  onOpen: (id: string) => void
}) {
  if (entries.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen gjennomføringer i denne kategorien ennå.
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
              <RowIcon title={e.tplName} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-neutral-900">{e.tplName}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                  <span>{e.location}</span>
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
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Sted</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
              {!easy && <th className={LAYOUT_TABLE1_POSTINGS_TH}>Score</th>}
              {!easy && <th className={LAYOUT_TABLE1_POSTINGS_TH}>Funn</th>}
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Frist</th>
              {!easy && <th className={LAYOUT_TABLE1_POSTINGS_TH}>Ansvarlig</th>}
              <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr
                key={e.id}
                className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer`}
                onClick={() => onOpen(e.id)}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <RowIcon title={e.tplName} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-neutral-900">{e.tplName}</div>
                      <div className="text-[11px] text-neutral-500">#{e.id.slice(-4).toUpperCase()}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-neutral-700">{e.location}</td>
                <td className="px-5 py-3"><StatusPill status={e.status} /></td>
                {!easy && (
                  <td className="px-5 py-3 tabular-nums text-neutral-400">—</td>
                )}
                {!easy && (
                  <td className="px-5 py-3 text-neutral-400">—</td>
                )}
                <td className="px-5 py-3 tabular-nums text-neutral-700">{e.due}</td>
                {!easy && (
                  <td className="px-5 py-3">
                    {e.assignee !== '—' ? (
                      <span className="inline-flex items-center gap-2">
                        <Initials name={e.assignee} size={22} />
                        <span className="text-neutral-700">{e.assignee}</span>
                      </span>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                )}
                <td className="px-5 py-3 text-right text-neutral-300">›</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function EntriesBoxes({
  entries,
  easy,
  onOpen,
}: {
  entries: MappedExecution[]
  easy: boolean
  onOpen: (id: string) => void
}) {
  if (entries.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen gjennomføringer i denne kategorien ennå.
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e7efe9] text-[#1a3d32]">
              <RowIcon title={e.tplName} size="default" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-semibold leading-tight text-neutral-900">{e.tplName}</div>
              <div className="mt-0.5 text-[11px] text-neutral-500">{e.location}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <StatusPill status={e.status} />
          </div>
          {e.status === 'pågår' || e.status === 'forsinket' ? (
            <div className="mt-2.5">
              <ProgressBar value={0.5} tone={e.status === 'forsinket' ? 'danger' : 'forest'} />
            </div>
          ) : null}
          <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5 text-[11px] text-neutral-500">
            <span className="tabular-nums">Frist {e.due}</span>
            {!easy && e.assignee !== '—' ? (
              <span className="inline-flex items-center gap-1.5">
                <Initials name={e.assignee} size={18} />
                <span>{e.assignee}</span>
              </span>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  )
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Januar', '02': 'Februar', '03': 'Mars', '04': 'April',
  '05': 'Mai', '06': 'Juni', '07': 'Juli', '08': 'August',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember',
}

function EntriesTimeline({
  entries,
  easy,
  onOpen,
}: {
  entries: MappedExecution[]
  easy: boolean
  onOpen: (id: string) => void
}) {
  const sorted = [...entries].sort((a, b) => {
    if (!a.dueRaw && !b.dueRaw) return 0
    if (!a.dueRaw) return 1
    if (!b.dueRaw) return -1
    return a.dueRaw.getTime() - b.dueRaw.getTime()
  })
  const groups: Record<string, MappedExecution[]> = {}
  sorted.forEach((e) => {
    if (!e.dueRaw) return
    const mm = String(e.dueRaw.getMonth() + 1).padStart(2, '0')
    const yyyy = String(e.dueRaw.getFullYear())
    const key = `${mm}.${yyyy}`
    if (!groups[key]) groups[key] = []
    groups[key].push(e)
  })

  if (Object.keys(groups).length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen gjennomføringer med fristdato i denne kategorien.
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
                <span className="text-[11px] tabular-nums text-neutral-400">{list.length} gjennomføringer</span>
              </div>
              <ol className="relative border-l-2 border-neutral-200 pl-5">
                {list.map((e) => {
                  const day = e.dueRaw ? String(e.dueRaw.getDate()).padStart(2, '0') : '?'
                  const dotColor =
                    e.status === 'forsinket' ? 'bg-red-500' :
                    e.status === 'fullført' ? 'bg-green-600' :
                    e.status === 'pågår' ? 'bg-blue-600' : 'bg-neutral-400'
                  const DotIcon = e.status === 'forsinket' ? AlertTriangle : e.status === 'fullført' ? CheckCircle2 : ChevronRight
                  return (
                    <li key={e.id} className="relative mb-2.5 last:mb-0">
                      <span className={`absolute -left-[28px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${dotColor}`}>
                        <DotIcon className="h-2.5 w-2.5 text-white" aria-hidden />
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpen(e.id)}
                        className="block w-full rounded-md border border-neutral-200/80 bg-white px-3 py-2 text-left hover:border-[#1a3d32]/40 hover:bg-[#fbf9f3]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 shrink-0 text-center">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{MONTH_LABELS[mm]?.slice(0, 3)}</div>
                            <div className="text-base font-bold tabular-nums leading-none text-neutral-900">{day}</div>
                          </div>
                          <div className="h-8 w-px bg-neutral-200" />
                          <RowIcon title={e.tplName} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-neutral-900">{e.tplName}</div>
                            <div className="text-[11px] text-neutral-500">
                              {e.location}{!easy && e.assignee !== '—' ? ` · ${e.assignee}` : ''}
                            </div>
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

function EntriesKanban({
  entries,
  easy,
  onOpen,
}: {
  entries: MappedExecution[]
  easy: boolean
  onOpen: (id: string) => void
}) {
  const buckets = Object.fromEntries(KANBAN_COLS.map((c) => [c.id, [] as MappedExecution[]]))
  entries.forEach((e) => {
    if (buckets[e.status] !== undefined) buckets[e.status].push(e)
    else buckets['kladd'].push(e)
  })

  return (
    <div className="grid grid-cols-2 gap-3 overflow-x-auto p-3 sm:grid-cols-2 md:grid-cols-4">
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
                    style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                  >
                    <div className="flex items-start gap-2">
                      <RowIcon title={e.tplName} />
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-xs font-medium leading-tight text-neutral-900">{e.tplName}</div>
                        <div className="mt-0.5 text-[10px] text-neutral-500">{e.location}</div>
                      </div>
                    </div>
                    {(col.id === 'pågår' || col.id === 'forsinket') ? (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] tabular-nums text-neutral-500">
                          <span>50%</span>
                          {e.status === 'forsinket' ? <span className="font-semibold text-red-700">⚠ Forsinket</span> : null}
                        </div>
                        <div className="mt-0.5">
                          <ProgressBar value={0.5} tone={e.status === 'forsinket' ? 'danger' : 'forest'} />
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-1.5 flex items-center justify-between border-t border-neutral-100 pt-1.5 text-[10px]">
                      <span className="tabular-nums text-neutral-500">{e.due}</span>
                      {!easy && e.assignee !== '—' ? <Initials name={e.assignee} size={16} /> : null}
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
  easy,
  onStart,
}: {
  templates: ReturnType<typeof useChecklistModule>['templates']
  easy: boolean
  onStart: (templateId: string) => void
}) {
  if (templates.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen aktive maler. Gå til Innstillinger for å aktivere maler.
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
              <div className="text-[11px] text-neutral-500">{t.cadence_hint ?? 'Ingen kadense'}</div>
            </div>
            <Button variant="primary" size="sm" icon={<Play className="h-3 w-3" />} onClick={() => onStart(t.id)}>Start</Button>
          </li>
        ))}
      </ul>
      {/* Desktop: full table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50/60">
            <tr>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Mal</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Punkter</th>
              {!easy && <th className={LAYOUT_TABLE1_POSTINGS_TH}>Lovverk</th>}
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Oppdatert</th>
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} text-right`} />
        </tr>
      </thead>
      <tbody>
        {templates.map((t) => (
          <tr key={t.id} className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer`}>
            <td className="px-5 py-3">
              <div className="flex items-center gap-2.5">
                <RowIcon title={t.name} />
                <div>
                  <div className="font-medium text-neutral-900">{t.name}</div>
                  <div className="text-[11px] text-neutral-500">{t.cadence_hint ?? 'Ingen kadense'}</div>
                </div>
              </div>
            </td>
            <td className="px-5 py-3 tabular-nums text-neutral-800">
              {(t.definition as { items?: unknown[] } | null)?.items?.length ?? '—'}
            </td>
            {!easy && (
              <td className="px-5 py-3">
                <div className="flex flex-wrap gap-1">
                  <span className="rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]">{t.pack}</span>
                </div>
              </td>
            )}
            <td className="px-5 py-3 tabular-nums text-neutral-700">
              {formatDate(t.updated_at)}
            </td>
            <td className="px-5 py-3 text-right">
              <Button variant="primary" size="sm" icon={<Play className="h-3 w-3" />} onClick={() => onStart(t.id)}>Start</Button>
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
  easy,
  onStart,
}: {
  templates: ReturnType<typeof useChecklistModule>['templates']
  easy: boolean
  onStart: (templateId: string) => void
}) {
  if (templates.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-neutral-500">
        Ingen aktive maler. Gå til Innstillinger for å aktivere maler.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <article key={t.id} className="flex flex-col rounded-xl border border-neutral-200/80 bg-white" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div className="flex items-start gap-3 p-4 pb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e7efe9] text-[#1a3d32]">
              <RowIcon title={t.name} size="lg" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Mal · {t.pack}</div>
              <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-tight text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>{t.name}</h3>
            </div>
          </div>
          {t.description ? (
            <div className="border-t border-dashed border-neutral-200 px-4 py-2.5">
              <p className="line-clamp-3 text-[11px] text-neutral-600">{t.description}</p>
            </div>
          ) : null}
          {!easy && (
            <div className="border-t border-neutral-100 bg-[#fbf9f3] px-4 py-2 text-[11px]">
              <div className="flex items-center gap-1">
                <span className="rounded bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]">{t.pack}</span>
                {t.cadence_hint ? (
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">{t.cadence_hint}</span>
                ) : null}
              </div>
            </div>
          )}
          <div className="mt-auto flex items-center justify-between border-t border-neutral-100 px-4 py-2.5">
            <Link to="/compliance/checklists/admin" className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800">Rediger ›</Link>
            <Button variant="primary" size="sm" icon={<Play className="h-3 w-3" />} onClick={() => onStart(t.id)}>Start</Button>
          </div>
        </article>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ChecklistsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const packSlugParam = searchParams.get('pack')
  const templateSlugParam = searchParams.get('template')

  const licensedPacks = useLicensedPacks()
  const { supabase, locations } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })
  const { load, reloadAggregates } = cl
  const [createOpen, setCreateOpen] = useState(false)
  const [startTemplateId, setStartTemplateId] = useState<string | undefined>(undefined)

  // Hub-mode UI state
  const [activeTab, setActiveTab] = useState<'entries' | 'maler'>('entries')
  const [viewMode, setViewMode] = useState<'easy' | 'advanced'>('easy')
  const [view, setView] = useState<ViewMode>('tabell')
  const [search, setSearch] = useState('')
  const [showAllEntries, setShowAllEntries] = useState(false)
  const [showAllMaler, setShowAllMaler] = useState(false)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  // Filter bar — URL is the source of truth so links are shareable and
  // browser back/forward steps through filter combinations.
  const filters = useMemo<ChecklistFilters>(
    () => filtersFromSearchParams(searchParams),
    [searchParams],
  )
  const setFilters = useCallback(
    (next: ChecklistFilters) => {
      setSearchParams(filtersToSearchParams(next, searchParams), { replace: true })
    },
    [searchParams, setSearchParams],
  )
  const activeFilterCount = countActiveFilters(filters)

  // Saved views — org-shared content, per-user default landing. The
  // module slug is the contract — see migration 20260930120000.
  const savedViews = useSavedViews<ChecklistFilters>('compliance_checklists')
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  // Apply this user's default view once on first load. Skip if URL
  // already has filters (deep-link wins over default). The setState in
  // this effect runs exactly once per session after the views load —
  // not a cascading-render risk.
  const [defaultApplied, setDefaultApplied] = useState(false)
  useEffect(() => {
    if (defaultApplied) return
    if (savedViews.loading) return
    if (activeFilterCount > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDefaultApplied(true)
      return
    }
    if (savedViews.defaultViewId) {
      const def = savedViews.views.find((v) => v.id === savedViews.defaultViewId)
      if (def) {
        setFilters({ ...EMPTY_FILTERS, ...def.filters })
        setActiveViewId(def.id)
      }
    }
    setDefaultApplied(true)
  }, [
    defaultApplied,
    savedViews.loading,
    savedViews.defaultViewId,
    savedViews.views,
    activeFilterCount,
    setFilters,
  ])

  // Detect "active view but the user has edited the filters since
  // applying" → drives the `*` mark in the saved-views trigger.
  const hasUnsavedChanges = useMemo(() => {
    if (!activeViewId) return false
    const view = savedViews.views.find((v) => v.id === activeViewId)
    if (!view) return false
    return !filtersEqual(filters, { ...EMPTY_FILTERS, ...view.filters })
  }, [activeViewId, filters, savedViews.views])

  const easy = viewMode === 'easy'

  const activePack = useMemo(() => {
    if (!packSlugParam) return null
    return licensedPacks.find((p) => p.slug === (packSlugParam as CompliancePackSlug)) ?? null
  }, [licensedPacks, packSlugParam])

  const focusedTemplate = useMemo(() => {
    if (!templateSlugParam) return null
    if (activePack) {
      return (
        cl.templates.find(
          (t) => t.slug === templateSlugParam && t.pack === activePack.slug && t.is_active,
        ) ?? null
      )
    }
    return cl.templates.find((t) => t.slug === templateSlugParam && t.is_active) ?? null
  }, [cl.templates, activePack, templateSlugParam])

  const mode: 'template' | 'pack' | 'hub' = focusedTemplate
    ? 'template'
    : activePack
    ? 'pack'
    : 'hub'

  const focusedTemplateId = focusedTemplate?.id ?? null
  const focusedTemplatePack = focusedTemplate?.pack ?? null
  const activePackSlug = activePack?.slug ?? null

  useEffect(() => {
    if (mode === 'hub') {
      void load()
    } else if (focusedTemplateId && focusedTemplatePack) {
      void (async () => {
        await load({ pack: focusedTemplatePack })
        await reloadAggregates(focusedTemplatePack, focusedTemplateId)
      })()
    } else if (activePackSlug) {
      void load({ pack: activePackSlug })
    }
  }, [load, reloadAggregates, mode, activePackSlug, focusedTemplateId, focusedTemplatePack])

  const visibleExecutions = useMemo(() => {
    if (mode === 'hub') return cl.executions
    if (focusedTemplate) {
      return cl.executions.filter(
        (e) => e.pack === focusedTemplate.pack && e.template_id === focusedTemplate.id,
      )
    }
    if (activePack) return cl.executions.filter((e) => e.pack === activePack.slug)
    return cl.executions
  }, [cl.executions, mode, activePack, focusedTemplate])

  const formTemplates = useMemo(() => {
    if (focusedTemplate) return [focusedTemplate]
    if (activePack) return cl.templates.filter((t) => t.pack === activePack.slug && t.is_active)
    return []
  }, [cl.templates, activePack, focusedTemplate])

  // ─── Hub lookups ────────────────────────────────────────────────────────────

  const locationById = useMemo(() => {
    const m = new Map<string, string>()
    for (const loc of locations ?? []) m.set(loc.id, loc.name)
    return m
  }, [locations])

  const userById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of cl.assignableUsers) m.set(u.id, u.displayName)
    return m
  }, [cl.assignableUsers])

  // Map raw executions to the design-friendly format
  const mappedExecutions = useMemo<MappedExecution[]>(() =>
    cl.executions.map((row) => {
      const locName = row.location_id
        ? (locationById.get(row.location_id) ?? '—')
        : row.scope_catalogue_item_label ?? row.scope_other_label ?? '—'
      const dueRaw = row.scheduled_for ? new Date(row.scheduled_for) : null
      return {
        id: row.id,
        tplId: row.template_id,
        tplName: row.title,
        location: locName,
        status: mapStatus(row),
        due: dueRaw ? dueRaw.toLocaleDateString('nb-NO', { dateStyle: 'short' }) : '—',
        dueRaw,
        assignee: row.assigned_to ? (userById.get(row.assigned_to) ?? '—') : '—',
      }
    }),
  [cl.executions, locationById, userById])

  // Template ids per category — used by the category filter chip + the
  // displayedExecutions / displayedTemplates filters above.
  const tplIdsByCategory = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const tpl of cl.templates) {
      if (tpl.category_id) {
        const s = m.get(tpl.category_id) ?? new Set()
        s.add(tpl.id)
        m.set(tpl.category_id, s)
      }
    }
    return m
  }, [cl.templates])

  // Reset pagination when filter changes
  useEffect(() => { setShowAllEntries(false); setShowAllMaler(false) }, [filters, search, activeTab, viewMode])
  useEffect(() => { if (!cl.loading) setHasLoadedOnce(true) }, [cl.loading])

  // Union of template ids matched by the selected categories. Empty
  // selection = all templates pass.
  const tplIdsFromCategories = useMemo(() => {
    if (filters.categoryIds.length === 0) return null
    const set = new Set<string>()
    for (const catId of filters.categoryIds) {
      const tplSet = tplIdsByCategory.get(catId)
      if (tplSet) tplSet.forEach((id) => set.add(id))
    }
    return set
  }, [filters.categoryIds, tplIdsByCategory])

  // Filter-bar + search filter for the executions list.
  const displayedExecutions = useMemo(() => {
    let result = mappedExecutions
    if (tplIdsFromCategories) {
      result = result.filter((e) => tplIdsFromCategories.has(e.tplId))
    }
    if (filters.templateIds.length > 0) {
      const templateSet = new Set(filters.templateIds)
      result = result.filter((e) => templateSet.has(e.tplId))
    }
    if (filters.statuses.length > 0) {
      const statusSet = new Set(filters.statuses)
      result = result.filter((e) => statusSet.has(e.status))
    }
    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (e) =>
          e.tplName.toLowerCase().includes(q) ||
          e.location.toLowerCase().includes(q) ||
          e.assignee.toLowerCase().includes(q),
      )
    }
    return result
  }, [mappedExecutions, tplIdsFromCategories, filters.templateIds, filters.statuses, search])

  // Maler tab: only the Category and Template filters narrow the list
  // (status doesn't apply to templates themselves). Template filter
  // becomes a "show only these templates" pin.
  const displayedTemplates = useMemo(() => {
    let tpls = cl.templates.filter((t) => t.is_active)
    if (tplIdsFromCategories) {
      tpls = tpls.filter((t) => tplIdsFromCategories.has(t.id))
    }
    if (filters.templateIds.length > 0) {
      const templateSet = new Set(filters.templateIds)
      tpls = tpls.filter((t) => templateSet.has(t.id))
    }
    const q = search.trim().toLowerCase()
    if (q) tpls = tpls.filter((t) => t.name.toLowerCase().includes(q))
    return tpls
  }, [cl.templates, tplIdsFromCategories, filters.templateIds, search])

  // Filter-bar option lists — each computed from the live catalogue so
  // counts reflect current data. Counts are post-search-but-pre-filter
  // so the user sees how many rows each option *would* add/remove.
  const categoryFilterOptions = useMemo(
    () =>
      cl.categories
        .filter((c) => c.is_active)
        .map((c) => ({
          value: c.id,
          label: c.name,
          count: mappedExecutions.filter((e) => {
            const tplSet = tplIdsByCategory.get(c.id)
            return tplSet ? tplSet.has(e.tplId) : false
          }).length,
        })),
    [cl.categories, mappedExecutions, tplIdsByCategory],
  )

  const statusFilterOptions = useMemo(
    () =>
      (['kladd', 'pågår', 'fullført', 'forsinket'] as DisplayStatus[]).map((status) => ({
        value: status,
        label: STATUS_CONFIG[status].label,
        count: mappedExecutions.filter((e) => e.status === status).length,
      })),
    [mappedExecutions],
  )

  const templateFilterOptions = useMemo(
    () =>
      cl.templates
        .filter((t) => t.is_active)
        .map((t) => ({
          value: t.id,
          label: t.name,
          count: mappedExecutions.filter((e) => e.tplId === t.id).length,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'nb')),
    [cl.templates, mappedExecutions],
  )

  // ─── Hub mode render ────────────────────────────────────────────────────────

  if (mode === 'hub') {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Klarert' }, { label: 'HMS' }, { label: 'Sjekklister' }]}
        width="wide"
        title="Sjekklister"
        description={easy
          ? 'Planlegg og gjennomfør sjekklister — vernerunder, brannvern og daglig kontroll.'
          : 'Bibliotek av maler. Hver mal kjøres som en egen gjennomføring med eget dokument — i tråd med IK § 5 og AML § 3-1.'}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Enkel / Avansert toggle */}
            <div
              role="tablist"
              aria-label="Visningsmodus"
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-white p-1"
              style={{ boxShadow: '0 1px 1px rgba(0,0,0,0.03)' }}
            >
              {([
                { id: 'easy', label: 'Enkel', sub: 'For alle i felt', Icon: CircleDot },
                { id: 'advanced', label: 'Avansert', sub: 'HMS-ansvarlig', Icon: SlidersHorizontal },
              ] as const).map(({ id, label, sub, Icon }) => {
                const active = viewMode === id
                return (
                  <button
                    key={id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => setViewMode(id)}
                    className={[
                      'flex items-center gap-2 rounded-[5px] px-2.5 py-1.5 text-xs font-semibold transition-colors',
                      active ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:text-neutral-900',
                    ].join(' ')}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">{label}</span>
                    <span className={['hidden md:inline text-[10px] font-medium', active ? 'text-white/70' : 'text-neutral-400'].join(' ')}>
                      · {sub}
                    </span>
                  </button>
                )
              })}
            </div>

            <Button
              variant="secondary"
              icon={<ShieldCheck className="h-4 w-4" />}
              onClick={() => navigate('/compliance/checklists/etterlevelse')}
              title="Etterlevelse"
            >
              <span className="hidden sm:inline">Etterlevelse</span>
            </Button>
            <Button
              variant="secondary"
              icon={<Settings className="h-4 w-4" />}
              onClick={() => navigate('/compliance/checklists/admin')}
              title="Innstillinger"
            >
              <span className="hidden sm:inline">Innstillinger</span>
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
              disabled={cl.templates.filter((t) => t.is_active).length === 0}
            >
              <span className="hidden sm:inline">Ny gjennomføring</span>
            </Button>
          </div>
        }
      >
        {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}

        {/* Loading skeleton — shown while first load is in progress */}
        {cl.loading && cl.templates.length === 0 ? (
          <div className="animate-pulse space-y-4">
            <div className="h-10 rounded-lg bg-neutral-100" />
            <div className="h-10 rounded-lg bg-neutral-100 w-2/3" />
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : null}

        {/* Single-column layout — left "Kategorier" sidebar replaced by
            the filter bar (cat/status/template multi-select + saved
            views). The table now uses the full content width. */}
        <section className={['space-y-3', cl.loading && cl.templates.length === 0 ? 'hidden' : ''].join(' ')}>
          <div className="rounded-xl border border-neutral-200/80 bg-white" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            {/* Header strip: tabs + search + view switcher */}
            <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              {/* Tabs */}
              <nav className="flex items-center gap-1" aria-label="Faner">
                {([
                  { id: 'entries', label: 'Gjennomføringer', Icon: ClipboardList, count: displayedExecutions.length },
                  { id: 'maler', label: 'Maler', Icon: ClipboardCheck, count: displayedTemplates.length },
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
                        active ? 'bg-[var(--ui-accent)] text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                      ].join(' ')}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{label}</span>
                      <span className={['ml-1.5 rounded-full px-2 py-0.5 text-xs', active ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'].join(' ')}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </nav>

              {/* Search + view switcher */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
                  <input
                    type="search"
                    placeholder={activeTab === 'entries' ? 'Søk i tittel, sted…' : 'Søk i malnavn…'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[var(--ui-accent)] focus:bg-white sm:w-52"
                  />
                </div>
                <ViewSwitcher value={view} onChange={setView} />
              </div>
            </div>

            {/* Filter bar — category + status + template chips + saved views */}
            <FilterBar
              chips={
                <>
                  <FilterChip
                    label="Kategori"
                    options={categoryFilterOptions}
                    value={filters.categoryIds}
                    onChange={(next) => {
                      setFilters({ ...filters, categoryIds: next })
                      setActiveViewId(null)
                    }}
                  />
                  {activeTab === 'entries' ? (
                    <FilterChip
                      label="Status"
                      options={statusFilterOptions}
                      value={filters.statuses}
                      onChange={(next) => {
                        setFilters({ ...filters, statuses: next as DisplayStatus[] })
                        setActiveViewId(null)
                      }}
                    />
                  ) : null}
                  <FilterChip
                    label="Mal"
                    options={templateFilterOptions}
                    value={filters.templateIds}
                    onChange={(next) => {
                      setFilters({ ...filters, templateIds: next })
                      setActiveViewId(null)
                    }}
                  />
                </>
              }
              activeFilterCount={activeFilterCount}
              onReset={() => {
                setFilters(EMPTY_FILTERS)
                setActiveViewId(null)
              }}
              savedViews={
                <SavedViewsControl<ChecklistFilters>
                  currentFilters={filters}
                  activeViewId={activeViewId}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onApplyView={(view) => {
                    setFilters({ ...EMPTY_FILTERS, ...view.filters })
                    setActiveViewId(view.id)
                  }}
                  onClearActive={() => {
                    setActiveViewId(null)
                  }}
                  saved={savedViews}
                />
              }
            />

              {/* Body */}
              <div className="p-0">
                {activeTab === 'entries' ? (
                  <>
                    {(() => {
                      const paged = showAllEntries ? displayedExecutions : displayedExecutions.slice(0, HUB_PAGE_SIZE)
                      const hasMore = !showAllEntries && displayedExecutions.length > HUB_PAGE_SIZE
                      return (
                        <>
                          {view === 'tabell' && <EntriesTable entries={paged} easy={easy} onOpen={(id) => navigate(`/compliance/checklists/${id}`)} />}
                          {view === 'bokser' && <EntriesBoxes entries={paged} easy={easy} onOpen={(id) => navigate(`/compliance/checklists/${id}`)} />}
                          {view === 'tidslinje' && <EntriesTimeline entries={paged} easy={easy} onOpen={(id) => navigate(`/compliance/checklists/${id}`)} />}
                          {view === 'tavle' && <EntriesKanban entries={paged} easy={easy} onOpen={(id) => navigate(`/compliance/checklists/${id}`)} />}
                          {hasMore && (
                            <div className="flex items-center justify-center border-t border-neutral-100 py-3">
                              <button
                                type="button"
                                onClick={() => setShowAllEntries(true)}
                                className="text-xs font-semibold text-[#1a3d32] hover:underline"
                              >
                                Vis alle {displayedExecutions.length} gjennomføringer
                              </button>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </>
                ) : (
                  <>
                    {hasLoadedOnce && !cl.loading && displayedTemplates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-neutral-400">
                        <ClipboardCheck className="h-10 w-10 opacity-30" />
                        <p className="text-sm font-medium">Ingen aktive maler i denne kategorien</p>
                        <p className="text-xs">Aktiver maler i Innstillinger for å komme i gang.</p>
                      </div>
                    ) : (() => {
                      const pagedMaler = showAllMaler ? displayedTemplates : displayedTemplates.slice(0, HUB_PAGE_SIZE)
                      const hasMoreMaler = !showAllMaler && displayedTemplates.length > HUB_PAGE_SIZE
                      return (
                        <>
                          {view === 'bokser' ? (
                            <MalerBoxes
                              templates={pagedMaler}
                              easy={easy}
                              onStart={(id) => { setStartTemplateId(id); setCreateOpen(true) }}
                            />
                          ) : (
                            <MalerTable
                              templates={pagedMaler}
                              easy={easy}
                              onStart={(id) => { setStartTemplateId(id); setCreateOpen(true) }}
                            />
                          )}
                          {hasMoreMaler && (
                            <div className="flex items-center justify-center border-t border-neutral-100 py-3">
                              <button
                                type="button"
                                onClick={() => setShowAllMaler(true)}
                                className="text-xs font-semibold text-[#1a3d32] hover:underline"
                              >
                                Vis alle {displayedTemplates.length} maler
                              </button>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </>
                )}
              </div>
            </div>
          </section>

        <ComplianceCreateForm
          open={createOpen}
          onClose={() => { setCreateOpen(false); setStartTemplateId(undefined) }}
          templates={cl.templates.filter((t) => t.is_active)}
          assignableUsers={cl.assignableUsers}
          initialTemplateId={startTemplateId}
          onCreate={async (payload) => {
            const id = await cl.createExecution(payload)
            if (id) {
              setCreateOpen(false)
              setStartTemplateId(undefined)
              navigate(`/compliance/checklists/${id}`)
            }
          }}
        />
      </ModulePageShell>
    )
  }

  // ─── Pack / template modes (unchanged) ────────────────────────────────────

  const pack = activePack!
  const pageTitle = focusedTemplate ? focusedTemplate.name : pack.pluralLabel
  const pageDescription = focusedTemplate
    ? (focusedTemplate.description ?? pack.description)
    : pack.description
  const ctaLabel = focusedTemplate
    ? `Ny ${focusedTemplate.name.toLowerCase()}`
    : pack.ctaLabel

  return (
    <ModulePageShell
      breadcrumb={
        focusedTemplate
          ? [
              { label: 'HMS' },
              { label: 'Sjekklister', to: '/compliance/checklists' },
              { label: pack.pluralLabel, to: `/compliance/checklists?pack=${pack.slug}` },
              { label: focusedTemplate.name },
            ]
          : [
              { label: 'HMS' },
              { label: 'Sjekklister', to: '/compliance/checklists' },
              { label: pack.pluralLabel },
            ]
      }
      title={pageTitle}
      description={pageDescription}
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
            disabled={formTemplates.length === 0}
          >
            {ctaLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}

        {!focusedTemplate ? (
          <ModuleLegalBanner
            title={pack.shortName}
            intro={<p>{pack.description}</p>}
            references={pack.legalReferences.map((r) => ({
              code: r.code,
              text: r.text,
            }))}
          />
        ) : null}

        <LayoutScoreStatRow
          items={[
            {
              big: String(cl.aggregates.openCount),
              title: focusedTemplate ? 'Åpne kjøringer' : pack.kpiLabels.open,
              sub: focusedTemplate ? focusedTemplate.name : 'Under behandling',
            },
            {
              big: String(cl.aggregates.criticalFindings),
              title: focusedTemplate ? 'Kritiske funn' : pack.kpiLabels.critical,
              sub: 'Krever oppfølging',
            },
            {
              big: String(cl.aggregates.ytdCompleted),
              title: focusedTemplate ? 'Signert i år' : pack.kpiLabels.ytd,
              sub: focusedTemplate ? focusedTemplate.name : 'Signert i år',
            },
          ]}
        />

        <LayoutTable1PostingsShell
          wrap
          title={pageTitle}
          description={`Alle ${pageTitle.toLowerCase()} — sortert etter siste aktivitet.`}
          toolbar={null}
          footer={<span className="text-neutral-500">{visibleExecutions.length} poster</span>}
        >
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Planlagt</th>
                  <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
                </tr>
              </thead>
              <tbody>
                {visibleExecutions.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="py-12 text-center">
                        <p className="text-sm text-neutral-500">Ingen {pageTitle.toLowerCase()} ennå.</p>
                        <div className="mt-3 inline-flex">
                          <Button
                            variant="primary"
                            icon={<Plus className="h-4 w-4" />}
                            onClick={() => setCreateOpen(true)}
                            disabled={formTemplates.length === 0}
                          >
                            {ctaLabel}
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleExecutions.map((row) => (
                    <tr
                      key={row.id}
                      className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                      onClick={() => navigate(`/compliance/checklists/${row.id}`)}
                    >
                      <td className="px-5 py-3 font-medium text-neutral-900">{row.title}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-neutral-600">{formatDate(row.scheduled_for)}</td>
                      <td className="w-8 px-3 py-3 text-neutral-300">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </LayoutTable1PostingsShell>
      </div>

      <ComplianceCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        templates={formTemplates}
        assignableUsers={cl.assignableUsers}
        onCreate={async (payload) => {
          const id = await cl.createExecution(payload)
          if (id) {
            setCreateOpen(false)
            navigate(`/compliance/checklists/${id}`)
          }
        }}
      />
    </ModulePageShell>
  )
}
