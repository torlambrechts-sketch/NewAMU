import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { RosModuleView } from '../../modules/ros/RosModuleView'

export function RosModulePage() {
  const { supabase } = useOrgSetupContext()
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <RosModuleView supabase={supabase} />
    </div>
  )
}
