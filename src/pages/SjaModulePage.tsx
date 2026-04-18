import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SjaModuleView } from '../../modules/sja/SjaModuleView'

export function SjaModulePage() {
  const { supabase } = useOrgSetupContext()
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <SjaModuleView supabase={supabase} />
    </div>
  )
}
