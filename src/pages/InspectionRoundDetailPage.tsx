import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { InspectionRoundPage } from '../../modules/inspection/InspectionRoundPage'

export function InspectionRoundDetailPage() {
  const { supabase } = useOrgSetupContext()
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <InspectionRoundPage supabase={supabase} />
    </div>
  )
}
