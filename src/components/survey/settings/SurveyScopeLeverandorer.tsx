import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { SurveyLeverandorerTab } from '../../../../modules/survey/admin/SurveyLeverandorerTab'

export default function SurveyScopeLeverandorer() {
  const { supabase } = useOrgSetupContext()
  return <SurveyLeverandorerTab supabase={supabase} />
}
