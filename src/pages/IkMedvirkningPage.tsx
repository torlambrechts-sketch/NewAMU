import { useInternkontroll } from '../../modules/internkontroll/useInternkontroll'
import { IkMedvirkningView } from '../../modules/internkontroll/IkMedvirkningView'
import type { IkOrgRoleRow } from '../../modules/internkontroll/types'

export function IkMedvirkningPage() {
  const { orgRoles, canManage } = useInternkontroll()
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">Medvirkning & roller</h1>
        <p className="mt-1 text-sm text-neutral-500">Pilar 3 — AML § 6-1, § 7-1, § 3-3</p>
      </div>
      <IkMedvirkningView
        roles={orgRoles}
        canManage={canManage}
        onUpsertRole={(role: Partial<IkOrgRoleRow> & { role_key: string }) => console.log('upsert role', role)}
      />
    </div>
  )
}
