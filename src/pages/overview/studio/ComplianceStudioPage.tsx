// Compliance Studio — guidet konfigurering på tvers av moduler.
//
// Documents-stil layout: kategori-sidebar venstre, wizard-kort i grid
// til høyre. Kategorier er bruks-scenarier (ikke lov-kapittel).
//
// Hver wizard er en sammensetning av eksisterende provisjonerings-RPCer
// og module_picker-feltet, slik at brukeren går fra "0 dekning" til
// "minst baseline dekket" i én økt.

import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ModulePageShell } from '../../../components/module'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { useRegelverkCoverage } from '../../../hooks/useRegelverkCoverage'
import {
  STUDIO_CATEGORIES,
  STUDIO_WIZARDS,
  type StudioWizardEntry,
} from './studioWizardCatalog'
import {
  makeAmuEtableringWizard,
  makeHmsGrunnmurWizard,
  makeVarslingWizard,
  type StudioWizardDeps,
} from './studioWizardFactories'
import { StudioWizardCard } from './StudioWizardCard'
import { StudioWizardLauncher } from './StudioWizardLauncher'
import { useAllWizardRuns } from './useAllWizardRuns'
import type { WizardDef } from '../../../components/wizard/types'

const SERIF = "'Libre Baskerville', Georgia, serif"

// Map wizard_key → factory. Holder seg synkronisert med STUDIO_WIZARDS.
const FACTORY_BY_KEY: Record<
  string,
  (deps: StudioWizardDeps) => WizardDef
> = {
  'compliance.hms_grunnmur': makeHmsGrunnmurWizard,
  'compliance.varsling': makeVarslingWizard,
  'compliance.amu_etablering': makeAmuEtableringWizard,
}

export function ComplianceStudioPage() {
  const { supabase, organization, members } = useOrgSetupContext()
  const { coverage, loading: coverageLoading } = useRegelverkCoverage()
  const { runs, loading: runsLoading, refetch } = useAllWizardRuns()

  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    STUDIO_CATEGORIES[0]?.id ?? '',
  )
  const [openWizardKey, setOpenWizardKey] = useState<string | null>(null)

  const wizardsByCategory = useMemo(() => {
    const map = new Map<string, StudioWizardEntry[]>()
    for (const w of STUDIO_WIZARDS) {
      const list = map.get(w.categoryId) ?? []
      list.push(w)
      map.set(w.categoryId, list)
    }
    return map
  }, [])

  const activeCategory = STUDIO_CATEGORIES.find((c) => c.id === activeCategoryId)
  const activeWizards = wizardsByCategory.get(activeCategoryId) ?? []
  const employeeCount = members?.length ?? 1

  const buildDef = useMemo(() => {
    return (
      wizardKey: string,
    ): ((args: {
      onCompleted: (values: Record<string, string | boolean>) => void
      initialValues?: Record<string, string | boolean>
    }) => WizardDef) => {
      const factory = FACTORY_BY_KEY[wizardKey]
      return ({ onCompleted }) =>
        factory({
          supabase,
          organizationId: organization?.id,
          coverage,
          employeeCount,
          onCompleted,
        })
    }
  }, [supabase, organization?.id, coverage, employeeCount])

  // Tellinger for sidebar-badges.
  function categoryStats(catId: string) {
    const list = wizardsByCategory.get(catId) ?? []
    const total = list.length
    const completed = list.filter((w) => !!runs[w.wizardKey]?.completed_at).length
    return { total, completed }
  }

  const loading = coverageLoading || runsLoading

  // Antall trinn er statisk for våre tre wizards — utled fra factory ved behov.
  function totalStepsFor(wizardKey: string): number {
    const factory = FACTORY_BY_KEY[wizardKey]
    if (!factory) return 6
    try {
      const def = factory({
        supabase,
        organizationId: organization?.id,
        coverage,
        employeeCount,
        onCompleted: () => undefined,
      })
      return def.steps.length
    } catch {
      return 6
    }
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Arbeidsflate', to: '/' },
        { label: 'Oversikt', to: '/overview/hms' },
        { label: 'Compliance Studio' },
      ]}
      title="Compliance Studio"
      description="Guidet konfigurering på tvers av moduler. Start med kjernen, fortsett scenario for scenario."
      loading={loading}
      loadingLabel="Laster veivisere og dekning …"
    >
      <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
        <aside className="rounded-lg border border-neutral-200/80 bg-white p-3 shadow-sm">
          <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
            Kategori
          </p>
          <ul className="space-y-1">
            {STUDIO_CATEGORIES.map((cat) => {
              const { total, completed } = categoryStats(cat.id)
              const active = cat.id === activeCategoryId
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                      active
                        ? 'bg-neutral-100 font-semibold text-neutral-900'
                        : 'text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="truncate pr-2">{cat.label}</span>
                    <span className="flex items-center gap-2 tabular-nums">
                      {total === 0 ? (
                        <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                          Snart
                        </span>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            completed === total
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-neutral-100 text-neutral-700'
                          }`}
                        >
                          {completed}/{total}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section>
          {activeCategory ? (
            <header className="mb-3">
              <h2
                className="text-xl font-semibold text-neutral-900"
                style={{ fontFamily: SERIF }}
              >
                {activeCategory.label}
              </h2>
              <p className="mt-0.5 text-sm text-neutral-600">{activeCategory.description}</p>
            </header>
          ) : null}

          {activeWizards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-500">
              <Loader2 className="mx-auto mb-2 size-5 text-neutral-300" aria-hidden />
              Veivisere for denne kategorien kommer snart.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {activeWizards.map((entry) => (
                <StudioWizardCard
                  key={entry.wizardKey}
                  entry={entry}
                  run={runs[entry.wizardKey] ?? null}
                  totalSteps={totalStepsFor(entry.wizardKey)}
                  onOpen={() => setOpenWizardKey(entry.wizardKey)}
                  onReset={async () => {
                    if (!supabase || !organization?.id) return
                    const userRun = runs[entry.wizardKey]
                    if (!userRun) return
                    if (
                      !window.confirm(
                        `Nullstille framdriften for «${entry.title}»? Provisjonerte dokumenter/sjekklister forblir.`,
                      )
                    )
                      return
                    await supabase
                      .from('compliance_wizard_runs')
                      .delete()
                      .eq('id', userRun.id)
                    void refetch()
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {openWizardKey && FACTORY_BY_KEY[openWizardKey] ? (
        <StudioWizardLauncher
          wizardKey={openWizardKey}
          open={true}
          onClose={() => {
            setOpenWizardKey(null)
            void refetch()
          }}
          buildDef={buildDef(openWizardKey)}
          onCompleted={() => {
            void refetch()
          }}
        />
      ) : null}
    </ModulePageShell>
  )
}
