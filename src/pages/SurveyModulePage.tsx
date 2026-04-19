import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SurveyModuleView } from '../modules/survey/SurveyModuleView'

export function SurveyModulePage() {
  const { supabase } = useOrgSetupContext()
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <SurveyModuleView supabase={supabase} />
    </div>
  )
}
