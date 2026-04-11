import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ClipboardList, Mail, MessageSquare, MoreHorizontal, Users } from 'lucide-react'
import type { HubMenu1Item } from '../../components/layout/HubMenu1Bar'
import {
  WorkplaceStandardListLayout,
  type WorkplaceListViewMode,
} from '../../components/layout/WorkplaceStandardListLayout'

type DemoItem = {
  id: string
  title: string
  meta: string
  code: string
  candidates: number
  starred: boolean
  status: 'active' | 'draft'
}

const DEMO_ITEMS: DemoItem[] = [
  {
    id: '1',
    title: 'HR-rådgiver',
    meta: 'Bergen · HR · Eksempel AS',
    code: '8299',
    candidates: 4,
    starred: true,
    status: 'active',
  },
  {
    id: '2',
    title: 'Software Engineer (Internal)',
    meta: 'Oslo · Engineering · Hooli',
    code: '0006',
    candidates: 17,
    starred: false,
    status: 'active',
  },
  {
    id: '3',
    title: 'Customer Service Representative',
    meta: 'New York · Product · Hooli',
    code: '8301',
    candidates: 10,
    starred: false,
    status: 'draft',
  },
]

/**
 * Platform-admin reference: standard workplace list layout (heading, hub, toolbar, content).
 * Reuse {@link WorkplaceStandardListLayout} and {@link WorkplaceListToolbar} from `components/layout/WorkplaceStandardListLayout`.
 */
