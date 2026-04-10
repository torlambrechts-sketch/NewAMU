import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  BarChart3,
  Bell,
  Briefcase,
  CheckCircle2,
  CheckSquare,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  Filter,
  Kanban,
  LayoutGrid,
  LayoutTemplate,
  List,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Search,
  Settings,
  Share2,
  Star,
  User,
  Users,
  Video,
  XCircle,
} from 'lucide-react'
import { HubMenu1Bar, type HubMenu1Item } from '../../components/layout/HubMenu1Bar'
import { VisualTemplateEditor } from '../../components/platform/VisualTemplateEditor'

const CREAM = '#F9F7F2'
const CREAM_DEEP = '#EFE8DC'
const BEIGE_NAV = '#EDE4D3'
const FOREST = '#1a3d32'
const SERIF = "'Libre Baskerville', Georgia, serif"
const SANS = "Inter, system-ui, sans-serif"

function shellStyle(): CSSProperties {
  return {
    fontFamily: SANS,
    backgroundColor: CREAM,
    color: '#171717',
  }
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
        <span key={t}>
          {i > 0 ? <span className="mx-1.5 text-neutral-300">›</span> : null}
          {t}
        </span>
      ))}
    </p>
  )
}

function Pill({
  children,
  className = '',
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: 'neutral' | 'green' | 'orange' | 'blue' | 'tan'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-neutral-100 text-neutral-800',
    green: 'bg-emerald-100 text-emerald-900',
    orange: 'bg-orange-100 text-orange-900',
    blue: 'bg-sky-100 text-sky-900',
    tan: 'bg-amber-100/90 text-amber-950',
  }
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

function TagPill({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-full border border-transparent bg-white px-3 py-1 text-left text-xs font-medium text-neutral-700 shadow-sm ring-1 ring-neutral-200/80 transition hover:bg-neutral-50"
    >
      {children}
    </button>
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

function TanStatCard({
  big,
  title,
  sub,
  action,
}: {
  big: string
  title: string
  sub: string
  action?: string
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200/60 px-5 py-4"
      style={{ backgroundColor: CREAM_DEEP }}
    >
      <div>
        <p className="text-3xl font-bold tabular-nums text-neutral-900">{big}</p>
        <p className="mt-1 text-sm font-medium text-neutral-800">{title}</p>
        <p className="text-xs text-neutral-600">{sub}</p>
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900"
      >
        {action ?? 'View'} <ChevronRight className="size-3.5" />
      </button>
    </div>
  )
}

function MainRightGrid({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:items-start">
      <div className="min-w-0 space-y-6">{main}</div>
      <div className="min-w-0 space-y-6">{side}</div>
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

function TemplateLibraryBlock() {
  const tagGroups = [
    {
      title: 'Metrics',
      tags: ['Time to fill', 'Candidate experience', 'Quality of hire', 'Diversity'],
    },
    {
      title: 'Role types',
      tags: ['Engineering', 'Sales', 'Customer success', 'Operations'],
    },
    {
      title: 'Workflow',
      tags: ['Automation', 'Scheduling', 'Approvals', 'Notifications'],
    },
  ]

  const templates = [
    {
      t: 'Apply tags based on application responses',
      d: 'Automatically tag candidates when they answer specific screening questions — keeps pipelines tidy without manual work.',
      meta: 'Time to fill · Candidate management',
    },
    {
      t: 'Send interview reminders 24h before',
      d: 'Reduces no-shows with branded emails and calendar holds synced to your ATS.',
      meta: 'Scheduling · Automation',
    },
    {
      t: 'Route internal referrals to hiring manager',
      d: 'Fast-tracks employee referrals with audit-friendly routing and SLA timers.',
      meta: 'Referrals · Compliance',
    },
    {
      t: 'Scorecard sync to Slack',
      d: 'Posts anonymized score summaries to a private channel after each panel.',
      meta: 'Integrations · Collaboration',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(200px,260px)_minmax(0,1fr)] lg:items-start">
      <WhiteCard className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            placeholder="Search…"
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/30"
          />
        </div>
        <p className="mt-6 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Filter by tags</p>
        <div className="mt-3 space-y-5">
          {tagGroups.map((g) => (
            <div key={g.title}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{g.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {g.tags.map((x) => (
                  <TagPill key={x}>{x}</TagPill>
                ))}
              </div>
            </div>
          ))}
        </div>
      </WhiteCard>

      <div>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <SerifTitle className="text-2xl md:text-3xl">Template Library</SerifTitle>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-neutral-200 bg-white p-2 text-neutral-600 shadow-sm hover:bg-neutral-50"
              aria-label="Rediger"
            >
              <Pencil className="size-4" />
            </button>
            <div className="flex size-9 items-center justify-center rounded-full bg-neutral-200 text-neutral-600">
              <User className="size-4" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {templates.map((tpl) => (
            <WhiteCard key={tpl.t} className="flex flex-col overflow-hidden p-0">
              <div className="border-b border-neutral-100 px-4 py-3">
                <p className="text-sm font-semibold text-neutral-900">{tpl.t}</p>
              </div>
              <div className="flex flex-1 flex-col border-b border-neutral-100 px-4 py-3">
                <p className="text-sm leading-relaxed text-neutral-600">{tpl.d}</p>
              </div>
              <div className="space-y-3 px-4 py-3">
                <p className="text-[11px] text-neutral-500">{tpl.meta}</p>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-900"
                  style={{ backgroundColor: CREAM_DEEP }}
                >
                  <Eye className="size-4" />
                  View template
                </button>
              </div>
            </WhiteCard>
          ))}
        </div>
      </div>
    </div>
  )
}

function PinpointTopUtilityBar({ deptLabel = 'Marketing' }: { deptLabel?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/60 pb-3">
      <p className="text-xs text-neutral-500">Jobs</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 shadow-sm"
        >
          {deptLabel} <ChevronDown className="size-3 opacity-60" />
        </button>
        <button type="button" className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Oppgaver">
          <ClipboardList className="size-4" />
        </button>
        <button type="button" className="relative rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Varsler">
          <Bell className="size-4" />
          <span className="absolute right-1 top-1 size-1.5 rounded-full bg-red-500" />
        </button>
        <div className="flex size-8 items-center justify-center rounded-full bg-neutral-800 text-[10px] font-bold text-white">
          ME
        </div>
      </div>
    </div>
  )
}

function JobsListPinpointBlock() {
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const jobs = [
    {
      title: 'Customer Service Representative',
      meta: 'New York · Product · Hooli',
      code: '8301',
      candidates: 10,
      ratio: null as string | null,
    },
    {
      title: 'Marketing Manager',
      meta: 'London · Marketing · Hooli',
      code: '8299',
      candidates: 4,
      ratio: '0/5',
    },
    {
      title: 'Software Engineer (Internal)',
      meta: 'Oslo · Engineering · Hooli',
      code: '0006',
      candidates: 17,
      ratio: null,
    },
  ]

  return (
    <div className="space-y-4">
      <PinpointTopUtilityBar />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-1 py-2" style={{ backgroundColor: FOREST }}>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-[#FDFBF7] px-3 py-2 text-xs font-semibold text-neutral-900 shadow-sm"
          >
            <Briefcase className="size-3.5" />
            Active
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/10"
          >
            <Archive className="size-3.5" />
            Archived
          </button>
        </div>
        <button
          type="button"
          className="rounded-md bg-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-white/25"
        >
          + Create new job
        </button>
      </div>
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
          <WhiteCard key={j.code} className="overflow-hidden p-0">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-4 py-4">
              <div className="min-w-0">
                <p className="text-base font-semibold text-neutral-900">{j.title}</p>
                <p className="mt-1 text-sm text-neutral-500">{j.meta}</p>
                <span className="mt-2 inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                  {j.code}
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
                <p className="text-xl font-bold tabular-nums text-neutral-900">{j.candidates}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Candidates</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 font-medium text-red-800">2</span>
                <Users className="size-4" />
                <MessageSquare className="size-4" />
                <Mail className="size-4" />
                <span className="text-emerald-600">✓</span>
                {j.ratio ?
                  <span className="ml-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                    {j.ratio}
                  </span>
                : null}
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-700"
              >
                View candidates <ChevronDown className="size-3.5" />
              </button>
            </div>
          </WhiteCard>
        ))}
      </div>
    </div>
  )
}

function ScorecardCandidatePinpointCard({ name, score }: { name: string; score: number }) {
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
              {v != null ?
                <>
                  <DemoScoreBar value={v} />
                </>
              : (
                <div className="h-2 min-w-0 flex-1 rounded-full bg-neutral-200/80" />
              )}
            </div>
          ))}
        </div>
      </div>
    </WhiteCard>
  )
}

