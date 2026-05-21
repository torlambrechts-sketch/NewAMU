// ChecklistsAktivitetPage — "Alle aktivitet" — full execution log.
//
// Three views: Tidslinje (default, day-grouped vertical timeline) · Liste
// (dense audit table) · Tavle (kanban by status). Accessible from the
// Bibliotek page via "Se all aktivitet →" and from the sidebar.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ChevronRight, LayoutGrid, ListChecks, Search } from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
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

function statusBadge(status: string) {
  if (status === 'signed') return 'signed'
  if (status === 'active') return 'active'
  return 'draft'
}

function ViewToggle({ mode, setMode }: { mode: ViewMode; setMode: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-neutral-100 p-1 gap-0.5">
      {(
        [
          { id: 'timeline', label: 'Tidslinje', LucideIcon: Activity },
          { id: 'list', label: 'Liste', LucideIcon: ListChecks },
          { id: 'board', label: 'Tavle', LucideIcon: LayoutGrid },
        ] as const
      ).map((m) => (
        <button
          key={m.id}
          onClick={() => setMode(m.id)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
            mode === m.id
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-800'
          }`}
        >
          <m.LucideIcon className="h-3.5 w-3.5" />
          {m.label}
        </button>
      ))}
    </div>
  )
}

// Timeline view — vertical, grouped by day
function ActivityTimeline({
  items,
  templateNameById,
  onOpen,
}: {
  items: ComplianceExecutionRow[]
  templateNameById: Map<string, string>
  onOpen: (e: ComplianceExecutionRow) => void
}) {
  const now = useMemo(() => new Date(), [])
  const todayStart = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
    [now],
  )
  const yesterdayStart = todayStart - 86400000

  const days = useMemo(() => {
    const g = new Map<
      string,
      { label: string; date: string; items: ComplianceExecutionRow[] }
    >()
    for (const e of items) {
      const d = new Date(e.updated_at)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const isToday = dayStart === todayStart
      const isYesterday = dayStart === yesterdayStart
      const key = String(dayStart)
      const label = isToday
        ? 'I dag'
        : isYesterday
          ? 'I går'
          : d.toLocaleDateString('nb-NO', { weekday: 'long' })
      const dateStr = d.toLocaleDateString('nb-NO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      const existing = g.get(key) ?? { label, date: dateStr, items: [] }
      existing.items.push(e)
      g.set(key, existing)
    }
    return [...g.entries()]
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([, v]) => v)
  }, [items, todayStart, yesterdayStart])

  if (days.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-neutral-500">Ingen aktivitet.</div>
    )
  }

  return (
    <div className="relative max-w-2xl">
      {/* Vertical line */}
      <div className="absolute left-[89px] top-8 bottom-0 w-0.5 bg-neutral-200" />
      {days.map((day) => (
        <div key={day.date} className="relative mb-7">
          {/* Day label + dot */}
          <div className="mb-3 flex items-center gap-3">
            <div className="w-20 text-right">
              <div className="text-sm font-semibold text-neutral-900">{day.label}</div>
              <div className="text-xs text-neutral-500">{day.date}</div>
            </div>
            <div className="relative z-10 h-[18px] w-[18px] rounded-full border-2 border-[#F9F7F2] bg-[#1a3d32]" />
            <div className="flex-1 border-t border-neutral-200" />
            <span className="text-xs text-neutral-400">{day.items.length} hendelser</span>
          </div>

          {/* Event cards */}
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
                      {tpl ? (
                        <span className="text-neutral-500"> · {tpl}</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {new Date(e.updated_at).toLocaleTimeString('nb-NO', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <Badge variant={statusBadge(e.status)}>
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

// List view — dense audit table
function ActivityList({
  items,
  templateNameById,
  onOpen,
}: {
  items: ComplianceExecutionRow[]
  templateNameById: Map<string, string>
  onOpen: (e: ComplianceExecutionRow) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      {/* Desktop header */}
      <div className="hidden grid-cols-[2fr_1.5fr_1fr_1fr_100px_36px] gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500 sm:grid">
        <span>Tittel</span>
        <span>Mal</span>
        <span>Pakke</span>
        <span>Status</span>
        <span>Dato</span>
        <span />
      </div>

      {/* Rows */}
      {items.map((e) => (
        <button
          key={e.id}
          onClick={() => onOpen(e)}
          className="hidden w-full grid-cols-[2fr_1.5fr_1fr_1fr_100px_36px] items-center gap-3 border-t border-neutral-100 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50 first:border-t-0 sm:grid"
        >
          <span className="truncate font-semibold text-neutral-900">{e.title}</span>
          <span className="truncate text-xs text-neutral-600">
            {templateNameById.get(e.template_id) ?? '—'}
          </span>
          <span className="text-xs text-neutral-600">{e.pack}</span>
          <span>
            <Badge variant={statusBadge(e.status)}>
              {STATUS_LABEL[e.status] ?? e.status}
            </Badge>
          </span>
          <span className="text-xs tabular-nums text-neutral-500">
            {new Date(e.updated_at).toLocaleDateString('nb-NO', { dateStyle: 'short' })}
          </span>
          <span className="text-neutral-300">
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
      ))}

      {/* Mobile rows */}
      {items.map((e) => (
        <button
          key={`m-${e.id}`}
          onClick={() => onOpen(e)}
          className="flex w-full items-center gap-3 border-t border-neutral-100 px-4 py-3 text-left transition-colors hover:bg-neutral-50 sm:hidden"
        >
          <span className="flex-1 text-sm font-medium text-neutral-900">{e.title}</span>
          <Badge variant={statusBadge(e.status)}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
          <ChevronRight className="h-4 w-4 text-neutral-300" />
        </button>
      ))}

      {items.length === 0 && (
        <div className="px-4 py-12 text-center text-sm text-neutral-500">Ingen aktivitet.</div>
      )}
    </div>
  )
}

// Board view — kanban by status
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
      <div className="grid grid-cols-3 gap-4 min-w-[700px]">
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

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Sjekklister', to: '/compliance/checklists' },
        { label: 'Bibliotek', to: '/compliance/checklists/bibliotek' },
        { label: 'Alle aktivitet' },
      ]}
      title="All aktivitet"
      description={`${filtered.length} aktiviteter — søkbar logg over alle sjekklistegjennomganger.`}
      headerActions={
        <div className="flex items-center gap-2">
          <ViewToggle mode={mode} setMode={setMode} />
          {mode === 'list' && (
            <Button variant="secondary" size="sm">
              Eksporter CSV
            </Button>
          )}
        </div>
      }
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <div
          className="flex flex-1 items-center gap-2 rounded border border-neutral-300 px-2.5 py-1.5"
          style={{ minWidth: 220, maxWidth: 300 }}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
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
          className="rounded border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 outline-none"
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
            className="rounded border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 outline-none"
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
    </ModulePageShell>
  )
}
