// ChecklistsEtterlevelsePage — compliance heatmap: locations × categories.
// Rows = org locations. Columns = active checklist categories.
// Each cell shows the latest execution's compliance state for that combination.
// Mirrors EtterlevelseView from the design pack, driven by real DB data.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CircleDot,
  Clock,
  ClipboardList,
  Flame,
  FlaskConical,
  LayoutGrid,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import { Button } from '../../src/components/ui/Button'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from './useChecklistModule'
import { ComplianceCreateForm } from './ComplianceCreateForm'
import type { ComplianceExecutionRow } from './types'

// ── Types ─────────────────────────────────────────────────────────────────────

type CellState = 'ok' | 'warning' | 'breach' | 'pending' | 'na'

type Cell = {
  state: CellState
  lastDate: string | null
  executionId: string | null
}

type Selected = { locationId: string; categoryId: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

const SERIF = "'Libre Baskerville', Georgia, serif"
const WARNING_DAYS = 7

function daysUntil(iso: string | null, today: Date): number | null {
  if (!iso) return null
  const d = new Date(iso)
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
  } catch {
    return iso
  }
}

function computeCell(execs: ComplianceExecutionRow[]): Cell {
  if (execs.length === 0) return { state: 'pending', lastDate: null, executionId: null }

  // Sort by most-recently-updated
  const sorted = [...execs].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
  const latest = sorted[0]

  if (latest.status === 'signed') {
    return { state: 'ok', lastDate: latest.signed_at ?? latest.updated_at, executionId: latest.id }
  }

  if (latest.status === 'active' || latest.status === 'draft') {
    const days = daysUntil(latest.scheduled_for, new Date())
    if (days !== null && days < 0) {
      return { state: 'breach', lastDate: latest.scheduled_for, executionId: latest.id }
    }
    if (days !== null && days <= WARNING_DAYS) {
      return { state: 'warning', lastDate: latest.scheduled_for, executionId: latest.id }
    }
    return { state: 'ok', lastDate: latest.scheduled_for, executionId: latest.id }
  }

  return { state: 'pending', lastDate: null, executionId: latest.id }
}

const CELL_STYLE: Record<CellState, { bg: string; ring: string; txt: string }> = {
  ok:      { bg: '#d9ead8', ring: '#bccfb9', txt: '#1a3d32' },
  warning: { bg: '#fef3c7', ring: '#fcd66c', txt: '#854D0E' },
  breach:  { bg: '#fde0db', ring: '#f3a99c', txt: '#991B1B' },
  pending: { bg: '#f5f5f5', ring: '#e5e5e5', txt: '#737373' },
  na:      { bg: 'transparent', ring: 'transparent', txt: '#a3a3a3' },
}

function cellLabel(cell: Cell): string {
  if (cell.state === 'pending') return 'Ikke kjørt'
  if (cell.state === 'na') return '—'
  if (cell.state === 'breach') return `${fmtDate(cell.lastDate)} !`
  return fmtDate(cell.lastDate)
}

function getCategoryIcon(name: string): LucideIcon {
  const n = name.toLowerCase()
  if (n.includes('brann')) return Flame
  if (n.includes('maskin') || n.includes('truck') || n.includes('løft')) return Truck
  if (n.includes('bygg') || n.includes('bygnin')) return Building2
  if (n.includes('stoff') || n.includes('kjemikalie')) return FlaskConical
  if (n.includes('verne') || n.includes('hms')) return ShieldCheck
  return ClipboardList
}

// ── Cadence health helpers ────────────────────────────────────────────────────

const CADENCE_DAYS: Record<string, number> = {
  månedlig: 30,
  kvartalsvis: 90,
  halvårlig: 180,
  'halvårlig (hvert AMU-møte)': 90,
  årlig: 365,
}

function cadenceDays(hint: string | null | undefined): number | null {
  if (!hint) return null
  // Event-driven templates (ved ...) have no fixed frequency
  if (hint.startsWith('ved ')) return null
  return CADENCE_DAYS[hint.toLowerCase()] ?? null
}

type CadenceStatus = 'ok' | 'amber' | 'red' | 'never'

type CadenceItem = {
  id: string
  name: string
  cadenceHint: string | null
  lastSignedAt: string | null
  daysOverdue: number | null
  status: CadenceStatus
}

