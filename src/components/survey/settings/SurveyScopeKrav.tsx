import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { SurveyKravTab } from '../../../../modules/survey/admin/SurveyKravTab'

export default function SurveyScopeKrav() {
  const { supabase } = useOrgSetupContext()
  return <SurveyKravTab supabase={supabase} />
}
