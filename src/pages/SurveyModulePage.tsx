import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SurveyPage } from '../../modules/survey/SurveyPage'

export function SurveyModulePage() {
  const { supabase } = useOrgSetupContext()
  return <SurveyPage supabase={supabase} />
}
