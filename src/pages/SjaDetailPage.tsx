import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SjaPage } from '../../modules/sja/SjaPage'

export function SjaDetailPage() {
  const { supabase } = useOrgSetupContext()
  return <SjaPage supabase={supabase} />
}
