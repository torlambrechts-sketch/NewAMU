// Regelverk-dekning — dashboard under Oversikt.
//
// Tre-lags layout: (1) to KPI-kort på toppen, (2) kategori-sidebar
// til venstre, (3) List2-tabell med modul-chips, status- og plikt-pill.
// Slide-over åpnes per krav via klikk på rad.
//
// Erstatter den utilitære admin-versjonen i RegelverkCoveragePage.tsx.

import { useMemo, useState } from 'react'
import { ModulePageShell } from '../../../components/module'
import { SearchableSelect, type SelectOption } from '../../../components/ui/SearchableSelect'
import { REGELVERK, REQUIREMENTS } from '../../../data/regelverkRequirements'
import { useRegelverkCoverage, type CoverageEntry } from '../../../hooks/useRegelverkCoverage'
import { RegelverkKpiHeader } from './RegelverkKpiHeader'
import { RegelverkCategorySidebar } from './RegelverkCategorySidebar'
import { RegelverkCoverageTable } from './RegelverkCoverageTable'
import { RegelverkCoverageSlideOver } from './RegelverkCoverageSlideOver'
import type { RequirementWithCoverage } from './regelverkCoverageTypes'

export function RegelverkCoverageDashboardPage() {
  const [selectedRegelverk, setSelectedRegelverk] = useState<string>('aml')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [openLawRef, setOpenLawRef] = useState<string | null>(null)
  const { coverage, loading } = useRegelverkCoverage()

  const regelverk = useMemo(
    () => REGELVERK.find((r) => r.id === selectedRegelverk),
    [selectedRegelverk],
  )

  const requirementsForRegelverk = useMemo(
    () => REQUIREMENTS.filter((r) => r.regelverkId === selectedRegelverk),
    [selectedRegelverk],
  )

  const requirementsWithCoverage = useMemo<RequirementWithCoverage[]>(() => {
    return requirementsForRegelverk.map((req) => {
      const exact = coverage.get(req.lawRef) ?? []
      const alts: CoverageEntry[] = []
      for (const altRef of req.alternateRefs ?? []) {
        const found = coverage.get(altRef) ?? []
        alts.push(...found)
      }
      // ROS bruker law_domains (eks: "AML") — bredt fanget
      const domainKey = req.regelverkId === 'aml' ? 'AML' : req.regelverkId.toUpperCase()
      const domainMatches = (coverage.get(domainKey) ?? []).filter((c) => c.kind === 'ros')

      const dedup = new Map<string, CoverageEntry>()
      for (const e of [...exact, ...alts, ...domainMatches]) {
        dedup.set(`${e.kind}:${e.id}`, e)
      }
      const entries = [...dedup.values()]

      const byKind: RequirementWithCoverage['byKind'] = {
        course_system: 0,
        course_org: 0,
        document: 0,
        survey: 0,
        checklist_template: 0,
        checklist_item: 0,
        ros: 0,
        task: 0,
        meeting_template: 0,
      }
      for (const e of entries) byKind[e.kind] += 1

      // Status: dekket hvis ≥1 ressurs; delvis hvis bare ROS/avvik uten innholds-ressurs;
      // udekket hvis 0.
      const total = entries.length
      const hasContent =
        byKind.course_system +
          byKind.course_org +
          byKind.document +
          byKind.checklist_template +
          byKind.checklist_item +
          byKind.survey +
          byKind.meeting_template >
        0
      const status: RequirementWithCoverage['status'] =
        total === 0 ? 'uncovered' : hasContent ? 'covered' : 'partial'

      return { ...req, coverage: entries, byKind, status }
    })
  }, [requirementsForRegelverk, coverage])

  const regelverkOptions: SelectOption[] = useMemo(
    () =>
      REGELVERK.map((r) => ({
        value: r.id,
        label: `${r.label} — ${r.fullName}`,
      })),
    [],
  )

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
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[280px] flex-1">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-neutral-600">
            Regelverk
          </label>
          <div className="mt-1.5">
            <SearchableSelect
              options={regelverkOptions}
              value={selectedRegelverk}
              onChange={(v) => {
                setSelectedRegelverk(String(v))
                setSelectedCategory(null)
                setSearch('')
              }}
            />
          </div>
        </div>
        {regelverk ? (
          <p className="max-w-md text-sm text-neutral-600">{regelverk.description}</p>
        ) : null}
      </div>

      <RegelverkKpiHeader
        requirements={requirementsWithCoverage}
        regelverkLabel={regelverk?.label ?? selectedRegelverk}
      />

      <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
        <RegelverkCategorySidebar
          requirements={requirementsWithCoverage}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        <RegelverkCoverageTable
          requirements={requirementsWithCoverage}
          search={search}
          onSearchChange={setSearch}
          selectedCategory={selectedCategory}
          onOpenRow={setOpenLawRef}
        />
      </div>

      <RegelverkCoverageSlideOver
        open={openReq !== null}
        req={openReq}
        onClose={() => setOpenLawRef(null)}
      />
    </ModulePageShell>
  )
}
