import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { SjaModuleAdminView } from '../../modules/sja/SjaModuleAdminView'

/**
 * Thin route wrapper for `/sja/admin`.
 *
 * `SjaModuleAdminView` owns its own `ModulePageShell` chrome — this wrapper
 * only injects Supabase + RBAC + org-id from the org-context.
 */
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
