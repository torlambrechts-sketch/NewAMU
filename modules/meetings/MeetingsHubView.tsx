// Møter — hub body (redesign).
//
// Three top-level tabs: Møter · Maler · Statistikk.
// Four view modes for the Møter list: Tabell · Bokser · Tidslinje · Tavle.
// Left rail = compliance framework filter + upcoming reminders + status sidebar.
//
// Data flows from `useMeetings` (system + per-org templates, instances, categories).

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Check,
  ClipboardList,
  Clock,
  Columns3,
  Database,
  FilePen,
  FileStack,
  FileText,
  Handshake,
  LayoutGrid,
  ListChecks,
  ListTodo,
  Lock,
  MapPin,
  Radio,
  Rows3,
  Scale,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { FilterBar, SavedViewsControl } from '../../src/components/ui/FilterBar'
import { FilterChip } from '../../src/components/ui/FilterChip'
import { useSavedViews } from '../../src/hooks/useSavedViews'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import {
  ReportingPeriodPicker,
  type PeriodValue,
} from './components/ReportingPeriodPicker'
import { suggestPeriodForTemplate } from './lib/suggestPeriodForTemplate'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useMeetings } from './useMeetings'
import {
  MEETING_CONFIDENTIALITY_LABEL,
  MEETING_STATUS_LABEL,
} from './meetingsLabels'
import {
  MEETING_CONFIDENTIALITY_VALUES,
  MEETING_STATUS_VALUES,
} from './types'
import type {
  MeetingConfidentialityLevel,
  MeetingRow,
  MeetingStatus,
  ResolvedMeetingTemplate,
} from './types'

// ── Framework presentation (icon + brand colour + short label) ────────────

type FrameworkVisual = {
  id: string
  label: string
  short: string
  icon: typeof Building2
  color: string
}

const FRAMEWORK_VISUALS: FrameworkVisual[] = [
  { id: 'AML', label: 'Arbeidsmiljøloven', short: 'AML', icon: Scale, color: '#1a3d32' },
  { id: 'IK-f', label: 'IK-forskriften', short: 'IK-f', icon: ClipboardList, color: '#5A9C76' },
  { id: 'Hovedavtalen', label: 'Hovedavtalen', short: 'Hovedavtalen', icon: Handshake, color: '#5A9C76' },
  { id: 'Likestillingsloven', label: 'Likestillingsloven', short: 'Likestilling', icon: Scale, color: '#7C3AED' },
  { id: 'ISO_45001', label: 'ISO 45001 — HMS', short: 'ISO 45001', icon: BadgeCheck, color: '#2563EB' },
  { id: 'ISO_9001', label: 'ISO 9001 — Kvalitet', short: 'ISO 9001', icon: Award, color: '#7C3AED' },
  { id: 'ISO_14001', label: 'ISO 14001 — Miljø', short: 'ISO 14001', icon: BadgeCheck, color: '#16A34A' },
  { id: 'ISO_27001', label: 'ISO 27001 — Informasjonssikkerhet', short: 'ISO 27001', icon: ShieldCheck, color: '#0EA5E9' },
  { id: 'GDPR', label: 'Personvern (GDPR)', short: 'GDPR', icon: Lock, color: '#0EA5E9' },
  { id: 'INTERNAL', label: 'Internt', short: 'Internt', icon: Users, color: '#737373' },
]

const FRAMEWORK_BY_ID = new Map(FRAMEWORK_VISUALS.map((f) => [f.id, f]))

function frameworkVisual(id: string): FrameworkVisual {
  return FRAMEWORK_BY_ID.get(id) ?? FRAMEWORK_VISUALS[FRAMEWORK_VISUALS.length - 1]
}

// ── View modes for the Møter list ────────────────────────────────────────

const MTG_VIEW_MODES = [
  { id: 'tabell' as const, label: 'Tabell', icon: Rows3 },
  { id: 'bokser' as const, label: 'Bokser', icon: LayoutGrid },
  { id: 'tidslinje' as const, label: 'Tidslinje', icon: CalendarDays },
  { id: 'tavle' as const, label: 'Tavle', icon: Columns3 },
]

type ViewMode = (typeof MTG_VIEW_MODES)[number]['id']

const MTG_KANBAN_COLS: Array<{
  id: MeetingStatus
  label: string
  accent: string
  icon: typeof FilePen
}> = [
  { id: 'planned', label: 'Planlagt', accent: '#6366F1', icon: CalendarClock },
  { id: 'in_progress', label: 'Pågår', accent: '#2F7757', icon: Radio },
  { id: 'completed', label: 'Fullført', accent: '#1a3d32', icon: CheckCircle2 },
  { id: 'cancelled', label: 'Avlyst', accent: '#a3a3a3', icon: FilePen },
]

const STATUS_BADGE: Record<MeetingStatus, 'draft' | 'active' | 'signed' | 'neutral'> = {
  planned: 'active',
  in_progress: 'active',
  completed: 'signed',
  cancelled: 'neutral',
}

// ── Date helpers ─────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtDateShort(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtTimeShort(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
}

function daysUntil(iso: string | null, now: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.ceil((t - now) / (1000 * 60 * 60 * 24)))
}

// ── Pill components ──────────────────────────────────────────────────────

function MtgStatusPill({ status }: { status: MeetingStatus }) {
  return <Badge variant={STATUS_BADGE[status]}>{MEETING_STATUS_LABEL[status]}</Badge>
}

function FrameworkPill({ framework }: { framework: string }) {
  const fw = frameworkVisual(framework)
  const Icon = fw.icon
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ borderColor: `${fw.color}40`, background: `${fw.color}12`, color: fw.color }}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
      {fw.short}
    </span>
  )
}

function ProgressBar({
  value,
  tone = 'forest',
  height = 6,
}: {
  value: number
  tone?: 'forest' | 'warn' | 'danger'
  height?: number
}) {
  const pct = Math.min(100, Math.max(0, value * 100))
  const bg = tone === 'forest' ? '#1a3d32' : tone === 'danger' ? '#dc2626' : '#d97706'
  return (
    <div
      className="overflow-hidden rounded-full bg-neutral-200"
      style={{ height }}
      aria-hidden
    >
      <div className="h-full transition-all" style={{ width: `${pct}%`, background: bg }} />
    </div>
  )
}

function ParticipantsCount({ count }: { count: number }) {
  // Hub list query doesn't include attendee rows, so we can only show the
  // initially-planned participant count (snapshot from meeting creation).
  // The actual confirmed/declined breakdown lives on the detail view.
  if (count === 0) return <span className="text-[10px] text-neutral-400">Ingen deltakere</span>
  return (
    <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-neutral-600">
      <span className="h-1.5 w-1.5 rounded-full bg-[#1a3d32]" aria-hidden />
      {count} {count === 1 ? 'deltaker' : 'deltakere'}
    </span>
  )
}

