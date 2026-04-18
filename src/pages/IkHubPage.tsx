import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { IkHubView } from '../../modules/internkontroll/IkHubView'

export function IkHubPage() {
  const { pillarStatuses, overallIkStatus, loading } = useInternkontroll()
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">Internkontroll</h1>
        <p className="mt-1 text-sm text-neutral-500">IK-forskriften § 5 — systematisk HMS-arbeid</p>
      </div>
      <IkHubView pillarStatuses={pillarStatuses} overallIkStatus={overallIkStatus} loading={loading} />
    </div>
  )
}