function JobScorecardPageBlock() {
  const [activeTab, setActiveTab] = useState('scorecards')
  const items: HubMenu1Item[] = useMemo(
    () =>
      [
        { key: 'candidates', label: 'Candidates', icon: Users, active: activeTab === 'candidates', onClick: () => setActiveTab('candidates') },
        { key: 'positions', label: 'Positions', icon: LayoutTemplate, active: activeTab === 'positions', onClick: () => setActiveTab('positions') },
        { key: 'edit', label: 'Edit', icon: Pencil, active: activeTab === 'edit', onClick: () => setActiveTab('edit') },
        { key: 'postings', label: 'Postings', icon: Mail, active: activeTab === 'postings', onClick: () => setActiveTab('postings') },
        { key: 'scorecards', label: 'Scorecards', icon: Star, active: activeTab === 'scorecards', onClick: () => setActiveTab('scorecards') },
        { key: 'interviews', label: 'Interviews', icon: CalendarDays, active: activeTab === 'interviews', onClick: () => setActiveTab('interviews') },
        { key: 'insights', label: 'Insights', icon: BarChart3, active: activeTab === 'insights', onClick: () => setActiveTab('insights') },
        { key: 'share', label: 'Share', icon: Share2, active: activeTab === 'share', onClick: () => setActiveTab('share') },
      ] satisfies HubMenu1Item[],
    [activeTab],
  )

  return (
    <div className="space-y-4">
      <PinpointTopUtilityBar />
      <Breadcrumb items={['Jobs', 'Software Engineer (Internal)', 'Scorecard ratings']} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SerifTitle className="text-2xl md:text-3xl">Software Engineer (Internal)</SerifTitle>
          <p className="mt-1 text-sm text-neutral-500">New York · Sales · Hooli · 0006</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="orange">Internal</Pill>
          <Pill tone="green">Open</Pill>
          <button type="button" className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Del">
            <Share2 className="size-4" />
          </button>
          <button type="button" className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Kommentarer">
            <MessageSquare className="size-4" />
          </button>
          <button type="button" className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Mer">
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </div>
      <HubMenu1Bar ariaLabel="Stillingsfaner" items={items} />
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
        <ScorecardCandidatePinpointCard name="Alonzo Muller" score={73} />
        <ScorecardCandidatePinpointCard name="Priya Nair" score={81} />
        <ScorecardCandidatePinpointCard name="Tom Hacquoil" score={69} />
      </div>
    </div>
  )
}

