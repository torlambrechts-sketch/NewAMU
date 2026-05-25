// Internkontroll — unified compliance management page.
//
// Combines what used to live across InternkontrollDashboardPage,
// InternkontrollGapPage and InternkontrollPlanPage into a single
// sidebar-driven page with eight sections:
//
//   Oversikt · Krav · Kontroller · Gap-analyse · Årshjul ·
//   Tiltak · Prosjekter · Revisjon-logg
//
// Section selection is URL-driven via ?section=… so deep-links survive
// reload and the side-nav anchor highlight is shareable.
//
// Data sources (read from the live tables — no new tables introduced):
//   • frameworks       — derived from FRAMEWORKS + useRegelverkCoverage
//                        + useControlsByLawRef + register coverage
//   • krav             — one row per framework paragraph
//   • kontroller       — internal_controls + internal_control_clauses +
//                        internal_control_status_v
//   • gap              — krav with status != 'covered'
//   • årshjul          — internal_control_executions (last 12 months)
//                        + scheduled cadence (frequency_hint → next_due_at)
//   • tiltak           — compliance_plan_items
//   • prosjekter       — derived from compliance_plan_items grouped by
//                        framework + milestone string field (Phase 1 view)
//   • revisjon-logg    — compliance_plan_items + internal_control_
//                        executions union, latest first

import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  Download,
  FolderKanban,
  History,
  LayoutDashboard,
  ListChecks,
  Plus,
  Scale,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { ModulePageShell } from '../../../components/module/ModulePageShell'
import { Button } from '../../../components/ui/Button'
import { planItemToTiltak, useInternkontrollPageData } from './useInternkontrollPageData'
import { useCompliancePlanItems } from './useCompliancePlanItems'
import { FRAMEWORK_IDS, type FrameworkId } from './frameworkParagraphs'
import { OversiktSection } from './sections/OversiktSection'
import { KravSection } from './sections/KravSection'
import { KontrollerSection } from './sections/KontrollerSection'
import { GapSection } from './sections/GapSection'
import { AarshjulSection } from './sections/AarshjulSection'
import { TiltakSection } from './sections/TiltakSection'
import { ProsjekterSection } from './sections/ProsjekterSection'
import { RevisjonSection } from './sections/RevisjonSection'
import {
  CoverageBar,
  KategoriIcon,
  type IkSectionId,
  type IkFrameworkFilter,
} from './sections/internkontrollShared'
import {
  IK_CATEGORIES,
  type IkCategoryFilter,
  type IkCategoryId,
} from './sections/internkontrollTokens'

const BREADCRUMB = [
  { label: 'Arbeidsflate', to: '/' },
  { label: 'Oversikt', to: '/overview/hms' },
  { label: 'Internkontroll' },
]

const NAV: Array<{ id: IkSectionId; label: string; Icon: typeof LayoutDashboard }> = [
  { id: 'oversikt', label: 'Oversikt', Icon: LayoutDashboard },
  { id: 'krav', label: 'Krav', Icon: Scale },
  { id: 'kontroller', label: 'Kontroller', Icon: ShieldCheck },
  { id: 'gap', label: 'Gap-analyse', Icon: TriangleAlert },
  { id: 'aarshjul', label: 'Årshjul', Icon: CalendarClock },
  { id: 'tiltak', label: 'Tiltak', Icon: ListChecks },
  { id: 'prosjekter', label: 'Prosjekter', Icon: FolderKanban },
  { id: 'revisjon', label: 'Revisjon-logg', Icon: History },
]

const VALID_SECTIONS = new Set<IkSectionId>(NAV.map((n) => n.id))
const VALID_FRAMEWORK_FILTERS = new Set<IkFrameworkFilter>([
  'all',
  ...(FRAMEWORK_IDS as readonly FrameworkId[]),
])
const VALID_CATEGORY_FILTERS = new Set<IkCategoryFilter>([
  'all',
  ...IK_CATEGORIES.map((c) => c.id),
])

