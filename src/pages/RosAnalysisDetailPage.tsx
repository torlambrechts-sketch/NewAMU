import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { RosAnalysisPage } from '../../modules/ros/RosAnalysisPage'

export function RosAnalysisDetailPage() {
  const { supabase } = useOrgSetupContext()
  return <RosAnalysisPage supabase={supabase} />
}
