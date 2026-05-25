// ControlsListPage — full searchable + filterable table at /controls/list.
//
// Mirrors the "Alle X" pattern used by ChecklistsAllePage / SurveyAllePage /
// TasksAllePage. Filters: status, family, owner role, frequency, search.
// Rows link to /controls/:id detail page. Uses design-system primitives
// per DESIGN_SYSTEM.md §3 (StandardInput, SearchableSelect).

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { DataTable, type DataTableColumn, PageShell } from '../../template'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { useInternalControls } from './useInternalControls'
import {
  CONTROL_FAMILIES,
  CONTROL_FREQUENCY_HINTS,
  CONTROL_STATUS_LABELS,
} from './types'
import type {
  ControlFamily,
  ControlFrequencyHint,
  ControlStatusLabel,
  InternalControlRow,
} from './types'

type Row = InternalControlRow & {
  status_label: ControlStatusLabel
  last_occurred_at: string | null
  next_due_at: string | null
}

const STATUS_LABELS: Record<ControlStatusLabel, string> = {
  on_track: 'På sporet',
  due_soon: 'Forfaller snart',
  overdue: 'Forfalt',
  never_executed: 'Aldri utført',
  retired: 'Pensjonert',
}

const FAMILY_LABELS: Record<ControlFamily, string> = {
  preventive: 'Forebyggende',
  detective: 'Avdekkende',
  corrective: 'Korrigerende',
  directive: 'Styrende',
}

const FREQ_LABELS: Record<ControlFrequencyHint, string> = {
  arlig: 'Årlig',
  halvarlig: 'Halvårlig',
  kvartalsvis: 'Kvartalsvis',
  manedlig: 'Månedlig',
  ukentlig: 'Ukentlig',
  daglig: 'Daglig',
  ad_hoc: 'Ad hoc',
}

const STATUS_OPTIONS = [
  { value: '', label: 'Alle statuser' },
  ...CONTROL_STATUS_LABELS.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
]
const FAMILY_OPTIONS = [
  { value: '', label: 'Alle familier' },
  ...CONTROL_FAMILIES.map((f) => ({ value: f, label: FAMILY_LABELS[f] })),
]
const FREQ_OPTIONS = [
  { value: '', label: 'Alle frekvenser' },
  ...CONTROL_FREQUENCY_HINTS.map((f) => ({ value: f, label: FREQ_LABELS[f] })),
]

export function ControlsListPage() {
  const { supabase } = useOrgSetupContext()
  const { controls, statusByControlId, loading, error } = useInternalControls({
    supabase,
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ControlStatusLabel | ''>('')
  const [familyFilter, setFamilyFilter] = useState<ControlFamily | ''>('')
  const [freqFilter, setFreqFilter] = useState<ControlFrequencyHint | ''>('')

  const rows = useMemo<Row[]>(() => {
    const q = search.trim().toLowerCase()
    return controls
      .map<Row>((c) => ({
        ...c,
        status_label: statusByControlId[c.id]?.status_label ?? 'never_executed',
        last_occurred_at: statusByControlId[c.id]?.last_occurred_at ?? null,
        next_due_at: statusByControlId[c.id]?.next_due_at ?? null,
      }))
      .filter((r) => (statusFilter ? r.status_label === statusFilter : true))
      .filter((r) => (familyFilter ? r.control_family === familyFilter : true))
      .filter((r) =>
        freqFilter ? r.frequency_hint === freqFilter : true,
      )
      .filter((r) =>
        q === ''
          ? true
          : r.name.toLowerCase().includes(q) ||
            r.slug.toLowerCase().includes(q) ||
            (r.purpose ?? '').toLowerCase().includes(q),
      )
  }, [controls, statusByControlId, search, statusFilter, familyFilter, freqFilter])

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'name',
      header: 'Navn',
      render: (r) => (
        <Link
          to={`/controls/${r.id}`}
          className="font-medium text-amber-800 hover:underline"
        >
          {r.name}
        </Link>
      ),
    },
    {
      key: 'control_family',
      header: 'Familie',
      render: (r) => FAMILY_LABELS[r.control_family],
    },
    {
      key: 'frequency_hint',
      header: 'Frekvens',
      render: (r) => (r.frequency_hint ? FREQ_LABELS[r.frequency_hint] : '—'),
    },
    {
      key: 'owner_role',
      header: 'Eier',
      render: (r) => r.owner_role ?? '—',
    },
    {
      key: 'status_label',
      header: 'Status',
      render: (r) => (
        <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
          {STATUS_LABELS[r.status_label]}
        </span>
      ),
    },
    {
      key: 'last_occurred_at',
      header: 'Sist utført',
      render: (r) =>
        r.last_occurred_at
          ? new Date(r.last_occurred_at).toLocaleDateString('nb-NO')
          : '—',
    },
    {
      key: 'next_due_at',
      header: 'Neste frist',
      render: (r) =>
        r.next_due_at
          ? new Date(r.next_due_at).toLocaleDateString('nb-NO')
          : '—',
    },
  ]

  return (
    <PageShell
      title="Alle kontroller"
      description="Full liste over alle internkontroller — søk, filtrer, og åpne for detaljer."
    >
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
        <div className="flex-1 min-w-[12rem]">
          <StandardInput
            type="search"
            placeholder="Søk i navn, slug, formål…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <SearchableSelect
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(v) => setStatusFilter(v as ControlStatusLabel | '')}
        />
        <SearchableSelect
          value={familyFilter}
          options={FAMILY_OPTIONS}
          onChange={(v) => setFamilyFilter(v as ControlFamily | '')}
        />
        <SearchableSelect
          value={freqFilter}
          options={FREQ_OPTIONS}
          onChange={(v) => setFreqFilter(v as ControlFrequencyHint | '')}
        />
      </div>
      {loading ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
          Laster kontroller…
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        emptyLabel="Ingen kontroller matcher filteret."
      />
    </PageShell>
  )
}
