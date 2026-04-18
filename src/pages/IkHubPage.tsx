import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { IkHubView } from '../../modules/internkontroll/IkHubView'
import { IkWorkplacePageShell } from '../components/internkontroll/IkWorkplacePageShell'

export function IkHubPage() {
  const { pillarStatuses, overallIkStatus, loading } = useInternkontroll()
  return (
    <IkWorkplacePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Internkontroll' }]}
      title="Internkontroll"
      description="IK-forskriften § 5 — systematisk HMS-arbeid. Åpne en pilar for detaljer."
    >
      <IkHubView pillarStatuses={pillarStatuses} overallIkStatus={overallIkStatus} loading={loading} />
    </IkWorkplacePageShell>
  )
}
