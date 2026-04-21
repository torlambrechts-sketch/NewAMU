import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SurveyPage } from '../../modules/survey/SurveyPage'

export function SurveyModulePage() {
  const { supabase } = useOrgSetupContext()
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <SurveyPage supabase={supabase} />
    </div>
  )
}
