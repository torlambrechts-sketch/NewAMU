import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { IkMalView } from '../../modules/internkontroll/IkMalView'

export function IkMalPage() {
  const { goals, goalMeasurements, canManage } = useInternkontroll()
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">HMS-mål & KPI</h1>
        <p className="mt-1 text-sm text-neutral-500">Pilar 4 — AML § 3-1, systematisk målstyring</p>
      </div>
      <IkMalView
        goals={goals}
        measurements={goalMeasurements}
        canManage={canManage}
        onUpsertGoal={(goal) => console.log('upsert goal', goal)}
        onAddMeasurement={(goalId) => console.log('add measurement', goalId)}
      />
    </div>
  )
}