// ── Aggregates from raw data ─────────────────────────────────────────────

type FrameworkAggregate = {
  id: string
  label: string
  held: number
  required: number
  complianceRate: number
}

function frameworksWithCounts(
  meetings: MeetingRow[],
  templates: ResolvedMeetingTemplate[],
): { id: string; label: string; short: string; meetingsCount: number; malerCount: number }[] {
  const visited = new Set<string>()
  const list: { id: string; label: string; short: string; meetingsCount: number; malerCount: number }[] = []
  for (const f of FRAMEWORK_VISUALS) {
    const meetingsCount = meetings.filter((m) => meetingFramework(m) === f.id).length
    const malerCount = templates.filter((t) => t.framework === f.id).length
    if (meetingsCount === 0 && malerCount === 0) continue
    visited.add(f.id)
    list.push({ id: f.id, label: f.label, short: f.short, meetingsCount, malerCount })
  }
  // Surface any framework we haven't visualised yet.
  for (const m of meetings) {
    const f = meetingFramework(m)
    if (visited.has(f)) continue
    visited.add(f)
    const fv = frameworkVisual(f)
    list.push({
      id: f,
      label: fv.label,
      short: fv.short,
      meetingsCount: meetings.filter((mm) => meetingFramework(mm) === f).length,
      malerCount: templates.filter((t) => t.framework === f).length,
    })
  }
  return list
}

function meetingFramework(m: MeetingRow): string {
  const snap = m.definition_snapshot?.framework
  return snap ?? 'INTERNAL'
}

function computeFrameworkAggregates(
  meetings: MeetingRow[],
  templates: ResolvedMeetingTemplate[],
): FrameworkAggregate[] {
  const visuals = frameworksWithCounts(meetings, templates)
  return visuals
    .map((v) => {
      // "required" = number of meetings per year mandated by the cadence
      // hints across templates within this framework. Templates with
      // ad_hoc/null cadence contribute 0.
      const required = templates
        .filter((t) => t.framework === v.id)
        .reduce((sum, t) => sum + cadenceToAnnual(t.cadenceHint), 0)
      const held = meetings.filter(
        (m) =>
          meetingFramework(m) === v.id &&
          (m.status === 'completed' ||
            (m.completed_at &&
              new Date(m.completed_at).getFullYear() === new Date().getFullYear())),
      ).length
      const safeRequired = Math.max(required, 1)
      return {
        id: v.id,
        label: v.short,
        held,
        required: required || held,
        complianceRate: Math.min(1, held / safeRequired),
      }
    })
    .filter((b) => b.required > 0 || b.held > 0)
}

function cadenceToAnnual(cadenceHint: string | null): number {
  switch (cadenceHint) {
    case 'monthly':
      return 12
    case 'quarterly':
      return 4
    case 'semiannual':
      return 2
    case 'annual':
      return 1
    case 'ad_hoc':
    case null:
    default:
      return 0
  }
}

// ── Main component ───────────────────────────────────────────────────────

export interface MeetingsHubViewProps {
  /** Tabs rendered as the secondary heading row (root-tab strip). */
  tabs?: ReactNode
  /** When true, the orchestrator owns the shell — render body only. */
  bodyOnly?: boolean
}

