import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { WarningBox } from '../../ui/AlertBox'
import { DocumentFolderAccessSettings } from '../../../pages/documents/DocumentFolderAccessSettings'
import { DocumentAccessRequestsPanel } from '../../../pages/documents/DocumentAccessRequestsPanel'

export function DocumentsSettingsTilgang() {
  const { profile, can } = useOrgSetupContext()
  const canManage = profile?.is_org_admin === true || can('documents.manage')

  if (!canManage) {
    return <WarningBox>Du har ikke tilgang til tilgangsstyring for dokumenter.</WarningBox>
  }

  return (
    <div className="space-y-6">
      <DocumentFolderAccessSettings canManage={canManage} />
      <DocumentAccessRequestsPanel canManage={canManage} />
    </div>
  )
}