function JobPostingsPageBlock() {
  const [jobTab, setJobTab] = useState('candidates')
  const hubItems: HubMenu1Item[] = useMemo(
    () =>
      [
        { key: 'candidates', label: 'Candidates', icon: Users, active: jobTab === 'candidates', onClick: () => setJobTab('candidates') },
        { key: 'edit', label: 'Edit', icon: Pencil, active: jobTab === 'edit', onClick: () => setJobTab('edit') },
        { key: 'boards', label: 'Boards', icon: Kanban, active: jobTab === 'boards', onClick: () => setJobTab('boards') },
        { key: 'interviews', label: 'Interviews', icon: CalendarDays, active: jobTab === 'interviews', onClick: () => setJobTab('interviews') },
        { key: 'adverts', label: 'Adverts', icon: Mail, active: jobTab === 'adverts', onClick: () => setJobTab('adverts') },
        { key: 'insights', label: 'Insights', icon: BarChart3, active: jobTab === 'insights', onClick: () => setJobTab('insights') },
        { key: 'share', label: 'Share', icon: Share2, active: jobTab === 'share', onClick: () => setJobTab('share') },
        { key: 'team', label: 'Team', icon: Settings, active: jobTab === 'team', onClick: () => setJobTab('team') },
      ] satisfies HubMenu1Item[],
    [jobTab],
  )

  return (
    <div className="space-y-4">
      <PinpointTopUtilityBar deptLabel="Company" />
      <Breadcrumb items={['Jobs', 'Marketing Manager']} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <SerifTitle className="text-2xl md:text-3xl">Marketing Manager</SerifTitle>
          <p className="text-sm text-neutral-500">London · Marketing · ACME · 0002</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-teal-900">
            Open
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase text-white"
            style={{ backgroundColor: FOREST }}
          >
            <CheckSquare className="size-3.5" />
            Create task
          </button>
          <button type="button" className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Mer">
            <MoreHorizontal className="size-5" />
          </button>
        </div>
      </div>
      <HubMenu1Bar ariaLabel="Jobbfaner" items={hubItems} />
      <WhiteCard className="overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <SerifHeading className="text-xl">Postings</SerifHeading>
            <p className="mt-1 text-sm text-neutral-600">Create and manage multiple postings for this job</p>
          </div>
          <button
            type="button"
            className="rounded-md px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: FOREST }}
          >
            + Create posting
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-5 py-3">
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
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Job title</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Status</th>
                <th className="w-12 px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-100 hover:bg-neutral-50/80">
                <td className="px-5 py-3 font-medium text-neutral-900">Default</td>
                <td className="px-5 py-3 text-neutral-700">Marketing Manager</td>
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
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3 text-xs text-neutral-600">
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
        </div>
      </WhiteCard>
    </div>
  )
}

function SurveyInsights7070Block() {
  const comments = [
    { name: 'Noreen Keeling — Software Engineer (Internal)', when: '7 months ago', body: 'Great process and clear communication throughout. The team was welcoming and the technical discussion felt fair.' },
    { name: 'Rafael', when: '16 days ago', body: 'Overall positive experience. Would appreciate slightly faster feedback between stages.' },
    { name: 'Eduardo', when: '22 days ago', body: 'Professional interviewers and well-structured scorecard. Room to improve scheduling flexibility.' },
  ]
  return (
    <div className="space-y-4">
      <PinpointTopUtilityBar />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)] lg:items-start">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <BarChart3 className="mt-1 size-6 text-neutral-600" />
              <div>
                <p className="text-xs text-neutral-500">Candidate surveys</p>
                <SerifTitle className="text-2xl md:text-3xl">Candidate survey insights</SerifTitle>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:text-neutral-900"
              >
                <Filter className="size-3.5" />
                Show filters
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:text-neutral-900"
              >
                <Download className="size-3.5" />
                Export
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200/80 px-5 py-4" style={{ backgroundColor: CREAM_DEEP }}>
              <p className="text-3xl font-bold tabular-nums text-neutral-900">100%</p>
              <p className="mt-1 text-sm text-neutral-700">Candidate survey response rate</p>
            </div>
            <div className="rounded-lg border border-neutral-200/80 px-5 py-4" style={{ backgroundColor: CREAM_DEEP }}>
              <p className="text-3xl font-bold tabular-nums text-neutral-900">24</p>
              <p className="mt-1 text-sm text-neutral-700">Total number of responses</p>
            </div>
          </div>
          <WhiteCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Candidate experience score</p>
            <p className="mt-1 text-sm text-neutral-600">Net Promoter-style breakdown of promoter, passive, and detractor responses.</p>
            <div className="mt-6 flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
              <div
                className="grid size-44 shrink-0 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(${FOREST} 0% 54%, #86efac 54% 100%)`,
                }}
              >
                <div className="flex size-24 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                  <p className="text-2xl font-bold text-neutral-900">+54</p>
                  <p className="text-[10px] text-neutral-500">NPS</p>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div className="flex h-full w-full">
                    <div className="bg-red-400" style={{ width: '0%' }} />
                    <div className="bg-amber-400" style={{ width: '46%' }} />
                    <div className="bg-emerald-600" style={{ width: '54%' }} />
                  </div>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between">
                    <span className="flex items-center gap-2 text-neutral-600">
                      <span className="size-2 rounded-full bg-red-500" />
                      Detractor (0–6)
                    </span>
                    <span className="font-medium tabular-nums">0%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="flex items-center gap-2 text-neutral-600">
                      <span className="size-2 rounded-full bg-amber-400" />
                      Passive (7–8)
                    </span>
                    <span className="font-medium tabular-nums">46%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="flex items-center gap-2 text-neutral-600">
                      <span className="size-2 rounded-full bg-emerald-600" />
                      Promoter (9–10)
                    </span>
                    <span className="font-medium tabular-nums">54%</span>
                  </li>
                </ul>
                <p className="text-right text-[10px] text-neutral-400">Based on the NPS scoring methodology.</p>
              </div>
            </div>
          </WhiteCard>
          <WhiteCard className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Candidate experience score over time</p>
            <p className="mt-1 text-sm text-neutral-600">Trend line for average scores across survey waves.</p>
            <div className="mt-6 h-48 rounded-md border border-dashed border-neutral-200 bg-neutral-50/80">
              <svg viewBox="0 0 400 120" className="size-full text-[#1a3d32]" aria-hidden>
                <line x1="40" y1="10" x2="40" y2="100" stroke="#e5e5e5" strokeWidth="1" />
                <line x1="40" y1="100" x2="380" y2="100" stroke="#e5e5e5" strokeWidth="1" />
                {[0, 25, 50, 75, 100].map((y, i) => (
                  <g key={y}>
                    <line x1="40" y1={20 + i * 20} x2="380" y2={20 + i * 20} stroke="#f5f5f5" strokeWidth="1" />
                    <text x="8" y={24 + i * 20} className="fill-neutral-400 text-[8px]">
                      {100 - y}
                    </text>
                  </g>
                ))}
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  points="50,75 100,60 150,55 200,40 250,35 300,45 350,30"
                />
              </svg>
            </div>
          </WhiteCard>
        </div>
        <aside className="min-w-0 space-y-3">
          <WhiteCard className="overflow-hidden p-0">
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Survey responses</p>
            </div>
            <ul className="max-h-[min(70vh,520px)] divide-y divide-neutral-100 overflow-y-auto">
              {comments.map((c) => (
                <li key={c.name} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-neutral-900">7 / 10</span>
                    <button type="button" className="text-xs font-medium text-sky-700 hover:underline">
                      View full response
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] font-bold uppercase text-neutral-400">Comment</p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{c.body}</p>
                  <div className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-xs">
                    <p className="font-medium text-neutral-800">{c.name}</p>
                    <p className="text-neutral-500">{c.when}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-center gap-2 border-t border-neutral-100 py-3">
              <button type="button" className="rounded p-1 text-neutral-400 hover:bg-neutral-100">
                <ChevronLeft className="size-4" />
              </button>
              <span className="flex size-8 items-center justify-center rounded-full bg-[#1a3d32] text-xs font-bold text-white">1</span>
              <button type="button" className="text-sm text-neutral-600">
                2
              </button>
              <button type="button" className="text-sm text-neutral-600">
                3
              </button>
              <button type="button" className="rounded p-1 text-neutral-400 hover:bg-neutral-100">
                <ChevronRight className="size-4" />
              </button>
            </div>
          </WhiteCard>
        </aside>
      </div>
    </div>
  )
}