// ── KPI row (matches design) ──────────────────────────────────────────────────

const CREAM = '#F1ECDF'

function KpiRow({ items }: { items: { big: string; title: string; sub: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it, i) => (
        <div key={i} className="min-w-0 rounded-xl px-4 py-4 sm:px-5" style={{ backgroundColor: CREAM }}>
          <p className="text-3xl font-bold tabular-nums text-neutral-900">{it.big}</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{it.title}</p>
          <p className="mt-0.5 text-xs text-neutral-600">{it.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: 'easy' | 'advanced'; onChange: (m: 'easy' | 'advanced') => void }) {
  return (
    <div
      role="tablist"
      aria-label="Visningsmodus"
      className="inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-white p-1"
      style={{ boxShadow: '0 1px 1px rgba(0,0,0,0.03)' }}
    >
      {([
        { id: 'easy' as const, label: 'Enkel', Icon: CircleDot },
        { id: 'advanced' as const, label: 'Avansert', Icon: SlidersHorizontal },
      ]).map(({ id, label, Icon }) => {
        const active = mode === id
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={[
              'flex items-center gap-2 rounded-[5px] px-2.5 py-1.5 text-xs font-semibold transition-colors',
              active ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:text-neutral-900',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ChecklistsEtterlevelsePage() {
  const navigate = useNavigate()
  const orgSetup = useOrgSetupContext()
  const { supabase, locations } = orgSetup
  const cl = useChecklistModule({ supabase })
  const { load } = cl

  const [mode, setMode] = useState<'easy' | 'advanced'>('advanced')
  const [selected, setSelected] = useState<Selected | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [startCategoryId, setStartCategoryId] = useState<string | null>(null)

  const easy = mode === 'easy'

  useEffect(() => { void load() }, [load])

  // Active categories used as columns
  const columns = useMemo(
    () => cl.categories.filter((c) => c.is_active && !c.deleted_at),
    [cl.categories],
  )

  // Template IDs per category
  const tplIdsByCategory = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const tpl of cl.templates) {
      if (!tpl.is_active || !tpl.category_id) continue
      const s = m.get(tpl.category_id) ?? new Set<string>()
      s.add(tpl.id)
      m.set(tpl.category_id, s)
    }
    return m
  }, [cl.templates])

  // Build cell matrix: Map<locationId_categoryId, Cell>
  const cellMatrix = useMemo(() => {
    const m = new Map<string, Cell>()
    for (const loc of locations) {
      for (const col of columns) {
        const tplIds = tplIdsByCategory.get(col.id) ?? new Set<string>()
        if (tplIds.size === 0) {
          m.set(`${loc.id}:${col.id}`, { state: 'na', lastDate: null, executionId: null })
          continue
        }
        const execs = cl.executions.filter(
          (e) => e.location_id === loc.id && tplIds.has(e.template_id),
        )
        m.set(`${loc.id}:${col.id}`, computeCell(execs))
      }
    }
    return m
  }, [locations, columns, cl.executions, tplIdsByCategory])

  // KPI totals
  const { ok, breach, warning, pending, applicable } = useMemo(() => {
    const all = Array.from(cellMatrix.values())
    const app = all.filter((c) => c.state !== 'na')
    return {
      applicable: app.length,
      ok: app.filter((c) => c.state === 'ok').length,
      breach: app.filter((c) => c.state === 'breach').length,
      warning: app.filter((c) => c.state === 'warning').length,
      pending: app.filter((c) => c.state === 'pending').length,
    }
  }, [cellMatrix])

  const compliancePct = applicable > 0 ? Math.round((ok / applicable) * 100) : 0

  // Cadence health: for each active template compute overdue status.
  // today is captured fresh per render so cadence calculations are correct
  // in long-running sessions that span midnight.
  const cadenceItems = useMemo<CadenceItem[]>(() => {
    const today = new Date()
    return cl.templates
      .filter((t) => t.is_active)
      .map((t) => {
        const maxDays = cadenceDays(t.cadence_hint)
        const signed = cl.executions
          .filter((e) => e.template_id === t.id && e.status === 'signed' && e.signed_at)
          .sort((a, b) => new Date(b.signed_at!).getTime() - new Date(a.signed_at!).getTime())
        const last = signed[0]?.signed_at ?? null

        if (maxDays === null) {
          return { id: t.id, name: t.name, cadenceHint: t.cadence_hint, lastSignedAt: last, daysOverdue: null, status: last ? 'ok' : 'never' as CadenceStatus }
        }
        if (!last) {
          return { id: t.id, name: t.name, cadenceHint: t.cadence_hint, lastSignedAt: null, daysOverdue: null, status: 'never' as CadenceStatus }
        }
        const daysSince = Math.floor((today.getTime() - new Date(last).getTime()) / 86_400_000)
        const overdue = daysSince - maxDays
        const status: CadenceStatus =
          overdue > 0 ? 'red' : overdue > -(maxDays * 0.15) ? 'amber' : 'ok'
        return { id: t.id, name: t.name, cadenceHint: t.cadence_hint, lastSignedAt: last, daysOverdue: overdue > 0 ? overdue : null, status }
      })
      .sort((a, b) => {
        const order = { red: 0, never: 1, amber: 2, ok: 3 }
        return order[a.status] - order[b.status]
      })
  }, [cl.templates, cl.executions])

  const cadenceRed = cadenceItems.filter((i) => i.status === 'red').length
  const cadenceAmber = cadenceItems.filter((i) => i.status === 'amber').length
  const cadenceNever = cadenceItems.filter((i) => i.status === 'never').length

  // Selected cell detail
  const selectedCell = selected ? cellMatrix.get(`${selected.locationId}:${selected.categoryId}`) : null
  const selectedLocation = selected ? locations.find((l) => l.id === selected.locationId) : null
  const selectedCategory = selected ? columns.find((c) => c.id === selected.categoryId) : null
  const selectedExecution = selectedCell?.executionId
    ? cl.executions.find((e) => e.id === selectedCell.executionId) ?? null
    : null

  // Template for "Kjør nå"
  const startTemplateId = useMemo(() => {
    if (!startCategoryId) return undefined
    const tplIds = tplIdsByCategory.get(startCategoryId)
    if (!tplIds) return undefined
    const tpl = cl.templates.find((t) => tplIds.has(t.id) && t.is_active)
    return tpl?.id
  }, [startCategoryId, tplIdsByCategory, cl.templates])

  const SelectedCategoryIcon = selectedCategory ? getCategoryIcon(selectedCategory.name) : LayoutGrid

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'HMS' },
        { label: 'Sjekklister', to: '/compliance/checklists' },
        { label: 'Etterlevelse' },
      ]}
      title="Etterlevelse — sjekklister"
      description={easy
        ? 'Oversikt over hva som er på plass på tvers av lokasjoner.'
        : 'Matrise av lokasjon × kategori. Klikk en celle for å se detaljer og starte en gjennomføring.'}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate('/compliance/checklists')}
          >
            Tilbake
          </Button>
          <ModeToggle mode={mode} onChange={setMode} />
          <Button
            variant="primary"
            icon={<Play className="h-4 w-4" />}
            onClick={() => { setStartCategoryId(null); setCreateOpen(true) }}
          >
            Ny gjennomføring
          </Button>
        </div>
      }
    >
      {/* KPIs */}
      <KpiRow items={[
        { big: `${compliancePct}%`, title: 'Etterlevelse', sub: `${ok} av ${applicable} kombinasjoner i tide` },
        { big: String(breach), title: 'Brudd', sub: breach === 0 ? 'Ingen forsinket' : 'Krever umiddelbar handling' },
        { big: String(warning), title: 'Nær frist', sub: `Forfaller innen ${WARNING_DAYS} dager` },
        { big: String(pending), title: 'Ikke startet', sub: 'Aldri kjørt på lokasjonen' },
      ]} />

      {locations.length === 0 || columns.length === 0 ? (
        <ModuleSectionCard className="p-8 text-center text-sm text-neutral-500">
          {locations.length === 0
            ? 'Ingen lokasjoner konfigurert. Legg til lokasjoner under Innstillinger.'
            : 'Ingen aktive kategorier. Opprett kategorier under Innstillinger → Sjekklister.'}
        </ModuleSectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">

          {/* ── Matrix ── */}
          <div className="rounded-xl border border-neutral-200/80 bg-white p-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div className="flex items-end justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Matrise</h3>
              {!easy && (
                <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                  {([ ['#d9ead8','#bccfb9','I tide'], ['#fef3c7','#fcd66c','Nær frist'], ['#fde0db','#f3a99c','Brudd'], ['#f5f5f5','#e5e5e5','Ikke kjørt'] ] as [string,string,string][]).map(([bg, ring, label]) => (
                    <span key={label} className="inline-flex items-center gap-1">
                      <span className="h-3 w-3 rounded-sm" style={{ background: bg, boxShadow: `inset 0 0 0 1px ${ring}` }} />
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 overflow-x-auto rounded-md border border-neutral-200/80">
              <table className="w-full min-w-[480px] border-collapse text-xs">
                <thead>
                  <tr className="bg-[#fbf9f3]">
                    <th className="w-44 border-b border-neutral-200 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                      Lokasjon
                    </th>
                    {columns.map((col) => {
                      const Icon = getCategoryIcon(col.name)
                      return (
                        <th
                          key={col.id}
                          className="border-b border-l border-neutral-200 px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600"
                          style={{ minWidth: 120 }}
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3 w-3 text-[#1a3d32]" aria-hidden />
                            <span className="truncate">{col.name}</span>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc) => (
                    <tr key={loc.id} className="border-b border-neutral-100 last:border-b-0">
                      <td className="px-3 py-2">
                        <div className="text-[12px] font-medium text-neutral-900">{loc.name}</div>
                      </td>
                      {columns.map((col) => {
                        const cell = cellMatrix.get(`${loc.id}:${col.id}`) ?? { state: 'na' as const, lastDate: null, executionId: null }
                        const isSel = selected?.locationId === loc.id && selected?.categoryId === col.id
                        const s = CELL_STYLE[cell.state]
                        return (
                          <td key={col.id} className="border-l border-neutral-100 p-1.5 align-top">
                            <button
                              type="button"
                              onClick={() => setSelected(cell.state === 'na' ? null : { locationId: loc.id, categoryId: col.id })}
                              disabled={cell.state === 'na'}
                              className="block w-full rounded-md p-2 text-left transition-shadow disabled:cursor-default"
                              style={{
                                background: cell.state === 'na' ? 'transparent' : s.bg,
                                backgroundImage: cell.state === 'na' ? 'repeating-linear-gradient(45deg, #e5e5e5 0 2px, transparent 2px 5px)' : undefined,
                                boxShadow: cell.state === 'na'
                                  ? 'none'
                                  : isSel
                                  ? '0 0 0 2px #1a3d32, 0 0 0 4px rgba(26,61,50,0.15)'
                                  : `inset 0 0 0 1px ${s.ring}`,
                              }}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] font-semibold tabular-nums" style={{ color: s.txt }}>
                                  {cellLabel(cell)}
                                </span>
                                {cell.state === 'breach' && (
                                  <AlertCircle className="h-3 w-3 shrink-0" style={{ color: s.txt }} aria-hidden />
                                )}
                              </div>
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Drilldown sidebar ── */}
          <aside className="space-y-3">
            {selected && selectedCell && selectedCategory && selectedLocation ? (
              <>
                <div className="rounded-xl border border-neutral-200/80 bg-white p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Detalj</div>
                  <div className="mt-2 flex items-start gap-2">
                    <SelectedCategoryIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#1a3d32]" aria-hidden />
                    <div>
                      <div className="text-base font-semibold leading-tight text-neutral-900" style={{ fontFamily: SERIF }}>
                        {selectedCategory.name}
                      </div>
                      <div className="text-xs text-neutral-600">{selectedLocation.name}</div>
                    </div>
                  </div>

                  <div
                    className="mt-3 rounded-md p-3"
                    style={{ background: CELL_STYLE[selectedCell.state].bg }}
                  >
                    <div
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: CELL_STYLE[selectedCell.state].txt }}
                    >
                      Status
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-neutral-900">
                      {selectedCell.state === 'breach'
                        ? `Brudd — frist passert ${fmtDate(selectedCell.lastDate)}`
                        : selectedCell.state === 'warning'
                        ? `Nær frist — forfaller ${fmtDate(selectedCell.lastDate)}`
                        : selectedCell.state === 'ok'
                        ? `I tide — sist kjørt ${fmtDate(selectedCell.lastDate)}`
                        : 'Aldri kjørt på denne lokasjonen'}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {selectedExecution ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<ClipboardList className="h-3 w-3" />}
                        onClick={() => navigate(`/compliance/checklists/${selectedExecution.id}`)}
                      >
                        Åpne
                      </Button>
                    ) : (
                      <div />
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Play className="h-3 w-3" />}
                      onClick={() => {
                        setStartCategoryId(selectedCategory.id)
                        setCreateOpen(true)
                      }}
                    >
                      Kjør nå
                    </Button>
                  </div>
                </div>

                {!easy && selectedCell.state === 'breach' && (
                  <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-700" aria-hidden />
                      <h4 className="text-sm font-semibold text-red-900">Brudd krever handling</h4>
                    </div>
                    <p className="mt-1 text-[11px] text-red-800">
                      Lovpålagt sjekk er ikke gjennomført innen fristen.
                      Start en ny gjennomføring og tildel ansvarlig innen 7 dager.
                    </p>
                    <button
                      type="button"
                      className="mt-2 text-[11px] font-semibold text-red-900 hover:underline"
                      onClick={() => { setStartCategoryId(selectedCategory.id); setCreateOpen(true) }}
                    >
                      Kjør nå ›
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-neutral-200/80 bg-white p-5 text-center" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <ClipboardList className="mx-auto h-6 w-6 text-neutral-300" aria-hidden />
                <p className="mt-2 text-sm text-neutral-500">Velg en celle i matrisen for å se detaljer.</p>
              </div>
            )}

            {!easy && breach > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-700" aria-hidden />
                  <h4 className="text-sm font-semibold text-red-900">{breach} brudd totalt</h4>
                </div>
                <p className="mt-1 text-[11px] text-red-800">
                  Lovpålagte sjekker er ikke gjennomført i tide. Tildel ansvarlig og start gjennomføring for å unngå avvik mot tilsynet.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Cadence health — only shown in advanced mode */}
      {!easy && cadenceItems.length > 0 ? (
        <div className="rounded-xl border border-neutral-200/80 bg-white" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#1a3d32]" aria-hidden />
              <h3 className="text-sm font-semibold text-neutral-900">Kadensehelse</h3>
              <span className="text-xs text-neutral-500">— siste signerte gjennomføring vs. forventet frekvens</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {cadenceRed > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800">{cadenceRed} utgått</span>}
              {cadenceAmber > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">{cadenceAmber} nær</span>}
              {cadenceNever > 0 && <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-600">{cadenceNever} aldri kjørt</span>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/60">
                  <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Mal</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Frekvens</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sist signert</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {cadenceItems.map((item) => {
                  const dot = item.status === 'ok' ? 'bg-green-500' : item.status === 'amber' ? 'bg-amber-400' : item.status === 'red' ? 'bg-red-500' : 'bg-neutral-300'
                  const label =
                    item.status === 'red' ? `Utgått — ${item.daysOverdue} dager siden` :
                    item.status === 'amber' ? 'Nær grensen' :
                    item.status === 'never' ? 'Aldri kjørt' : 'OK'
                  const txtColor =
                    item.status === 'red' ? 'text-red-700' :
                    item.status === 'amber' ? 'text-amber-700' :
                    item.status === 'never' ? 'text-neutral-500' : 'text-green-700'
                  return (
                    <tr key={item.id} className="border-b border-neutral-50 last:border-b-0 hover:bg-neutral-50/50">
                      <td className="px-5 py-2.5 font-medium text-neutral-900">{item.name}</td>
                      <td className="px-4 py-2.5 text-neutral-600 capitalize">{item.cadenceHint ?? '—'}</td>
                      <td className="px-4 py-2.5 tabular-nums text-neutral-600">
                        {item.lastSignedAt ? new Date(item.lastSignedAt).toLocaleDateString('nb-NO') : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
                          <span className={`font-semibold ${txtColor}`}>{label}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <ComplianceCreateForm
        open={createOpen}
        onClose={() => { setCreateOpen(false); setStartCategoryId(null) }}
        templates={cl.templates.filter((t) => t.is_active && (startCategoryId ? t.category_id === startCategoryId : true))}
        assignableUsers={cl.assignableUsers}
        initialTemplateId={startTemplateId}
        onCreate={async (payload) => {
          const id = await cl.createExecution(payload)
          setCreateOpen(false)
          setStartCategoryId(null)
          if (id) navigate(`/compliance/checklists/${id}`)
        }}
      />
    </ModulePageShell>
  )
}
