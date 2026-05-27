// PlanningKadensSection — Kadens-planlegger (wizard) for /planlegging.
//
// Fire steg:
//   1. Omfang — kategorier + lovverk
//   2. Krav & oppgaver — velg fra biblioteket, overstyr frekvens/eier
//   3. Bemanning — sett global eier + oppstart + påminnelser
//   4. Gjennomgang & bekreft — opprett task_items med recurrence
//
// Hvert valgte bibliotek-item ender opp som en vedvarende rutine i
// task_items (recurrence_active=true + recurrence_interval_days).

import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Download,
  GitBranch,
  LayoutGrid,
  ListChecks,
  Lock,
  Pencil,
  Search,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react'
import { Initials } from '../../components/ui/elearningPrimitives'
import { Button } from '../../components/ui/Button'
import { CADENCE_LIBRARY, type CadenceLibraryItem } from './cadenceLibrary'
import {
  CADENCE_CATEGORY_META,
  CADENCE_ORIGIN_META,
  FREQ_OPTIONS,
  OWNER_OPTIONS,
  type CadenceCategoryId,
  type CadenceOriginId,
} from './planningConstants'

type Override = Partial<Pick<CadenceLibraryItem, 'freq' | 'frequencyN' | 'owner' | 'intervalDays'>>
type Overrides = Record<string, Override>

type Props = {
  /** Called when user finishes step 4 — translates selected items into task_items. */
  onCommit: (items: CadenceLibraryItem[]) => Promise<void>
  /** Currently-committing flag → disables next-button. */
  committing?: boolean
  /** Optional banner shown once commit completes. */
  banner?: string | null
  onDismissBanner?: () => void
}