function CandidateDetailBlock() {
  const nav = ['Application', 'Résumé', 'Scorecards', 'Comments', 'Emails']
  const [active, setActive] = useState('Application')
  const rows = [
    ['First name', 'Taneka'],
    ['Last name', 'Oberbrunner'],
    ['Email address', 'taneka.oberbrunner@example.com'],
    ['Phone', '+44 7700 900123'],
    ['Source', 'Employee referral'],
  ]

  return (
    <div className="space-y-4">
      <Breadcrumb items={['Jobs', 'Software Developer', 'Candidates — Applied']} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SerifTitle className="text-2xl md:text-3xl">Software Developer</SerifTitle>
          <p className="mt-1 text-sm text-neutral-500">London · Engineering</p>
        </div>
        <button
          type="button"
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase shadow-sm"
        >
          Compose <ChevronDown className="ml-1 inline size-3" />
        </button>
      </div>
      <WhiteCard className="flex flex-wrap items-center gap-4 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-600">
            <User className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-neutral-900" style={{ fontFamily: SERIF }}>
              Taneka Oberbrunner
            </p>
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-950"
            >
              Applied <ChevronDown className="size-3" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {['0 tags', 'Email', 'Interview'].map((x) => (
            <button
              key={x}
              type="button"
              className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase text-neutral-700"
            >
              {x}
            </button>
          ))}
          <button type="button" className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100">
            <MoreHorizontal className="size-5" />
          </button>
        </div>
      </WhiteCard>
      <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-lg border border-neutral-200 bg-white lg:grid-cols-[minmax(200px,22%)_1fr]">
        <aside className="border-b border-neutral-200 lg:border-b-0 lg:border-r" style={{ backgroundColor: BEIGE_NAV }}>
          <nav className="p-2">
            {nav.map((item) => {
              const on = item === active
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActive(item)}
                  className={`mb-0.5 flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm font-medium ${
                    on ? 'bg-white/70 text-neutral-900 shadow-sm' : 'text-neutral-600 hover:bg-white/40'
                  }`}
                  style={on ? { boxShadow: `inset 3px 0 0 ${FOREST}` } : undefined}
                >
                  {item}
                </button>
              )
            })}
          </nav>
        </aside>
        <div className="p-6 md:p-8">
          <SerifHeading className="text-2xl">{active}</SerifHeading>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Application details</p>
          <ul className="mt-3 divide-y divide-neutral-200">
            {rows.map(([k, v]) => (
              <li key={String(k)} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                <span className="w-40 shrink-0 text-neutral-500">{k}</span>
                <span className="min-w-0 flex-1 font-medium text-neutral-900">{v}</span>
                <button type="button" className="shrink-0 text-neutral-400 hover:text-neutral-700" aria-label="Rediger">
                  <Pencil className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function StarRow({ filled }: { filled: number }) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < filled ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}

function CandidatesListBlock() {
  const segments = [
    { n: '12', l: 'All' },
    { n: '2', l: 'Rejected' },
    { n: '9', l: 'Applied', active: true },
    { n: '1', l: 'Interview' },
  ]

  return (
    <div className="space-y-4">
      <Breadcrumb items={['Jobs', 'Customer Success Manager', 'Candidates — Applied']} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SerifTitle className="text-2xl md:text-3xl">9 Candidates</SerifTitle>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
            <User className="size-3.5" /> 1/6
          </span>
        </div>
        <button
          type="button"
          className="text-sm font-semibold uppercase tracking-wide text-neutral-800 underline-offset-4 hover:underline"
        >
          + Add candidates
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {segments.map((s) => (
          <button
            key={s.l}
            type="button"
            className={`min-w-[88px] rounded-md border px-3 py-2 text-center transition ${
              s.active
                ? 'border-neutral-900 bg-white shadow-sm'
                : 'border-neutral-200 bg-white/60 hover:bg-white'
            }`}
            style={s.active ? { borderTopWidth: 3, borderTopColor: FOREST } : undefined}
          >
            <p className="text-lg font-bold tabular-nums text-neutral-900">{s.n}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{s.l}</p>
          </button>
        ))}
        <button
          type="button"
          className="ml-auto flex min-w-[120px] items-center justify-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
        >
          <Star className="size-4 text-amber-700" />
          <span className="text-lg font-bold tabular-nums">5</span>
          <span className="text-[10px] font-semibold uppercase text-neutral-600">Talent pipeline</span>
        </button>
      </div>
      <WhiteCard className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              placeholder="Search candidates…"
              className="w-full rounded-md border border-neutral-200 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/30"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase"
          >
            <Search className="size-3.5" />
            Advanced
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase"
          >
            Filters
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                <th className="w-10 py-2 pr-2">
                  <input type="checkbox" className="rounded border-neutral-300" aria-label="Velg alle" />
                </th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Stage</th>
                <th className="py-2 pr-4">Applied</th>
                <th className="py-2 pr-4">Tags</th>
                <th className="py-2">Avg. rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[
                { name: 'Alex Morgan', stage: 'Applied', date: '29 Jan, 2022', stars: 4, tags: ['Referral', 'Evening shift'] },
                { name: 'Jamie Chen', stage: 'Applied', date: '2 Feb, 2022', stars: 3, tags: ['Custom tag'] },
                { name: 'Samira Okonkwo', stage: 'Applied', date: '5 Feb, 2022', stars: 5, tags: ['Referral'] },
              ].map((r) => (
                <tr key={r.name} className="hover:bg-neutral-50/80">
                  <td className="py-3 pr-2">
                    <input type="checkbox" className="rounded border-neutral-300" aria-label={`Velg ${r.name}`} />
                  </td>
                  <td className="py-3 pr-4 font-medium text-neutral-900">{r.name}</td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950">
                      {r.stage}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-neutral-600">{r.date}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span
                          key={t}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                            t === 'Referral'
                              ? 'bg-emerald-100 text-emerald-900'
                              : t === 'Evening shift'
                                ? 'bg-orange-100 text-orange-900'
                                : 'bg-sky-100 text-sky-900'
                          }`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3">
                    <StarRow filled={r.stars} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WhiteCard>
    </div>
  )
}

function CandidatesVideoScreenBlock() {
  const [hubTab, setHubTab] = useState('interviews')
  const [stageSeg, setStageSeg] = useState<'all' | 'uninvited' | 'invited'>('all')
  const hubItems: HubMenu1Item[] = useMemo(
    () =>
      [
        { key: 'candidates', label: 'Candidates', icon: Users, active: hubTab === 'candidates', onClick: () => setHubTab('candidates') },
        { key: 'edit', label: 'Edit', icon: Pencil, active: hubTab === 'edit', onClick: () => setHubTab('edit') },
        { key: 'scorecards', label: 'Scorecards', icon: Star, active: hubTab === 'scorecards', onClick: () => setHubTab('scorecards') },
        {
          key: 'interviews',
          label: 'Interviews',
          icon: CalendarDays,
          active: hubTab === 'interviews',
          onClick: () => setHubTab('interviews'),
        },
        { key: 'adverts', label: 'Adverts', icon: Mail, active: hubTab === 'adverts', onClick: () => setHubTab('adverts') },
        { key: 'insights', label: 'Insights', icon: BarChart3, active: hubTab === 'insights', onClick: () => setHubTab('insights') },
        { key: 'share', label: 'Share', icon: Share2, active: hubTab === 'share', onClick: () => setHubTab('share') },
      ] satisfies HubMenu1Item[],
    [hubTab],
  )

  const pipelineStages = [
    { n: '12', l: 'All', icon: null as null },
    { n: '2', l: 'Rejected', icon: 'reject' as const },
    { n: '5', l: 'Applied', icon: null },
    { n: '4', l: 'Video screen', icon: 'video' as const, active: true },
    { n: '0', l: 'Onsite interviews', icon: null },
    { n: '0', l: 'Assessment', icon: null },
    { n: '0', l: 'Offer', icon: null },
    { n: '1', l: 'Hired', icon: 'hired' as const },
  ]

  return (
    <div className="space-y-4">
      <PinpointTopUtilityBar deptLabel="Company" />
      <Breadcrumb items={['Jobs', 'Customer Success Manager', 'Candidates — Video screen']} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SerifTitle className="text-2xl md:text-3xl">Customer Success Manager</SerifTitle>
          <p className="mt-1 text-sm text-neutral-500">London · Customer success · ACME · 8299</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="green">Open</Pill>
          <button type="button" className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Mer">
            <MoreHorizontal className="size-5" />
          </button>
        </div>
      </div>
      <HubMenu1Bar ariaLabel="Jobbfaner" items={hubItems} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SerifTitle className="text-2xl md:text-3xl">4 Candidates</SerifTitle>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
            <User className="size-3.5" /> 1/6
          </span>
        </div>
        <button
          type="button"
          className="text-sm font-semibold uppercase tracking-wide text-neutral-800 underline-offset-4 hover:underline"
        >
          + Add candidates
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {pipelineStages.map((s) => (
          <button
            key={s.l}
            type="button"
            className={`flex min-w-[72px] flex-col items-center rounded-md border px-2 py-2 text-center transition sm:min-w-[88px] sm:px-3 ${
              s.active ? 'border-neutral-900 bg-white shadow-sm' : 'border-neutral-200 bg-white/60 hover:bg-white'
            }`}
            style={s.active ? { borderTopWidth: 3, borderTopColor: s.icon === 'video' ? '#0284c7' : FOREST } : undefined}
          >
            <div className="flex min-h-[1.25rem] items-center justify-center gap-0.5">
              {s.icon === 'reject' ? <XCircle className="size-3.5 text-red-500" aria-hidden /> : null}
              {s.icon === 'video' ? <Video className="size-3.5 text-sky-600" aria-hidden /> : null}
              {s.icon === 'hired' ? <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden /> : null}
            </div>
            <p className="text-lg font-bold tabular-nums text-neutral-900">{s.n}</p>
            <p className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-neutral-500 sm:text-[10px]">{s.l}</p>
          </button>
        ))}
        <button
          type="button"
          className="ml-auto flex min-w-[120px] items-center justify-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
        >
          <Star className="size-4 text-amber-700" />
          <span className="text-lg font-bold tabular-nums">5</span>
          <span className="text-[10px] font-semibold uppercase text-neutral-600">Talent pipeline</span>
        </button>
      </div>

      <WhiteCard className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              placeholder="Search candidates…"
              className="w-full rounded-md border border-neutral-200 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/30"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase"
          >
            <Search className="size-3.5" />
            Advanced
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase"
          >
            <Filter className="size-3.5" />
            Filters
          </button>
        </div>

        <div
          className="mt-4 rounded-lg border border-neutral-200/90 bg-white px-4 py-3"
          style={{ backgroundColor: CREAM_DEEP }}
        >
          <p className="text-sm text-neutral-700">
            You can filter by candidates that have taken part in interviews at this stage
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5 shadow-sm">
              {(
                [
                  { id: 'all' as const, label: 'All candidates' },
                  { id: 'uninvited' as const, label: 'Uninvited' },
                  { id: 'invited' as const, label: 'Invited' },
                ] as const
              ).map((opt) => {
                const on = stageSeg === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStageSeg(opt.id)}
                    className={`rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                      on ? 'text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-50'
                    }`}
                    style={on ? { backgroundColor: FOREST } : undefined}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900"
            >
              <Settings className="size-3.5" />
              Configure
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                <th className="w-10 py-3 pr-2">
                  <input type="checkbox" className="rounded border-neutral-300" aria-label="Velg alle" />
                </th>
                <th className="py-3 pr-4">Name</th>
                <th className="py-3 pr-4">Template</th>
                <th className="py-3 pr-4">Attendees</th>
                <th className="py-3 pr-4">Tags</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {[
                {
                  name: 'Tom Hacquoil',
                  template: 'Standard',
                  attendees: '2',
                  tags: ['Custom tag 1', 'Referral', 'PMP certified'],
                  status: 'Not invited',
                  date: '12 Mar, 2024',
                },
                {
                  name: 'Priya Nair',
                  template: 'Technical',
                  attendees: '3',
                  tags: ['Referral'],
                  status: 'Invited',
                  date: '10 Mar, 2024',
                },
              ].map((r) => (
                <tr key={r.name} className="hover:bg-neutral-50/80">
                  <td className="py-3.5 pr-2">
                    <input type="checkbox" className="rounded border-neutral-300" aria-label={`Velg ${r.name}`} />
                  </td>
                  <td className="py-3.5 pr-4 font-medium text-neutral-900">{r.name}</td>
                  <td className="py-3.5 pr-4 text-neutral-600">{r.template}</td>
                  <td className="py-3.5 pr-4 tabular-nums text-neutral-600">{r.attendees}</td>
                  <td className="py-3.5 pr-4">
                    <div className="flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <span
                          key={t}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                            t === 'Referral'
                              ? 'bg-emerald-100 text-emerald-900'
                              : t === 'PMP certified'
                                ? 'bg-orange-100 text-orange-900'
                                : 'bg-sky-100 text-sky-900'
                          }`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        r.status === 'Not invited'
                          ? 'bg-amber-100/90 text-amber-950'
                          : 'bg-sky-100 text-sky-900'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-neutral-600">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WhiteCard>
    </div>
  )
}

function DonutMini({
  segments,
  centerLine1,
  centerLine2,
}: {
  segments: { pct: number; color: string }[]
  centerLine1: string
  centerLine2: string
}) {
  const stops = segments
    .reduce<{ acc: number; parts: string[] }>(
      (memo, s) => {
        const start = memo.acc
        const end = memo.acc + s.pct
        return { acc: end, parts: [...memo.parts, `${s.color} ${start}% ${end}%`] }
      },
      { acc: 0, parts: [] },
    )
    .parts.join(', ')
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-10">
      <ul className="min-w-[200px] space-y-2 text-sm">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-neutral-600">
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
              Channel {i + 1}
            </span>
            <span className="tabular-nums font-medium">{s.pct}%</span>
          </li>
        ))}
      </ul>
      <div
        className="grid size-44 shrink-0 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${stops})`,
        }}
      >
        <div className="flex size-24 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
          <p className="text-[10px] font-semibold uppercase text-neutral-500">{centerLine1}</p>
          <p className="text-lg font-bold text-neutral-900">{centerLine2}</p>
        </div>
      </div>
    </div>
  )
}

