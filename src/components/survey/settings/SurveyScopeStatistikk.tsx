import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { SurveyStatistikkTab } from '../../../../modules/survey/admin/SurveyStatistikkTab'

export default function SurveyScopeStatistikk() {
  const { supabase } = useOrgSetupContext()
  return <SurveyStatistikkTab supabase={supabase} />
}
