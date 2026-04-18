import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { IkMedvirkningView } from '../../modules/internkontroll/IkMedvirkningView'
import type { IkOrgRoleRow } from '../../modules/internkontroll/types'
import { IkWorkplacePageShell } from '../components/internkontroll/IkWorkplacePageShell'

export function IkMedvirkningPage() {
  const { orgRoles, canManage } = useInternkontroll()
  return (
    <IkWorkplacePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Internkontroll', to: '/internkontroll' }, { label: 'Medvirkning' }]}
      title="Medvirkning & roller"
      description="Pilar 3 — AML § 6-1, § 7-1, § 3-3."
    >
      <IkMedvirkningView
        roles={orgRoles}
        canManage={canManage}
        onUpsertRole={(role: Partial<IkOrgRoleRow> & { role_key: string }) => console.log('upsert role', role)}
      />
    </IkWorkplacePageShell>
  )
}
