import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { IkMalView } from '../../modules/internkontroll/IkMalView'
import { IkWorkplacePageShell } from '../components/internkontroll/IkWorkplacePageShell'

export function IkMalPage() {
  const { goals, goalMeasurements, canManage } = useInternkontroll()
  return (
    <IkWorkplacePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Internkontroll', to: '/internkontroll' }, { label: 'HMS-mål' }]}
      title="HMS-mål & KPI"
      description="Pilar 4 — AML § 3-1, systematisk målstyring."
    >
      <IkMalView
        goals={goals}
        measurements={goalMeasurements}
        canManage={canManage}
        onUpsertGoal={(goal) => console.log('upsert goal', goal)}
        onAddMeasurement={(goalId) => console.log('add measurement', goalId)}
      />
    </IkWorkplacePageShell>
  )
}
