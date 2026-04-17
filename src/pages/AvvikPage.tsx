import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { AvvikView } from '../../modules/avvik/AvvikView'

export function AvvikPage() {
  const { supabase } = useOrgSetupContext()
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <AvvikView supabase={supabase} />
    </div>
  )
}
