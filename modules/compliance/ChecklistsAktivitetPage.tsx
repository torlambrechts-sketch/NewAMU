// ChecklistsAktivitetPage — "Alle aktivitet" — full execution log.
//
// Three views: Tidslinje (default, day-grouped vertical) · Liste (audit
// table) · Tavle (kanban by status). View toggle + CSV export always
// visible. Back link to Bibliotek lives in the sticky page header.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowLeft, ChevronRight, Download, LayoutGrid, ListChecks } from 'lucide-react'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { useLicensedPacks } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from './useChecklistModule'
import type { ComplianceExecutionRow } from './types'

type ViewMode = 'timeline' | 'list' | 'board'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Kladd',
  active: 'Pågående',
  signed: 'Fullført',
}

function statusVariant(s: string): 'draft' | 'active' | 'signed' {
  if (s === 'signed') return 'signed'
  if (s === 'active') return 'active'
  return 'draft'
}

// ── Shared view toggle ─────────────────────────────────────────────────────

function ViewToggle({ mode, setMode }: { mode: ViewMode; setMode: (v: ViewMode) => void }) {
  const OPTIONS = [
    { id: 'timeline' as const, label: 'Tidslinje', Icon: Activity },
    { id: 'list' as const, label: 'Liste', Icon: ListChecks },
    { id: 'board' as const, label: 'Tavle', Icon: LayoutGrid },
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

// ── Page header (matches design ShowAllHeader) ─────────────────────────────

function PageHeader({
  title,
  count,
  mode,
  setMode,
  onExport,
}: {
  title: string
  count: number
  mode: ViewMode
  setMode: (v: ViewMode) => void
  onExport: () => void
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
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Timeline view ──────────────────────────────────────────────────────────

function ActivityTimeline({
  items,
  templateNameById,
  onOpen,
}: {
  items: ComplianceExecutionRow[]
  templateNameById: Map<string, string>
  onOpen: (e: ComplianceExecutionRow) => void
}) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000

  const days = useMemo(() => {
    const g = new Map<
      string,
      { label: string; date: string; items: ComplianceExecutionRow[] }
    >()
    for (const e of items) {
      const d = new Date(e.updated_at)
      const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const key = String(ds)
      const label =
        ds === todayStart ? 'I dag' : ds === yesterdayStart ? 'I går' : d.toLocaleDateString('nb-NO', { weekday: 'long' })
      const dateStr = d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
      const existing = g.get(key) ?? { label, date: dateStr, items: [] }
      existing.items.push(e)
      g.set(key, existing)
    }
    return [...g.entries()]
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([, v]) => v)
  }, [items, todayStart, yesterdayStart])

  if (days.length === 0) {
    return <div className="py-16 text-center text-sm text-neutral-500">Ingen aktivitet.</div>
  }

  return (
    <div className="relative max-w-2xl">
      <div className="absolute bottom-0 left-[89px] top-8 w-0.5 bg-neutral-200" />
      {days.map((day) => (
        <div key={day.date} className="relative mb-7">
          <div className="mb-3 flex items-center gap-3">
            <div className="w-20 text-right">
              <div className="text-sm font-semibold text-neutral-900">{day.label}</div>
              <div className="text-xs text-neutral-500">{day.date}</div>
            </div>
            <div className="relative z-10 h-[18px] w-[18px] rounded-full border-2 border-[#F9F7F2] bg-[#1a3d32]" />
            <div className="flex-1 border-t border-neutral-200" />
            <span className="text-xs text-neutral-400">{day.items.length} hendelser</span>
          </div>
          <div className="ml-[110px] flex flex-col gap-2">
            {day.items.map((e) => {
              const tpl = templateNameById.get(e.template_id)
              return (
                <button
                  key={e.id}
                  onClick={() => onOpen(e)}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-neutral-300"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a3d32] text-[10px] font-bold text-white">
                    {(e.title.slice(0, 2) || '??').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-neutral-800">
                      <span className="font-medium text-neutral-900">{e.title}</span>
                      {tpl ? <span className="text-neutral-500"> · {tpl}</span> : null}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {new Date(e.updated_at).toLocaleTimeString('nb-NO', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <Badge variant={statusVariant(e.status)}>
                    {STATUS_LABEL[e.status] ?? e.status}
                  </Badge>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── List view — proper <table> for reliable column alignment ───────────────

function ActivityList({
  items,
  templateNameById,
  categoryNameById,
  templateCategoryById,
  onOpen,
}: {
  items: ComplianceExecutionRow[]
  templateNameById: Map<string, string>
  categoryNameById: Map<string, string>
  templateCategoryById: Map<string, string | null>
  onOpen: (e: ComplianceExecutionRow) => void
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white py-16 text-center text-sm text-neutral-500 shadow-sm">
        Ingen aktivitet.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              {['Tittel', 'Mal', 'Kategori', 'Status', 'Dato', ''].map((h, i) => (
                <th
                  key={i}
                  className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-neutral-500 ${
                    i === 5 ? 'w-8' : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((e) => {
              const tplName = templateNameById.get(e.template_id) ?? '—'
              const catId = templateCategoryById.get(e.template_id) ?? null
              const catName = catId ? (categoryNameById.get(catId) ?? '—') : '—'
              return (
                <tr
                  key={e.id}
                  onClick={() => onOpen(e)}
                  className="cursor-pointer border-t border-neutral-100 transition-colors hover:bg-neutral-50"
                >
                  <td className="px-4 py-2.5 font-semibold text-neutral-900">{e.title}</td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-xs text-neutral-600">
                    {tplName}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-600">{catName}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusVariant(e.status)}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs tabular-nums text-neutral-500">
                    {new Date(e.updated_at).toLocaleDateString('nb-NO', { dateStyle: 'short' })}
                  </td>
                  <td className="w-8 px-4 py-2.5 text-neutral-300">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Board view — kanban by status ──────────────────────────────────────────

function ActivityBoard({
  items,
  templateNameById,
  onOpen,
}: {
  items: ComplianceExecutionRow[]
  templateNameById: Map<string, string>
  onOpen: (e: ComplianceExecutionRow) => void
}) {
  const cols = [
    { id: 'draft', label: 'Kladd', color: '#737373', statuses: ['draft'] },
    { id: 'active', label: 'Pågående', color: '#c98a2b', statuses: ['active'] },
    { id: 'signed', label: 'Fullført', color: '#2f7757', statuses: ['signed'] },
  ]

  return (
    <div className="overflow-x-auto pb-4">
      <div className="grid min-w-[700px] grid-cols-3 gap-4">
        {cols.map((c) => {
          const list = items.filter((e) => c.statuses.includes(e.status))
          return (
            <div key={c.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                <span className="text-xs font-bold uppercase tracking-wide text-neutral-800">
                  {c.label}
                </span>
                <span className="ml-auto rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-neutral-600">
                  {list.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {list.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onOpen(e)}
                    className="rounded-lg border border-neutral-200 bg-white p-2.5 text-left shadow-[0_1px_1px_rgba(0,0,0,0.03)] transition-colors hover:border-neutral-300"
                    style={{ borderLeft: `3px solid ${c.color}` }}
                  >
                    <div className="mb-1 text-xs font-semibold leading-tight text-neutral-900">
                      {e.title}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {templateNameById.get(e.template_id) ?? e.pack}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-1.5">
                      <span className="text-[10px] text-neutral-500">
                        {new Date(e.updated_at).toLocaleDateString('nb-NO', {
                          dateStyle: 'short',
                        })}
                      </span>
                    </div>
                  </button>
                ))}
                {list.length === 0 && (
                  <div className="px-2 py-4 text-center text-xs text-neutral-400">
                    Ingen poster
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

// ── Page ───────────────────────────────────────────────────────────────────

export function ChecklistsAktivitetPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<ViewMode>('timeline')
  const [q, setQ] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [filterPack, setFilterPack] = useState<string | null>(null)

  const licensedPacks = useLicensedPacks()
  const { supabase } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })

  useEffect(() => {
    void cl.load()
  }, [cl])

  const templateNameById = useMemo(
    () => new Map(cl.templates.map((t) => [t.id, t.name])),
    [cl.templates],
  )
  const categoryNameById = useMemo(
    () => new Map(cl.categories.map((c) => [c.id, c.name])),
    [cl.categories],
  )
  const templateCategoryById = useMemo(
    () => new Map(cl.templates.map((t) => [t.id, t.category_id])),
    [cl.templates],
  )

  const filtered = useMemo(() => {
    let list = [...cl.executions].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    if (q)
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q.toLowerCase()) ||
          (templateNameById.get(e.template_id) ?? '').toLowerCase().includes(q.toLowerCase()),
      )
    if (filterStatus) list = list.filter((e) => e.status === filterStatus)
    if (filterPack) list = list.filter((e) => e.pack === filterPack)
    return list
  }, [cl.executions, q, filterStatus, filterPack, templateNameById])

  const PACK_OPTS = licensedPacks.map((p) => ({ id: p.slug, label: p.shortName }))
  const STATUS_OPTS = [
    { id: 'active', label: 'Pågående' },
    { id: 'signed', label: 'Fullført' },
    { id: 'draft', label: 'Kladd' },
  ]

  function handleExport() {
    const rows = [
      ['Tittel', 'Mal', 'Pakke', 'Status', 'Dato'],
      ...filtered.map((e) => [
        e.title,
        templateNameById.get(e.template_id) ?? '',
        e.pack,
        STATUS_LABEL[e.status] ?? e.status,
        new Date(e.updated_at).toLocaleDateString('nb-NO'),
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'sjekkliste-aktivitet.csv'
    a.click()
  }

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <PageHeader
        title="All aktivitet"
        count={filtered.length}
        mode={mode}
        setMode={setMode}
        onExport={handleExport}
      />

      {/* Filter bar */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-6 py-3 md:px-10">
          <div
            className="flex flex-1 items-center gap-2 rounded border border-neutral-300 bg-white px-2.5 py-1.5"
            style={{ minWidth: 200, maxWidth: 300 }}
          >
            <svg className="h-3.5 w-3.5 shrink-0 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk i logg…"
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
        {mode === 'timeline' && (
          <ActivityTimeline
            items={filtered}
            templateNameById={templateNameById}
            onOpen={(e) => navigate(`/compliance/checklists/${e.id}`)}
          />
        )}
        {mode === 'list' && (
          <ActivityList
            items={filtered}
            templateNameById={templateNameById}
            categoryNameById={categoryNameById}
            templateCategoryById={templateCategoryById}
            onOpen={(e) => navigate(`/compliance/checklists/${e.id}`)}
          />
        )}
        {mode === 'board' && (
          <ActivityBoard
            items={filtered}
            templateNameById={templateNameById}
            onOpen={(e) => navigate(`/compliance/checklists/${e.id}`)}
          />
        )}
      </div>
    </div>
  )
}
