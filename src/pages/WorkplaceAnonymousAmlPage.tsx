import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, Filter, Plus, Search, Settings } from 'lucide-react'
import { AML_REPORT_KINDS, labelForAmlReportKind } from '../data/amlAnonymousReporting'
import { useWorkplaceReportingCases } from '../hooks/useWorkplaceReportingCases'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useWorkplaceReportingHubMenuItems } from '../components/workplace/WorkplaceReportingHubMenu'
import {
  WorkplaceStandardListLayout,
  WORKPLACE_LIST_LAYOUT_CTA,
  type WorkplaceListViewMode,
} from '../components/layout/WorkplaceStandardListLayout'
import { WorkplaceStandardFormPanel } from '../components/layout/WorkplaceStandardFormPanel'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_INPUT_ON_WHITE,
  WPSTD_FORM_INSET,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../components/layout/WorkplaceStandardFormPanel'
import type { AmlReportKind, AnonymousAmlReport } from '../types/orgHealth'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const FOREST = '#1a3d32'

type StatusTab = 'all' | 'high' | 'medium' | 'low'

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function WorkplaceAnonymousAmlPage() {
  const navigate = useNavigate()
  const { organization } = useOrgSetupContext()
  const hubItems = useWorkplaceReportingHubMenuItems()
  const wr = useWorkplaceReportingCases()
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [viewMode, setViewMode] = useState<WorkplaceListViewMode>('table')
  const [panel, setPanel] = useState<'closed' | 'new' | 'edit'>('closed')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [newKind, setNewKind] = useState<AmlReportKind>('psychosocial')
  const [newUrgency, setNewUrgency] = useState<AnonymousAmlReport['urgency']>('medium')
  const [newDetailsInd, setNewDetailsInd] = useState(false)
  const [newHrNote, setNewHrNote] = useState('')
  const [editHrNote, setEditHrNote] = useState('')

  const filtered = useMemo(() => {
    let rows = [...wr.anonymousAmlReports]
    if (statusTab === 'high') rows = rows.filter((r) => r.urgency === 'high')
    if (statusTab === 'medium') rows = rows.filter((r) => r.urgency === 'medium')
    if (statusTab === 'low') rows = rows.filter((r) => r.urgency === 'low')
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => {
        const label = labelForAmlReportKind(r.kind).toLowerCase()
        return label.includes(q) || r.id.toLowerCase().includes(q)
      })
    }
    rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    return rows
  }, [wr.anonymousAmlReports, statusTab, search])

  const selected = selectedId ? wr.anonymousAmlReports.find((r) => r.id === selectedId) : undefined

  const closePanel = useCallback(() => {
    setPanel('closed')
    setSelectedId(null)
  }, [])

  const openNew = useCallback(() => {
    setNewKind('psychosocial')
    setNewUrgency('medium')
    setNewDetailsInd(false)
    setNewHrNote('')
    setPanel('new')
  }, [])

  const tabCounts = useMemo(() => {
    const all = wr.anonymousAmlReports.length
    const high = wr.anonymousAmlReports.filter((r) => r.urgency === 'high').length
    const medium = wr.anonymousAmlReports.filter((r) => r.urgency === 'medium').length
    const low = wr.anonymousAmlReports.filter((r) => r.urgency === 'low').length
    return { all: String(all), high: String(high), medium: String(medium), low: String(low) }
  }, [wr.anonymousAmlReports])

  const tabs: {
    id: StatusTab
    label: string
    count: string
    icon?: 'clock' | 'warn' | 'check'
    warnCount?: boolean
  }[] = [
    { id: 'all', label: 'Alle', count: tabCounts.all },
    { id: 'high', label: 'Høy hastegrad', count: tabCounts.high, icon: 'warn', warnCount: true },
    { id: 'medium', label: 'Middels', count: tabCounts.medium, icon: 'clock' },
    { id: 'low', label: 'Lav', count: tabCounts.low, icon: 'check' },
  ]

  const publicUrl =
    organization?.whistle_public_slug && typeof window !== 'undefined'
      ? `${window.location.origin}/anonym-aml/${organization.whistle_public_slug}`
      : null

  const urgencyPill = (u: AnonymousAmlReport['urgency']) => (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        u === 'high' ? 'bg-red-100 text-red-900' : u === 'medium' ? 'bg-amber-100 text-amber-900' : 'bg-neutral-100 text-neutral-700'
      }`}
    >
      {u === 'high' ? 'Høy' : u === 'medium' ? 'Middels' : 'Lav'}
    </span>
  )

  const rowCells = (r: AnonymousAmlReport) => (
    <>
      <td className="px-4 py-4 sm:px-5">
        <p className="font-semibold text-neutral-900">{labelForAmlReportKind(r.kind)}</p>
        <p className="text-xs text-neutral-500">{formatWhen(r.submittedAt)}</p>
      </td>
      <td className="px-4 py-4 sm:px-5">{urgencyPill(r.urgency)}</td>
      <td className="px-4 py-4 text-neutral-600 sm:px-5">{r.detailsIndicated ? 'Ja' : 'Nei'}</td>
      <td className="px-4 py-4 text-neutral-600 sm:px-5">{r.hrNote?.trim() ? 'Ja' : '—'}</td>
    </>
  )

  return (
    <div className={`${PAGE_WRAP} font-[Inter,system-ui,sans-serif] text-[#171717]`}>
      <WorkplaceStandardListLayout
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Arbeidsplassrapportering', to: '/workplace-reporting' },
          { label: 'Anonym rapportering' },
        ]}
        title="Anonym rapportering"
        description="Aggregerte AML-henvendelser uten lagring av fritekst. Konfigurer den eksterne siden under Innstillinger."
        hubAriaLabel="Arbeidsplassrapportering"
        hubItems={hubItems}
        toolbar={{
          count: { value: wr.anonymousAmlReports.length, label: 'innsendte meldinger' },
          searchPlaceholder: 'Søk etter kategori eller id…',
          searchValue: search,
          onSearchChange: setSearch,
          filtersOpen,
          onFiltersOpenChange: setFiltersOpen,
          filterStatusText: filtersOpen ? 'Filter aktivt (faner over tabellen)' : undefined,
          filterPanel: filtersOpen ? (
            <p className="text-sm text-neutral-600">Bruk fanene under for å filtrere på hastegrad.</p>
          ) : null,
          viewMode,
          onViewModeChange: setViewMode,
          primaryAction: { label: 'Ny sak', onClick: openNew, icon: Plus },
          showSettingsButton: true,
          onSettingsClick: () => navigate('/workplace-reporting/anonymous-aml/settings'),
          settingsAriaLabel: 'Innstillinger for ekstern side',
        }}
      >
        <div className="space-y-5">
          {publicUrl ? (
            <p className="text-sm text-neutral-600">
              Ekstern side:{' '}
              <a href={publicUrl} className="font-medium underline" target="_blank" rel="noreferrer">
                {publicUrl}
              </a>{' '}
              (samme organisasjonsnøkkel som offentlig varsling)
            </p>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
              Sett opp <strong>offentlig varslingslenke</strong> (slug) under administrasjon for å aktivere den eksterne
              anonyme siden.
            </p>
          )}

          <div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl">
              Anonyme henvendelser
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Samme visuelle mønster som «background check» i layout-referanse: faner, søk og tabell.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-x-1 gap-y-2 border-b border-neutral-200 pb-0">
            {tabs.map((t) => {
              const active = statusTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStatusTab(t.id)}
                  className={`flex min-w-0 items-center gap-1.5 px-3 py-2 text-left transition ${
                    active ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                  style={
                    active
                      ? { borderBottomWidth: 3, borderBottomColor: FOREST, marginBottom: -1 }
                      : { marginBottom: -1, borderBottom: '3px solid transparent' }
                  }
                >
                  {t.icon === 'clock' ? <Clock className="size-4 shrink-0 text-neutral-400" /> : null}
                  {t.icon === 'warn' ? <AlertTriangle className="size-4 shrink-0 text-amber-500" /> : null}
                  {t.icon === 'check' ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : null}
                  <span className="whitespace-nowrap text-xs font-semibold sm:text-sm">{t.label}</span>
                  <span
                    className={`tabular-nums text-sm font-bold ${
                      t.warnCount && t.count !== '0' ? 'text-amber-600' : 'text-neutral-900'
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Søk etter kategori…"
                  className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
                />
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="inline-flex shrink-0 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase"
              >
                <Filter className="size-3.5" />
                Filters
              </button>
              <span className="text-xs text-neutral-500">{filtersOpen ? 'Faner aktive' : 'Ingen ekstra filter'}</span>
              <Link
                to="/workplace-reporting/anonymous-aml/settings"
                className="ml-auto shrink-0 rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
                aria-label="Innstillinger"
              >
                <Settings className="size-4" />
              </Link>
            </div>

            {viewMode === 'table' ? (
              <div className="overflow-x-auto">
                {filtered.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-neutral-500">Ingen meldinger i dette utvalget.</p>
                ) : (
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        <th className="px-4 py-3 sm:px-5">Kategori / tid</th>
                        <th className="px-4 py-3 sm:px-5">Hastegrad</th>
                        <th className="px-4 py-3 sm:px-5">Merknad indikert</th>
                        <th className="px-4 py-3 sm:px-5">HR-notat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filtered.map((r) => (
                        <tr
                          key={r.id}
                          className="cursor-pointer hover:bg-neutral-50/80"
                          onClick={() => {
                            setEditHrNote(r.hrNote ?? '')
                            setSelectedId(r.id)
                            setPanel('edit')
                          }}
                        >
                          {rowCells(r)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : null}

            {viewMode === 'box' ? (
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.length === 0 ? (
                  <p className="col-span-full py-8 text-center text-sm text-neutral-500">Ingen meldinger.</p>
                ) : (
                  filtered.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setEditHrNote(r.hrNote ?? '')
                        setSelectedId(r.id)
                        setPanel('edit')
                      }}
                      className="rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-neutral-300"
                    >
                      <p className="font-semibold text-neutral-900">{labelForAmlReportKind(r.kind)}</p>
                      <p className="mt-1 text-xs text-neutral-500">{formatWhen(r.submittedAt)}</p>
                      <div className="mt-3">{urgencyPill(r.urgency)}</div>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {viewMode === 'list' ? (
              <ul className="divide-y divide-neutral-100">
                {filtered.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-neutral-500">Ingen meldinger.</li>
                ) : (
                  filtered.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditHrNote(r.hrNote ?? '')
                          setSelectedId(r.id)
                          setPanel('edit')
                        }}
                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-neutral-50"
                      >
                        <span className="font-medium text-neutral-900">{labelForAmlReportKind(r.kind)}</span>
                        {urgencyPill(r.urgency)}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>

          <p className="text-sm text-neutral-600">
            For strukturert varsling med saksbehandling:{' '}
            <Link to="/tasks?view=whistle" className="font-medium text-[#1a3d32] underline">
              Oppgaver → varslingssaker
            </Link>
            .
          </p>
        </div>
      </WorkplaceStandardListLayout>

      <WorkplaceStandardFormPanel
        open={panel === 'new'}
        onClose={closePanel}
        titleId="anon-aml-new-title"
        title="Registrer sak (HR)"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closePanel}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={() => {
                wr.addAnonymousAmlReport({
                  kind: newKind,
                  urgency: newUrgency,
                  detailsIndicated: newDetailsInd,
                  hrNote: newHrNote,
                })
                closePanel()
              }}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-white"
              style={{ backgroundColor: WORKPLACE_LIST_LAYOUT_CTA }}
            >
              Lagre
            </button>
          </div>
        }
      >
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_LEAD}>Manuell registrering for oppfølging internt (samme felter som anonym innsending).</p>
          </div>
          <div className={WPSTD_FORM_INSET}>
            <label className={WPSTD_FORM_FIELD_LABEL}>Kategori</label>
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as AmlReportKind)}
              className={WPSTD_FORM_INPUT_ON_WHITE}
            >
              {AML_REPORT_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            <label className={`${WPSTD_FORM_FIELD_LABEL} mt-4 block`}>Hastegrad</label>
            <select
              value={newUrgency}
              onChange={(e) => setNewUrgency(e.target.value as AnonymousAmlReport['urgency'])}
              className={WPSTD_FORM_INPUT_ON_WHITE}
            >
              <option value="low">Lav</option>
              <option value="medium">Middels</option>
              <option value="high">Høy</option>
            </select>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
              <input type="checkbox" checked={newDetailsInd} onChange={(e) => setNewDetailsInd(e.target.checked)} />
              Merknad var indikert (kun flagg)
            </label>
            <label className={`${WPSTD_FORM_FIELD_LABEL} mt-4 block`}>Internt notat (HR)</label>
            <textarea
              value={newHrNote}
              onChange={(e) => setNewHrNote(e.target.value)}
              rows={3}
              className={WPSTD_FORM_INPUT_ON_WHITE}
            />
          </div>
        </div>
      </WorkplaceStandardFormPanel>

      <WorkplaceStandardFormPanel
        open={panel === 'edit' && Boolean(selected)}
        onClose={closePanel}
        titleId="anon-aml-edit-title"
        title={selected ? labelForAmlReportKind(selected.kind) : 'Sak'}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closePanel}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800"
            >
              Lukk
            </button>
            <button
              type="button"
              onClick={() => {
                if (selected) wr.updateAnonymousAmlReport(selected.id, { hrNote: editHrNote })
                closePanel()
              }}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-white"
              style={{ backgroundColor: WORKPLACE_LIST_LAYOUT_CTA }}
            >
              Lagre notat
            </button>
          </div>
        }
      >
        {selected ? (
          <div className="space-y-6">
            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <p className={WPSTD_FORM_LEAD}>Ingen fritekst fra innsender er lagret.</p>
              </div>
              <div className={WPSTD_FORM_INSET}>
                <p className="text-sm text-neutral-700">
                  <span className="font-semibold">Tid:</span> {formatWhen(selected.submittedAt)}
                </p>
                <p className="mt-2 text-sm text-neutral-700">
                  <span className="font-semibold">Hastegrad:</span> {urgencyPill(selected.urgency)}
                </p>
                <p className="mt-2 text-sm text-neutral-700">
                  <span className="font-semibold">Merknad indikert:</span> {selected.detailsIndicated ? 'Ja' : 'Nei'}
                </p>
              </div>
            </div>
            <div className={WPSTD_FORM_ROW_GRID}>
              <div>
                <p className={WPSTD_FORM_FIELD_LABEL}>Internt notat</p>
                <p className={WPSTD_FORM_LEAD}>Synlig for HR i denne listen.</p>
              </div>
              <div className={WPSTD_FORM_INSET}>
                <textarea
                  value={editHrNote}
                  onChange={(e) => setEditHrNote(e.target.value)}
                  rows={5}
                  className={WPSTD_FORM_INPUT_ON_WHITE}
                />
              </div>
            </div>
          </div>
        ) : null}
      </WorkplaceStandardFormPanel>
    </div>
  )
}
