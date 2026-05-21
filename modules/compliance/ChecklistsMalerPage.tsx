// ChecklistsMalerPage — "Alle maler" — full template library.
//
// Three views: Liste (sortable table) · Tavle (kanban by pack) · Tidslinje
// (grouped by cadence). View toggle + export always visible. Back link to
// Bibliotek lives in the sticky page header.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowLeft, ClipboardList, Clock, Download, LayoutGrid, ListChecks, Plus } from 'lucide-react'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { useLicensedPacks } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from './useChecklistModule'
import type { ComplianceTemplateRow } from './types'

type ViewMode = 'list' | 'board' | 'timeline'

// ── Shared view toggle ─────────────────────────────────────────────────────

function ViewToggle({ mode, setMode }: { mode: ViewMode; setMode: (v: ViewMode) => void }) {
  const OPTIONS = [
    { id: 'list' as const, label: 'Liste', Icon: ListChecks },
    { id: 'board' as const, label: 'Tavle', Icon: LayoutGrid },
    { id: 'timeline' as const, label: 'Tidslinje', Icon: Activity },
  ]
  return (
    <div className="inline-flex rounded-lg bg-neutral-100 p-1 gap-0.5">
      {OPTIONS.map((m) => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
            mode === m.id
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-800'
          }`}
        >
          <m.Icon className="h-3.5 w-3.5" />
          {m.label}
        </button>
      ))}
    </div>
  )
}

// ── Page header ────────────────────────────────────────────────────────────

function PageHeader({
  title,
  count,
  mode,
  setMode,
  onExport,
  onNew,
}: {
  title: string
  count: number
  mode: ViewMode
  setMode: (v: ViewMode) => void
  onExport: () => void
  onNew: () => void
}) {
  return (
    <div className="border-b border-neutral-200 bg-white">
      <div className="mx-auto max-w-[1400px] px-6 pb-0 pt-5 md:px-10">
        <Link
          to="/compliance/checklists/bibliotek"
          className="mb-2 inline-flex items-center gap-1.5 rounded px-1 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tilbake til biblioteket
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
          <div>
            <p className="text-xs text-neutral-500">{count} treff</p>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{title}</h1>
          </div>
          <div className="flex items-center gap-2.5">
            <ViewToggle mode={mode} setMode={setMode} />
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={onExport}
            >
              Eksporter CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={onNew}
            >
              Ny mal
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── List view — <table> for reliable alignment ─────────────────────────────

function TemplatesList({
  items,
  categoryNameById,
  onOpen,
}: {
  items: ComplianceTemplateRow[]
  categoryNameById: Map<string, string>
  onOpen: (t: ComplianceTemplateRow) => void
}) {
  const [sort, setSort] = useState<'name' | 'cadence' | 'status'>('name')
  const sorted = useMemo(() => {
    const a = [...items]
    if (sort === 'name') a.sort((x, y) => x.name.localeCompare(y.name, 'nb'))
    if (sort === 'cadence')
      a.sort((x, y) => (x.cadence_hint ?? '').localeCompare(y.cadence_hint ?? '', 'nb'))
    if (sort === 'status') a.sort((x, y) => x.review_status.localeCompare(y.review_status))
    return a
  }, [items, sort])

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      {/* Sort pills */}
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <span className="text-xs text-neutral-500">Sorter:</span>
        {(
          [
            { id: 'name', label: 'Navn A→Å' },
            { id: 'cadence', label: 'Frekvens' },
            { id: 'status', label: 'Status' },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
              sort === s.id
                ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="py-16 text-center text-sm text-neutral-500">Ingen maler.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  Mal
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  Kategori
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  Pakke
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  Frekvens
                </th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  Status
                </th>
                <th className="w-8 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onOpen(t)}
                  className="cursor-pointer border-t border-neutral-100 transition-colors hover:bg-neutral-50"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {t.review_status === 'approved' && (
                        <ClipboardList className="h-3.5 w-3.5 shrink-0 text-[#1a3d32]" />
                      )}
                      <span className="font-semibold text-neutral-900">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-600">
                    {t.category_id ? (categoryNameById.get(t.category_id) ?? '—') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-600">{t.pack}</td>
                  <td className="px-4 py-2.5 text-xs text-neutral-600">
                    {t.cadence_hint ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.review_status === 'approved' ? (
                      <Badge variant="success">Offisiell</Badge>
                    ) : t.review_status === 'reviewed' ? (
                      <Badge variant="neutral">Verifisert</Badge>
                    ) : (
                      <Badge variant="draft">Utkast</Badge>
                    )}
                  </td>
                  <td className="w-8 px-4 py-2.5 text-neutral-300">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Board view — kanban by pack ────────────────────────────────────────────

function TemplatesBoard({
  items,
  packs,
  onOpen,
}: {
  items: ComplianceTemplateRow[]
  packs: { slug: string; shortName: string }[]
  onOpen: (t: ComplianceTemplateRow) => void
}) {
  const PACK_COLORS: Record<string, string> = {
    'aml-amu': '#1a3d32',
    'iso-45001': '#1e40af',
    'iso-9001': '#7c3aed',
    'iso-14001': '#065f46',
    'iso-27001': '#9f1239',
  }
  const allSlugs = useMemo(() => {
    const fromItems = [...new Set(items.map((t) => t.pack))]
    const fromPacks = packs.map((p) => p.slug)
    return [...new Set([...fromPacks, ...fromItems])]
  }, [items, packs])
  const labelOf = useMemo(() => {
    const m = new Map(packs.map((p) => [p.slug, p.shortName]))
    return (slug: string) => m.get(slug) ?? slug.toUpperCase()
  }, [packs])

  return (
    <div className="overflow-x-auto pb-4">
      <div
        className="grid min-w-[600px] gap-4"
        style={{ gridTemplateColumns: `repeat(${allSlugs.length}, minmax(260px, 1fr))` }}
      >
        {allSlugs.map((slug) => {
          const list = items.filter((t) => t.pack === slug)
          const color = PACK_COLORS[slug] ?? '#1a3d32'
          return (
            <div key={slug} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                <span className="text-xs font-bold uppercase tracking-wide text-neutral-800">
                  {labelOf(slug)}
                </span>
                <span className="ml-auto rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-neutral-600">
                  {list.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {list.slice(0, 20).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onOpen(t)}
                    className="rounded-lg border border-neutral-200 bg-white p-2.5 text-left shadow-[0_1px_1px_rgba(0,0,0,0.03)] transition-colors hover:border-neutral-300"
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold leading-tight text-neutral-900">
                        {t.name}
                      </span>
                      {t.review_status === 'approved' && (
                        <ClipboardList className="mt-0.5 h-3 w-3 shrink-0 text-[#1a3d32]" />
                      )}
                    </div>
                    {t.cadence_hint ? (
                      <span className="mt-1.5 inline-block text-[10px] text-neutral-500">
                        {t.cadence_hint}
                      </span>
                    ) : null}
                  </button>
                ))}
                {list.length === 0 && (
                  <div className="px-2 py-4 text-center text-xs text-neutral-400">
                    Ingen maler
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Timeline view — grouped by cadence ────────────────────────────────────

const CADENCE_ORDER = [
  'daglig', 'ukentlig', 'månedlig', 'kvartalsvis',
  'halvårlig', 'halvarlig', 'arlig', 'årlig', 'aarlig', 'ad_hoc',
]
const CADENCE_DISPLAY: Record<string, string> = {
  daglig: 'Daglig', ukentlig: 'Ukentlig', månedlig: 'Månedlig',
  kvartalsvis: 'Kvartalsvis', halvårlig: 'Halvårlig', halvarlig: 'Halvårlig',
  arlig: 'Årlig', aarlig: 'Årlig', ad_hoc: 'Ved hendelse',
}

function TemplatesTimeline({
  items,
  categoryNameById,
  onOpen,
}: {
  items: ComplianceTemplateRow[]
  categoryNameById: Map<string, string>
  onOpen: (t: ComplianceTemplateRow) => void
}) {
  const groups = useMemo(() => {
    const g = new Map<string, ComplianceTemplateRow[]>()
    for (const t of items) {
      const key = (t.cadence_hint?.toLowerCase() ?? 'ad_hoc').trim()
      const list = g.get(key) ?? []
      list.push(t)
      g.set(key, list)
    }
    return [...g.keys()]
      .sort((a, b) => {
        const ia = CADENCE_ORDER.indexOf(a)
        const ib = CADENCE_ORDER.indexOf(b)
        if (ia >= 0 && ib >= 0) return ia - ib
        if (ia >= 0) return -1
        if (ib >= 0) return 1
        return a.localeCompare(b, 'nb')
      })
      .map((k) => ({ key: k, label: CADENCE_DISPLAY[k] ?? k, items: g.get(k)! }))
  }, [items])

  if (groups.length === 0) {
    return <div className="py-16 text-center text-sm text-neutral-500">Ingen maler.</div>
  }

  return (
    <div className="relative max-w-4xl">
      <div className="absolute bottom-0 left-[91px] top-8 w-0.5 bg-neutral-200" />
      {groups.map((g) => (
        <div key={g.key} className="relative mb-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="w-20 text-right">
              <div className="text-sm font-semibold text-neutral-900">{g.label}</div>
              <div className="text-xs text-neutral-500">{g.items.length} maler</div>
            </div>
            <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#F9F7F2] bg-[#1a3d32] text-white">
              <Clock className="h-3 w-3" />
            </div>
            <div className="flex-1 border-t border-neutral-200" />
          </div>
          <div className="ml-28 grid gap-2 sm:grid-cols-2">
            {g.items.map((t) => (
              <button
                key={t.id}
                onClick={() => onOpen(t)}
                className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-neutral-300"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0f5f3] text-[#1a3d32]">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-neutral-900">{t.name}</div>
                  <div className="text-xs text-neutral-500">
                    {t.category_id ? (categoryNameById.get(t.category_id) ?? '—') : '—'}
                  </div>
                </div>
                {t.review_status === 'approved' ? <Badge variant="success">Off.</Badge> : null}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export function ChecklistsMalerPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<ViewMode>('list')
  const [q, setQ] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [filterPack, setFilterPack] = useState<string | null>(null)

  const licensedPacks = useLicensedPacks()
  const { supabase } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })

  useEffect(() => {
    void cl.load()
  }, [cl])

  const categoryNameById = useMemo(
    () => new Map(cl.categories.map((c) => [c.id, c.name])),
    [cl.categories],
  )

  const filtered = useMemo(() => {
    let list = cl.templates.filter((t) => t.is_active)
    if (q) list = list.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()))
    if (filterStatus === 'approved') list = list.filter((t) => t.review_status === 'approved')
    if (filterStatus === 'reviewed') list = list.filter((t) => t.review_status === 'reviewed')
    if (filterStatus === 'pinned') list = list.filter((t) => t.nav_pinned)
    if (filterPack) list = list.filter((t) => t.pack === filterPack)
    return list
  }, [cl.templates, q, filterStatus, filterPack])

  const STATUS_OPTS = [
    { id: 'approved', label: 'Offisiell' },
    { id: 'reviewed', label: 'Verifisert' },
    { id: 'pinned', label: 'Festet' },
  ]
  const PACK_OPTS = licensedPacks.map((p) => ({ id: p.slug, label: p.shortName }))

  function openTemplate(t: ComplianceTemplateRow) {
    navigate(
      `/compliance/checklists?template=${encodeURIComponent(t.slug)}&pack=${encodeURIComponent(t.pack)}`,
    )
  }

  function handleExport() {
    const rows = [
      ['Mal', 'Kategori', 'Pakke', 'Frekvens', 'Status'],
      ...filtered.map((t) => [
        t.name,
        t.category_id ? (categoryNameById.get(t.category_id) ?? '') : '',
        t.pack,
        t.cadence_hint ?? '',
        t.review_status,
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'sjekkliste-maler.csv'
    a.click()
  }

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <PageHeader
        title="Alle maler"
        count={filtered.length}
        mode={mode}
        setMode={setMode}
        onExport={handleExport}
        onNew={() => navigate('/admin/settings/compliance')}
      />

      {/* Filter bar */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-6 py-3 md:px-10">
          <div
            className="flex flex-1 items-center gap-2 rounded border border-neutral-300 bg-white px-2.5 py-1.5"
            style={{ minWidth: 200, maxWidth: 320 }}
          >
            <svg className="h-3.5 w-3.5 shrink-0 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk i maler…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
          </div>
          <select
            value={filterStatus ?? ''}
            onChange={(e) => setFilterStatus(e.target.value || null)}
            className="rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 outline-none"
          >
            <option value="">Status: Alle</option>
            {STATUS_OPTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {PACK_OPTS.length > 1 && (
            <select
              value={filterPack ?? ''}
              onChange={(e) => setFilterPack(e.target.value || null)}
              className="rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 outline-none"
            >
              <option value="">Pakke: Alle</option>
              {PACK_OPTS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {(q || filterStatus || filterPack) && (
            <button
              onClick={() => {
                setQ('')
                setFilterStatus(null)
                setFilterPack(null)
              }}
              className="text-xs text-neutral-400 hover:text-neutral-600"
            >
              Nullstill
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1400px] px-6 py-6 md:px-10">
        {mode === 'list' && (
          <TemplatesList
            items={filtered}
            categoryNameById={categoryNameById}
            onOpen={openTemplate}
          />
        )}
        {mode === 'board' && (
          <TemplatesBoard items={filtered} packs={licensedPacks} onOpen={openTemplate} />
        )}
        {mode === 'timeline' && (
          <TemplatesTimeline
            items={filtered}
            categoryNameById={categoryNameById}
            onOpen={openTemplate}
          />
        )}
      </div>
    </div>
  )
}
