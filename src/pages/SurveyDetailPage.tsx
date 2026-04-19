import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SurveyAnalysisPage } from '../modules/survey/SurveyAnalysisPage'

export function SurveyDetailPage() {
  const { supabase } = useOrgSetupContext()
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <SurveyAnalysisPage supabase={supabase} />
    </div>
  )
}
