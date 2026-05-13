import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { SurveyPakkerTab } from '../../../../modules/survey/admin/SurveyPakkerTab'

export default function SurveyScopePakker() {
  const { supabase } = useOrgSetupContext()
  return <SurveyPakkerTab supabase={supabase} />
}
