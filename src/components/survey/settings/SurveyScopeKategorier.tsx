import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { SurveyKategorierTab } from '../../../../modules/survey/admin/SurveyKategorierTab'

export default function SurveyScopeKategorier() {
  const { supabase } = useOrgSetupContext()
  return <SurveyKategorierTab supabase={supabase} />
}