export function PlatformStandardLayoutKitPage() {
  const [tab, setTab] = useState<'items' | 'docs'>('items')
  const [viewMode, setViewMode] = useState<WorkplaceListViewMode>('table')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all')
  const [sort, setSort] = useState('title')
  const [starredOnly, setStarredOnly] = useState(false)

  const hubItems: HubMenu1Item[] = useMemo(
    () => [
      {
        key: 'items',
        label: 'Elementer',
        icon: ClipboardList,
        active: tab === 'items',
        onClick: () => setTab('items'),
      },
      {
        key: 'docs',
        label: 'Dokumentasjon',
        icon: BookOpen,
        active: tab === 'docs',
        onClick: () => setTab('docs'),
      },
    ],
    [tab],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = DEMO_ITEMS.filter((x) => {
      if (starredOnly && !x.starred) return false
      if (statusFilter !== 'all' && x.status !== statusFilter) return false
      if (!q) return true
      return (
        x.title.toLowerCase().includes(q) ||
        x.meta.toLowerCase().includes(q) ||
        x.code.includes(q)
      )
    })
    list = [...list].sort((a, b) => {
      if (sort === 'candidates') return b.candidates - a.candidates
      return a.title.localeCompare(b.title, 'nb')
    })
    return list
  }, [search, statusFilter, sort, starredOnly])

  const activeFilters = statusFilter !== 'all' || starredOnly

  return (
    <div className="space-y-6 text-neutral-100">
      <div>
        <h1 className="text-2xl font-semibold text-white">Standard layout — liste / boks / tabell</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Gjenbrukbar mal: brødsmule, H1, beskrivelse, hub-meny, verktøylinje (søk, filter, stjerne, tabell/boks/liste,
          sortering, CTA) og innholdspanel. Komponenter ligger i{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-amber-200/90">
            src/components/layout/WorkplaceStandardListLayout.tsx
          </code>
          . Importer{' '}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">WorkplaceStandardListLayout</code> og{' '}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs">WorkplaceListToolbar</code> på arbeidsflate-sider.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 md:p-6">
        <div className="rounded-xl border border-white/10 bg-[#F9F7F2] p-4 text-neutral-900 shadow-lg md:p-6">
          {tab === 'docs' ? (
            <div className="space-y-4 text-sm text-neutral-700">
              <p className="font-medium text-neutral-900">Slik bruker du layouten i appen</p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  Bygg <code className="rounded bg-neutral-200/80 px-1">HubMenu1Item[]</code> for faner (eller bruk{' '}
                  <code className="rounded bg-neutral-200/80 px-1">WorkplaceBoardTabStrip</code> ved behov).
                </li>
                <li>
                  Send <code className="rounded bg-neutral-200/80 px-1">toolbar</code> med state for søk, filterpanel,
                  <code className="rounded bg-neutral-200/80 px-1">viewMode</code> og sortering.
                </li>
                <li>
                  Render <code className="rounded bg-neutral-200/80 px-1">children</code> avhengig av{' '}
                  <code className="rounded bg-neutral-200/80 px-1">viewMode === &apos;table&apos; | &apos;box&apos; | &apos;list&apos;</code>.
                </li>
              </ol>
              <p>
                <Link to="/platform-admin/layout-composer" className="font-medium text-amber-600 hover:underline">
                  Layout-komponer
                </Link>{' '}
                viser enkeltblokker; denne siden viser hele sammensetningen. Se også{' '}
                <Link to="/platform-admin/layout-dashboard" className="font-medium text-amber-600 hover:underline">
                  Dashbord-layout
                </Link>{' '}
                og{' '}
                <Link to="/platform-admin/layout-split" className="font-medium text-amber-600 hover:underline">
                  Split 7/3
                </Link>
                .
              </p>
            </div>
          ) : (
            <WorkplaceStandardListLayout
              breadcrumb={[
                { label: 'Plattformadmin', to: '/platform-admin' },
                { label: 'Layout-kit' },
                { label: 'Demo' },
              ]}
              title="Stillingsannonser (demo)"
              description="Eksempeldata — bytt CTA-tekst, filterfelt og kolonner per modul. Verktøylinjen er delt komponent."
              hubAriaLabel="Demo — faner"
              hubItems={hubItems}
              toolbar={{
                count: { value: filtered.length, label: 'poster (demo)' },
                searchPlaceholder: 'Søk etter tittel, kode eller sted…',
                searchValue: search,
                onSearchChange: setSearch,
                filtersOpen,
                onFiltersOpenChange: setFiltersOpen,
                filterStatusText: activeFilters ? 'Filter aktive' : 'Ingen filter',
                filterPanel: (
                  <div className="flex flex-wrap items-end gap-4">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
                      Status
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                        className="mt-1.5 block min-w-[140px] rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="all">Alle</option>
                        <option value="active">Aktiv</option>
                        <option value="draft">Utkast</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('all')
                        setStarredOnly(false)
                      }}
                      className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      Nullstill
                    </button>
                  </div>
                ),
                sortOptions: [
                  { value: 'title', label: 'Tittel A–Å' },
                  { value: 'candidates', label: 'Kandidater (høyest)' },
                ],
                sortValue: sort,
                onSortChange: setSort,
                viewMode,
                onViewModeChange: setViewMode,
                primaryAction: {
                  label: 'Opprett ny stilling',
                  onClick: () => {
                    window.alert('Demo: opprett-handling')
                  },
                },
                starToggle: {
                  active: starredOnly,
                  onToggle: () => setStarredOnly((s) => !s),
                  ariaLabel: starredOnly ? 'Vis alle' : 'Kun favoritter',
                },
                showSettingsButton: true,
                onSettingsClick: () => window.alert('Demo: innstillinger'),
              }}
            >
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-500">Ingen treff.</p>
              ) : viewMode === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        <th className="py-3 pr-4">Stilling</th>
                        <th className="py-3 pr-4">Kode</th>
                        <th className="py-3 pr-4">Kandidater</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="w-10 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row) => (
                        <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50/80">
                          <td className="py-3 pr-4">
                            <p className="font-medium text-neutral-900">{row.title}</p>
                            <p className="text-xs text-neutral-500">{row.meta}</p>
                          </td>
                          <td className="py-3 pr-4 text-neutral-700">{row.code}</td>
                          <td className="py-3 pr-4 tabular-nums">{row.candidates}</td>
                          <td className="py-3 pr-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                row.status === 'active'
                                  ? 'bg-teal-100 text-teal-900'
                                  : 'bg-neutral-100 text-neutral-700'
                              }`}
                            >
                              {row.status === 'active' ? 'Aktiv' : 'Utkast'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button type="button" className="text-neutral-400 hover:text-neutral-700" aria-label="Meny">
                              <MoreHorizontal className="size-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : viewMode === 'box' ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((row) => (
                    <div
                      key={row.id}
                      className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm"
                      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                    >
                      <div className="border-b border-neutral-100 px-4 py-3">
                        <p className="font-semibold text-neutral-900">{row.title}</p>
                        <p className="mt-1 text-xs text-neutral-500">{row.meta}</p>
                        <span className="mt-2 inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
                          {row.code}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-neutral-600">
                        <span>
                          <strong className="text-lg text-neutral-900">{row.candidates}</strong> kandidater
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="size-3.5" />
                          <MessageSquare className="size-3.5" />
                          <Mail className="size-3.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {filtered.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">{row.title}</p>
                        <p className="text-xs text-neutral-500">{row.meta}</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-neutral-600">
                        <span className="tabular-nums">{row.candidates} kandidater</span>
                        <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs">{row.code}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </WorkplaceStandardListLayout>
          )}
        </div>
      </div>
    </div>
  )
}
