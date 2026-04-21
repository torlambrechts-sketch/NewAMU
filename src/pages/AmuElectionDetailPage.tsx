import { useParams } from 'react-router-dom'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import { AmuElectionDetailView } from '../../modules/amu_election/AmuElectionDetailView'

export function AmuElectionDetailPage() {
  const { electionId } = useParams<{ electionId: string }>()
  const { supabase } = useOrgSetupContext()

  if (!electionId) {
    return (
      <div className="min-h-screen bg-[#F9F7F2] px-4 py-6 md:px-8">
        <p className="text-sm text-neutral-600">Mangler valg-ID.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 md:px-8">
        <WorkplacePageHeading1
          breadcrumb={[
            { label: 'HMS' },
            { label: 'Internkontroll', to: '/internkontroll' },
            { label: 'AMU-valg', to: '/internkontroll/amu-valg' },
            { label: 'Detaljer' },
          ]}
          title="AMU-valg"
          description="Detaljvisning med faner for oversikt, nominasjon, valglokale og resultater."
        />
        <AmuElectionDetailView supabase={supabase} electionId={electionId} />
      </div>
    </div>
  )
}
