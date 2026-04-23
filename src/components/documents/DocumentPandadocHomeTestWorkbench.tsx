import { Fragment, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  ListFilter,
  Pencil,
  Search,
  Settings,
} from 'lucide-react'
import { ModuleRecordsTableShell } from '../module'
import { MODULE_TABLE_TD, MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../module/moduleTableKit'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'

const FOREST = '#1a3d32'

type StatusTab = 'draft' | 'actions' | 'waiting' | 'final'

type DocGroup = 'today' | 'yesterday'

type MockDocRow = {
  id: string
  tab: StatusTab
  group: DocGroup
  title: string
  byName: string
  statusLabel: string
  initials: string
  statusUpdated: string
  lastAction: string
  value: string
}

const MOCK_ROWS: MockDocRow[] = [
  {
    id: '1',
    tab: 'draft',
    group: 'today',
    title: 'Revisjonsforslag HMS',
    byName: 'Kari Nordmann',
    statusLabel: 'Utkast',
    initials: 'KN',
    statusUpdated: '22. apr. 2026',
    lastAction: 'opprettet av Kari Nordmann 22. apr. 2026',
    value: '0 kr',
  },
  {
    id: '2',
    tab: 'draft',
    group: 'today',
    title: 'Oppsigelsesmal v3',
    byName: 'Markus Berg',
    statusLabel: 'Utkast',
    initials: 'MB',
    statusUpdated: '22. apr. 2026',
    lastAction: 'redigert av Markus Berg 22. apr. 2026',
    value: '0 kr',
  },
  {
    id: '3',
    tab: 'draft',
    group: 'yesterday',
    title: 'BHT-avtaleutkast',
    byName: 'Sara Li',
    statusLabel: 'Utkast',
    initials: 'SL',
    statusUpdated: '21. apr. 2026',
    lastAction: 'opprettet av Sara Li 21. apr. 2026',
    value: '4 517 kr',
  },
  {
    id: '4',
    tab: 'draft',
    group: 'yesterday',
    title: 'Vernerunde referat Q1',
    byName: 'Kari Nordmann',
    statusLabel: 'Utkast',
    initials: 'KN',
    statusUpdated: '21. apr. 2026',
    lastAction: 'kommentar av Kari Nordmann 21. apr. 2026',
    value: '0 kr',
  },
  {
    id: '5',
    tab: 'actions',
    group: 'today',
    title: 'Signatur påbrutt',
    byName: 'Admin',
    statusLabel: 'Trenger deg',
    initials: 'AD',
    statusUpdated: '22. apr. 2026',
    lastAction: 'venter på signatur 22. apr. 2026',
    value: '0 kr',
  },
  {
    id: '6',
    tab: 'waiting',
    group: 'today',
    title: 'AMU-protokoll 2026',
    byName: 'Markus Berg',
    statusLabel: 'Sendt',
    initials: 'MB',
    statusUpdated: '22. apr. 2026',
    lastAction: 'sendt til mottakere 22. apr. 2026',
    value: '0 kr',
  },
  {
    id: '7',
    tab: 'final',
    group: 'yesterday',
    title: 'HMS-policy (signert)',
    byName: 'Sara Li',
    statusLabel: 'Ferdig',
    initials: 'SL',
    statusUpdated: '21. apr. 2026',
    lastAction: 'fullført av alle parter 21. apr. 2026',
    value: '0 kr',
  },
  {
    id: '8',
    tab: 'final',
    group: 'yesterday',
    title: 'Introduksjonsdokument',
    byName: 'Kari Nordmann',
    statusLabel: 'Ferdig',
    initials: 'KN',
    statusUpdated: '21. apr. 2026',
    lastAction: 'arkivert 21. apr. 2026',
    value: '0 kr',
  },
]

const TABS: { id: StatusTab; label: string; icon: typeof Pencil }[] = [
  { id: 'draft', label: 'Utkast', icon: Pencil },
  { id: 'actions', label: 'Krever handling', icon: AlertCircle },
  { id: 'waiting', label: 'Venter på andre', icon: Clock },
  { id: 'final', label: 'Ferdigstilt', icon: CheckCircle2 },
]

function countForTab(tab: StatusTab) {
  return MOCK_ROWS.filter((r) => r.tab === tab).length
}

const GROUP_LABEL: Record<DocGroup, string> = {
  today: 'I dag',
  yesterday: 'I går',
}

const GROUPS_IN_ORDER: DocGroup[] = ['today', 'yesterday']

/**
 * Visual test: PandaDoc-style «Home» with status cards as tabs and a grouped
 * document table inside {@link ModuleRecordsTableShell} (standard module table).
 * Mock data only — route `/documents/pandadoc-home-test`.
 */
export function DocumentPandadocHomeTestWorkbench() {
  const [activeTab, setActiveTab] = useState<StatusTab>('draft')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return MOCK_ROWS.filter((r) => {
      if (r.tab !== activeTab) return false
      if (q && !r.title.toLowerCase().includes(q) && !r.byName.toLowerCase().includes(q)) return false
      return true
    })
  }, [activeTab, query])

  const rowsByGroup = useMemo(() => {
    const m = new Map<DocGroup, MockDocRow[]>()
    for (const g of GROUPS_IN_ORDER) m.set(g, [])
    for (const r of filtered) {
      m.get(r.group)?.push(r)
    }
    return m
  }, [filtered])

  return (
    <div className="space-y-6">
      {/* PandaDoc-like top utility row (demo only) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-2.5">
        <p className="text-xs text-amber-900/80">
          <span className="font-semibold">Demoside</span> — visuell referanse til PandaDoc «Home». Ingen ekte data.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" className="border-amber-300/80 bg-amber-100/80 text-amber-950 hover:bg-amber-100">
            Start abonnement (demo)
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-neutral-600" disabled aria-label="Søk (demo)">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Hjem</h2>
        <p className="mt-1 text-sm text-neutral-600">Dokumenter gruppert etter status — klikk på kort for å bytte tabell.</p>
      </header>

      {/* Status «tabs» as horizontal cards (PandaDoc pattern) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = activeTab === t.id
            const count = countForTab(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex min-h-[5.5rem] flex-col items-start rounded-xl border bg-white px-3 py-3 text-left shadow-sm transition sm:px-4 ${
                  active
                    ? 'border-neutral-200 ring-2 ring-[#1a3d32]/25'
                    : 'border-neutral-200/90 hover:border-neutral-300 hover:bg-neutral-50/80'
                }`}
                style={active ? { borderBottomWidth: 3, borderBottomColor: FOREST } : undefined}
                aria-pressed={active}
              >
                <span className={`mb-2 inline-flex rounded-md p-1.5 ${active ? 'bg-[#1a3d32]/10' : 'bg-neutral-100'}`}>
                  <Icon className={`h-4 w-4 ${active ? 'text-[#1a3d32]' : 'text-neutral-500'}`} aria-hidden />
                </span>
                <span className={`text-sm font-semibold ${active ? 'text-neutral-900' : 'text-neutral-600'}`}>{t.label}</span>
                <span className="mt-0.5 text-xs text-neutral-500">
                  <span className="font-bold tabular-nums text-neutral-800">{count}</span> dokumenter
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex shrink-0 items-start lg:pt-1">
          <Button type="button" variant="secondary" size="sm" icon={<Settings className="h-4 w-4" />}>
            Tilpass
          </Button>
        </div>
      </div>

      <ModuleRecordsTableShell
        title="Dokumenter"
        titleTypography="sans"
        description={`Viser ${TABS.find((x) => x.id === activeTab)?.label ?? ''} — sortert etter siste aktivitet (demodata).`}
        headerActions={
          <Button type="button" variant="ghost" size="sm" icon={<ListFilter className="h-4 w-4" />} aria-label="Filter og sortering (demo)">
            <span className="hidden sm:inline">Filter</span>
          </Button>
        }
        toolbar={
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <StandardInput
              type="search"
              className="w-full py-2 pl-10"
              placeholder="Søk i dokumenter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Søk i dokumenter"
            />
          </div>
        }
        footer={
          <span className="text-sm text-neutral-500">
            {filtered.length} dokument{filtered.length === 1 ? '' : 'er'} i denne visningen
          </span>
        }
      >
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Tittel</th>
              <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Status</th>
              <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Mottakere</th>
              <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Status oppdatert</th>
              <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Siste handling</th>
              <th className={`${MODULE_TABLE_TH} text-right text-sm normal-case font-semibold tracking-normal`}>Verdi</th>
              <th className={`${MODULE_TABLE_TH} w-12 px-3 text-right`} aria-label="Sorter">
                <ListFilter className="ml-auto h-4 w-4 text-neutral-400" aria-hidden />
              </th>
            </tr>
          </thead>
          <tbody>
            {GROUPS_IN_ORDER.map((g) => {
              const rows = rowsByGroup.get(g) ?? []
              if (rows.length === 0) return null
              return (
                <Fragment key={g}>
                  <tr className="bg-neutral-50/90">
                    <td
                      colSpan={7}
                      className="border-b border-neutral-200 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500"
                    >
                      {GROUP_LABEL[g]}
                    </td>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.id} className={MODULE_TABLE_TR_BODY}>
                      <td className={`${MODULE_TABLE_TD} max-w-[14rem]`}>
                        <div className="flex min-w-0 items-start gap-2">
                          <span
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border border-neutral-200 bg-neutral-50 text-neutral-400"
                            aria-hidden
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-neutral-900">{row.title}</div>
                            <div className="mt-0.5 text-xs text-neutral-500">av {row.byName}</div>
                          </div>
                        </div>
                      </td>
                      <td className={`${MODULE_TABLE_TD}`}>
                        <span className="inline-flex items-center gap-2 text-neutral-700">
                          <span className="size-2 shrink-0 rounded-full bg-neutral-300" aria-hidden />
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className={`${MODULE_TABLE_TD}`}>
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-600"
                          title={row.byName}
                        >
                          {row.initials}
                        </span>
                      </td>
                      <td className={`${MODULE_TABLE_TD} text-neutral-600`}>{row.statusUpdated}</td>
                      <td className={`${MODULE_TABLE_TD} max-w-[12rem] text-neutral-600`}>
                        <span className="line-clamp-2">{row.lastAction}</span>
                      </td>
                      <td className={`${MODULE_TABLE_TD} text-right font-medium tabular-nums text-neutral-800`}>{row.value}</td>
                      <td className="px-3 py-4 align-middle" />
                    </tr>
                  ))}
                </Fragment>
              )
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-neutral-500">
                  Ingen dokumenter i denne statusen{query ? ' som matcher søket' : ''}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </ModuleRecordsTableShell>
    </div>
  )
}
