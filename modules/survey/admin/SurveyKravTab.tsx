// SurveyKravTab — legal-requirement coverage for the survey module.
// Groups law_ref values from the template catalog so admins can see
// which statutory obligations are covered by the current template set.

import { ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
import { useSurvey } from '../index'

const MANDATORY_LAW_LABEL: Record<string, string> = {
  AML_4_3: 'AML § 4-3 (psykososialt arbeidsmiljø)',
  AML_4_3_3: 'AML § 4-3 (3) (vold/trusler, trakassering)',
  AML_4_4: 'AML § 4-4 (fysisk arbeidsmiljø)',
  AML_4_1_3: 'AML § 4-1 (3) (endring/omstilling)',
  AML_6_2: 'AML § 6-2 (verneombud)',
  LDL_26: 'LDL § 26 (ARP — likestilling og diskriminering)',
}

export function SurveyKravTab({ supabase }: { supabase: ReturnType<typeof useOrgSetupContext>['supabase'] }) {
  const survey = useSurvey({ supabase })

  // Collect unique mandatory_law values from questions inside each template body
  const mandatoryLawEntries = useMemo(() => {
    const mlSet = new Set<string>()
    for (const t of survey.templateCatalog) {
      const questions = t.body?.questions ?? []
      for (const q of questions) {
        if (q.mandatory_law) mlSet.add(q.mandatory_law)
      }
    }
    return Array.from(mlSet).sort()
  }, [survey.templateCatalog])

  // Build sorted list of law_ref entries
  const refEntries = useMemo(() => {
    const refMap = new Map<string, string[]>()
    for (const t of survey.templateCatalog) {
      if (t.law_ref) {
        if (!refMap.has(t.law_ref)) refMap.set(t.law_ref, [])
        refMap.get(t.law_ref)!.push(t.name)
      }
    }
    return Array.from(refMap.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [survey.templateCatalog])

  const totalCovered = refEntries.length

  return (
    <div className="space-y-6">
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-[#7c3aed]" aria-hidden />
          <h2 className="text-lg font-semibold text-neutral-900">Lovkrav</h2>
          {totalCovered > 0 && (
            <span className="ml-auto text-xs text-neutral-500">
              {totalCovered} lovhenvisning{totalCovered !== 1 ? 'er' : ''} totalt
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-600 mb-5">
          Lovhenvisninger hentet fra malenes <code className="text-xs bg-neutral-100 px-1 rounded">law_ref</code>-felt.
          Brukes av planleggeren til å kartlegge om obligatoriske krav er dekket.
        </p>

        {mandatoryLawEntries.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Obligatoriske krav dekket
            </p>
            <div className="flex flex-wrap gap-2">
              {mandatoryLawEntries.map((ml) => (
                <Badge key={ml} variant="info">
                  {MANDATORY_LAW_LABEL[ml] ?? ml}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {refEntries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
            Ingen maler med lovhenvisninger funnet.
          </p>
        ) : (
          <div className="space-y-2">
            {refEntries.map(([ref, tplNames]) => (
              <div
                key={ref}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-neutral-200/80 bg-neutral-50/50 px-4 py-3"
              >
                <Badge variant="info">{ref}</Badge>
                <p className="text-xs text-neutral-500">
                  {tplNames.join(' · ')}
                </p>
              </div>
            ))}
          </div>
        )}
      </ModuleSectionCard>
    </div>
  )
}
