import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SurveyDetailView } from '../../modules/survey/SurveyDetailView'

export function SurveyDetailPage() {
  const { supabase } = useOrgSetupContext()
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <SurveyDetailView supabase={supabase} />
    </div>
  )
}