function InterviewsSidebarCard() {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  return (
    <WhiteCard className="overflow-hidden p-0">
      <div className="border-b border-neutral-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Interviews</p>
      </div>
      <div className="space-y-4 p-4">
        <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">
          1 interview scheduled for you this week.
        </div>
        <label className="flex items-center justify-between gap-2 text-sm text-neutral-700">
          <span>Only with me</span>
          <input type="checkbox" className="rounded border-neutral-300" defaultChecked />
        </label>
        <div>
          <p className="text-center text-xs font-medium text-neutral-500">October 2025</p>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-500">
            {days.map((d) => (
              <span key={d} className="font-semibold">
                {d}
              </span>
            ))}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <span
                key={d}
                className={`py-1 ${d === 3 ? 'rounded-full bg-orange-500 font-bold text-white' : 'text-neutral-700'}`}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
        <div className="border-t border-neutral-100 pt-3">
          <p className="text-sm font-semibold text-neutral-900">Customer Success Manager</p>
          <p className="text-sm text-neutral-600">Courtney Henry</p>
          <p className="text-xs text-neutral-500">Culture interview</p>
          <p className="mt-1 text-sm font-semibold text-orange-600">2:20 PM (BST)</p>
        </div>
      </div>
    </WhiteCard>
  )
}