export function InternkontrollPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sectionParam = searchParams.get('section')
  const section: IkSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam as IkSectionId)
      ? (sectionParam as IkSectionId)
      : 'oversikt'

  const filterFwParam = searchParams.get('framework') ?? 'all'
  // Validate against the allow-list — a malformed/legacy URL param
  // ("?framework=foo") silently falls back to 'all' instead of letting
  // a downstream cast inject an unknown framework id into queries.
  const filterFw: IkFrameworkFilter = VALID_FRAMEWORK_FILTERS.has(
    filterFwParam as IkFrameworkFilter,
  )
    ? (filterFwParam as IkFrameworkFilter)
    : 'all'

  const filterCategoryParam = searchParams.get('kategori') ?? 'all'
  const filterCategory: IkCategoryFilter = VALID_CATEGORY_FILTERS.has(
    filterCategoryParam as IkCategoryFilter,
  )
    ? (filterCategoryParam as IkCategoryFilter)
    : 'all'

  const setSection = (id: IkSectionId) => {
    const sp = new URLSearchParams(searchParams)
    sp.set('section', id)
    setSearchParams(sp, { replace: true })
  }
  const setFilterFw = (id: IkFrameworkFilter) => {
    const sp = new URLSearchParams(searchParams)
    if (id === 'all') sp.delete('framework')
    else sp.set('framework', id)
    setSearchParams(sp, { replace: true })
  }
  const setFilterCategory = (id: IkCategoryFilter) => {
    const sp = new URLSearchParams(searchParams)
    if (id === 'all') sp.delete('kategori')
    else sp.set('kategori', id)
    setSearchParams(sp, { replace: true })
  }

  const { data: rawData, loading, bridgesByPlanId } = useInternkontrollPageData()
  const plan = useCompliancePlanItemsForActiveFramework(filterFw)

  // Override the snapshot tiltak with the live hook so newly-created /
  // updated rows reflect immediately across every section (Oversikt's
  // KPI strip, Prosjekter task lists, sidebar count, etc.). Pass the
  // bridge map so each live row keeps its CAPA twin's status/assignee
  // without an extra round-trip.
  const data = useMemo(() => {
    const liveTiltak = plan.items.map((p) =>
      planItemToTiltak(p, rawData.frameworks, undefined, bridgesByPlanId),
    )
    return { ...rawData, tiltak: liveTiltak }
  }, [rawData, plan.items, bridgesByPlanId])

  const counts: Record<IkSectionId, number | null> = useMemo(() => {
    const stats = data.stats
    return {
      oversikt: null,
      krav: data.krav.length,
      kontroller: data.kontroller.length,
      gap: stats.gaps + stats.partial,
      aarshjul: data.aarshjul.length,
      tiltak: data.tiltak.length,
      prosjekter: data.prosjekter.length,
      revisjon: data.audit.length,
    }
  }, [data])

  // Krav counts per category — narrowed by the active framework chip so
  // the KATEGORIER badges shift when the user scopes by regelverk.
  const categoryCounts = useMemo(() => {
    const counts = new Map<IkCategoryId, number>()
    let total = 0
    for (const k of data.krav) {
      if (filterFw !== 'all' && k.fw !== filterFw) continue
      counts.set(k.category, (counts.get(k.category) ?? 0) + 1)
      total += 1
    }
    return { counts, total }
  }, [data.krav, filterFw])

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        icon={<Download className="h-3.5 w-3.5" />}
        onClick={() => {
          const blob = exportStatusCsv(data)
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `internkontroll-status-${new Date().toISOString().slice(0, 10)}.csv`
          a.click()
          URL.revokeObjectURL(url)
        }}
      >
        Eksporter status
      </Button>
      <Button
        variant="primary"
        size="sm"
        icon={<Plus className="h-3.5 w-3.5" />}
        onClick={() => setSection('kontroller')}
      >
        Ny kontroll
      </Button>
    </div>
  )

  return (
    <ModulePageShell
      breadcrumb={BREADCRUMB}
      title="Internkontroll"
      description="Krav, kontroller og styring av etterlevelse — på tvers av lovverk og rammeverk."
      loading={loading}
      loadingLabel="Laster internkontroll…"
      headerActions={headerActions}
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* SIDE NAV */}
        <aside className="space-y-3">
          {/* Kategorier — content groupings, mirrors the Sjekklister
              sidebar pattern. Sits at the top of the sidebar (above the
              section nav) because the user's mental model is "pick a
              functional lens first, then drill into the section". Counts
              react to the active framework chip. */}
          <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Kategorier
            </h3>
            <ul className="mt-1.5 space-y-0.5">
              <li>
                <Button
                  variant="ghost"
                  onClick={() => setFilterCategory('all')}
                  className={[
                    'flex w-full items-center justify-between gap-2 rounded border-0 px-1.5 py-1 text-[11px] font-normal',
                    filterCategory === 'all'
                      ? 'bg-[#e7efe9] font-semibold text-neutral-900 hover:bg-[#e7efe9]'
                      : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900',
                  ].join(' ')}
                  style={
                    filterCategory === 'all' ? { boxShadow: 'inset 3px 0 0 #1a3d32' } : undefined
                  }
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <KategoriIcon name="LayoutGrid" className="h-3 w-3 shrink-0 text-neutral-500" />
                    <span className="truncate">Alle</span>
                  </span>
                  <span
                    className={[
                      'shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
                      filterCategory === 'all'
                        ? 'bg-[#1a3d32] text-white'
                        : 'bg-neutral-100 text-neutral-600',
                    ].join(' ')}
                  >
                    {categoryCounts.total}
                  </span>
                </Button>
              </li>
              {IK_CATEGORIES.map((cat) => {
                const active = filterCategory === cat.id
                const count = categoryCounts.counts.get(cat.id) ?? 0
                return (
                  <li key={cat.id}>
                    <Button
                      variant="ghost"
                      onClick={() => setFilterCategory(cat.id)}
                      className={[
                        'flex w-full items-center justify-between gap-2 rounded border-0 px-1.5 py-1 text-[11px] font-normal',
                        active
                          ? 'bg-[#e7efe9] font-semibold text-neutral-900 hover:bg-[#e7efe9]'
                          : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900',
                      ].join(' ')}
                      style={active ? { boxShadow: 'inset 3px 0 0 #1a3d32' } : undefined}
                      title={cat.label}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <KategoriIcon
                          name={cat.icon}
                          className={[
                            'h-3 w-3 shrink-0',
                            active ? 'text-[#1a3d32]' : 'text-neutral-500',
                          ].join(' ')}
                        />
                        <span className="truncate">{cat.label}</span>
                      </span>
                      <span
                        className={[
                          'shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
                          active
                            ? 'bg-[#1a3d32] text-white'
                            : 'bg-neutral-100 text-neutral-600',
                        ].join(' ')}
                      >
                        {count}
                      </span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <ul className="py-1.5">
              {NAV.map(({ id, label, Icon }) => {
                const active = id === section
                const count = counts[id]
                return (
                  <li key={id}>
                    <Button
                      variant="ghost"
                      onClick={() => setSection(id)}
                      className={[
                        'flex w-full items-center justify-start gap-2.5 rounded-none border-0 px-4 py-2 text-left text-sm font-normal',
                        active
                          ? 'bg-[#e7efe9] text-neutral-900 hover:bg-[#e7efe9]'
                          : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900',
                      ].join(' ')}
                      style={active ? { boxShadow: 'inset 3px 0 0 #1a3d32' } : undefined}
                    >
                      <Icon
                        className={[
                          'h-3.5 w-3.5 shrink-0',
                          active ? 'text-[#1a3d32]' : 'text-neutral-500',
                        ].join(' ')}
                      />
                      <span
                        className={[
                          'min-w-0 flex-1',
                          active ? 'font-semibold' : 'font-medium',
                        ].join(' ')}
                      >
                        {label}
                      </span>
                      {count != null ? (
                        <span
                          className={[
                            'rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
                            active
                              ? 'bg-[#1a3d32] text-white'
                              : 'bg-neutral-100 text-neutral-600',
                          ].join(' ')}
                        >
                          {count}
                        </span>
                      ) : null}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Rammeverk-filter */}
          <div className="rounded-xl border border-neutral-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Rammeverk
            </h3>
            <ul className="mt-1.5 space-y-0.5">
              <li>
                <Button
                  variant="ghost"
                  onClick={() => setFilterFw('all')}
                  className={[
                    'flex w-full items-center justify-between gap-2 rounded border-0 px-1.5 py-1 text-[11px] font-normal',
                    filterFw === 'all'
                      ? 'bg-neutral-100 font-semibold text-neutral-900 hover:bg-neutral-100'
                      : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-neutral-400" />
                    Alle ({data.krav.length})
                  </span>
                </Button>
              </li>
              {data.frameworks.map((f) => {
                const active = filterFw === f.id
                return (
                  <li key={f.id}>
                    <Button
                      variant="ghost"
                      onClick={() => setFilterFw(f.id)}
                      className={[
                        'flex w-full items-center justify-between gap-2 rounded border-0 px-1.5 py-1 text-[11px] font-normal',
                        active
                          ? 'font-semibold text-neutral-900'
                          : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900',
                      ].join(' ')}
                      style={active ? { background: f.color + '14' } : undefined}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: f.color }}
                        />
                        <span className="truncate">{f.short}</span>
                      </span>
                      <span className="tabular-nums text-[10px] text-neutral-500">{f.reqs}</span>
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Etterlevelse status mini */}
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Etterlevelse
            </h3>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular-nums text-neutral-900">
                {data.stats.total > 0
                  ? Math.round((data.stats.covered / data.stats.total) * 100)
                  : 0}
                %
              </span>
              <span className="text-[10px] text-neutral-500">dekket</span>
            </div>
            <div className="mt-2">
              <CoverageBar
                covered={data.stats.covered}
                partial={data.stats.partial}
                gap={data.stats.gaps}
                total={Math.max(1, data.stats.total)}
              />
            </div>
            <ul className="mt-2 space-y-0.5 text-[10px]">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#2f7757]" />
                  <span className="text-neutral-700">Dekket</span>
                </span>
                <span className="tabular-nums text-neutral-600">{data.stats.covered}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#c98a2b]" />
                  <span className="text-neutral-700">Delvis</span>
                </span>
                <span className="tabular-nums text-neutral-600">{data.stats.partial}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#b3382a]" />
                  <span className="text-neutral-700">Gap</span>
                </span>
                <span className="tabular-nums text-neutral-600">{data.stats.gaps}</span>
              </li>
            </ul>
          </div>
        </aside>

        {/* SECTION CONTENT */}
        <section className="min-w-0">
          {section === 'oversikt' && <OversiktSection data={data} setSection={setSection} />}
          {section === 'krav' && (
            <KravSection
              data={data}
              filterFw={filterFw}
              filterCategory={filterCategory}
              setFilterFw={setFilterFw}
            />
          )}
          {section === 'kontroller' && (
            <KontrollerSection data={data} filterFw={filterFw} filterCategory={filterCategory} />
          )}
          {section === 'gap' && (
            <GapSection
              data={data}
              filterFw={filterFw}
              filterCategory={filterCategory}
              plan={plan}
            />
          )}
          {section === 'aarshjul' && (
            <AarshjulSection data={data} filterFw={filterFw} filterCategory={filterCategory} />
          )}
          {section === 'tiltak' && (
            <TiltakSection data={data} plan={plan} filterCategory={filterCategory} />
          )}
          {section === 'prosjekter' && <ProsjekterSection data={data} plan={plan} />}
          {section === 'revisjon' && <RevisjonSection data={data} />}
        </section>
      </div>
    </ModulePageShell>
  )
}

function useCompliancePlanItemsForActiveFramework(filter: IkFrameworkFilter) {
  // The hook now accepts 'all' natively so the unified page can render
  // every plan-item across regelverk when no framework chip is active.
  // Narrowing to a specific framework still scopes the fetch (and the
  // sidebar count) to just that regelverk.
  return useCompliancePlanItems(filter)
}

function exportStatusCsv(data: ReturnType<typeof useInternkontrollPageData>['data']) {
  const lines = [
    ['Rammeverk', 'Paragraf', 'Tittel', 'Status', 'Kritikalitet', 'Eier'].join(';'),
  ]
  for (const k of data.krav) {
    lines.push(
      [
        escapeCsv(k.fw),
        escapeCsv(k.ref),
        escapeCsv(k.title),
        escapeCsv(k.status),
        escapeCsv(k.criticality),
        escapeCsv(k.owner ?? ''),
      ].join(';'),
    )
  }
  // BOM so Excel reads the file as UTF-8 (handles æ/ø/å correctly).
  return new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
}

// Conservative CSV escape that also defuses formula-injection vectors:
// when a value starts with =, +, -, @ (or tab/CR — chars Excel treats
// as formula triggers), prepend a single quote so the cell renders as
// plain text. Without this, a malicious "title" could trigger formula
// execution when an auditor opens the CSV in Excel.
function escapeCsv(s: string): string {
  const trigger = /^[=+\-@\t\r]/.test(s) ? "'" : ''
  const body = trigger + s
  if (body.includes(';') || body.includes('"') || body.includes('\n') || trigger) {
    return '"' + body.replaceAll('"', '""') + '"'
  }
  return body
}
