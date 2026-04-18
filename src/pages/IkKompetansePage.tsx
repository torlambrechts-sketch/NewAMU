import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { IkKompetanseView } from '../../modules/internkontroll/IkKompetanseView'

export function IkKompetansePage() {
  const { competenceReqs, competenceRecordsWithStatus, canManage } = useInternkontroll()
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">Kompetanse & sertifikater</h1>
        <p className="mt-1 text-sm text-neutral-500">Pilar 2 — AML § 3-2, Forskrift om utførelse av arbeid</p>
      </div>
      <IkKompetanseView
        requirements={competenceReqs}
        records={competenceRecordsWithStatus}
        canManage={canManage}
        onAddRecord={(reqId) => console.log('add record', reqId)}
        onAddRequirement={() => console.log('add requirement')}
      />
    </div>
  )
}
