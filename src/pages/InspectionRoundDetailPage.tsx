import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { InspectionRoundPage } from '../../modules/inspection/InspectionRoundPage'

export function InspectionRoundDetailPage() {
  const { supabase } = useOrgSetupContext()
  return <InspectionRoundPage supabase={supabase} />
}
