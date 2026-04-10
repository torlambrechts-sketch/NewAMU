import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Kanban,
  LayoutGrid,
  List,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Search,
  Settings,
  Share2,
  Star,
  Users,
} from 'lucide-react'
import { HubMenu1Bar, type HubMenu1Item } from '../../components/layout/HubMenu1Bar'

const CREAM = '#F9F7F2'
const CREAM_DEEP = '#EFE8DC'
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

/** Heading 1: page title + hub — «Adverts» aktiv når tabellen under er Postings (samme kontekst). */
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
      <HubMenu1Bar ariaLabel="Stillingsfaner (komponer)" items={hubItems} />
    </div>
  )
}

/** Table 1: Postings card (search, table, pagination). */
function ComposablePostingsTableBlock() {
  return (
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
              <td className="px-5 py-3 text-neutral-700">Stillingsannonser (eksempel)</td>
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

/** Job listing cards: toolbar + grid (reference: Active Jobs). */
function ComposableJobCardsModuleBlock() {
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
      title: 'HR-rådgiver',
      meta: 'Bergen · HR · Eksempel AS',
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
                {j.ratio ? (
                  <span className="ml-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                    {j.ratio}
                  </span>
                ) : null}
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

const BLOCKS = [
  {
    id: 'heading1',
    label: 'Overskrift 1 — tittel + faner',
    hint: 'Brødsmule (Stillinger › Stillingsannonser), serif H1, HubMenu1Bar med aktiv fane for gjeldende seksjon.',
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
] as const

type BlockId = (typeof BLOCKS)[number]['id']

export function PlatformLayoutComposerPage() {
  const baseId = useId()
  const [visible, setVisible] = useState<Record<BlockId, boolean>>({
    heading1: true,
    table1: true,
    scorecard: true,
    jobCards: true,
  })

  const toggle = (id: BlockId) => setVisible((v) => ({ ...v, [id]: !v[id] }))
  const selectAll = () =>
    setVisible({ heading1: true, table1: true, scorecard: true, jobCards: true })
  const selectNone = () =>
    setVisible({ heading1: false, table1: false, scorecard: false, jobCards: false })

  const activeCount = BLOCKS.filter((b) => visible[b.id]).length

  return (
    <div className="space-y-6 text-neutral-100">
      <div>
        <h1 className="text-2xl font-semibold text-white">Layout-komponer</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Kombiner ferdige referanseblokker (overskrift + faner, Postings-tabell, scorecard-modul, jobbkort-modul) i én forhåndsvisning.
          Velg elementer til venstre — samme visuelle språk som under{' '}
          <Link to="/platform-admin/layout-reference" className="text-amber-400/90 hover:underline">
            Layout-referanse
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4 rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Elementer</p>
            <span className="text-xs text-neutral-500">
              {activeCount}/{BLOCKS.length} synlige
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-md border border-white/15 px-2 py-1 text-xs text-neutral-300 hover:bg-white/5"
            >
              Velg alle
            </button>
            <button
              type="button"
              onClick={selectNone}
              className="rounded-md border border-white/15 px-2 py-1 text-xs text-neutral-300 hover:bg-white/5"
            >
              Fjern alle
            </button>
          </div>
          <ul className="space-y-3">
            {BLOCKS.map((b) => {
              const sid = `${baseId}-${b.id}`
              return (
                <li key={b.id}>
                  <label className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-2 hover:border-white/10 hover:bg-white/5">
                    <input
                      id={sid}
                      type="checkbox"
                      checked={visible[b.id]}
                      onChange={() => toggle(b.id)}
                      className="mt-1 rounded border-neutral-500 bg-slate-800"
                    />
                    <span>
                      <span className="block text-sm font-medium text-neutral-200">{b.label}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">{b.hint}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </aside>

        <div className="min-w-0 space-y-4">
          <p className="text-sm text-neutral-500">Forhåndsvisning (kremflate, uten app-topbar)</p>
          <div className="rounded-xl border border-white/10 p-4 shadow-lg md:p-6" style={shellStyle()}>
            <div className="space-y-8">
              {visible.heading1 ? (
                <section aria-label="Overskrift og faner">
                  <ComposableHeading1Block />
                </section>
              ) : null}

              {visible.table1 ? (
                <section aria-label="Postings-tabell">
                  <ComposablePostingsTableBlock />
                </section>
              ) : null}

              {visible.scorecard ? (
                <section aria-label="Scorecard-modul">
                  <ComposableScorecardModuleBlock />
                </section>
              ) : null}

              {visible.jobCards ? (
                <section aria-label="Jobbkort-modul">
                  <ComposableJobCardsModuleBlock />
                </section>
              ) : null}

              {!visible.heading1 && !visible.table1 && !visible.scorecard && !visible.jobCards ? (
                <p className="py-12 text-center text-sm text-neutral-500">Velg minst ett element for å vise forhåndsvisning.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
