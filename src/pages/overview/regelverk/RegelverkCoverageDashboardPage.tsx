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
import { RegelverkCoverageTable } from './RegelverkCoverageTable'
import { RegelverkCoverageSlideOver } from './RegelverkCoverageSlideOver'
import {
  isFreshProof,
  isOperationalKind,
  isStaleInstance,
  type RequirementWithCoverage,
} from './regelverkCoverageTypes'

export function RegelverkCoverageDashboardPage() {
  const [selectedRegelverk, setSelectedRegelverk] = useState<string>('aml')
  // '' = all categories
  const [selectedCategory, setSelectedCategory] = useState<string>('')
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

      // Status (v2 — krever reell proof):
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

  const regelverkOptions: SelectOption[] = useMemo(
    () =>
      REGELVERK.map((r) => ({
        value: r.id,
        label: `${r.label} — ${r.fullName}`,
      })),
    [],
  )

  const categoryOptions: SelectOption[] = useMemo(() => {
    const seen = new Set<string>()
    const cats: SelectOption[] = [{ value: '', label: 'Alle kategorier' }]
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
                setSelectedRegelverk(v)
                setSelectedCategory('')
                setSearch('')
              }}
            />
          </div>
        </div>

        <div className="min-w-[220px] flex-1">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-neutral-600">
            Kategori
          </label>
          <div className="mt-1.5">
            <SearchableSelect
              options={categoryOptions}
              value={selectedCategory}
              onChange={(v) => setSelectedCategory(v)}
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

      <RegelverkCoverageTable
        requirements={requirementsWithCoverage}
        search={search}
        onSearchChange={setSearch}
        selectedCategory={selectedCategory === '' ? null : selectedCategory}
        onOpenRow={setOpenLawRef}
      />

      <RegelverkCoverageSlideOver
        open={openReq !== null}
        req={openReq}
        onClose={() => setOpenLawRef(null)}
      />
    </ModulePageShell>
  )
}
