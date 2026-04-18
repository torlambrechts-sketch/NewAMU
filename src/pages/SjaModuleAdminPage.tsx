import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SjaModuleAdminView } from '../../modules/sja/SjaModuleAdminView'

export function SjaModuleAdminPage() {
  const { supabase, isAdmin, organization } = useOrgSetupContext()
  return (
    <SjaModuleAdminView
      supabase={supabase}
      canManageRbac={isAdmin}
      organizationId={organization?.id ?? null}
    />
  )
}
