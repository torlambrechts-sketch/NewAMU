import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  GripVertical,
  Loader2,
  Kanban,
  LayoutGrid,
  List,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Share2,
  Star,
  Trash2,
  Users,
  Zap,
} from 'lucide-react'
import { HubMenu1Bar, type HubMenu1Item } from '../../components/layout/HubMenu1Bar'
import { LayoutScoreStatRow } from '../../components/layout/LayoutScoreStatRow'
import type { LayoutScoreStatItem } from '../../components/layout/platformLayoutKit'
import { WorkplaceNoticePanel } from '../../components/layout/WorkplaceNoticePanel'
import {
  WorkplaceEditableNoticeList,
  type AgendaItemTemplate,
  type AgendaListItem,
} from '../../components/layout/WorkplaceEditableNoticeList'
import { WorkplaceEventsDayCard } from '../../components/layout/WorkplaceEventsDayCard'
import { WorkplaceTodosCard } from '../../components/layout/WorkplaceTodosCard'
import {
  WorkplaceTasksActionButtonsRow,
  WorkplaceTasksPrimaryButton,
  WorkplaceTasksSplitButton,
} from '../../components/layout/WorkplaceTasksActionButtons'
import { LayoutTable1PostingsShell } from '../../components/layout/LayoutTable1PostingsShell'
import {
  layoutTable1PostingsPrimaryButtonClass,
  layoutTable1PostingsPrimaryButtonStyle,
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../components/layout/layoutTable1PostingsKit'
import {
  loadComposerPresets,
  loadComposerSession,
  normalizeComposerOrder,
  saveComposerPresets,
  saveComposerSession,
  type LayoutComposerPreset,
} from '../../lib/platformLayoutComposerStorage'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'
import { usePlatformStackComposerTemplates, type StackPresetUI } from '../../hooks/usePlatformComposerTemplates'
import {
  BackgroundChecksPageBlock,
  CandidateDetailBlock,
  CandidatesListBlock,
  CandidatesVideoScreenBlock,
  DashboardMainRightBlock,
  JobPostingsPageBlock,
  JobScorecardPageBlock,
  JobsListPinpointBlock,
  RefCandidateDetailHeaderBlock,
  RefCandidateDetailPaneBlock,
  RefInterviewsCalendarBlock,
  RefSurveyResponsesBlock,
  RefUnreadNotificationsBlock,
  SimpleDashboardBlock,
  SurveyInsights7070Block,
  TemplateLibraryBlock,
} from './platformReferenceLayoutBlocks'
import { ComposableRosRiskMatrixBlock, ComposableRosRiskTableBlock } from './rosRiskLayoutBlocks'

const CREAM = '#F9F7F2'
const CREAM_DEEP = '#EFE8DC'
const FOREST = '#1a3d32'
/** CTA / primary action buttons (layout-reference stillinger) */
const TABLE_CTA_GREEN = '#2D403A'
const SERIF = "'Libre Baskerville', Georgia, serif"
const SANS = "Inter, system-ui, sans-serif"

function shellStyle(): CSSProperties {
  return {
    fontFamily: SANS,
    backgroundColor: CREAM,
    color: '#171717',
  }
}

/** Preview surface for platform layout hub: cream matches workplace chrome; white is full-bleed marketing-style. */
export type PlatformLayoutPreviewSurface = 'cream' | 'white'

function previewShellStyle(surface: PlatformLayoutPreviewSurface): CSSProperties {
  if (surface === 'white') {
    return { fontFamily: SANS, backgroundColor: '#ffffff', color: '#171717' }
  }
  return shellStyle()
}

function SerifTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={`font-semibold tracking-tight text-neutral-900 ${className}`} style={{ fontFamily: SERIF }}>
      {children}
    </h1>
  )
}

function SerifHeading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`font-semibold text-neutral-900 ${className}`} style={{ fontFamily: SERIF }}>
      {children}
    </h2>
  )
}

function Breadcrumb({ items }: { items: string[] }) {
  return (
    <p className="text-xs text-neutral-500">
      {items.map((t, i) => (
        <span key={`${t}-${i}`}>
          {i > 0 ? <span className="mx-1.5 text-neutral-300">›</span> : null}
          {t}
        </span>
      ))}
    </p>
  )
}

function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'green' | 'teal'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-neutral-100 text-neutral-800',
    green: 'bg-emerald-100 text-emerald-900',
    teal: 'bg-teal-100 text-teal-900',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

function WhiteCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-neutral-200/80 bg-white shadow-sm ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {children}
    </div>
  )
}

function DemoScoreBar({ value, max = 5 }: { value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full rounded-full bg-neutral-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-sm tabular-nums text-neutral-800">{value.toFixed(2)}</span>
    </div>
  )
}

/** Informasjon — varsel-kortliste (samme skall som Ref. notifications). */
function ComposableWorkplaceNoticeInfoBlock() {
  return (
    <div className="space-y-2">
      <WorkplaceNoticePanel
        variant="info"
        title="Informasjon"
        badge={2}
        items={[
          {
            id: '1',
            title: 'Ny versjon av internkontroll er tilgjengelig. Se hva som er endret i hjelpesenteret.',
            subtitle: 'I dag',
            action: (
              <button type="button" className="text-neutral-400 hover:text-neutral-700" aria-label="Mer">
                <MoreHorizontal className="size-4" />
              </button>
            ),
          },
          {
            id: '2',
            title: 'Påminnelse: godkjenn årshjul-aktiviteter før frist 30. april.',
            subtitle: 'For 3 dager siden',
          },
        ]}
      />
      <p className="text-xs text-neutral-500">
        Bruk <code className="rounded bg-neutral-100 px-1 text-[11px]">WorkplaceNoticePanel</code> med{' '}
        <code className="rounded bg-neutral-100 px-1 text-[11px]">variant=&quot;info&quot;</code> i arbeidsflaten.
      </p>
    </div>
  )
}

/** Advarsel — samme mønster som informasjon, amber tone. */
function ComposableWorkplaceNoticeWarningBlock() {
  return (
    <div className="space-y-2">
      <WorkplaceNoticePanel
        variant="warning"
        title="Advarsler"
        badge={1}
        items={[
          {
            id: '1',
            title: 'ROS «Løfteanordning» har forfalt gjennomgang. Oppdater eller lukk tiltak.',
            subtitle: 'I går',
            action: (
              <button type="button" className="text-neutral-400 hover:text-neutral-700" aria-label="Mer">
                <MoreHorizontal className="size-4" />
              </button>
            ),
          },
        ]}
      />
      <p className="text-xs text-neutral-500">
        <code className="rounded bg-neutral-100 px-1 text-[11px]">variant=&quot;warning&quot;</code> for viktige meldinger og samsvar.
      </p>
    </div>
  )
}

/** Overskrift 1: brødsmule, H1, hub med aktiv fane for gjeldende seksjon (Stillingsannonser + Postings under). */
function ComposableHeading1Block() {
  const [jobTab, setJobTab] = useState('adverts')
  const hubItems: HubMenu1Item[] = useMemo(
    () =>
      [
        { key: 'candidates', label: 'Kandidater', icon: Users, active: jobTab === 'candidates', onClick: () => setJobTab('candidates') },
        { key: 'edit', label: 'Rediger', icon: Pencil, active: jobTab === 'edit', onClick: () => setJobTab('edit') },
        { key: 'boards', label: 'Tavler', icon: Kanban, active: jobTab === 'boards', onClick: () => setJobTab('boards') },
        { key: 'interviews', label: 'Intervjuer', icon: CalendarDays, active: jobTab === 'interviews', onClick: () => setJobTab('interviews') },
        { key: 'adverts', label: 'Stillingsannonser', icon: Mail, active: jobTab === 'adverts', onClick: () => setJobTab('adverts') },
        { key: 'insights', label: 'Innsikt', icon: BarChart3, active: jobTab === 'insights', onClick: () => setJobTab('insights') },
        { key: 'share', label: 'Del', icon: Share2, active: jobTab === 'share', onClick: () => setJobTab('share') },
        { key: 'team', label: 'Team', icon: Settings, active: jobTab === 'team', onClick: () => setJobTab('team') },
      ] satisfies HubMenu1Item[],
    [jobTab],
  )

  return (
    <div className="space-y-4">
      <Breadcrumb items={['Stillinger', 'Stillingsannonser']} />
      <SerifTitle className="text-2xl md:text-3xl">Stillingsannonser</SerifTitle>
      <p className="text-sm text-neutral-600">
        Kort ingress under tittelen — samme mønster som <code className="rounded bg-neutral-100 px-1 text-xs">WorkplacePageHeading1</code> i appen.
      </p>
      <HubMenu1Bar ariaLabel="Stillingsfaner (komponer)" items={hubItems} />
    </div>
  )
}

