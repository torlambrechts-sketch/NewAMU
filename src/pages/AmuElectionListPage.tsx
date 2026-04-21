import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { AmuElectionPage } from '../../modules/amu_election/AmuElectionPage'

export function AmuElectionListPage() {
  const { supabase } = useOrgSetupContext()
  return <AmuElectionPage supabase={supabase} />
}