export function MeetingsHubView({ tabs, bodyOnly = false }: MeetingsHubViewProps) {
  const meetings = useMeetings()
  const orgSetup = useOrgSetupContext()
  const orgHeadcount = orgSetup.members?.length ?? 0
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTemplateParam = searchParams.get('template')

  // Multi-select filter state — mirrors the compliance/ChecklistsPage
  // data-grid pattern. Empty arrays = no filter on that dimension.
  // URL-synced via history.replaceState in the effect below (avoids
  // the setSearchParams re-render cascade — see Sjekklister commit
  // 6051593 for the full rationale).
  const [frameworks, setFrameworks] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    const raw = new URLSearchParams(window.location.search).get('framework')
    return raw ? raw.split(',').filter(Boolean) : []
  })
  const [statuses, setStatuses] = useState<MeetingStatus[]>(() => {
    if (typeof window === 'undefined') return []
    const raw = new URLSearchParams(window.location.search).get('status')
    return raw ? (raw.split(',').filter(Boolean) as MeetingStatus[]) : []
  })
  const [confidentialities, setConfidentialities] = useState<MeetingConfidentialityLevel[]>(() => {
    if (typeof window === 'undefined') return []
    const raw = new URLSearchParams(window.location.search).get('conf')
    return raw ? (raw.split(',').filter(Boolean) as MeetingConfidentialityLevel[]) : []
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const setOrDelete = (key: string, values: string[]) => {
      if (values.length > 0) url.searchParams.set(key, values.join(','))
      else url.searchParams.delete(key)
    }
    setOrDelete('framework', frameworks)
    setOrDelete('status', statuses)
    setOrDelete('conf', confidentialities)
    window.history.replaceState(null, '', url.toString())
  }, [frameworks, statuses, confidentialities])
  const [tab, setTab] = useState<'meetings' | 'maler' | 'statistikk'>('meetings')
  const [view, setView] = useState<ViewMode>('tabell')
  const [search, setSearch] = useState('')
  // Wall-clock anchor for "Om X dager" + late-invite checks. Captured
  // once per mount for purity, then refreshed when the tab becomes
  // visible again (covers "left open over the weekend" → Monday morning
  // labels were 3 days stale).
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
  const [createOpen, setCreateOpen] = useState(false)
  const [presetTemplateId, setPresetTemplateId] = useState<string | null>(null)

  // Derive panel-open and preset from either local state OR the URL
  // ?template=<id>. The URL is cleared when the slide closes, so there's
  // no setState-in-effect handshake.
  const effectiveOpen = createOpen || !!activeTemplateParam
  const effectivePreset = presetTemplateId ?? activeTemplateParam

  const frameworksList = useMemo(
    () => frameworksWithCounts(meetings.meetings, meetings.templates),
    [meetings.meetings, meetings.templates],
  )

  const filteredMeetings = useMemo(() => {
    const term = search.trim().toLowerCase()
    const fwSet = frameworks.length ? new Set(frameworks) : null
    const statusSet = statuses.length ? new Set(statuses) : null
    const confSet = confidentialities.length ? new Set(confidentialities) : null
    return meetings.meetings.filter((m) => {
      if (fwSet && !fwSet.has(meetingFramework(m))) return false
      if (statusSet && !statusSet.has(m.status)) return false
      if (confSet && !confSet.has(m.confidentiality_level)) return false
      if (term) {
        const hay = `${m.title} ${m.location_label ?? ''} ${m.description ?? ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [meetings.meetings, frameworks, statuses, confidentialities, search])

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase()
    const fwSet = frameworks.length ? new Set(frameworks) : null
    return meetings.templates.filter((t) => {
      if (!t.isActive) return false
      if (fwSet && !fwSet.has(t.framework)) return false
      if (term) {
        const hay = `${t.name} ${t.description ?? ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [meetings.templates, frameworks, search])

  const upcoming = useMemo(
    () =>
      meetings.meetings
        .filter((m) => m.status === 'planned' && m.scheduled_at)
        .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))
        .slice(0, 3),
    [meetings.meetings],
  )

  const frameworkAggregates = useMemo(
    () => computeFrameworkAggregates(meetings.meetings, meetings.templates),
    [meetings.meetings, meetings.templates],
  )

  const minutesOnTime = useMemo(() => computeMinutesOnTime(meetings.meetings), [meetings.meetings])

  // ── Filter-bar wiring ───────────────────────────────────────────────
  type MeetingFilters = {
    frameworks: string[]
    statuses: MeetingStatus[]
    confidentialities: MeetingConfidentialityLevel[]
  }
  const EMPTY_MEETING_FILTERS: MeetingFilters = { frameworks: [], statuses: [], confidentialities: [] }
  const currentFilters: MeetingFilters = { frameworks, statuses, confidentialities }
  const activeFilterCount =
    frameworks.length + statuses.length + confidentialities.length
  const meetingsFiltersEqual = (a: MeetingFilters, b: MeetingFilters) => {
    const eq = (x: readonly string[], y: readonly string[]) => {
      if (x.length !== y.length) return false
      const xs = [...x].sort()
      const ys = [...y].sort()
      return xs.every((v, i) => v === ys[i])
    }
    return (
      eq(a.frameworks, b.frameworks) &&
      eq(a.statuses, b.statuses) &&
      eq(a.confidentialities, b.confidentialities)
    )
  }
  const savedMeetings = useSavedViews<MeetingFilters>('meetings')
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [defaultApplied, setDefaultApplied] = useState(false)
  useEffect(() => {
    if (defaultApplied) return
    if (savedMeetings.loading) return
    if (activeFilterCount > 0) {
      const match = savedMeetings.views.find((v) =>
        meetingsFiltersEqual(currentFilters, { ...EMPTY_MEETING_FILTERS, ...v.filters }),
      )
      if (match) setActiveViewId(match.id)
      setDefaultApplied(true)
      return
    }
    if (savedMeetings.defaultViewId) {
      const def = savedMeetings.views.find((v) => v.id === savedMeetings.defaultViewId)
      if (def) {
        setFrameworks([...(def.filters.frameworks ?? [])])
        setStatuses([...(def.filters.statuses ?? [])])
        setConfidentialities([...(def.filters.confidentialities ?? [])])
        setActiveViewId(def.id)
      }
    }
    setDefaultApplied(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultApplied, savedMeetings.loading, savedMeetings.defaultViewId, savedMeetings.views, activeFilterCount, frameworks, statuses, confidentialities])
  const hasUnsavedChanges = useMemo(() => {
    if (!activeViewId) return false
    const view = savedMeetings.views.find((v) => v.id === activeViewId)
    if (!view) return false
    return !meetingsFiltersEqual(currentFilters, { ...EMPTY_MEETING_FILTERS, ...view.filters })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeViewId, frameworks, statuses, confidentialities, savedMeetings.views])
  const clearAllFilters = () => {
    setFrameworks([])
    setStatuses([])
    setConfidentialities([])
    setActiveViewId(null)
  }

  const openCreate = (templateId: string | null) => {
    setPresetTemplateId(templateId)
    setCreateOpen(true)
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        icon={<Bell className="h-4 w-4" />}
        onClick={() => navigate('/meetings/agenda-backlog')}
      >
        Påminnelser {upcoming.length > 0 ? `(${upcoming.length})` : ''}
      </Button>
      <Button
        type="button"
        variant="secondary"
        icon={<BarChart3 className="h-4 w-4" />}
        onClick={() => navigate('/meetings/analyse')}
      >
        Analyse
      </Button>
      {meetings.canManage ? (
        <Button
          type="button"
          variant="primary"
          icon={<CalendarPlus className="h-4 w-4" />}
          onClick={() => openCreate(null)}
        >
          Planlegg møte
        </Button>
      ) : null}
    </div>
  )

  const body = (
    <div className="space-y-4">
      {/* The compliance + reminder stats that used to sit in the left
          rail (upcoming meetings, framework aggregates, on-time
          minutes, late legal alerts) now live in /meetings/analyse.
          The filter-bar pattern replaces the rail's framework picker
          with a multi-select chip. Width=full lets the table breathe. */}
      <section>
        <div className="rounded-xl border border-neutral-200/80 bg-white k-card-shadow">
          {/* FilterBar — framework + status + confidentiality + saved views */}
          <FilterBar
            chips={
              <>
                <FilterChip
                  label="Rammeverk"
                  options={frameworksList.map((f) => ({
                    value: f.id,
                    label: f.label,
                    count: tab === 'maler' ? f.malerCount : f.meetingsCount,
                  }))}
                  value={frameworks}
                  onChange={(next) => {
                    setFrameworks(next)
                    setActiveViewId(null)
                  }}
                />
                <FilterChip
                  label="Status"
                  options={MEETING_STATUS_VALUES.map((s) => ({
                    value: s,
                    label: MEETING_STATUS_LABEL[s],
                  }))}
                  value={statuses}
                  onChange={(next) => {
                    setStatuses(next as MeetingStatus[])
                    setActiveViewId(null)
                  }}
                />
                <FilterChip
                  label="Konfidensialitet"
                  options={MEETING_CONFIDENTIALITY_VALUES.map((c) => ({
                    value: c,
                    label: MEETING_CONFIDENTIALITY_LABEL[c],
                  }))}
                  value={confidentialities}
                  onChange={(next) => {
                    setConfidentialities(next as MeetingConfidentialityLevel[])
                    setActiveViewId(null)
                  }}
                />
              </>
            }
            activeFilterCount={activeFilterCount}
            onReset={clearAllFilters}
            savedViews={
              <SavedViewsControl<MeetingFilters>
                currentFilters={currentFilters}
                activeViewId={activeViewId}
                hasUnsavedChanges={hasUnsavedChanges}
                onApplyView={(view) => {
                  setFrameworks([...(view.filters.frameworks ?? [])])
                  setStatuses([...(view.filters.statuses ?? [])])
                  setConfidentialities([...(view.filters.confidentialities ?? [])])
                  setActiveViewId(view.id)
                }}
                onClearActive={() => setActiveViewId(null)}
                saved={savedMeetings}
              />
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 px-4 py-2.5">
            <HubInlineTabs
              activeId={tab}
              counts={{
                meetings: filteredMeetings.length,
                maler: filteredTemplates.length,
              }}
              onChange={setTab}
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <StandardInput
                  className="w-52 bg-neutral-50 py-1.5 pl-7 pr-2 text-xs"
                  placeholder="Søk i tittel, sted…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {tab === 'meetings' ? (
                <div className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
                  {MTG_VIEW_MODES.map((m) => {
                    const Icon = m.icon
                    const active = m.id === view
                    return (
                      <Button
                        key={m.id}
                        variant="ghost"
                        size="sm"
                        onClick={() => setView(m.id)}
                        title={m.label}
                        className={[
                          'rounded px-2 py-1 text-xs font-medium',
                          active
                            ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200'
                            : 'text-neutral-500 hover:text-neutral-800',
                        ].join(' ')}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        <span className="hidden md:inline">{m.label}</span>
                      </Button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div>
            {tab === 'meetings' ? (
              <MtgList
                view={view}
                meetings={filteredMeetings}
                templates={meetings.templates}
                onOpen={(m) => navigate(`/meetings/${m.id}`)}
                now={now}
              />
            ) : tab === 'maler' ? (
              <MtgMalerTable
                templates={filteredTemplates}
                meetings={meetings.meetings}
                orgHeadcount={orgHeadcount}
                onSchedule={(t) =>
                  openCreate(t.systemTemplateId ?? t.orgTemplateId ?? null)
                }
              />
            ) : (
              <MtgStatistikk
                meetings={meetings.meetings}
                aggregates={frameworkAggregates}
                minutesOnTime={minutesOnTime}
                now={now}
              />
            )}
          </div>
        </div>
      </section>

      <CreateMeetingSlidePanel
        open={effectiveOpen}
        onClose={() => {
          setCreateOpen(false)
          setPresetTemplateId(null)
          // Clear the URL param if it triggered this open.
          if (activeTemplateParam) {
            const next = new URLSearchParams(searchParams)
            next.delete('template')
            setSearchParams(next, { replace: true })
          }
        }}
        meetings={meetings}
        presetTemplateId={effectivePreset}
      />
    </div>
  )

  if (bodyOnly) return body

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Compliance' }, { label: 'Møter' }]}
      width="full"
      title="Møter"
      description="Møter med lovpålagte agendaer, automatisk statistikkhenting og protokoll-arkiv. Skalerer fra AML kapittel 7 til ISO 45001/9001-ledelsesgjennomgåelser."
      tabs={tabs}
      headerActions={headerActions}
      loading={meetings.loading && meetings.templates.length === 0}
      loadingLabel="Laster møter…"
    >
      {body}
    </ModulePageShell>
  )
}

// ── Helpers: minutes-on-time (within 14 days after completion) ───────────

function computeMinutesOnTime(meetings: MeetingRow[]): number {
  let signed = 0
  let onTime = 0
  for (const m of meetings) {
    if (!m.protocol_signed_at) continue
    signed += 1
    const completedAt = m.completed_at ?? m.scheduled_at
    if (!completedAt) continue
    const completed = new Date(completedAt).getTime()
    const signedAt = new Date(m.protocol_signed_at).getTime()
    const days = Math.max(0, (signedAt - completed) / 86400000)
    if (days <= 14) onTime += 1
  }
  return signed === 0 ? 0 : onTime / signed
}

// ── Framework rail (left column) ─────────────────────────────────────────

// ── Inline tab strip ────────────────────────────────────────────────────

function HubInlineTabs({
  activeId,
  counts,
  onChange,
}: {
  activeId: 'meetings' | 'maler' | 'statistikk'
  counts: { meetings: number; maler: number }
  onChange: (id: 'meetings' | 'maler' | 'statistikk') => void
}) {
  const items = [
    { id: 'meetings' as const, label: 'Møter', icon: Calendar, badgeCount: counts.meetings },
    { id: 'maler' as const, label: 'Maler', icon: FileStack, badgeCount: counts.maler },
    { id: 'statistikk' as const, label: 'Statistikk', icon: BarChart3 },
  ]
  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Møter-fanestrip">
      {items.map((t) => {
        const Icon = t.icon
        const active = t.id === activeId
        return (
          <Button
            key={t.id}
            variant="ghost"
            size="sm"
            onClick={() => onChange(t.id)}
            className={[
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[#1a3d32] text-white hover:bg-[#14312a] hover:text-white'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
            ].join(' ')}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span>{t.label}</span>
            {t.badgeCount !== undefined ? (
              <span
                className={[
                  'ml-1 rounded-full px-1.5 py-0.5 text-[10px]',
                  active ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700',
                ].join(' ')}
              >
                {t.badgeCount}
              </span>
            ) : null}
          </Button>
        )
      })}
    </nav>
  )
}

// ── Møter list — dispatcher + view modes ─────────────────────────────────

function MtgList({
  view,
  meetings,
  templates,
  onOpen,
  now,
}: {
  view: ViewMode
  meetings: MeetingRow[]
  templates: ResolvedMeetingTemplate[]
  onOpen: (m: MeetingRow) => void
  now: number
}) {
  const lookupTpl = useTemplateLookup(templates)
  if (meetings.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen møter i denne kategorien ennå.
      </div>
    )
  }
  if (view === 'tabell') return <MtgTable meetings={meetings} lookupTpl={lookupTpl} onOpen={onOpen} />
  if (view === 'bokser') return <MtgBoxes meetings={meetings} lookupTpl={lookupTpl} onOpen={onOpen} now={now} />
  if (view === 'tidslinje')
    return <MtgTimeline meetings={meetings} lookupTpl={lookupTpl} onOpen={onOpen} />
  return <MtgKanban meetings={meetings} lookupTpl={lookupTpl} onOpen={onOpen} />
}

type TemplateLookup = (m: MeetingRow) => ResolvedMeetingTemplate | null

/** Build a O(1) lookup map keyed by system + org template id. The four
 *  view-mode components iterate hundreds of meetings on every render —
 *  building the map once per render is much cheaper than .find() per row. */
function useTemplateLookup(
  templates: ResolvedMeetingTemplate[],
): (m: MeetingRow) => ResolvedMeetingTemplate | null {
  const map = useMemo(() => {
    const m = new Map<string, ResolvedMeetingTemplate>()
    for (const t of templates) {
      if (t.systemTemplateId) m.set(`sys:${t.systemTemplateId}`, t)
      if (t.orgTemplateId) m.set(`org:${t.orgTemplateId}`, t)
    }
    return m
  }, [templates])
  return useMemo(() => {
    return (m: MeetingRow) => {
      if (m.system_template_id) {
        const hit = map.get(`sys:${m.system_template_id}`)
        if (hit) return hit
      }
      if (m.org_template_id) {
        const hit = map.get(`org:${m.org_template_id}`)
        if (hit) return hit
      }
      return null
    }
  }, [map])
}

const TABLE_TH =
  'px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600'
const TABLE_TR =
  'border-b border-neutral-100 hover:bg-neutral-50/60 transition-colors'

function MtgTable({
  meetings,
  lookupTpl,
  onOpen,
}: {
  meetings: MeetingRow[]
  lookupTpl: TemplateLookup
  onOpen: (m: MeetingRow) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-neutral-50/60">
          <tr>
            <th className={TABLE_TH}>Møte</th>
            <th className={TABLE_TH}>Tid og sted</th>
            <th className={TABLE_TH}>Status</th>
            <th className={TABLE_TH}>Deltakere</th>
            <th className={TABLE_TH}>Rammeverk</th>
            <th className={TABLE_TH}>Sjekk</th>
            <th className={`${TABLE_TH} text-right`} />
          </tr>
        </thead>
        <tbody>
          {meetings.map((m) => {
            const tpl = lookupTpl(m)
            const issues = computeMeetingIssues(m)
            const participants = m.participant_member_ids?.length ?? 0
            return (
              <tr
                key={m.id}
                className={`${TABLE_TR} cursor-pointer`}
                onClick={() => onOpen(m)}
                tabIndex={0}
                role="link"
                aria-label={`Åpne ${m.title}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpen(m)
                  }
                }}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
                      <Calendar className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-neutral-900">{m.title}</span>
                        {tpl?.lawRefs?.length ? (
                          <span
                            title="Lovpålagt"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#e7efe9] text-[#1a3d32]"
                          >
                            <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                          </span>
                        ) : null}
                        {m.confidentiality_level !== 'standard' ? (
                          <span
                            title="Konfidensielt"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-neutral-100 text-neutral-600"
                          >
                            <Lock className="h-2.5 w-2.5" aria-hidden />
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-neutral-500">{tpl?.name ?? ''}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-neutral-700">
                  <div className="tabular-nums">{fmtDateTime(m.scheduled_at)}</div>
                  <div className="text-[11px] text-neutral-500">{m.location_label ?? '—'}</div>
                </td>
                <td className="px-5 py-3">
                  <MtgStatusPill status={m.status} />
                </td>
                <td className="px-5 py-3">
                  <ParticipantsCount count={participants} />
                </td>
                <td className="px-5 py-3">
                  <FrameworkPill framework={meetingFramework(m)} />
                </td>
                <td className="px-5 py-3">
                  {issues.length === 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-green-700">
                      <Check className="h-3 w-3" aria-hidden /> OK
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"
                      title={issues.join(' · ')}
                    >
                      <AlertTriangle className="h-2.5 w-2.5" aria-hidden /> {issues.length}{' '}
                      sak{issues.length === 1 ? '' : 'er'}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-neutral-300">
                  <ChevronRight className="ml-auto h-4 w-4" aria-hidden />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function computeMeetingIssues(m: MeetingRow): string[] {
  const issues: string[] = []
  const snap = m.definition_snapshot
  const mandatoryCount = snap?.agendaItems?.filter((a) => a.isMandatory).length ?? 0
  if (m.status === 'planned' && !m.invitation_sent_at && mandatoryCount > 0) {
    issues.push('Innkalling ikke sendt')
  }
  if (m.status === 'completed' && !m.protocol_signed_at) {
    issues.push('Referat ikke signert')
  }
  return issues
}

function MtgBoxes({
  meetings,
  lookupTpl,
  onOpen,
  now,
}: {
  meetings: MeetingRow[]
  lookupTpl: TemplateLookup
  onOpen: (m: MeetingRow) => void
  now: number
}) {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {meetings.map((m) => {
        const tpl = lookupTpl(m)
        const days = daysUntil(m.scheduled_at, now)
        const participants = m.participant_member_ids?.length ?? 0
        const hasMinutes = !!m.protocol_signed_at
        const hasAgenda = (m.definition_snapshot?.agendaItems?.length ?? 0) > 0
        return (
          <article
            key={m.id}
            onClick={() => onOpen(m)}
            tabIndex={0}
            role="link"
            aria-label={`Åpne ${m.title}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(m)
              }
            }}
            className="cursor-pointer rounded-xl border border-neutral-200/80 bg-white p-4 transition-all hover:border-[#1a3d32]/40 hover:shadow-md k-card-shadow focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/40"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e7efe9] text-[#1a3d32]">
                <Calendar className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <FrameworkPill framework={meetingFramework(m)} />
                  {tpl?.lawRefs?.length ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-[#e7efe9] px-1 py-0.5 text-[9px] font-bold text-[#14312a]">
                      <ShieldCheck className="h-2 w-2" aria-hidden /> Lovpålagt
                    </span>
                  ) : null}
                  {m.confidentiality_level !== 'standard' ? (
                    <span title="Konfidensielt">
                      <Lock className="h-3 w-3 text-neutral-500" aria-hidden />
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-tight text-neutral-900">
                  {m.title}
                </h3>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <MtgStatusPill status={m.status} />
              {m.status === 'planned' && days !== null ? (
                <span className="text-[11px] tabular-nums font-medium text-neutral-700">
                  Om {days}d
                </span>
              ) : (
                <span className="text-[11px] tabular-nums text-neutral-500">
                  {fmtDateShort(m.scheduled_at)}
                </span>
              )}
            </div>

            <div className="mt-3 rounded-md bg-[#fbf9f3] px-3 py-2 text-[11px] text-neutral-700">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-neutral-400" aria-hidden />
                <span className="tabular-nums">{fmtDateTime(m.scheduled_at)}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-neutral-400" aria-hidden />
                <span className="truncate">{m.location_label ?? '—'}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5 text-[11px]">
              <ParticipantsCount count={participants} />
              <div className="flex items-center gap-1.5 text-neutral-500">
                <ListChecks
                  className={['h-3 w-3', hasAgenda ? 'text-green-600' : 'text-amber-500'].join(' ')}
                  aria-hidden
                />
                <FileText
                  className={['h-3 w-3', hasMinutes ? 'text-green-600' : 'text-neutral-300'].join(' ')}
                  aria-hidden
                />
                {participants > 0 ? (
                  <span className="inline-flex items-center gap-0.5">
                    <ListTodo className="h-3 w-3 text-neutral-400" aria-hidden />
                    {participants}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function MtgTimeline({
  meetings,
  lookupTpl,
  onOpen,
}: {
  meetings: MeetingRow[]
  lookupTpl: TemplateLookup
  onOpen: (m: MeetingRow) => void
}) {
  const sorted = [...meetings].sort((a, b) => {
    const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
    const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
    return ta - tb
  })
  const groups = new Map<string, MeetingRow[]>()
  for (const m of sorted) {
    if (!m.scheduled_at) continue
    const d = new Date(m.scheduled_at)
    const key = `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
    const arr = groups.get(key) ?? []
    arr.push(m)
    groups.set(key, arr)
  }
  const MONTH_LABELS = [
    'Januar',
    'Februar',
    'Mars',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Desember',
  ]

  return (
    <div className="p-5">
      <div className="space-y-5">
        {[...groups.entries()].map(([k, list]) => {
          const [mm, yyyy] = k.split('.')
          const monthIdx = parseInt(mm, 10) - 1
          return (
            <div key={k}>
              <div className="mb-2 flex items-baseline gap-2">
                <h4 className="text-sm font-semibold text-neutral-900">
                  {MONTH_LABELS[monthIdx]} {yyyy}
                </h4>
                <span className="text-[11px] tabular-nums text-neutral-400">
                  {list.length} møter
                </span>
              </div>
              <ol className="relative border-l-2 border-neutral-200 pl-5">
                {list.map((m) => {
                  const tpl = lookupTpl(m)
                  const d = new Date(m.scheduled_at!)
                  return (
                    <li key={m.id} className="relative mb-2.5 last:mb-0">
                      <span
                        className={[
                          'absolute -left-[28px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white',
                          m.status === 'completed'
                            ? 'bg-[#1a3d32]'
                            : m.status === 'in_progress'
                              ? 'bg-green-600'
                              : m.status === 'planned'
                                ? 'bg-indigo-500'
                                : 'bg-neutral-400',
                        ].join(' ')}
                      >
                        {m.status === 'completed' ? (
                          <Check className="h-2.5 w-2.5 text-white" aria-hidden />
                        ) : m.status === 'in_progress' ? (
                          <Radio className="h-2.5 w-2.5 text-white" aria-hidden />
                        ) : (
                          <Calendar className="h-2.5 w-2.5 text-white" aria-hidden />
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        onClick={() => onOpen(m)}
                        className="block h-auto w-full rounded-md border border-neutral-200/80 bg-white px-3 py-2 text-left font-normal hover:border-[#1a3d32]/40 hover:bg-[#fbf9f3]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 shrink-0 text-center">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                              {MONTH_LABELS[monthIdx].slice(0, 3)}
                            </div>
                            <div className="text-base font-bold tabular-nums leading-none text-neutral-900">
                              {String(d.getDate()).padStart(2, '0')}
                            </div>
                            <div className="text-[10px] tabular-nums text-neutral-500">
                              {fmtTimeShort(m.scheduled_at)}
                            </div>
                          </div>
                          <div className="h-8 w-px bg-neutral-200" />
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-neutral-900">
                                {m.title}
                              </span>
                              {tpl?.lawRefs?.length ? (
                                <span title="Lovpålagt">
                                  <ShieldCheck
                                    className="h-3 w-3 shrink-0 text-[#1a3d32]"
                                    aria-hidden
                                  />
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              {m.location_label ?? '—'}
                            </div>
                          </div>
                          <FrameworkPill framework={meetingFramework(m)} />
                          <MtgStatusPill status={m.status} />
                        </div>
                      </Button>
                    </li>
                  )
                })}
              </ol>
            </div>
          )
        })}
        {groups.size === 0 ? (
          <p className="text-center text-sm text-neutral-500">Ingen tidsfestede møter.</p>
        ) : null}
      </div>
    </div>
  )
}

function MtgKanban({
  meetings,
  lookupTpl,
  onOpen,
}: {
  meetings: MeetingRow[]
  lookupTpl: TemplateLookup
  onOpen: (m: MeetingRow) => void
}) {
  const buckets: Record<MeetingStatus, MeetingRow[]> = {
    planned: [],
    in_progress: [],
    completed: [],
    cancelled: [],
  }
  for (const m of meetings) {
    // Defensive: if a future status leaks past the zod parser, drop it
    // in `planned` rather than crashing on `undefined.push()`.
    const bucket = buckets[m.status] ?? buckets.planned
    bucket.push(m)
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
      {MTG_KANBAN_COLS.map((col) => {
        const items = buckets[col.id]
        return (
          <div
            key={col.id}
            className="flex min-h-[420px] flex-col rounded-lg border border-neutral-200/80 bg-[#fbf9f3]/60"
          >
            <div className="flex items-center justify-between border-b border-neutral-200/70 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: col.accent }} />
                <span className="text-xs font-semibold text-neutral-900">{col.label}</span>
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 ring-1 ring-neutral-200">
                  {items.length}
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-2 p-2">
              {items.length === 0 ? (
                <div className="rounded-md border border-dashed border-neutral-200 p-3 text-center text-[11px] text-neutral-400">
                  Ingen
                </div>
              ) : (
                items.map((m) => {
                  const tpl = lookupTpl(m)
                  const participants = m.participant_member_ids?.length ?? 0
                  return (
                    <article
                      key={m.id}
                      onClick={() => onOpen(m)}
                      tabIndex={0}
                      role="link"
                      aria-label={`Åpne ${m.title}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onOpen(m)
                        }
                      }}
                      className="cursor-pointer rounded-md border border-neutral-200/80 bg-white p-2.5 hover:border-[#1a3d32]/40 hover:shadow-sm k-card-shadow focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/40"
                    >
                      <div className="flex items-start gap-2">
                        <Calendar className="mt-0.5 h-3 w-3 shrink-0 text-neutral-500" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-xs font-medium leading-tight text-neutral-900">
                            {m.title}
                          </div>
                          <div className="mt-0.5 text-[10px] text-neutral-500">
                            {fmtDateShort(m.scheduled_at)} · {fmtTimeShort(m.scheduled_at)}
                          </div>
                        </div>
                        {tpl?.lawRefs?.length ? (
                          <span title="Lovpålagt">
                            <ShieldCheck className="h-3 w-3 text-[#1a3d32]" aria-hidden />
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px]">
                        <FrameworkPill framework={meetingFramework(m)} />
                        <ParticipantsCount count={participants} />
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Maler tab ────────────────────────────────────────────────────────────

function MtgMalerTable({
  templates,
  meetings,
  orgHeadcount,
  onSchedule,
}: {
  templates: ResolvedMeetingTemplate[]
  meetings: MeetingRow[]
  orgHeadcount: number
  onSchedule: (t: ResolvedMeetingTemplate) => void
}) {
  if (templates.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-neutral-500">
        Ingen maler i denne kategorien ennå.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-neutral-50/60">
          <tr>
            <th className={TABLE_TH}>Mal</th>
            <th className={TABLE_TH}>Rammeverk</th>
            <th className={TABLE_TH}>Cadence</th>
            <th className={TABLE_TH}>Agendapunkter</th>
            <th className={TABLE_TH}>Datakilder</th>
            <th className={TABLE_TH}>Brukt</th>
            <th className={`${TABLE_TH} text-right`} />
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => {
            const id = t.systemTemplateId ?? t.orgTemplateId
            const usedCount = meetings.filter(
              (m) => m.system_template_id === id || m.org_template_id === id,
            ).length
            const datasourceCount = (t.definition.agendaItems ?? []).filter(
              (a) => 'dataBinding' in a && a.dataBinding,
            ).length
            const belowThreshold =
              t.minimumEmployeeCount != null && orgHeadcount < t.minimumEmployeeCount
            return (
              <tr key={t.key} className={TABLE_TR}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
                      <FileStack className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900">{t.name}</span>
                        {belowThreshold ? (
                          <Badge variant="warning">Krever {t.minimumEmployeeCount}+ ansatte</Badge>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {t.defaultDurationMinutes ? `${t.defaultDurationMinutes} min · ` : ''}
                        {t.isSystem ? 'systemmal' : 'organisasjonsmal'}
                        {t.defaultConfidentialityLevel !== 'standard'
                          ? ` · ${MEETING_CONFIDENTIALITY_LABEL[t.defaultConfidentialityLevel]}`
                          : ''}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <FrameworkPill framework={t.framework} />
                </td>
                <td className="px-5 py-3 text-neutral-700">{cadenceLabelFor(t.cadenceHint)}</td>
                <td className="px-5 py-3 tabular-nums text-neutral-800">
                  {t.definition.agendaItems?.length ?? 0}
                </td>
                <td className="px-5 py-3">
                  {datasourceCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[#fbf9f3] px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                      <Database className="h-2.5 w-2.5" aria-hidden /> {datasourceCount} kilder
                    </span>
                  ) : (
                    <span className="text-[11px] text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3 tabular-nums text-neutral-800">{usedCount} møter</td>
                <td className="px-5 py-3 text-right">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<CalendarPlus className="h-3 w-3" />}
                    onClick={() => onSchedule(t)}
                  >
                    Planlegg
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function cadenceLabelFor(cadenceHint: string | null): string {
  switch (cadenceHint) {
    case 'monthly':
      return 'Månedlig'
    case 'quarterly':
      return 'Kvartalsvis · 4/år'
    case 'semiannual':
      return 'Halvårlig · 2/år'
    case 'annual':
      return 'Årlig'
    case 'ad_hoc':
      return 'Ved behov'
    default:
      return '—'
  }
}

// ── Statistikk tab ───────────────────────────────────────────────────────

function MtgStatistikk({
  meetings,
  aggregates,
  minutesOnTime,
  now,
}: {
  meetings: MeetingRow[]
  aggregates: FrameworkAggregate[]
  minutesOnTime: number
  now: number
}) {
  const totalHeld = aggregates.reduce((a, b) => a + b.held, 0)
  const totalRequired = aggregates.reduce((a, b) => a + b.required, 0)
  const overall = totalRequired ? totalHeld / totalRequired : 0
  const quorumRate = computeQuorumRate(meetings)
  const overdueDecisions = computeOverdueDecisions(meetings)
  const perMonth = computeMonthlyHistogram(meetings, now)
  const maxMonth = Math.max(1, ...perMonth)
  // Rolling 12-month labels ending on the current month — rotates with
  // wall clock so the chart matches "last 12 months" regardless of when
  // the page is opened.
  const monthLabels = computeMonthLabels(now)

  return (
    <div className="p-5">
      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Etterlevelse"
          value={`${Math.round(overall * 100)}%`}
          sub={`${totalHeld} av ${totalRequired} forpliktende møter`}
          progress={overall}
        />
        <KpiTile
          label="Quorum-rate"
          value={`${Math.round(quorumRate * 100)}%`}
          sub="av møter beslutningsdyktige"
        />
        <KpiTile
          label="Referat på tid"
          value={`${Math.round(minutesOnTime * 100)}%`}
          sub="signert innen 14 dager"
        />
        <KpiTile
          label="Forsinkede vedtak"
          value={`${overdueDecisions}`}
          sub="krever oppfølging"
          warning={overdueDecisions > 0}
        />
      </div>

      {/* Per framework + histogram */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-md border border-neutral-200/80 p-4">
          <h4 className="text-sm font-semibold text-neutral-900">Møter siste 12 måneder</h4>
          <div className="mt-3 flex h-32 items-end gap-1.5">
            {perMonth.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[9px] tabular-nums text-neutral-500">{v}</span>
                <div
                  className="w-full rounded-t-sm bg-[#1a3d32]/80"
                  style={{ height: `${(v / maxMonth) * 100}%`, minHeight: 3 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-12 gap-1.5 text-[9px] uppercase tracking-wider text-neutral-400">
            {monthLabels.map((m) => (
              <span key={m} className="text-center">
                {m}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-neutral-200/80 p-4">
          <h4 className="text-sm font-semibold text-neutral-900">Per rammeverk</h4>
          {aggregates.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Ingen tall ennå.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {aggregates.map((b) => (
                <li key={b.id}>
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="font-medium text-neutral-900">{b.label}</span>
                    <span className="tabular-nums">
                      <span
                        className={[
                          'font-semibold',
                          b.complianceRate >= 1 ? 'text-[#1a3d32]' : 'text-amber-700',
                        ].join(' ')}
                      >
                        {b.held}
                      </span>
                      <span className="text-neutral-400">/{b.required}</span>
                    </span>
                  </div>
                  <div className="mt-1">
                    <ProgressBar
                      value={b.complianceRate}
                      tone={b.complianceRate >= 1 ? 'forest' : 'warn'}
                      height={4}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiTile({
  label,
  value,
  sub,
  progress,
  warning,
}: {
  label: string
  value: string
  sub: string
  progress?: number
  warning?: boolean
}) {
  return (
    <div
      className={[
        'rounded-md p-3',
        warning ? 'bg-amber-50 ring-1 ring-amber-100' : 'bg-[#fbf9f3]',
      ].join(' ')}
    >
      <div
        className={[
          'text-[10px] font-bold uppercase tracking-wider',
          warning ? 'text-amber-800' : 'text-neutral-500',
        ].join(' ')}
      >
        {label}
      </div>
      <div
        className={[
          'mt-1 text-2xl font-bold tabular-nums',
          warning ? 'text-amber-900' : 'text-[#1a3d32]',
        ].join(' ')}
      >
        {value}
      </div>
      {progress !== undefined ? (
        <div className="mt-1.5">
          <ProgressBar value={progress} />
        </div>
      ) : null}
      <div
        className={['mt-1 text-[10px]', warning ? 'text-amber-800' : 'text-neutral-500'].join(' ')}
      >
        {sub}
      </div>
    </div>
  )
}

function computeMonthlyHistogram(meetings: MeetingRow[], nowMs: number): number[] {
  const now = new Date(nowMs)
  const buckets = new Array(12).fill(0)
  for (const m of meetings) {
    if (!m.scheduled_at) continue
    const d = new Date(m.scheduled_at)
    const months =
      (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
    if (months < 0 || months >= 12) continue
    buckets[11 - months] += 1
  }
  return buckets
}

const MONTH_NAMES_NB = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des',
]

function computeMonthLabels(nowMs: number): string[] {
  // 12-month rolling labels — index 0 is "11 months ago", index 11 is "this month".
  const now = new Date(nowMs)
  const labels: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(MONTH_NAMES_NB[d.getMonth()])
  }
  return labels
}

function computeQuorumRate(meetings: MeetingRow[]): number {
  const completed = meetings.filter((m) => m.status === 'completed')
  if (completed.length === 0) return 0
  const ok = completed.filter((m) => m.quorum_met !== false).length
  return ok / completed.length
}

function computeOverdueDecisions(_meetings: MeetingRow[]): number {
  // Heuristic only — the actual decisions table is fetched per meeting
  // via the detail loader. The Statistikk tab uses a simple stand-in
  // (count of completed meetings without signed protocol).
  return _meetings.filter(
    (m) => m.status === 'completed' && !m.protocol_signed_at,
  ).length
}

// ── Slide-panel: create meeting ──────────────────────────────────────────

function CreateMeetingSlidePanel({
  open,
  onClose,
  meetings,
  presetTemplateId,
}: {
  open: boolean
  onClose: () => void
  meetings: ReturnType<typeof useMeetings>
  presetTemplateId: string | null
}) {
  const navigate = useNavigate()
  const [templateId, setTemplateId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [confidentiality, setConfidentiality] = useState<MeetingConfidentialityLevel>('standard')
  const [period, setPeriod] = useState<PeriodValue>({ start: null, end: null, label: null })
  const [busy, setBusy] = useState(false)
  const [locationLabel, setLocationLabel] = useState('')

  useEffect(() => {
    if (!open) return
    const preset = presetTemplateId ?? ''
    setTemplateId(preset)
    const tpl = meetings.templates.find(
      (t) => t.systemTemplateId === preset || t.orgTemplateId === preset,
    )
    setTitle(tpl?.name ?? '')
    setConfidentiality(tpl?.defaultConfidentialityLevel ?? 'standard')
    setScheduledAt('')
    setLocationLabel('')
    setPeriod(suggestPeriodForTemplate(tpl?.cadenceHint ?? null, null))
  }, [open, presetTemplateId, meetings.templates])

  useEffect(() => {
    if (!open || !scheduledAt) return
    const tpl = meetings.templates.find(
      (t) => t.systemTemplateId === templateId || t.orgTemplateId === templateId,
    )
    if (!tpl?.cadenceHint) return
    setPeriod((prev) => {
      if (prev.start || prev.end || prev.label) return prev
      return suggestPeriodForTemplate(tpl.cadenceHint ?? null, scheduledAt)
    })
  }, [scheduledAt, templateId, meetings.templates, open])

  const templateOptions = useMemo(
    () =>
      meetings.templates
        .filter((t) => t.isActive)
        .map((t) => ({
          value: t.systemTemplateId ?? t.orgTemplateId ?? '',
          label: t.name,
        })),
    [meetings.templates],
  )

  const selectedTemplate = useMemo(
    () =>
      meetings.templates.find(
        (t) => t.systemTemplateId === templateId || t.orgTemplateId === templateId,
      ) ?? null,
    [meetings.templates, templateId],
  )

  async function submit() {
    if (busy || !templateId || !title.trim()) return
    setBusy(true)
    try {
      const created = await meetings.createMeeting({
        title: title.trim(),
        templateId: selectedTemplate?.systemTemplateId ?? undefined,
        orgTemplateId: selectedTemplate?.orgTemplateId ?? undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        confidentialityLevel: confidentiality,
        locationLabel: locationLabel.trim() || null,
        reportingPeriodStart: period.start,
        reportingPeriodEnd: period.end,
        reportingPeriodLabel: period.label,
      })
      if (created) {
        onClose()
        navigate(`/meetings/${created.id}`)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await submit()
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="meetings-new-panel-title"
      title="Nytt møte"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={() => void submit()}
            disabled={busy || !templateId || !title.trim()}
          >
            Opprett
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          void handleSubmit(e)
        }}
        className="space-y-5"
      >
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-new-template">
            Mal
          </label>
          <SearchableSelect
            value={templateId}
            options={templateOptions}
            onChange={(val) => {
              setTemplateId(val)
              const tpl = meetings.templates.find(
                (t) => t.systemTemplateId === val || t.orgTemplateId === val,
              )
              if (tpl) {
                setTitle(tpl.name)
                setConfidentiality(tpl.defaultConfidentialityLevel ?? 'standard')
              }
            }}
            placeholder="Velg en mal …"
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Malens agenda blir kopiert til møtet og kan ikke endres etter signering.
          </p>
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-new-title">
            Tittel
          </label>
          <StandardInput
            id="meetings-new-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-new-when">
              Planlagt tidspunkt
            </label>
            <StandardInput
              id="meetings-new-when"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-new-location">
              Sted
            </label>
            <StandardInput
              id="meetings-new-location"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="Møterom, by …"
              className="mt-1.5"
            />
          </div>
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-new-confidentiality">
            Konfidensialitet
          </label>
          <SearchableSelect
            value={confidentiality}
            options={[
              { value: 'standard', label: MEETING_CONFIDENTIALITY_LABEL.standard },
              { value: 'restricted', label: MEETING_CONFIDENTIALITY_LABEL.restricted },
              { value: 'confidential', label: MEETING_CONFIDENTIALITY_LABEL.confidential },
            ]}
            onChange={(val) => setConfidentiality(val as MeetingConfidentialityLevel)}
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Drøftingsmøter og varslingssaker er begrenset som standard.
          </p>
        </div>
        <ReportingPeriodPicker
          value={period}
          onChange={setPeriod}
          anchor={scheduledAt || null}
          hint="Hvilken periode skal møtet gjennomgå? Forslag genereres fra malens kadens."
        />
      </form>
    </SlidePanel>
  )
}
