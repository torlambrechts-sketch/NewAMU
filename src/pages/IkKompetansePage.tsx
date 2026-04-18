import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { IkKompetanseView } from '../../modules/internkontroll/IkKompetanseView'
import { IkWorkplacePageShell } from '../components/internkontroll/IkWorkplacePageShell'

export function IkKompetansePage() {
  const { competenceReqs, competenceRecordsWithStatus, canManage } = useInternkontroll()
  return (
    <IkWorkplacePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Internkontroll', to: '/internkontroll' }, { label: 'Kompetanse' }]}
      title="Kompetanse & sertifikater"
      description="Pilar 2 — AML § 3-2, Forskrift om utførelse av arbeid."
    >
      <IkKompetanseView
        requirements={competenceReqs}
        records={competenceRecordsWithStatus}
        canManage={canManage}
        onAddRecord={(reqId) => console.log('add record', reqId)}
        onAddRequirement={() => console.log('add requirement')}
      />
    </IkWorkplacePageShell>
  )
}