/** Table 1: Postings — delt skall med {@link LayoutTable1PostingsShell} (wrap på krem/hvit demo). */
function ComposablePostingsTableBlock() {
  return (
    <LayoutTable1PostingsShell
      title="Postings"
      description="Create and manage multiple postings for this job"
      headerActions={
        <button type="button" className={layoutTable1PostingsPrimaryButtonClass()} style={layoutTable1PostingsPrimaryButtonStyle()}>
          + Create posting
        </button>
      }
      toolbar={
        <>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              placeholder="Search…"
              className="w-full rounded-lg border border-neutral-200 py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900"
          >
            <Filter className="size-3.5" />
            Filters
          </button>
        </>
      }
      footer={
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-neutral-500">Items per page</span>
              <select className="rounded-md border border-neutral-200 bg-white px-2 py-1">
                <option>10</option>
                <option>25</option>
              </select>
            </label>
            <span className="text-neutral-500">Showing 1 – 1 of 1</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="rounded p-1 text-neutral-400 hover:bg-neutral-100" aria-label="Forrige">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" className="rounded p-1 text-neutral-400 hover:bg-neutral-100" aria-label="Neste">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </>
      }
    >
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
            <th className={LAYOUT_TABLE1_POSTINGS_TH}>Name</th>
            <th className={LAYOUT_TABLE1_POSTINGS_TH}>Job title</th>
            <th className={LAYOUT_TABLE1_POSTINGS_TH}>Location</th>
            <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
            <th className={`w-12 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
          </tr>
        </thead>
        <tbody>
          <tr className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
            <td className="px-5 py-3 font-medium text-neutral-900">Default</td>
            <td className="px-5 py-3 text-neutral-700">HR-rådgiver</td>
            <td className="px-5 py-3 text-neutral-700">London</td>
            <td className="px-5 py-3">
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-900">
                Active
              </span>
            </td>
            <td className="px-5 py-3 text-right">
              <button type="button" className="text-neutral-400 hover:text-neutral-700" aria-label="Meny">
                <MoreHorizontal className="size-5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </LayoutTable1PostingsShell>
  )
}

function ScorecardCandidateCard({ name, score }: { name: string; score: number }) {
  const skills: [string, number | null][] = [
    ['Previous experience', 4.0],
    ['Previous organisational size', null],
    ['Prior seniority', 3.75],
    ['Relevancy of prior experience', 4.25],
    ['Intellectually curious', 3.5],
    ['Self motivated', 4.0],
    ['Communication skills', 4.33],
  ]
  return (
    <WhiteCard className="overflow-hidden p-0">
      <div className="flex items-start gap-3 border-b border-neutral-100 px-4 py-3">
        <input type="checkbox" className="mt-1 rounded border-neutral-300" aria-label={`Velg ${name}`} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-neutral-900">{name}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">Overall score</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: FOREST }}>
            {score}%
          </p>
        </div>
      </div>
      <div className="px-4 py-2">
        <span className="inline-flex rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900">
          Multi-part interview
        </span>
      </div>
      <div className="border-t border-neutral-100" style={{ backgroundColor: 'rgba(245, 230, 211, 0.45)' }}>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-700">Job skills</span>
          <span className="flex items-center gap-2 text-xs text-neutral-600">
            Feedback
            <span className="flex size-6 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
              3.7
            </span>
          </span>
        </div>
        <div className="space-y-2.5 px-4 pb-4 pt-1">
          {skills.map(([label, v]) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <span className="w-44 shrink-0 text-xs text-neutral-600">{label}</span>
              {v != null ? (
                <DemoScoreBar value={v} />
              ) : (
                <div className="h-2 min-w-0 flex-1 rounded-full bg-neutral-200/80" />
              )}
            </div>
          ))}
        </div>
      </div>
    </WhiteCard>
  )
}

/** Scorecard module: title, filters, three candidate cards. */
function ComposableScorecardModuleBlock() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SerifHeading className="text-xl">Scorecard ratings</SerifHeading>
          <p className="mt-1 text-sm text-neutral-600">Compare candidates who&apos;ve had scorecards rated by your team.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase shadow-sm"
        >
          <Download className="size-3.5" />
          Export
        </button>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          placeholder="Search…"
          className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
        />
      </div>
      <div
        className="grid gap-4 rounded-lg border border-neutral-200/80 p-4 sm:grid-cols-2 lg:grid-cols-4"
        style={{ backgroundColor: CREAM_DEEP }}
      >
        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          Candidate current stage
          <select className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm">
            <option>All stages</option>
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          Scorecards
          <div className="mt-1.5 flex items-center gap-1">
            <select className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm">
              <option>1 item</option>
            </select>
            <button type="button" className="rounded-md border border-neutral-200 bg-white p-2 text-neutral-500 hover:bg-neutral-50" aria-label="Fjern">
              ×
            </button>
          </div>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          Order by
          <select className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm">
            <option>Select option…</option>
          </select>
        </label>
        <div className="flex items-end gap-3 pb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">Show detail</span>
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" className="peer sr-only" defaultChecked />
            <span className="h-6 w-11 rounded-full bg-neutral-300 peer-checked:bg-[#1a3d32] after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <ScorecardCandidateCard name="Alonzo Muller" score={73} />
        <ScorecardCandidateCard name="Priya Nair" score={81} />
        <ScorecardCandidateCard name="Tom Hacquoil" score={69} />
      </div>
    </div>
  )
}

type DemoPostingRow = {
  id: string
  name: string
  jobTitle: string
  location: string
  status: 'active' | 'draft'
  starred: boolean
}

const DEMO_POSTING_ROWS: DemoPostingRow[] = [
  { id: '1', name: 'Standard', jobTitle: 'HR-rådgiver', location: 'Bergen', status: 'active', starred: true },
  { id: '2', name: 'Default', jobTitle: 'HR-rådgiver', location: 'London', status: 'active', starred: false },
  { id: '3', name: 'Campus', jobTitle: 'Software Engineer (Internal)', location: 'Oslo', status: 'active', starred: true },
  { id: '4', name: 'Retail', jobTitle: 'Customer Service Representative', location: 'London', status: 'draft', starred: false },
  { id: '5', name: 'Support', jobTitle: 'Teknisk konsulent', location: 'Trondheim', status: 'active', starred: false },
  { id: '6', name: 'Lager', jobTitle: 'Logistikkmedarbeider', location: 'Stavanger', status: 'draft', starred: false },
]

/** Table heading bar (Active Jobs-style) + demo table; controls filter the rows below. */
function ComposableTableHeadingToolbarBlock() {
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [starredOnly, setStarredOnly] = useState(false)
  const [viewDensity, setViewDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all')

  const locations = useMemo(() => {
    const u = new Set(DEMO_POSTING_ROWS.map((r) => r.location))
    return [...u].sort((a, b) => a.localeCompare(b, 'nb'))
  }, [])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return DEMO_POSTING_ROWS.filter((r) => {
      if (starredOnly && !r.starred) return false
      if (locationFilter !== 'all' && r.location !== locationFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.jobTitle.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q)
      )
    })
  }, [search, starredOnly, locationFilter, statusFilter])

  const cellPad = viewDensity === 'comfortable' ? 'px-5 py-3' : 'px-3 py-2'
  const textSize = viewDensity === 'comfortable' ? 'text-sm' : 'text-xs'

  return (
    <div className="space-y-0">
      <WhiteCard className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3 md:gap-4 md:px-5">
          <p className="shrink-0 text-sm text-neutral-900">
            <span className="text-2xl font-bold tabular-nums text-neutral-900">{filteredRows.length}</span>{' '}
            <span className="font-medium text-neutral-600">aktive annonser</span>
          </p>
          <div className="relative min-w-[200px] flex-1">
            <label htmlFor="composer-table-heading-search" className="sr-only">
              Søk
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              id="composer-table-heading-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#1a3d32]/25"
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                filtersOpen ? 'border-neutral-400 bg-neutral-50 text-neutral-900' : 'border-neutral-200 bg-white text-neutral-700'
              }`}
              aria-expanded={filtersOpen}
            >
              <Filter className="size-3.5 text-neutral-500" />
              Filters
            </button>
            <button
              type="button"
              onClick={() => setStarredOnly((s) => !s)}
              className={`rounded-lg border p-2 transition-colors ${
                starredOnly ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-neutral-200 bg-white text-amber-600 hover:bg-amber-50/80'
              }`}
              aria-pressed={starredOnly}
              aria-label={starredOnly ? 'Vis alle rader' : 'Kun favoritter'}
              title="Kun favoritter"
            >
              <Star className={`size-5 ${starredOnly ? 'fill-current' : ''}`} />
            </button>
            <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5" role="group" aria-label="Visningstetthet">
              <button
                type="button"
                onClick={() => setViewDensity('comfortable')}
                className={`rounded-md p-2 ${viewDensity === 'comfortable' ? 'bg-[#EFE8DC] text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                aria-pressed={viewDensity === 'comfortable'}
                aria-label="Rutenett (romslig)"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewDensity('compact')}
                className={`rounded-md p-2 ${viewDensity === 'compact' ? 'bg-[#EFE8DC] text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                aria-pressed={viewDensity === 'compact'}
                aria-label="Liste (kompakt)"
              >
                <List className="size-4" />
              </button>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm"
              style={{ backgroundColor: TABLE_CTA_GREEN }}
            >
              <Plus className="size-4 shrink-0" strokeWidth={2.5} />
              Opprett ny stilling
            </button>
          </div>
        </div>
        {filtersOpen ? (
          <div
            className="flex flex-wrap items-end gap-4 border-b border-neutral-100 px-4 py-3 md:px-5"
            style={{ backgroundColor: CREAM_DEEP }}
          >
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Sted
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="mt-1.5 block w-full min-w-[140px] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Alle steder</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'draft')}
                className="mt-1.5 block w-full min-w-[140px] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Alle</option>
                <option value="active">Aktiv</option>
                <option value="draft">Utkast</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setLocationFilter('all')
                setStatusFilter('all')
              }}
              className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Nullstill filter
            </button>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className={`w-full min-w-[520px] text-left ${textSize}`}>
            <thead>
              <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                <th className={`${cellPad}`}>Navn</th>
                <th className={`${cellPad}`}>Stilling</th>
                <th className={`${cellPad}`}>Sted</th>
                <th className={`${cellPad}`}>Status</th>
                <th className={`w-12 ${cellPad}`} />
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-500">
                    Ingen treff — juster søk eller filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50/80">
                    <td className={`${cellPad} font-medium text-neutral-900`}>
                      <span className="inline-flex items-center gap-2">
                        {r.starred ? (
                          <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-hidden />
                        ) : null}
                        {r.name}
                      </span>
                    </td>
                    <td className={`${cellPad} text-neutral-700`}>{r.jobTitle}</td>
                    <td className={`${cellPad} text-neutral-700`}>{r.location}</td>
                    <td className={cellPad}>
                      {r.status === 'active' ? (
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-900">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-700">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className={`${cellPad} text-right`}>
                      <button type="button" className="text-neutral-400 hover:text-neutral-700" aria-label="Meny">
                        <MoreHorizontal className="size-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </WhiteCard>
      <p className="mt-2 text-xs text-neutral-500">
        Verktøylinjen styrer tabellen under: søk (navn/stilling/sted), <strong>Filters</strong> (sted + status), stjerne (kun
        favoritter), og bryter (romslig vs kompakt rader). CTA tilpasses kontekst — her: stillinger.
      </p>
    </div>
  )
}

type JobCardPreview = {
  title: string
  meta: string
  code: string
  candidates: number
  ratio: string | null
  alertCount?: number
}

const DEFAULT_JOB_CARDS: JobCardPreview[] = [
  {
    title: 'Customer Service Representative',
    meta: 'New York · Product · Hooli',
    code: '8301',
    candidates: 10,
    ratio: null,
    alertCount: 2,
  },
  {
    title: 'HR-rådgiver',
    meta: 'Bergen · HR · Eksempel AS',
    code: '8299',
    candidates: 4,
    ratio: '0/5',
    alertCount: 2,
  },
  {
    title: 'Software Engineer (Internal)',
    meta: 'Oslo · Engineering · Hooli',
    code: '0006',
    candidates: 17,
    ratio: null,
    alertCount: 2,
  },
]

function JobPostingPreviewCard({
  job,
  viewCandidatesLabel = 'View candidates',
}: {
  job: JobCardPreview
  viewCandidatesLabel?: string
}) {
  const alerts = job.alertCount ?? 2
  return (
    <WhiteCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-4 py-4">
        <div className="min-w-0">
          <p className="text-base font-semibold text-neutral-900">{job.title}</p>
          <p className="mt-1 text-sm text-neutral-500">{job.meta}</p>
          <span className="mt-2 inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
            {job.code}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Star className="size-4 text-neutral-300" />
          <Pill tone="green">Open</Pill>
          <button type="button" className="text-neutral-400 hover:text-neutral-700" aria-label="Mer">
            <MoreHorizontal className="size-5" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xl font-bold tabular-nums text-neutral-900">{job.candidates}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Candidates</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 font-medium text-red-800">{alerts}</span>
          <Users className="size-4" />
          <MessageSquare className="size-4" />
          <Mail className="size-4" />
          <span className="text-emerald-600">✓</span>
          {job.ratio ? (
            <span className="ml-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
              {job.ratio}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-700"
        >
          {viewCandidatesLabel} <ChevronDown className="size-3.5" />
        </button>
      </div>
    </WhiteCard>
  )
}

type List2Row = {
  id: string
  name: string
  numericId: string
  jobTitle: string
  orderStatus: 'action' | 'ok'
  checkLabel: string
  orderDate: string
  decision: string | null
}

const DEMO_LIST2_ROWS: List2Row[] = [
  {
    id: '1',
    name: 'Alex Morgan',
    numericId: '61',
    jobTitle: 'HR-rådgiver',
    orderStatus: 'action',
    checkLabel: '4 Awaiting applicant submission',
    orderDate: '16 Feb, 2026',
    decision: null,
  },
  {
    id: '2',
    name: 'Jamie Chen',
    numericId: '58',
    jobTitle: 'Software Engineer',
    orderStatus: 'action',
    checkLabel: '2 Awaiting applicant submission',
    orderDate: '12 Feb, 2026',
    decision: null,
  },
  {
    id: '3',
    name: 'Samira Okonkwo',
    numericId: '44',
    jobTitle: 'HR-rådgiver',
    orderStatus: 'action',
    checkLabel: '1 Awaiting applicant submission',
    orderDate: '9 Feb, 2026',
    decision: null,
  },
]

const DEMO_AGENDA_TEMPLATES: AgendaItemTemplate[] = [
  { id: 'opening', label: 'Åpning', title: 'Velkommen og innkalling', subtitle: '5 min' },
  { id: 'minutes', label: 'Referat forrige møte', title: 'Godkjenning av referat', subtitle: '10 min' },
  { id: 'safety', label: 'HMS / arbeidsmiljø', title: 'Hendelser og tiltak', subtitle: '15 min' },
  { id: 'round', label: 'Eventuelt', title: 'Eventuelt', subtitle: 'Etter behov' },
]

function formatComposerDayLabel(base: Date, dayOffset: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + dayOffset)
  const s = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Primær + splittet nedtrekk — samme grønn CTA som Tasks; wrapper uten bakgrunn. */
function ComposableWorkplaceTasksActionButtonsBlock() {
  return (
    <div className="space-y-3">
      <WorkplaceTasksActionButtonsRow>
        <WorkplaceTasksPrimaryButton label="Ny oppgave" onClick={() => undefined} />
        <WorkplaceTasksSplitButton
          label="Opprett"
          onMainClick={() => undefined}
          options={[
            { id: 'a', label: 'Fra mal', onSelect: () => undefined },
            { id: 'b', label: 'Tom oppgave', onSelect: () => undefined },
            { id: 'c', label: 'Importer…', onSelect: () => undefined },
          ]}
        />
      </WorkplaceTasksActionButtonsRow>
      <p className="text-xs text-neutral-500">
        Bruk <code className="rounded bg-neutral-100 px-1 text-[11px]">WorkplaceTasksPrimaryButton</code>,{' '}
        <code className="rounded bg-neutral-100 px-1 text-[11px]">WorkplaceTasksSplitButton</code> og{' '}
        <code className="rounded bg-neutral-100 px-1 text-[11px]">WorkplaceTasksActionButtonsRow</code> på sider — samme stil som
        verktøylinjen på Oppgaver (grønn #2D403A, uppercase, avrundet).
      </p>
    </div>
  )
}

/** Demo for stack-mal Layout_vernerunder — arbeidsflate bytter inn ekte HSE-data. */
function ComposableVernerunderScheduleCalendarBlock() {
  const [dayOffset, setDayOffset] = useState(0)
  const base = useMemo(() => new Date(2026, 3, 29), [])
  const dateLabel = formatComposerDayLabel(base, dayOffset)

  const demoItems = useMemo(
    () => [
      {
        id: 'vr1',
        category: 'Planlagt',
        title: 'Vernerunde — Lager (demo)',
        startLabel: '09:00',
      },
      {
        id: 'vr2',
        category: 'Planlagt',
        title: 'Vernerunde — Kontor (demo)',
        startLabel: '13:30',
      },
    ],
    [],
  )

  return (
    <div className="space-y-2">
      <WorkplaceEventsDayCard
        cardTitle="Vernerunder — valgt dag"
        dateLabel={dateLabel}
        onPrevDay={() => setDayOffset((x) => x - 1)}
        onNextDay={() => setDayOffset((x) => x + 1)}
        tabs={[{ id: 'rounds', label: 'Kommende på dagen', count: demoItems.length, items: demoItems }]}
        defaultTabId="rounds"
        footer={{
          label: 'Planlegg vernerunde (én eller serie)',
          onMoreClick: () => undefined,
        }}
      />
      <p className="text-xs text-neutral-500">
        Publiser <strong>Layout_vernerunder</strong> med <strong>heading1</strong>, <strong>scoreStatRow</strong> osv. for
        rekkefølge og synlighet. Tabell og kalender er 2/3 + 1/3 på arbeidsflaten når begge er med.
      </p>
    </div>
  )
}

/** Dagens hendelser: oppgaver, samsvar/frister, faner — som dashboard-kalender i referanse. */
function ComposableWorkplaceEventsDayBlock() {
  const [dayOffset, setDayOffset] = useState(0)
  const base = useMemo(() => new Date(2026, 3, 29), [])
  const dateLabel = formatComposerDayLabel(base, dayOffset)

  const eventsItems = useMemo(
    () => [
      {
        id: 'e1',
        category: 'Oppgave',
        title: 'Signer årshjul — 2. kvartal',
        startLabel: '09:00',
        endLabel: '09:30',
      },
      {
        id: 'e2',
        category: 'Samsvar',
        title: 'Revisjon internkontroll — frist innlevering',
        startLabel: '14:00',
      },
      {
        id: 'e3',
        category: 'Møte',
        title: 'AMU — halvårlig gjennomgang',
        startLabel: '15:00',
        endLabel: '16:30',
      },
    ],
    [],
  )

  const complianceItems = useMemo(
    () => [
      {
        id: 'c1',
        category: 'Samsvar',
        title: 'Varslingsrutine — årlig gjennomgang',
        startLabel: 'Forfaller',
        endLabel: '30. apr.',
      },
      {
        id: 'c2',
        category: 'Oppgave',
        title: 'Oppdater risikovurdering lager',
        startLabel: 'Frist',
        endLabel: '2 d',
      },
    ],
    [],
  )

  return (
    <div className="space-y-2">
      <WorkplaceEventsDayCard
        dateLabel={dateLabel}
        onPrevDay={() => setDayOffset((x) => x - 1)}
        onNextDay={() => setDayOffset((x) => x + 1)}
        tabs={[
          { id: 'events', label: 'Hendelser', count: eventsItems.length, items: eventsItems },
          { id: 'compliance', label: 'Frister / samsvar', count: complianceItems.length, items: complianceItems },
        ]}
        defaultTabId="events"
        footer={{
          label: '3 oppgaver med frist denne uken',
          avatars: [
            { id: 'a1', initials: 'AK' },
            { id: 'a2', initials: 'ML' },
            { id: 'a3', initials: 'SO' },
          ],
          to: '/tasks',
        }}
      />
      <p className="text-xs text-neutral-500">
        Koble til ekte data: filtrer <code className="rounded bg-neutral-100 px-1 text-[11px]">Task</code> og
        samsvar/datoer på valgt dag; bruk <code className="rounded bg-neutral-100 px-1 text-[11px]">datePickerSlot</code> for
        kalender.
      </p>
    </div>
  )
}

/** Oppgaveliste med bokser og frist til høyre — lenk til /tasks. */
function ComposableWorkplaceTodosBlock() {
  return (
    <div className="space-y-2">
      <WorkplaceTodosCard
        title="Oppgaver og frister"
        items={[
          {
            id: 't1',
            title: 'Fullfør vernerunde Q2',
            description: 'Gå gjennom sjekkliste og lukk åpne avvik i HMS.',
            dueLabel: 'I dag',
            href: '/tasks',
          },
          {
            id: 't2',
            title: 'Revisjon dokumentert samsvar — varsling',
            description: 'Årlig kontroll av rutine og kontaktpunkter.',
            dueLabel: '3 d',
            href: '/compliance',
          },
          {
            id: 't3',
            title: 'Oppdater stillingsinstruks verneombud',
            description: 'Koordiner med HR etter valg.',
            dueLabel: '12. mai',
            href: '/tasks',
          },
        ]}
      />
      <p className="text-xs text-neutral-500">
        Erstatt <code className="rounded bg-neutral-100 px-1 text-[11px]">items</code> med åpne oppgaver; bruk{' '}
        <code className="rounded bg-neutral-100 px-1 text-[11px]">addTaskSlot</code> med{' '}
        <code className="rounded bg-neutral-100 px-1 text-[11px]">AddTaskLink</code> for kontekst.
      </p>
    </div>
  )
}

/** Redigerbar liste (varsel-stil): dra for rekkefølge, mal for nye punkter — egnet som agenda-bygger. */
function ComposableAgendaBuilderListBlock() {
  const [agendaItems, setAgendaItems] = useState<AgendaListItem[]>(() => [
    { id: 'demo-1', title: 'Gjennomgang av årsplan', subtitle: '20 min' },
    { id: 'demo-2', title: 'Oppsummering og neste steg', subtitle: '10 min' },
  ])

  return (
    <div className="space-y-2">
      <WorkplaceEditableNoticeList
        title="Agenda (redigerbar)"
        badge={agendaItems.length}
        items={agendaItems}
        onChange={setAgendaItems}
        templates={DEMO_AGENDA_TEMPLATES}
      />
      <p className="text-xs text-neutral-500">
        Varsel-kort med dra-og-slipp, rediger/slett, og «Legg til fra mal» for forhåndsdefinerte punkter (bruk{' '}
        <code className="rounded bg-neutral-100 px-1 text-[11px]">templates</code> i koden).
      </p>
    </div>
  )
}

/** KPI-rad: tre beige bokser (stort tall, tittel, undertekst) mellom Overskrift 1 og List 2. */
function ComposableScoreStatRowBlock() {
  return (
    <div className="space-y-2">
      <LayoutScoreStatRow
        items={[
          { big: '12', title: 'Åpne punkter', sub: 'Siste 7 dager' },
          { big: '48', title: 'Fullført', sub: 'Denne måneden' },
          { big: '3', title: 'Varsler', sub: 'Krever oppmerksomhet' },
        ]}
      />
      <p className="text-xs text-neutral-500">
        Stat-rad: tre KPI-bokser på krem (#f2eee6), avrundet — plasseres typisk under Overskrift 1 og over List 2.
      </p>
    </div>
  )
}

const KPI_INFO_BOX_DEMO_ITEMS: LayoutScoreStatItem[] = [
  { big: '12', title: 'Åpne punkter', sub: 'Siste 7 dager' },
  { big: '48', title: 'Fullført', sub: 'Denne måneden' },
  { big: '3', title: 'Varsler', sub: 'Krever oppmerksomhet' },
  { big: '5', title: 'Frister', sub: 'Denne uken' },
  { big: '98', title: 'Oppfylt %', sub: 'Siste kvartal' },
  { big: '2', title: 'Avvik', sub: 'Under oppfølging' },
]

/** Informasjonsbokser — samme visuelle stil som KPI-stat-raden; antall bokser velges i demoen (1–6). */
function ComposableKpiInfoBoxesBlock() {
  const [boxCount, setBoxCount] = useState(3)
  const n = Math.min(6, Math.max(1, boxCount))
  const items = KPI_INFO_BOX_DEMO_ITEMS.slice(0, n)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white/90 px-3 py-2.5">
        <label htmlFor="composer-kpi-info-box-count" className="text-xs font-semibold text-neutral-800">
          Antall bokser
        </label>
        <select
          id="composer-kpi-info-box-count"
          value={n}
          onChange={(e) => setBoxCount(Number(e.target.value))}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900"
        >
          {[1, 2, 3, 4, 5, 6].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">Samme rutenett som Stat-rad (krem KPI-bokser).</span>
      </div>
      <LayoutScoreStatRow items={items} />
      <p className="text-xs text-neutral-500">
        Brukes når du trenger fleksibel bredde: én til seks informative KPI-lignende felt. I produksjon fylles innholdet av
        moduldata; her er det demo-tekst per boks.
      </p>
    </div>
  )
}

/** List 2: candidate / order table with search, filters strip, status pills, pagination (reference screenshot). */
function ComposableList2Block() {
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'action' | 'ok'>('all')
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)

  const activeFilters = statusFilter !== 'all'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return DEMO_LIST2_ROWS.filter((r) => {
      if (statusFilter !== 'all' && r.orderStatus !== statusFilter) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.numericId.includes(q) ||
        r.jobTitle.toLowerCase().includes(q)
      )
    })
  }, [search, statusFilter])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const pageSafe = Math.min(page, totalPages)
  const start = (pageSafe - 1) * perPage
  const pageRows = filtered.slice(start, start + perPage)

  return (
    <div className="space-y-2">
      <WhiteCard className="overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <SerifHeading className="text-xl">Orders</SerifHeading>
            <p className="mt-1 text-sm text-neutral-600">Search, filter and manage background check orders for candidates.</p>
          </div>
          <button
            type="button"
            className="rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: FOREST }}
          >
            + New order
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3 md:px-5">
          <div className="relative min-w-[200px] flex-1">
            <label htmlFor="composer-list2-search" className="sr-only">
              Søk kandidat
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              id="composer-list2-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by candidate name, ID, or job title…"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#1a3d32]/25"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                filtersOpen || activeFilters
                  ? 'border-neutral-400 bg-neutral-50 text-neutral-900'
                  : 'border-neutral-200 bg-white text-neutral-700'
              }`}
              aria-expanded={filtersOpen}
            >
              <Filter className="size-3.5 text-neutral-500" />
              Filters
            </button>
            <span className="text-xs text-neutral-500">{activeFilters ? 'Filter aktive' : 'No filters applied'}</span>
          </div>
        </div>
        {filtersOpen ? (
          <div className="border-b border-neutral-100 px-4 py-3 md:px-5" style={{ backgroundColor: CREAM_DEEP }}>
            <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              Ordrestatus
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'all' | 'action' | 'ok')
                  setPage(1)
                }}
                className="mt-1.5 block max-w-xs rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Alle</option>
                <option value="action">Action required</option>
                <option value="ok">OK</option>
              </select>
            </label>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/90 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Order status</th>
                <th className="px-5 py-3">Check statuses</th>
                <th className="px-5 py-3">Order date</th>
                <th className="px-5 py-3">Decision</th>
                <th className="w-12 px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-neutral-500">
                    Ingen treff.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50/80">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-neutral-900">{r.name}</p>
                      <p className="text-sm text-neutral-600">{r.numericId}</p>
                      <p className="text-xs text-neutral-500">{r.jobTitle}</p>
                    </td>
                    <td className="px-5 py-4">
                      {r.orderStatus === 'action' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-950">
                          <AlertTriangle className="size-3.5 shrink-0 text-amber-700" aria-hidden />
                          Action required
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-950">
                        <Zap className="size-3.5 shrink-0 text-sky-700" aria-hidden />
                        {r.checkLabel}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-neutral-700">{r.orderDate}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                        {r.decision ?? 'None'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button type="button" className="text-neutral-400 hover:text-neutral-700" aria-label="Flere handlinger">
                        <MoreHorizontal className="size-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3 text-xs text-neutral-600">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-neutral-500">Items per page</span>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value))
                  setPage(1)
                }}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
            </label>
            <span className="text-neutral-500">
              Showing {total === 0 ? 0 : start + 1} – {Math.min(start + perPage, total)} of {total}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-40"
              aria-label="Forrige side"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-40"
              aria-label="Neste side"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </WhiteCard>
      <p className="text-xs text-neutral-500">
        List 2: samme topp som Table 1 (overskrift + grønn CTA), deretter søk, filter, status-piller og paginering.
      </p>
    </div>
  )
}

/** Boks: stillingskort i rutenett på kremflate (egen blokk uten verktøylinje). */
function ComposableJobBoxGridBlock() {
  return (
    <div className="space-y-3">
      <div>
        <SerifHeading className="text-lg">Boks — stillingskort</SerifHeading>
        <p className="mt-1 text-sm text-neutral-600">Hvite kort på kremflate; brukes som rutenett under lister eller oversikter.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DEFAULT_JOB_CARDS.map((j) => (
          <JobPostingPreviewCard key={j.code} job={j} viewCandidatesLabel="Se kandidater" />
        ))}
      </div>
    </div>
  )
}

/** Job listing cards: toolbar + grid (reference: Active Jobs). */
function ComposableJobCardsModuleBlock() {
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const jobs = DEFAULT_JOB_CARDS

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200/80 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm font-semibold text-neutral-900">
          <span className="text-2xl font-bold tabular-nums">6</span>{' '}
          <span className="font-medium text-neutral-600">Active Jobs</span>
        </p>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            placeholder="Search…"
            className="w-full rounded-lg border border-neutral-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase text-neutral-700"
          >
            <Filter className="size-3.5" />
            Filters
          </button>
          <button type="button" className="rounded-lg p-2 text-amber-600 hover:bg-amber-50" aria-label="Favoritter">
            <Star className="size-5" />
          </button>
          <div className="flex rounded-lg border border-neutral-200 p-0.5">
            <button
              type="button"
              onClick={() => setLayout('grid')}
              className={`rounded-md p-2 ${layout === 'grid' ? 'bg-[#EFE8DC]' : 'text-neutral-500'}`}
              aria-label="Rutenett"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayout('list')}
              className={`rounded-md p-2 ${layout === 'list' ? 'bg-[#EFE8DC]' : 'text-neutral-500'}`}
              aria-label="Liste"
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <div className={layout === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-4'}>
        {jobs.map((j) => (
          <JobPostingPreviewCard key={j.code} job={j} />
        ))}
      </div>
    </div>
  )
}

/** Rapportering — én rad: legende venstre + donut høyre (referanse: New hire source). */
function ComposableReportingDonutOneRowBlock() {
  const rows = [
    { label: 'External recruiter', count: 4, pct: 23.53, color: '#22c55e' },
    { label: 'Referral', count: 3, pct: 17.65, color: '#3b82f6' },
    { label: 'Job board', count: 6, pct: 35.29, color: '#f97316' },
    { label: 'Other', count: 4, pct: 23.53, color: '#a855f7' },
  ]
  const total = rows.reduce((s, r) => s + r.count, 0)
  let acc = 0
  const cone = rows
    .map((r) => {
      const start = (acc / total) * 360
      acc += r.count
      const end = (acc / total) * 360
      return `${r.color} ${start}deg ${end}deg`
    })
    .join(', ')

  return (
    <div className="space-y-2">
      <WhiteCard className="overflow-hidden p-0">
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-800">New hire source</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Count of hired candidates · Last 12 months · Channel
            </p>
          </div>
          <button type="button" className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100" aria-label="Flere valg">
            <MoreHorizontal className="size-5" />
          </button>
        </div>
        <div className="grid gap-6 p-4 sm:grid-cols-2 sm:p-5" style={{ backgroundColor: CREAM_DEEP }}>
          <ul className="min-w-0 divide-y divide-neutral-200/80">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="truncate text-sm text-neutral-800">{r.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3 tabular-nums text-sm">
                  <span className="font-semibold text-neutral-900">{r.count}</span>
                  <span className="w-14 text-right text-neutral-600">{r.pct.toFixed(2)}%</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-center py-2">
            <div className="relative flex size-44 shrink-0 items-center justify-center">
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: `conic-gradient(${cone})` }}
              />
              <div
                className="relative z-10 flex size-[58%] flex-col items-center justify-center rounded-full bg-[#f7f5f0]"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Total</span>
                <span className="text-3xl font-bold tabular-nums text-neutral-900">{total}</span>
              </div>
            </div>
          </div>
        </div>
      </WhiteCard>
      <p className="text-xs text-neutral-500">
        Rapportering (én rad): kort-header + kremflate med to kolonner — liste med prikker og donut med total i midten.
      </p>
    </div>
  )
}

/** Rapportering — to rader / to paneler: søylediagram + linjegraf (referanse: Applications by stage / by date). */
function ComposableReportingChartsTwoRowBlock() {
  const stages = [
    { label: 'Rejected', value: 388, max: 400, color: '#ef4444' },
    { label: 'Video introduction', value: 6, max: 400, color: '#3b82f6' },
    { label: 'Applied', value: 0, max: 400, color: '#94a3b8' },
    { label: 'Offer', value: 0, max: 400, color: '#94a3b8' },
    { label: 'Hired', value: 0, max: 400, color: '#94a3b8' },
  ]
  /** Verdi 0–100 (høyere = linjen høyere i diagrammet). */
  const lineVals = [12, 22, 35, 48, 58, 72, 88]
  const w = 360
  const h = 88
  const pad = 4
  const innerH = h - pad * 2
  const step = w / (lineVals.length - 1)
  const pathD = lineVals
    .map((val, i) => {
      const x = i * step
      const y = pad + innerH - (val / 100) * innerH
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="space-y-2">
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <WhiteCard className="flex h-full flex-col overflow-hidden p-0">
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-800">Applications by stage</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Summary of applications broken down by workflow stage.
              </p>
            </div>
            <button type="button" className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100" aria-label="Flere valg">
              <MoreHorizontal className="size-5" />
            </button>
          </div>
          <div className="flex flex-1 flex-col p-4 sm:p-5" style={{ backgroundColor: CREAM_DEEP }}>
            <ul className="divide-y divide-neutral-200/80">
              {stages.map((s) => (
                <li key={s.label} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                  <span className="w-36 shrink-0 text-sm text-neutral-800 sm:w-40">{s.label}</span>
                  <span className="w-9 shrink-0 text-sm font-bold tabular-nums text-neutral-900">{s.value}</span>
                  <div className="min-h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/80">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (s.value / s.max) * 100)}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </WhiteCard>

        <WhiteCard className="flex h-full flex-col overflow-hidden p-0">
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-800">Applications by date</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Cumulative applications by the date they were created.
              </p>
            </div>
            <button type="button" className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100" aria-label="Flere valg">
              <MoreHorizontal className="size-5" />
            </button>
          </div>
          <div className="flex flex-1 flex-col p-4 sm:p-5" style={{ backgroundColor: CREAM_DEEP }}>
            <div className="flex min-h-[140px] flex-1 flex-col justify-end">
              <svg viewBox={`0 0 ${w} ${h}`} className="w-full shrink-0" style={{ height: h }} preserveAspectRatio="xMidYMid meet" aria-hidden>
                {[0, 25, 50, 75, 100].map((pct) => {
                  const gy = pad + innerH - (pct / 100) * innerH
                  return (
                    <line key={pct} x1="0" y1={gy} x2={w} y2={gy} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
                  )
                })}
                <path
                  d={pathD}
                  fill="none"
                  stroke={FOREST}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="mt-2 flex justify-between text-[10px] text-neutral-500">
                <span>Jun 23</span>
                <span>08 Jun</span>
                <span>16 Jun</span>
                <span>24 Jun</span>
                <span>Jul &apos;23</span>
              </div>
            </div>
          </div>
        </WhiteCard>
      </div>

      <p className="text-xs text-neutral-500">
        Rapportering (to paneler): venstre horisontale søyler, høyre kumulativ linjegraf — stablet på sm, side ved side på lg.
      </p>
    </div>
  )
}

const BLOCKS = [
  {
    id: 'heading1',
    label: 'Overskrift 1 — tittel + faner',
    hint: 'Stillinger › Stillingsannonser, serif H1, hub med Stillingsannonser aktiv (samme stil som Action board). På Oppgaver → Varslingssaker: bruk stack-mal Layout_varslingssaker sammen med scoreStatRow og list2.',
  },
  {
    id: 'table1',
    label: 'Table 1 — Postings',
    hint: 'Postings-tittel, søk, tabell (Name / Job title / Location / Status), paginering.',
  },
  {
    id: 'scorecard',
    label: 'Modul — Scorecard ratings',
    hint: 'Overskrift, Export, søk, filterrad, tre kandidatkort med job skills.',
  },
  {
    id: 'jobCards',
    label: 'Modul — Jobbkort (Active jobs)',
    hint: '«6 Active Jobs», søk, Filters, grid/list, tre stillingskort.',
  },
  {
    id: 'tableHeading',
    label: 'Tabell — overskriftsfelt (toolbar)',
    hint: 'Telling, søk, Filters (panel), favoritt, grid/list-tetthet, CTA + demo-tabell som filtreres.',
  },
  {
    id: 'scoreStatRow',
    label: 'Stat-rad — tre KPI-bokser',
    hint: 'Stort tall, tittel, grå undertekst (krem bakgrunn) — som scorecard-rad mellom overskrift og liste.',
  },
  {
    id: 'kpiInfoBoxes',
    label: 'Boks — informasjon (KPI-rad, velg antall)',
    hint: 'Samme stil som tre KPI-bokser; i komponisten velger du 1–6 bokser for forhåndsvisning.',
  },
  {
    id: 'noticeInfo',
    label: 'Boks — informasjon (liste)',
    hint: 'Varsel-stil: hvit kort, overskrift, badge, rader med info-ikon — som uleste varsler.',
  },
  {
    id: 'noticeWarning',
    label: 'Boks — advarsel (liste)',
    hint: 'Samme som informasjonsboksen med varsel-ikon og amber tone.',
  },
  {
    id: 'agendaBuilderList',
    label: 'Liste — agenda (rediger, sorter, mal)',
    hint: 'Varsel-stil: dra rekkefølge, rediger/slett, legg til tomt punkt eller fra mal (`templates`).',
  },
  {
    id: 'workplaceEventsDay',
    label: 'Boks — dagens hendelser (oppgaver / frister)',
    hint: 'Dato + faner, tidskolonne og farget stripe; for oppgaver, møter og samsvar på valgt dag.',
  },
  {
    id: 'vernerunderScheduleCalendar',
    label: 'Vernerunder — planlegging og kalender (dag)',
    hint: 'Demo: kalenderkort. Stack-mal Layout_vernerunder: heading1, scoreStatRow, workplaceTasksActions, table1, vernerunderScheduleCalendar — rekkefølge og synlighet fra DB.',
  },
  {
    id: 'workplaceTodos',
    label: 'Boks — oppgaver (to-do med frist)',
    hint: 'Innbokser med tittel, beskrivelse og frist; Ny oppgave → /tasks.',
  },
  {
    id: 'workplaceTasksActions',
    label: 'Knapper — Oppgaver (transparent rad)',
    hint: 'Én primærknapp + splittet knapp med nedtrekk; samme CTA som Tasks; ingen kortbakgrunn — legg på krem/hvit flate.',
  },
  {
    id: 'list2',
    label: 'List 2 — kandidat/ordre-tabell',
    hint: 'Søk, Filters + status, grå header-rad, piller (action / checks), paginering.',
  },
  {
    id: 'rosRiskMatrix',
    label: 'ROS — risikomatrise 5×5 (enkelt + gruppert)',
    hint: 'Varmekart med IMPACT × LIKELIHOOD, hover på risiko/kategori; verktøylinje og visningsvalg (demo).',
  },
  {
    id: 'rosRiskTable',
    label: 'ROS — risiko-oversikt (tabell)',
    hint: 'Alle risikoer på tvers av analyser: kategori, ROS, score, nivå-pille; sortering og kolonner (demo).',
  },
  {
    id: 'jobBoxGrid',
    label: 'Boks — stillingskort (rutenett)',
    hint: 'Tre hvite kort på kremflate (tittel, meta, ID, OPEN, kandidater-rad).',
  },
  {
    id: 'reportingDonutOneRow',
    label: 'Rapportering — én rad (liste + donut)',
    hint: 'Kort-header, krem kropp: legende med prikker og prosent + donut med total i midten.',
  },
  {
    id: 'reportingChartsTwoRow',
    label: 'Rapportering — to paneler (søyler + linje)',
    hint: 'To kort: horisontale søyler etter fase og linjegraf over tid (side ved side på stor skjerm).',
  },
  {
    id: 'refTemplateLibrary',
    label: 'Ref. — Malbibliotek (filter + kort)',
    hint: 'Layout-referanse: søk, tag-filtre og 4-kolonne mal-kort.',
  },
  {
    id: 'refJobsList',
    label: 'Ref. — Stillinger (Active jobs, full side)',
    hint: 'Layout-referanse: mørk fanebar, verktøylinje, grid/list og jobbkort.',
  },
  {
    id: 'refScorecardPage',
    label: 'Ref. — Scorecard (full side)',
    hint: 'Layout-referanse: breadcrumb, faner, filterrad og tre kandidatkort med skills.',
  },
  {
    id: 'refSurveyInsights7030',
    label: 'Ref. — Survey insights 70/30',
    hint: 'Layout-referanse: KPI, NPS, trend og svarliste i høyre kolonne.',
  },
  {
    id: 'refJobPostingsFull',
    label: 'Ref. — Stillingsannonser (full side)',
    hint: 'Layout-referanse: H1, hub, Postings-kort med tabell og paginering (samme som referanse-fanen).',
  },
  {
    id: 'refCandidateDetail',
    label: 'Ref. — Kandidatdetalj',
    hint: 'Layout-referanse: beige sidenav + detaljliste.',
  },
  {
    id: 'refCandidatesList',
    label: 'Ref. — Kandidatliste',
    hint: 'Layout-referanse: segmentknapper, søk og tabell med tags/stjerner.',
  },
  {
    id: 'refVideoScreen',
    label: 'Ref. — Video screen (Interviews)',
    hint: 'Layout-referanse: pipeline, segmentfilter og intervju-tabell.',
  },
  {
    id: 'refBackgroundChecks',
    label: 'Ref. — Background checks',
    hint: 'Layout-referanse: statusfaner, søk og ordre-tabell.',
  },
  {
    id: 'refDashboard7030',
    label: 'Ref. — Dashboard 70/30',
    hint: 'Layout-referanse: velkomst, KPI, jobber, donut + intervjuer/varsler.',
  },
  {
    id: 'refDashboardCompact',
    label: 'Ref. — Dashboard (kompakt)',
    hint: 'Layout-referanse: enkel dash med KPI, jobbkort og pipeline-søyler.',
  },
  {
    id: 'refSurveyResponses',
    label: 'Ref. — Survey responses (liste)',
    hint: 'Layout-referanse: svarliste med paginering (brukes i Survey insights 70/30).',
  },
  {
    id: 'refUnreadNotifications',
    label: 'Ref. — Unread notifications',
    hint: 'Layout-referanse: varselkort fra dashboard 70/30.',
  },
  {
    id: 'refInterviewsCalendar',
    label: 'Ref. — Interviews (kalender)',
    hint: 'Layout-referanse: intervjukort med mini-kalender (dashboard 70/30).',
  },
  {
    id: 'refCandidateDetailHeader',
    label: 'Ref. — Kandidatdetalj (topp)',
    hint: 'Brødsmule, stillingstittel og kandidat-headerkort.',
  },
  {
    id: 'refCandidateDetailPane',
    label: 'Ref. — Kandidatdetalj (faner + innhold)',
    hint: 'Beige sidemeny og innholdsområde med faner (Application, Résumé, …).',
  },
] as const

export type LayoutComposerBlockId = (typeof BLOCKS)[number]['id']

type BlockId = LayoutComposerBlockId

const CANONICAL_BLOCK_ORDER: BlockId[] = BLOCKS.map((b) => b.id)

const MIME_COMPOSER_BLOCK = 'application/x-klarert-layout-composer-block'

/** For grid composer palette / cell drops */
export const MIME_GRID_PALETTE_BLOCK = 'application/x-klarert-grid-palette-block'
export const MIME_GRID_CELL = 'application/x-klarert-grid-cell'

export const LAYOUT_COMPOSER_BLOCK_ORDER: readonly LayoutComposerBlockId[] = CANONICAL_BLOCK_ORDER

function defaultVisibleAll(): Record<BlockId, boolean> {
  return Object.fromEntries(BLOCKS.map((b) => [b.id, true])) as Record<BlockId, boolean>
}

/** Flytt element fra `from` til rett før indeks `to` i den opprinnelige rekkefølgen. */
function reorderBlockOrder(order: BlockId[], from: number, to: number): BlockId[] {
  if (from === to || from < 0 || to < 0 || from >= order.length || to > order.length) return order
  const next = [...order]
  const [removed] = next.splice(from, 1)
  const insertAt = to > from ? to - 1 : to
  next.splice(insertAt, 0, removed)
  return next
}

function renderComposerBlock(id: BlockId): ReactNode {
  switch (id) {
    case 'heading1':
      return <ComposableHeading1Block />
    case 'table1':
      return <ComposablePostingsTableBlock />
    case 'scorecard':
      return <ComposableScorecardModuleBlock />
    case 'jobCards':
      return <ComposableJobCardsModuleBlock />
    case 'tableHeading':
      return <ComposableTableHeadingToolbarBlock />
    case 'scoreStatRow':
      return <ComposableScoreStatRowBlock />
    case 'kpiInfoBoxes':
      return <ComposableKpiInfoBoxesBlock />
    case 'noticeInfo':
      return <ComposableWorkplaceNoticeInfoBlock />
    case 'noticeWarning':
      return <ComposableWorkplaceNoticeWarningBlock />
    case 'agendaBuilderList':
      return <ComposableAgendaBuilderListBlock />
    case 'workplaceEventsDay':
      return <ComposableWorkplaceEventsDayBlock />
    case 'vernerunderScheduleCalendar':
      return <ComposableVernerunderScheduleCalendarBlock />
    case 'workplaceTodos':
      return <ComposableWorkplaceTodosBlock />
    case 'workplaceTasksActions':
      return <ComposableWorkplaceTasksActionButtonsBlock />
    case 'list2':
      return <ComposableList2Block />
    case 'rosRiskMatrix':
      return <ComposableRosRiskMatrixBlock />
    case 'rosRiskTable':
      return <ComposableRosRiskTableBlock />
    case 'jobBoxGrid':
      return <ComposableJobBoxGridBlock />
    case 'reportingDonutOneRow':
      return <ComposableReportingDonutOneRowBlock />
    case 'reportingChartsTwoRow':
      return <ComposableReportingChartsTwoRowBlock />
    case 'refTemplateLibrary':
      return <TemplateLibraryBlock />
    case 'refJobsList':
      return <JobsListPinpointBlock />
    case 'refScorecardPage':
      return <JobScorecardPageBlock />
    case 'refSurveyInsights7030':
      return <SurveyInsights7070Block />
    case 'refJobPostingsFull':
      return <JobPostingsPageBlock />
    case 'refCandidateDetail':
      return <CandidateDetailBlock />
    case 'refCandidatesList':
      return <CandidatesListBlock />
    case 'refVideoScreen':
      return <CandidatesVideoScreenBlock />
    case 'refBackgroundChecks':
      return <BackgroundChecksPageBlock />
    case 'refDashboard7030':
      return <DashboardMainRightBlock />
    case 'refDashboardCompact':
      return <SimpleDashboardBlock />
    case 'refSurveyResponses':
      return <RefSurveyResponsesBlock />
    case 'refUnreadNotifications':
      return <RefUnreadNotificationsBlock />
    case 'refInterviewsCalendar':
      return <RefInterviewsCalendarBlock />
    case 'refCandidateDetailHeader':
      return <RefCandidateDetailHeaderBlock />
    case 'refCandidateDetailPane':
      return <RefCandidateDetailPaneBlock />
    default:
      return null
  }
}

function blockAriaLabel(id: BlockId): string {
  return BLOCKS.find((b) => b.id === id)?.label ?? id
}

/* Shared with PlatformGridComposer — not a React component */
// eslint-disable-next-line react-refresh/only-export-components -- grid composer imports block renderer
export function renderLayoutComposerBlock(id: LayoutComposerBlockId): ReactNode {
  return renderComposerBlock(id as BlockId)
}

// eslint-disable-next-line react-refresh/only-export-components -- grid composer imports block renderer
export function layoutComposerBlockLabel(id: LayoutComposerBlockId): string {
  return BLOCKS.find((b) => b.id === id)?.label ?? id
}

/** Block checklist + live preview (used on layout hub). */
export function PlatformLayoutComposerDemo({
  previewSurface = 'cream',
  embedInDarkChrome = true,
}: {
  previewSurface?: PlatformLayoutPreviewSurface
  /** When false, checklist sits on a light panel (e.g. unified layout hub). */
  embedInDarkChrome?: boolean
}) {
  const baseId = useId()
  const { userId, isAdmin, loading: adminLoading } = usePlatformAdmin()
  const templatesEnabled = !embedInDarkChrome
  const {
    loading: tplLoading,
    error: tplError,
    mergedPresets,
    bumpLocal: bumpStackTemplatesLocal,
    saveStackToDatabase,
    removeStackTemplate,
    setStackPublished,
  } = usePlatformStackComposerTemplates(templatesEnabled, userId, isAdmin)
  const dark = embedInDarkChrome
  const asidePanelClass = dark
    ? 'space-y-4 rounded-xl border border-white/10 bg-slate-900/50 p-4'
    : 'space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm'
  const checklistMetaClass = dark ? 'text-neutral-400' : 'text-neutral-500'
  const checklistCountClass = dark ? 'text-neutral-500' : 'text-neutral-600'
  const bulkBtnClass = dark
    ? 'rounded-md border border-white/15 px-2 py-1 text-xs text-neutral-300 hover:bg-white/5'
    : 'rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50'
  const rowLabelClass = dark
    ? 'flex min-w-0 flex-1 cursor-pointer gap-2 rounded-lg border border-transparent py-1 pl-1 pr-2 hover:border-white/10 hover:bg-white/5'
    : 'flex min-w-0 flex-1 cursor-pointer gap-2 rounded-lg border border-transparent py-1 pl-1 pr-2 hover:border-neutral-200 hover:bg-neutral-50'
  const rowTitleClass = dark ? 'text-sm font-medium text-neutral-200' : 'text-sm font-medium text-neutral-900'
  const rowHintClass = dark ? 'mt-0.5 block text-xs text-neutral-500' : 'mt-0.5 block text-xs text-neutral-600'
  const checkboxClass = dark ? 'mt-1 shrink-0 rounded border-neutral-500 bg-slate-800' : 'mt-1 shrink-0 rounded border-neutral-300 bg-white'
  const previewCaptionClass = dark ? 'text-sm text-neutral-500' : 'text-sm text-neutral-600'
  const [dragBlockId, setDragBlockId] = useState<BlockId | null>(null)
  const [dragOverListIndex, setDragOverListIndex] = useState<number | null>(null)
  const [dragOverPreviewOrderIndex, setDragOverPreviewOrderIndex] = useState<number | null>(null)
  const [presetName, setPresetName] = useState('')
  const [editingDbId, setEditingDbId] = useState<string | null>(null)
  const [publishToWorkplace, setPublishToWorkplace] = useState(false)
  const [tplBusy, setTplBusy] = useState(false)
  const [tplMessage, setTplMessage] = useState<string | null>(null)

  const [visible, setVisible] = useState<Record<BlockId, boolean>>(() => {
    const s = loadComposerSession()
    if (s?.visible) {
      const v = { ...defaultVisibleAll(), ...s.visible } as Record<BlockId, boolean>
      return v
    }
    return defaultVisibleAll()
  })

  const [order, setOrder] = useState<BlockId[]>(() => {
    const s = loadComposerSession()
    if (s?.order?.length) {
      return normalizeComposerOrder(s.order, CANONICAL_BLOCK_ORDER) as BlockId[]
    }
    return [...CANONICAL_BLOCK_ORDER]
  })

  useEffect(() => {
    saveComposerSession({
      visible: visible as Record<string, boolean>,
      order: [...order],
    })
  }, [visible, order])

  const orderedBlocks = useMemo(() => order.map((id) => BLOCKS.find((b) => b.id === id)!).filter(Boolean), [order])

  const toggle = (id: BlockId) => setVisible((v) => ({ ...v, [id]: !v[id] }))
  const selectAll = () => setVisible(defaultVisibleAll())
  const selectNone = () =>
    setVisible(Object.fromEntries(BLOCKS.map((b) => [b.id, false])) as Record<BlockId, boolean>)

  const activeCount = BLOCKS.filter((b) => visible[b.id]).length

  const presetList = useMemo(() => mergedPresets(), [mergedPresets])

  const savePresetLocal = useCallback(() => {
    const name = presetName.trim()
    if (!name) return
    const next: LayoutComposerPreset = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      visible: { ...visible } as Record<string, boolean>,
      order: [...order],
    }
    const prev = loadComposerPresets()
    const merged = [...prev.filter((x) => x.name.trim().toLowerCase() !== name.toLowerCase()), next]
    saveComposerPresets(merged)
    setPresetName('')
    setEditingDbId(null)
    setTplMessage('Lagret lokalt.')
    bumpStackTemplatesLocal()
  }, [presetName, visible, order, bumpStackTemplatesLocal])

  const savePresetDatabase = useCallback(async () => {
    const name = presetName.trim()
    if (!name || !templatesEnabled) return
    setTplBusy(true)
    setTplMessage(null)
    const { error, id } = await saveStackToDatabase({
      dbId: editingDbId,
      name,
      visible: visible as Record<string, boolean>,
      order: [...order],
      published: publishToWorkplace,
    })
    setTplBusy(false)
    if (error) {
      setTplMessage(error)
      return
    }
    if (id) setEditingDbId(id)
    setTplMessage('Lagret i database.')
  }, [
    presetName,
    templatesEnabled,
    editingDbId,
    visible,
    order,
    publishToWorkplace,
    saveStackToDatabase,
  ])

  const loadPreset = useCallback((p: StackPresetUI) => {
    const nextVisible = { ...defaultVisibleAll(), ...p.visible } as Record<BlockId, boolean>
    setVisible(nextVisible)
    setOrder(normalizeComposerOrder(p.order, CANONICAL_BLOCK_ORDER) as BlockId[])
    setPresetName(p.name)
    setEditingDbId(p.dbId ?? null)
    setPublishToWorkplace(!!p.published)
    setTplMessage(null)
  }, [])

  const deletePreset = useCallback(
    async (p: StackPresetUI) => {
      setTplBusy(true)
      setTplMessage(null)
      const err = await removeStackTemplate(p)
      setTplBusy(false)
      if (err) setTplMessage(err)
      else setTplMessage('Slettet.')
      if (editingDbId === p.dbId || presetName === p.name) {
        setEditingDbId(null)
        setPresetName('')
      }
    },
    [removeStackTemplate, editingDbId, presetName],
  )

  const togglePresetPublished = useCallback(
    async (p: StackPresetUI) => {
      if (!p.dbId) return
      setTplBusy(true)
      const err = await setStackPublished(p.dbId, !p.published)
      setTplBusy(false)
      if (err) setTplMessage(err)
      else {
        setTplMessage(!p.published ? 'Publisert.' : 'Avpublisert.')
        if (editingDbId === p.dbId) setPublishToWorkplace(!p.published)
      }
    },
    [setStackPublished, editingDbId],
  )

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] lg:items-start">
        <aside className={asidePanelClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-xs font-semibold uppercase tracking-wide ${checklistMetaClass}`}>Elementer</p>
            <span className={`text-xs ${checklistCountClass}`}>
              {activeCount}/{BLOCKS.length} synlige
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={selectAll} className={bulkBtnClass}>
              Velg alle
            </button>
            <button type="button" onClick={selectNone} className={bulkBtnClass}>
              Fjern alle
            </button>
          </div>
          <p className={`text-xs ${checklistMetaClass}`}>
            Dra håndtaket for å endre rekkefølge i forhåndsvisningen. Økt lagres i nettleseren; maler kan også lagres i
            database (plattformadmin).
          </p>
          <ul className="space-y-1">
            {orderedBlocks.map((b, idx) => {
              const sid = `${baseId}-${b.id}`
              return (
                <li
                  key={b.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(MIME_COMPOSER_BLOCK, b.id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDragBlockId(b.id)
                  }}
                  onDragEnd={() => {
                    setDragBlockId(null)
                    setDragOverListIndex(null)
                    setDragOverPreviewOrderIndex(null)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOverListIndex(idx)
                  }}
                  onDragLeave={() => setDragOverListIndex((cur) => (cur === idx ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault()
                    const raw = e.dataTransfer.getData(MIME_COMPOSER_BLOCK)
                    if (!raw) return
                    const droppedId = raw as BlockId
                    if (!CANONICAL_BLOCK_ORDER.includes(droppedId)) return
                    const from = order.indexOf(droppedId)
                    if (from < 0) return
                    const targetOrderIndex = order.indexOf(b.id)
                    if (targetOrderIndex < 0) return
                    setOrder(reorderBlockOrder(order, from, targetOrderIndex))
                    setDragBlockId(null)
                    setDragOverListIndex(null)
                  }}
                  className={`flex items-start gap-1 rounded-lg border border-transparent py-0.5 pl-0.5 ${
                    dragOverListIndex === idx ? 'border-amber-400/60 bg-amber-500/10' : ''
                  } ${dragBlockId === b.id ? 'opacity-60' : ''}`}
                >
                  <button
                    type="button"
                    className={`mt-0.5 shrink-0 cursor-grab rounded p-1 active:cursor-grabbing ${
                      dark ? 'text-neutral-500 hover:bg-white/10' : 'text-neutral-400 hover:bg-neutral-100'
                    }`}
                    aria-label={`Dra for å flytte: ${b.label}`}
                    title="Dra for å flytte"
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </button>
                  <label className={rowLabelClass}>
                    <input
                      id={sid}
                      type="checkbox"
                      checked={visible[b.id]}
                      onChange={() => toggle(b.id)}
                      className={checkboxClass}
                    />
                    <span className="min-w-0">
                      <span className={rowTitleClass}>{b.label}</span>
                      <span className={rowHintClass}>{b.hint}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>

          <div className={`mt-4 border-t pt-4 ${dark ? 'border-white/10' : 'border-neutral-200'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${checklistMetaClass}`}>Lagrede oppsett</p>
            <p className={`mt-1 text-xs ${checklistMetaClass}`}>
              <strong>Lokal:</strong> kun denne nettleseren. <strong>Database:</strong> delt mellom plattformadmins;
              kryss av <em>Publiser</em> for at arbeidsflaten (f.eks. Internkontroll → Oversikt) skal kunne lese malen.
            </p>
            {!embedInDarkChrome && (adminLoading || tplLoading) ? (
              <p className={`mt-2 flex items-center gap-2 text-xs ${checklistMetaClass}`}>
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Laster maler…
              </p>
            ) : null}
            {!embedInDarkChrome && tplError ? (
              <p className="mt-2 text-xs text-red-400">{tplError}</p>
            ) : null}
            {tplMessage ? (
              <p className={`mt-2 text-xs ${dark ? 'text-amber-200/90' : 'text-amber-800'}`}>{tplMessage}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => {
                  setPresetName(e.target.value)
                  setTplMessage(null)
                }}
                placeholder="Navn på oppsett"
                className={
                  dark
                    ? 'min-w-0 flex-1 rounded-md border border-white/15 bg-slate-900/80 px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-500'
                    : 'min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400'
                }
              />
              <button type="button" onClick={savePresetLocal} disabled={tplBusy} className={bulkBtnClass}>
                Lagre lokalt
              </button>
              {!embedInDarkChrome && isAdmin ? (
                <button type="button" onClick={() => void savePresetDatabase()} disabled={tplBusy} className={bulkBtnClass}>
                  Lagre i DB
                </button>
              ) : null}
            </div>
            {!embedInDarkChrome && isAdmin ? (
              <label className={`mt-2 flex cursor-pointer items-center gap-2 text-xs ${checklistMetaClass}`}>
                <input
                  type="checkbox"
                  checked={publishToWorkplace}
                  onChange={(e) => setPublishToWorkplace(e.target.checked)}
                  className={checkboxClass}
                />
                Publiser (arbeidsflate kan lese ved match på navn)
              </label>
            ) : null}
            {editingDbId ? (
              <p className={`mt-1 text-[11px] ${checklistMetaClass}`}>Redigerer database-rad: {editingDbId.slice(0, 8)}…</p>
            ) : null}
            {presetList.length > 0 ? (
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
                {presetList.map((p) => (
                  <li
                    key={`${p.source}-${p.id}`}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-1 py-1 ${
                      dark ? 'hover:bg-white/5' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => loadPreset(p)}
                      className={`min-w-0 flex-1 truncate text-left ${dark ? 'text-neutral-200' : 'text-neutral-800'}`}
                    >
                      {p.name}
                      <span className={`ml-1 text-[10px] ${checklistMetaClass}`}>
                        {p.source === 'database' ? 'DB' : 'Lokal'}
                        {p.published ? ' · pub.' : ''}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      {p.dbId ? (
                        <button
                          type="button"
                          title={p.published ? 'Avpubliser' : 'Publiser'}
                          onClick={() => void togglePresetPublished(p)}
                          disabled={tplBusy}
                          className={bulkBtnClass}
                        >
                          {p.published ? 'Avpub.' : 'Pub.'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void deletePreset(p)}
                        disabled={tplBusy}
                        className="shrink-0 rounded p-1 text-red-400 hover:bg-red-500/10"
                        aria-label={`Slett ${p.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`mt-2 text-xs ${checklistMetaClass}`}>Ingen lagrede oppsett ennå.</p>
            )}
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <p className={previewCaptionClass}>
            Forhåndsvisning ({previewSurface === 'white' ? 'helhvit' : 'krem arbeidsflate'}, uten app-topbar). Dra seksjoner
            for å endre rekkefølge — samme mønster som liste-sider med flere blokker.
          </p>
          <div
            className={`rounded-xl border p-4 shadow-lg md:p-6 ${
              previewSurface === 'white' ? 'border-neutral-200' : 'border-white/10'
            }`}
            style={previewShellStyle(previewSurface)}
          >
            <div className="space-y-8">
              {order.map((id, orderIndex) => {
                if (!visible[id]) return null
                const content = renderComposerBlock(id)
                if (!content) return null
                return (
                  <section
                    key={id}
                    aria-label={blockAriaLabel(id)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      setDragOverPreviewOrderIndex(orderIndex)
                    }}
                    onDragLeave={() =>
                      setDragOverPreviewOrderIndex((cur) => (cur === orderIndex ? null : cur))
                    }
                    onDrop={(e) => {
                      e.preventDefault()
                      const raw = e.dataTransfer.getData(MIME_COMPOSER_BLOCK)
                      if (!raw) return
                      const droppedId = raw as BlockId
                      const from = order.indexOf(droppedId)
                      if (from < 0) return
                      const to = order.indexOf(id)
                      if (to < 0) return
                      setOrder(reorderBlockOrder(order, from, to))
                      setDragBlockId(null)
                      setDragOverPreviewOrderIndex(null)
                    }}
                    className={`rounded-lg border border-dashed border-transparent p-1 transition-colors ${
                      dragOverPreviewOrderIndex === orderIndex ? 'border-amber-500/50 bg-amber-500/5' : ''
                    }`}
                  >
                    {content}
                  </section>
                )
              })}

              {activeCount === 0 ? (
                <p className="py-12 text-center text-sm text-neutral-500">Velg minst ett element for å vise forhåndsvisning.</p>
              ) : null}
            </div>
          </div>
        </div>
    </div>
  )
}
