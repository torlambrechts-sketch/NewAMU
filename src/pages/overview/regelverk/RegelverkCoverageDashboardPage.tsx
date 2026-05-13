// Regelverk-dekning — dashboard under Oversikt.
//
// Layout følger platform-admin/layout scorecard-mønsteret:
//   - Søkefelt over en cream-deep filter-boks med Regelverk + Kategori-select
//   - «Vis detalj»-toggle bytter mellom kort (scorecard) og tabell
// Slide-over åpnes per krav via klikk på rad i begge visninger.

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ModulePageShell } from '../../../components/module'
import { REGELVERK, REQUIREMENTS } from '../../../data/regelverkRequirements'
import { useRegelverkCoverage, type CoverageEntry } from '../../../hooks/useRegelverkCoverage'
import { RegelverkKpiHeader } from './RegelverkKpiHeader'
import { RegelverkCoverageTable } from './RegelverkCoverageTable'
import { RegelverkScorecardView } from './RegelverkScorecardView'
import { RegelverkCoverageSlideOver } from './RegelverkCoverageSlideOver'
import { REGELVERK_ROLES, requirementMatchesRole } from './regelverkRoles'
import {
  isFreshProof,
  isOperationalKind,
  isStaleInstance,
  type RequirementWithCoverage,
} from './regelverkCoverageTypes'

// Matcher platformReferenceLayoutBlocks scorecard-filter-bar
const CREAM_DEEP = '#EFE8DC'

type ViewMode = 'table' | 'scorecard'