export function PlanningKadensSection({ onCommit, committing, banner, onDismissBanner }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [scope, setScope] = useState<Record<CadenceCategoryId, boolean>>(
    Object.fromEntries(Object.keys(CADENCE_CATEGORY_META).map((k) => [k, true])) as Record<
      CadenceCategoryId,
      boolean
    >,
  )
  const [origins, setOrigins] = useState<Record<CadenceOriginId, boolean>>(
    Object.fromEntries(Object.keys(CADENCE_ORIGIN_META).map((k) => [k, true])) as Record<
      CadenceOriginId,
      boolean
    >,
  )
  const [planMap, setPlanMap] = useState<Record<string, boolean>>(
    Object.fromEntries(CADENCE_LIBRARY.map((c) => [c.id, c.recommended])),
  )
  const [overrides, setOverrides] = useState<Overrides>({})
  const [search, setSearch] = useState('')
  const [recommendedOnly, setRecommendedOnly] = useState(false)

  // Step 3 settings.
  const [defaultOwner, setDefaultOwner] = useState('HMS-leder')
  const [startQuarter, setStartQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q2')
  const [reminders, setReminders] = useState({ d14: true, d3: true, daily: false })

  const lib = useMemo<CadenceLibraryItem[]>(
    () =>
      CADENCE_LIBRARY.map((c) => ({ ...c, ...(overrides[c.id] ?? {}) })),
    [overrides],
  )

  const filtered = useMemo(
    () =>
      lib.filter((c) => {
        if (!scope[c.cat]) return false
        if (!origins[c.origin]) return false
        if (recommendedOnly && !c.recommended) return false
        if (search) {
          const q = search.toLowerCase()
          const hay = `${c.title} ${c.ref}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      }),
    [lib, scope, origins, recommendedOnly, search],
  )

  const selected = Object.values(planMap).filter(Boolean).length
  const totalEffort = lib.reduce((sum, c) => sum + (planMap[c.id] ? c.durationH * c.frequencyN : 0), 0)

  const updateOverride = (id: string, patch: Override) => {
    setOverrides((o) => ({ ...o, [id]: { ...(o[id] ?? {}), ...patch } }))
  }

  const togglePlan = (id: string) => setPlanMap((m) => ({ ...m, [id]: !m[id] }))

  const addAllRecommended = () => {
    const next = { ...planMap }
    for (const c of filtered) {
      if (c.recommended) next[c.id] = true
    }
    setPlanMap(next)
  }

  return (
    <div className="space-y-5">
      {banner && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-[12.5px] text-green-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCheck className="h-4 w-4" />
              <span>{banner}</span>
            </div>
            {onDismissBanner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismissBanner}
                className="rounded px-2 py-0.5 text-[10px] font-bold text-green-900 hover:bg-green-100"
              >
                Lukk
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Wizard intro + stepper */}
      <div className="overflow-hidden rounded-2xl border border-[#1a3d32]/15 bg-gradient-to-br from-white via-white to-[#fbf9f3] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-6">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#1a3d32]">
              <Wand2 className="h-3 w-3" />
              Kadens-veiviser
            </div>
            <h2 className="mt-2 font-serif text-2xl font-bold text-neutral-900">
              Bygg planen fra kravene — ikke fra hodet.
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-700">
              Velg hvilke rammeverk og områder du skal etterleve. Vi viser deg alle oppgaver
              lovverk og standarder krever — du velger hva som skal inn i planen, hvem som eier, og
              når det starter.
            </p>
          </div>
          <div className="border-t border-neutral-200/80 bg-white/60 p-6 lg:border-l lg:border-t-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Status
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <div className="text-2xl font-bold tabular-nums text-neutral-900">{selected}</div>
                <div className="text-[10px] text-neutral-500">i plan</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums text-neutral-900">
                  {CADENCE_LIBRARY.length - selected}
                </div>
                <div className="text-[10px] text-neutral-500">tilgjengelig</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums text-neutral-900">
                  {Math.round(totalEffort)}
                </div>
                <div className="text-[10px] text-neutral-500">timer/år estimert</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums text-neutral-900">
                  {CADENCE_LIBRARY.filter((c) => c.recommended && !planMap[c.id]).length}
                </div>
                <div className="text-[10px] text-neutral-500">anbefalt, ikke i plan</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col border-t border-neutral-200/80 bg-white md:flex-row">
          {(
            [
              { id: 1, label: 'Omfang', sub: 'Hvilke områder?', Icon: LayoutGrid },
              { id: 2, label: 'Krav & oppgaver', sub: 'Hva må vi gjøre?', Icon: ListChecks },
              { id: 3, label: 'Bemanning', sub: 'Hvem & når?', Icon: Users },
              { id: 4, label: 'Gjennomgang', sub: 'Bekreft & legg til', Icon: CheckCheck },
            ] as const
          ).map((s, i) => {
            const active = step === s.id
            const done = step > s.id
            return (
              <Button
                key={s.id}
                variant="ghost"
                onClick={() => setStep(s.id as 1 | 2 | 3 | 4)}
                className={[
                  'relative flex flex-1 items-center justify-start gap-3 rounded-none px-5 py-3.5 text-left font-normal normal-case transition-colors',
                  active ? 'bg-[#e7efe9]/60 hover:bg-[#e7efe9]/70' : 'hover:bg-neutral-50',
                  i < 3 ? 'border-b border-neutral-200/80 md:border-b-0 md:border-r' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold',
                    done
                      ? 'bg-[#1a3d32] text-white'
                      : active
                        ? 'bg-[#1a3d32] text-white ring-4 ring-[#1a3d32]/15'
                        : 'bg-neutral-100 text-neutral-500',
                  ].join(' ')}
                >
                  {done ? <Check className="h-4 w-4" /> : <span className="text-sm tabular-nums">{s.id}</span>}
                </span>
                <div>
                  <div
                    className={[
                      'text-[12.5px]',
                      active ? 'font-bold text-neutral-900' : 'font-semibold text-neutral-700',
                    ].join(' ')}
                  >
                    {s.label}
                  </div>
                  <div className="text-[10.5px] text-neutral-500">{s.sub}</div>
                </div>
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a3d32]" />
                )}
              </Button>
            )
          })}
        </div>
      </div>

      {step === 1 && (
        <StepScope
          scope={scope}
          setScope={setScope}
          origins={origins}
          setOrigins={setOrigins}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <StepTasks
          filtered={filtered}
          planMap={planMap}
          togglePlan={togglePlan}
          updateOverride={updateOverride}
          overrides={overrides}
          search={search}
          setSearch={setSearch}
          recommendedOnly={recommendedOnly}
          setRecommendedOnly={setRecommendedOnly}
          addAllRecommended={addAllRecommended}
          onPrev={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepStaffing
          lib={lib}
          planMap={planMap}
          defaultOwner={defaultOwner}
          setDefaultOwner={setDefaultOwner}
          startQuarter={startQuarter}
          setStartQuarter={setStartQuarter}
          reminders={reminders}
          setReminders={setReminders}
          onPrev={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <StepReview
          lib={lib}
          planMap={planMap}
          committing={committing}
          onPrev={() => setStep(3)}
          onCommit={async () => {
            const items = lib.filter((c) => planMap[c.id])
            await onCommit(items)
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Omfang
// ─────────────────────────────────────────────────────────────────────────────

function StepScope({
  scope,
  setScope,
  origins,
  setOrigins,
  onNext,
}: {
  scope: Record<CadenceCategoryId, boolean>
  setScope: (next: Record<CadenceCategoryId, boolean>) => void
  origins: Record<CadenceOriginId, boolean>
  setOrigins: (next: Record<CadenceOriginId, boolean>) => void
  onNext: () => void
}) {
  const setAll = (val: boolean) => {
    setScope(
      Object.fromEntries(Object.keys(CADENCE_CATEGORY_META).map((k) => [k, val])) as Record<
        CadenceCategoryId,
        boolean
      >,
    )
  }
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-neutral-900">1 · Velg omfang</h3>
            <p className="text-[11px] text-neutral-500">
              Hvilke områder skal med? Hak av alt som er relevant — vi viser kun oppgaver innenfor
              scope.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAll(true)}>
              Velg alle
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAll(false)}>
              Fjern alle
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(Object.entries(CADENCE_CATEGORY_META) as Array<[CadenceCategoryId, (typeof CADENCE_CATEGORY_META)[CadenceCategoryId]]>).map(
            ([id, m]) => {
              const Icon = m.icon
              const count = CADENCE_LIBRARY.filter((c) => c.cat === id).length
              const on = scope[id]
              return (
                <Button
                  key={id}
                  variant="ghost"
                  onClick={() => setScope({ ...scope, [id]: !on })}
                  className={[
                    'block w-full rounded-lg border p-4 text-left font-normal normal-case transition-all',
                    on
                      ? 'border-[#1a3d32] bg-[#e7efe9]/40 hover:bg-[#e7efe9]/50'
                      : 'border-neutral-200/80 bg-white hover:border-neutral-300 hover:bg-white',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-md"
                      style={{ background: m.color + '14', color: m.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span
                      className={[
                        'flex h-5 w-5 items-center justify-center rounded border-2',
                        on
                          ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                          : 'border-neutral-300 bg-white',
                      ].join(' ')}
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                  </div>
                  <h4 className="mt-3 text-sm font-semibold text-neutral-900">{m.label}</h4>
                  <p className="mt-1 text-[10.5px] tabular-nums text-neutral-500">
                    {count} oppgaver i biblioteket
                  </p>
                </Button>
              )
            },
          )}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h3 className="font-serif text-lg font-bold text-neutral-900">Lovverk & rammeverk</h3>
          <p className="text-[11px] text-neutral-500">
            Hvilke kilder skal kadensen være forankret i? Påkrevde rammeverk er låst på.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-5 md:grid-cols-4 lg:grid-cols-7">
          {(Object.entries(CADENCE_ORIGIN_META) as Array<[CadenceOriginId, (typeof CADENCE_ORIGIN_META)[CadenceOriginId]]>).map(
            ([id, m]) => {
              const count = CADENCE_LIBRARY.filter((c) => c.origin === id).length
              const on = origins[id]
              const locked = Boolean(m.locked)
              return (
                <Button
                  key={id}
                  variant="ghost"
                  disabled={locked}
                  onClick={() => setOrigins({ ...origins, [id]: !on })}
                  className={[
                    'block w-full rounded-md border p-3 text-left font-normal normal-case transition-all',
                    on
                      ? 'border-current hover:bg-transparent'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50',
                    locked ? 'cursor-not-allowed opacity-90' : '',
                  ].join(' ')}
                  style={
                    on
                      ? { borderColor: m.color + '60', background: m.color + '0e' }
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: m.color }}
                    >
                      {m.label}
                    </span>
                    {locked && <Lock className="h-3 w-3 text-neutral-400" />}
                  </div>
                  <div className="mt-1 text-sm font-bold tabular-nums text-neutral-900">
                    {count}
                  </div>
                  <div className="text-[10px] text-neutral-500">oppgaver</div>
                </Button>
              )
            },
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={onNext} icon={<ArrowRight className="h-4 w-4" />}>
          Til krav & oppgaver
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Krav & oppgaver
// ─────────────────────────────────────────────────────────────────────────────

function StepTasks({
  filtered,
  planMap,
  togglePlan,
  updateOverride,
  overrides,
  search,
  setSearch,
  recommendedOnly,
  setRecommendedOnly,
  addAllRecommended,
  onPrev,
  onNext,
}: {
  filtered: CadenceLibraryItem[]
  planMap: Record<string, boolean>
  togglePlan: (id: string) => void
  updateOverride: (id: string, patch: Override) => void
  overrides: Overrides
  search: string
  setSearch: (v: string) => void
  recommendedOnly: boolean
  setRecommendedOnly: (v: boolean) => void
  addAllRecommended: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const grouped = useMemo(() => {
    const g: Record<CadenceCategoryId, CadenceLibraryItem[]> = {} as Record<
      CadenceCategoryId,
      CadenceLibraryItem[]
    >
    for (const c of filtered) {
      ;(g[c.cat] ??= []).push(c)
    }
    return g
  }, [filtered])

  const editedCount = Object.keys(overrides).length

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <h3 className="font-serif text-lg font-bold text-neutral-900">
            2 · Velg krav-drevne oppgaver
          </h3>
          <p className="text-[11px] text-neutral-500">
            Hver oppgave er knyttet til en lov- eller standard-paragraf. Du kan endre frekvens og
            eier per oppgave før du legger den i planen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editedCount > 0 && (
            <span className="rounded-full bg-[#e7efe9] px-2 py-0.5 text-[10px] font-bold text-[#1a3d32]">
              {editedCount} endret
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Sparkles className="h-3 w-3" />}
            onClick={addAllRecommended}
          >
            Legg til alt anbefalt
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 bg-neutral-50/40 px-5 py-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk i oppgaver…"
            className="w-full rounded-md border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#1a3d32]"
          />
        </div>
        <label className="flex items-center gap-2 text-[11px] text-neutral-700">
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input
            type="checkbox"
            checked={recommendedOnly}
            onChange={(e) => setRecommendedOnly(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Kun anbefalte
        </label>
        <div className="ml-auto text-[11px] text-neutral-500">
          <span className="font-semibold tabular-nums text-neutral-900">{filtered.length}</span>{' '}
          oppgaver synlig ·{' '}
          <span className="font-semibold tabular-nums text-[#1a3d32]">
            {filtered.filter((c) => planMap[c.id]).length}
          </span>{' '}
          valgt
        </div>
      </div>

      <div className="divide-y divide-neutral-100">
        {(Object.entries(grouped) as Array<[CadenceCategoryId, CadenceLibraryItem[]]>).map(([cat, items]) => {
          const m = CADENCE_CATEGORY_META[cat]
          const Icon = m.icon
          const inPlan = items.filter((c) => planMap[c.id]).length
          return (
            <section key={cat}>
              <header className="flex items-center gap-3 bg-[#fbf9f3]/40 px-5 py-2.5">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md"
                  style={{ background: m.color + '14', color: m.color }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <h4 className="flex-1 text-[12px] font-bold uppercase tracking-wider text-neutral-700">
                  {m.label}
                </h4>
                <span className="text-[10px] tabular-nums text-neutral-500">
                  {inPlan} av {items.length} i plan
                </span>
              </header>
              <ul>
                {items.map((c) => {
                  const isInPlan = planMap[c.id]
                  const o = CADENCE_ORIGIN_META[c.origin]
                  const edited = Boolean(overrides[c.id])
                  return (
                    <li
                      key={c.id}
                      className={[
                        'border-t border-neutral-100 px-5 py-3 transition-colors',
                        isInPlan ? 'bg-[#e7efe9]/30' : 'hover:bg-neutral-50/40',
                      ].join(' ')}
                    >
                      <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[28px_minmax(0,1fr)_140px_150px_150px_100px]">
                        {/* eslint-disable-next-line no-restricted-syntax */}
                        <button
                          type="button"
                          onClick={() => togglePlan(c.id)}
                          className={[
                            'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                            isInPlan
                              ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                              : 'border-neutral-300 bg-white hover:border-[#1a3d32]',
                          ].join(' ')}
                          aria-label={isInPlan ? 'Fjern fra plan' : 'Legg til i plan'}
                        >
                          {isInPlan && <Check className="h-3 w-3" />}
                        </button>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-1.5">
                            <span className="text-sm font-medium text-neutral-900">{c.title}</span>
                            {c.recommended && (
                              <span className="rounded-full bg-[#e7efe9] px-1.5 py-0 text-[9px] font-bold text-[#1a3d32]">
                                Anbefalt
                              </span>
                            )}
                            {edited && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0 text-[9px] font-bold text-amber-800">
                                <Pencil className="h-2 w-2" />
                                endret
                              </span>
                            )}
                          </div>
                          {c.prerequisite && c.prerequisite !== '—' && (
                            <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-neutral-500">
                              <GitBranch className="h-2.5 w-2.5" />
                              Forutsetning: {c.prerequisite}
                            </div>
                          )}
                        </div>
                        <div>
                          <span
                            className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: o.color + '14',
                              color: o.color,
                              borderColor: o.color + '40',
                            }}
                          >
                            {o.label}
                          </span>
                          <div className="mt-0.5 font-mono text-[10px] tabular-nums text-neutral-500">
                            {c.ref}
                          </div>
                        </div>
                        <FreqSelect c={c} updateOverride={updateOverride} />
                        <OwnerSelect c={c} updateOverride={updateOverride} />
                        <div className="text-right text-[11px]">
                          <div className="text-neutral-500">Estimat</div>
                          <div className="font-semibold tabular-nums text-neutral-900">
                            {c.durationH}t × {c.frequencyN}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
        {filtered.length === 0 && (
          <p className="px-5 py-8 text-center text-[12px] italic text-neutral-500">
            Ingen oppgaver matcher filteret. Endre omfang eller rammeverk.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3">
        <Button variant="secondary" onClick={onPrev} icon={<ArrowLeft className="h-4 w-4" />}>
          Tilbake
        </Button>
        <Button variant="primary" onClick={onNext} icon={<ArrowRight className="h-4 w-4" />}>
          Til bemanning
        </Button>
      </div>
    </div>
  )
}

function FreqSelect({
  c,
  updateOverride,
}: {
  c: CadenceLibraryItem
  updateOverride: (id: string, patch: Override) => void
}) {
  return (
    <div className="text-[11px]">
      <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">
        Frekvens
      </label>
      {/* eslint-disable-next-line no-restricted-syntax */}
      <select
        value={c.freq}
        onChange={(e) => {
          const opt = FREQ_OPTIONS.find((o) => o.id === e.target.value)
          if (!opt) return
          updateOverride(c.id, {
            freq: opt.id as CadenceLibraryItem['freq'],
            frequencyN: opt.n,
            intervalDays: opt.days,
          })
        }}
        className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-neutral-900 outline-none focus:border-[#1a3d32]"
      >
        {FREQ_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="mt-0.5 tabular-nums text-[9px] text-neutral-500">{c.frequencyN}× / år</div>
    </div>
  )
}

function OwnerSelect({
  c,
  updateOverride,
}: {
  c: CadenceLibraryItem
  updateOverride: (id: string, patch: Override) => void
}) {
  const options = OWNER_OPTIONS.includes(c.owner) ? OWNER_OPTIONS : [c.owner, ...OWNER_OPTIONS]
  return (
    <div className="text-[11px]">
      <label className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">Eier</label>
      {/* eslint-disable-next-line no-restricted-syntax */}
      <select
        value={c.owner}
        onChange={(e) => updateOverride(c.id, { owner: e.target.value })}
        className="mt-0.5 w-full rounded border border-neutral-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-neutral-900 outline-none focus:border-[#1a3d32]"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Bemanning
// ─────────────────────────────────────────────────────────────────────────────

function StepStaffing({
  lib,
  planMap,
  defaultOwner,
  setDefaultOwner,
  startQuarter,
  setStartQuarter,
  reminders,
  setReminders,
  onPrev,
  onNext,
}: {
  lib: CadenceLibraryItem[]
  planMap: Record<string, boolean>
  defaultOwner: string
  setDefaultOwner: (v: string) => void
  startQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  setStartQuarter: (v: 'Q1' | 'Q2' | 'Q3' | 'Q4') => void
  reminders: { d14: boolean; d3: boolean; daily: boolean }
  setReminders: (next: { d14: boolean; d3: boolean; daily: boolean }) => void
  onPrev: () => void
  onNext: () => void
}) {
  const selected = lib.filter((c) => planMap[c.id])
  const byOwner = useMemo(() => {
    const o: Record<string, CadenceLibraryItem[]> = {}
    for (const c of selected) {
      ;(o[c.owner] ??= []).push(c)
    }
    return o
  }, [selected])

  const maxLoad =
    Math.max(
      0,
      ...Object.values(byOwner).map((arr) =>
        arr.reduce((s, c) => s + c.durationH * c.frequencyN, 0),
      ),
    ) || 1

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h3 className="font-serif text-lg font-bold text-neutral-900">3 · Bemanning og oppstart</h3>
          <p className="text-[11px] text-neutral-500">
            Sett globale standardvalg som blir brukt for alle valgte oppgaver. Du kan overstyre per
            oppgave i forrige steg.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Standard eier (når uspesifisert)
            </label>
            {/* eslint-disable-next-line no-restricted-syntax */}
            <select
              value={defaultOwner}
              onChange={(e) => setDefaultOwner(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              {OWNER_OPTIONS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Oppstartskvartal
            </label>
            <div className="mt-1.5 grid grid-cols-4 gap-1">
              {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                <Button
                  key={q}
                  variant="ghost"
                  onClick={() => setStartQuarter(q)}
                  className={[
                    'rounded-md border py-2 text-sm font-semibold normal-case',
                    startQuarter === q
                      ? 'border-[#1a3d32] bg-[#1a3d32] text-white hover:bg-[#14312a] hover:text-white'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
                  ].join(' ')}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Påminnelser
            </label>
            <div className="mt-1.5 space-y-1 text-[12px]">
              <label className="flex items-center gap-2">
                {/* eslint-disable-next-line no-restricted-syntax */}
                <input
                  type="checkbox"
                  checked={reminders.d14}
                  onChange={(e) => setReminders({ ...reminders, d14: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                14 dager før frist
              </label>
              <label className="flex items-center gap-2">
                {/* eslint-disable-next-line no-restricted-syntax */}
                <input
                  type="checkbox"
                  checked={reminders.d3}
                  onChange={(e) => setReminders({ ...reminders, d3: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                3 dager før frist
              </label>
              <label className="flex items-center gap-2">
                {/* eslint-disable-next-line no-restricted-syntax */}
                <input
                  type="checkbox"
                  checked={reminders.daily}
                  onChange={(e) => setReminders({ ...reminders, daily: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                Daglig fra forfall
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h3 className="font-serif text-lg font-bold text-neutral-900">
            Forventet arbeidsbelastning per eier
          </h3>
          <p className="text-[11px] text-neutral-500">
            Estimert timeforbruk i året basert på frekvens × varighet for valgte oppgaver.
          </p>
        </div>
        {Object.keys(byOwner).length === 0 ? (
          <p className="px-5 py-6 text-center text-[12px] italic text-neutral-500">
            Ingen oppgaver valgt ennå. Gå tilbake til steg 2 for å huke av oppgaver.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {Object.entries(byOwner)
              .sort((a, b) => {
                const la = a[1].reduce((s, c) => s + c.durationH * c.frequencyN, 0)
                const lb = b[1].reduce((s, c) => s + c.durationH * c.frequencyN, 0)
                return lb - la
              })
              .map(([owner, items]) => {
                const hours = items.reduce((s, c) => s + c.durationH * c.frequencyN, 0)
                const pct = hours / maxLoad
                const heavy = hours > 180
                return (
                  <li key={owner} className="px-5 py-3">
                    <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[200px_minmax(0,1fr)_120px]">
                      <div className="flex items-center gap-2">
                        <Initials name={owner} size={28} />
                        <div>
                          <div className="text-[13px] font-semibold text-neutral-900">{owner}</div>
                          <div className="text-[10px] text-neutral-500">
                            {items.length} oppgaver
                          </div>
                        </div>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full"
                          style={{
                            width: `${pct * 100}%`,
                            background: heavy ? '#b3382a' : '#1a3d32',
                          }}
                        />
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold tabular-nums text-neutral-900">
                          {Math.round(hours)}
                          <span className="text-[10px] font-medium text-neutral-500"> t/år</span>
                        </div>
                        {heavy && (
                          <div className="text-[10px] font-semibold text-red-700">Høy belastning</div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={onPrev} icon={<ArrowLeft className="h-4 w-4" />}>
          Tilbake
        </Button>
        <Button variant="primary" onClick={onNext} icon={<ArrowRight className="h-4 w-4" />}>
          Til gjennomgang
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Gjennomgang & bekreft
// ─────────────────────────────────────────────────────────────────────────────

function StepReview({
  lib,
  planMap,
  committing,
  onPrev,
  onCommit,
}: {
  lib: CadenceLibraryItem[]
  planMap: Record<string, boolean>
  committing?: boolean
  onPrev: () => void
  onCommit: () => Promise<void>
}) {
  const selected = lib.filter((c) => planMap[c.id])
  const byCat = useMemo(() => {
    const g: Record<CadenceCategoryId, CadenceLibraryItem[]> = {} as Record<
      CadenceCategoryId,
      CadenceLibraryItem[]
    >
    for (const c of selected) {
      ;(g[c.cat] ??= []).push(c)
    }
    return g
  }, [selected])

  const totalHours = Math.round(selected.reduce((s, c) => s + c.durationH * c.frequencyN, 0))
  const totalEvents = selected.reduce((s, c) => s + c.frequencyN, 0)
  const ownerCount = new Set(selected.map((c) => c.owner)).size

  const handleDownload = () => {
    const lines = ['Tittel,Lovreferanse,Frekvens,Eier,Timer/forekomst,Forekomster/år']
    for (const c of selected) {
      const safe = (s: string) => `"${s.replace(/"/g, '""')}"`
      lines.push(
        [safe(c.title), safe(c.ref), safe(c.freq), safe(c.owner), c.durationH, c.frequencyN].join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kadens-plan-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h3 className="font-serif text-lg font-bold text-neutral-900">
            4 · Gjennomgang & bekreft
          </h3>
          <p className="text-[11px] text-neutral-500">
            Sjekk at det stemmer. Når du legger til, opprettes oppgavene som vedvarende rutiner i
            Klarert og dukker opp i Oppgaver, Årshjul og Kontroll-modulen.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-neutral-100 bg-[#fbf9f3]/40 p-5 lg:grid-cols-4">
          <Tile big={selected.length} title="Oppgaver" sub="legges til i plan" />
          <Tile big={totalHours} title="Timer / år" sub="estimert totalt" />
          <Tile big={totalEvents} title="Hendelser / år" sub="planlagte forekomster" />
          <Tile big={ownerCount} title="Eiere" sub="ansvarlige ressurser" />
        </div>

        {selected.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12px] italic text-neutral-500">
            Ingen oppgaver valgt. Gå tilbake og hak av minst én.
          </p>
        ) : (
          (Object.entries(byCat) as Array<[CadenceCategoryId, CadenceLibraryItem[]]>).map(([cat, items]) => {
            const m = CADENCE_CATEGORY_META[cat]
            const Icon = m.icon
            return (
              <section key={cat} className="border-t border-neutral-100">
                <header className="flex items-center gap-3 bg-white px-5 py-2.5">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md"
                    style={{ background: m.color + '14', color: m.color }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-neutral-700">
                    {m.label}
                  </h4>
                  <span className="ml-auto text-[10px] tabular-nums text-neutral-500">
                    {items.length}
                  </span>
                </header>
                <ul className="border-t border-neutral-100">
                  {items.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-3 border-t border-neutral-100 px-5 py-2.5 first:border-t-0"
                    >
                      <Check className="h-3.5 w-3.5 text-[#2f7757]" />
                      <span className="text-[13px] font-medium text-neutral-900">{c.title}</span>
                      <span className="font-mono text-[10px] tabular-nums text-neutral-500">
                        {c.ref}
                      </span>
                      <span className="ml-auto text-[10px] text-neutral-500">
                        {c.frequencyN}×/år · {c.owner}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        )}

        <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4">
          <Button variant="secondary" onClick={onPrev} icon={<ArrowLeft className="h-4 w-4" />}>
            Tilbake
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownload}
              disabled={selected.length === 0}
            >
              Last ned plan-mal
            </Button>
            <Button
              variant="primary"
              icon={<CheckCheck className="h-4 w-4" />}
              onClick={() => {
                void onCommit()
              }}
              disabled={committing || selected.length === 0}
            >
              {committing ? 'Legger til…' : `Legg til ${selected.length} i plan`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Tile({ big, title, sub }: { big: number; title: string; sub: string }) {
  return (
    <div className="rounded-md border border-neutral-200/80 bg-white p-3">
      <div className="text-2xl font-bold tabular-nums text-neutral-900">{big}</div>
      <div className="text-[12px] font-semibold text-neutral-900">{title}</div>
      <div className="text-[10px] text-neutral-500">{sub}</div>
    </div>
  )
}
