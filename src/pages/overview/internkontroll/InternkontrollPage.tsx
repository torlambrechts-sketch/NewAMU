// Internkontroll — unified compliance management page.
//
// 8 sections selectable via a horizontal tab strip (Oversikt / Krav /
// Kontroller / Gap-analyse / Årshjul / Tiltak / Prosjekter /
// Revisjon-logg). Below the tabs, a FilterBar carries the two
// cross-section filter chips (Rammeverk + Kontroller-kategori) and
// the saved-views control.
//
// Section selection is URL-driven via ?section=…; the filter chips
// live in local state with history.replaceState sync (same pattern
// as Sjekklister / Tasks / Surveys after the round-3 rollout — keeps
// chip toggles instant by avoiding the react-router rerender
// cascade).
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

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  Search,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { ModulePageShell } from '../../../components/module/ModulePageShell'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import { FilterBar, SavedViewsControl } from '../../../components/ui/FilterBar'
import { FilterChip } from '../../../components/ui/FilterChip'
import { useSavedViews } from '../../../hooks/useSavedViews'
import { planItemToTiltak, useInternkontrollPageData } from './useInternkontrollPageData'
import { useCompliancePlanItems } from './useCompliancePlanItems'
import { FRAMEWORK_IDS, type FrameworkId } from './frameworkParagraphs'
import { OversiktSection } from './sections/OversiktSection'
import { KravSection } from './sections/KravSection'
import { KontrollerSection } from './sections/KontrollerSection'
import { ControlDetailView, ControlEditorPanel } from '../../../../modules/compliance-layer'
import { GapSection } from './sections/GapSection'
import { AarshjulSection } from './sections/AarshjulSection'
import { TiltakSection } from './sections/TiltakSection'
import { ProsjekterSection } from './sections/ProsjekterSection'
import { RevisjonSection } from './sections/RevisjonSection'
import { type IkSectionId } from './sections/internkontrollShared'
import {
  IK_CATEGORIES,
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

// Per-section filter relevance — drives whether the FilterBar shows
// at all and which chips are exposed. Prosjekter, Tiltak and
// Revisjon don't use the framework dimension; Tiltak uses category.
const SECTION_SHOWS_FRAMEWORK: Record<IkSectionId, boolean> = {
  oversikt: false,
  krav: true,
  kontroller: true,
  gap: true,
  aarshjul: true,
  tiltak: false,
  prosjekter: false,
  revisjon: false,
}
const SECTION_SHOWS_CATEGORY: Record<IkSectionId, boolean> = {
  oversikt: false,
  krav: true,
  kontroller: true,
  gap: true,
  aarshjul: true,
  tiltak: true,
  prosjekter: false,
  revisjon: false,
}

// Whether the page-level search input is shown. Oversikt is a
// dashboard (no list); everything else has a list to narrow.
const SECTION_SHOWS_SEARCH: Record<IkSectionId, boolean> = {
  oversikt: false,
  krav: true,
  kontroller: true,
  gap: true,
  aarshjul: true,
  tiltak: true,
  prosjekter: true,
  revisjon: true,
}

const SEARCH_PLACEHOLDER: Record<IkSectionId, string> = {
  oversikt: 'Søk…',
  krav: 'Søk i tittel eller paragraf…',
  kontroller: 'Søk i kontrolltittel…',
  gap: 'Søk i tittel eller paragraf…',
  aarshjul: 'Søk i kontrolltittel…',
  tiltak: 'Søk i tittel…',
  prosjekter: 'Søk i prosjektnavn eller leder…',
  revisjon: 'Søk i aktør, handling eller detalj…',
}

// ── Filter state + URL sync ────────────────────────────────────────────

type IkFilters = {
  frameworks: FrameworkId[]
  categories: IkCategoryId[]
}
const EMPTY_FILTERS: IkFilters = { frameworks: [], categories: [] }

function filtersFromUrl(params: URLSearchParams): IkFilters {
  const get = (key: string) => {
    const raw = params.get(key)
    return raw ? raw.split(',').filter(Boolean) : []
  }
  const validFw = new Set<string>(FRAMEWORK_IDS)
  const validCat = new Set<string>(IK_CATEGORIES.map((c) => c.id))
  return {
    frameworks: get('framework').filter((id): id is FrameworkId => validFw.has(id)),
    categories: get('kategori').filter((id): id is IkCategoryId => validCat.has(id)),
  }
}

function syncFiltersToUrl(f: IkFilters) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const setOrDelete = (key: string, values: string[]) => {
    if (values.length > 0) url.searchParams.set(key, values.join(','))
    else url.searchParams.delete(key)
  }
  setOrDelete('framework', f.frameworks)
  setOrDelete('kategori', f.categories)
  window.history.replaceState(null, '', url.toString())
}