function NotificationsSidebarCard() {
  const items = [
    { t: 'A new job for Operations Manager has been created.', when: 'Yesterday' },
    { t: 'Approval required for a new offer.', when: '2 days ago' },
    { t: 'Scorecard submitted for Senior Engineer.', when: '3 days ago' },
  ]
  return (
    <WhiteCard className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Unread notifications</p>
        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">5</span>
      </div>
      <ul className="divide-y divide-neutral-100">
        {items.map((it) => (
          <li key={it.t} className="flex gap-3 px-4 py-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              <Mail className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-neutral-800">{it.t}</p>
              <p className="mt-1 text-xs text-neutral-400">{it.when}</p>
            </div>
            <button type="button" className="shrink-0 text-neutral-400 hover:text-neutral-700" aria-label="Mer">
              <MoreHorizontal className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </WhiteCard>
  )
}

function DashboardMainRightBlock() {
  const main = (
    <>
      <div>
        <Breadcrumb items={['Dashboard']} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <SerifTitle className="text-2xl md:text-3xl">Welcome back, Leon</SerifTitle>
          <div className="flex items-center gap-2 text-neutral-500">
            <button type="button" className="rounded-md p-2 hover:bg-white/80" aria-label="Varsler">
              <Bell className="size-5" />
            </button>
            <button type="button" className="rounded-md p-2 hover:bg-white/80" aria-label="Innstillinger">
              <Settings className="size-5" />
            </button>
            <div className="flex size-9 items-center justify-center rounded-full bg-neutral-300 text-neutral-700">
              <User className="size-4" />
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TanStatCard big="28" title="New applications" sub="Since last login" />
        <TanStatCard big="12" title="Open jobs" sub="39 total jobs" />
      </div>
      <WhiteCard className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">Latest jobs</p>
          <button type="button" className="text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:text-neutral-900">
            All jobs
          </button>
        </div>
        <div className="divide-y divide-neutral-100">
          {[
            { title: 'Account Executive', meta: 'New York · Sales', applicants: '9', code: '1302' },
            { title: 'Senior Engineer', meta: 'Remote · Engineering', applicants: '17', code: '1304' },
          ].map((j) => (
            <div key={j.title} className="px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-900">{j.title}</p>
                  <p className="text-sm text-neutral-500">{j.meta}</p>
                  <Pill className="mt-2" tone="tan">
                    {j.code}
                  </Pill>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="green">Open</Pill>
                  <Pill tone="orange">Internal</Pill>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-sm">
                <span className="font-semibold text-neutral-900">{j.applicants} applicants</span>
                <button
                  type="button"
                  className="text-xs font-semibold uppercase tracking-wide text-neutral-700 hover:text-neutral-900"
                >
                  View applicants <ChevronDown className="inline size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </WhiteCard>
      <WhiteCard className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">Candidate insights</p>
          <button type="button" className="text-xs font-semibold uppercase tracking-wide text-neutral-600 hover:text-neutral-900">
            Insights hub
          </button>
        </div>
        <div className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Applications by channel</p>
          <p className="mt-1 text-sm text-neutral-600">Where your applicants came from this quarter.</p>
          <div className="mt-6">
            <DonutMini
              segments={[
                { pct: 38, color: FOREST },
                { pct: 27, color: '#60a5fa' },
                { pct: 20, color: '#fbbf24' },
                { pct: 15, color: '#c4b5fd' },
              ]}
              centerLine1="Total"
              centerLine2="1.2k"
            />
          </div>
        </div>
      </WhiteCard>
    </>
  )

  const side = (
    <>
      <InterviewsSidebarCard />
      <NotificationsSidebarCard />
    </>
  )

  return <MainRightGrid main={main} side={side} />
}

function SimpleDashboardBlock() {
  return (
    <div className="space-y-6">
      <Breadcrumb items={['Dashboard']} />
      <SerifTitle className="text-2xl md:text-3xl">Dashboard</SerifTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <TanStatCard big="24" title="Active pipelines" sub="Across 6 departments" />
        <TanStatCard big="18" title="Interviews this week" sub="3 require prep" />
      </div>
      <WhiteCard className="p-0">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <Users className="size-4 text-neutral-500" />
            Latest jobs
          </p>
          <button type="button" className="text-xs font-semibold uppercase text-neutral-600">
            + Create new job
          </button>
        </div>
        <div className="p-4">
          <div className="rounded-md border border-neutral-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-neutral-900">Marketing Lead</p>
                <p className="text-sm text-neutral-500">Oslo · Marketing</p>
              </div>
              <div className="flex gap-2">
                <Pill tone="green">Open</Pill>
                <Pill tone="orange">Internal</Pill>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
              <p className="text-2xl font-bold text-neutral-900">12</p>
              <p className="text-xs font-medium uppercase text-neutral-500">Candidates</p>
            </div>
          </div>
        </div>
      </WhiteCard>
      <WhiteCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-900">Candidates by stage</p>
          <button type="button" className="text-xs font-semibold uppercase text-sky-700">
            View all
          </button>
        </div>
        <p className="text-[10px] font-bold uppercase text-neutral-500">Pipeline health</p>
        <p className="mt-1 text-sm text-neutral-600">Volume by stage for open reqs.</p>
        <div className="mt-5 space-y-3">
          {[
            { label: 'Interview', v: 14, c: '#2563eb' },
            { label: 'Rejected', v: 8, c: '#dc2626' },
            { label: 'Applied', v: 22, c: FOREST },
            { label: 'Review', v: 11, c: '#ea580c' },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-neutral-600">{row.label}</span>
              <span className="w-6 tabular-nums font-semibold text-neutral-900">{row.v}</span>
              <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full" style={{ width: `${(row.v / 22) * 100}%`, backgroundColor: row.c }} />
              </div>
            </div>
          ))}
        </div>
      </WhiteCard>
    </div>
  )
}

const SECTIONS = [
  { id: 'library', label: 'Malbibliotek', desc: 'Filter sidebar + 4-kolonne kort (referanse: Template Library).' },
  { id: 'jobs', label: 'Stillinger (Jobs)', desc: 'Topp-linje, mørk fanebar Active/Archived, søk, jobbkort med kandidatlinje (uten venstremeny).' },
  {
    id: 'scorecard',
    label: 'Scorecard (detalj)',
    desc: 'Breadcrumb, meta, flere faner, søk, filterrad (stage/scorecards/order/show detail), 3 kolonner kandidatkort med job skills-rader.',
  },
  {
    id: 'survey7070',
    label: 'Survey insights 70/30',
    desc: 'Overskrift + filter/export, to KPI-kort, NPS-donut, trendgraf, høyre kolonne med svar og paginering.',
  },
  {
    id: 'postings',
    label: 'Stillingsannonser (Postings)',
    desc: 'Job header med Open + Create task, grønn fanebar, Postings med søk, tabell og paginering (uten play-overlay).',
  },
  { id: 'detail', label: 'Kandidatdetalj', desc: 'Beige seksjonsnavigasjon (~22 %) + hvit hovedflate med detaljrader.' },
  { id: 'list', label: 'Kandidatliste', desc: 'Tall-faner, søk og tabell med merker og stjerner.' },
  {
    id: 'video_screen',
    label: 'Video screen (Interviews)',
    desc: 'Hub med Interviews aktiv, pipeline-faner, søk, segmentert filter (All / Uninvited / Invited), Configure og tabell (Name, Template, Tags, Status).',
  },
  { id: 'dash', label: 'Dashboard 70/30', desc: 'Velkomst, KPI-kort, stillinger, smultring — med intervjuer og varsler til høyre.' },
  { id: 'dash2', label: 'Dashboard (kompakt)', desc: 'Enkel variant med søyler og jobbkort.' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export function PlatformPinpointLayoutsPage() {
  const [section, setSection] = useState<SectionId>('library')
  const [view, setView] = useState<'examples' | 'builder'>('examples')
  const baseId = useId()

  return (
    <div className="space-y-8 text-neutral-100">
      <div>
        <h1 className="text-2xl font-semibold text-white">Referanselayout (hoved + høyre)</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Statiske mockups inspirert av rekrutterings-ATS (Pinpoint-lignende): krem bakgrunn, serif titler, grønn menybar der det passer, og{' '}
          <strong className="font-medium text-neutral-200">70/30</strong> der oppsettet krever hovedkolonne og høyre kolonne. Den mørke venstremenyen i
          appen er ikke med — kun arbeidsflaten.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Juster globale tokens i{' '}
          <Link to="/platform-admin/layout-lab" className="text-amber-400/90 hover:underline">
            Layout-lab
          </Link>{' '}
          for å sammenligne med egne verdier. Avanserte mønstre finnes under{' '}
          <Link to="/platform-admin/ui-advanced" className="text-amber-400/90 hover:underline">
            Avansert UI
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView('examples')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            view === 'examples' ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/40' : 'text-neutral-400 hover:bg-white/5'
          }`}
        >
          Statiske eksempler
        </button>
        <button
          type="button"
          onClick={() => setView('builder')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            view === 'builder' ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/40' : 'text-neutral-400 hover:bg-white/5'
          }`}
        >
          Malbygger (CRUD, dra-og-slipp)
        </button>
      </div>

      {view === 'examples' ? (
        <>
          <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-slate-900/40 p-2">
            {SECTIONS.map((s) => {
              const sid = `${baseId}-${s.id}`
              return (
                <button
                  key={s.id}
                  type="button"
                  id={sid}
                  onClick={() => setSection(s.id)}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    section === s.id ? 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/40' : 'text-neutral-300 hover:bg-white/5'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          <p className="text-sm text-neutral-400">{SECTIONS.find((s) => s.id === section)?.desc}</p>

          <div className="rounded-xl border border-white/10 p-4 shadow-lg md:p-6" style={shellStyle()}>
            {section === 'library' ? <TemplateLibraryBlock /> : null}
            {section === 'jobs' ? <JobsListPinpointBlock /> : null}
            {section === 'scorecard' ? <JobScorecardPageBlock /> : null}
            {section === 'survey7070' ? <SurveyInsights7070Block /> : null}
            {section === 'postings' ? <JobPostingsPageBlock /> : null}
            {section === 'detail' ? <CandidateDetailBlock /> : null}
            {section === 'list' ? <CandidatesListBlock /> : null}
            {section === 'video_screen' ? <CandidatesVideoScreenBlock /> : null}
            {section === 'dash' ? <DashboardMainRightBlock /> : null}
            {section === 'dash2' ? <SimpleDashboardBlock /> : null}
          </div>
        </>
      ) : null}

      {view === 'builder' ? (
        <VisualTemplateEditor
          source="pinpoint"
          title="Egendefinerte referansemaler"
          description={
            <span>
              Start fra <strong className="text-neutral-200">Fra eksempel</strong> for å kopiere strukturen fra fanene over som redigerbar tre-mal. Klikk et element for popup, dra håndtaket for å flytte. Alt lagres i nettleseren per bruker.
            </span>
          }
        />
      ) : null}
    </div>
  )
}
