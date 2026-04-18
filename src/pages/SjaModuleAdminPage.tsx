import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SjaModuleAdminView } from '../../modules/sja/SjaModuleAdminView'

export function SjaModuleAdminPage() {
  const { supabase, isAdmin, organization } = useOrgSetupContext()
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <SjaModuleAdminView
        supabase={supabase}
        canManageRbac={isAdmin}
        organizationId={organization?.id ?? null}
      />
    </div>
  )
}