function filtersEqual(a: IkFilters, b: IkFilters): boolean {
  const eq = (x: readonly string[], y: readonly string[]) => {
    if (x.length !== y.length) return false
    const xs = [...x].sort()
    const ys = [...y].sort()
    return xs.every((v, i) => v === ys[i])
  }
  return eq(a.frameworks, b.frameworks) && eq(a.categories, b.categories)
}

export function InternkontrollPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sectionParam = searchParams.get('section')
  const section: IkSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam as IkSectionId)
      ? (sectionParam as IkSectionId)
      : 'oversikt'

  // Filter state in local React state — see syncFiltersToUrl above for
  // the URL-sync trick. We still read from searchParams once on mount
  // so a shared deep-link with ?framework=…&kategori=… hydrates.
  const [filters, setFilters] = useState<IkFilters>(() =>
    filtersFromUrl(searchParams),
  )
  useEffect(() => {
    syncFiltersToUrl(filters)
  }, [filters])
  const activeFilterCount = filters.frameworks.length + filters.categories.length

  // Page-level free-text search. One input drives whatever section is
  // visible — each section applies it to the fields that make sense
  // (paragraph + title for Krav, title for Kontroller, …). Kept in
  // local React state since the SearchableSelect-style URL sync isn't
  // worth the typing latency on a per-keystroke field.
  const [search, setSearch] = useState('')

  // ?control=<uuid> on top of section=kontroller swaps the list for the
  // detail view in-place. Lets users navigate without leaving the
  // Internkontroll chrome.
  const selectedControlId = section === 'kontroller' ? searchParams.get('control') : null

  const setSection = useCallback(
    (id: IkSectionId) => {
      const sp = new URLSearchParams(searchParams)
      sp.set('section', id)
      setSearchParams(sp, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const [createControlOpen, setCreateControlOpen] = useState(false)
  const { data: rawData, loading, bridgesByPlanId, reload: reloadPageData } = useInternkontrollPageData()
  // The plan hook accepts a single FrameworkFilter (string | 'all'). For
  // multi-select we fall back to 'all' and let the section apply the
  // narrower client-side filter. Single-select stays scoped at the
  // query level, so the common case is unchanged.
  const planScope: FrameworkId | 'all' =
    filters.frameworks.length === 1 ? filters.frameworks[0] : 'all'
  const plan = useCompliancePlanItems(planScope)

  // Override the snapshot tiltak with the live hook so newly-created /
  // updated rows reflect immediately across every section.
  const data = useMemo(() => {
    const liveTiltak = plan.items.map((p) =>
      planItemToTiltak(p, rawData.frameworks, undefined, bridgesByPlanId),
    )
    return { ...rawData, tiltak: liveTiltak }
  }, [rawData, plan.items, bridgesByPlanId])

  // Tab counts — narrowed by the active filters where it makes sense,
  // so each tab pill reflects what the section would actually show.
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

  // Saved views — module slug 'internkontroll'. Same star-to-set-default
  // + dropdown contract as Sjekklister / Tasks / Surveys / etc.
  const saved = useSavedViews<IkFilters>('internkontroll')
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [defaultApplied, setDefaultApplied] = useState(false)
  useEffect(() => {
    if (defaultApplied) return
    if (saved.loading) return
    if (activeFilterCount > 0) {
      const match = saved.views.find((v) =>
        filtersEqual(filters, { ...EMPTY_FILTERS, ...v.filters }),
      )
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (match) setActiveViewId(match.id)
      setDefaultApplied(true)
      return
    }
    if (saved.defaultViewId) {
      const def = saved.views.find((v) => v.id === saved.defaultViewId)
      if (def) {
        setFilters({ ...EMPTY_FILTERS, ...def.filters })
        setActiveViewId(def.id)
      }
    }
    setDefaultApplied(true)
  }, [defaultApplied, saved.loading, saved.defaultViewId, saved.views, activeFilterCount, filters])

  const hasUnsavedChanges = useMemo(() => {
    if (!activeViewId) return false
    const view = saved.views.find((v) => v.id === activeViewId)
    if (!view) return false
    return !filtersEqual(filters, { ...EMPTY_FILTERS, ...view.filters })
  }, [activeViewId, filters, saved.views])

  // Section-aware export. The label + payload follow the active section
  // so the auditor gets the dataset they're looking at, not always the
  // krav-catalog. Filters are applied so the export matches what's
  // visible on screen. Oversikt has no list to export → button hidden.
  const exportConfig = useMemo(
    () => buildExportForSection(section, data, filters),
    [section, data, filters],
  )

  const headerActions = (
    <div className="flex items-center gap-2">
      {exportConfig ? (
        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="h-3.5 w-3.5" />}
          onClick={() => {
            const blob = exportConfig.build()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = exportConfig.filename
            a.click()
            URL.revokeObjectURL(url)
          }}
        >
          {exportConfig.label}
        </Button>
      ) : null}
      <Button
        variant="primary"
        size="sm"
        icon={<Plus className="h-3.5 w-3.5" />}
        onClick={() => setCreateControlOpen(true)}
      >
        Ny kontroll
      </Button>
    </div>
  )

  const showFrameworkChip = SECTION_SHOWS_FRAMEWORK[section]
  const showCategoryChip = SECTION_SHOWS_CATEGORY[section]
  const showFilterBar = showFrameworkChip || showCategoryChip

  return (
    <ModulePageShell
      breadcrumb={BREADCRUMB}
      width="full"
      title="Internkontroll"
      description="Krav, kontroller og styring av etterlevelse — på tvers av lovverk og rammeverk."
      loading={loading}
      loadingLabel="Laster internkontroll…"
      headerActions={headerActions}
    >
      <div className="space-y-3">
        {/* Section tabs — horizontal strip replaces the old left-rail
            KATEGORIER panel. Same nav, freed-up horizontal space. */}
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <nav
            className="flex flex-wrap items-center gap-1 border-b border-neutral-100 px-3 py-2"
            aria-label="Internkontroll-seksjoner"
          >
            {NAV.map(({ id, label, Icon }) => {
              const active = id === section
              const count = counts[id]
              return (
                <Button
                  key={id}
                  variant="ghost"
                  onClick={() => setSection(id)}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'inline-flex h-auto items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--ui-accent)] text-white hover:bg-[var(--ui-accent)] hover:text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{label}</span>
                  {count != null ? (
                    <span
                      className={[
                        'ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                        active ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700',
                      ].join(' ')}
                    >
                      {count}
                    </span>
                  ) : null}
                </Button>
              )
            })}
          </nav>

          {/* FilterBar — search input (leading) + Rammeverk +
              Kontroller-kategori chips + saved views. Search lives
              inline on the same row as the chips so users see the
              entire narrow-the-list control set at once. The bar
              renders whenever EITHER search or chips are relevant
              for the section. */}
          {showFilterBar || SECTION_SHOWS_SEARCH[section] ? (
            <FilterBar
              leading={
                SECTION_SHOWS_SEARCH[section] ? (
                  <div className="relative w-64 max-w-full">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                      aria-hidden
                    />
                    <StandardInput
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={SEARCH_PLACEHOLDER[section]}
                      aria-label="Søk"
                      className="w-full !py-1.5 pl-9 text-sm"
                    />
                  </div>
                ) : undefined
              }
              chips={
                <>
                  {showFrameworkChip ? (
                    <FilterChip
                      label="Rammeverk"
                      options={data.frameworks.map((f) => ({
                        value: f.id,
                        label: f.short,
                        count: f.reqs,
                      }))}
                      value={filters.frameworks}
                      onChange={(next) => {
                        setFilters({ ...filters, frameworks: next as FrameworkId[] })
                        setActiveViewId(null)
                      }}
                    />
                  ) : null}
                  {showCategoryChip ? (
                    <FilterChip
                      label="Kontroller"
                      options={IK_CATEGORIES.map((c) => ({
                        value: c.id,
                        label: c.label,
                      }))}
                      value={filters.categories}
                      onChange={(next) => {
                        setFilters({ ...filters, categories: next as IkCategoryId[] })
                        setActiveViewId(null)
                      }}
                    />
                  ) : null}
                </>
              }
              activeFilterCount={activeFilterCount}
              onReset={() => {
                setFilters(EMPTY_FILTERS)
                setActiveViewId(null)
              }}
              savedViews={
                <SavedViewsControl<IkFilters>
                  currentFilters={filters}
                  activeViewId={activeViewId}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onApplyView={(view) => {
                    setFilters({ ...EMPTY_FILTERS, ...view.filters })
                    setActiveViewId(view.id)
                  }}
                  onClearActive={() => setActiveViewId(null)}
                  saved={saved}
                />
              }
            />
          ) : null}
        </div>

        {/* SECTION CONTENT */}
        <section className="min-w-0">
          {section === 'oversikt' && <OversiktSection data={data} setSection={setSection} />}
          {section === 'krav' && (
            <KravSection
              data={data}
              frameworks={filters.frameworks}
              categories={filters.categories}
              search={search}
            />
          )}
          {section === 'kontroller' &&
            (selectedControlId ? (
              <ControlDetailView
                controlId={selectedControlId}
                onBack={() => {
                  const sp = new URLSearchParams(searchParams)
                  sp.delete('control')
                  setSearchParams(sp, { replace: true })
                }}
              />
            ) : (
              <KontrollerSection
                data={data}
                frameworks={filters.frameworks}
                categories={filters.categories}
                search={search}
              />
            ))}
          {section === 'gap' && (
            <GapSection
              data={data}
              frameworks={filters.frameworks}
              categories={filters.categories}
              plan={plan}
              search={search}
              onCreateControl={() => setCreateControlOpen(true)}
            />
          )}
          {section === 'aarshjul' && (
            <AarshjulSection
              data={data}
              frameworks={filters.frameworks}
              categories={filters.categories}
              search={search}
            />
          )}
          {section === 'tiltak' && (
            <TiltakSection
              data={data}
              plan={plan}
              categories={filters.categories}
              search={search}
            />
          )}
          {section === 'prosjekter' && (
            <ProsjekterSection
              data={data}
              plan={plan}
              onProjectsChanged={reloadPageData}
              search={search}
            />
          )}
          {section === 'revisjon' && <RevisjonSection data={data} search={search} />}
        </section>
      </div>

      <ControlEditorPanel
        open={createControlOpen}
        mode="create"
        onClose={() => setCreateControlOpen(false)}
        onSaved={async (id) => {
          setCreateControlOpen(false)
          await reloadPageData()
          // Land the user on the new control's detail view inside the
          // Internkontroll chrome so they can immediately add bindings,
          // evidence, etc. — same in-place pattern the existing row click
          // uses for ControlDetailView.
          const sp = new URLSearchParams(searchParams)
          sp.set('section', 'kontroller')
          sp.set('control', id)
          setSearchParams(sp, { replace: false })
        }}
      />
    </ModulePageShell>
  )
}

// Section-aware export builder. Returns null for sections that have no
// list to dump (Oversikt). Each section gets its own column set + file
// name so the auditor receives the dataset they were viewing.
type IkData = ReturnType<typeof useInternkontrollPageData>['data']
type ExportConfig = {
  label: string
  filename: string
  build: () => Blob
}

function buildExportForSection(
  section: IkSectionId,
  data: IkData,
  filters: IkFilters,
): ExportConfig | null {
  const today = new Date().toISOString().slice(0, 10)
  const fwSet = filters.frameworks.length ? new Set(filters.frameworks) : null
  const catSet = filters.categories.length ? new Set(filters.categories) : null

  switch (section) {
    case 'krav': {
      const rows = data.krav.filter(
        (k) =>
          (!fwSet || fwSet.has(k.fw)) && (!catSet || catSet.has(k.category)),
      )
      return {
        label: 'Eksporter krav',
        filename: `internkontroll-krav-${today}.csv`,
        build: () =>
          buildCsv(
            ['Rammeverk', 'Paragraf', 'Tittel', 'Status', 'Kritikalitet', 'Eier'],
            rows.map((k) => [k.fw, k.ref, k.title, k.status, k.criticality, k.owner ?? '']),
          ),
      }
    }
    case 'kontroller': {
      // IkKontroll's framework membership lives in `covers[]` as
      // prefixed paragraph strings ("AML § 3-1", "ISO 45001 5.4", …),
      // not a separate array. For multi-framework filter we test
      // prefix membership; the framework dimension stays best-effort
      // here since the canonical mapping happens in the section.
      const fwPrefixOk = (covers: readonly string[]): boolean => {
        if (!fwSet) return true
        for (const code of covers) {
          if (fwSet.has('aml') && code.startsWith('AML ')) return true
          if (fwSet.has('ik-f') && code.startsWith('IK-f ')) return true
          if (fwSet.has('gdpr') && code.startsWith('GDPR ')) return true
          if (fwSet.has('apenhetsloven') && code.startsWith('Åpenhetsloven ')) return true
          if (fwSet.has('iso-45001') && code.startsWith('ISO 45001')) return true
        }
        return false
      }
      const rows = data.kontroller.filter(
        (c) =>
          fwPrefixOk(c.covers) &&
          (!catSet || c.categories.some((id) => catSet.has(id))),
      )
      return {
        label: 'Eksporter kontroller',
        filename: `internkontroll-kontroller-${today}.csv`,
        build: () =>
          buildCsv(
            ['Tittel', 'Type', 'Status', 'Frekvens', 'Eier', 'Effektivitet'],
            rows.map((c) => [
              c.title,
              c.type,
              c.status,
              c.frequencyLabel,
              c.owner,
              String(c.effectiveness ?? ''),
            ]),
          ),
      }
    }
    case 'gap': {
      const rows = data.krav.filter(
        (k) =>
          (k.status === 'gap' || k.status === 'partial') &&
          (!fwSet || fwSet.has(k.fw)) &&
          (!catSet || catSet.has(k.category)),
      )
      return {
        label: 'Eksporter gap',
        filename: `internkontroll-gap-${today}.csv`,
        build: () =>
          buildCsv(
            ['Rammeverk', 'Paragraf', 'Tittel', 'Status', 'Kritikalitet', 'Eier'],
            rows.map((k) => [k.fw, k.ref, k.title, k.status, k.criticality, k.owner ?? '']),
          ),
      }
    }
    case 'aarshjul': {
      const rows = data.aarshjul.filter(
        (a) => !fwSet || a.fw.some((id) => fwSet.has(id)),
      )
      return {
        label: 'Eksporter årshjul',
        filename: `internkontroll-aarshjul-${today}.csv`,
        build: () =>
          buildCsv(
            ['År', 'Måned', 'Tittel', 'Status', 'Eier', 'Rammeverk'],
            rows.map((a) => [
              String(a.year),
              String(a.month),
              a.title,
              a.status,
              a.owner,
              a.fw.join('|'),
            ]),
          ),
      }
    }
    case 'tiltak': {
      const rows = data.tiltak.filter(
        (t) => !catSet || catSet.has(t.category),
      )
      return {
        label: 'Eksporter tiltak',
        filename: `internkontroll-tiltak-${today}.csv`,
        build: () =>
          buildCsv(
            ['Tittel', 'Status', 'Prioritet', 'Eier', 'Frist', 'Rammeverk'],
            rows.map((t) => [
              t.title,
              t.status,
              t.priority,
              t.owner,
              t.deadline,
              t.fw,
            ]),
          ),
      }
    }
    case 'prosjekter': {
      return {
        label: 'Eksporter prosjekter',
        filename: `internkontroll-prosjekter-${today}.csv`,
        build: () =>
          buildCsv(
            ['Navn', 'Leder', 'Status', 'Fase', 'Frist', 'Tiltak', 'Åpne tiltak'],
            data.prosjekter.map((p) => [
              p.name,
              p.leader,
              p.status,
              p.phase,
              p.deadline,
              String(p.tasks),
              String(p.openTasks),
            ]),
          ),
      }
    }
    case 'revisjon': {
      return {
        label: 'Eksporter revisjonslogg',
        filename: `internkontroll-revisjon-${today}.csv`,
        build: () =>
          buildCsv(
            ['Tidspunkt', 'Aktør', 'Handling', 'Detalj'],
            data.audit.map((a) => [a.when, a.who, a.action, a.detail]),
          ),
      }
    }
    case 'oversikt':
      // Dashboard view — no list to export. Button hidden in headerActions.
      return null
  }
}

function buildCsv(headers: string[], rows: string[][]): Blob {
  const lines = [headers.map(escapeCsv).join(';')]
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(';'))
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
