import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SjaPage } from '../../modules/sja/SjaPage'

export function SjaDetailPage() {
  const { supabase } = useOrgSetupContext()
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <SjaPage supabase={supabase} />
    </div>
  )
}