export function RegelverkCoverageDashboardPage() {
  const [selectedRegelverk, setSelectedRegelverk] = useState<string>('aml')
  // '' = all categories
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  // '' = all roles
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [search, setSearch] = useState('')
  const [openLawRef, setOpenLawRef] = useState<string | null>(null)
  // «Vis detalj» på = scorecard-kort. Av = kompakt tabell.
  const [viewMode, setViewMode] = useState<ViewMode>('scorecard')
  const { coverage, loading } = useRegelverkCoverage()

  const regelverk = useMemo(
    () => REGELVERK.find((r) => r.id === selectedRegelverk),
    [selectedRegelverk],
  )

  const requirementsForRegelverk = useMemo(
    () =>
      REQUIREMENTS.filter(
        (r) =>
          r.regelverkId === selectedRegelverk &&
          requirementMatchesRole(r, selectedRole === '' ? null : selectedRole),
      ),
    [selectedRegelverk, selectedRole],
  )

  const requirementsWithCoverage = useMemo<RequirementWithCoverage[]>(() => {
    return requirementsForRegelverk.map((req) => {
      // Eksakt match på lawRef + alle alternateRefs. BREDT DOMENE-OPPSLAG
      // (eks. 'AML') tas IKKE med — det festet tidligere én generell ROS
      // på alle 70 AML-§-er og ga falsk dekning. Domene-relaterte ROS-er
      // håndteres separat på sidenivå.
      const exact = coverage.get(req.lawRef) ?? []
      const alts: CoverageEntry[] = []
      for (const altRef of req.alternateRefs ?? []) {
        const found = coverage.get(altRef) ?? []
        alts.push(...found)
      }

      const dedup = new Map<string, CoverageEntry>()
      for (const e of [...exact, ...alts]) {
        dedup.set(`${e.kind}:${e.id}`, e)
      }
      const entries = [...dedup.values()]

      const byKind: RequirementWithCoverage['byKind'] = {
        course_system: 0,
        course_org: 0,
        document: 0,
        document_template: 0,
        survey: 0,
        checklist_template: 0,
        checklist_item: 0,
        ros: 0,
        task: 0,
        meeting_template: 0,
      }
      for (const e of entries) byKind[e.kind] += 1

      // Status (v2 — krever reelt bevis):
      //  covered    = ≥1 fersk publisert INSTANCE (kurs/dokument) i orgen,
      //               oppdatert siste 12 mnd.
      //  partial    = mal eller utdatert/utkast-instans finnes — orgen
      //               vet om kravet, men kan ikke vise gjennomført rutine.
      //  only_avvik = ingen innholds-bevis, ≥1 avvik tagget med §.
      //  uncovered  = ingenting.
      const now = new Date()
      const freshInstances = entries.filter((e) => isFreshProof(e, now)).length
      const staleInstances = entries.filter((e) => isStaleInstance(e, now)).length
      const templatesOnly = entries.filter(
        (e) => e.source === 'template' && !isOperationalKind(e.kind),
      ).length
      const operationalCount = entries.filter((e) => isOperationalKind(e.kind)).length

      const status: RequirementWithCoverage['status'] =
        freshInstances > 0
          ? 'covered'
          : staleInstances + templatesOnly > 0
            ? 'partial'
            : operationalCount > 0
              ? 'only_avvik'
              : 'uncovered'

      return {
        ...req,
        coverage: entries,
        byKind,
        status,
        proof: { freshInstances, staleInstances, templatesOnly },
      }
    })
  }, [requirementsForRegelverk, coverage])

  // Domene-relaterte ROS — vises som top-banner, ikke som per-§ dekning.
  const domainRos = useMemo<CoverageEntry[]>(() => {
    const domainKey = selectedRegelverk === 'aml' ? 'AML' : selectedRegelverk.toUpperCase()
    return (coverage.get(domainKey) ?? []).filter((c) => c.kind === 'ros')
  }, [coverage, selectedRegelverk])

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>()
    const cats: { value: string; label: string }[] = [{ value: '', label: 'Alle kategorier' }]
    for (const r of requirementsForRegelverk) {
      if (!seen.has(r.category)) {
        seen.add(r.category)
        cats.push({ value: r.category, label: r.category })
      }
    }
    return cats
  }, [requirementsForRegelverk])

  const openReq =
    openLawRef !== null
      ? requirementsWithCoverage.find((r) => r.lawRef === openLawRef) ?? null
      : null

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Arbeidsflate', to: '/' },
        { label: 'Oversikt', to: '/overview/hms' },
        { label: 'Regelverk-dekning' },
      ]}
      title="Regelverk-dekning"
      description="Velg regelverk for å se hvert krav og hvilke moduler som dekker det."
      loading={loading}
      loadingLabel="Beregner dekning på tvers av moduler …"
    >
      {/* Søkefelt — over filterbar slik som platform-admin scorecard */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk på § eller tittel …"
          className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#1a3d32]/25"
        />
      </div>

      {/* Filter bar i cream-deep — speiler scorecard-referansen */}
      <div
        className="grid gap-4 rounded-lg border border-neutral-200/80 p-4 sm:grid-cols-2 lg:grid-cols-4"
        style={{ backgroundColor: CREAM_DEEP }}
      >
        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          Regelverk
          <select
            value={selectedRegelverk}
            onChange={(e) => {
              setSelectedRegelverk(e.target.value)
              setSelectedCategory('')
            }}
            className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            {REGELVERK.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} — {r.fullName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          Kategori
          <div className="mt-1.5 flex items-center gap-1">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Alle kategorier</option>
              {categoryOptions
                .filter((o) => o.value !== '')
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </select>
            {selectedCategory ? (
              <button
                type="button"
                onClick={() => setSelectedCategory('')}
                className="rounded-md border border-neutral-200 bg-white p-2 text-neutral-500 hover:bg-neutral-50"
                aria-label="Fjern kategori-filter"
              >
                ×
              </button>
            ) : null}
          </div>
        </label>

        <label className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          Rolle
          <div className="mt-1.5 flex items-center gap-1">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Alle roller</option>
              {REGELVERK_ROLES.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.label}
                </option>
              ))}
            </select>
            {selectedRole ? (
              <button
                type="button"
                onClick={() => setSelectedRole('')}
                className="rounded-md border border-neutral-200 bg-white p-2 text-neutral-500 hover:bg-neutral-50"
                aria-label="Fjern rolle-filter"
              >
                ×
              </button>
            ) : null}
          </div>
        </label>

        <div className="flex items-end gap-3 pb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
            Vis detalj
          </span>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={viewMode === 'scorecard'}
              onChange={(e) => setViewMode(e.target.checked ? 'scorecard' : 'table')}
            />
            <span className="h-6 w-11 rounded-full bg-neutral-300 transition peer-checked:bg-[#1a3d32] after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>
      </div>

      {regelverk?.description ? (
        <p className="text-sm text-neutral-600">{regelverk.description}</p>
      ) : null}

      <RegelverkKpiHeader
        requirements={requirementsWithCoverage}
        regelverkLabel={regelverk?.label ?? selectedRegelverk}
      />

      {domainRos.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">
            {domainRos.length} ROS-analyse{domainRos.length === 1 ? '' : 'r'} tagget med
            domenet «{regelverk?.label ?? selectedRegelverk}»
          </p>
          <p className="mt-1 text-xs text-amber-900/80">
            ROS bruker brede domene-tagger (eks. «AML») og ikke spesifikke §. Disse
            telles derfor ikke som dekning av enkelt-paragrafer, men vises som
            kontekst. Lenk ROS-en til konkrete § via avviks-modulen for å få per-§-dekning.
          </p>
        </div>
      ) : null}

      {viewMode === 'table' ? (
        <RegelverkCoverageTable
          requirements={requirementsWithCoverage}
          search={search}
          selectedCategory={selectedCategory === '' ? null : selectedCategory}
          onOpenRow={setOpenLawRef}
        />
      ) : (
        <RegelverkScorecardView
          requirements={requirementsWithCoverage}
          search={search}
          selectedCategory={selectedCategory === '' ? null : selectedCategory}
          onOpenRow={setOpenLawRef}
        />
      )}

      <RegelverkCoverageSlideOver
        open={openReq !== null}
        req={openReq}
        onClose={() => setOpenLawRef(null)}
      />
    </ModulePageShell>
  )
}
