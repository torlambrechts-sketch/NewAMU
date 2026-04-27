import { ModuleSectionCard } from '../../../src/components/module'
import type { SurveyDetailTab } from './types'

export function SurveyTiltakTab(_props: SurveyDetailTab) {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">Handlingsplan</h2>
      <p className="mt-2 text-sm text-neutral-500">Kommer i neste steg.</p>
    </ModuleSectionCard>
  )
}
