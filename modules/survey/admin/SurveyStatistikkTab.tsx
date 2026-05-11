// SurveyStatistikkTab — template coverage statistics for the survey module.
// Shows total templates split by system/org, category breakdown, and
// how many have law refs.

import { BarChart2 } from 'lucide-react'
import { useMemo } from 'react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { useSurvey } from '../index'

const CATEGORY_LABEL: Record<string, string> = {
  psychosocial: 'Psykososialt arbeidsmiljø',
  physical: 'Fysisk arbeidsmiljø',
  organization: 'Organisasjon og samarbeid',
  arbeidsmiljo: 'Arbeidsmiljø',
  hms: 'HMS',
  satisfaction: 'Medarbeidertilfredshet',
  engagement: 'Medarbeiderengasjement',
}

export function SurveyStatistikkTab({ supabase }: { supabase: ReturnType<typeof useOrgSetupContext>['supabase'] }) {
  const survey = useSurvey({ supabase })

  const { systemCount, orgCount, withRefCount, categoryRows } = useMemo(() => {
    const sys = survey.templateCatalog.filter((t) => t.is_system)
    const org = survey.templateCatalog.filter((t) => !t.is_system)
    const withRef = survey.templateCatalog.filter((t) => !!t.law_ref)

    const catMap = new Map<string, number>()
    for (const t of survey.templateCatalog) {
      catMap.set(t.category, (catMap.get(t.category) ?? 0) + 1)
    }

    return {
      systemCount: sys.length,
      orgCount: org.length,
      withRefCount: withRef.length,
      categoryRows: Array.from(catMap.entries()).sort(([, a], [, b]) => b - a),
    }
  }, [survey.templateCatalog])

  const total = systemCount + orgCount

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Totalt maler', value: total },
          { label: 'Systemmaler', value: systemCount },
          { label: 'Egne maler', value: orgCount },
          { label: 'Med lovref.', value: withRefCount },
        ].map(({ label, value }) => (
          <ModuleSectionCard key={label} className="p-4 text-center">
            <p className="text-2xl font-bold text-[#7c3aed]">{value}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
          </ModuleSectionCard>
        ))}
      </div>

      {/* Per-category breakdown */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-5 w-5 text-[#7c3aed]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Per kategori</h2>
        </div>

        {categoryRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
            Ingen maler funnet.
          </p>
        ) : (
          <ul className="space-y-2">
            {categoryRows.map(([cat, count]) => (
              <li
                key={cat}
                className="flex items-center justify-between rounded-lg border border-neutral-200/80 bg-neutral-50/40 px-4 py-2.5"
              >
                <span className="text-sm font-medium text-neutral-900">
                  {CATEGORY_LABEL[cat] ?? cat}
                </span>
                <span className="text-sm text-neutral-600">
                  {count} {count === 1 ? 'mal' : 'maler'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ModuleSectionCard>
    </div>
  )
}
